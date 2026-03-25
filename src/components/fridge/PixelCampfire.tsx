import { cn } from "@/lib/utils";

/**
 * Animated pixel-art campfire using CSS keyframes.
 * Layers of colored blocks that flicker to simulate fire.
 */
export function PixelCampfire({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const sizeMap = { sm: "w-16 h-16", md: "w-24 h-24", lg: "w-40 h-40" };

  return (
    <div className={cn("relative flex items-end justify-center", sizeMap[size], className)} style={{ imageRendering: "pixelated" }}>
      {/* Logs */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-0.5">
        <div className="w-3 h-1.5 bg-amber-900 rounded-none" style={{ width: size === "sm" ? 8 : size === "lg" ? 20 : 12, height: size === "sm" ? 4 : size === "lg" ? 8 : 6 }} />
        <div className="w-3 h-1.5 bg-amber-800 rounded-none" style={{ width: size === "sm" ? 8 : size === "lg" ? 20 : 12, height: size === "sm" ? 4 : size === "lg" ? 8 : 6 }} />
      </div>
      <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 bg-amber-950 rounded-none" style={{ width: size === "sm" ? 20 : size === "lg" ? 48 : 30, height: size === "sm" ? 3 : size === "lg" ? 6 : 4, transform: "translateX(-50%) rotate(-8deg)" }} />
      <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 bg-amber-900 rounded-none" style={{ width: size === "sm" ? 20 : size === "lg" ? 48 : 30, height: size === "sm" ? 3 : size === "lg" ? 6 : 4, transform: "translateX(-50%) rotate(8deg)" }} />

      {/* Fire layers */}
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex flex-col items-center">
        {/* Core - yellow */}
        <div
          className="rounded-none animate-[campfire-flicker_0.3s_ease-in-out_infinite_alternate]"
          style={{
            width: size === "sm" ? 6 : size === "lg" ? 16 : 10,
            height: size === "sm" ? 8 : size === "lg" ? 22 : 14,
            backgroundColor: "hsl(48, 96%, 53%)",
          }}
        />
        {/* Mid - orange */}
        <div
          className="absolute bottom-0 rounded-none animate-[campfire-flicker_0.4s_ease-in-out_infinite_alternate-reverse]"
          style={{
            width: size === "sm" ? 10 : size === "lg" ? 24 : 16,
            height: size === "sm" ? 12 : size === "lg" ? 32 : 20,
            backgroundColor: "hsl(25, 95%, 53%)",
            opacity: 0.85,
          }}
        />
        {/* Outer - red */}
        <div
          className="absolute bottom-0 rounded-none animate-[campfire-flicker_0.5s_ease-in-out_infinite_alternate]"
          style={{
            width: size === "sm" ? 14 : size === "lg" ? 32 : 22,
            height: size === "sm" ? 16 : size === "lg" ? 38 : 24,
            backgroundColor: "hsl(0, 72%, 51%)",
            opacity: 0.7,
          }}
        />
        {/* Sparks */}
        <div
          className="absolute -top-1 left-0 w-1 h-1 rounded-none animate-[campfire-spark_0.8s_ease-out_infinite]"
          style={{ backgroundColor: "hsl(48, 96%, 53%)" }}
        />
        <div
          className="absolute -top-2 right-0 w-1 h-1 rounded-none animate-[campfire-spark_1.2s_ease-out_infinite_0.4s]"
          style={{ backgroundColor: "hsl(25, 95%, 53%)" }}
        />
      </div>

      {/* Glow */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full animate-[campfire-glow_1s_ease-in-out_infinite_alternate] pointer-events-none"
        style={{
          width: size === "sm" ? 32 : size === "lg" ? 80 : 50,
          height: size === "sm" ? 20 : size === "lg" ? 50 : 32,
          background: "radial-gradient(ellipse, hsla(25, 95%, 53%, 0.3) 0%, transparent 70%)",
        }}
      />
    </div>
  );
}
