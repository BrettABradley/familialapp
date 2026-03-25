import { cn } from "@/lib/utils";

/**
 * Rich pixel-art campsite scene: night sky with moon & stars, pine trees,
 * stone ring, logs, animated fire with sparks, tent, ground details, fireflies.
 */
export function PixelCampfire({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const sizeMap = { sm: "w-full h-full", md: "w-32 h-32", lg: "w-full aspect-[4/3]" };
  const isSmall = size === "sm";
  const isLarge = size === "lg";

  return (
    <div className={cn("relative flex items-end justify-center overflow-hidden", sizeMap[size], className)} style={{ imageRendering: "pixelated" }}>
      {/* Night sky */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#05051a] via-[#0a0a2e] to-[#151540]" />

      {/* Moon */}
      {!isSmall && (
        <div className="absolute rounded-none" style={{
          top: isLarge ? "6%" : "8%",
          right: isLarge ? "12%" : "15%",
          width: isLarge ? 18 : 10,
          height: isLarge ? 18 : 10,
          backgroundColor: "#f0e68c",
          boxShadow: "0 0 12px 4px rgba(240,230,140,0.3)",
        }} />
      )}

      {/* Stars - many layers for depth */}
      <div className="absolute top-[5%] left-[10%] w-1 h-1 bg-white/90 rounded-none animate-[campfire-spark_2s_ease-in-out_infinite]" />
      <div className="absolute top-[8%] left-[30%] w-0.5 h-0.5 bg-white/60 rounded-none animate-[campfire-spark_3s_ease-in-out_infinite_0.5s]" />
      <div className="absolute top-[12%] left-[50%] w-1 h-1 bg-white/70 rounded-none animate-[campfire-spark_2.5s_ease-in-out_infinite_1s]" />
      {!isSmall && (
        <>
          <div className="absolute top-[3%] left-[70%] w-0.5 h-0.5 bg-white/50 rounded-none" />
          <div className="absolute top-[15%] left-[85%] w-1 h-1 bg-white/40 rounded-none animate-[campfire-spark_4s_ease-in-out_infinite_2s]" />
          <div className="absolute top-[7%] left-[45%] w-0.5 h-0.5 bg-white/60 rounded-none" />
          <div className="absolute top-[18%] left-[22%] w-0.5 h-0.5 bg-white/30 rounded-none animate-[campfire-spark_3.5s_ease-in-out_infinite_1.5s]" />
          <div className="absolute top-[10%] left-[62%] w-1 h-1 bg-white/50 rounded-none animate-[campfire-spark_2s_ease-in-out_infinite_0.8s]" />
          <div className="absolute top-[4%] left-[90%] w-0.5 h-0.5 bg-white/70 rounded-none" />
          <div className="absolute top-[20%] left-[78%] w-0.5 h-0.5 bg-white/40 rounded-none" />
        </>
      )}
      {isLarge && (
        <>
          <div className="absolute top-[2%] left-[5%] w-1 h-1 bg-white/80 rounded-none animate-[campfire-spark_2.2s_ease-in-out_infinite_0.3s]" />
          <div className="absolute top-[14%] left-[40%] w-0.5 h-0.5 bg-white/50 rounded-none" />
          <div className="absolute top-[6%] left-[55%] w-1 h-1 bg-white/60 rounded-none animate-[campfire-spark_3s_ease-in-out_infinite_0.7s]" />
          <div className="absolute top-[9%] left-[18%] w-0.5 h-0.5 bg-white/70 rounded-none" />
          <div className="absolute top-[16%] left-[92%] w-1 h-1 bg-white/30 rounded-none animate-[campfire-spark_4s_ease-in-out_infinite_1s]" />
        </>
      )}

      {/* Distant mountain range silhouette */}
      {!isSmall && (
        <div className="absolute left-0 right-0" style={{ bottom: isLarge ? "32%" : "30%" }}>
          <div className="flex items-end justify-center w-full" style={{ height: isLarge ? 40 : 20 }}>
            {[20, 35, 28, 40, 22, 38, 25, 32, 18, 36, 24, 30].map((h, i) => (
              <div key={i} className="flex-1 rounded-none" style={{
                height: `${h * (isLarge ? 1 : 0.6)}px`,
                backgroundColor: i % 2 === 0 ? "#0d1a0d" : "#0f1f0f",
              }} />
            ))}
          </div>
        </div>
      )}

      {/* Pine tree silhouettes - varied sizes and positions */}
      {!isSmall && (
        <>
          {/* Far left tree cluster */}
          <div className="absolute" style={{ bottom: isLarge ? "28%" : "26%", left: "3%" }}>
            <div className="flex flex-col items-center">
              {[0, 1, 2].map(layer => (
                <div key={layer} className="rounded-none" style={{
                  width: isLarge ? 16 - layer * 4 : 10 - layer * 2,
                  height: isLarge ? 10 : 6,
                  backgroundColor: "#0a1f0a",
                  marginTop: layer === 0 ? 0 : isLarge ? -4 : -2,
                }} />
              ))}
              <div className="rounded-none" style={{ width: isLarge ? 4 : 2, height: isLarge ? 8 : 4, backgroundColor: "#2a1a0a" }} />
            </div>
          </div>
          {/* Left mid tree */}
          <div className="absolute" style={{ bottom: isLarge ? "28%" : "26%", left: "12%" }}>
            <div className="flex flex-col items-center">
              {[0, 1, 2, 3].map(layer => (
                <div key={layer} className="rounded-none" style={{
                  width: isLarge ? 20 - layer * 4 : 12 - layer * 2,
                  height: isLarge ? 10 : 6,
                  backgroundColor: layer % 2 === 0 ? "#0d2b0d" : "#0a250a",
                  marginTop: layer === 0 ? 0 : isLarge ? -4 : -2,
                }} />
              ))}
              <div className="rounded-none" style={{ width: isLarge ? 4 : 2, height: isLarge ? 10 : 5, backgroundColor: "#3a2510" }} />
            </div>
          </div>
          {/* Right tree */}
          <div className="absolute" style={{ bottom: isLarge ? "28%" : "26%", right: "8%" }}>
            <div className="flex flex-col items-center">
              {[0, 1, 2].map(layer => (
                <div key={layer} className="rounded-none" style={{
                  width: isLarge ? 18 - layer * 4 : 10 - layer * 2,
                  height: isLarge ? 10 : 6,
                  backgroundColor: layer % 2 === 0 ? "#0a250a" : "#0d2b0d",
                  marginTop: layer === 0 ? 0 : isLarge ? -4 : -2,
                }} />
              ))}
              <div className="rounded-none" style={{ width: isLarge ? 4 : 2, height: isLarge ? 8 : 4, backgroundColor: "#2a1a0a" }} />
            </div>
          </div>
          {/* Far right small tree */}
          <div className="absolute" style={{ bottom: isLarge ? "28%" : "26%", right: "18%" }}>
            <div className="flex flex-col items-center">
              {[0, 1].map(layer => (
                <div key={layer} className="rounded-none" style={{
                  width: isLarge ? 12 - layer * 4 : 8 - layer * 2,
                  height: isLarge ? 8 : 5,
                  backgroundColor: "#0d2b0d",
                  marginTop: layer === 0 ? 0 : isLarge ? -3 : -2,
                }} />
              ))}
              <div className="rounded-none" style={{ width: isLarge ? 3 : 2, height: isLarge ? 6 : 3, backgroundColor: "#3a2510" }} />
            </div>
          </div>
        </>
      )}

      {/* Ground layers */}
      <div className="absolute bottom-0 left-0 right-0 bg-[#1a1208]" style={{ height: isSmall ? 12 : isLarge ? 40 : 20 }} />
      <div className="absolute left-0 right-0 bg-[#2d1f0e]" style={{ height: isSmall ? 8 : isLarge ? 24 : 14, bottom: isSmall ? 12 : isLarge ? 40 : 20 }} />
      <div className="absolute left-0 right-0 bg-[#3a2a14]" style={{ height: isSmall ? 3 : isLarge ? 8 : 4, bottom: isSmall ? 20 : isLarge ? 64 : 34 }} />

      {/* Ground texture dots */}
      {!isSmall && (
        <>
          {[15, 30, 50, 70, 85].map((left, i) => (
            <div key={i} className="absolute rounded-none" style={{
              width: isLarge ? 3 : 2, height: isLarge ? 2 : 1,
              bottom: isLarge ? 44 + (i % 3) * 6 : 22 + (i % 3) * 3,
              left: `${left}%`,
              backgroundColor: i % 2 === 0 ? "#4a3a1a" : "#3a2a10",
            }} />
          ))}
        </>
      )}

      {/* Tent silhouette (left side) */}
      {!isSmall && (
        <div className="absolute" style={{ bottom: isLarge ? 60 : 32, left: isLarge ? "20%" : "18%" }}>
          <div className="w-0 h-0" style={{
            borderLeftWidth: isLarge ? 22 : 12,
            borderRightWidth: isLarge ? 22 : 12,
            borderBottomWidth: isLarge ? 34 : 18,
            borderLeftColor: "transparent",
            borderRightColor: "transparent",
            borderBottomColor: "#2a1a0a",
          }} />
          {/* Tent opening */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-none" style={{
            width: isLarge ? 10 : 5,
            height: isLarge ? 14 : 7,
            backgroundColor: "#1a1008",
          }} />
        </div>
      )}

      {/* Stone ring around fire */}
      <div className="absolute left-1/2 -translate-x-1/2 flex gap-[1px]" style={{ bottom: isSmall ? 18 : isLarge ? 56 : 30 }}>
        {[...Array(isSmall ? 5 : isLarge ? 9 : 7)].map((_, i) => (
          <div key={i} className="rounded-none" style={{
            width: isSmall ? 3 : isLarge ? 7 : 4,
            height: isSmall ? 2 : isLarge ? 6 : 4,
            backgroundColor: i % 3 === 0 ? "#5a5a5a" : i % 3 === 1 ? "#6b6b6b" : "#4a4a4a",
          }} />
        ))}
      </div>

      {/* Logs (crossed) */}
      <div className="absolute left-1/2 -translate-x-1/2 flex gap-0.5" style={{ bottom: isSmall ? 18 : isLarge ? 56 : 30 }}>
        <div className="bg-amber-900 rounded-none" style={{ width: isSmall ? 6 : isLarge ? 18 : 10, height: isSmall ? 3 : isLarge ? 7 : 5 }} />
        <div className="bg-amber-800 rounded-none" style={{ width: isSmall ? 6 : isLarge ? 18 : 10, height: isSmall ? 3 : isLarge ? 7 : 5 }} />
      </div>
      <div className="absolute left-1/2 bg-amber-950 rounded-none" style={{
        width: isSmall ? 18 : isLarge ? 44 : 26,
        height: isSmall ? 2 : isLarge ? 5 : 3,
        bottom: isSmall ? 19 : isLarge ? 58 : 31,
        transform: "translateX(-50%) rotate(-10deg)",
      }} />
      <div className="absolute left-1/2 bg-amber-900 rounded-none" style={{
        width: isSmall ? 18 : isLarge ? 44 : 26,
        height: isSmall ? 2 : isLarge ? 5 : 3,
        bottom: isSmall ? 19 : isLarge ? 58 : 31,
        transform: "translateX(-50%) rotate(10deg)",
      }} />

      {/* Fire layers */}
      <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center" style={{ bottom: isSmall ? 20 : isLarge ? 60 : 33 }}>
        {/* Outer - red */}
        <div
          className="absolute bottom-0 rounded-none animate-[campfire-flicker_0.5s_ease-in-out_infinite_alternate]"
          style={{
            width: isSmall ? 12 : isLarge ? 30 : 20,
            height: isSmall ? 14 : isLarge ? 36 : 22,
            backgroundColor: "hsl(0, 72%, 51%)",
            opacity: 0.7,
          }}
        />
        {/* Mid - orange */}
        <div
          className="absolute bottom-0 rounded-none animate-[campfire-flicker_0.4s_ease-in-out_infinite_alternate-reverse]"
          style={{
            width: isSmall ? 8 : isLarge ? 22 : 14,
            height: isSmall ? 10 : isLarge ? 30 : 18,
            backgroundColor: "hsl(25, 95%, 53%)",
            opacity: 0.85,
          }}
        />
        {/* Core - yellow */}
        <div
          className="rounded-none animate-[campfire-flicker_0.3s_ease-in-out_infinite_alternate]"
          style={{
            width: isSmall ? 5 : isLarge ? 14 : 8,
            height: isSmall ? 7 : isLarge ? 20 : 12,
            backgroundColor: "hsl(48, 96%, 53%)",
          }}
        />
        {/* White-hot center */}
        <div
          className="absolute bottom-0 rounded-none animate-[campfire-flicker_0.25s_ease-in-out_infinite_alternate]"
          style={{
            width: isSmall ? 3 : isLarge ? 8 : 4,
            height: isSmall ? 4 : isLarge ? 10 : 6,
            backgroundColor: "hsl(48, 100%, 85%)",
            opacity: 0.9,
          }}
        />

        {/* Sparks */}
        <div className="absolute -top-1 left-1 w-1 h-1 rounded-none animate-[campfire-spark_0.8s_ease-out_infinite]" style={{ backgroundColor: "hsl(48, 96%, 53%)" }} />
        <div className="absolute -top-3 right-0 w-1 h-1 rounded-none animate-[campfire-spark_1.2s_ease-out_infinite_0.4s]" style={{ backgroundColor: "hsl(25, 95%, 53%)" }} />
        {!isSmall && (
          <>
            <div className="absolute -top-2 -left-1 w-0.5 h-0.5 rounded-none animate-[campfire-spark_1s_ease-out_infinite_0.6s]" style={{ backgroundColor: "hsl(48, 96%, 70%)" }} />
            <div className="absolute -top-4 right-1 w-0.5 h-0.5 rounded-none animate-[campfire-spark_1.4s_ease-out_infinite_0.2s]" style={{ backgroundColor: "hsl(25, 95%, 60%)" }} />
          </>
        )}
      </div>

      {/* Fire glow on ground */}
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-full animate-[campfire-glow_1s_ease-in-out_infinite_alternate] pointer-events-none"
        style={{
          width: isSmall ? 40 : isLarge ? 140 : 70,
          height: isSmall ? 20 : isLarge ? 60 : 32,
          bottom: isSmall ? 10 : isLarge ? 32 : 16,
          background: "radial-gradient(ellipse, hsla(25, 95%, 53%, 0.4) 0%, hsla(25, 95%, 53%, 0.1) 50%, transparent 70%)",
        }}
      />

      {/* Ambient firelight on trees/tent */}
      {isLarge && (
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-full animate-[campfire-glow_1.5s_ease-in-out_infinite_alternate] pointer-events-none"
          style={{
            width: 240,
            height: 120,
            bottom: 40,
            background: "radial-gradient(ellipse, hsla(25, 80%, 50%, 0.12) 0%, transparent 70%)",
          }}
        />
      )}

      {/* Fireflies (lg only) */}
      {isLarge && (
        <>
          <div className="absolute w-1 h-1 rounded-none animate-[campfire-spark_3s_ease-in-out_infinite]" style={{ top: "40%", left: "8%", backgroundColor: "hsla(60, 100%, 70%, 0.6)" }} />
          <div className="absolute w-1 h-1 rounded-none animate-[campfire-spark_4s_ease-in-out_infinite_1.5s]" style={{ top: "35%", right: "10%", backgroundColor: "hsla(60, 100%, 70%, 0.4)" }} />
          <div className="absolute w-0.5 h-0.5 rounded-none animate-[campfire-spark_2.5s_ease-in-out_infinite_0.8s]" style={{ top: "50%", left: "25%", backgroundColor: "hsla(60, 100%, 70%, 0.5)" }} />
        </>
      )}

      {/* Small log/stump detail right side */}
      {!isSmall && (
        <div className="absolute rounded-none" style={{
          bottom: isLarge ? 56 : 30,
          right: isLarge ? "30%" : "25%",
          width: isLarge ? 10 : 6,
          height: isLarge ? 6 : 4,
          backgroundColor: "#3a2510",
        }} />
      )}
    </div>
  );
}
