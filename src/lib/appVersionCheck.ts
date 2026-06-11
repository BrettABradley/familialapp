import { Capacitor } from "@capacitor/core";

const BUNDLE_ID = "space.manus.familial.mobile.t20260223211425";
// TODO: replace with numeric App Store ID once the app is live.
// While in TestFlight-only, the App Store URL won't resolve; we fall back to
// a generic apps.apple.com search that opens TestFlight if installed.
export const APP_STORE_URL = "https://apps.apple.com/app/familial/id6760382623";
export const TESTFLIGHT_URL = "itms-beta://";

const FETCH_CACHE_KEY = "appVersionCheck:lastFetch";
const SNOOZE_KEY = "appVersionCheck:snoozed";
const FETCH_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h
const SNOOZE_MS = 24 * 60 * 60 * 1000; // 24h

interface CachedFetch {
  at: number;
  version: string | null;
}

interface Snoozed {
  version: string;
  at: number;
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

export async function getInstalledVersion(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { App } = await import("@capacitor/app");
    const info = await App.getInfo();
    return info.version ?? null;
  } catch (e) {
    console.warn("[updateCheck] getInstalledVersion failed", e);
    return null;
  }
}

export async function getStoreVersion(): Promise<string | null> {
  try {
    const raw = localStorage.getItem(FETCH_CACHE_KEY);
    if (raw) {
      const cached: CachedFetch = JSON.parse(raw);
      if (Date.now() - cached.at < FETCH_INTERVAL_MS) {
        return cached.version;
      }
    }
  } catch {
    // ignore cache errors
  }

  try {
    const res = await fetch(
      `https://itunes.apple.com/lookup?bundleId=${encodeURIComponent(BUNDLE_ID)}&t=${Date.now()}`
    );
    if (!res.ok) return null;
    const json = await res.json();
    const version: string | null = json?.results?.[0]?.version ?? null;
    try {
      localStorage.setItem(
        FETCH_CACHE_KEY,
        JSON.stringify({ at: Date.now(), version } satisfies CachedFetch)
      );
    } catch {
      // ignore quota errors
    }
    return version;
  } catch (e) {
    console.warn("[updateCheck] getStoreVersion failed", e);
    return null;
  }
}

export function isSnoozed(version: string): boolean {
  try {
    const raw = localStorage.getItem(SNOOZE_KEY);
    if (!raw) return false;
    const snoozed: Snoozed = JSON.parse(raw);
    if (snoozed.version !== version) return false;
    return Date.now() - snoozed.at < SNOOZE_MS;
  } catch {
    return false;
  }
}

export function snooze(version: string) {
  try {
    localStorage.setItem(
      SNOOZE_KEY,
      JSON.stringify({ version, at: Date.now() } satisfies Snoozed)
    );
  } catch {
    // ignore
  }
}

export interface UpdateCheckResult {
  installed: string;
  latest: string;
}

export async function checkForUpdate(): Promise<UpdateCheckResult | null> {
  if (!Capacitor.isNativePlatform()) return null;
  const [installed, latest] = await Promise.all([
    getInstalledVersion(),
    getStoreVersion(),
  ]);
  if (!installed || !latest) return null;
  if (compareVersions(latest, installed) <= 0) return null;
  if (isSnoozed(latest)) return null;
  return { installed, latest };
}
