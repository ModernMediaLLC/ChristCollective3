/**
 * Text every member of a match circle individually through Blooio, with {first_name} filled in.
 * Same path as the admin Conversations tab, so every text is logged and shows up there.
 *
 * Run from the repo root:
 *   npx tsx --env-file=.env tools/text_circle.ts <circleId> <message-file>          # preview: who gets what, sends nothing
 *   npx tsx --env-file=.env tools/text_circle.ts <circleId> <message-file> --send   # send for real
 *   npx tsx --env-file=.env tools/text_circle.ts --list [cycle]                     # list circles and their ids
 *
 * Skips members without a valid number or texting consent, and anyone who already got the exact
 * same text in the last 7 days, so a re-run never double-texts (failed sends are retried).
 * Refuses to send outside 9am-8pm Pacific; --force overrides. Needs BLOOIO_API_KEY and DATABASE_URL.
 *
 * Blooio limit (plan "shared_nc", found Oct 14 2026): 5 NEW conversations per day. Texts to people
 * already messaged don't count. Over the cap Blooio returns 429 new_conversation_limit_reached;
 * those sends are logged as failed and go out on the next day's re-run.
 */
import fs from "fs";
import { storage } from "../server/storage";
import { ensureTextingTables, textCircle } from "../server/texting";

const args = process.argv.slice(2);
await ensureTextingTables();
if (args[0] === "--list") {
  for (const c of await storage.getMatchCircles(args[1])) console.log(`#${c.id}  ${c.name}  [${c.cycle}, ${c.status}]  ${c.members.length} members  ${(c as any).leaders || ""}`);
  process.exit(0);
}
const [id, file] = args;
if (!id || !file) { console.error("usage: tools/text_circle.ts <circleId> <message-file> [--send] | --list [cycle]"); process.exit(1); }
const template = fs.readFileSync(file, "utf8").trim();
const r = await textCircle(parseInt(id), template, { send: args.includes("--send"), force: args.includes("--force") }).catch((e) => { console.error(String(e.message || e)); process.exit(1); });
if (!r) { console.error(`no circle #${id}`); process.exit(1); }
if (r.preview) {
  console.log(`PREVIEW for ${r.circle}. Nothing sent. Add --send to send.\n\n${r.recipients[0]?.text ?? "(no recipients)"}\n`);
  for (const p of r.recipients) console.log(`  → ${p.name} (…${p.phoneEnd})`);
} else {
  for (const p of r.results) console.log(`  ${p.ok ? "sent" : "FAILED"}  ${p.name} (…${p.phoneEnd})${p.error ? `  ${p.error}` : ""}`);
  console.log(`\n${r.sent} sent, ${r.failed} failed`);
}
for (const s of r.skipped) console.log(`  skipped ${s.name}: ${s.reason}`);
process.exit(0);
