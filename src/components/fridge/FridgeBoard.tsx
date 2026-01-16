import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

const PIN_LAYOUT: Array<{ top: string; left: string; rotate: number }> = [
  { top: "6%", left: "8%", rotate: -6 },
  { top: "8%", left: "38%", rotate: 4 },
  { top: "10%", left: "68%", rotate: -2 },
  { top: "40%", left: "12%", rotate: 3 },
  { top: "42%", left: "42%", rotate: -4 },
  { top: "44%", left: "72%", rotate: 6 },
  { top: "70%", left: "18%", rotate: -3 },
  { top: "72%", left: "55%", rotate: 2 },
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
    <section aria-label="Family fridge board" className={cn("w-full", className)}>
      <Card className="relative overflow-hidden border bg-muted/30">
        {/* Fridge feel */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-background/20 via-transparent to-background/10" />
        <div className="pointer-events-none absolute inset-0 opacity-30">
          <div className="absolute -left-10 top-8 h-24 w-24 rounded-full bg-background/30 blur-2xl" />
          <div className="absolute right-0 top-32 h-28 w-28 rounded-full bg-background/20 blur-2xl" />
        </div>

        <div className="relative aspect-[4/3] sm:aspect-[16/9] w-full">
          {pins.slice(0, 8).map((pin, idx) => {
            const layout = PIN_LAYOUT[idx % PIN_LAYOUT.length];
            const canDelete = canDeleteCircleId(pin.circle_id);

            return (
              <div
                key={pin.id}
                className={cn(
                  "absolute",
                  "w-[38%] sm:w-[24%]",
                  "transition-transform duration-200",
                  "hover:scale-[1.02]"
                )}
                style={{
                  top: layout.top,
                  left: layout.left,
                  transform: `rotate(${layout.rotate}deg)`,
                }}
              >
                <div className="relative rounded-lg border bg-card shadow-sm overflow-hidden">
                  {/* "Magnet" */}
                  <div className="absolute -top-2 left-1/2 h-4 w-12 -translate-x-1/2 rounded-full border bg-muted shadow-sm" />

                  {pin.image_url ? (
                    <img
                      src={pin.image_url}
                      alt={pin.title}
                      loading="lazy"
                      className="block aspect-[4/3] w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center p-4 text-center text-sm text-muted-foreground">
                      {pin.title}
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{pin.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {pin.circles?.name ? `${pin.circles.name} • ` : ""}
                        {new Date(pin.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    {canDelete && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="-mr-1 -mt-1 h-8 w-8"
                        onClick={() => onDelete(pin)}
                        aria-label={`Remove ${pin.title} from fridge`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <p className="mt-3 text-xs text-muted-foreground">Showing up to 8 pinned photos.</p>
    </section>
  );
}
