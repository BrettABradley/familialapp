import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";

export interface FridgeBoardPin {
  id: string;
  title: string;
  image_url: string | null;
  circle_id: string;
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
  canDeleteCircleId,
  onDelete,
  className,
}: {
  pins: FridgeBoardPin[];
  canDeleteCircleId: (circleId: string) => boolean;
  onDelete: (pin: FridgeBoardPin) => void;
  className?: string;
}) {
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
            Familial
          </div>

          {/* Pinned items area */}
          {/* Taller aspect ratio for more fridge-like proportions */}
          <div className="relative aspect-[3/4] sm:aspect-[2/3] w-full p-4 pt-12">
            {pins.slice(0, 8).map((pin, idx) => {
              const layout = PIN_LAYOUT[idx];
              const canDelete = canDeleteCircleId(pin.circle_id);
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
                      "relative bg-white p-1 pb-6",
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

                    {/* Photo area */}
                    {pin.image_url ? (
                      <img
                        src={pin.image_url}
                        alt={pin.title}
                        loading="lazy"
                        className="block w-full aspect-square object-cover bg-zinc-200"
                        style={{ imageRendering: "auto" }}
                      />
                    ) : (
                      <div className="flex aspect-square items-center justify-center bg-zinc-100 text-center text-[10px] text-zinc-500 p-1 font-mono">
                        {pin.title}
                      </div>
                    )}

                    {/* Caption */}
                    <div className="absolute bottom-0 left-0 right-0 px-1 pb-1">
                      <p className="truncate text-[9px] font-bold text-zinc-800 font-mono">
                        {pin.title}
                      </p>
                      <p className="truncate text-[8px] text-zinc-500 font-mono">
                        {pin.circles?.name || ""}
                      </p>
                    </div>

                    {/* Delete button */}
                    {canDelete && (
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
    </section>
  );
}
