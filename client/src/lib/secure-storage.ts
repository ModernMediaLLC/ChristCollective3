/**
 * Persistent key-value storage that survives iOS app termination.
 * Uses @capacitor/preferences (NSUserDefaults) on native, localStorage on web.
 */
import { isNativeApp } from "./platform";

async function getPreferences() {
  if (isNativeApp()) {
    const { Preferences } = await import("@capacitor/preferences");
    return Preferences;
  }
  return null;
}

export async function secureSet(key: string, value: string): Promise<void> {
  const prefs = await getPreferences();
  if (prefs) {
    await prefs.set({ key, value });
  } else {
    localStorage.setItem(key, value);
  }
}

export async function secureGet(key: string): Promise<string | null> {
  const prefs = await getPreferences();
  if (prefs) {
    const { value } = await prefs.get({ key });
    return value;
  }
  return localStorage.getItem(key);
}

export async function secureRemove(key: string): Promise<void> {
  const prefs = await getPreferences();
  if (prefs) {
    await prefs.remove({ key });
  } else {
    localStorage.removeItem(key);
  }
}

/** Sync read — falls back to localStorage only (for non-async contexts). */
export function secureGetSync(key: string): string | null {
  return localStorage.getItem(key);
}
