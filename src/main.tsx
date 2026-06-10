import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import App from "./App.tsx";
import "./index.css";
import { initCapacitorPlugins, hideSplashScreen } from "./lib/capacitorInit";
import ErrorBoundary from "./components/shared/ErrorBoundary";

console.log("[boot] react-mount-start");

// Global guards — never let an unhandled rejection escape to the native
// WKWebView host where it could be interpreted as a crash by Apple's
// automated review.
window.addEventListener("error", (e) => {
  console.error("[boot] window.error", e?.message, e?.error);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("[boot] unhandledrejection", (e as PromiseRejectionEvent)?.reason);
});

try {
  createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
  console.log("[boot] react-mount-end");

  // Wait for React to commit AND the browser to actually paint a frame
  // (double rAF) before starting the splash hand-off. The HTML overlay
  // (#splash in index.html) covers the WebView the whole time, so the
  // native splash can hide invisibly underneath it; the overlay then
  // holds for 2.5s and fades out over 700ms.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const isNative = Capacitor.isNativePlatform();

      // On web, the splash overlay is unnecessary — remove it immediately
      // so the landing page paints without any artificial delay.
      if (!isNative) {
        const el = document.getElementById("splash");
        el?.parentNode?.removeChild(el);
        return;
      }

      // Native (iOS/Android): hide native splash, hold the HTML overlay
      // for ~2.5s, then slowly fade it out.
      hideSplashScreen().catch((e) =>
        console.warn("[boot] hideSplashScreen rejected", e)
      );

      setTimeout(() => {
        const el = document.getElementById("splash");
        if (!el) return;
        el.classList.add("splash-hide");
        setTimeout(() => {
          el.parentNode?.removeChild(el);
        }, 800);
      }, 2500);
    });
  });
} catch (e) {
  console.error("[boot] react render threw", e);
  // Even if render throws, don't leave the splash up forever.
  hideSplashScreen().catch(() => {});
}

// Defer native plugin init until after first paint so a misbehaving plugin
// can never block the UI from mounting.
const startNativeInit = () => {
  initCapacitorPlugins().catch((e) =>
    console.error("[boot] initCapacitorPlugins rejected", e)
  );
};
if (typeof (window as any).requestIdleCallback === "function") {
  (window as any).requestIdleCallback(startNativeInit, { timeout: 1500 });
} else {
  setTimeout(startNativeInit, 0);
}
