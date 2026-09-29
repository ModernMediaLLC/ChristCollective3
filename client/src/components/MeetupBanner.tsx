import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { getImageUrl } from "@/lib/api-config";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Coffee, ChevronRight, MapPin, CalendarClock, Users, Check } from "lucide-react";

const ACTIVITY_LABEL: Record<string, string> = {
  coffee: "Coffee", hiking: "Hiking", hike: "Hiking", run: "Run", running: "Run", book: "Book Club",
  create: "Create Together", serve: "Serve Together", open: "Meetup",
};
const prettyActivity = (a?: string | null) => (a ? (ACTIVITY_LABEL[a.toLowerCase()] || a.charAt(0).toUpperCase() + a.slice(1)) : "Meetup");
const memberName = (m: any) => m?.displayName || [m?.firstName, m?.lastName].filter(Boolean).join(" ") || m?.username || "Member";
const isUpcoming = (c: any) => c.status !== "completed";

export function MeetupBanner() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);

  const { data } = useQuery<{ matchupRequest: any; circles: any[]; waitlisted?: boolean }>({
    queryKey: ["/api/user/meetups"],
    enabled: !!user?.id,
  });

  if (!user?.id) return null;

  const circles = data?.circles || [];
  const optedIn = !!data?.matchupRequest;
  const waitlisted = !!data?.waitlisted;

  // ── State A: never opted in ──
  if (circles.length === 0 && !optedIn) {
    return (
      <button
        onClick={() => navigate("/matchups")}
        className="w-full text-left rounded-2xl border border-[#D4AF37]/30 bg-gradient-to-br from-[#1a1506] to-[#0A0A0A] p-4 flex items-center gap-3 hover:border-[#D4AF37]/50 transition-colors"
      >
        <div className="w-11 h-11 rounded-full bg-[#D4AF37]/15 flex items-center justify-center shrink-0">
          <Coffee className="w-5 h-5 text-[#D4AF37]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">Meet your creative circle</p>
          <p className="text-gray-400 text-xs">Opt in and we'll match you with creatives near you.</p>
        </div>
        <span className="text-xs font-semibold bg-[#D4AF37] text-black rounded-full px-3 py-1.5 shrink-0">Opt in</span>
      </button>
    );
  }

  // ── State B: opted in, not yet placed in a circle ──
  if (circles.length === 0 && optedIn) {
    const req = data!.matchupRequest || {};
    return (
      <button
        onClick={() => navigate("/matchups")}
        className="w-full text-left rounded-2xl border border-[#D4AF37]/30 bg-gradient-to-br from-[#1a1506] to-[#0A0A0A] p-4 flex items-center gap-3 hover:border-[#D4AF37]/50 transition-colors"
      >
        <div className="w-11 h-11 rounded-full bg-[#D4AF37]/15 flex items-center justify-center shrink-0">
          <Check className="w-5 h-5 text-[#D4AF37]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">{waitlisted ? "You're on the waitlist" : "You're on the list ✓"}</p>
          <p className="text-gray-400 text-xs truncate">
            {waitlisted
              ? "We're launching in LA first — we'll reach out when we're in your area."
              : `We'll text you when your ${req.activity ? prettyActivity(req.activity).toLowerCase() + " " : ""}circle is ready. Tap to change.`}
          </p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-500 shrink-0" />
      </button>
    );
  }

  // ── State C: has meetups ── show the most relevant (upcoming first, else most recent)
  const relevant = circles.find(isUpcoming) || circles[0];
  const upcoming = isUpcoming(relevant);
  const others = (relevant.members || []).filter((m: any) => m.id !== user.id);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full text-left rounded-2xl border border-[#D4AF37]/30 bg-gradient-to-br from-[#1a1506] to-[#0A0A0A] p-4 flex items-center gap-3 hover:border-[#D4AF37]/50 transition-colors"
      >
        <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#D4AF37]/15 flex items-center justify-center shrink-0">
          {relevant.venue?.imageUrl
            ? <img src={relevant.venue.imageUrl} referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            : <Coffee className="w-5 h-5 text-[#D4AF37]" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#D4AF37]">{upcoming ? "Your next meetup" : "Your last meetup"}</p>
          <p className="text-white font-semibold text-sm truncate">
            {prettyActivity(relevant.activity)}{relevant.slot ? ` · ${relevant.slot}` : ""}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex -space-x-2">
              {others.slice(0, 5).map((m: any) => (
                <Avatar key={m.id} className="w-6 h-6 border-2 border-[#0A0A0A]">
                  <AvatarImage src={getImageUrl(m.profileImageUrl)} />
                  <AvatarFallback className="bg-gray-800 text-[9px]">{memberName(m)[0]}</AvatarFallback>
                </Avatar>
              ))}
              {others.length > 5 && <span className="w-6 h-6 rounded-full bg-gray-800 border-2 border-[#0A0A0A] flex items-center justify-center text-[9px] text-white">+{others.length - 5}</span>}
            </div>
            <span className="text-xs text-gray-500 truncate">{relevant.venue?.name || `${others.length} ${others.length === 1 ? "person" : "people"}`}</span>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-500 shrink-0" />
      </button>

      <MeetupsDialog open={open} onOpenChange={setOpen} circles={circles} selfId={user.id} navigate={navigate} />
    </>
  );
}

function MeetupsDialog({ open, onOpenChange, circles, selfId, navigate }: { open: boolean; onOpenChange: (v: boolean) => void; circles: any[]; selfId: string; navigate: (to: string) => void }) {
  const upcoming = circles.filter(isUpcoming);
  const past = circles.filter((c) => !isUpcoming(c));

  // Everyone you've met, deduped across all circles.
  const peopleMap = new Map<string, any>();
  for (const c of circles) for (const m of c.members || []) if (m.id !== selfId && !peopleMap.has(m.id)) peopleMap.set(m.id, m);
  const people = Array.from(peopleMap.values());

  const goProfile = (m: any) => { if (m.username) { onOpenChange(false); navigate(`/profile/${m.username}`); } };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0A0A0A] border-gray-800 text-white max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Your Meetups</DialogTitle></DialogHeader>

        {upcoming.length > 0 && (
          <div className="mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#D4AF37] mb-2 flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5" /> Upcoming</p>
            <div className="space-y-2">{upcoming.map((c) => <MeetupRow key={c.id} c={c} selfId={selfId} onMember={goProfile} />)}</div>
          </div>
        )}

        {past.length > 0 && (
          <div className="mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Past meetups</p>
            <div className="space-y-2">{past.map((c) => <MeetupRow key={c.id} c={c} selfId={selfId} onMember={goProfile} />)}</div>
          </div>
        )}

        {people.length > 0 && (
          <div className="mt-2 pt-3 border-t border-gray-800/60">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> People you've met</p>
            <div className="grid grid-cols-1 gap-1.5">
              {people.map((m) => (
                <button key={m.id} onClick={() => goProfile(m)} className="flex items-center gap-2.5 text-left hover:bg-white/[0.04] rounded-lg p-1.5">
                  <Avatar className="w-8 h-8"><AvatarImage src={getImageUrl(m.profileImageUrl)} /><AvatarFallback className="bg-gray-800 text-xs">{memberName(m)[0]}</AvatarFallback></Avatar>
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{memberName(m)}</p>
                    {(m.city || (Array.isArray(m.disciplines) && m.disciplines.length)) && (
                      <p className="text-[11px] text-gray-500 truncate">{[m.city, Array.isArray(m.disciplines) ? m.disciplines[0] : null].filter(Boolean).join(" · ")}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <Button onClick={() => { onOpenChange(false); navigate("/matchups"); }} className="w-full mt-3 bg-[#D4AF37] text-black hover:bg-[#C4A030] font-semibold">
          Opt in for the next meetup
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function MeetupRow({ c, selfId, onMember }: { c: any; selfId: string; onMember: (m: any) => void }) {
  const others = (c.members || []).filter((m: any) => m.id !== selfId);
  return (
    <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 p-3">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p className="text-sm font-semibold text-white">{prettyActivity(c.activity)}{c.slot ? ` · ${c.slot}` : ""}</p>
        {c.status && c.status !== "draft" && <span className="text-[10px] text-gray-500 capitalize">{c.status}</span>}
      </div>
      {c.venue?.name && <p className="text-xs text-gray-400 flex items-center gap-1 mb-2"><MapPin className="w-3 h-3 text-[#D4AF37]" />{c.venue.name}</p>}
      <div className="flex flex-wrap gap-2">
        {others.map((m: any) => (
          <button key={m.id} onClick={() => onMember(m)} className="flex items-center gap-1.5 bg-gray-800/60 rounded-full pl-1 pr-2.5 py-1 hover:bg-gray-800">
            <Avatar className="w-5 h-5"><AvatarImage src={getImageUrl(m.profileImageUrl)} /><AvatarFallback className="bg-gray-700 text-[8px]">{memberName(m)[0]}</AvatarFallback></Avatar>
            <span className="text-[11px] text-gray-200">{memberName(m)}</span>
          </button>
        ))}
        {others.length === 0 && <span className="text-xs text-gray-600">Your circle is forming…</span>}
      </div>
    </div>
  );
}
