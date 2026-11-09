// When a standing circle meets: every `every` weeks from `start` at `time`, except inside a `skip` range (a holiday
// week). Stored on match_circles.schedule; tools/standing_circles.ts writes it, the Matching CRM calendar reads it.
// Dates are plain YYYY-MM-DD strings (LA calendar days), handled in UTC so no timezone shifts a day.
export type CircleSchedule = {
  every: number;                                        // weeks between meetups (2 = every other week)
  start: string;                                        // first meetup, YYYY-MM-DD
  time: string;                                         // "10am", "7:30pm"
  skip?: { from: string; to: string; label: string }[]; // no meetups in these ranges (inclusive)
};

const day = (iso: string) => new Date(`${iso}T12:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function skipOf(s: CircleSchedule, date: string) {
  return (s.skip ?? []).find((r) => date >= r.from && date <= r.to) ?? null;
}

// Every meetup date from `from` through `until`, with the skipped ones marked.
// `until` is capped: stepping toward a far-future date (e.g. "9999-12-31") would run past the largest
// date JS can represent and make toISOString() throw, so callers can't hang or crash this by asking
// for "everything". Use nextMeetup() when you only want the next one.
const MAX_MEETUPS = 2000; // ~76 years of fortnightly circles

export function meetupDates(s: CircleSchedule, from: string, until: string): { date: string; skipped: string | null }[] {
  const out: { date: string; skipped: string | null }[] = [];
  if (!s.start || Number.isNaN(day(s.start).getTime())) return out;
  const step = Math.max(1, s.every) * 7;
  const d = day(s.start);
  for (let i = 0; i < MAX_MEETUPS; i++, d.setUTCDate(d.getUTCDate() + step)) {
    const date = iso(d);
    if (date > until) break;
    if (date >= from) out.push({ date, skipped: skipOf(s, date)?.label ?? null });
  }
  return out;
}

// The next date it actually meets, on or after `today`
export function nextMeetup(s: CircleSchedule, today: string) {
  return meetupDates(s, today, iso(new Date(day(today).getTime() + 400 * 864e5))).find((m) => !m.skipped)?.date ?? null;
}
