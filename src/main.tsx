import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initCapacitorPlugins } from "./lib/capacitorInit";
import ErrorBoundary from "./components/shared/ErrorBoundary";

console.log("[boot] react-mount-start");

// EARLY hash-token interceptor — must run BEFORE supabase-js is imported
// anywhere (its createClient auto-consumes access_token in the URL hash via
// detectSessionInUrl). If a verification email link landed on any path other
// than /auth/callback or /reset-password, hard-redirect to /auth/callback so
// the browser never auto-signs-in.
try {
  const hash = window.location.hash || "";
  const path = window.location.pathname || "/";
  const isAuthLanding =
    path === "/auth/callback" || path === "/reset-password";
  const looksLikeAuthHash =
    /access_token=/.test(hash) ||
    /type=signup/.test(hash) ||
    /type=recovery/.test(hash) ||
    /type=invite/.test(hash) ||
    /type=magiclink/.test(hash);
  if (!isAuthLanding && looksLikeAuthHash) {
    window.location.replace("/auth/callback" + window.location.search + hash);
    // Stop the rest of bootstrap from running; the replace navigation is
    // already in-flight.
    throw new Error("__auth_hash_redirect__");
  }
} catch (e) {
  if ((e as Error)?.message !== "__auth_hash_redirect__") {
    console.warn("[boot] hash-token interceptor failed", e);
  } else {
    throw e;
  }
}

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
} catch (e) {
  console.error("[boot] react render threw", e);
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
