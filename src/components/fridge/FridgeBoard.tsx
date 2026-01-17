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
 * Values are percentages and offset/rotation for a scattered "pinned" look.
 */
const PIN_LAYOUT: Array<{ top: string; left: string; rotate: number }> = [
  { top: "4%", left: "4%", rotate: -8 },
  { top: "6%", left: "36%", rotate: 5 },
  { top: "3%", left: "68%", rotate: -3 },
  { top: "38%", left: "8%", rotate: 4 },
  { top: "40%", left: "40%", rotate: -6 },
  { top: "36%", left: "72%", rotate: 7 },
  { top: "68%", left: "12%", rotate: -4 },
  { top: "70%", left: "52%", rotate: 3 },
];

/**
 * 8 colorful "magnets" for visual variety
 */
const MAGNET_COLORS = [
  "bg-red-500",
  "bg-yellow-400",
  "bg-green-500",
  "bg-blue-500",
  "bg-pink-400",
  "bg-purple-500",
  "bg-orange-400",
  "bg-teal-400",
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
      className={cn("w-full", className)}
    >
      {/* Fridge container */}
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border-4 border-border/80",
          "bg-gradient-to-b from-[hsl(210,20%,92%)] via-[hsl(210,18%,88%)] to-[hsl(210,16%,82%)]",
          "dark:from-[hsl(210,10%,20%)] dark:via-[hsl(210,12%,18%)] dark:to-[hsl(210,14%,14%)]",
          "shadow-[inset_0_2px_12px_rgba(0,0,0,0.06),0_8px_24px_-8px_rgba(0,0,0,0.18)]"
        )}
      >
        {/* Subtle metallic reflection */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent" />

        {/* Fridge handle (decorative) */}
        <div
          className={cn(
            "absolute right-3 top-1/2 -translate-y-1/2 z-10",
            "h-24 w-3 rounded-full",
            "bg-gradient-to-b from-border/60 via-border to-border/60",
            "shadow-[inset_0_2px_4px_rgba(255,255,255,0.2),0_2px_6px_rgba(0,0,0,0.15)]"
          )}
        />

        {/* Pinned items area */}
        <div className="relative aspect-[4/3] sm:aspect-[16/9] w-full p-4">
          {pins.slice(0, 8).map((pin, idx) => {
            const layout = PIN_LAYOUT[idx];
            const canDelete = canDeleteCircleId(pin.circle_id);
            const magnetColor = MAGNET_COLORS[idx % MAGNET_COLORS.length];

            return (
              <div
                key={pin.id}
                className={cn(
                  "absolute",
                  "w-[40%] sm:w-[22%]",
                  "transition-all duration-300 ease-out",
                  "hover:scale-105 hover:z-20 group"
                )}
                style={{
                  top: layout.top,
                  left: layout.left,
                  transform: `rotate(${layout.rotate}deg)`,
                }}
              >
                {/* Polaroid frame */}
                <div
                  className={cn(
                    "relative bg-white dark:bg-zinc-100 rounded-sm p-1 pb-10",
                    "shadow-[0_4px_16px_rgba(0,0,0,0.15),0_1px_3px_rgba(0,0,0,0.08)]",
                    "transition-shadow duration-300",
                    "group-hover:shadow-[0_8px_24px_rgba(0,0,0,0.22),0_2px_6px_rgba(0,0,0,0.1)]"
                  )}
                >
                  {/* Magnet on top */}
                  <div
                    className={cn(
                      "absolute -top-2 left-1/2 -translate-x-1/2 z-10",
                      "h-4 w-10 rounded-full",
                      magnetColor,
                      "shadow-md",
                      "transition-transform duration-200",
                      "group-hover:scale-110"
                    )}
                  />

                  {/* Photo area */}
                  {pin.image_url ? (
                    <img
                      src={pin.image_url}
                      alt={pin.title}
                      loading="lazy"
                      className="block w-full aspect-square object-cover bg-muted"
                    />
                  ) : (
                    <div className="flex aspect-square items-center justify-center bg-muted/50 text-center text-xs text-muted-foreground p-2">
                      {pin.title}
                    </div>
                  )}

                  {/* Caption area (below photo like real polaroid) */}
                  <div className="absolute bottom-0 left-0 right-0 px-2 pb-2 pt-1">
                    <p className="truncate text-xs font-medium text-zinc-800 dark:text-zinc-800">
                      {pin.title}
                    </p>
                    <p className="truncate text-[10px] text-zinc-500">
                      {pin.circles?.name || ""}
                    </p>
                  </div>

                  {/* Delete button (visible on hover) */}
                  {canDelete && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className={cn(
                        "absolute -top-3 -right-3 h-7 w-7 rounded-full",
                        "opacity-0 group-hover:opacity-100",
                        "transition-opacity duration-200",
                        "shadow-lg"
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

          {/* Empty slots indicator */}
          {pins.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
              <div className="text-4xl mb-2">📷</div>
              <p className="text-sm">No photos pinned yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Capacity indicator */}
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {pins.length} of 8 spots filled
        </span>
        {pins.length >= 8 && (
          <span className="text-amber-600 dark:text-amber-400 font-medium">
            Fridge is full — remove one to add another
          </span>
        )}
      </div>
    </section>
  );
}
