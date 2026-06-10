import { createRoot } from "react-dom/client";
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
      // Hide the native splash now — the HTML overlay is on top.
      hideSplashScreen().catch((e) =>
        console.warn("[boot] hideSplashScreen rejected", e)
      );

      // Hold the HTML splash for ~2.5s, then slowly fade it out.
      setTimeout(() => {
        const el = document.getElementById("splash");
        if (!el) return;
        el.classList.add("splash-hide");
        // Remove from the DOM after the 700ms CSS fade completes.
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
