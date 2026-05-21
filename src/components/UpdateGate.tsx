import { useVersionCheck } from "@/hooks/useVersionCheck";
import { Button } from "@/components/ui/button";
import { X, Download, AlertTriangle } from "lucide-react";

const openStore = (url: string | null) => {
  if (!url) return;
  window.open(url, "_blank");
};

export const UpdateGate = ({ children }: { children: React.ReactNode }) => {
  const { info, dismissBanner, bannerDismissed } = useVersionCheck();

  // Hard block: app below minimum supported version
  if (info.status === "force_update") {
    return (
      <div className="fixed inset-0 z-[9999] bg-background flex items-center justify-center px-6"
        style={{
          paddingTop: "max(2rem, env(safe-area-inset-top))",
          paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-foreground" />
          </div>
          <div className="space-y-2">
            <h1 className="font-serif text-2xl font-bold">Update Required</h1>
            <p className="text-sm text-muted-foreground">
              {info.updateMessage ??
                "This version of Familial is no longer supported. Please update to continue."}
            </p>
            <p className="text-xs text-muted-foreground">
              Installed {info.installedVersion} · Latest {info.latestVersion}
            </p>
          </div>
          <Button className="w-full" size="lg" onClick={() => openStore(info.storeUrl)}>
            <Download className="w-4 h-4 mr-2" />
            Open App Store
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {info.status === "update_available" && !bannerDismissed && (
        <div
          className="fixed left-0 right-0 z-[60] bg-foreground text-background px-4 py-2 flex items-center justify-between gap-3 text-sm shadow-md"
          style={{ top: "env(safe-area-inset-top)" }}
        >
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">A new version of Familial is available</p>
            <p className="text-xs opacity-80 truncate">
              {info.installedVersion} → {info.latestVersion}
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="h-8"
            onClick={() => openStore(info.storeUrl)}
          >
            Update
          </Button>
          <button
            onClick={dismissBanner}
            className="p-1 -mr-1 opacity-80 hover:opacity-100"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {children}
    </>
  );
};
