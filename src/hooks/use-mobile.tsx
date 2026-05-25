import * as React from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Resolves true when the viewport width is below the mobile breakpoint.
 *
 * Listens to `matchMedia` AND `resize` / `orientationchange` because iOS
 * Safari/WKWebView can fire `matchMedia` before `window.innerWidth` has
 * settled during portrait→landscape→portrait rotations. Without the extra
 * listeners the state can get stuck on `false`, which unmounts the bottom
 * nav (it returns `null` when `isMobile` is false) and the nav never comes
 * back when the user rotates back to portrait.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const compute = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    compute();

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    // Re-check on the next frame too — iOS sometimes reports a stale
    // innerWidth on the synchronous change event during rotation.
    const onChange = () => {
      compute();
      requestAnimationFrame(compute);
      setTimeout(compute, 300);
    };

    mql.addEventListener("change", onChange);
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
    try {
      window.screen?.orientation?.addEventListener?.("change", onChange);
    } catch {}

    return () => {
      mql.removeEventListener("change", onChange);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
      try {
        window.screen?.orientation?.removeEventListener?.("change", onChange);
      } catch {}
    };
  }, []);

  return !!isMobile;
}
