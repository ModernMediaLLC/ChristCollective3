// Admin Conversations: every text to and from members goes through Blooio and is mirrored into
// text_messages, so the CRM can show threads grouped by match circle, tally the date polls, and
// start a circle's group text once people confirm. Admin-only; members never see this.
import type { Express, RequestHandler } from "express";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db, pool } from "./db";
import { storage } from "./storage";
import { matchCircleMembers, matchCircles, textMessages, users } from "@shared/schema";
import * as blooio from "./blooio";

const RSVP = ["confirmed", "declined", "opted_out"] as const;

export async function ensureTextingTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS text_messages (
      id serial PRIMARY KEY,
      chat_id varchar NOT NULL,
      user_id varchar REFERENCES users(id) ON DELETE SET NULL,
      circle_id integer REFERENCES match_circles(id) ON DELETE SET NULL,
      direction varchar NOT NULL,
      body text NOT NULL DEFAULT '',
      status varchar,
      protocol varchar,
      blooio_message_id varchar UNIQUE,
      sent_by varchar,
      error text,
      sent_at timestamptz NOT NULL DEFAULT now()
    )`);
  // First version used a plain timestamp (UTC wall time); make it zone-aware so every server reads it right
  await pool.query(`DO $$ BEGIN
    IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'text_messages' AND column_name = 'sent_at') = 'timestamp without time zone' THEN
      ALTER TABLE text_messages ALTER COLUMN sent_at TYPE timestamptz USING sent_at AT TIME ZONE 'UTC';
    END IF;
  END $$`);
  await pool.query(`CREATE INDEX IF NOT EXISTS text_messages_chat_idx ON text_messages (chat_id, sent_at)`);
  await pool.query(`ALTER TABLE match_circles ADD COLUMN IF NOT EXISTS leaders varchar, ADD COLUMN IF NOT EXISTS group_chat_id varchar`);
  await pool.query(`ALTER TABLE match_circle_members ADD COLUMN IF NOT EXISTS rsvp varchar`);
}

// A member's reply to a "Reply 1, 2, or EITHER" poll
export type Reply = "1" | "2" | "either" | "stop" | "start";
export function readReply(text: string | null | undefined): Reply | null {
  const t = String(text || "").trim().toLowerCase();
  if (/^(stop|unsubscribe|cancel|end|quit)\b/.test(t)) return "stop";
  if (/^(start|unstop)\b/.test(t)) return "start";
  if (/\b(either|both|whichever)\b/.test(t)) return "either";
  const m = /^(?:option\s*|#)?([12])\b/.exec(t);
  return m ? (m[1] as "1" | "2") : null;
}
const isPoll = (body: string) => /reply 1\b/i.test(body);

export const firstName = (u: { firstName?: string | null; displayName?: string | null }) =>
  String(u.firstName || u.displayName || "").trim().split(/\s+/)[0] || "there";
export const personalize = (template: string, u: { firstName?: string | null; displayName?: string | null }) =>
  template.split("{first_name}").join(firstName(u));

// Send one text and record it. Never throws: a failed send is stored with its error.
export async function sendAndLog(o: { chatId: string; text: string; userId?: string | null; circleId?: number | null; sentBy?: string | null; idempotencyKey?: string }) {
  try {
    const r = await blooio.sendText(o.chatId, o.text, o.idempotencyKey);
    await db.insert(textMessages).values({
      chatId: r.chat_id || o.chatId, userId: o.userId ?? null, circleId: o.circleId ?? null, direction: "outbound",
      body: o.text, status: r.status || "queued", blooioMessageId: r.message_id, sentBy: o.sentBy ?? null,
    }).onConflictDoNothing();
    return { ok: true as const, messageId: r.message_id, chatId: r.chat_id || o.chatId };
  } catch (e: any) {
    const error = String(e?.message || e).slice(0, 300);
    // Keep one failed row per text: a retry replaces the earlier failure instead of piling up
    await db.delete(textMessages).where(and(eq(textMessages.chatId, o.chatId), eq(textMessages.body, o.text), eq(textMessages.status, "failed")));
    await db.insert(textMessages).values({
      chatId: o.chatId, userId: o.userId ?? null, circleId: o.circleId ?? null, direction: "outbound",
      body: o.text, status: "failed", sentBy: o.sentBy ?? null, error,
    });
    return { ok: false as const, error };
  }
}

// Text every member of a circle individually with {first_name} filled in. Members without a valid
// number or texting consent are skipped, and so is anyone who already got this exact text this week.
// send: false only returns who would get what.
// Members are in LA: group texts only go out between 9am and 8pm Pacific
export function quietHoursNow(at = new Date()) {
  const hour = parseInt(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", hourCycle: "h23" }).format(at));
  return hour < 9 || hour >= 20;
}

export async function textCircle(circleId: number, template: string, o: { send: boolean; sentBy?: string | null; force?: boolean }) {
  const circle = (await storage.getMatchCircles()).find((c: any) => c.id === circleId);
  if (!circle) return null;
  if (o.send && !o.force && quietHoursNow()) throw new Error("It's outside 9am to 8pm in LA. Send this in the morning.");
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const recipients: any[] = [], skipped: any[] = [];
  for (const m of circle.members as any[]) {
    const chatId = blooio.toE164(m.phone), text = personalize(template, m);
    const who = { userId: m.id, name: firstName(m), phoneEnd: chatId ? chatId.slice(-4) : null };
    if (!chatId) { skipped.push({ ...who, reason: "No valid phone number" }); continue; }
    if (m.smsOptIn !== true || m.rsvp === "opted_out") { skipped.push({ ...who, reason: "Hasn't agreed to texts" }); continue; }
    const dup = await db.select({ id: textMessages.id }).from(textMessages).where(and(eq(textMessages.chatId, chatId), eq(textMessages.body, text),
      eq(textMessages.direction, "outbound"), gte(textMessages.sentAt, since), sql`${textMessages.status} <> 'failed'`)).limit(1);
    if (dup.length) { skipped.push({ ...who, reason: "Already sent this exact text" }); continue; }
    recipients.push({ ...who, chatId, text });
  }
  if (!o.send) return { preview: true as const, circle: circle.name, recipients, skipped };
  const results = [];
  for (const r of recipients) {
    const sent = await sendAndLog({ chatId: r.chatId, text: r.text, userId: r.userId, circleId, sentBy: o.sentBy ?? null,
      idempotencyKey: `circle-${circleId}-${r.userId}-${Buffer.from(r.text).toString("base64").slice(0, 50)}-${Math.floor(Date.now() / 60000)}` });
    results.push({ name: r.name, phoneEnd: r.phoneEnd, ok: sent.ok, error: sent.ok ? undefined : sent.error });
    await new Promise((ok) => setTimeout(ok, 400));
  }
  return { preview: false as const, circle: circle.name, sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results, skipped };
}

// Pull new messages and delivery updates from Blooio. Only chats with activity we haven't stored,
// or with texts still in flight, are re-read.
export async function syncFromBlooio() {
  const chats: blooio.BlooioChat[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await blooio.listChats(100, offset);
    chats.push(...page.chats);
    if (page.chats.length < 100 || chats.length >= page.pagination.total) break;
  }
  const latest = new Map<string, number>(
    (await pool.query(`SELECT chat_id, extract(epoch from max(sent_at)) * 1000 AS t FROM text_messages WHERE blooio_message_id IS NOT NULL GROUP BY chat_id`))
      .rows.map((r: any) => [r.chat_id, Number(r.t)]),
  );
  const inFlight = new Set<string>(
    (await pool.query(`SELECT DISTINCT chat_id FROM text_messages WHERE direction = 'outbound' AND status IN ('queued','sent','pending')`)).rows.map((r: any) => r.chat_id),
  );
  const phoneToUser = new Map<string, string>();
  for (const u of await db.select({ id: users.id, phone: users.phone }).from(users).where(sql`${users.phone} IS NOT NULL`)) {
    const p = blooio.toE164(u.phone);
    if (p && !phoneToUser.has(p)) phoneToUser.set(p, u.id);
  }
  const groupCircle = new Map<string, number>(
    (await db.select({ id: matchCircles.id, chat: matchCircles.groupChatId }).from(matchCircles).where(sql`${matchCircles.groupChatId} IS NOT NULL`))
      .map((c) => [c.chat as string, c.id]),
  );

  let added = 0, updated = 0;
  for (const chat of chats) {
    if (!inFlight.has(chat.id) && (latest.get(chat.id) ?? 0) >= (chat.last_message_time ?? 0)) continue;
    const { messages } = await blooio.listMessages(chat.id, 100);
    const known = new Map<string, { status: string | null }>(
      messages.length
        ? (await db.select({ id: textMessages.blooioMessageId, status: textMessages.status }).from(textMessages)
            .where(inArray(textMessages.blooioMessageId, messages.map((m) => m.message_id)))).map((r) => [r.id as string, { status: r.status }])
        : [],
    );
    // Inbound replies belong to the circle of the latest text we sent into this chat
    const lastCircle = groupCircle.get(chat.id) ?? (await db.select({ c: textMessages.circleId }).from(textMessages)
      .where(and(eq(textMessages.chatId, chat.id), sql`${textMessages.circleId} IS NOT NULL`))
      .orderBy(desc(textMessages.sentAt)).limit(1))[0]?.c ?? null;
    const userId = chat.is_group ? null : phoneToUser.get(chat.id) ?? null;

    for (const m of messages) {
      const prev = known.get(m.message_id);
      if (prev) {
        if (prev.status !== m.status) {
          await db.update(textMessages).set({ status: m.status, error: m.error }).where(eq(textMessages.blooioMessageId, m.message_id));
          updated++;
        }
        continue;
      }
      const inbound = m.direction === "inbound";
      await db.insert(textMessages).values({
        chatId: chat.id, userId: inbound && chat.is_group ? phoneToUser.get(m.sender || "") ?? null : userId,
        circleId: lastCircle, direction: m.direction, body: m.text || "", status: m.status, protocol: m.protocol,
        blooioMessageId: m.message_id, error: m.error, sentAt: new Date(m.time_sent || Date.now()),
      }).onConflictDoNothing();
      added++;
      // STOP / START are consent changes, not just chat text
      const who = inbound ? phoneToUser.get(m.sender || chat.id) : undefined;
      const reply = inbound ? readReply(m.text) : null;
      if (who && (reply === "stop" || reply === "start")) {
        await storage.updateUser(who, { smsOptIn: reply === "start" } as any);
        await db.update(matchCircleMembers).set({ rsvp: reply === "stop" ? "opted_out" : null })
          .where(and(eq(matchCircleMembers.userId, who), reply === "stop" ? sql`true` : eq(matchCircleMembers.rsvp, "opted_out")));
      }
    }
  }
  return { chats: chats.length, added, updated };
}

type Row = typeof textMessages.$inferSelect;

function summarize(rows: Row[]) {
  const last = rows[rows.length - 1] || null;
  const pollAt = [...rows].reverse().find((r) => r.direction === "outbound" && isPoll(r.body))?.sentAt;
  let vote: Reply | null = null;
  if (pollAt) {
    for (const r of rows) if (r.direction === "inbound" && r.sentAt >= pollAt) { const v = readReply(r.body); if (v) vote = v; }
  }
  return {
    lastMessage: last ? { body: last.body, direction: last.direction, status: last.status, sentAt: last.sentAt } : null,
    needsReply: last?.direction === "inbound",
    polled: !!pollAt,
    vote,
    count: rows.length,
  };
}

export function registerTextingRoutes(app: Express, adminGuard: RequestHandler) {
  ensureTextingTables().catch((e) => console.error("[texting] table setup failed:", e?.message || e));

  app.get("/api/admin/texting/account", adminGuard, async (_req, res) => {
    if (!blooio.blooioConfigured()) return res.json({ configured: false });
    try {
      const me = await blooio.getAccount();
      res.json({ configured: true, number: me.devices?.find((d) => d.is_active)?.phone_number || me.devices?.[0]?.phone_number || null });
    } catch (e: any) { res.json({ configured: true, number: null, error: String(e?.message || e).slice(0, 200) }); }
  });

  // Circles in a cycle with each member's thread summary, plus texts that belong to no circle member
  app.get("/api/admin/conversations", adminGuard, async (req, res) => {
    try {
      const cycles = (await pool.query(`SELECT cycle, count(*)::int AS circles, max(created_at) AS latest FROM match_circles WHERE cycle IS NOT NULL GROUP BY cycle ORDER BY max(created_at) DESC`)).rows;
      const cycle = String((req.query as any).cycle || cycles[0]?.cycle || "current");
      const circles: any[] = await storage.getMatchCircles(cycle);

      const memberChat = new Map<string, string>(); // userId → E.164
      for (const c of circles) for (const m of c.members) { const p = blooio.toE164(m.phone); if (p) memberChat.set(m.id, p); }
      const chatIds = Array.from(new Set([...Array.from(memberChat.values()), ...circles.map((c) => c.groupChatId).filter(Boolean)]));
      const rows = chatIds.length
        ? await db.select().from(textMessages).where(inArray(textMessages.chatId, chatIds)).orderBy(asc(textMessages.sentAt))
        : [];
      const byChat = new Map<string, Row[]>();
      for (const r of rows) (byChat.get(r.chatId) || byChat.set(r.chatId, []).get(r.chatId)!).push(r);

      const out = circles.map((c) => {
        const members = c.members.map((m: any) => {
          const chatId = memberChat.get(m.id) || null;
          return {
            id: m.id, name: [m.firstName, m.lastName].filter(Boolean).join(" ").trim() || m.displayName || m.username || "Member",
            firstName: firstName(m), city: m.city, chatId, smsOptIn: m.smsOptIn === true, rsvp: m.rsvp || null,
            ...summarize(chatId ? byChat.get(chatId) || [] : []),
          };
        });
        const tally = { "1": 0, "2": 0, either: 0, none: 0 } as Record<string, number>;
        for (const m of members) if (m.polled) tally[m.vote === "1" || m.vote === "2" || m.vote === "either" ? m.vote : "none"]++;
        return {
          id: c.id, name: c.name, cycle: c.cycle, status: c.status, slot: c.slot, activity: c.activity, notes: c.notes,
          leaders: c.leaders, groupChatId: c.groupChatId, members, tally,
          group: c.groupChatId ? summarize(byChat.get(c.groupChatId) || []) : null,
          needsReply: members.filter((m: any) => m.needsReply).length,
        };
      });

      // Everything else we've texted or heard from (tests, people not in this cycle's circles)
      const others = (await pool.query(
        `SELECT DISTINCT ON (t.chat_id) t.chat_id, t.body, t.direction, t.sent_at, u.first_name, u.last_name
           FROM text_messages t LEFT JOIN users u ON u.id = t.user_id
          WHERE NOT (t.chat_id = ANY($1::varchar[]))
          ORDER BY t.chat_id, t.sent_at DESC`, [chatIds],
      )).rows.map((r: any) => ({
        chatId: r.chat_id, name: [r.first_name, r.last_name].filter(Boolean).join(" ").trim() || r.chat_id,
        lastMessage: { body: r.body, direction: r.direction, sentAt: r.sent_at }, needsReply: r.direction === "inbound",
      })).sort((a: any, b: any) => +new Date(b.lastMessage.sentAt) - +new Date(a.lastMessage.sentAt));

      res.json({ cycle, cycles, circles: out, others });
    } catch (e) { console.error("[texting] conversations", e); res.status(500).json({ message: "Failed to load conversations" }); }
  });

  app.get("/api/admin/conversations/thread", adminGuard, async (req, res) => {
    const chatId = String((req.query as any).chatId || "");
    if (!chatId) return res.status(400).json({ message: "chatId required" });
    res.json(await db.select().from(textMessages).where(eq(textMessages.chatId, chatId)).orderBy(asc(textMessages.sentAt)).limit(500));
  });

  app.post("/api/admin/conversations/sync", adminGuard, async (_req, res) => {
    if (!blooio.blooioConfigured()) return res.status(400).json({ message: "BLOOIO_API_KEY is not set on the server" });
    try { res.json(await syncFromBlooio()); }
    catch (e: any) { console.error("[texting] sync", e); res.status(502).json({ message: String(e?.message || "Sync failed") }); }
  });

  // One text to one chat (a member, a group, or any number already in Conversations)
  app.post("/api/admin/conversations/send", adminGuard, async (req: any, res) => {
    const { chatId, text, circleId } = req.body || {};
    if (!chatId || !String(text || "").trim()) return res.status(400).json({ message: "chatId and text required" });
    const chat = String(chatId);
    const user = chat.includes(",") ? null : (await db.select({ id: users.id, phone: users.phone, smsOptIn: users.smsOptIn }).from(users)
      .where(sql`regexp_replace(coalesce(${users.phone}, ''), '\\D', '', 'g') IN (${chat.replace(/\D/g, "")}, ${chat.replace(/\D/g, "").replace(/^1/, "")})`).limit(1))[0];
    if (user && user.smsOptIn === false) return res.status(409).json({ message: "This member opted out of texts" });
    const r = await sendAndLog({ chatId: chat, text: String(text).trim(), userId: user?.id ?? null, circleId: circleId ? parseInt(circleId) : null, sentBy: req.user?.id });
    if (!r.ok) return res.status(502).json({ message: r.error });
    res.json(r);
  });

  // The same text to each member of a circle, one by one, with {first_name} filled in.
  // Without confirm: true it only returns the preview. Re-sending identical text to someone is skipped.
  app.post("/api/admin/conversations/broadcast", adminGuard, async (req: any, res) => {
    try {
      const circleId = parseInt(req.body?.circleId);
      const template = String(req.body?.text || "").trim();
      if (!circleId || !template) return res.status(400).json({ message: "circleId and text required" });
      if (req.body?.confirm === true && quietHoursNow()) return res.status(409).json({ message: "It's outside 9am to 8pm in LA. Send this in the morning." });
      const r = await textCircle(circleId, template, { send: req.body?.confirm === true, sentBy: req.user?.id });
      if (!r) return res.status(404).json({ message: "Circle not found" });
      res.json(r);
    } catch (e) { console.error("[texting] broadcast", e); res.status(500).json({ message: "Failed to send" }); }
  });

  app.patch("/api/admin/match-circles/:id/members/:userId/rsvp", adminGuard, async (req, res) => {
    const rsvp = req.body?.rsvp ?? null;
    if (rsvp !== null && !RSVP.includes(rsvp)) return res.status(400).json({ message: "rsvp must be confirmed, declined, opted_out or null" });
    await db.update(matchCircleMembers).set({ rsvp })
      .where(and(eq(matchCircleMembers.circleId, parseInt(req.params.id)), eq(matchCircleMembers.userId, req.params.userId)));
    res.json({ ok: true, rsvp });
  });

  // Start the circle's group text with everyone marked confirmed. Preview unless confirm: true.
  app.post("/api/admin/conversations/group", adminGuard, async (req: any, res) => {
    try {
      const circleId = parseInt(req.body?.circleId);
      const text = String(req.body?.text || "").trim();
      const circle = (await storage.getMatchCircles()).find((c: any) => c.id === circleId);
      if (!circle) return res.status(404).json({ message: "Circle not found" });
      if (circle.groupChatId) return res.status(409).json({ message: "This circle's group text already exists. Message it from its thread." });
      const members = (circle.members as any[]).filter((m) => m.rsvp === "confirmed" && m.smsOptIn === true && blooio.toE164(m.phone));
      const numbers = members.map((m) => blooio.toE164(m.phone)!);
      if (numbers.length < 2) return res.status(400).json({ message: "Mark at least 2 members as confirmed first" });
      if (req.body?.confirm !== true || !text) return res.json({ preview: true, members: members.map((m) => ({ name: firstName(m), phoneEnd: blooio.toE164(m.phone)!.slice(-4) })) });
      const chatId = numbers.join(",");
      const sent = await sendAndLog({ chatId, text, circleId, sentBy: req.user?.id, idempotencyKey: `group-${circleId}` });
      if (!sent.ok) return res.status(502).json({ message: sent.error });
      await db.update(matchCircles).set({ groupChatId: sent.chatId, updatedAt: new Date() }).where(eq(matchCircles.id, circleId));
      if (sent.chatId !== chatId) await db.update(textMessages).set({ chatId: sent.chatId }).where(eq(textMessages.blooioMessageId, sent.messageId));
      res.json({ ok: true, groupChatId: sent.chatId, members: numbers.length });
    } catch (e) { console.error("[texting] group", e); res.status(500).json({ message: "Failed to start the group text" }); }
  });
}
