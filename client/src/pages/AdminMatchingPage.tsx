import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getImageUrl } from "@/lib/api-config";
import { ageFrom } from "@/lib/utils";
import { ArrowLeft, Sparkles, Plus, Trash2, X, Shield, Wand2, Users } from "lucide-react";

const name = (m: any) => m?.displayName || [m?.firstName, m?.lastName].filter(Boolean).join(" ") || m?.username || "Member";
const CIRCLE_STATUS = ["draft", "confirmed", "sent", "completed"];

// "ages 24–31" across a circle's members (skips anyone without a birthdate)
const ageRange = (members: any[]) => {
  const ages = members.map((m) => ageFrom(m.birthdate)).filter((a): a is number => a !== null);
  if (!ages.length) return null;
  const lo = Math.min(...ages), hi = Math.max(...ages);
  return lo === hi ? `age ${lo}` : `ages ${lo}–${hi}`;
};

export default function AdminMatchingPage() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [cycle, setCycle] = useState("current");
  const [targetSize, setTargetSize] = useState(6);

  const enabled = user?.isAdmin === true;
  const { data: leads = [] } = useQuery<any[]>({ queryKey: ["/api/admin/leads"], enabled });
  const { data: circles = [], isLoading: circlesLoading } = useQuery<any[]>({ queryKey: [`/api/admin/match-circles?cycle=${cycle}`], enabled });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/admin/match-circles?cycle=${cycle}`] });
  };

  const autoGroup = useMutation({
    mutationFn: async () => apiRequest("/api/admin/matching/auto-group", { method: "POST", data: { cycle, targetSize } }),
    onSuccess: async (r: any) => { const j = await r.json().catch(() => ({})); toast({ title: "Auto-grouped", description: `Created ${j.created ?? 0} circles from matchup requests.` }); invalidate(); },
    onError: () => toast({ title: "Couldn't auto-group", variant: "destructive" }),
  });
  const newCircle = useMutation({
    mutationFn: async () => apiRequest("/api/admin/match-circles", { method: "POST", data: { name: `New circle`, cycle, area: "westside" } }),
    onSuccess: () => { toast({ title: "Circle added" }); invalidate(); },
  });
  const updateCircle = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => apiRequest(`/api/admin/match-circles/${id}`, { method: "PATCH", data }),
    onSuccess: invalidate,
  });
  const deleteCircle = useMutation({
    mutationFn: async (id: number) => apiRequest(`/api/admin/match-circles/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "Circle deleted" }); invalidate(); },
  });
  const assign = useMutation({
    mutationFn: async ({ circleId, userId }: { circleId: number; userId: string }) => apiRequest(`/api/admin/match-circles/${circleId}/members`, { method: "POST", data: { userId } }),
    onSuccess: invalidate,
  });
  const unassign = useMutation({
    mutationFn: async ({ circleId, userId }: { circleId: number; userId: string }) => apiRequest(`/api/admin/match-circles/${circleId}/members/${userId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  if (isLoading) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-[#D4AF37] border-t-transparent rounded-full" /></div>;
  if (!user?.isAdmin) return <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center"><Shield className="h-10 w-10 text-[#D4AF37] mb-3" /><p className="text-gray-400">Admin access required.</p></div>;

  const memberToCircle: Record<string, number> = {};
  circles.forEach((c) => (c.members || []).forEach((m: any) => (memberToCircle[m.id] = c.id)));
  const unassigned = leads.filter((l) => !memberToCircle[l.id]);

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <header className="sticky top-0 z-30 bg-[#0A0A0A]/90 backdrop-blur border-b border-gray-800/60 px-5 py-4 flex items-center gap-3">
        <Link href="/admin"><button className="text-gray-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></button></Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Matching CRM</h1>
          <p className="text-xs text-gray-500">{leads.length} leads · {circles.length} circles · cycle "{cycle}"</p>
        </div>
      </header>

      {/* Toolbar */}
      <div className="px-5 py-4 border-b border-gray-900 flex flex-wrap items-end gap-3">
        <div><label className="text-[11px] text-gray-500 block mb-1">Cycle</label><Input value={cycle} onChange={(e) => setCycle(e.target.value)} className="h-9 w-32 bg-gray-900 border-gray-800 text-white" /></div>
        <div><label className="text-[11px] text-gray-500 block mb-1">Circle size</label><Input type="number" value={targetSize} onChange={(e) => setTargetSize(Math.max(2, parseInt(e.target.value) || 6))} className="h-9 w-20 bg-gray-900 border-gray-800 text-white" /></div>
        <Button onClick={() => autoGroup.mutate()} disabled={autoGroup.isPending} className="h-9 bg-[#D4AF37] text-black hover:bg-[#C4A030] font-semibold"><Wand2 className="w-4 h-4 mr-1.5" />{autoGroup.isPending ? "Grouping…" : "Auto-group"}</Button>
        <Button onClick={() => newCircle.mutate()} variant="outline" className="h-9 border-gray-700 text-white"><Plus className="w-4 h-4 mr-1.5" /> New circle</Button>
      </div>

      <div className="px-5 py-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Unassigned pool */}
        <div className="lg:col-span-1">
          <h2 className="font-bold mb-2 flex items-center gap-2"><Users className="w-4 h-4 text-[#D4AF37]" /> Unassigned <span className="text-xs text-gray-600">{unassigned.length}</span></h2>
          <p className="text-xs text-gray-600 mb-3">Auto-group uses each lead's Matchup request (activity + time). Then move anyone into the right circle.</p>
          <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {unassigned.length === 0 && <p className="text-gray-600 text-sm">Everyone's placed 🎉</p>}
            {unassigned.map((l) => (
              <LeadCard key={l.id} lead={l} circles={circles} onAssign={(circleId) => assign.mutate({ circleId, userId: l.id })} />
            ))}
          </div>
        </div>

        {/* Circles / buckets */}
        <div className="lg:col-span-2">
          <h2 className="font-bold mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-[#D4AF37]" /> Circles</h2>
          {circlesLoading ? <p className="text-gray-500 text-sm">Loading…</p> :
           circles.length === 0 ? <div className="rounded-xl border border-dashed border-gray-800 p-8 text-center text-gray-500 text-sm">No circles yet. Hit <span className="text-[#D4AF37]">Auto-group</span> to build them from matchup requests, or add one manually.</div> :
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {circles.map((c) => (
               <div key={c.id} className="rounded-xl border border-gray-800/60 bg-[#0A0A0A] p-4">
                 <div className="flex items-start justify-between gap-2 mb-2">
                   <input defaultValue={c.name} onBlur={(e) => e.target.value !== c.name && updateCircle.mutate({ id: c.id, data: { name: e.target.value } })} className="bg-transparent font-semibold text-white text-sm w-full focus:outline-none focus:border-b focus:border-gray-700" />
                   <button onClick={() => { if (confirm("Delete this circle?")) deleteCircle.mutate(c.id); }} className="text-gray-600 hover:text-red-400 shrink-0"><Trash2 className="w-4 h-4" /></button>
                 </div>
                 <div className="flex items-center gap-2 mb-3">
                   {c.activity && <Badge className="bg-blue-500/10 text-blue-300 border border-blue-500/20 text-[10px]">{c.activity}</Badge>}
                   {c.slot && <Badge variant="outline" className="text-[10px] border-gray-700 text-gray-400">{c.slot}</Badge>}
                   <select value={c.status} onChange={(e) => updateCircle.mutate({ id: c.id, data: { status: e.target.value } })} className="ml-auto bg-gray-900 border border-gray-800 rounded text-[11px] px-2 py-1 text-gray-300">
                     {CIRCLE_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                   </select>
                 </div>
                 <div className="space-y-1.5">
                   {(c.members || []).length === 0 && <p className="text-xs text-gray-600">Empty — assign leads from the left.</p>}
                   {(c.members || []).map((m: any) => (
                     <div key={m.id} className="flex items-center gap-2 bg-gray-900/60 rounded-lg px-2 py-1.5">
                       <Avatar className="w-6 h-6"><AvatarImage src={getImageUrl(m.profileImageUrl)} /><AvatarFallback className="bg-gray-800 text-[9px]">{name(m)[0]}</AvatarFallback></Avatar>
                       <span className="text-xs text-white truncate flex-1">{name(m)}</span>
                       {ageFrom(m.birthdate) !== null && <span className="text-[10px] text-gray-400 shrink-0">{ageFrom(m.birthdate)}</span>}
                       {m.city && <span className="text-[10px] text-gray-500 truncate max-w-[70px]">{m.city}</span>}
                       <button onClick={() => unassign.mutate({ circleId: c.id, userId: m.id })} className="text-gray-600 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                     </div>
                   ))}
                 </div>
                 <p className="text-[10px] text-gray-600 mt-2">{[`${(c.members || []).length} member${(c.members || []).length === 1 ? "" : "s"}`, ageRange(c.members || [])].filter(Boolean).join(" · ")}</p>
               </div>
             ))}
           </div>}
        </div>
      </div>
    </div>
  );
}

function LeadCard({ lead, circles, onAssign }: { lead: any; circles: any[]; onAssign: (circleId: number) => void }) {
  const mr = lead.matchupRequest || {};
  const age = ageFrom(lead.birthdate);
  return (
    <div className="rounded-lg border border-gray-800/60 bg-[#0A0A0A] p-3">
      <div className="flex items-center gap-2">
        <Avatar className="w-8 h-8"><AvatarImage src={getImageUrl(lead.profileImageUrl)} /><AvatarFallback className="bg-gray-800 text-xs">{name(lead)[0]}</AvatarFallback></Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white truncate">{name(lead)}{age !== null && <span className="ml-1.5 text-xs font-normal text-gray-400">{age}</span>}</p>
          <p className="text-[11px] text-gray-500 truncate">{[lead.city, Array.isArray(lead.disciplines) ? lead.disciplines[0] : null].filter(Boolean).join(" · ") || "—"}</p>
        </div>
      </div>
      {(mr.activity || mr.slot) && (
        <div className="flex flex-wrap gap-1 mt-2">
          {(Array.isArray(mr.activities) && mr.activities.length ? mr.activities : mr.activity ? [mr.activity] : []).map((a: string) => (
            <Badge key={a} className="bg-blue-500/10 text-blue-300 border border-blue-500/20 text-[10px]">{a}</Badge>
          ))}
          {mr.slot && <Badge variant="outline" className="text-[10px] border-gray-700 text-gray-400">{mr.slot}</Badge>}
        </div>
      )}
      {circles.length > 0 && (
        <select
          defaultValue=""
          onChange={(e) => { if (e.target.value) onAssign(parseInt(e.target.value)); }}
          className="mt-2 w-full bg-gray-900 border border-gray-800 rounded text-[11px] px-2 py-1.5 text-gray-300"
        >
          <option value="">Assign to circle…</option>
          {circles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
    </div>
  );
}
