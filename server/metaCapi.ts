import { createHash } from "crypto";

/**
 * Meta Conversions API — server-side copy of pixel events so Meta can still attribute
 * signups when the browser pixel is blocked (iOS, in-app browsers, ad blockers).
 * The browser sends the same event with the same event_id, and Meta de-duplicates the pair.
 */
const PIXEL_ID = "1105235938868426";

const sha256 = (v: string) => createHash("sha256").update(v.trim().toLowerCase()).digest("hex");

// Meta wants digits only with country code; assume US for 10-digit numbers
const normPhone = (p: string) => {
  const d = p.replace(/\D/g, "");
  return d.length === 10 ? `1${d}` : d;
};

function cookie(header: string | undefined, name: string) {
  const m = (header || "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : undefined;
}

export async function sendMetaEvent(opts: {
  eventName: string;
  eventId?: string;
  req: any; // express request — used for IP, user agent and the _fbp/_fbc cookies
  sourceUrl: string;
  user: { id?: string; email?: string | null; phone?: string | null; firstName?: string | null; lastName?: string | null; city?: string | null; birthdate?: string | null };
  customData?: Record<string, unknown>;
}): Promise<void> {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return;
  const { req, user } = opts;
  // Browser sent Global Privacy Control (a California "do not sell or share" opt-out) — send nothing to Meta
  if (req.headers["sec-gpc"] === "1") return;

  const user_data: Record<string, unknown> = {
    client_ip_address: String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim() || undefined,
    client_user_agent: req.headers["user-agent"],
    fbp: cookie(req.headers.cookie, "_fbp"),
    fbc: cookie(req.headers.cookie, "_fbc"),
    country: [sha256("us")],
    st: [sha256("ca")],
  };
  if (user.email) user_data.em = [sha256(user.email)];
  if (user.phone) user_data.ph = [sha256(normPhone(user.phone))];
  if (user.firstName) user_data.fn = [sha256(user.firstName)];
  if (user.lastName) user_data.ln = [sha256(user.lastName)];
  if (user.city) user_data.ct = [sha256(user.city.replace(/[^a-z]/gi, ""))];
  if (user.birthdate) user_data.db = [sha256(String(user.birthdate).slice(0, 10).replace(/-/g, ""))];
  if (user.id) user_data.external_id = [sha256(String(user.id))];

  const body = {
    data: [{
      event_name: opts.eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: opts.eventId,
      action_source: "website",
      event_source_url: opts.sourceUrl,
      user_data,
      custom_data: opts.customData,
    }],
    // Set META_CAPI_TEST_CODE to route events to Events Manager → Test Events only (never counted in reporting)
    ...(process.env.META_CAPI_TEST_CODE && { test_event_code: process.env.META_CAPI_TEST_CODE }),
  };

  const r = await fetch(`https://graph.facebook.com/${PIXEL_ID}/events?access_token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err: any = await r.json().catch(() => ({}));
    throw new Error(`CAPI ${r.status}: ${err?.error?.message || "unknown error"}`);
  }
}
