// Matching CRM auto-group: turn Matchup requests into circles of people who share a time window
// and an activity. Pure logic — the route loads leads and writes the circles.
//
// A person matches a (window, activity) pair when they picked that window (or "I'm flexible") AND
// that activity (or "Open to anything"). Each round takes the pair that fills the most member spots,
// picks the members with the tightest age range, and repeats until no pair reaches the minimum size.

const FLEXIBLE = "I'm flexible";
const OPEN = "open";
const ANY_TIME = "Any time";

export type MatchLead = {
  id: string;
  birthdate?: string | null;
  matchupRequest?: any;
};

export type PlannedCircle = { window: string; activity: string; memberIds: string[]; ageRange: [number, number] | null };

type Prefs = { lead: MatchLead; age: number | null; anyTime: boolean; windows: string[]; anyActivity: boolean; activities: string[] };

function ageOf(birthdate?: string | null): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(birthdate ?? ""));
  if (!m) return null;
  const now = new Date();
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  return now.getFullYear() - y - (now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && now.getDate() < d) ? 1 : 0);
}

function prefsOf(lead: MatchLead): Prefs {
  const mr = lead.matchupRequest || {};
  // /join stores `availability` (window labels); the older /matchups flow stores a single `slot` id
  const windows: string[] = Array.isArray(mr.availability) && mr.availability.length
    ? mr.availability.map(String)
    : String(mr.slot || "").split(",").map((s) => s.trim()).filter(Boolean);
  const activities: string[] = Array.isArray(mr.activities) && mr.activities.length
    ? mr.activities.map(String)
    : mr.activity ? [String(mr.activity)] : [];
  return {
    lead,
    age: ageOf(lead.birthdate),
    anyTime: windows.length === 0 || windows.includes(FLEXIBLE),
    windows: windows.filter((w) => w !== FLEXIBLE),
    anyActivity: activities.length === 0 || activities.includes(OPEN),
    activities: activities.filter((a) => a !== OPEN),
  };
}

const fits = (p: Prefs, w: string, a: string) =>
  (w === ANY_TIME || p.anyTime || p.windows.includes(w)) && (a === OPEN || p.anyActivity || p.activities.includes(a));

const exact = (p: Prefs, w: string, a: string) => p.windows.includes(w) && p.activities.includes(a);

// Choose n people with the smallest age spread (people without a birthdate only fill leftover spots).
function pickMembers(eligible: Prefs[], n: number, w: string, a: string): { members: Prefs[]; spread: number } {
  const known = eligible.filter((p) => p.age !== null).sort((x, y) => x.age! - y.age!);
  const unknown = eligible.filter((p) => p.age === null);
  if (known.length <= n) return { members: [...known, ...unknown].slice(0, n), spread: known.length ? known[known.length - 1].age! - known[0].age! : 0 };
  let best = { start: 0, spread: Infinity, exact: -1 };
  for (let i = 0; i + n <= known.length; i++) {
    const win = known.slice(i, i + n);
    const spread = win[n - 1].age! - win[0].age!;
    const ex = win.filter((p) => exact(p, w, a)).length;
    if (spread < best.spread || (spread === best.spread && ex > best.exact)) best = { start: i, spread, exact: ex };
  }
  return { members: known.slice(best.start, best.start + n), spread: best.spread };
}

export function planCircles(leads: MatchLead[], opts: { memberSlots: number; minMembers: number }): { circles: PlannedCircle[]; unmatchedIds: string[] } {
  let pool = leads.map(prefsOf);
  const circles: PlannedCircle[] = [];

  while (pool.length >= opts.minMembers) {
    const windows = Array.from(new Set(pool.flatMap((p) => p.windows)));
    const activities = Array.from(new Set(pool.flatMap((p) => p.activities)));
    let best: { w: string; a: string; members: Prefs[]; spread: number; exact: number } | null = null;

    for (const w of windows.length ? windows : [ANY_TIME]) {
      for (const a of activities.length ? activities : [OPEN]) {
        const eligible = pool.filter((p) => fits(p, w, a));
        if (eligible.length < opts.minMembers) continue;
        const { members, spread } = pickMembers(eligible, opts.memberSlots, w, a);
        const ex = members.filter((p) => exact(p, w, a)).length;
        // fuller circle first, then more people who chose this exact pair, then tighter ages
        if (!best || members.length > best.members.length
          || (members.length === best.members.length && (ex > best.exact || (ex === best.exact && spread < best.spread)))) {
          best = { w, a, members, spread, exact: ex };
        }
      }
    }
    if (!best) break;

    const ages = best.members.map((p) => p.age).filter((x): x is number => x !== null);
    circles.push({
      window: best.w,
      activity: best.a,
      memberIds: best.members.map((p) => p.lead.id),
      ageRange: ages.length ? [Math.min(...ages), Math.max(...ages)] : null,
    });
    const taken = new Set(best.members);
    pool = pool.filter((p) => !taken.has(p));
  }

  return { circles, unmatchedIds: pool.map((p) => p.lead.id) };
}
