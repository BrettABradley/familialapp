import { Capacitor } from "@capacitor/core";

/**
 * Haptic feedback wrapper — no-op on web, native taps on iOS/Android.
 * Wrapped in try/catch and dynamic import so launch never fails if the
 * plugin is missing.
 */
const isNative = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

async function withHaptics<T>(fn: (h: typeof import("@capacitor/haptics")) => Promise<T>) {
  if (!isNative()) return;
  try {
    const h = await import("@capacitor/haptics");
    await fn(h);
  } catch {
    // swallow — never let haptics break UX
  }
}

export const haptic = {
  light: () => withHaptics(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light })),
  medium: () => withHaptics(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Medium })),
  heavy: () => withHaptics(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Heavy })),
  selection: () => withHaptics(({ Haptics }) => Haptics.selectionStart().then(() => Haptics.selectionEnd())),
  success: () => withHaptics(({ Haptics, NotificationType }) => Haptics.notification({ type: NotificationType.Success })),
  warning: () => withHaptics(({ Haptics, NotificationType }) => Haptics.notification({ type: NotificationType.Warning })),
  error: () => withHaptics(({ Haptics, NotificationType }) => Haptics.notification({ type: NotificationType.Error })),
};

/**
 * Throttled typing haptic — fires light feedback every Nth keystroke
 * so it doesn't overwhelm the user while typing.
 */
let typingTickCount = 0;
export function typingHaptic(everyN = 4) {
  typingTickCount = (typingTickCount + 1) % everyN;
  if (typingTickCount === 0) haptic.light();
}
