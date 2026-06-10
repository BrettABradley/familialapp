import { useEffect, useState } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { useCircleContext } from "@/contexts/CircleContext";

/**
 * When a notification deep-link includes `?circle=ID` (or legacy `?circleId=ID`),
 * automatically switch the active circle so the rest of the page renders
 * the right data. Also listens for the `familial:deep-link` event emitted
 * by the native push handler so cold-launch navigations sync the header
 * immediately, even before React Router re-reads the URL.
 */
export function useDeepLinkCircleSync() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { circles, selectedCircle, setSelectedCircle, lockCircleSwitcher } = useCircleContext();
  const [pushTick, setPushTick] = useState(0);

  // Re-evaluate when a deep link arrives from a tapped push notification.
  useEffect(() => {
    const onDeepLink = () => setPushTick((n) => n + 1);
    window.addEventListener("familial:deep-link", onDeepLink);
    return () => window.removeEventListener("familial:deep-link", onDeepLink);
  }, []);

  useEffect(() => {
    // Never switch circles while an album lock is active — the user is
    // viewing a specific album and a circle change would load stale data.
    if (lockCircleSwitcher) return;

    // Prefer the live URL (covers programmatic pushState that React Router
    // hasn't reconciled yet) over the cached searchParams.
    const live = new URLSearchParams(window.location.search);
    const target =
      live.get("circle") ||
      live.get("circleId") ||
      searchParams.get("circle") ||
      searchParams.get("circleId");

    if (!target) return;
    if (circles.length === 0) return;
    if (selectedCircle === target) return;
    if (circles.some((c) => c.id === target)) {
      setSelectedCircle(target);
    }
  }, [searchParams, circles, selectedCircle, setSelectedCircle, location.pathname, pushTick, lockCircleSwitcher]);
}
