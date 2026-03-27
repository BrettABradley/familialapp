import React from "react";
import { Loader2 } from "lucide-react";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

interface PullToRefreshWrapperProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
}

export const PullToRefreshWrapper = ({
  onRefresh,
  children,
  className = "",
}: PullToRefreshWrapperProps) => {
  const { containerRef, pullDistance, isRefreshing, isNative } =
    usePullToRefresh({ onRefresh });

  if (!isNative) {
    return <div className={className}>{children}</div>;
  }

  const opacity = Math.min(pullDistance / 60, 1);
  const indicatorTranslate = Math.min(pullDistance, 60) - 40;

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      className={`relative ${className}`}
      style={{ overscrollBehavior: "none" }}
    >
      {/* Pull indicator */}
      <div
        className="absolute left-0 right-0 flex justify-center z-10 pointer-events-none"
        style={{
          top: 0,
          transform: `translateY(${indicatorTranslate}px)`,
          opacity,
          transition: pullDistance === 0 ? "all 0.3s ease" : "none",
        }}
      >
        <div className="bg-background border border-border rounded-full p-2 shadow-md">
          <Loader2
            className={`w-5 h-5 text-primary ${isRefreshing ? "animate-spin" : ""}`}
            style={{
              transform: isRefreshing
                ? undefined
                : `rotate(${pullDistance * 3}deg)`,
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          transform: `translateY(${pullDistance > 0 ? pullDistance : 0}px)`,
          transition: pullDistance === 0 ? "transform 0.3s ease" : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
};
