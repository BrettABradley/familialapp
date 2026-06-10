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
  // (double rAF) before hiding the native splash. This guarantees a white
  // app frame is on screen before the splash goes away — no black flash.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      hideSplashScreen().catch((e) =>
        console.warn("[boot] hideSplashScreen rejected", e)
      );
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
