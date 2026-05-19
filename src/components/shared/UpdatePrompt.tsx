import { useEffect, useState, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  checkForUpdate,
  snooze,
  APP_STORE_URL,
  type UpdateCheckResult,
} from "@/lib/appVersionCheck";

export function UpdatePrompt() {
  const [update, setUpdate] = useState<UpdateCheckResult | null>(null);

  const run = useCallback(async () => {
    try {
      const result = await checkForUpdate();
      if (result) setUpdate(result);
    } catch (e) {
      console.warn("[UpdatePrompt] check failed", e);
    }
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    // Initial check shortly after mount
    const t = setTimeout(run, 1500);

    let removeListener: (() => void) | undefined;
    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const handle = await App.addListener("resume", () => {
          run();
        });
        removeListener = () => {
          handle.remove();
        };
      } catch {
        // ignore
      }
    })();

    return () => {
      clearTimeout(t);
      removeListener?.();
    };
  }, [run]);

  const handleUpdate = async () => {
    if (!update) return;
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: APP_STORE_URL });
    } catch {
      window.open(APP_STORE_URL, "_blank");
    }
  };

  const handleLater = () => {
    if (update) snooze(update.latest);
    setUpdate(null);
  };

  if (!update) return null;

  return (
    <Dialog open={!!update} onOpenChange={(open) => { if (!open) handleLater(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            A new version of Familial is available
          </DialogTitle>
          <DialogDescription className="pt-2">
            You're on v{update.installed}. v{update.latest} is ready in the App Store
            with the latest improvements and fixes.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={handleLater} className="w-full sm:w-auto">
            Later
          </Button>
          <Button onClick={handleUpdate} className="w-full sm:w-auto">
            Update Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
