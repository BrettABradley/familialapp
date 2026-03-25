import { cn } from "@/lib/utils";

/**
 * Animated pixel-art campsite scene with fire, logs, trees, night sky.
 */
export function PixelCampfire({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const sizeMap = { sm: "w-20 h-20", md: "w-32 h-32", lg: "w-56 h-56" };
  const isSmall = size === "sm";
  const isLarge = size === "lg";

  return (
    <div className={cn("relative flex items-end justify-center overflow-hidden", sizeMap[size], className)} style={{ imageRendering: "pixelated" }}>
      {/* Night sky background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a2e] via-[#121240] to-[#1a1a3e]" />

      {/* Stars */}
      {!isSmall && (
        <>
          <div className="absolute top-[8%] left-[15%] w-1 h-1 bg-white/80 rounded-none animate-[campfire-spark_2s_ease-in-out_infinite]" />
          <div className="absolute top-[12%] left-[55%] w-1 h-1 bg-white/60 rounded-none animate-[campfire-spark_3s_ease-in-out_infinite_1s]" />
          <div className="absolute top-[5%] left-[80%] w-1 h-1 bg-white/70 rounded-none animate-[campfire-spark_2.5s_ease-in-out_infinite_0.5s]" />
          <div className="absolute top-[18%] left-[35%] w-0.5 h-0.5 bg-white/50 rounded-none" />
          <div className="absolute top-[15%] left-[70%] w-0.5 h-0.5 bg-white/40 rounded-none" />
        </>
      )}

      {/* Tree silhouettes */}
      {!isSmall && (
        <>
          {/* Left tree */}
          <div className="absolute bottom-[28%] left-[8%]">
            <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-b-[16px] border-l-transparent border-r-transparent border-b-[#0d2b0d]"
              style={{ width: isLarge ? 0 : 0, borderLeftWidth: isLarge ? 12 : 8, borderRightWidth: isLarge ? 12 : 8, borderBottomWidth: isLarge ? 24 : 16 }} />
            <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[12px] border-l-transparent border-r-transparent border-b-[#0d2b0d] -mt-2 mx-auto"
              style={{ borderLeftWidth: isLarge ? 10 : 6, borderRightWidth: isLarge ? 10 : 6, borderBottomWidth: isLarge ? 18 : 12 }} />
          </div>
          {/* Right tree */}
          <div className="absolute bottom-[30%] right-[10%]">
            <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[14px] border-l-transparent border-r-transparent border-b-[#0a250a]"
              style={{ borderLeftWidth: isLarge ? 10 : 6, borderRightWidth: isLarge ? 10 : 6, borderBottomWidth: isLarge ? 20 : 14 }} />
            <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-b-[10px] border-l-transparent border-r-transparent border-b-[#0a250a] -mt-1.5 mx-auto"
              style={{ borderLeftWidth: isLarge ? 8 : 5, borderRightWidth: isLarge ? 8 : 5, borderBottomWidth: isLarge ? 14 : 10 }} />
          </div>
        </>
      )}

      {/* Ground */}
      <div className="absolute bottom-0 left-0 right-0 bg-[#2d1f0e]" style={{ height: isSmall ? 10 : isLarge ? 28 : 18 }} />
      <div className="absolute left-0 right-0 bg-[#3a2a14]" style={{ height: isSmall ? 3 : isLarge ? 6 : 4, bottom: isSmall ? 10 : isLarge ? 28 : 18 }} />

      {/* Stone ring around fire */}
      {!isSmall && (
        <div className="absolute left-1/2 -translate-x-1/2 flex gap-[2px]" style={{ bottom: isLarge ? 26 : 16 }}>
          {[...Array(isLarge ? 7 : 5)].map((_, i) => (
            <div key={i} className="rounded-none" style={{
              width: isLarge ? 6 : 4,
              height: isLarge ? 5 : 3,
              backgroundColor: i % 2 === 0 ? "#5a5a5a" : "#6b6b6b",
            }} />
          ))}
        </div>
      )}

      {/* Logs */}
      <div className="absolute left-1/2 -translate-x-1/2 flex gap-0.5" style={{ bottom: isSmall ? 10 : isLarge ? 26 : 16 }}>
        <div className="bg-amber-900 rounded-none" style={{ width: isSmall ? 8 : isLarge ? 20 : 12, height: isSmall ? 4 : isLarge ? 8 : 6 }} />
        <div className="bg-amber-800 rounded-none" style={{ width: isSmall ? 8 : isLarge ? 20 : 12, height: isSmall ? 4 : isLarge ? 8 : 6 }} />
      </div>
      <div className="absolute left-1/2 bg-amber-950 rounded-none" style={{ width: isSmall ? 20 : isLarge ? 48 : 30, height: isSmall ? 3 : isLarge ? 6 : 4, bottom: isSmall ? 11 : isLarge ? 28 : 17, transform: "translateX(-50%) rotate(-8deg)" }} />
      <div className="absolute left-1/2 bg-amber-900 rounded-none" style={{ width: isSmall ? 20 : isLarge ? 48 : 30, height: isSmall ? 3 : isLarge ? 6 : 4, bottom: isSmall ? 11 : isLarge ? 28 : 17, transform: "translateX(-50%) rotate(8deg)" }} />

      {/* Fire layers */}
      <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center" style={{ bottom: isSmall ? 12 : isLarge ? 30 : 19 }}>
        {/* Core - yellow */}
        <div
          className="rounded-none animate-[campfire-flicker_0.3s_ease-in-out_infinite_alternate]"
          style={{
            width: isSmall ? 6 : isLarge ? 16 : 10,
            height: isSmall ? 8 : isLarge ? 22 : 14,
            backgroundColor: "hsl(48, 96%, 53%)",
          }}
        />
        {/* Mid - orange */}
        <div
          className="absolute bottom-0 rounded-none animate-[campfire-flicker_0.4s_ease-in-out_infinite_alternate-reverse]"
          style={{
            width: isSmall ? 10 : isLarge ? 24 : 16,
            height: isSmall ? 12 : isLarge ? 32 : 20,
            backgroundColor: "hsl(25, 95%, 53%)",
            opacity: 0.85,
          }}
        />
        {/* Outer - red */}
        <div
          className="absolute bottom-0 rounded-none animate-[campfire-flicker_0.5s_ease-in-out_infinite_alternate]"
          style={{
            width: isSmall ? 14 : isLarge ? 32 : 22,
            height: isSmall ? 16 : isLarge ? 38 : 24,
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

      {/* Fire glow on ground */}
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-full animate-[campfire-glow_1s_ease-in-out_infinite_alternate] pointer-events-none"
        style={{
          width: isSmall ? 36 : isLarge ? 100 : 64,
          height: isSmall ? 20 : isLarge ? 50 : 32,
          bottom: isSmall ? 6 : isLarge ? 18 : 12,
          background: "radial-gradient(ellipse, hsla(25, 95%, 53%, 0.35) 0%, transparent 70%)",
        }}
      />

      {/* Tent silhouette (lg only) */}
      {isLarge && (
        <div className="absolute bottom-[28px] right-[12%]">
          <div className="w-0 h-0 border-l-[18px] border-r-[18px] border-b-[28px] border-l-transparent border-r-transparent border-b-[#2a1a0a]" />
        </div>
      )}
    </div>
  );
}
