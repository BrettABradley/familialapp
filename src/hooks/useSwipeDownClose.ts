import { useRef } from "react";

/**
 * Returns touch handlers for "swipe down to dismiss" on a fullscreen overlay
 * (lightbox, etc.). Triggers `onClose` only on a clear single-finger vertical
 * downward gesture, so it doesn't fight horizontal carousels or pinch-zoom.
 */
export function useSwipeDownClose(onClose: () => void, enabled = true) {
  const start = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    if (!enabled || e.touches.length !== 1) {
      start.current = null;
      return;
    }
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    // Vertical downward swipe — must dominate horizontal motion.
    if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.5) {
      onClose();
    }
  };

  return { onTouchStart, onTouchEnd };
}
