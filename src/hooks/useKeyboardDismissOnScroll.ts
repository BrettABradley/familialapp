import { useEffect, RefObject } from "react";

/**
 * Dismisses the on-screen keyboard when the user scrolls (touchmove)
 * within the element referenced by `ref`. If no ref is provided,
 * listens on the document.
 */
export function useKeyboardDismissOnScroll(ref?: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const handler = () => {
      const el = document.activeElement;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement
      ) {
        el.blur();
      }
    };

    const target = ref?.current ?? document;
    target.addEventListener("touchmove", handler, { passive: true });
    return () => {
      target.removeEventListener("touchmove", handler);
    };
  }, [ref]);
}
