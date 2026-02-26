import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Trash2, Mic, X, Download } from "lucide-react";
import { getMediaType } from "@/lib/mediaUtils";

export interface FridgeBoardPin {
  id: string;
  title: string;
  content: string | null;
  image_url: string | null;
  circle_id: string;
  pinned_by: string;
  created_at: string;
  circles?: { id: string; name: string };
}

/**
 * Fixed positions for up to 8 polaroid photos.
 */
const PIN_LAYOUT: Array<{ top: string; left: string; rotate: number }> = [
  { top: "8%", left: "6%", rotate: -6 },
  { top: "10%", left: "38%", rotate: 4 },
  { top: "6%", left: "70%", rotate: -2 },
  { top: "42%", left: "10%", rotate: 3 },
  { top: "44%", left: "44%", rotate: -5 },
  { top: "40%", left: "74%", rotate: 5 },
  { top: "74%", left: "14%", rotate: -3 },
  { top: "76%", left: "56%", rotate: 2 },
];

/**
 * Pixel-art style magnet colors
 */
const MAGNET_COLORS = [
  "bg-red-600",
  "bg-yellow-500",
  "bg-green-600",
  "bg-blue-600",
  "bg-pink-500",
  "bg-purple-600",
  "bg-orange-500",
  "bg-cyan-500",
];

export function FridgeBoard({
  pins,
  canDelete,
  onDelete,
  className,
  circleName,
}: {
  pins: FridgeBoardPin[];
  canDelete: (pin: FridgeBoardPin) => boolean;
  onDelete: (pin: FridgeBoardPin) => void;
  className?: string;
  circleName?: string;
}) {
  const [enlargedPin, setEnlargedPin] = useState<FridgeBoardPin | null>(null);

  return (
    <section
      aria-label="Family fridge board"
      className={cn("w-full select-none", className)}
    >
      {/* Pixel-art fridge container - more vertically stretched */}
      <div className="relative mx-auto max-w-2xl">
        {/* Fridge body - tall pixel style like Terraria */}
        <div
          className={cn(
            "relative overflow-hidden",
            // Blocky pixelated border
            "border-[8px] border-zinc-700 dark:border-zinc-500",
            "rounded-none",
            // Fridge color gradient (retro teal/mint like old fridges)
            "bg-gradient-to-b from-emerald-300 via-emerald-400 to-emerald-500",
            "dark:from-emerald-700 dark:via-emerald-800 dark:to-emerald-900",
            // Pixel-art shadow effect
            "shadow-[10px_10px_0_0_rgba(0,0,0,0.35)]"
          )}
          style={{
            imageRendering: "pixelated",
          }}
        >
          {/* Top freezer section divider */}
          <div className="absolute top-[18%] left-0 right-0 h-[8px] bg-zinc-700 dark:bg-zinc-500 z-10" />

          {/* Fridge handle - tall blocky rectangle */}
          <div
            className={cn(
              "absolute right-4 top-[24%] z-20",
              "h-[50%] w-5",
              "bg-zinc-500 dark:bg-zinc-400",
              "border-[3px] border-zinc-700 dark:border-zinc-300",
              "shadow-[3px_3px_0_0_rgba(0,0,0,0.3)]"
            )}
          />

          {/* Freezer handle */}
          <div
            className={cn(
              "absolute right-4 top-[5%] z-20",
              "h-[10%] w-5",
              "bg-zinc-500 dark:bg-zinc-400",
              "border-[3px] border-zinc-700 dark:border-zinc-300",
              "shadow-[3px_3px_0_0_rgba(0,0,0,0.3)]"
            )}
          />

          {/* Inner texture lines (pixel detail) */}
          <div className="pointer-events-none absolute inset-0 opacity-10">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="absolute left-0 right-0 h-px bg-black"
                style={{ top: `${(i + 1) * 8}%` }}
              />
            ))}
          </div>

          {/* Fridge brand label */}
          <div
            className={cn(
              "absolute top-2 left-1/2 -translate-x-1/2 z-20",
              "px-3 py-1",
              "bg-zinc-100 dark:bg-zinc-200",
              "border-2 border-zinc-600",
              "text-[10px] font-bold text-zinc-700 uppercase tracking-widest",
              "shadow-[2px_2px_0_0_rgba(0,0,0,0.2)]"
            )}
          >
            {circleName || "Familial"}
          </div>

          {/* Pinned items area */}
          {/* Taller aspect ratio for more fridge-like proportions */}
          <div className="relative aspect-[3/4] sm:aspect-[2/3] w-full p-4 pt-12">
            {pins.slice(0, 8).map((pin, idx) => {
              const layout = PIN_LAYOUT[idx];
              const canDeletePin = canDelete(pin);
              const magnetColor = MAGNET_COLORS[idx % MAGNET_COLORS.length];

              return (
                <div
                  key={pin.id}
                  className={cn(
                    "absolute",
                    "w-[36%] sm:w-[20%]",
                    "transition-transform duration-150 ease-out",
                    "hover:scale-110 hover:z-30 group"
                  )}
                  style={{
                    top: layout.top,
                    left: layout.left,
                    transform: `rotate(${layout.rotate}deg)`,
                  }}
                >
                  {/* Polaroid frame - pixel style */}
                  <div
                    className={cn(
                      "relative bg-white p-1",
                      pin.content ? "pb-12" : "pb-8",
                      "border-4 border-zinc-300",
                      "shadow-[4px_4px_0_0_rgba(0,0,0,0.25)]",
                      "transition-shadow duration-150",
                      "group-hover:shadow-[6px_6px_0_0_rgba(0,0,0,0.3)]"
                    )}
                  >
                    {/* Pixel magnet */}
                    <div
                      className={cn(
                        "absolute -top-3 left-1/2 -translate-x-1/2 z-10",
                        "h-5 w-5 rounded-none",
                        magnetColor,
                        "border-2 border-black/30",
                        "shadow-[2px_2px_0_0_rgba(0,0,0,0.3)]",
                        "transition-transform duration-150",
                        "group-hover:scale-125"
                      )}
                    />

                    {/* Photo/Media area - clickable */}
                    {pin.image_url ? (
                      getMediaType(pin.image_url) === 'audio' ? (
                        <div className="flex aspect-square items-center justify-center bg-zinc-100 flex-col gap-1 p-2">
                          <Mic className="w-6 h-6 text-zinc-500" />
                          <audio controls className="w-full" preload="metadata" style={{ maxHeight: '32px' }}>
                            <source src={pin.image_url} />
                          </audio>
                        </div>
                      ) : (
                        <img
                          src={pin.image_url}
                          alt={pin.title}
                          loading="lazy"
                          className="block w-full aspect-square object-cover bg-zinc-200 cursor-pointer"
                          style={{ imageRendering: "auto" }}
                          onClick={() => setEnlargedPin(pin)}
                        />
                      )
                    ) : (
                      <div
                        className="flex aspect-square items-center justify-center bg-zinc-100 text-center text-[10px] text-zinc-500 p-1 font-mono cursor-pointer"
                        onClick={() => setEnlargedPin(pin)}
                      >
                        {pin.title}
                      </div>
                    )}

                    {/* Caption */}
                    <div className="absolute bottom-0 left-0 right-0 px-1 pb-1">
                      <p className="truncate text-[9px] font-bold text-zinc-800 font-mono">
                        {pin.title}
                      </p>
                      {pin.content && (
                        <p className="truncate text-[8px] text-zinc-600 font-mono">
                          {pin.content}
                        </p>
                      )}
                      <p className="truncate text-[8px] text-zinc-500 font-mono">
                        {pin.circles?.name || ""}
                      </p>
                    </div>

                    {/* Delete button */}
                    {canDeletePin && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className={cn(
                          "absolute -top-2 -right-2 h-6 w-6 rounded-none",
                          "opacity-0 group-hover:opacity-100",
                          "transition-opacity duration-150",
                          "border-2 border-black/30",
                          "shadow-[2px_2px_0_0_rgba(0,0,0,0.3)]"
                        )}
                        onClick={() => onDelete(pin)}
                        aria-label={`Remove ${pin.title} from fridge`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Empty state */}
            {pins.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600 dark:text-zinc-300">
                <div className="text-5xl mb-2 font-mono">📷</div>
                <p className="text-sm font-mono">No photos pinned yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Fridge feet (pixel blocks) - wider */}
        <div className="flex justify-between px-6 -mt-1">
          <div className="h-5 w-10 bg-zinc-800 dark:bg-zinc-600 shadow-[3px_3px_0_0_rgba(0,0,0,0.3)]" />
          <div className="h-5 w-10 bg-zinc-800 dark:bg-zinc-600 shadow-[3px_3px_0_0_rgba(0,0,0,0.3)]" />
        </div>
      </div>

      {/* Capacity indicator */}
      <div className="mt-6 flex items-center justify-center gap-4 text-xs text-muted-foreground font-mono">
        <span className="px-2 py-1 bg-muted rounded">
          {pins.length}/8 spots
        </span>
        {pins.length >= 8 && (
          <span className="text-amber-600 dark:text-amber-400 font-bold animate-pulse">
            ⚠ Fridge full!
          </span>
        )}
      </div>

      {/* Enlarged pin dialog */}
      <Dialog open={!!enlargedPin} onOpenChange={(open) => !open && setEnlargedPin(null)}>
        <DialogContent
          className={cn(
            "max-w-md p-0 overflow-hidden border-0 bg-transparent shadow-none",
            "[&>button]:hidden"
          )}
        >
          <DialogTitle className="sr-only">
            {enlargedPin?.title || "Enlarged photo"}
          </DialogTitle>
          {enlargedPin && (
            <div
              className={cn(
                "relative bg-white p-3",
                enlargedPin?.content ? "pb-16" : "pb-12",
                "border-[6px] border-zinc-300",
                "shadow-[8px_8px_0_0_rgba(0,0,0,0.25)]",
                "mx-auto max-w-sm"
              )}
              style={{ transform: `rotate(${(Math.random() * 4 - 2).toFixed(1)}deg)` }}
            >
              {/* Magnet */}
              <div
                className={cn(
                  "absolute -top-4 left-1/2 -translate-x-1/2 z-10",
                  "h-7 w-7 rounded-none",
                  "bg-red-600",
                  "border-2 border-black/30",
                  "shadow-[3px_3px_0_0_rgba(0,0,0,0.3)]"
                )}
              />
              {enlargedPin.image_url ? (
                getMediaType(enlargedPin.image_url) === 'video' ? (
                  <video
                    src={enlargedPin.image_url}
                    controls
                    className="w-full rounded-none bg-zinc-200"
                  />
                ) : getMediaType(enlargedPin.image_url) === 'audio' ? (
                  <div className="flex aspect-square items-center justify-center bg-zinc-100 flex-col gap-3 p-4">
                    <Mic className="w-12 h-12 text-zinc-400" />
                    <audio controls className="w-full" preload="metadata">
                      <source src={enlargedPin.image_url} />
                    </audio>
                  </div>
                ) : (
                  <img
                    src={enlargedPin.image_url}
                    alt={enlargedPin.title}
                    className="w-full rounded-none bg-zinc-200"
                  />
                )
              ) : (
                <div className="flex aspect-square items-center justify-center bg-zinc-100 text-center p-6 font-mono">
                  <p className="text-lg font-bold text-zinc-700">{enlargedPin.title}</p>
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 px-3 pb-2">
                <p className="truncate text-sm font-bold text-zinc-800 font-mono">
                  {enlargedPin.title}
                </p>
                {enlargedPin.content && (
                  <p className="text-xs text-zinc-600 font-mono mt-0.5">
                    {enlargedPin.content}
                  </p>
                )}
                <p className="truncate text-xs text-zinc-500 font-mono">
                  {enlargedPin.circles?.name || ""}
                </p>
              </div>
              {/* Action buttons */}
              <div className="absolute top-1 right-1 flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-none text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50"
                  onClick={async () => {
                    if (enlargedPin.image_url) {
                      try {
                        const res = await fetch(enlargedPin.image_url);
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        const ext = enlargedPin.image_url.split(".").pop()?.split("?")[0] || "file";
                        a.download = `${enlargedPin.title}.${ext}`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      } catch {
                        window.open(enlargedPin.image_url, "_blank");
                      }
                    } else {
                      const text = `${enlargedPin.title}${enlargedPin.content ? `\n\n${enlargedPin.content}` : ""}`;
                      const blob = new Blob([text], { type: "text/plain" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${enlargedPin.title}.txt`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }
                  }}
                  aria-label="Download"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-none text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50"
                  onClick={() => setEnlargedPin(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
