/**
 * Push notification service using APNs (Apple Push Notification service).
 * Sends notifications to iOS devices via @parse/node-apn.
 *
 * Required env vars:
 *   APNS_KEY_ID      — 10-char Key ID from Apple Developer portal
 *   APNS_TEAM_ID     — 10-char Team ID from Apple Developer portal
 *   APNS_BUNDLE_ID   — App bundle ID (e.g. com.christcollective.app)
 *   APNS_PRIVATE_KEY — Contents of the .p8 key file (newlines as \n)
 *   APNS_PRODUCTION  — "true" for production APNs, omit for sandbox (TestFlight)
 */

import { pool } from "./db";

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
}

// Lazy-load apn so server starts even when env vars are missing
let apnProvider: any = null;
let apnProviderInitialized = false;

async function getApnProvider() {
  if (apnProviderInitialized) return apnProvider;
  apnProviderInitialized = true;

  const { APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, APNS_PRIVATE_KEY } = process.env;
  if (!APNS_KEY_ID || !APNS_TEAM_ID || !APNS_BUNDLE_ID || !APNS_PRIVATE_KEY) {
    console.warn("[Push] APNs NOT configured — missing env vars:", {
      APNS_KEY_ID: !!APNS_KEY_ID,
      APNS_TEAM_ID: !!APNS_TEAM_ID,
      APNS_BUNDLE_ID: !!APNS_BUNDLE_ID,
      APNS_PRIVATE_KEY: !!APNS_PRIVATE_KEY,
    });
    return null;
  }

  try {
    const apn = await import("@parse/node-apn");
    apnProvider = new apn.Provider({
      token: {
        key: APNS_PRIVATE_KEY.replace(/\\n/g, "\n"),
        keyId: APNS_KEY_ID,
        teamId: APNS_TEAM_ID,
      },
      production: process.env.APNS_PRODUCTION === "true",
    });
    console.log(`[Push] APNs provider initialized — mode: ${process.env.APNS_PRODUCTION === "true" ? "PRODUCTION" : "SANDBOX"}, bundle: ${APNS_BUNDLE_ID}`);
    return apnProvider;
  } catch (err) {
    console.error("[Push] Failed to initialize APNs provider:", err);
    return null;
  }
}

/** Get all push tokens for a user */
async function getTokensForUser(userId: string): Promise<string[]> {
  const result = await pool.query(
    `SELECT token FROM push_tokens WHERE user_id = $1`,
    [userId]
  );
  return result.rows.map((r: any) => r.token);
}

/** Send a push notification to a specific user */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const provider = await getApnProvider();
  if (!provider) {
    console.warn(`[Push] Skipping notification to ${userId} — APNs not configured`);
    return;
  }

  const tokens = await getTokensForUser(userId);
  if (!tokens.length) {
    console.log(`[Push] No tokens for user ${userId} — skipping`);
    return;
  }

  console.log(`[Push] Sending "${payload.title}" to user ${userId} (${tokens.length} token(s))`);

  const apn = await import("@parse/node-apn");
  const notification = new apn.Notification();
  notification.alert = { title: payload.title, body: payload.body };
  notification.sound = "default";
  notification.topic = process.env.APNS_BUNDLE_ID!;
  if (payload.badge !== undefined) notification.badge = payload.badge;
  if (payload.data) notification.payload = payload.data;

  for (const token of tokens) {
    try {
      const result = await provider.send(notification, token);
      if (result.failed?.length) {
        const err = result.failed[0].error || result.failed[0].response;
        console.error(`[Push] Failed for token ${token.slice(0, 10)}...:`, err);
        if (err?.reason === "BadDeviceToken" || err?.reason === "Unregistered") {
          await pool.query(`DELETE FROM push_tokens WHERE token = $1`, [token]);
          console.log(`[Push] Removed invalid token ${token.slice(0, 10)}...`);
        }
      } else {
        console.log(`[Push] Delivered to token ${token.slice(0, 10)}...`);
      }
    } catch (e) {
      console.error("[Push] Send error:", e);
    }
  }
}

/** Send the daily Word of the Day notification to all users with push tokens */
export async function sendWordOfTheDayNotification(word: string, verse: string): Promise<void> {
  const provider = await getApnProvider();
  if (!provider) return;

  const result = await pool.query(`SELECT DISTINCT user_id FROM push_tokens`);
  const userIds: string[] = result.rows.map((r: any) => r.user_id);
  console.log(`[Push] Sending Word of the Day to ${userIds.length} user(s)`);

  for (const userId of userIds) {
    await sendPushToUser(userId, {
      title: `✝️ Word of the Day: ${word}`,
      body: verse,
      data: { type: "word_of_the_day" },
    });
  }
}
