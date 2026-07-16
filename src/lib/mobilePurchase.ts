/**
 * Unified mobile purchase facade — picks Apple StoreKit on iOS and
 * Google Play Billing on Android. Web returns false (purchases route
 * through Stripe Checkout instead).
 *
 * Existing iOS-only callers can keep importing from `iapPurchase` for
 * back-compat. New code, and any call site that should work on both
 * platforms, should import from here.
 */
import { isIOSNative, isAndroidNative, isMobileNative } from "./platform";
import * as Apple from "./iapPurchase";
import * as Google from "./googlePlayPurchase";

/** Resolve the right product ID for the current native platform. */
export const productIdFor = (
  kind: "family" | "extended" | "extraMembers"
): string | null => {
  if (isIOSNative()) return Apple.APPLE_PRODUCTS[kind];
  if (isAndroidNative()) return Google.GOOGLE_PRODUCTS[kind];
  return null;
};

export const prewarmProducts = async () => {
  try {
    if (isIOSNative()) return await Apple.prewarmProducts();
    if (isAndroidNative()) return await Google.prewarmProducts();
  } catch (err) {
    console.warn("[mobilePurchase] prewarmProducts failed:", err);
  }
  return [];
};

export const getCachedProducts = (): Record<string, any> => {
  try {
    if (isIOSNative()) return Apple.getCachedProducts();
    if (isAndroidNative()) return Google.getCachedProducts();
  } catch (err) {
    console.warn("[mobilePurchase] getCachedProducts failed:", err);
  }
  return {};
};

export const purchaseSubscription = async (
  productId: string,
  extras?: { circleId?: string; rescue_circle_id?: string }
): Promise<boolean> => {
  if (isIOSNative()) return Apple.purchaseSubscription(productId, extras);
  if (isAndroidNative()) return Google.purchaseSubscription(productId, extras);
  return false;
};

export const purchaseConsumable = async (
  productId: string,
  extras: { circleId: string; kind: "extra_members" }
): Promise<boolean> => {
  if (isIOSNative()) return Apple.purchaseConsumable(productId, extras);
  if (isAndroidNative()) return Google.purchaseConsumable(productId, extras);
  return false;
};

export const restorePurchases = async (): Promise<boolean> => {
  try {
    if (isIOSNative()) return await Apple.restorePurchases();
    if (isAndroidNative()) return await Google.restorePurchases();
  } catch (err) {
    console.warn("[mobilePurchase] restorePurchases failed:", err);
  }
  return false;
};

/**
 * Open the platform's native subscription-management page.
 * iOS → App Store account subscriptions.
 * Android → Google Play account subscriptions.
 * Web → no-op (caller should route to Stripe customer portal).
 *
 * Accepts either a raw store product id or a plan kind for convenience.
 */
export const openNativeSubscriptionManagement = (
  productIdOrKind?: string | "family" | "extended" | "extraMembers"
) => {
  try {
    if (isIOSNative()) {
      Apple.openAppleSubscriptionManagement();
      return;
    }
    if (isAndroidNative()) {
      // If the caller passed a plan kind, resolve to the Google product id.
      let productId = productIdOrKind;
      if (
        productIdOrKind === "family" ||
        productIdOrKind === "extended" ||
        productIdOrKind === "extraMembers"
      ) {
        productId = Google.GOOGLE_PRODUCTS[productIdOrKind];
      }
      Google.openPlaySubscriptionManagement(productId as string | undefined);
      return;
    }
  } catch (err) {
    console.warn("[mobilePurchase] openNativeSubscriptionManagement failed:", err);
  }
};

export { isIOSNative, isAndroidNative, isMobileNative };
