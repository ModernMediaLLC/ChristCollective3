import { isWeb } from "./platform";

/**
 * Meta (Facebook) Pixel — web only, never inside the native apps (keeps us clear of iOS ATT).
 * Pixel IDs are public, so it lives here rather than in env. Empty = pixel disabled (all calls no-op).
 */
const META_PIXEL_ID = "1105235938868426";

declare global {
  interface Window { fbq?: any; _fbq?: any }
}

let loaded = false;

export function initMetaPixel() {
  // ?preview=1 is the internal walkthrough of /join — keep it out of Meta's data
  if (loaded || !META_PIXEL_ID || !isWeb() || new URLSearchParams(window.location.search).has("preview")) return;
  loaded = true;
  // Standard Meta base snippet
  const n: any = (window.fbq = function (...args: any[]) {
    n.callMethod ? n.callMethod(...args) : n.queue.push(args);
  });
  if (!window._fbq) window._fbq = n;
  n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(s);

  window.fbq("init", META_PIXEL_ID);
  window.fbq("track", "PageView");
}

export function trackMetaEvent(event: string, params?: Record<string, unknown>) {
  if (!loaded || !window.fbq) return;
  window.fbq("track", event, params);
}
