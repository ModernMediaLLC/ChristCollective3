import { useState } from "react";
import { useLocation } from "wouter";
import { Helmet } from "react-helmet";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { buildApiUrl, getMobileAuthHeaders } from "@/lib/api-config";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, ChevronLeft, CalendarClock, Coffee, Search, Cake, Sunrise, Sun, Moon, Camera } from "lucide-react";
import { LA_CITIES } from "@/lib/laCities";
import { trackMetaEvent } from "@/lib/metaPixel";
const DISCIPLINES = ["Founder", "Music", "Film / Video", "Photography", "Design", "Illustration", "Writing", "Fashion", "Worship + Ministry Arts", "Content / Social", "Dance", "Other"];
const MAX_DISCIPLINES = 3;
// Availability = a days × time-of-day grid; each cell maps to a window label like "Weekday evenings" (what the Matching CRM shows).
const DAYS = [{ v: "Weekday", l: "Weekdays" }, { v: "Saturday", l: "Sat" }, { v: "Sunday", l: "Sun" }];
const TIMES = [{ v: "morning", l: "Morning", Icon: Sunrise }, { v: "afternoon", l: "Afternoon", Icon: Sun }, { v: "evening", l: "Evening", Icon: Moon }];
const MAX_WINDOWS = 3;
const FLEXIBLE = "I'm flexible";
const windowLabel = (day: string, time: string) => `${day} ${time}s`;
const ACTIVITIES = [
  { v: "coffee", l: "Coffee", sub: "", img: "/activities/coffee.jpg" },
  { v: "hiking", l: "Hiking", sub: "", img: "/activities/hiking.jpg" },
  { v: "run", l: "Running", sub: "", img: "/activities/run.jpg" },
  { v: "create", l: "Create Together", sub: "Bring what you're working on", img: "/activities/create.jpg" },
  { v: "serve", l: "Serve Together", sub: "Volunteer as a circle", img: "/activities/serve.jpg" },
  { v: "open", l: "Open to anything", sub: "", img: "/activities/open.jpg" },
];
const MAX_ACTIVITIES = 3;
const OPEN = "open";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// apiRequest errors look like `400: {"message":"..."}` — pull out just the message
function readableError(raw?: string): string {
  const body = (raw || "").replace(/^\d{3}:\s*/, "");
  try { return JSON.parse(body).message || body; } catch { return body; }
}

// Age in whole years from a YYYY-MM-DD string (null if incomplete/invalid)
function ageFrom(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && now.getDate() < d)) age--;
  return age;
}

const ORDER = ["intro", "register", "birthday", "city", "disciplines", "availability", "activity", "profile", "done"] as const;
const BIO_MAX = 160;
type Phase = (typeof ORDER)[number];

export default function JoinFoundingPage() {
  const { user, registerMutation, loginMutation } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  // ?preview=1 → walk the whole funnel without creating an account, saving anything, or firing pixel events
  const preview = new URLSearchParams(window.location.search).has("preview");
  const loggedIn = !!user?.id;

  const [phase, setPhase] = useState<Phase>("intro");
  const [authMode, setAuthMode] = useState<"register" | "login">("register");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: "", email: "", phone: "", password: "", smsOptIn: (user as any)?.smsOptIn === true,
    birthdate: ((user as any)?.birthdate as string | undefined)?.slice(0, 10) || "",
    city: "", waitlisted: false, otherCity: "",
    disciplines: [] as string[], availability: [] as string[], activities: [] as string[],
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  // Toggle a multi-select value, ignoring new picks once `max` is reached.
  // "I'm flexible" / "Open to anything" are exclusive: picking a specific option clears them.
  const toggle = (k: "disciplines" | "availability" | "activities", v: string, max: number) =>
    setForm((f) => {
      const cur = f[k].filter((x) => x !== FLEXIBLE && x !== OPEN);
      if (cur.includes(v)) return { ...f, [k]: cur.filter((x) => x !== v) };
      return cur.length >= max ? f : { ...f, [k]: [...cur, v] };
    });
  const age = ageFrom(form.birthdate);

  const advance = (p: Phase, dir: 1 | -1 = 1) => {
    let i = ORDER.indexOf(p) + dir;
    while (ORDER[i] === "register" && loggedIn) i += dir;
    return ORDER[Math.max(0, Math.min(ORDER.length - 1, i))];
  };
  const next = () => setPhase((p) => advance(p, 1));
  const back = () => setPhase((p) => advance(p, -1));

  const doRegister = async () => {
    if (preview) return setPhase("birthday");
    setSaving(true);
    const base = (form.firstName || form.email.split("@")[0] || "member").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) || "member";
    for (let attempt = 0; attempt < 3; attempt++) {
      const username = base + Math.floor(1000 + Math.random() * 89999);
      try {
        const res: any = await registerMutation.mutateAsync({ username, email: form.email, password: form.password, firstName: form.firstName, phone: form.phone } as any);
        if (res?.id) { trackMetaEvent("CompleteRegistration"); setSaving(false); setPhase("birthday"); return; }
        if (res?.requiresLogin) { setSaving(false); toast({ title: "Account created", description: "Please sign in to continue." }); navigate("/auth?redirect=/join"); return; }
      } catch (e: any) {
        if (/username/i.test(e?.message || "") && attempt < 2) continue; // taken → retry new username
        setSaving(false);
        if (/email already exists/i.test(e?.message || "")) {
          setAuthMode("login");
          toast({ title: "You already have an account", description: "Log in with your password to continue joining." });
          return;
        }
        toast({ title: "Couldn't create account", description: readableError(e?.message) || "Try again.", variant: "destructive" });
        return;
      }
    }
    setSaving(false);
  };

  const doLogin = async () => {
    if (preview) return setPhase("birthday");
    setSaving(true);
    try {
      await loginMutation.mutateAsync({ usernameOrEmail: form.email, password: form.password });
      setPhase("birthday"); // logged in — continue the funnel
    } catch {
      /* loginMutation.onError shows the toast */
    } finally { setSaving(false); }
  };

  // Optional profile step (after the signup is already saved): photo, short bio, Instagram
  const [profile, setProfile] = useState({ photo: null as File | null, photoUrl: "", bio: "", instagram: "" });
  const profileTouched = !!profile.photo || !!profile.bio.trim() || !!profile.instagram.trim();
  const pickPhoto = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast({ title: "Please choose an image", variant: "destructive" });
    setProfile((p) => ({ ...p, photo: file, photoUrl: URL.createObjectURL(file) }));
  };
  const saveProfile = async () => {
    if (preview || !profileTouched) return setPhase("done");
    setSaving(true);
    try {
      if (profile.photo) {
        const fd = new FormData();
        fd.append("profileImage", profile.photo);
        const r = await fetch(buildApiUrl("/api/upload/profile-image"), { method: "POST", credentials: "include", headers: getMobileAuthHeaders(), body: fd });
        if (!r.ok) throw new Error("Couldn't upload your photo — try a smaller image.");
      }
      if (profile.bio.trim() || profile.instagram.trim()) {
        await apiRequest("/api/user/profile", { method: "PUT", data: {
          ...(profile.bio.trim() && { bio: profile.bio.trim() }),
          ...(profile.instagram.trim() && { instagram: profile.instagram.trim() }),
        }});
      }
      setPhase("done");
    } catch (e: any) {
      toast({ title: "Couldn't save your profile", description: readableError(e?.message) || "Try again, or skip for now.", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const submit = async () => {
    if (preview) return setPhase("profile");
    setSaving(true);
    try {
      await apiRequest("/api/founding-signup", { method: "POST", data: {
        city: form.waitlisted ? (form.otherCity || "") : form.city,
        waitlisted: form.waitlisted,
        birthdate: form.birthdate,
        disciplines: form.disciplines,
        availability: form.availability,
        activities: form.activities,
        matchPreference: "open",
        phone: form.phone || undefined,
        smsOptIn: form.smsOptIn,
      }});
      // Lead = finished the funnel inside LA (the signup the ads optimize for); waitlisted = outside LA, not counted
      if (!form.waitlisted) trackMetaEvent("Lead", { content_category: form.activities.join(",") || OPEN });
      setPhase("profile");
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
    phase === "birthday" ? age !== null && age >= 18 && age < 110 :
    phase === "city" ? (!!form.city || (form.waitlisted && form.otherCity.trim().length > 0)) :
    phase === "disciplines" ? true :
    phase === "availability" ? form.availability.length > 0 :
    phase === "activity" ? form.activities.length > 0 && form.smsOptIn : true;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <Helmet><title>Join Christ Collective — Founding Members</title></Helmet>
      {preview && (
        <div className="bg-[#D4AF37] text-black text-center text-xs font-semibold py-1.5">Preview mode — nothing is saved, no account is created</div>
      )}

      {phase !== "done" && (
        <div className="px-5 pt-6 pb-2">
          {phase !== "intro" && phase !== "profile" ? (
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
            <img src="/brand/christ-collective-logo.png" alt="Christ Collective" className="h-12 w-auto mb-7" />
            <h1 className="text-3xl font-extrabold tracking-tight mb-3">Be a founding member</h1>
            <p className="text-white text-[15px] leading-relaxed mb-3">
              Christ Collective is a community where Christian creatives and founders connect, create and grow in faith together.
            </p>
            <p className="text-gray-300 text-[15px] leading-relaxed mb-3">
              We're starting by building <span className="text-[#D4AF37] font-semibold">small circles of 6–8</span> who actually meet up — over coffee, on a hike, on a run. Our first circles are forming in LA right now.
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

        {phase === "birthday" && (
          <div>
            <div className="flex items-center gap-2 mb-1"><Cake className="w-5 h-5 text-[#D4AF37]" /><h1 className="text-2xl font-extrabold tracking-tight">When's your birthday?</h1></div>
            <p className="text-gray-400 text-sm mb-5">Meetups are 18+. We use this to match you with people in a similar season of life — it's never shown publicly.</p>
            <BirthdayPicker value={form.birthdate} onChange={(v) => set("birthdate", v)} />
            {age !== null && age < 18 && (
              <p className="text-sm text-red-400 mt-4">You need to be 18 or older to join Matchups. We'd love to have you once you're 18!</p>
            )}
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
            <p className="text-gray-400 text-sm mb-5">
              Pick up to {MAX_DISCIPLINES} — helps us match you well. <span className="text-[#D4AF37] font-medium">{form.disciplines.length}/{MAX_DISCIPLINES}</span>
            </p>
            <div className="flex flex-wrap gap-2.5">
              {DISCIPLINES.map((d) => {
                const on = form.disciplines.includes(d);
                const full = !on && form.disciplines.length >= MAX_DISCIPLINES;
                return (
                  <button key={d} onClick={() => toggle("disciplines", d, MAX_DISCIPLINES)} disabled={full} className={cn("px-4 py-2.5 rounded-full text-sm font-medium border transition-colors", on ? "bg-[#D4AF37] text-black border-transparent" : "bg-transparent border-gray-700 text-gray-300 hover:border-[#D4AF37]", full && "opacity-35 hover:border-gray-700 cursor-not-allowed")}>{d}</button>
                );
              })}
            </div>
          </div>
        )}

        {phase === "availability" && (
          <div>
            <div className="flex items-center gap-2 mb-1"><CalendarClock className="w-5 h-5 text-[#D4AF37]" /><h1 className="text-2xl font-extrabold tracking-tight">When are you usually free?</h1></div>
            <p className="text-gray-400 text-sm mb-5">
              Tap up to {MAX_WINDOWS} times that usually work. No exact date yet — we'll set one once your circle fills.
            </p>
            <AvailabilityGrid selected={form.availability} onToggle={(w) => toggle("availability", w, MAX_WINDOWS)} />
            <button
              onClick={() => set("availability", form.availability.includes(FLEXIBLE) ? [] : [FLEXIBLE])}
              className={cn("w-full mt-4 py-3 rounded-xl border text-sm font-medium transition-colors", form.availability.includes(FLEXIBLE) ? "bg-[#D4AF37]/10 border-[#D4AF37] text-[#D4AF37]" : "border-gray-800 text-gray-400 hover:border-[#D4AF37]/50")}
            >
              {form.availability.includes(FLEXIBLE) ? "✓ I'm flexible — any time works" : "I'm flexible — any time works"}
            </button>
          </div>
        )}

        {phase === "activity" && (
          <div>
            <div className="flex items-center gap-2 mb-1"><Coffee className="w-5 h-5 text-[#D4AF37]" /><h1 className="text-2xl font-extrabold tracking-tight">What sounds fun?</h1></div>
            <p className="text-gray-400 text-sm mb-5">
              Pick up to {MAX_ACTIVITIES} ways you'd like to meet your circle. <span className="text-[#D4AF37] font-medium">{form.activities.filter((a) => a !== OPEN).length}/{MAX_ACTIVITIES}</span>
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {ACTIVITIES.map((a) => {
                const on = form.activities.includes(a.v);
                const full = !on && a.v !== OPEN && form.activities.filter((x) => x !== OPEN).length >= MAX_ACTIVITIES;
                return (
                  <ActivityCard
                    key={a.v} label={a.l} sub={a.sub} img={a.img} on={on} disabled={full}
                    onClick={() => a.v === OPEN ? set("activities", on ? [] : [OPEN]) : toggle("activities", a.v, MAX_ACTIVITIES)}
                  />
                );
              })}
            </div>
            <label className={cn("flex items-start gap-3 mt-5 p-3 rounded-xl border cursor-pointer transition-colors", form.smsOptIn ? "border-[#D4AF37]/40 bg-[#D4AF37]/[0.04]" : "border-gray-700")} onClick={() => set("smsOptIn", !form.smsOptIn)}>
              <span className={cn("w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 mt-0.5", form.smsOptIn ? "bg-[#D4AF37] border-[#D4AF37]" : "border-gray-500")}>
                {form.smsOptIn && <Check className="w-3 h-3 text-black" />}
              </span>
              <span className="text-xs text-gray-400 leading-relaxed">
                <span className="text-white font-medium">Required:</span> Matchups are coordinated by text — I agree to receive SMS from Christ Collective about my Matchups so we can match me (~4–6/cycle). Msg &amp; data rates may apply. Reply STOP to cancel.
              </span>
            </label>
          </div>
        )}

        {phase === "profile" && (
          <div>
            <p className="text-[#D4AF37] text-xs font-bold uppercase tracking-widest mb-2">✓ You're in — one last touch</p>
            <h1 className="text-2xl font-extrabold tracking-tight mb-1">Let your circle know you</h1>
            <p className="text-gray-400 text-sm mb-6">People feel more comfortable meeting someone they can recognize. Add a photo and a line about yourself — you can change it anytime.</p>

            <label className="flex items-center gap-4 mb-6 cursor-pointer group">
              <span className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-dashed border-gray-700 group-hover:border-[#D4AF37] flex items-center justify-center bg-[#0A0A0A] flex-shrink-0">
                {profile.photoUrl
                  ? <img src={profile.photoUrl} alt="" className="w-full h-full object-cover" />
                  : <Camera className="w-7 h-7 text-gray-500 group-hover:text-[#D4AF37]" />}
              </span>
              <span>
                <span className="block text-white font-semibold text-[15px]">{profile.photoUrl ? "Change photo" : "Add a profile photo"}</span>
                <span className="block text-gray-500 text-xs mt-0.5">A clear photo of your face works best</span>
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} />
            </label>

            <label className="block text-sm font-semibold text-gray-200 mb-1.5">Short bio</label>
            <textarea
              value={profile.bio}
              onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value.slice(0, BIO_MAX) }))}
              rows={3}
              placeholder="e.g. Filmmaker in Silver Lake. Coffee snob, Psalm 23 guy, always down for a sunrise hike."
              className="w-full rounded-md bg-[#0A0A0A] border border-gray-800 text-white text-[15px] p-3 placeholder:text-gray-600 focus:outline-none focus:border-[#D4AF37] resize-none"
            />
            <p className="text-right text-[11px] text-gray-600 mb-4">{profile.bio.length}/{BIO_MAX}</p>

            <label className="block text-sm font-semibold text-gray-200 mb-1.5">Instagram <span className="text-gray-500 font-normal">(optional)</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">@</span>
              <Input value={profile.instagram} onChange={(e) => setProfile((p) => ({ ...p, instagram: e.target.value.replace(/^@/, "") }))} placeholder="yourhandle" autoCapitalize="none" className="bg-[#0A0A0A] border-gray-800 text-white h-12 pl-8" />
            </div>
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
                if (phase === "profile") return saveProfile();
                next();
              }}
              disabled={!canNext || saving}
              className="w-full h-12 bg-[#D4AF37] hover:bg-[#C4A030] text-black font-bold disabled:opacity-40"
            >
              {saving ? (phase === "register" && authMode === "login" ? "Logging in…" : "Saving…") : phase === "intro" ? "Get started" : phase === "register" && authMode === "login" ? "Log in & continue" : phase === "activity" ? "Join the founding group" : phase === "profile" ? (profileTouched ? "Save & finish" : "Skip for now") : phase === "disciplines" && form.disciplines.length === 0 ? "Skip" : "Continue"}
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

// Month / Day / Year selects → "YYYY-MM-DD" (only emitted once all three are picked)
function BirthdayPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [y0, m0, d0] = value ? value.split("-") : ["", "", ""];
  const [parts, setParts] = useState({ y: y0, m: m0, d: d0 });
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 83 }, (_, i) => String(thisYear - 18 - i + 1)); // newest first, ~18 → 100
  const daysInMonth = parts.y && parts.m ? new Date(+parts.y, +parts.m, 0).getDate() : 31;
  const update = (k: "y" | "m" | "d", v: string) => {
    const p = { ...parts, [k]: v };
    if (p.d && +p.d > (p.y && p.m ? new Date(+p.y, +p.m, 0).getDate() : 31)) p.d = "";
    setParts(p);
    onChange(p.y && p.m && p.d ? `${p.y}-${p.m}-${p.d}` : "");
  };
  const sel = "h-12 rounded-md bg-[#0A0A0A] border border-gray-800 text-white px-3 text-[15px] focus:outline-none focus:border-[#D4AF37]";
  return (
    <div className="grid grid-cols-[1.6fr_1fr_1.2fr] gap-2.5">
      <select value={parts.m} onChange={(e) => update("m", e.target.value)} className={sel} aria-label="Month">
        <option value="">Month</option>
        {MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
      </select>
      <select value={parts.d} onChange={(e) => update("d", e.target.value)} className={sel} aria-label="Day">
        <option value="">Day</option>
        {Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, "0")).map((d) => <option key={d} value={d}>{+d}</option>)}
      </select>
      <select value={parts.y} onChange={(e) => update("y", e.target.value)} className={sel} aria-label="Year">
        <option value="">Year</option>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}

// Days × time-of-day grid; a filled cell = that window is selected
function AvailabilityGrid({ selected, onToggle }: { selected: string[]; onToggle: (w: string) => void }) {
  const full = selected.filter((s) => s !== FLEXIBLE).length >= MAX_WINDOWS;
  return (
    <div className="rounded-2xl border border-gray-800 bg-[#0A0A0A] p-3">
      <div className="grid grid-cols-[72px_repeat(3,1fr)] gap-2 items-center">
        <div />
        {TIMES.map(({ v, l, Icon }) => (
          <div key={v} className="flex flex-col items-center gap-1 text-[11px] font-medium text-gray-400 pb-1">
            <Icon className="w-4 h-4 text-[#D4AF37]" />{l}
          </div>
        ))}
        {DAYS.map((day) => (
          <div key={day.v} className="contents">
            <div className="text-sm font-semibold text-gray-200">{day.l}</div>
            {TIMES.map((t) => {
              const w = windowLabel(day.v, t.v);
              const on = selected.includes(w);
              return (
                <button
                  key={w}
                  onClick={() => onToggle(w)}
                  disabled={!on && full}
                  aria-label={w}
                  aria-pressed={on}
                  className={cn(
                    "h-12 rounded-xl border flex items-center justify-center transition-colors",
                    on ? "bg-[#D4AF37] border-[#D4AF37]" : "border-gray-800 hover:border-[#D4AF37]/60",
                    !on && full && "opacity-30 hover:border-gray-800 cursor-not-allowed",
                  )}
                >
                  {on && <Check className="w-4 h-4 text-black" />}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-gray-500 text-center mt-3">{selected.filter((s) => s !== FLEXIBLE).length}/{MAX_WINDOWS} selected</p>
    </div>
  );
}

function ActivityCard({ label, sub, img, on, disabled, onClick }: { label: string; sub?: string; img: string; on: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn("relative h-32 overflow-hidden rounded-2xl border-2 text-left transition-all", on ? "border-[#D4AF37] shadow-[0_0_0_3px_rgba(212,175,55,0.25)]" : "border-transparent", disabled && "opacity-35 cursor-not-allowed")}
    >
      <img src={img} alt="" className="absolute inset-0 w-full h-full object-cover" loading="eager" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
      <span className="absolute left-3 right-3 bottom-2.5 drop-shadow">
        <span className="block text-white text-[15px] font-bold leading-tight">{label}</span>
        {sub && <span className="block text-[11px] text-gray-300 leading-tight mt-0.5">{sub}</span>}
      </span>
      <span className={cn("absolute top-2.5 right-2.5 w-6 h-6 rounded-full border-2 flex items-center justify-center", on ? "bg-[#D4AF37] border-[#D4AF37]" : "border-white/70 bg-black/30")}>
        {on && <Check className="w-3.5 h-3.5 text-black" />}
      </span>
    </button>
  );
}
