import { Capacitor } from "@capacitor/core";

/**
 * Centralized platform detection. Use these helpers — never call
 * Capacitor.getPlatform() directly inside feature code so that web tests
 * and SSR-style renders never explode.
 */

export const isIOSNative = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

export const isAndroidNative = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

export const isMobileNative = () => Capacitor.isNativePlatform();

export const isWeb = () => !Capacitor.isNativePlatform();

/** Returns 'ios' | 'android' | 'web'. */
export const currentPlatform = (): "ios" | "android" | "web" => {
  if (isIOSNative()) return "ios";
  if (isAndroidNative()) return "android";
  return "web";
};
