import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

const BUNDLE_ID = "app.lovable.f745440093af4f4390a60d52ff08c778";
const CACHE_KEY = "app_update_check";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

interface UpdateInfo {
  updateAvailable: boolean;
  installedVersion: string;
  storeVersion: string;
  storeUrl: string;
}

function cmpSemver(a: string, b: string): number {
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

export function useAppUpdateCheck(): UpdateInfo | null {
  const [info, setInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (Capacitor.getPlatform() !== "ios") return;

    let cancelled = false;

    (async () => {
      try {
        const { version: installedVersion } = await App.getInfo();

        // Cache check
        const cachedRaw = localStorage.getItem(CACHE_KEY);
        if (cachedRaw) {
          try {
            const cached = JSON.parse(cachedRaw) as {
              ts: number;
              storeVersion: string;
              storeUrl: string;
            };
            if (Date.now() - cached.ts < CACHE_TTL_MS && cached.storeVersion) {
              const updateAvailable =
                cmpSemver(cached.storeVersion, installedVersion) > 0;
              if (!cancelled) {
                setInfo({
                  updateAvailable,
                  installedVersion,
                  storeVersion: cached.storeVersion,
                  storeUrl: cached.storeUrl,
                });
              }
              return;
            }
          } catch {
            // fall through to refetch
          }
        }

        const res = await fetch(
          `https://itunes.apple.com/lookup?bundleId=${BUNDLE_ID}&country=us&t=${Date.now()}`
        );
        if (!res.ok) return;
        const json = await res.json();
        const result = json?.results?.[0];
        if (!result?.version || !result?.trackViewUrl) return;

        const storeVersion: string = String(result.version);
        const storeUrl: string = String(result.trackViewUrl);

        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ ts: Date.now(), storeVersion, storeUrl })
        );

        if (cancelled) return;
        setInfo({
          updateAvailable: cmpSemver(storeVersion, installedVersion) > 0,
          installedVersion,
          storeVersion,
          storeUrl,
        });
      } catch {
        // Silent — never block the app on update-check failures.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return info;
}
