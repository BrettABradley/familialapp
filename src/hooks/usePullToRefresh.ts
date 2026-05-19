import { useRef, useState, useCallback, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { haptic } from "@/lib/haptics";

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  maxPull?: number;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 60,
  maxPull = 120,
}: UsePullToRefreshOptions) {
  const containerRef = useRef<HTMLElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const isNative = Capacitor.isNativePlatform();

  const isAtScrollTop = useCallback(() => {
    const el = containerRef.current;
    if (!el) return false;
    if (el.scrollTop > 0) return false;
    // The page itself usually scrolls on body/document, not on the wrapper div.
    // Only allow PTR when BOTH the wrapper and the page are at the very top —
    // otherwise scrolling back up to the top of a long page accidentally fires
    // a refresh as soon as the user reaches y=0.
    const docTop =
      window.scrollY ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0;
    return docTop <= 0;
  }, []);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (isRefreshing) return;
      if (!isAtScrollTop()) {
        pulling.current = false;
        return;
      }
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    },
    [isRefreshing, isAtScrollTop]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!pulling.current || isRefreshing) return;
      if (!isAtScrollTop()) {
        pulling.current = false;
        setPullDistance(0);
        return;
      }
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0) {
        // Dampen the pull
        const dampened = Math.min(delta * 0.5, maxPull);
        setPullDistance(dampened);
        if (dampened > 10) e.preventDefault();
      } else if (delta < -5) {
        // Finger is moving up (user is scrolling down) — abort pull entirely.
        pulling.current = false;
        setPullDistance(0);
      }
    },
    [isRefreshing, maxPull, isAtScrollTop]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold); // Hold at threshold during refresh
      haptic.light();
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, threshold, isRefreshing, onRefresh]);

  useEffect(() => {
    if (!isNative) return;
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd);

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isNative, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { containerRef, pullDistance, isRefreshing, isNative };
}
