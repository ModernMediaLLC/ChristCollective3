// A member's Matchup preferences live in users.matchupRequest (JSON), next to what they gave at /join:
//   availability  weekly windows ("Weekday mornings", …) or ["I'm flexible"]
//   activities    up to 3 picks; activity = the first (the one auto-group uses)
//   paused        left out of grouping and circle texts until they turn it back on…
//   resumeOn      …or until this date (YYYY-MM-DD, LA time), when matching picks them up again by itself
//   blackouts     dates they can't make: [{ from, to }] (YYYY-MM-DD, inclusive)
//   nextCircle    who they'd like to meet next round, once they've been in a circle (see NEXT_CIRCLE)
// Shared by the API, the member's preferences page, the admin CRM and the grouping tools.

export const WINDOW_DAYS = ["Weekday", "Saturday", "Sunday"] as const;
export const WINDOW_TIMES = ["morning", "afternoon", "evening"] as const;
export const MATCHUP_WINDOWS: string[] = WINDOW_DAYS.flatMap((d) => WINDOW_TIMES.map((t) => `${d} ${t}s`));
export const FLEXIBLE = "I'm flexible";
export const MATCHUP_ACTIVITIES = ["coffee", "create", "hiking", "run", "serve", "open"] as const;
export const MAX_BLACKOUTS = 24;

export type Blackout = { from: string; to: string };

// "same" keeps them with the people from their last circle who also picked "same"; "new" keeps them apart
// from everyone they've met; "mix" (the default, also when unset) is happy either way.
export const NEXT_CIRCLE = ["same", "mix", "new"] as const;
export type NextCircle = (typeof NEXT_CIRCLE)[number];
export const nextCircleOf = (mr: any): NextCircle =>
  (NEXT_CIRCLE as readonly string[]).includes(mr?.nextCircle) ? mr.nextCircle : "mix";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const isIsoDate = (s: unknown): s is string => typeof s === "string" && ISO.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`));

// Today's date in Los Angeles, as YYYY-MM-DD (en-CA formats as ISO)
export const laToday = (now = new Date()) => now.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

// Paused right now? A pause with a resume date ends on that date without anyone touching it.
export function isPaused(mr: any, today = laToday()): boolean {
  return !!mr?.paused && !(isIsoDate(mr?.resumeOn) && mr.resumeOn <= today);
}

// Can they make this date (YYYY-MM-DD)? False when it falls inside one of their blocked-out ranges.
export function isBlackedOut(mr: any, date: string): boolean {
  return Array.isArray(mr?.blackouts) && mr.blackouts.some((b: Blackout) => b?.from <= date && date <= b?.to);
}

// Ranges still ahead (or running today), sorted. Past ones are dropped.
export function upcomingBlackouts(mr: any, today = laToday()): Blackout[] {
  return (Array.isArray(mr?.blackouts) ? mr.blackouts : [])
    .filter((b: any) => isIsoDate(b?.from) && isIsoDate(b?.to) && b.to >= today)
    .sort((a: Blackout, b: Blackout) => a.from.localeCompare(b.from));
}

// "Nov 2" / "Nov 2 – 15" / "Nov 28 – Dec 3"
export function formatRange(b: Blackout): string {
  const f = (s: string, o: Intl.DateTimeFormatOptions) => new Date(`${s}T12:00:00Z`).toLocaleDateString("en-US", { ...o, timeZone: "UTC" });
  if (b.from === b.to) return f(b.from, { month: "short", day: "numeric" });
  const sameMonth = b.from.slice(0, 7) === b.to.slice(0, 7);
  return `${f(b.from, { month: "short", day: "numeric" })} – ${f(b.to, sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" })}`;
}

export const formatDate = (s: string) =>
  new Date(`${s}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
