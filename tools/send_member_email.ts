/**
 * Send a one-off email to every Christ Collective member (every user with an email) via Resend.
 *
 * Run from the repo root:
 *   npx tsx --env-file=.env tools/send_member_email.ts <slug>                    # preview: recipient count + sample, sends nothing
 *   npx tsx --env-file=.env tools/send_member_email.ts <slug> --test you@x.com   # one copy to you (no database needed)
 *   npx tsx --env-file=.env tools/send_member_email.ts <slug> --send             # everyone — resumable, safe to re-run
 *
 * Options: --audience admins   only accounts with admin access (default: all members)
 *          --reply-to x@y.com  where replies go (default: privacy@christcollective.com)
 *
 * Template: tools/emails/<slug>.html + <slug>.txt. The .txt starts with "Subject: ...".
 * Both may use {{first_name}}. Log: .tmp/member-email-<slug>.jsonl — re-runs skip anyone already sent.
 * --send refuses to run if the reply-to address's domain can't receive mail (no MX records).
 */
import fs from "fs";
import path from "path";
import { promises as dns } from "dns";
import { Resend } from "resend";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

const FROM = "Christ Collective <contact@christcollective.info>";
const flag = (name: string) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined);
const REPLY_TO = flag("--reply-to") || "privacy@christcollective.com";
const AUDIENCE = flag("--audience") || "members";
const BATCH = 100;          // Resend batch limit
const PAUSE_MS = 700;       // stay under Resend's default 2 requests/second

const [slug] = process.argv.slice(2);
const testTo = flag("--test");
const sendAll = process.argv.includes("--send");
if (!slug || slug.startsWith("--")) { console.error("usage: tools/send_member_email.ts <slug> [--test you@x.com | --send] [--audience admins] [--reply-to x@y.com]"); process.exit(1); }
if (!["members", "admins"].includes(AUDIENCE)) { console.error(`unknown --audience ${AUDIENCE} (members | admins)`); process.exit(1); }

const dir = path.join("tools", "emails");
const html = fs.readFileSync(path.join(dir, `${slug}.html`), "utf8");
const txtRaw = fs.readFileSync(path.join(dir, `${slug}.txt`), "utf8");
const subjectLine = txtRaw.split(/\r?\n/)[0];
if (!subjectLine.startsWith("Subject: ")) throw new Error(`${slug}.txt must start with "Subject: ..."`);
const subject = subjectLine.slice("Subject: ".length).trim();
const text = txtRaw.split(/\r?\n/).slice(1).join("\n").trim();

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const fill = (tpl: string, name: string, isHtml: boolean) => tpl.split("{{first_name}}").join(isHtml ? esc(name) : name);
const message = (to: string, name: string) => ({
  from: FROM, to: [to], replyTo: REPLY_TO, subject,
  html: fill(html, name, true), text: fill(text, name, false),
});

async function canReceiveMail(address: string) {
  try { return (await dns.resolveMx(address.split("@")[1])).length > 0; } catch { return false; }
}

async function main() {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY missing — run with --env-file=.env");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const mailOk = await canReceiveMail(REPLY_TO);
  if (!mailOk) console.warn(`⚠  ${REPLY_TO} cannot receive mail (no MX records). Set up email routing before sending to members.`);

  if (testTo) {
    const { data, error } = await resend.emails.send(message(testTo, "Friend"));
    if (error) throw new Error(`test send failed: ${error.message}`);
    console.log(`test sent to ${testTo} (id ${data?.id}) — subject: "${subject}"`);
    return;
  }

  neonConfig.webSocketConstructor = ws;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await pool.query(
    `select email, first_name, display_name, username from users where email is not null and email like '%@%'${AUDIENCE === "admins" ? " and is_admin = true" : ""}`,
  );
  await pool.end();

  // one email per address; first name → display name → "there"
  const recipients = new Map<string, string>();
  for (const r of rows) {
    const email = String(r.email).trim().toLowerCase();
    const name = String(r.first_name || r.display_name || "").trim().split(/\s+/)[0] || "there";
    if (!recipients.has(email)) recipients.set(email, name);
  }

  fs.mkdirSync(".tmp", { recursive: true });
  const logPath = path.join(".tmp", `member-email-${slug}.jsonl`);
  const sent = new Set<string>(
    fs.existsSync(logPath)
      ? fs.readFileSync(logPath, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((l) => l.ok).map((l) => l.email)
      : [],
  );
  const todo = Array.from(recipients).filter(([email]) => !sent.has(email));

  console.log(`subject: "${subject}"`);
  console.log(`${recipients.size} ${AUDIENCE} with an email · ${sent.size} already sent · ${todo.length} to send · replies → ${REPLY_TO}`);
  if (!sendAll) {
    const mask = (e: string) => e.replace(/^(.).*(@.*)$/, "$1***$2");
    console.log("sample:", todo.slice(0, 5).map(([e, n]) => `${n} <${mask(e)}>`).join(", "));
    console.log("preview only — nothing sent. Add --test you@x.com for a test copy, or --send to email everyone.");
    return;
  }
  if (!mailOk) throw new Error(`refusing to --send: ${REPLY_TO} can't receive replies yet`);

  for (let i = 0; i < todo.length; i += BATCH) {
    const chunk = todo.slice(i, i + BATCH);
    const { data, error } = await resend.batch.send(chunk.map(([email, name]) => message(email, name)));
    const lines = chunk.map(([email], k) => JSON.stringify({
      email, ok: !error, id: (data as any)?.data?.[k]?.id, error: error?.message, at: new Date().toISOString(),
    }));
    fs.appendFileSync(logPath, lines.join("\n") + "\n");
    console.log(`batch ${i / BATCH + 1}: ${error ? `FAILED (${error.message}) — re-run to retry` : `${chunk.length} sent`}`);
    if (error) process.exitCode = 1;
    await new Promise((r) => setTimeout(r, PAUSE_MS));
  }
  console.log(`done — log: ${logPath}`);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
