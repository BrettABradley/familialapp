import { useState } from "react";
import { MapPin, Bell, Loader2, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { openMapsApp } from "@/lib/externalUrl";

interface Props {
  location: string;
  eventId: string;
  isHost: boolean;
}

type MapApp = "apple" | "google";

export function EventLocationPopover({ location, eventId, isHost }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [pendingApp, setPendingApp] = useState<MapApp | null>(null);

  const openMaps = async (app: MapApp) => {
    try {
      await openExternalUrl(mapUrl(app, location));
    } catch (e) {
      console.error("open maps failed", e);
    }
  };

  const handleNotifyAndOpen = async () => {
    if (!pendingApp || sending) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("notify-event-host-on-way", {
        body: { eventId },
      });
      if (error) throw error;
      toast({ title: "Host notified", description: "We let them know you're on the way." });
    } catch (e) {
      console.error("notify host failed", e);
      toast({
        title: "Couldn't notify host",
        description: "Opening maps anyway.",
        variant: "destructive",
      });
    } finally {
      const app = pendingApp;
      setSending(false);
      setPendingApp(null);
      setOpen(false);
      if (app) openMaps(app);
    }
  };

  const handleJustOpen = () => {
    if (!pendingApp) return;
    const app = pendingApp;
    setPendingApp(null);
    setOpen(false);
    openMaps(app);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setPendingApp(null);
      }}
    >
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button className="flex items-center gap-1 text-primary underline underline-offset-2 hover:text-primary/80 cursor-pointer">
          <MapPin className="w-4 h-4 shrink-0" />
          {location}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-2"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        {pendingApp ? (
          <div className="flex flex-col gap-2 p-1">
            <div className="flex items-start gap-2 px-2 pt-1">
              <Bell className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
              <p className="text-sm text-foreground">
                Let the host know you're on the way?
              </p>
            </div>
            <p className="text-xs text-muted-foreground px-2 pb-1">
              No ETA or location — just a heads-up.
            </p>
            <button
              onClick={handleNotifyAndOpen}
              disabled={sending}
              className="flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Yes, notify & open
            </button>
            <button
              onClick={handleJustOpen}
              disabled={sending}
              className="rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors disabled:opacity-60"
            >
              Just open maps
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {!isHost && (
              <div className="px-2 pt-1 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                Get directions
              </div>
            )}
            <button
              onClick={() => (isHost ? openMaps("apple") : setPendingApp("apple"))}
              className="text-left flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors"
            >
              Open in Apple Maps
            </button>
            <button
              onClick={() => (isHost ? openMaps("google") : setPendingApp("google"))}
              className="text-left flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors"
            >
              Open in Google Maps
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
