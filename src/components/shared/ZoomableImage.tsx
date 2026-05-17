import { useRef, useState, ReactNode } from "react";
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from "react-zoom-pan-pinch";

interface ZoomableImageProps {
  /** Render-prop for the image so callers can keep using SmartImage, plain img, etc. */
  children: ReactNode;
  /** Fired on single-finger horizontal/vertical swipes when not zoomed in. */
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeDown?: () => void;
  className?: string;
}

/**
 * Pinch-zoom + pan wrapper.
 * - Two-finger pinch (1x–4x), double-tap to toggle 2.5x, scroll-wheel (with ctrl/cmd) on desktop.
 * - Swipe gestures only fire when scale === 1 so they don't fight panning.
 */
export const ZoomableImage = ({
  children,
  onSwipeLeft,
  onSwipeRight,
  onSwipeDown,
  className,
}: ZoomableImageProps) => {
  const apiRef = useRef<ReactZoomPanPinchRef | null>(null);
  const [scale, setScale] = useState(1);
  const touchStart = useRef<{ x: number; y: number; touches: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) {
      touchStart.current = null;
      return;
    }
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      touches: 1,
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || scale > 1.05) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const dx = start.x - endX;
    const dy = endY - start.y;
    if (dy > 80 && Math.abs(dx) < 50) {
      onSwipeDown?.();
      return;
    }
    if (dx > 50 && Math.abs(dy) < 80) onSwipeLeft?.();
    else if (dx < -50 && Math.abs(dy) < 80) onSwipeRight?.();
  };

  return (
    <div
      className={className}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <TransformWrapper
        ref={apiRef}
        minScale={1}
        maxScale={4}
        initialScale={1}
        doubleClick={{ mode: "toggle", step: 1.5 }}
        wheel={{ step: 0.2, activationKeys: ["Control", "Meta"] }}
        pinch={{ step: 5 }}
        panning={{ disabled: scale <= 1.05 }}
        onTransformed={(_, state) => setScale(state.scale)}
      >
        <TransformComponent
          wrapperStyle={{ width: "100%", height: "100%" }}
          contentStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          {children}
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
};
