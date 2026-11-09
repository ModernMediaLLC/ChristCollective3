import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { meetupDates, type CircleSchedule } from "@shared/circleSchedule";

// Month calendar of a cycle's meetups for the Matching CRM. Standing circles repeat from their `schedule`
// (holiday weeks shaded); other circles show the date(s) in their slot ("Wed Nov 11, 10am or Thu Nov 12, 10am").

type Meetup = { date: string; time: string; circle: any; host: string; state: "confirmed" | "waiting" | "planned" | "option" | "done" | "skipped"; skipLabel?: string };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const AREA_COLOR: Record<string, string> = {
  central: "#D4AF37", westside: "#38BDF8", westvalley: "#34D399", northeast: "#A78BFA", southeast: "#FB7185",
};
const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (s: string) => new Date(`${s}T12:00:00Z`);
const todayLA = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
const pretty = (s: string) => utc(s).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const hostOf = (leaders: string | null) => String(leaders || "").split("+").map((x) => x.trim()).filter((x) => x && x !== "Luis").join(" + ") || "Luis";
const locked = (c: any) => /date locked by leaders/.test(c.notes || "");

// "Wed Nov 11, 10am" → 2026-11-11 (the year that puts it nearest today)
function parseSlot(label: string, today: string): { date: string; time: string } | null {
  const m = /^\w{3}\s+(\w{3})\s+(\d{1,2}),\s*(.+)$/.exec(label.trim());
  if (!m || MONTHS.indexOf(m[1]) < 0) return null;
  const y = +today.slice(0, 4);
  const pick = [y - 1, y, y + 1].map((yr) => `${yr}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`)
    .sort((a, b) => Math.abs(+utc(a) - +utc(today)) - Math.abs(+utc(b) - +utc(today)))[0];
  return { date: pick, time: m[3] };
}

function meetupsFor(circles: any[], from: string, until: string, today: string): Meetup[] {
  const out: Meetup[] = [];
  for (const c of circles) {
    const host = hostOf(c.leaders);
    const sched = c.schedule as CircleSchedule | null;
    if (sched?.start) {
      const next = meetupDates(sched, today, "9999-12-31").find((m) => !m.skipped)?.date;
      for (const m of meetupDates(sched, from, until)) {
        const state = m.skipped ? "skipped" : m.date < today ? "done" : m.date === next ? (locked(c) ? "confirmed" : "waiting") : "planned";
        out.push({ date: m.date, time: sched.time, circle: c, host, state, skipLabel: m.skipped ?? undefined });
      }
      continue;
    }
    const opts = String(c.slot || "").split(" or ").map((s) => parseSlot(s, today)).filter(Boolean) as { date: string; time: string }[];
    for (const o of opts) {
      if (o.date < from || o.date > until) continue;
      const state = c.status === "completed" || o.date < today ? "done" : opts.length > 1 ? "option" : locked(c) || ["confirmed", "sent"].includes(c.status) ? "confirmed" : "waiting";
      out.push({ date: o.date, time: o.time, circle: c, host, state });
    }
  }
  const minutes = (t: string) => { const m = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i.exec(t); return m ? ((+m[1] % 12) + (/pm/i.test(m[3]) ? 12 : 0)) * 60 + +(m[2] || 0) : 0; };
  return out.sort((a, b) => a.date.localeCompare(b.date) || minutes(a.time) - minutes(b.time));
}

const STATE_LABEL: Record<Meetup["state"], string> = {
  confirmed: "Leader confirmed", waiting: "Waiting on leader", planned: "Planned", option: "Option (not picked yet)", done: "Past", skipped: "Skipped",
};

function Chip({ m, onPick, small }: { m: Meetup; onPick: (m: Meetup) => void; small?: boolean }) {
  const color = AREA_COLOR[m.circle.area] || "#9CA3AF";
  const short = String(m.circle.name).split(" · ")[0];
  const style: React.CSSProperties =
    m.state === "confirmed" ? { background: `${color}26`, borderColor: color, color: "#fff" }
    : m.state === "waiting" || m.state === "option" ? { borderColor: color, borderStyle: "dashed", color: "#d1d5db" }
    : { borderColor: "#374151", color: "#9ca3af" };
  return (
    <button
      onClick={() => onPick(m)}
      title={`${m.circle.name} · ${m.time} · ${m.host} + Luis · ${STATE_LABEL[m.state]}`}
      style={style}
      className={`w-full text-left border rounded px-1 ${small ? "py-0 text-[9px]" : "py-0.5 text-[10px]"} leading-tight truncate ${m.state === "skipped" ? "line-through opacity-60" : ""}`}
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle" style={{ background: color }} />
      {m.time} {short}
    </button>
  );
}

export default function CircleCalendar({ circles }: { circles: any[] }) {
  const today = todayLA();
  const [month, setMonth] = useState(() => today.slice(0, 7)); // "2026-11"
  const [picked, setPicked] = useState<Meetup | null>(null);

  // Sunday-first grid covering the month
  const first = utc(`${month}-01`);
  const gridStart = new Date(first); gridStart.setUTCDate(1 - first.getUTCDay());
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(gridStart); d.setUTCDate(gridStart.getUTCDate() + i); return iso(d); });
  const cells = days.slice(35).every((d) => d.slice(0, 7) !== month) ? days.slice(0, 35) : days;
  const meetups = useMemo(() => meetupsFor(circles, cells[0], cells[cells.length - 1], today), [circles, month, today]);
  const byDay = new Map<string, Meetup[]>();
  for (const m of meetups) (byDay.get(m.date) || byDay.set(m.date, []).get(m.date)!).push(m);
  const skipRanges = Array.from(new Map(circles.flatMap((c) => (c.schedule?.skip || []) as { from: string; to: string; label: string }[]).map((r) => [r.from + r.to, r])).values());
  const skipOn = (d: string) => skipRanges.find((r) => d >= r.from && d <= r.to);
  const shift = (n: number) => { const d = utc(`${month}-15`); d.setUTCMonth(d.getUTCMonth() + n); setMonth(iso(d).slice(0, 7)); setPicked(null); };
  const agenda = meetupsFor(circles, today, iso(new Date(+utc(today) + 42 * 864e5)), today).filter((m) => m.state !== "skipped");
  const areas = Array.from(new Set(circles.map((c) => c.area).filter(Boolean)));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => shift(-1)} className="p-1.5 rounded border border-gray-800 text-gray-400 hover:text-white"><ChevronLeft className="w-4 h-4" /></button>
        <h3 className="font-semibold text-white w-36 text-center">{MONTHS[+month.slice(5) - 1]} {month.slice(0, 4)}</h3>
        <button onClick={() => shift(1)} className="p-1.5 rounded border border-gray-800 text-gray-400 hover:text-white"><ChevronRight className="w-4 h-4" /></button>
        {month !== today.slice(0, 7) && <button onClick={() => { setMonth(today.slice(0, 7)); setPicked(null); }} className="text-xs text-[#D4AF37] ml-1">Today</button>}
        <div className="ml-auto hidden md:flex flex-wrap gap-3 text-[10px] text-gray-400">
          {areas.map((a) => <span key={a} className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: AREA_COLOR[a] || "#9CA3AF" }} />{a}</span>)}
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm border border-[#D4AF37] bg-[#D4AF37]/20" />confirmed</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm border border-dashed border-gray-400" />waiting</span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-800/60 rounded-lg overflow-hidden border border-gray-800/60">
        {DOW.map((d) => <div key={d} className="bg-[#0A0A0A] text-[10px] text-gray-500 text-center py-1">{d}</div>)}
        {cells.map((d) => {
          const out = d.slice(0, 7) !== month, skip = skipOn(d), list = byDay.get(d) || [];
          return (
            <div key={d} className={`min-h-[72px] md:min-h-[92px] p-1 ${skip ? "bg-gray-900" : "bg-[#0A0A0A]"} ${out ? "opacity-40" : ""}`}>
              <div className={`text-[10px] mb-0.5 ${d === today ? "text-black bg-[#D4AF37] rounded-full w-5 h-5 flex items-center justify-center font-bold" : "text-gray-500"}`}>{+d.slice(8)}</div>
              {skip && (d === skip.from || d.endsWith("-01") || utc(d).getUTCDay() === 0) && <div className="text-[9px] text-gray-500 italic mb-0.5 truncate">{skip.label} · no meetups</div>}
              <div className="space-y-0.5">{list.map((m, i) => <Chip key={i} m={m} onPick={setPicked} small />)}</div>
            </div>
          );
        })}
      </div>

      {picked && (
        <div className="rounded-xl border border-gray-800 bg-[#0A0A0A] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">{picked.circle.name}</p>
              <p className="text-xs text-gray-400">{pretty(picked.date)} · {picked.time} · {picked.host} + Luis</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded border border-gray-700 text-gray-300 shrink-0">{picked.skipLabel ? `Skipped: ${picked.skipLabel}` : STATE_LABEL[picked.state]}</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {(picked.circle.members || []).length} members
            {(() => { const n = (picked.circle.members || []).filter((m: any) => m.rsvp === "confirmed").length; return n ? ` · ${n} said yes` : ""; })()}
          </p>
          {picked.circle.notes && <p className="text-[11px] text-gray-500 mt-1">{picked.circle.notes}</p>}
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-[#D4AF37]" /> Next 6 weeks</h3>
        {agenda.length === 0 ? <p className="text-xs text-gray-600">Nothing scheduled.</p> : (
          <div className="space-y-1">
            {agenda.map((m, i) => (
              <button key={i} onClick={() => setPicked(m)} className="w-full flex items-center gap-3 text-left rounded-lg border border-gray-800/60 bg-[#0A0A0A] px-3 py-2 hover:border-gray-700">
                <span className="text-xs text-gray-400 w-24 shrink-0">{pretty(m.date)}</span>
                <span className="text-xs text-gray-300 w-14 shrink-0">{m.time}</span>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: AREA_COLOR[m.circle.area] || "#9CA3AF" }} />
                <span className="text-xs text-white truncate flex-1">{m.circle.name}</span>
                <span className="text-[11px] text-gray-500 shrink-0 hidden sm:inline">{m.host} + Luis</span>
                <span className={`text-[10px] shrink-0 ${m.state === "confirmed" ? "text-[#D4AF37]" : "text-gray-500"}`}>{STATE_LABEL[m.state]}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
