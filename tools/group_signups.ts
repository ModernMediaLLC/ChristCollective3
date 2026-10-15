/**
 * Auto-group founding signups into meetup circles by where they live, then pick each circle's
 * meeting zone (the spot that minimizes total travel) and the time window most members can make.
 * Read-only: queries the database, writes nothing back.
 *
 * Run from the repo root:
 *   npx tsx --env-file=.env tools/group_signups.ts                # summary to the console
 *   npx tsx --env-file=.env tools/group_signups.ts --since 2026-09-28 --span 12 --max 8
 *
 * Options: --since YYYY-MM-DD  only signups on/after this date (default 2026-09-28, the ad launch)
 *          --span N            max miles between any two members of a starting cluster (default 12)
 *          --stretch N         members farther than this from the meeting zone are flagged (default 10)
 *          --far N             members farther than this from every zone are held, not grouped (default 20)
 *          --min N / --max N   smallest cluster that becomes a circle / largest circle (default 3 / 8)
 *
 * Output: .tmp/signup-groups.json (full detail, contains member names — do not commit).
 * Distances are straight-line miles between city centers; LA drive times run longer.
 * Members who picked just "Los Angeles" are placed at central LA and marked approx — ask their neighborhood.
 */
import fs from "fs";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

const flag = (name: string, dflt: string) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : dflt);
const SINCE = flag("--since", "2026-09-28");
const SPAN = Number(flag("--span", "12"));
const STRETCH = Number(flag("--stretch", "10"));
const FAR = Number(flag("--far", "20"));
const MIN = Number(flag("--min", "3"));
const MAX = Number(flag("--max", "8"));

type LatLng = [number, number];
// City / neighborhood centers. The first block is every city seen in signups; the second adds
// neighborhoods used only to NAME a meeting zone.
const PLACES: Record<string, LatLng> = {
  "Los Angeles": [34.0600, -118.3000], "Downtown LA": [34.0407, -118.2468], "Koreatown": [34.0618, -118.3004],
  "Hollywood": [34.0928, -118.3287], "Culver City": [34.0211, -118.3965], "Santa Monica": [34.0195, -118.4912],
  "Bel Air": [34.1003, -118.4595], "Hermosa Beach": [33.8622, -118.3995], "Carson": [33.8317, -118.2820],
  "Woodland Hills": [34.1684, -118.6059], "Reseda": [34.2011, -118.5364], "Northridge": [34.2283, -118.5366],
  "Chatsworth": [34.2572, -118.6012], "Agoura Hills": [34.1533, -118.7617], "Valley Village": [34.1650, -118.3965],
  "Burbank": [34.1808, -118.3090], "Glendale": [34.1425, -118.2551], "Eagle Rock": [34.1392, -118.2103],
  "La Cañada Flintridge": [34.1992, -118.1879], "Pasadena": [34.1478, -118.1445], "Duarte": [34.1395, -117.9773],
  "Pomona": [34.0551, -117.7500], "Montebello": [34.0165, -118.1138], "Norwalk": [33.9022, -118.0817],
  "Downey": [33.9401, -118.1332], "La Habra": [33.9319, -117.9461], "Santa Clarita": [34.3917, -118.5426],
  "Lancaster": [34.6868, -118.1542], "Palmdale": [34.5794, -118.1165],
};
const ZONE_NAMES: Record<string, LatLng> = {
  ...PLACES,
  "Tarzana": [34.1733, -118.5537], "Encino": [34.1592, -118.5012], "Sherman Oaks": [34.1508, -118.4490],
  "Studio City": [34.1396, -118.3871], "North Hollywood": [34.1870, -118.3813], "Van Nuys": [34.1899, -118.4514],
  "Canoga Park": [34.2011, -118.5981], "Winnetka": [34.2083, -118.5709], "Mid-Wilshire": [34.0617, -118.3440],
  "Mid-City": [34.0416, -118.3531], "Larchmont": [34.0736, -118.3236], "Silver Lake": [34.0869, -118.2702],
  "Los Feliz": [34.1064, -118.2838], "Atwater Village": [34.1164, -118.2565], "Highland Park": [34.1155, -118.1855],
  "West LA (Sawtelle)": [34.0407, -118.4426], "Mar Vista": [34.0030, -118.4298], "Palms": [34.0220, -118.4045],
  "Westwood": [34.0635, -118.4455], "Beverly Hills": [34.0736, -118.4004], "West Hollywood": [34.0900, -118.3617],
  "Playa Vista": [33.9757, -118.4180], "Venice": [33.9850, -118.4695], "Inglewood": [33.9617, -118.3531],
  "Torrance": [33.8358, -118.3406], "Bellflower": [33.8817, -118.1170], "South Gate": [33.9547, -118.2120],
  "Pico Rivera": [33.9831, -118.0967], "Lakewood": [33.8536, -118.1339], "Alhambra": [34.0953, -118.1270],
  "South Pasadena": [34.1161, -118.1503], "Arcadia": [34.1397, -118.0353], "Monrovia": [34.1442, -118.0019],
};

const SLOTS = [
  "Weekday mornings", "Weekday afternoons", "Weekday evenings",
  "Saturday mornings", "Saturday afternoons", "Saturday evenings",
  "Sunday mornings", "Sunday afternoons", "Sunday evenings",
];
// Tie-break order when two windows fit the same number of people.
const SLOT_PREF = ["Saturday mornings", "Weekday evenings", "Saturday afternoons", "Sunday afternoons", "Weekday afternoons", "Weekday mornings", "Saturday evenings", "Sunday evenings", "Sunday mornings"];

interface Member { id: string; name: string; age: number | null; city: string; pos: LatLng; approx: boolean; slots: Set<string>; flexible: boolean; activities: string[]; waitlisted: boolean; }

const miles = (a: LatLng, b: LatLng) => {
  const rad = Math.PI / 180, dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
};

// Geometric median (Weiszfeld): the point with the smallest total travel. Unlike the average,
// one far-away member barely moves it.
function meetingPoint(pts: LatLng[]): LatLng {
  let c: LatLng = [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
  for (let i = 0; i < 200; i++) {
    let wSum = 0, lat = 0, lng = 0;
    for (const p of pts) { const w = 1 / Math.max(miles(c, p), 0.05); wSum += w; lat += p[0] * w; lng += p[1] * w; }
    c = [lat / wSum, lng / wSum];
  }
  return c;
}

const nearestZone = (c: LatLng) => Object.entries(ZONE_NAMES).map(([name, pos]) => ({ name, d: miles(c, pos) })).sort((a, b) => a.d - b.d)[0];

function expandSlots(raw: string[]): { slots: Set<string>; flexible: boolean } {
  const slots = new Set<string>(); let flexible = false;
  for (const r of raw.map((s) => s.trim()).filter(Boolean)) {
    if (/flexible/i.test(r)) flexible = true;
    else if (SLOTS.includes(r)) slots.add(r);
    else if (/^sat/i.test(r)) SLOTS.filter((s) => s.startsWith("Saturday")).forEach((s) => slots.add(s));
    else if (/^sun/i.test(r)) SLOTS.filter((s) => s.startsWith("Sunday")).forEach((s) => slots.add(s));
    else if (/^(mon|tue|wed|thu|fri)/i.test(r)) SLOTS.filter((s) => s.startsWith("Weekday")).forEach((s) => slots.add(s));
  }
  if (flexible || slots.size === 0) { SLOTS.forEach((s) => slots.add(s)); flexible = true; }
  return { slots, flexible };
}

const slotCounts = (ms: Member[]) => SLOTS.map((slot) => ({ slot, n: ms.filter((m) => m.slots.has(slot)).length }))
  .sort((a, b) => b.n - a.n || SLOT_PREF.indexOf(a.slot) - SLOT_PREF.indexOf(b.slot));

// Complete-linkage clustering: keep merging the two closest clusters while every pair stays within SPAN miles.
function cluster(ms: Member[]): Member[][] {
  let cs = ms.map((m) => [m]);
  const span = (a: Member[], b: Member[]) => Math.max(...a.flatMap((x) => b.map((y) => miles(x.pos, y.pos))));
  for (;;) {
    let best: [number, number, number] | null = null;
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
      const d = span(cs[i], cs[j]);
      if (d <= SPAN && (!best || d < best[2])) best = [i, j, d];
    }
    if (!best) return cs;
    cs[best[0]] = cs[best[0]].concat(cs[best[1]]); cs.splice(best[1], 1);
  }
}

// A cluster too big for one table is first split by geography (2-means seeded with its two farthest
// members). Returns null when that would strand fewer than MIN people or the halves sit on top of each other.
function splitByPlace(ms: Member[]): Member[][] | null {
  let seedA = ms[0], seedB = ms[0], far = -1;
  for (const a of ms) for (const b of ms) { const d = miles(a.pos, b.pos); if (d > far) { far = d; seedA = a; seedB = b; } }
  let cA = seedA.pos, cB = seedB.pos, a: Member[] = [], b: Member[] = [];
  const mean = (g: Member[]): LatLng => [g.reduce((s, m) => s + m.pos[0], 0) / g.length, g.reduce((s, m) => s + m.pos[1], 0) / g.length];
  for (let i = 0; i < 25; i++) {
    a = ms.filter((m) => miles(m.pos, cA) <= miles(m.pos, cB)); b = ms.filter((m) => !a.includes(m));
    if (!a.length || !b.length) return null;
    cA = mean(a); cB = mean(b);
  }
  return a.length >= MIN && b.length >= MIN && miles(cA, cB) > 3 ? [a, b] : null;
}
const splitWhileBig = (ms: Member[]): Member[][] => {
  const parts = ms.length > MAX ? splitByPlace(ms) : null;
  return parts ? parts.flatMap(splitWhileBig) : [ms];
};

// If the people are all in one place, split by when they are free instead: try every pair of windows and
// keep the pair that seats the most people with the most even split.
function splitByTime(ms: Member[]): Member[][] {
  let best: { a: Member[]; b: Member[]; score: number } | null = null;
  for (let i = 0; i < SLOTS.length; i++) for (let j = i + 1; j < SLOTS.length; j++) {
    const a: Member[] = [], b: Member[] = [], either: Member[] = [], neither: Member[] = [];
    for (const m of ms) {
      const inA = m.slots.has(SLOTS[i]), inB = m.slots.has(SLOTS[j]);
      (inA && inB ? either : inA ? a : inB ? b : neither).push(m);
    }
    for (const m of either) (a.length <= b.length ? a : b).push(m);
    const seated = a.length + b.length;
    for (const m of neither) (a.length <= b.length ? a : b).push(m);
    const score = seated * 10 - Math.abs(a.length - b.length) - (a.length > MAX || b.length > MAX ? 100 : 0);
    if (!best || score > best.score) best = { a, b, score };
  }
  return [best!.a, best!.b];
}

async function main() {
  neonConfig.webSocketConstructor = ws;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await pool.query(
    `select id, first_name, birthdate, city, waitlisted, matchup_request from users
     where matchup_request is not null and coalesce(is_admin, false) = false and email not like '%@example.com'`,
  );
  await pool.end();

  const members: Member[] = [], unknownCity: string[] = [];
  for (const r of rows) {
    const mr = r.matchup_request || {};
    if (String(mr.requestedAt || "") < SINCE) continue;
    const name = String(r.first_name || "").trim().split(/\s+/)[0] || "(no name)";
    const city = String(r.city || "").trim();
    if (!PLACES[city]) { unknownCity.push(`${name} — "${city}"`); continue; }
    const { slots, flexible } = expandSlots(Array.isArray(mr.availability) ? mr.availability : String(mr.slot || "").split(","));
    const age = r.birthdate ? Math.floor((Date.now() - new Date(r.birthdate).getTime()) / 31557600000) : null;
    members.push({
      id: r.id, name, age, city, pos: PLACES[city], approx: city === "Los Angeles", slots, flexible,
      activities: Array.isArray(mr.activities) ? mr.activities : [mr.activity || "open"], waitlisted: !!r.waitlisted,
    });
  }

  const pool_ = members.filter((m) => !m.waitlisted);
  const clusters = cluster(pool_);
  const cores = clusters.filter((c) => c.length >= MIN).flatMap(splitWhileBig);
  const loose = clusters.filter((c) => c.length < MIN).flat();
  const held: { m: Member; nearest: string; d: number }[] = [];
  // Anyone outside a core joins the nearest core's meeting point, unless every core is too far.
  const centers = cores.map((c) => meetingPoint(c.map((m) => m.pos)));
  for (const m of loose) {
    const ranked = centers.map((c, i) => ({ i, d: miles(c, m.pos) })).sort((a, b) => a.d - b.d);
    if (ranked.length && ranked[0].d <= FAR) cores[ranked[0].i].push(m);
    else held.push({ m, nearest: ranked.length ? nearestZone(centers[ranked[0].i]).name : "—", d: ranked.length ? ranked[0].d : 0 });
  }
  const circles = cores.flatMap((c) => (c.length > MAX ? splitByTime(c) : [c]));

  const out = circles.map((c) => {
    const center = meetingPoint(c.map((m) => m.pos));
    const zone = nearestZone(center);
    const counts = slotCounts(c);
    const acts: Record<string, number> = {};
    for (const m of c) for (const a of m.activities) acts[a] = (acts[a] || 0) + 1;
    const dist = c.map((m) => miles(center, m.pos));
    const ages = c.map((m) => m.age).filter((a): a is number => a !== null).sort((a, b) => a - b);
    return {
      zone: zone.name, center, size: c.length,
      ages: ages.length ? { youngest: ages[0], oldest: ages[ages.length - 1], median: ages[Math.floor(ages.length / 2)] } : null,
      avgMiles: +(dist.reduce((s, d) => s + d, 0) / c.length).toFixed(1), maxMiles: +Math.max(...dist).toFixed(1),
      bestSlot: counts[0], nextSlot: counts[1], activities: Object.entries(acts).sort((a, b) => b[1] - a[1]),
      members: c.map((m, i) => ({
        name: m.name, age: m.age, city: m.city, lat: m.pos[0], lng: m.pos[1], miles: +dist[i].toFixed(1),
        stretch: dist[i] > STRETCH, approx: m.approx, flexible: m.flexible, canMakeBest: m.slots.has(counts[0].slot),
        slots: m.flexible ? ["flexible"] : Array.from(m.slots), activities: m.activities,
      })).sort((a, b) => a.miles - b.miles),
    };
  }).sort((a, b) => b.size - a.size);

  const result = {
    generatedAt: new Date().toISOString(), since: SINCE, settings: { SPAN, STRETCH, FAR, MIN, MAX },
    grouped: out.reduce((s, c) => s + c.size, 0), circles: out,
    held: held.map((h) => ({ name: h.m.name, city: h.m.city, lat: h.m.pos[0], lng: h.m.pos[1], nearestZone: h.nearest, miles: +h.d.toFixed(1) })),
    waitlist: members.filter((m) => m.waitlisted).map((m) => {
      const near = out.map((c) => ({ zone: c.zone, d: miles(c.center as LatLng, m.pos) })).sort((a, b) => a.d - b.d)[0];
      return { name: m.name, city: m.city, lat: m.pos[0], lng: m.pos[1], nearestZone: near?.zone, miles: near ? +near.d.toFixed(1) : null };
    }),
    availability: slotCounts(pool_), flexible: pool_.filter((m) => m.flexible).length, unknownCity,
  };
  fs.mkdirSync(".tmp", { recursive: true });
  fs.writeFileSync(".tmp/signup-groups.json", JSON.stringify(result, null, 1));

  console.log(`${members.length} signups since ${SINCE} → ${result.grouped} grouped into ${out.length} circles, ${held.length} held, ${result.waitlist.length} waitlisted`);
  for (const c of out) {
    console.log(`\n${c.zone} — ${c.size} people · meet near ${c.center.map((n) => n.toFixed(4)).join(", ")} · avg ${c.avgMiles} mi, max ${c.maxMiles} mi`);
    if (c.ages) console.log(`  ages ${c.ages.youngest}–${c.ages.oldest}, median ${c.ages.median}`);
    console.log(`  best: ${c.bestSlot.slot} (${c.bestSlot.n}/${c.size}) · next: ${c.nextSlot.slot} (${c.nextSlot.n}/${c.size}) · wants: ${c.activities.map(([a, n]) => `${a} ${n}`).join(", ")}`);
    for (const m of c.members) console.log(`  ${m.canMakeBest ? "✓" : "✗"} ${m.name.padEnd(14)} ${m.city.padEnd(22)} ${String(m.miles).padStart(5)} mi${m.stretch ? "  STRETCH" : ""}${m.approx ? "  (neighborhood unknown)" : ""}`);
  }
  if (held.length) console.log(`\nHeld (too far from every zone): ${result.held.map((h) => `${h.name} (${h.city}, ${h.miles} mi from ${h.nearestZone})`).join("; ")}`);
  if (result.waitlist.length) console.log(`Waitlist: ${result.waitlist.map((w) => `${w.name} (${w.city}, ${w.miles} mi from ${w.nearestZone})`).join("; ")}`);
  if (unknownCity.length) console.log(`\n⚠  No coordinates for: ${unknownCity.join("; ")} — add the city to PLACES.`);
  console.log(`\nfull detail → .tmp/signup-groups.json`);
}
main().catch((e) => { console.error(e); process.exit(1); });
