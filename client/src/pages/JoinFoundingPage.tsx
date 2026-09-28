import { useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Helmet } from "react-helmet";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, ChevronLeft, Sparkles, CalendarClock, Coffee, Search } from "lucide-react";
import { LA_CITIES } from "@/lib/laCities";
import { trackMetaEvent } from "@/lib/metaPixel";
const DISCIPLINES = ["Founder", "Music", "Film / Video", "Photography", "Design", "Illustration", "Writing", "Fashion", "Worship + Ministry Arts", "Content / Social", "Dance", "Other"];
const WINDOWS = ["Weekday mornings", "Weekday afternoons", "Weekday evenings", "Saturday mornings", "Saturday afternoons", "Sunday afternoons", "Sunday evenings", "I'm flexible"];
const ACTIVITIES = [{ v: "coffee", l: "Coffee ☕" }, { v: "hiking", l: "Hiking 🥾" }, { v: "run", l: "Running 🏃" }, { v: "book", l: "Book club 📚" }, { v: "open", l: "Open to anything ✨" }];

const ORDER = ["intro", "register", "city", "disciplines", "availability", "activity", "done"] as const;
type Phase = (typeof ORDER)[number];

export default function JoinFoundingPage() {
  const { user, registerMutation, loginMutation } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const loggedIn = !!user?.id;

  const [phase, setPhase] = useState<Phase>("intro");
  const [authMode, setAuthMode] = useState<"register" | "login">("register");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: "", email: "", phone: "", password: "", smsOptIn: false,
    city: "", waitlisted: false, otherCity: "",
    disciplines: [] as string[], availability: [] as string[], activity: "",
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggle = (k: "disciplines" | "availability", v: string) =>
    setForm((f) => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] }));

  const advance = (p: Phase, dir: 1 | -1 = 1) => {
    let i = ORDER.indexOf(p) + dir;
    while (ORDER[i] === "register" && loggedIn) i += dir;
    return ORDER[Math.max(0, Math.min(ORDER.length - 1, i))];
  };
  const next = () => setPhase((p) => advance(p, 1));
  const back = () => setPhase((p) => advance(p, -1));

  const doRegister = async () => {
    setSaving(true);
    const base = (form.firstName || form.email.split("@")[0] || "member").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) || "member";
    for (let attempt = 0; attempt < 3; attempt++) {
      const username = base + Math.floor(1000 + Math.random() * 89999);
      try {
        const res: any = await registerMutation.mutateAsync({ username, email: form.email, password: form.password, firstName: form.firstName, phone: form.phone } as any);
        if (res?.id) { trackMetaEvent("CompleteRegistration"); setSaving(false); setPhase("city"); return; }
        if (res?.requiresLogin) { setSaving(false); toast({ title: "Account created", description: "Please sign in to continue." }); navigate("/auth?redirect=/join"); return; }
      } catch (e: any) {
        if (/username/i.test(e?.message || "") && attempt < 2) continue; // taken → retry new username
        setSaving(false);
        toast({ title: "Couldn't create account", description: e?.message || "Try again.", variant: "destructive" });
        return;
      }
    }
    setSaving(false);
  };

  const doLogin = async () => {
    setSaving(true);
    try {
      await loginMutation.mutateAsync({ usernameOrEmail: form.email, password: form.password });
      setPhase("city"); // logged in — continue the funnel
    } catch {
      /* loginMutation.onError shows the toast */
    } finally { setSaving(false); }
  };

  const submit = async () => {
    setSaving(true);
    try {
      await apiRequest("/api/founding-signup", { method: "POST", data: {
        city: form.waitlisted ? (form.otherCity || "") : form.city,
        waitlisted: form.waitlisted,
        disciplines: form.disciplines,
        availability: form.availability,
        activity: form.activity || "open",
        matchPreference: "open",
        phone: form.phone || undefined,
        smsOptIn: form.smsOptIn,
      }});
      // Lead = finished the funnel inside LA (the signup the ads optimize for); waitlisted = outside LA, not counted
      if (!form.waitlisted) trackMetaEvent("Lead", { content_category: form.activity || "open" });
      setPhase("done");
    } catch {
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const visibleSteps = ORDER.filter((s) => s !== "register" || !loggedIn);
  const pct = Math.round((visibleSteps.indexOf(phase) / (visibleSteps.length - 1)) * 100);

  const canNext =
    phase === "intro" ? true :
    phase === "register" ? (authMode === "login"
      ? form.email.trim().length > 0 && form.password.length >= 1
      : form.email.includes("@") && form.password.length >= 6 && !!form.firstName && form.phone.trim().length >= 7) :
    phase === "city" ? (!!form.city || (form.waitlisted && form.otherCity.trim().length > 0)) :
    phase === "disciplines" ? true :
    phase === "availability" ? form.availability.length > 0 :
    phase === "activity" ? !!form.activity : true;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <Helmet><title>Join Christ Collective — Founding Members</title></Helmet>

      {phase !== "done" && (
        <div className="px-5 pt-6 pb-2">
          {phase !== "intro" ? (
            <button onClick={back} className="text-gray-400 hover:text-white flex items-center gap-1 text-sm mb-4"><ChevronLeft className="w-4 h-4" /> Back</button>
          ) : <div className="h-9" />}
          <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div className="h-full bg-[#D4AF37] transition-all duration-300" style={{ width: `${Math.max(6, pct)}%` }} />
          </div>
        </div>
      )}

      <div className="flex-1 px-5 py-6 max-w-md w-full mx-auto">
        {phase === "intro" && (
          <div>
            <div className="w-12 h-12 rounded-2xl bg-[#D4AF37] flex items-center justify-center mb-5"><Sparkles className="w-6 h-6 text-black" /></div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-3">Be a founding member</h1>
            <p className="text-gray-300 text-[15px] leading-relaxed mb-3">
              Christ Collective is building small circles of Christian creatives who actually meet up — coffee, hikes, runs, book nights. We're gathering our first group in LA right now.
            </p>
            <p className="text-gray-400 text-[14px] leading-relaxed">
              We're <span className="text-white font-medium">not matching people into circles just yet</span> — we want to build the group first. Tell us who you are and when you're generally free, and we'll bring you in as soon as there are enough people near you.
            </p>
            {!loggedIn && (
              <button onClick={() => { setAuthMode("login"); setPhase("register"); }} className="mt-6 text-sm text-[#D4AF37] hover:underline">
                Already have an account? Log in
              </button>
            )}
          </div>
        )}

        {phase === "register" && (
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight mb-1">{authMode === "login" ? "Welcome back" : "Create your account"}</h1>
            <p className="text-gray-400 text-sm mb-5">{authMode === "login" ? "Log in to continue joining." : "Takes 30 seconds."}</p>
            <div className="space-y-3">
              {authMode === "register" && <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder="First name" className="bg-[#0A0A0A] border-gray-800 text-white h-12" />}
              <Input value={form.email} onChange={(e) => set("email", e.target.value)} type={authMode === "login" ? "text" : "email"} placeholder={authMode === "login" ? "Email or username" : "Email"} className="bg-[#0A0A0A] border-gray-800 text-white h-12" />
              {authMode === "register" && <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} type="tel" placeholder="Phone (for your Matchup texts)" className="bg-[#0A0A0A] border-gray-800 text-white h-12" />}
              <Input value={form.password} onChange={(e) => set("password", e.target.value)} type="password" placeholder={authMode === "login" ? "Password" : "Password (6+ characters)"} className="bg-[#0A0A0A] border-gray-800 text-white h-12" />
            </div>
            <div className="mt-6 pt-4 border-t border-gray-900 text-center">
              <button onClick={() => setAuthMode((m) => (m === "login" ? "register" : "login"))} className="text-sm text-gray-400 hover:text-white">
                {authMode === "login" ? "New here? " : "Already have an account? "}
                <span className="text-[#D4AF37] font-semibold underline">{authMode === "login" ? "Create an account" : "Log in"}</span>
              </button>
            </div>
          </div>
        )}

        {phase === "city" && (
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight mb-1">Where in LA are you?</h1>
            <p className="text-gray-400 text-sm mb-5">We're launching across LA County first — pick your city.</p>
            {!form.waitlisted ? (
              <>
                <CitySelect value={form.city} onChange={(c) => set("city", c)} />
                <button onClick={() => setForm((f) => ({ ...f, waitlisted: true, city: "" }))} className="mt-4 text-sm text-[#D4AF37] hover:underline">
                  Not in LA County? Join the waitlist →
                </button>
              </>
            ) : (
              <>
                <Input value={form.otherCity} onChange={(e) => set("otherCity", e.target.value)} placeholder="What city are you in?" className="bg-[#0A0A0A] border-gray-800 text-white h-12" />
                <p className="text-xs text-gray-500 mt-2">We're LA-first, so you'll be on the waitlist until we reach your area.</p>
                <button onClick={() => setForm((f) => ({ ...f, waitlisted: false, otherCity: "" }))} className="mt-4 text-sm text-[#D4AF37] hover:underline">
                  ← Actually, I'm in LA County
                </button>
              </>
            )}
          </div>
        )}

        {phase === "disciplines" && (
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight mb-1">What do you create?</h1>
            <p className="text-gray-400 text-sm mb-5">Pick any that fit — helps us match you well.</p>
            <div className="flex flex-wrap gap-2.5">
              {DISCIPLINES.map((d) => (
                <button key={d} onClick={() => toggle("disciplines", d)} className={cn("px-4 py-2.5 rounded-full text-sm font-medium border transition-colors", form.disciplines.includes(d) ? "bg-[#D4AF37] text-black border-transparent" : "bg-transparent border-gray-700 text-gray-300 hover:border-[#D4AF37]")}>{d}</button>
              ))}
            </div>
          </div>
        )}

        {phase === "availability" && (
          <div>
            <div className="flex items-center gap-2 mb-1"><CalendarClock className="w-5 h-5 text-[#D4AF37]" /><h1 className="text-2xl font-extrabold tracking-tight">When are you usually free?</h1></div>
            <p className="text-gray-400 text-sm mb-5">Pick any that generally work — we'll use this to find a time that fits your circle. No exact date yet; we'll set one once enough people join.</p>
            <div className="space-y-2.5">
              {WINDOWS.map((w) => <Row key={w} label={w} on={form.availability.includes(w)} onClick={() => toggle("availability", w)} />)}
            </div>
          </div>
        )}

        {phase === "activity" && (
          <div>
            <div className="flex items-center gap-2 mb-1"><Coffee className="w-5 h-5 text-[#D4AF37]" /><h1 className="text-2xl font-extrabold tracking-tight">What sounds fun?</h1></div>
            <p className="text-gray-400 text-sm mb-5">How would you like to meet your circle?</p>
            <div className="space-y-2.5">
              {ACTIVITIES.map((a) => <Row key={a.v} label={a.l} on={form.activity === a.v} onClick={() => set("activity", a.v)} />)}
            </div>
            {form.activity && (
              <label className="flex items-start gap-3 mt-5 p-3 rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/[0.04] cursor-pointer" onClick={() => set("smsOptIn", !form.smsOptIn)}>
                <span className={cn("w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 mt-0.5", form.smsOptIn ? "bg-[#D4AF37] border-[#D4AF37]" : "border-gray-600")}>
                  {form.smsOptIn && <Check className="w-3 h-3 text-black" />}
                </span>
                <span className="text-xs text-gray-400 leading-relaxed">
                  Matchups are coordinated by text — I agree to receive SMS from Christ Collective about my Matchups so we can match me (~4–6/cycle). Msg &amp; data rates may apply. Reply STOP to cancel.
                </span>
              </label>
            )}
          </div>
        )}

        {phase === "done" && (
          <div className="text-center py-10">
            <div className="w-16 h-16 rounded-2xl bg-[#D4AF37] mx-auto mb-5 flex items-center justify-center"><Check className="w-8 h-8 text-black" /></div>
            {form.waitlisted ? (
              <>
                <h1 className="text-2xl font-extrabold tracking-tight mb-3">You're on the list!</h1>
                <p className="text-gray-300 text-[15px] leading-relaxed mb-6">
                  You're officially a member — explore the app anytime. We're launching in LA first, so your local circles won't form until we start promoting in your area. We'll reach out the moment we're near you.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-extrabold tracking-tight mb-3">You're in! 🎉</h1>
                <p className="text-gray-300 text-[15px] leading-relaxed mb-6">
                  You're one of our founding members. We're gathering creatives near you — we don't have an exact date yet, but we'll text you the moment your first circle is ready.
                </p>
              </>
            )}
            <Button onClick={() => navigate("/feed")} className="w-full h-12 bg-[#D4AF37] hover:bg-[#C4A030] text-black font-bold">Explore the app</Button>
          </div>
        )}
      </div>

      {phase !== "done" && (
        <div className="sticky bottom-0 bg-black/90 backdrop-blur border-t border-gray-900 px-5 py-4">
          <div className="max-w-md mx-auto">
            <Button
              onClick={() => {
                if (phase === "register") return authMode === "login" ? doLogin() : doRegister();
                if (phase === "activity") return submit();
                next();
              }}
              disabled={!canNext || saving}
              className="w-full h-12 bg-[#D4AF37] hover:bg-[#C4A030] text-black font-bold disabled:opacity-40"
            >
              {saving ? (phase === "register" && authMode === "login" ? "Logging in…" : "Saving…") : phase === "intro" ? "Get started" : phase === "register" && authMode === "login" ? "Log in & continue" : phase === "activity" ? "Join the founding group" : phase === "disciplines" && form.disciplines.length === 0 ? "Skip" : "Continue"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Searchable, select-only city picker — you can only pick a real LA County city/community.
function CitySelect({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [q, setQ] = useState(value);
  const [open, setOpen] = useState(false);
  const query = q.trim().toLowerCase();
  const matches = (query ? LA_CITIES.filter((c) => c.toLowerCase().includes(query)) : LA_CITIES).slice(0, 60);
  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <Input
          value={q}
          onChange={(e) => {
            const t = e.target.value;
            setQ(t); setOpen(true);
            const exact = LA_CITIES.find((c) => c.toLowerCase() === t.trim().toLowerCase());
            onChange(exact || "");
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search your city…"
          className="bg-[#0A0A0A] border-gray-800 text-white h-12 pl-9"
        />
        {value && <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#D4AF37]" />}
      </div>
      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-gray-800 bg-[#0A0A0A] shadow-2xl">
          {matches.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500">No LA County city matches that. Try another, or use the waitlist below.</div>
          ) : matches.map((c) => (
            <button
              key={c}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(c); setQ(c); setOpen(false); }}
              className={cn("w-full text-left px-4 py-2.5 text-[15px] hover:bg-[#D4AF37]/10", value === c ? "text-[#D4AF37]" : "text-gray-200")}
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, on, onClick, icon }: { label: string; on: boolean; onClick: () => void; icon?: ReactNode }) {
  return (
    <button onClick={onClick} className={cn("w-full flex items-center justify-between gap-3 text-left px-4 py-4 rounded-xl border transition-colors", on ? "bg-[#D4AF37]/10 border-[#D4AF37]" : "bg-[#0A0A0A] border-gray-800 hover:border-[#D4AF37]/50")}>
      <span className="flex items-center gap-2.5">{icon}<span className="text-white text-[15px] font-medium">{label}</span></span>
      <span className={cn("w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0", on ? "bg-[#D4AF37] border-[#D4AF37]" : "border-gray-700")}>
        {on && <Check className="w-3 h-3 text-black" />}
      </span>
    </button>
  );
}
