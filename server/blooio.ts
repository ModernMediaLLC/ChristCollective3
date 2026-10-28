// Blooio: texts members over iMessage (blue bubbles), falling back to SMS. Docs: https://docs.blooio.com
// A chat id is the recipient's E.164 number ("+13105551234"), or a comma-separated list of numbers
// for a group text (Blooio creates or reuses the group). Needs BLOOIO_API_KEY.

const BASE = "https://backend.blooio.com/v2/api";

export type BlooioMessage = {
  message_id: string;
  direction: "inbound" | "outbound";
  text: string | null;
  sender: string | null;
  time_sent: number | null;
  time_delivered: number | null;
  status: string | null;
  protocol: string | null;
  error: string | null;
};
export type BlooioChat = { id: string; is_group: boolean; last_message_time: number | null };

export const blooioConfigured = () => !!process.env.BLOOIO_API_KEY;

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = process.env.BLOOIO_API_KEY;
  if (!key) throw new Error("BLOOIO_API_KEY is not set");
  const res = await fetch(BASE + path, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Blooio ${res.status}: ${body.slice(0, 200)}`);
  return (body ? JSON.parse(body) : {}) as T;
}

// "(310) 555-1234" → "+13105551234"; null when it isn't a usable US number
export function toE164(phone: string | null | undefined): string | null {
  const d = String(phone || "").replace(/\D/g, "");
  if (d.length === 10) return "+1" + d;
  if (d.length === 11 && d.startsWith("1")) return "+" + d;
  return null;
}

export const chatPath = (chatId: string) => `/chats/${encodeURIComponent(chatId)}`;

// Queues a text. idempotencyKey makes a retried request a no-op instead of a second text.
// Sent to several numbers, the response carries the group's id ("grp_…"), which is its chat id from then on.
export function sendText(chatId: string, text: string, idempotencyKey?: string) {
  return call<{ message_id: string; status: string; chat_id?: string; group_id?: string }>(`${chatPath(chatId)}/messages`, {
    method: "POST",
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey.slice(0, 200) } : {},
    body: JSON.stringify({ text }),
  });
}

export const listChats = (limit = 100, offset = 0) =>
  call<{ chats: BlooioChat[]; pagination: { total: number } }>(`/chats?limit=${limit}&offset=${offset}`);

export const listMessages = (chatId: string, limit = 100, offset = 0) =>
  call<{ chat_id: string; messages: BlooioMessage[]; pagination: { total: number } }>(`${chatPath(chatId)}/messages?limit=${limit}&offset=${offset}`);

// Status and transport of one message: protocol goes pending → imessage / sms / rcs / unknown
export const getMessageStatus = (chatId: string, messageId: string) =>
  call<{ status: string | null; protocol: string | null; error: string | null }>(`${chatPath(chatId)}/messages/${encodeURIComponent(messageId)}/status`);

// Whether a number can get iMessage. 404 for a number Blooio has never texted.
export const getCapabilities = (phone: string) =>
  call<{ capabilities?: { imessage?: boolean; sms?: boolean } }>(`/contacts/${encodeURIComponent(phone)}/capabilities`);

export const getAccount = () =>
  call<{ valid: boolean; devices?: { phone_number: string; is_active: boolean }[] }>(`/me`);
