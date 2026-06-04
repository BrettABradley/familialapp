/**
 * Unified mobile purchase facade — picks Apple StoreKit on iOS and
 * Google Play Billing on Android. Web returns false (purchases route
 * through Stripe Checkout instead).
 *
 * Existing iOS-only callers can keep importing from `iapPurchase` for
 * back-compat. New code, and any call site that should work on both
 * platforms, should import from here.
 */
import { isIOSNative, isAndroidNative } from "./platform";
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
  if (isIOSNative()) return Apple.prewarmProducts();
  if (isAndroidNative()) return Google.prewarmProducts();
  return [];
};

export const getCachedProducts = (): Record<string, any> => {
  if (isIOSNative()) return Apple.getCachedProducts();
  if (isAndroidNative()) return Google.getCachedProducts();
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
  if (isIOSNative()) return Apple.restorePurchases();
  if (isAndroidNative()) return Google.restorePurchases();
  return false;
};

/**
 * Open the platform's native subscription-management page.
 * iOS → App Store account subscriptions.
 * Android → Google Play account subscriptions.
 * Web → no-op (caller should route to Stripe customer portal).
 */
export const openNativeSubscriptionManagement = (productId?: string) => {
  if (isIOSNative()) {
    Apple.openAppleSubscriptionManagement();
    return;
  }
  if (isAndroidNative()) {
    Google.openPlaySubscriptionManagement(productId);
    return;
  }
};

export { isIOSNative, isAndroidNative };
