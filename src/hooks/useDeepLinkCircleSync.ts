import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useCircleContext } from "@/contexts/CircleContext";

/**
 * When a notification deep-link includes `?circle=ID` (or legacy `?circleId=ID`),
 * automatically switch the active circle so the rest of the page renders
 * the right data. No-op when neither param is present or the circle is
 * already selected.
 */
export function useDeepLinkCircleSync() {
  const [searchParams] = useSearchParams();
  const { circles, selectedCircle, setSelectedCircle } = useCircleContext();
  const target = searchParams.get("circle") || searchParams.get("circleId");

  useEffect(() => {
    if (!target) return;
    if (circles.length === 0) return;
    if (selectedCircle === target) return;
    // Only switch if the user is actually a member of the target circle.
    if (circles.some((c) => c.id === target)) {
      setSelectedCircle(target);
    }
  }, [target, circles, selectedCircle, setSelectedCircle]);
}
