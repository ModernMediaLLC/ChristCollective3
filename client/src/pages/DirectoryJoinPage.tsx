import { useState } from "react";
import { useLocation } from "wouter";
import { Helmet } from "react-helmet";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { buildApiUrl, getMobileAuthHeaders } from "@/lib/api-config";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, ChevronLeft, Camera, MapPin, Briefcase, Church } from "lucide-react";
import { trackMetaEvent } from "@/lib/metaPixel";
import { INDUSTRIES, DENOMINATIONS } from "@/lib/directoryOptions";

// Signup funnel for the business & ministry directories — same look/flow as /join,
// but it creates a business_profiles / ministry_profiles row instead of a founding signup.
type Kind = "business" | "ministry";

const COPY = {
  business: {
    title: "List your business — Christ Collective",
    noun: "business",
    Icon: Briefcase,
    headline: "Get your business in the directory",
    pitch: "Christ Collective is building a directory of Christian-owned businesses so our community can find, hire and support each other.",
    detail: "We're adding our first founding businesses now. Listing is free — it takes about 2 minutes.",
    nameQ: "What's your business called?",
    namePh: "Business name",
    categoryQ: "What industry are you in?",
    categorySub: "This is how people will find you in the directory.",
    aboutQ: "What does your business do?",
    aboutPh: "e.g. Family-owned coffee roaster in Pasadena. We roast small-batch beans and cater church and community events.",
    goalsPh: "e.g. Looking for a videographer, and open to partnering with local churches.",
    done: "Your business is now in the Christ Collective directory. Share it with your customers so they can find you here.",
    directory: "/business",
  },
  ministry: {
    title: "List your ministry — Christ Collective",
    noun: "ministry",
    Icon: Church,
    headline: "Get your ministry in the directory",
    pitch: "Christ Collective is building a directory of churches and ministries so believers can find a place to serve, give and belong.",
    detail: "We're adding our first founding ministries now. Listing is free — it takes about 2 minutes.",
    nameQ: "What's your ministry called?",
    namePh: "Church or ministry name",
    categoryQ: "What's your denomination?",
    categorySub: "Helps people find a ministry that fits them.",
    aboutQ: "Tell people about your ministry",
    aboutPh: "e.g. A young-adult church in Echo Park. Sunday gatherings at 10am, Wednesday small groups, monthly outreach on Skid Row.",
    goalsPh: "",
    done: "Thanks! Our team reviews every ministry before it goes live — we'll let you know as soon as yours is published.",
    directory: "/ministries",
  },
} as const;

const ORDER = ["intro", "register", "name", "category", "location", "about", "contact", "logo", "done"] as const;
type Phase = (typeof ORDER)[number];
const ABOUT_MAX = 500;

// apiRequest errors look like `400: {"message":"..."}` — pull out just the message
function readableError(raw?: string): string {
  const body = (raw || "").replace(/^\d{3}:\s*/, "");
  try { return JSON.parse(body).message || body; } catch { return body; }
}

// "mysite.com" → "https://mysite.com" (server validates website as a full URL)
const toUrl = (s: string) => (!s.trim() ? "" : /^https?:\/\//i.test(s.trim()) ? s.trim() : `https://${s.trim()}`);

export default function DirectoryJoinPage({ kind }: { kind: Kind }) {
  const c = COPY[kind];
  const { user, registerMutation, loginMutation } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // ?preview=1 → walk the whole funnel without creating an account, saving anything, or firing pixel events
  const preview = new URLSearchParams(window.location.search).has("preview");
  const loggedIn = !!user?.id;

  const [phase, setPhase] = useState<Phase>("intro");
  const [authMode, setAuthMode] = useState<"register" | "login">("register");
  const [saving, setSaving] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [form, setForm] = useState({
    firstName: "", email: "", phone: "", password: "",
    name: "", category: "", location: "", address: "",
    description: "", goals: "",
    contactEmail: (user as any)?.email || "", contactPhone: (user as any)?.phone || "", website: "", instagram: "",
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const [logo, setLogo] = useState({ file: null as File | null, url: "" });

  const advance = (p: Phase, dir: 1 | -1 = 1) => {
    let i = ORDER.indexOf(p) + dir;
    while (ORDER[i] === "register" && loggedIn) i += dir;
    return ORDER[Math.max(0, Math.min(ORDER.length - 1, i))];
  };
  const next = () => setPhase((p) => advance(p, 1));
  const back = () => setPhase((p) => advance(p, -1));

  // After signing up, prefill the listing's contact details from the account
  const afterAuth = () => {
    setForm((f) => ({ ...f, contactEmail: f.contactEmail || (f.email.includes("@") ? f.email : ""), contactPhone: f.contactPhone || f.phone }));
    setPhase("name");
  };

  const doRegister = async () => {
    if (preview) return afterAuth();
    setSaving(true);
    const base = (form.firstName || form.email.split("@")[0] || "member").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) || "member";
    for (let attempt = 0; attempt < 3; attempt++) {
      const username = base + Math.floor(1000 + Math.random() * 89999);
      try {
        const res: any = await registerMutation.mutateAsync({ username, email: form.email, password: form.password, firstName: form.firstName, phone: form.phone } as any);
        if (res?.id) { trackMetaEvent("CompleteRegistration", { content_category: kind }); setSaving(false); afterAuth(); return; }
        if (res?.requiresLogin) { setSaving(false); toast({ title: "Account created", description: "Please sign in to continue." }); navigate(`/auth?redirect=/join/${kind}`); return; }
      } catch (e: any) {
        if (/username/i.test(e?.message || "") && attempt < 2) continue; // taken → retry new username
        setSaving(false);
        if (/email already exists/i.test(e?.message || "")) {
          setAuthMode("login");
          toast({ title: "You already have an account", description: "Log in with your password to continue." });
          return;
        }
        toast({ title: "Couldn't create account", description: readableError(e?.message) || "Try again.", variant: "destructive" });
        return;
      }
    }
    setSaving(false);
  };

  const doLogin = async () => {
    if (preview) return afterAuth();
    setSaving(true);
    try {
      await loginMutation.mutateAsync({ usernameOrEmail: form.email, password: form.password });
      afterAuth();
    } catch {
      /* loginMutation.onError shows the toast */
    } finally { setSaving(false); }
  };

  // Creates the directory listing; the logo step afterwards is optional
  const submit = async () => {
    if (preview) return setPhase("logo");
    setSaving(true);
    const shared = {
      description: form.description.trim(),
      location: form.location.trim(),
      email: form.contactEmail.trim() || undefined,
      phone: form.contactPhone.trim() || undefined,
      website: toUrl(form.website) || undefined,
    };
    try {
      const res = kind === "business"
        ? await apiRequest("/api/business-profiles", { method: "POST", data: {
            ...shared,
            companyName: form.name.trim(),
            businessName: form.name.trim(), // name the create validator expects
            industry: form.category,
            networkingGoals: form.goals.trim() || undefined,
          }})
        : await apiRequest("/api/ministries", { method: "POST", data: {
            ...shared,
            name: form.name.trim(),
            denomination: form.category,
            address: form.address.trim() || undefined,
            ...(form.instagram.trim() && { socialLinks: { instagram: `https://instagram.com/${form.instagram.trim()}` } }),
          }});
      const created = await res.json();
      setCreatedId(created?.id ?? null);
      trackMetaEvent("SubmitApplication", { content_category: kind });
      queryClient.invalidateQueries({ queryKey: kind === "business" ? ["/api/business-profiles"] : ["/api/ministries"] });
      if (kind === "ministry") queryClient.invalidateQueries({ queryKey: ["/api/user/ministry-profile"] });
      setPhase("logo");
    } catch (e: any) {
      const msg = readableError(e?.message);
      if (/already has a/i.test(msg)) {
        toast({ title: `You already have a ${c.noun} profile`, description: "You can edit it from your profile." });
        navigate(kind === "business" ? "/edit-profile" : "/edit-ministry-profile");
        return;
      }
      toast({ title: "Something went wrong", description: msg || "Please try again.", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const pickLogo = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast({ title: "Please choose an image", variant: "destructive" });
    setLogo({ file, url: URL.createObjectURL(file) });
  };

  const saveLogo = async () => {
    if (preview || !logo.file) return setPhase("done");
    setSaving(true);
    try {
      const fd = new FormData();
      if (kind === "business") {
        fd.append("logo", logo.file);
        const r = await fetch(buildApiUrl("/api/upload/business-logo"), { method: "POST", credentials: "include", headers: getMobileAuthHeaders(), body: fd });
        if (!r.ok) throw new Error();
      } else {
        fd.append("file", logo.file);
        const r = await fetch(buildApiUrl("/api/upload"), { method: "POST", credentials: "include", headers: getMobileAuthHeaders(), body: fd });
        if (!r.ok || !createdId) throw new Error();
        const { url } = await r.json();
        await apiRequest(`/api/ministries/${createdId}`, { method: "PUT", data: { logo: url } });
      }
      setPhase("done");
    } catch {
      toast({ title: "Couldn't upload your logo", description: "Try a smaller image, or skip for now.", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const visibleSteps = ORDER.filter((s) => s !== "register" || !loggedIn);
  const pct = Math.round((visibleSteps.indexOf(phase) / (visibleSteps.length - 1)) * 100);

  const canNext =
    phase === "register" ? (authMode === "login"
      ? form.email.trim().length > 0 && form.password.length >= 1
      : form.email.includes("@") && form.password.length >= 6 && !!form.firstName && form.phone.trim().length >= 7) :
    phase === "name" ? form.name.trim().length >= 2 :
    phase === "category" ? !!form.category :
    phase === "location" ? form.location.trim().length >= 2 :
    phase === "about" ? form.description.trim().length >= 20 :
    phase === "contact" ? form.contactEmail.includes("@") : true;

  const field = "bg-[#0A0A0A] border-gray-800 text-white h-12";
  const textarea = "w-full rounded-md bg-[#0A0A0A] border border-gray-800 text-white text-[15px] p-3 placeholder:text-gray-600 focus:outline-none focus:border-[#D4AF37] resize-none";
  const label = "block text-sm font-semibold text-gray-200 mb-1.5";
  const optional = <span className="text-gray-500 font-normal">(optional)</span>;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <Helmet><title>{c.title}</title></Helmet>
      {preview && (
        <div className="bg-[#D4AF37] text-black text-center text-xs font-semibold py-1.5">Preview mode — nothing is saved, no account is created</div>
      )}

      {phase !== "done" && (
        <div className="px-5 pt-6 pb-2">
          {phase !== "intro" && phase !== "logo" ? (
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
            <h1 className="text-3xl font-extrabold tracking-tight mb-3">{c.headline}</h1>
            <p className="text-white text-[15px] leading-relaxed mb-3">{c.pitch}</p>
            <p className="text-gray-300 text-[15px] leading-relaxed mb-3">{c.detail}</p>
            <p className="text-gray-400 text-[14px] leading-relaxed">
              Just want to meet people? <button onClick={() => navigate("/join")} className="text-[#D4AF37] hover:underline">Join as a member instead →</button>
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
            <p className="text-gray-400 text-sm mb-5">{authMode === "login" ? "Log in to continue." : `You'll manage your ${c.noun} listing from this account.`}</p>
            <div className="space-y-3">
              {authMode === "register" && <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder="Your first name" className={field} />}
              <Input value={form.email} onChange={(e) => set("email", e.target.value)} type={authMode === "login" ? "text" : "email"} placeholder={authMode === "login" ? "Email or username" : "Email"} className={field} />
              {authMode === "register" && <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} type="tel" placeholder="Phone" className={field} />}
              <Input value={form.password} onChange={(e) => set("password", e.target.value)} type="password" placeholder={authMode === "login" ? "Password" : "Password (6+ characters)"} className={field} />
            </div>
            <div className="mt-6 pt-4 border-t border-gray-900 text-center">
              <button onClick={() => setAuthMode((m) => (m === "login" ? "register" : "login"))} className="text-sm text-gray-400 hover:text-white">
                {authMode === "login" ? "New here? " : "Already have an account? "}
                <span className="text-[#D4AF37] font-semibold underline">{authMode === "login" ? "Create an account" : "Log in"}</span>
              </button>
            </div>
          </div>
        )}

        {phase === "name" && (
          <div>
            <div className="flex items-center gap-2 mb-1"><c.Icon className="w-5 h-5 text-[#D4AF37]" /><h1 className="text-2xl font-extrabold tracking-tight">{c.nameQ}</h1></div>
            <p className="text-gray-400 text-sm mb-5">This is the name shown in the directory.</p>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={c.namePh} className={field} autoFocus />
          </div>
        )}

        {phase === "category" && (
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight mb-1">{c.categoryQ}</h1>
            <p className="text-gray-400 text-sm mb-5">{c.categorySub}</p>
            <div className="flex flex-wrap gap-2.5">
              {(kind === "business" ? INDUSTRIES.map((i) => ({ v: i, l: i })) : DENOMINATIONS).map(({ v, l }) => (
                <button key={v} onClick={() => set("category", form.category === v ? "" : v)} className={cn("px-4 py-2.5 rounded-full text-sm font-medium border transition-colors", form.category === v ? "bg-[#D4AF37] text-black border-transparent" : "bg-transparent border-gray-700 text-gray-300 hover:border-[#D4AF37]")}>{l}</button>
              ))}
            </div>
          </div>
        )}

        {phase === "location" && (
          <div>
            <div className="flex items-center gap-2 mb-1"><MapPin className="w-5 h-5 text-[#D4AF37]" /><h1 className="text-2xl font-extrabold tracking-tight">Where are you located?</h1></div>
            <p className="text-gray-400 text-sm mb-5">{kind === "business" ? "City and state. Online-only? Put where you're based." : "City and state, plus your address so people can visit."}</p>
            <div className="space-y-3">
              <Input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="City, State (e.g. Pasadena, CA)" className={field} />
              {kind === "ministry" && (
                <Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Street address (optional)" className={field} />
              )}
            </div>
          </div>
        )}

        {phase === "about" && (
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight mb-1">{c.aboutQ}</h1>
            <p className="text-gray-400 text-sm mb-5">A few sentences is perfect — this shows on your directory card.</p>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value.slice(0, ABOUT_MAX))} rows={5} placeholder={c.aboutPh} className={textarea} />
            <p className="text-right text-[11px] text-gray-600 mb-4">{form.description.length}/{ABOUT_MAX}</p>
            {kind === "business" && (
              <>
                <label className={label}>Who would you like to connect with? {optional}</label>
                <textarea value={form.goals} onChange={(e) => set("goals", e.target.value.slice(0, 300))} rows={3} placeholder={c.goalsPh} className={textarea} />
              </>
            )}
          </div>
        )}

        {phase === "contact" && (
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight mb-1">How can people reach you?</h1>
            <p className="text-gray-400 text-sm mb-5">Shown on your {c.noun}'s page so the community can get in touch.</p>
            <div className="space-y-4">
              <div><label className={label}>Email</label><Input value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} type="email" placeholder={`${c.noun}@example.com`} className={field} /></div>
              <div><label className={label}>Phone {optional}</label><Input value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} type="tel" placeholder="(555) 555-5555" className={field} /></div>
              <div><label className={label}>Website {optional}</label><Input value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="yourwebsite.com" autoCapitalize="none" className={field} /></div>
              {kind === "ministry" && (
                <div>
                  <label className={label}>Instagram {optional}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">@</span>
                    <Input value={form.instagram} onChange={(e) => set("instagram", e.target.value.replace(/^@/, ""))} placeholder="yourministry" autoCapitalize="none" className={cn(field, "pl-8")} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {phase === "logo" && (
          <div>
            <p className="text-[#D4AF37] text-xs font-bold uppercase tracking-widest mb-2">✓ You're listed — one last touch</p>
            <h1 className="text-2xl font-extrabold tracking-tight mb-1">Add your logo</h1>
            <p className="text-gray-400 text-sm mb-6">Listings with a logo get noticed. You can change it anytime.</p>
            <label className="flex items-center gap-4 cursor-pointer group">
              <span className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-dashed border-gray-700 group-hover:border-[#D4AF37] flex items-center justify-center bg-[#0A0A0A] flex-shrink-0">
                {logo.url ? <img src={logo.url} alt="" className="w-full h-full object-cover" /> : <Camera className="w-7 h-7 text-gray-500 group-hover:text-[#D4AF37]" />}
              </span>
              <span>
                <span className="block text-white font-semibold text-[15px]">{logo.url ? "Change logo" : "Upload a logo"}</span>
                <span className="block text-gray-500 text-xs mt-0.5">Square images work best</span>
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => pickLogo(e.target.files?.[0])} />
            </label>
          </div>
        )}

        {phase === "done" && (
          <div className="text-center py-10">
            <div className="w-16 h-16 rounded-2xl bg-[#D4AF37] mx-auto mb-5 flex items-center justify-center"><Check className="w-8 h-8 text-black" /></div>
            <h1 className="text-2xl font-extrabold tracking-tight mb-3">{kind === "business" ? "You're in the directory! 🎉" : "Submitted! 🙏"}</h1>
            <p className="text-gray-300 text-[15px] leading-relaxed mb-6">{c.done}</p>
            <Button onClick={() => navigate(c.directory)} className="w-full h-12 bg-[#D4AF37] hover:bg-[#C4A030] text-black font-bold mb-3">View the directory</Button>
            <Button onClick={() => navigate("/join")} variant="outline" className="w-full h-12 bg-transparent border-gray-700 text-white hover:bg-white/5">Join a local circle too</Button>
          </div>
        )}
      </div>

      {phase !== "done" && (
        <div className="sticky bottom-0 bg-black/90 backdrop-blur border-t border-gray-900 px-5 py-4">
          <div className="max-w-md mx-auto">
            <Button
              onClick={() => {
                if (phase === "register") return authMode === "login" ? doLogin() : doRegister();
                if (phase === "contact") return submit();
                if (phase === "logo") return saveLogo();
                next();
              }}
              disabled={!canNext || saving}
              className="w-full h-12 bg-[#D4AF37] hover:bg-[#C4A030] text-black font-bold disabled:opacity-40"
            >
              {saving ? "Saving…" : phase === "intro" ? "Get started" : phase === "register" && authMode === "login" ? "Log in & continue" : phase === "contact" ? `List my ${c.noun}` : phase === "logo" ? (logo.file ? "Save & finish" : "Skip for now") : "Continue"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
