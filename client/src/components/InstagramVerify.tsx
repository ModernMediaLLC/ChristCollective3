import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { BadgeCheck, Copy, Loader2 } from "lucide-react";

type Stage = "idle" | "code" | "checking" | "verified";

const POLL_MS = 4000;
const POLL_LIMIT_MS = 150_000; // Apify profile reads usually take 30–60s

async function json(res: Response) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.message || "Something went wrong");
  return body;
}

// apiRequest throws `409: {"message":"..."}` — show just the message
const clean = (raw?: string) => {
  const body = (raw || "").replace(/^\d{3}:\s*/, "");
  try { return JSON.parse(body).message || body; } catch { return body || "Something went wrong"; }
};

/**
 * Instagram handle field with optional ownership verification:
 * we issue a code, the member pastes it in their bio, and the server reads the bio to confirm.
 * `preview` simulates the whole flow without calling the server.
 */
export default function InstagramVerify({
  value, onChange, verified: initiallyVerified = false, preview = false,
}: { value: string; onChange: (handle: string) => void; verified?: boolean; preview?: boolean }) {
  const [stage, setStage] = useState<Stage>(initiallyVerified ? "verified" : "idle");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const stopped = useRef(false);
  useEffect(() => () => { stopped.current = true; }, []);

  const handle = value.replace(/^@/, "").trim();

  const start = async () => {
    setError("");
    if (preview) { setCode("CC-0000"); return setStage("code"); }
    try {
      const r = await json(await apiRequest("/api/instagram/verify/start", { method: "POST", data: { handle } }));
      if (r.verified) return setStage("verified");
      setCode(r.code);
      setStage("code");
    } catch (e: any) { setError(clean(e.message)); }
  };

  const check = async () => {
    setError("");
    setStage("checking");
    if (preview) { setTimeout(() => !stopped.current && setStage("verified"), 2000); return; }
    try {
      const { runId } = await json(await apiRequest("/api/instagram/verify/check", { method: "POST" }));
      const began = Date.now();
      while (!stopped.current && Date.now() - began < POLL_LIMIT_MS) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        const s = await json(await apiRequest(`/api/instagram/verify/status/${runId}`));
        if (s.status === "verified") return setStage("verified");
        if (s.status === "failed") { setError(s.message); return setStage("code"); }
      }
      if (!stopped.current) { setError("Instagram is taking a while — tap check again."); setStage("code"); }
    } catch (e: any) { setError(clean(e.message)); setStage("code"); }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };

  return (
    <div>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">@</span>
        <Input
          value={value}
          onChange={(e) => { onChange(e.target.value.replace(/^@/, "")); if (stage !== "idle") { setStage("idle"); setError(""); } }}
          placeholder="yourhandle"
          autoCapitalize="none"
          className={cn("bg-[#0A0A0A] border-gray-800 text-white h-12 pl-8", stage === "idle" && handle && "pr-24")}
        />
        {stage === "idle" && handle && (
          <button onClick={start} className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-md bg-[#D4AF37]/15 text-[#D4AF37] text-xs font-bold hover:bg-[#D4AF37]/25">
            Verify
          </button>
        )}
        {stage === "verified" && <BadgeCheck className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#D4AF37]" />}
      </div>

      {stage === "idle" && handle && !error && (
        <p className="text-[11px] text-gray-500 mt-1.5">Verify to show a ✓ on your profile so your circle knows it's really you.</p>
      )}

      {(stage === "code" || stage === "checking") && (
        <div className="mt-3 rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/[0.04] p-4">
          <p className="text-sm text-gray-200 mb-3">
            <span className="font-semibold text-white">1.</span> Copy this code&nbsp;
            <button onClick={copy} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black border border-[#D4AF37]/60 text-[#D4AF37] font-mono font-bold tracking-wider align-middle">
              {code} <Copy className="w-3.5 h-3.5" />
            </button>
            {copied && <span className="text-[11px] text-[#D4AF37] ml-2">Copied</span>}
          </p>
          <p className="text-sm text-gray-200 mb-1">
            <span className="font-semibold text-white">2.</span> Paste it anywhere in your{" "}
            <a href="https://www.instagram.com/accounts/edit/" target="_blank" rel="noopener noreferrer" className="text-[#D4AF37] underline">Instagram bio</a> and save.
          </p>
          <p className="text-sm text-gray-200 mb-3"><span className="font-semibold text-white">3.</span> Come back and tap check. You can delete the code once you're verified.</p>
          <button
            onClick={check}
            disabled={stage === "checking"}
            className="w-full h-11 rounded-lg bg-[#D4AF37] text-black font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {stage === "checking" ? <><Loader2 className="w-4 h-4 animate-spin" /> Reading your bio… up to a minute</> : "I've added it — check my bio"}
          </button>
        </div>
      )}

      {stage === "verified" && (
        <p className="text-xs text-[#D4AF37] mt-1.5 font-medium">✓ Verified — you can remove the code from your bio now.</p>
      )}
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
}
