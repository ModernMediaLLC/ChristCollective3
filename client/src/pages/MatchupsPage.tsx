import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { ChevronLeft, Check, Sunrise, Sun, Moon, X, PauseCircle, PlayCircle } from "lucide-react";
import { Helmet } from "react-helmet";
import { FLEXIBLE, WINDOW_DAYS, WINDOW_TIMES, formatDate, formatRange, isPaused, laToday, upcomingBlackouts, type Blackout } from "@shared/matchup";

// Meetup preferences: stay in the loop or pause (optionally until a date), the weekly times that work,
// dates they can't make, and what they'd like to do. Saved into their matchupRequest (shared/matchup.ts);
// the grouping tools skip paused members and never offer anyone a date they blocked out.

const DAY_LABEL: Record<string, string> = { Weekday: "Weekdays", Saturday: "Sat", Sunday: "Sun" };
const TIME_META: Record<string, { l: string; Icon: typeof Sun }> = {
  morning: { l: "Morning", Icon: Sunrise }, afternoon: { l: "Afternoon", Icon: Sun }, evening: { l: "Evening", Icon: Moon },
};
const ACTIVITIES = [
  { v: "coffee", l: "Coffee" }, { v: "create", l: "Create Together" }, { v: "hiking", l: "Hiking" },
  { v: "run", l: "Running" }, { v: "serve", l: "Serve Together" }, { v: "open", l: "Open to anything" },
];
const MAX_ACTIVITIES = 3;

const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const monthStart = (iso: string, plus = 0) => { const [y, m] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1 + plus, 1)).toISOString().slice(0, 10); };
const monthEnd = (iso: string, plus = 0) => { const [y, m] = iso.split("-").map(Number); return new Date(Date.UTC(y, m + plus, 0)).toISOString().slice(0, 10); };
const monthName = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });

// apiRequest errors look like `400: {"message":"..."}` — pull out just the message
function readableError(raw?: string): string {
  const body = (raw || "").replace(/^\d{3}:\s*/, "");
  try { return JSON.parse(body).message || body; } catch { return body; }
}

export default function MatchupsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const today = laToday();
  const { data, isLoading } = useQuery<{ matchupRequest: any; circles: any[]; waitlisted?: boolean }>({
    queryKey: ["/api/user/meetups"],
    enabled: !!user?.id,
  });
  const mr = data?.matchupRequest;

  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [untilDate, setUntilDate] = useState(false);
  const [resumeOn, setResumeOn] = useState(addDays(today, 30));
  const [availability, setAvailability] = useState<string[]>([]);
  const [activities, setActivities] = useState<string[]>([]);
  const [blackouts, setBlackouts] = useState<Blackout[]>([]);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  useEffect(() => {
    if (!mr || ready) return;
    const p = isPaused(mr, today);
    setPaused(p);
    setUntilDate(p && !!mr.resumeOn);
    if (p && mr.resumeOn) setResumeOn(mr.resumeOn);
    setAvailability(Array.isArray(mr.availability) ? mr.availability : []);
    setActivities(Array.isArray(mr.activities) ? mr.activities : mr.activity ? [mr.activity] : []);
    setBlackouts(upcomingBlackouts(mr, today));
    setReady(true);
  }, [mr, ready, today]);

  const save = useMutation({
    mutationFn: async () => apiRequest("/api/matchups/preferences", {
      method: "PATCH",
      data: { paused, resumeOn: paused && untilDate ? resumeOn : null, availability, activities, blackouts },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/meetups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast(paused
        ? { title: "Meetups paused", description: untilDate ? `We'll add you back to the next round after ${formatDate(resumeOn)}.` : "Turn them back on here whenever you're ready." }
        : { title: "Saved", description: "We'll use this when we form your next circle." });
      navigate("/feed");
    },
    onError: (e: any) => toast({ title: "Couldn't save", description: readableError(e?.message) || "Please try again.", variant: "destructive" }),
  });

  const flexible = availability.includes(FLEXIBLE);
  const toggleWindow = (w: string) => setAvailability((a) => {
    const cur = a.filter((x) => x !== FLEXIBLE);
    return cur.includes(w) ? cur.filter((x) => x !== w) : [...cur, w];
  });
  const toggleActivity = (v: string) => setActivities((a) => {
    if (v === "open") return a.includes("open") ? [] : ["open"];
    const cur = a.filter((x) => x !== "open");
    return cur.includes(v) ? cur.filter((x) => x !== v) : cur.length >= MAX_ACTIVITIES ? cur : [...cur, v];
  });
  const addBlackout = (b: Blackout) => setBlackouts((list) => {
    const r = b.from <= b.to ? b : { from: b.to, to: b.from };
    if (r.to < today || list.some((x) => x.from === r.from && x.to === r.to)) return list;
    return [...list, r].sort((x, y) => x.from.localeCompare(y.from));
  });
  const quick = [
    { l: "Next 7 days", b: { from: today, to: addDays(today, 6) } },
    { l: "Next 2 weeks", b: { from: today, to: addDays(today, 13) } },
    { l: `Rest of ${monthName(today)}`, b: { from: today, to: monthEnd(today) } },
    { l: `All of ${monthName(monthStart(today, 1))}`, b: { from: monthStart(today, 1), to: monthEnd(today, 1) } },
  ];

  const problem = !availability.length ? "Pick the times that work"
    : !activities.length ? "Pick an activity"
    : paused && untilDate && !(resumeOn > today) ? "Pick a date after today"
    : null;

  if (isLoading || (mr && !ready)) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#D4AF37]" />
      </div>
    );
  }

  // Not in the meetups yet: /join collects what matching needs (city, birthday, times, activities, texting OK)
  if (!mr) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Helmet><title>Meetups — Christ Collective</title></Helmet>
        <div className="max-w-md mx-auto px-5 pt-6">
          <BackHome onClick={() => navigate("/feed")} />
          <h1 className="text-2xl font-extrabold tracking-tight mb-2">Meet your creative circle</h1>
          <p className="text-gray-400 text-sm mb-6">Tell us where you are and when you're free, and we'll match you with Christian creatives near you.</p>
          <Button onClick={() => navigate("/join")} className="w-full h-12 bg-[#D4AF37] hover:bg-[#C4A030] text-black font-bold">Join the meetups</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Helmet><title>Meetup preferences — Christ Collective</title></Helmet>
      <div className="max-w-md mx-auto px-5 pt-6 pb-32">
        <BackHome onClick={() => navigate("/feed")} />
        <h1 className="text-2xl font-extrabold tracking-tight mb-1">Meetup preferences</h1>
        <p className="text-gray-400 text-sm mb-6">We use this every time we form new circles, so keep it current.</p>
        {data?.waitlisted && (
          <p className="text-xs text-gray-400 rounded-xl border border-gray-800 bg-[#0A0A0A] p-3 mb-6">
            We're starting in LA, so you're on the waitlist. Your preferences are saved for when we come to your area.
          </p>
        )}

        <Section title="Your meetups">
          <div className="space-y-2">
            <Choice on={!paused} onClick={() => setPaused(false)} Icon={PlayCircle} title="Keep me in the loop"
              sub="We'll place you in a circle each round and text you the dates." />
            <Choice on={paused} onClick={() => setPaused(true)} Icon={PauseCircle} title="Pause my meetups"
              sub="You won't be put in a circle or texted about dates until you turn them back on." />
          </div>
          {paused && (
            <div className="mt-3 rounded-xl border border-gray-800 bg-[#0A0A0A] p-3 space-y-2.5">
              <Radio on={!untilDate} onClick={() => setUntilDate(false)} label="Until I turn them back on" />
              <Radio on={untilDate} onClick={() => setUntilDate(true)} label="Until a date" />
              {untilDate && (
                <>
                  <input type="date" min={addDays(today, 1)} value={resumeOn} onChange={(e) => setResumeOn(e.target.value)}
                    className="w-full bg-black border border-gray-800 rounded-lg px-3 py-2 text-sm text-white [color-scheme:dark]" />
                  {resumeOn > today && <p className="text-[11px] text-gray-500">You'll be back in the loop on {formatDate(resumeOn)}.</p>}
                </>
              )}
            </div>
          )}
        </Section>

        <Section title="Times that usually work" sub="Pick every time you can usually make. We choose meetup dates from these.">
          <div className="rounded-2xl border border-gray-800 bg-[#0A0A0A] p-3">
            <div className="grid grid-cols-[72px_repeat(3,1fr)] gap-2 items-center">
              <div />
              {WINDOW_TIMES.map((t) => {
                const { l, Icon } = TIME_META[t];
                return <div key={t} className="flex flex-col items-center gap-1 text-[11px] font-medium text-gray-400 pb-1"><Icon className="w-4 h-4 text-[#D4AF37]" />{l}</div>;
              })}
              {WINDOW_DAYS.map((d) => (
                <div key={d} className="contents">
                  <div className="text-sm font-semibold text-gray-200">{DAY_LABEL[d]}</div>
                  {WINDOW_TIMES.map((t) => {
                    const w = `${d} ${t}s`, on = !flexible && availability.includes(w);
                    return (
                      <button key={w} onClick={() => toggleWindow(w)} aria-label={w} aria-pressed={on}
                        className={cn("h-11 rounded-xl border flex items-center justify-center transition-colors",
                          on ? "bg-[#D4AF37] border-[#D4AF37]" : "border-gray-800 hover:border-[#D4AF37]/60")}>
                        {on && <Check className="w-4 h-4 text-black" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <button onClick={() => setAvailability(flexible ? [] : [FLEXIBLE])}
            className={cn("w-full mt-3 py-3 rounded-xl border text-sm font-medium transition-colors",
              flexible ? "bg-[#D4AF37]/10 border-[#D4AF37] text-[#D4AF37]" : "border-gray-800 text-gray-400 hover:border-[#D4AF37]/50")}>
            {flexible ? "✓ I'm flexible — any time works" : "I'm flexible — any time works"}
          </button>
        </Section>

        <Section title="Dates you can't make" sub="Traveling, a busy season, a full month? Block it out and we won't put you in a meetup on those days.">
          {blackouts.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {blackouts.map((b) => (
                <span key={`${b.from}-${b.to}`} className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs pl-3 pr-1.5 py-1">
                  {formatRange(b)}
                  <button onClick={() => setBlackouts((l) => l.filter((x) => x !== b))} aria-label={`Remove ${formatRange(b)}`}
                    className="w-5 h-5 rounded-full hover:bg-amber-500/20 flex items-center justify-center"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2 mb-3">
            {quick.map((q) => (
              <button key={q.l} onClick={() => addBlackout(q.b)}
                className="rounded-full border border-gray-800 px-3 py-1.5 text-xs text-gray-300 hover:border-[#D4AF37]/60">+ {q.l}</button>
            ))}
          </div>
          <div className="rounded-xl border border-gray-800 bg-[#0A0A0A] p-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] text-gray-500">From
                <input type="date" min={today} value={from} onChange={(e) => { setFrom(e.target.value); if (e.target.value > to) setTo(e.target.value); }}
                  className="mt-1 w-full bg-black border border-gray-800 rounded-lg px-2 py-2 text-sm text-white [color-scheme:dark]" />
              </label>
              <label className="text-[11px] text-gray-500">To
                <input type="date" min={from || today} value={to} onChange={(e) => setTo(e.target.value)}
                  className="mt-1 w-full bg-black border border-gray-800 rounded-lg px-2 py-2 text-sm text-white [color-scheme:dark]" />
              </label>
            </div>
            <Button variant="outline" disabled={!from || !to} onClick={() => addBlackout({ from, to })}
              className="w-full mt-2 h-10 border-gray-700 bg-transparent text-gray-200 hover:bg-white/5">
              Block out {from && to ? formatRange(from <= to ? { from, to } : { from: to, to: from }) : "these dates"}
            </Button>
          </div>
        </Section>

        <Section title="What you'd like to do" sub={`Pick up to ${MAX_ACTIVITIES}.`}>
          <div className="flex flex-wrap gap-2">
            {ACTIVITIES.map((a) => {
              const on = activities.includes(a.v);
              return (
                <button key={a.v} onClick={() => toggleActivity(a.v)} aria-pressed={on}
                  className={cn("rounded-full border px-3.5 py-2 text-sm transition-colors",
                    on ? "bg-[#D4AF37] border-[#D4AF37] text-black font-semibold" : "border-gray-800 text-gray-300 hover:border-[#D4AF37]/60")}>
                  {a.l}
                </button>
              );
            })}
          </div>
        </Section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur border-t border-gray-800 px-5 py-4">
        <div className="max-w-md mx-auto">
          <Button onClick={() => save.mutate()} disabled={!!problem || save.isPending}
            className="w-full h-12 bg-[#D4AF37] hover:bg-[#C4A030] text-black font-bold disabled:opacity-40">
            {save.isPending ? "Saving…" : problem || (paused ? "Pause my meetups" : "Save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function BackHome({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-gray-400 hover:text-white flex items-center gap-1 text-sm mb-5">
      <ChevronLeft className="w-4 h-4" /> Home
    </button>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-base font-bold mb-0.5">{title}</h2>
      {sub && <p className="text-gray-500 text-xs mb-3">{sub}</p>}
      {!sub && <div className="mb-3" />}
      {children}
    </section>
  );
}

function Choice({ on, onClick, Icon, title, sub }: { on: boolean; onClick: () => void; Icon: typeof Sun; title: string; sub: string }) {
  return (
    <button onClick={onClick} aria-pressed={on}
      className={cn("w-full text-left rounded-xl border p-3.5 flex items-start gap-3 transition-colors",
        on ? "bg-[#D4AF37]/10 border-[#D4AF37]" : "border-gray-800 bg-[#0A0A0A] hover:border-[#D4AF37]/50")}>
      <Icon className={cn("w-5 h-5 mt-0.5 shrink-0", on ? "text-[#D4AF37]" : "text-gray-500")} />
      <span className="flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-gray-400 mt-0.5">{sub}</span>
      </span>
      <span className={cn("w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5", on ? "bg-[#D4AF37] border-[#D4AF37]" : "border-gray-600")}>
        {on && <Check className="w-3 h-3 text-black" />}
      </span>
    </button>
  );
}

function Radio({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} aria-pressed={on} className="flex items-center gap-2.5 text-sm text-gray-200">
      <span className={cn("w-4 h-4 rounded-full border flex items-center justify-center", on ? "border-[#D4AF37]" : "border-gray-600")}>
        {on && <span className="w-2 h-2 rounded-full bg-[#D4AF37]" />}
      </span>
      {label}
    </button>
  );
}
