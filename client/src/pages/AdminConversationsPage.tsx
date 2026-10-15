import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ArrowLeft, Shield, RefreshCw, Send, Users, MessageSquare, MessagesSquare, AlertTriangle, ChevronLeft } from "lucide-react";

// Admin Conversations: member texts (Blooio) grouped by match circle. Polls go out one person at a
// time with {first_name} filled in; replies of 1 / 2 / EITHER are tallied per circle; once members are
// marked confirmed, the circle's group text can be started from here.

type Member = {
  id: string; name: string; firstName: string; city: string | null; chatId: string | null; smsOptIn: boolean; rsvp: string | null;
  lastMessage: { body: string; direction: string; status: string | null; sentAt: string } | null; needsReply: boolean; polled: boolean; vote: string | null; count: number;
};
type Circle = {
  id: number; name: string; cycle: string; status: string; slot: string | null; activity: string | null; notes: string | null;
  leaders: string | null; groupChatId: string | null; members: Member[]; tally: Record<string, number>; group: any; needsReply: number;
};
type Other = { chatId: string; name: string; lastMessage: { body: string; direction: string; sentAt: string }; needsReply: boolean };
type Data = { cycle: string; cycles: { cycle: string; circles: number }[]; circles: Circle[]; others: Other[] };
type Chat = { chatId: string; title: string; sub?: string; circleId?: number; blocked?: string };

const when = (d: string | Date) => new Date(d).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const VOTE: Record<string, string> = { "1": "Option 1", "2": "Option 2", either: "Either", stop: "Opted out" };
const RSVP: [string, string][] = [["", "RSVP —"], ["confirmed", "Confirmed"], ["declined", "Can't make it"], ["opted_out", "Opted out"]];
const errText = (e: any) => { const m = String(e?.message || e); try { return JSON.parse(m.slice(m.indexOf(":") + 1)).message || m; } catch { return m; } };

export default function AdminConversationsPage() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const enabled = user?.isAdmin === true;
  const [cycle, setCycle] = useState<string>("");
  const [sel, setSel] = useState<number | "others" | null>(null);
  const [chat, setChat] = useState<Chat | null>(null);
  const [pane, setPane] = useState<"groups" | "members" | "thread">("groups");
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);

  const convoKey = `/api/admin/conversations${cycle ? `?cycle=${encodeURIComponent(cycle)}` : ""}`;
  const { data: account } = useQuery<any>({ queryKey: ["/api/admin/texting/account"], enabled });
  const { data, isLoading: loading } = useQuery<Data>({ queryKey: [convoKey], enabled, refetchInterval: 30000 });
  const threadKey = chat ? `/api/admin/conversations/thread?chatId=${encodeURIComponent(chat.chatId)}` : "";
  const { data: thread = [] } = useQuery<any[]>({ queryKey: [threadKey], enabled: enabled && !!chat, refetchInterval: 15000 });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: [convoKey] });
    if (threadKey) queryClient.invalidateQueries({ queryKey: [threadKey] });
  };
  const sync = useMutation({
    mutationFn: async () => (await apiRequest("/api/admin/conversations/sync", { method: "POST", data: {} })).json(),
    onSuccess: refresh,
    onError: (e) => toast({ title: "Couldn't refresh from Blooio", description: errText(e), variant: "destructive" }),
  });
  // Pull replies when the page opens and every minute while it's open
  useEffect(() => {
    if (!enabled) return;
    sync.mutate();
    const t = setInterval(() => sync.mutate(), 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => { if (data && !cycle) setCycle(data.cycle); }, [data, cycle]);
  const circle = typeof sel === "number" ? data?.circles.find((c) => c.id === sel) || null : null;

  const updateCircle = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: any }) => apiRequest(`/api/admin/match-circles/${id}`, { method: "PATCH", data: patch }),
    onSuccess: refresh,
  });
  const setRsvp = useMutation({
    mutationFn: async ({ circleId, userId, rsvp }: { circleId: number; userId: string; rsvp: string | null }) =>
      apiRequest(`/api/admin/match-circles/${circleId}/members/${userId}/rsvp`, { method: "PATCH", data: { rsvp } }),
    onSuccess: refresh,
  });

  if (isLoading) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-[#D4AF37] border-t-transparent rounded-full" /></div>;
  if (!user?.isAdmin) return <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center"><Shield className="h-10 w-10 text-[#D4AF37] mb-3" /><p className="text-gray-400">Admin access required.</p></div>;

  const openChat = (c: Chat) => { setChat(c); setPane("thread"); };
  const totalNeedsReply = (data?.circles || []).reduce((n, c) => n + c.needsReply, 0) + (data?.others || []).filter((o) => o.needsReply).length;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="sticky top-0 z-30 bg-[#0A0A0A]/90 backdrop-blur border-b border-gray-800/60 px-5 py-4 flex items-center gap-3">
        <Link href="/admin"><button className="text-gray-400 hover:text-white" aria-label="Back to admin"><ArrowLeft className="w-5 h-5" /></button></Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold">Conversations</h1>
          <p className="text-xs text-gray-500 truncate">
            {account?.configured === false ? "Texting isn't set up: add BLOOIO_API_KEY on the server" :
              `Texts send from ${account?.number || "your Blooio number"}${totalNeedsReply ? ` · ${totalNeedsReply} waiting on a reply` : ""}`}
          </p>
        </div>
        {data && data.cycles.length > 0 && (
          <select value={cycle} onChange={(e) => { setCycle(e.target.value); setSel(null); setChat(null); setPane("groups"); }} className="bg-gray-900 border border-gray-800 rounded text-xs px-2 py-1.5 text-gray-300" aria-label="Cycle">
            {data.cycles.map((c) => <option key={c.cycle} value={c.cycle}>{c.cycle} ({c.circles})</option>)}
          </select>
        )}
        <Button onClick={() => sync.mutate()} disabled={sync.isPending} variant="outline" className="h-9 border-gray-700 text-white">
          <RefreshCw className={cn("w-4 h-4 md:mr-1.5", sync.isPending && "animate-spin")} /><span className="hidden md:inline">Refresh</span>
        </Button>
      </header>

      <div className="flex-1 grid md:grid-cols-[260px_340px_minmax(0,1fr)] min-h-0">
        {/* Groups */}
        <aside className={cn("border-r border-gray-900 overflow-y-auto md:block", pane === "groups" ? "block" : "hidden")}>
          <p className="px-4 pt-4 pb-2 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Circles</p>
          {loading && <p className="px-4 text-sm text-gray-500">Loading…</p>}
          {data?.circles.length === 0 && <p className="px-4 text-sm text-gray-500">No circles in this cycle. Build them in the <Link href="/admin/matching" className="text-[#D4AF37]">Matching CRM</Link>.</p>}
          {data?.circles.map((c) => {
            const replied = c.members.filter((m) => m.vote || m.rsvp).length;
            return (
              <button key={c.id} onClick={() => { setSel(c.id); setPane("members"); }} className={cn("w-full text-left px-4 py-3 border-b border-gray-900 hover:bg-gray-900/60", sel === c.id && "bg-gray-900")}>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm truncate flex-1">{c.name}</span>
                  {c.needsReply > 0 && <span className="text-[10px] font-bold bg-[#D4AF37] text-black rounded-full px-1.5">{c.needsReply}</span>}
                </div>
                <p className="text-[11px] text-gray-500 truncate">{[c.leaders, c.slot].filter(Boolean).join(" · ") || "No leaders or time set"}</p>
                <p className="text-[11px] text-gray-600">{c.members.length} members · {replied} replied{c.groupChatId ? " · group text started" : ""}</p>
              </button>
            );
          })}
          <button onClick={() => { setSel("others"); setPane("members"); }} className={cn("w-full text-left px-4 py-3 hover:bg-gray-900/60", sel === "others" && "bg-gray-900")}>
            <span className="font-semibold text-sm">Other conversations</span>
            <p className="text-[11px] text-gray-600">{data?.others.length ?? 0} outside these circles (tests, other cycles)</p>
          </button>
        </aside>

        {/* Members of the selected circle */}
        <section className={cn("border-r border-gray-900 overflow-y-auto md:block", pane === "members" ? "block" : "hidden")}>
          <button className="md:hidden flex items-center gap-1 text-xs text-gray-400 px-4 pt-3" onClick={() => setPane("groups")}><ChevronLeft className="w-4 h-4" />Circles</button>
          {!sel && <Empty icon={<Users className="w-6 h-6" />} text="Pick a circle to see its members and their texts." />}
          {sel === "others" && (
            <div>
              <p className="px-4 pt-4 pb-2 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Other conversations</p>
              {data?.others.length === 0 && <p className="px-4 text-sm text-gray-500">Nothing here yet.</p>}
              {data?.others.map((o) => (
                <Row key={o.chatId} title={o.name} sub={o.chatId} last={o.lastMessage} needsReply={o.needsReply} active={chat?.chatId === o.chatId}
                  onClick={() => openChat({ chatId: o.chatId, title: o.name, sub: o.chatId })} />
              ))}
            </div>
          )}
          {circle && (
            <div>
              <div className="px-4 pt-4 pb-3 border-b border-gray-900 space-y-2">
                <h2 className="font-bold">{circle.name}</h2>
                <label className="block">
                  <span className="text-[11px] text-gray-500">Leaders</span>
                  <Input key={`l-${circle.id}`} defaultValue={circle.leaders || ""} placeholder="e.g. Luis + EZ"
                    onBlur={(e) => e.target.value !== (circle.leaders || "") && updateCircle.mutate({ id: circle.id, patch: { leaders: e.target.value || null } })}
                    className="h-8 bg-gray-900 border-gray-800 text-white text-sm" />
                </label>
                <label className="block">
                  <span className="text-[11px] text-gray-500">When</span>
                  <Input key={`s-${circle.id}`} defaultValue={circle.slot || ""} placeholder="e.g. Fri Oct 23 or Tue Oct 27, 1:30pm"
                    onBlur={(e) => e.target.value !== (circle.slot || "") && updateCircle.mutate({ id: circle.id, patch: { slot: e.target.value || null } })}
                    className="h-8 bg-gray-900 border-gray-800 text-white text-sm" />
                </label>
                {circle.notes && <p className="text-[11px] text-gray-500">{circle.notes}</p>}
                {circle.members.some((m) => m.polled) && (
                  <div className="flex flex-wrap gap-1.5 pt-1" aria-label="Poll replies">
                    {(["1", "2", "either", "none"] as const).map((k) => (
                      <span key={k} className={cn("text-[11px] rounded-full px-2 py-0.5 border", k === "none" ? "border-gray-800 text-gray-500" : "border-[#D4AF37]/40 text-[#D4AF37]")}>
                        {k === "none" ? "No reply" : VOTE[k]} · {circle.tally[k] || 0}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <Button onClick={() => setBroadcastOpen(true)} className="h-8 flex-1 bg-[#D4AF37] text-black hover:bg-[#C4A030] font-semibold text-xs"><MessageSquare className="w-3.5 h-3.5 mr-1.5" />Text everyone</Button>
                  {circle.groupChatId
                    ? <Button onClick={() => openChat({ chatId: circle.groupChatId!, title: `${circle.name} group`, sub: "Group text", circleId: circle.id })} variant="outline" className="h-8 flex-1 border-gray-700 text-white text-xs"><MessagesSquare className="w-3.5 h-3.5 mr-1.5" />Group text</Button>
                    : <Button onClick={() => setGroupOpen(true)} variant="outline" className="h-8 flex-1 border-gray-700 text-white text-xs"><MessagesSquare className="w-3.5 h-3.5 mr-1.5" />Start group text</Button>}
                </div>
              </div>
              {circle.members.map((m) => {
                const blocked = !m.chatId ? "No valid phone number" : !m.smsOptIn || m.rsvp === "opted_out" ? "Hasn't agreed to texts" : undefined;
                return (
                  <Row key={m.id} title={m.name} sub={[m.city, m.chatId ? `…${m.chatId.slice(-4)}` : null].filter(Boolean).join(" · ")}
                    last={m.lastMessage} needsReply={m.needsReply} active={!!m.chatId && chat?.chatId === m.chatId} warn={blocked}
                    onClick={() => m.chatId && openChat({ chatId: m.chatId, title: m.name, sub: m.chatId, circleId: circle.id, blocked })}
                    right={
                      <div className="flex flex-col items-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {m.vote && <span className="text-[10px] font-semibold text-[#D4AF37]">{VOTE[m.vote]}</span>}
                        <select value={m.rsvp || ""} onChange={(e) => setRsvp.mutate({ circleId: circle.id, userId: m.id, rsvp: e.target.value || null })}
                          className="bg-gray-900 border border-gray-800 rounded text-[10px] px-1 py-0.5 text-gray-300" aria-label={`RSVP for ${m.name}`}>
                          {RSVP.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </div>
                    } />
                );
              })}
            </div>
          )}
        </section>

        {/* Thread */}
        <section className={cn("flex-col min-h-[60vh] md:flex", pane === "thread" ? "flex" : "hidden")}>
          {!chat ? <Empty icon={<MessageSquare className="w-6 h-6" />} text="Pick a member to read and reply to their texts." /> :
            <Thread chat={chat} messages={thread} onBack={() => setPane("members")} onSent={refresh} />}
        </section>
      </div>

      {circle && <BroadcastDialog open={broadcastOpen} onOpenChange={setBroadcastOpen} circle={circle} onDone={refresh} />}
      {circle && <GroupDialog open={groupOpen} onOpenChange={setGroupOpen} circle={circle} onDone={refresh} />}
    </div>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="h-full min-h-[40vh] flex flex-col items-center justify-center text-gray-600 gap-2 px-6 text-center">{icon}<p className="text-sm">{text}</p></div>;
}

function Row({ title, sub, last, needsReply, active, onClick, right, warn }: {
  title: string; sub?: string; last: { body: string; direction: string; sentAt: string } | null; needsReply: boolean; active: boolean;
  onClick: () => void; right?: React.ReactNode; warn?: string;
}) {
  return (
    <div role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => e.key === "Enter" && onClick()}
      className={cn("px-4 py-3 border-b border-gray-900 flex gap-3 cursor-pointer hover:bg-gray-900/60 focus:outline-none focus-visible:bg-gray-900", active && "bg-gray-900")}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {needsReply && <span className="w-2 h-2 rounded-full bg-[#D4AF37] shrink-0" aria-label="Waiting on a reply" />}
          <span className="text-sm font-medium truncate">{title}</span>
        </div>
        {sub && <p className="text-[11px] text-gray-500 truncate">{sub}</p>}
        {warn ? <p className="text-[11px] text-amber-400/90 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{warn}</p>
          : last ? <p className="text-[12px] text-gray-400 truncate">{last.direction === "outbound" ? "You: " : ""}{last.body}</p>
          : <p className="text-[12px] text-gray-600">No texts yet</p>}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {last && <span className="text-[10px] text-gray-600">{when(last.sentAt)}</span>}
        {right}
      </div>
    </div>
  );
}

function Thread({ chat, messages, onBack, onSent }: { chat: Chat; messages: any[]; onBack: () => void; onSent: () => void }) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages.length, chat.chatId]);
  const send = useMutation({
    mutationFn: async () => (await apiRequest("/api/admin/conversations/send", { method: "POST", data: { chatId: chat.chatId, text, circleId: chat.circleId } })).json(),
    onSuccess: () => { setText(""); onSent(); },
    onError: (e) => toast({ title: "Not sent", description: errText(e), variant: "destructive" }),
  });
  return (
    <>
      <div className="px-4 py-3 border-b border-gray-900 flex items-center gap-2">
        <button className="md:hidden text-gray-400" onClick={onBack} aria-label="Back to members"><ChevronLeft className="w-5 h-5" /></button>
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{chat.title}</p>
          {chat.sub && <p className="text-[11px] text-gray-500 truncate">{chat.sub}</p>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.length === 0 && <p className="text-sm text-gray-600 text-center pt-10">No texts yet.</p>}
        {messages.map((m) => (
          <div key={m.id} className={cn("flex flex-col max-w-[80%]", m.direction === "outbound" ? "ml-auto items-end" : "items-start")}>
            <div className={cn("rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words",
              m.direction === "outbound" ? "bg-[#D4AF37] text-black rounded-br-sm" : "bg-gray-800 text-white rounded-bl-sm")}>{m.body}</div>
            <span className={cn("text-[10px] mt-0.5", m.status === "failed" ? "text-red-400" : "text-gray-600")}>
              {when(m.sentAt)}{m.direction === "outbound" && m.status ? ` · ${m.status}` : ""}{m.error ? ` · ${m.error}` : ""}
            </span>
          </div>
        ))}
        <div ref={end} />
      </div>
      <div className="border-t border-gray-900 p-3">
        {chat.blocked ? <p className="text-xs text-amber-400/90">{chat.blocked}, so texting is off for this member.</p> : (
          <div className="flex gap-2 items-end">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a text…" rows={2}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim()) send.mutate(); }}
              className="bg-gray-900 border-gray-800 text-white text-sm resize-none" />
            <Button onClick={() => send.mutate()} disabled={!text.trim() || send.isPending} className="bg-[#D4AF37] text-black hover:bg-[#C4A030] h-10" aria-label="Send text"><Send className="w-4 h-4" /></Button>
          </div>
        )}
      </div>
    </>
  );
}

function BroadcastDialog({ open, onOpenChange, circle, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; circle: Circle; onDone: () => void }) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<any>(null);
  useEffect(() => { if (!open) setPreview(null); }, [open]);
  const run = useMutation({
    mutationFn: async (confirm: boolean) => (await apiRequest("/api/admin/conversations/broadcast", { method: "POST", data: { circleId: circle.id, text, confirm } })).json(),
    onSuccess: (r: any, confirm) => {
      if (!confirm) return setPreview(r);
      toast({ title: `Sent ${r.sent} text${r.sent === 1 ? "" : "s"}`, description: r.failed ? `${r.failed} failed. Check their threads.` : "Replies show up here as they come in." });
      onOpenChange(false); setText(""); onDone();
    },
    onError: (e) => toast({ title: "Couldn't send", description: errText(e), variant: "destructive" }),
  });
  const first = useMemo(() => preview?.recipients?.[0], [preview]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0A0A0A] border-gray-800 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle>Text everyone in {circle.name}</DialogTitle>
          <DialogDescription className="text-gray-400">Each member gets their own text, not a group. Write <code className="text-[#D4AF37]">{"{first_name}"}</code> where their name goes.</DialogDescription>
        </DialogHeader>
        {!preview ? (
          <>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={9} placeholder={"Hi {first_name}, it's Luis from Christ Collective…"} className="bg-gray-900 border-gray-800 text-white text-sm" />
            <Button onClick={() => run.mutate(false)} disabled={!text.trim() || run.isPending} className="bg-[#D4AF37] text-black hover:bg-[#C4A030] font-semibold">Preview</Button>
          </>
        ) : (
          <div className="space-y-3">
            {first && <div className="rounded-xl bg-gray-900 p-3 text-sm whitespace-pre-wrap">{first.text}</div>}
            <p className="text-sm">Goes to <b>{preview.recipients.length}</b>: {preview.recipients.map((r: any) => `${r.name} (…${r.phoneEnd})`).join(", ") || "nobody"}</p>
            {preview.skipped.length > 0 && <p className="text-xs text-amber-400/90">Skipped: {preview.skipped.map((s: any) => `${s.name}, ${s.reason.toLowerCase()}`).join("; ")}</p>}
            <div className="flex gap-2">
              <Button variant="outline" className="border-gray-700 text-white" onClick={() => setPreview(null)}>Edit</Button>
              <Button onClick={() => run.mutate(true)} disabled={!preview.recipients.length || run.isPending} className="flex-1 bg-[#D4AF37] text-black hover:bg-[#C4A030] font-semibold">
                {run.isPending ? "Sending…" : `Send to ${preview.recipients.length} ${preview.recipients.length === 1 ? "person" : "people"}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GroupDialog({ open, onOpenChange, circle, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; circle: Circle; onDone: () => void }) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const confirmed = circle.members.filter((m) => m.rsvp === "confirmed" && m.smsOptIn && m.chatId);
  const start = useMutation({
    mutationFn: async () => (await apiRequest("/api/admin/conversations/group", { method: "POST", data: { circleId: circle.id, text, confirm: true } })).json(),
    onSuccess: (r: any) => { toast({ title: `Group text started with ${r.members} people` }); onOpenChange(false); setText(""); onDone(); },
    onError: (e) => toast({ title: "Couldn't start the group text", description: errText(e), variant: "destructive" }),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0A0A0A] border-gray-800 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle>Start {circle.name}'s group text</DialogTitle>
          <DialogDescription className="text-gray-400">Only members marked Confirmed are added, and everyone in the group will see each other's numbers. Start it once the date is locked.</DialogDescription>
        </DialogHeader>
        <p className="text-sm">{confirmed.length ? <>Adds <b>{confirmed.length}</b>: {confirmed.map((m) => m.firstName).join(", ")}</> : "Nobody is marked Confirmed yet. Set RSVPs in the member list first."}</p>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="Welcome! We're locked in for…" className="bg-gray-900 border-gray-800 text-white text-sm" />
        <Button onClick={() => start.mutate()} disabled={confirmed.length < 2 || !text.trim() || start.isPending} className="bg-[#D4AF37] text-black hover:bg-[#C4A030] font-semibold">
          {start.isPending ? "Starting…" : `Start group text with ${confirmed.length} people`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
