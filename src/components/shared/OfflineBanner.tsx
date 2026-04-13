import { useState, useEffect } from "react";
import { WifiOff, X } from "lucide-react";

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => {
      setIsOffline(false);
      setDismissed(false);
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!isOffline || dismissed) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 flex items-center justify-between text-sm text-destructive"
    >
      <div className="flex items-center gap-2">
        <WifiOff className="w-4 h-4" />
        <span>You're offline. Some features may be unavailable.</span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss offline notification"
        className="p-1 hover:bg-destructive/10 rounded"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
