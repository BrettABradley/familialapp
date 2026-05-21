import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

export type VersionStatus = "ok" | "update_available" | "force_update";

export interface VersionInfo {
  status: VersionStatus;
  installedVersion: string | null;
  latestVersion: string | null;
  storeUrl: string | null;
  updateMessage: string | null;
}

const STORAGE_DISMISS_KEY = "familial.updateBanner.dismissedFor";

const compare = (a: string, b: string): number => {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
};

export const useVersionCheck = () => {
  const [info, setInfo] = useState<VersionInfo>({
    status: "ok",
    installedVersion: null,
    latestVersion: null,
    storeUrl: null,
    updateMessage: null,
  });

  useEffect(() => {
    const check = async () => {
      if (!Capacitor.isNativePlatform()) return;
      const platform = Capacitor.getPlatform(); // 'ios' | 'android'

      let installed = "0.0.0";
      try {
        const { App } = await import("@capacitor/app");
        const appInfo = await App.getInfo();
        installed = appInfo.version || "0.0.0";
      } catch (e) {
        console.warn("[versionCheck] getInfo failed", e);
        return;
      }

      const { data, error } = await supabase
        .from("app_version_config")
        .select("min_supported_version, latest_version, store_url, update_message")
        .eq("platform", platform)
        .maybeSingle();

      if (error || !data) {
        console.warn("[versionCheck] no config", error?.message);
        return;
      }

      let status: VersionStatus = "ok";
      if (compare(installed, data.min_supported_version) < 0) {
        status = "force_update";
      } else if (compare(installed, data.latest_version) < 0) {
        status = "update_available";
      }

      setInfo({
        status,
        installedVersion: installed,
        latestVersion: data.latest_version,
        storeUrl: data.store_url,
        updateMessage: data.update_message,
      });
    };

    check();
  }, []);

  const dismissBanner = () => {
    if (info.latestVersion) {
      localStorage.setItem(STORAGE_DISMISS_KEY, info.latestVersion);
    }
    setInfo((prev) => ({ ...prev, status: "ok" }));
  };

  const bannerDismissed =
    info.status === "update_available" &&
    info.latestVersion === localStorage.getItem(STORAGE_DISMISS_KEY);

  return { info, dismissBanner, bannerDismissed };
};
