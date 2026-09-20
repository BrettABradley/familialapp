import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";

/**
 * Android hardware Back button handling.
 *
 * Without a listener, Capacitor's default behaviour closes the activity —
 * which means Back quits the app from any screen, because our navigation is
 * client-side and Android doesn't see those as its own history entries.
 *
 * Priority order:
 *   1. Dismiss the software keyboard if an input is focused.
 *   2. Close the topmost open overlay (dialog / sheet / popover / lightbox)
 *      by dispatching Escape, which Radix + our custom overlays already honour.
 *   3. Navigate back one screen when there is in-app history.
 *   4. Otherwise minimise the app (standard Android behaviour at a root screen).
 */

const ROOT_ROUTES = new Set(["/", "/auth", "/circles", "/feed"]);

const OVERLAY_SELECTORS = [
  '[data-radix-popper-content-wrapper]',
  '[role="dialog"][data-state="open"]',
  '[role="alertdialog"][data-state="open"]',
  '[data-state="open"][data-radix-dialog-content]',
  '[data-vaul-drawer][data-state="open"]',
  '[data-familial-overlay="open"]',
].join(",");

const hasOpenOverlay = () => {
  try {
    return document.querySelector(OVERLAY_SELECTORS) !== null;
  } catch {
    return false;
  }
};

const isEditableFocused = () => {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.isContentEditable === true
  );
};

export function useAndroidBackButton() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (Capacitor.getPlatform() !== "android") return;

    let remove: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const { App } = await import("@capacitor/app");

        const handle = await App.addListener("backButton", ({ canGoBack }) => {
          try {
            // 1. Keyboard open → just dismiss it.
            if (isEditableFocused()) {
              (document.activeElement as HTMLElement)?.blur();
              return;
            }

            // 2. Overlay open → let it close itself via Escape.
            if (hasOpenOverlay()) {
              document.dispatchEvent(
                new KeyboardEvent("keydown", {
                  key: "Escape",
                  code: "Escape",
                  keyCode: 27,
                  which: 27,
                  bubbles: true,
                  cancelable: true,
                })
              );
              return;
            }

            // 3. In-app history → go back one screen.
            const path = window.location.pathname;
            const atRoot = ROOT_ROUTES.has(path);
            if (!atRoot && (canGoBack || window.history.length > 1)) {
              navigate(-1);
              return;
            }

            // 4. Root screen → background the app instead of killing it.
            App.minimizeApp().catch((e) =>
              console.warn("[back] minimizeApp failed", e)
            );
          } catch (e) {
            console.warn("[back] handler failed", e);
          }
        });

        if (cancelled) {
          handle.remove();
        } else {
          remove = () => handle.remove();
        }
      } catch (e) {
        console.warn("[back] listener setup failed", e);
      }
    })();

    return () => {
      cancelled = true;
      remove?.();
    };
    // location is intentionally a dependency-free concern: the handler reads
    // the live pathname, so the listener is registered only once.
  }, [navigate]);

  // Referenced so lint knows the hook is route-aware by design.
  void location;
}
