import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

// Apple IAP product IDs — must match App Store Connect
export const APPLE_PRODUCTS = {
  family: "com.familialmedia.familial.family.monthly",
  extended: "com.familialmedia.familial.extended.monthly",
};

export const isIOSNative = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

/**
 * Purchase a subscription via Apple IAP.
 * Uses the Capacitor In-App Purchase plugin.
 * After purchase, validates receipt server-side.
 */
export const purchaseSubscription = async (productId: string): Promise<boolean> => {
  if (!isIOSNative()) return false;

  try {
    // Dynamically import to avoid issues on web
    const { InAppPurchases } = await import("@capawesome/capacitor-in-app-purchases");

    // Connect to App Store
    await InAppPurchases.initialize();

    // Get product info
    const { products } = await InAppPurchases.getProducts({
      productIdentifiers: [productId],
    });

    if (!products || products.length === 0) {
      throw new Error("Product not found");
    }

    // Start purchase
    const result = await InAppPurchases.purchaseProduct({
      productIdentifier: productId,
    });

    if (result?.transactionId) {
      // Validate receipt server-side
      const { error } = await supabase.functions.invoke("validate-apple-receipt", {
        body: {
          transactionId: result.transactionId,
          productId,
        },
      });

      if (error) throw error;

      // Finish the transaction
      await InAppPurchases.finishTransaction({
        transactionIdentifier: result.transactionId,
      });

      return true;
    }

    return false;
  } catch (err: any) {
    // User cancelled
    if (err?.code === "USER_CANCELLED" || err?.message?.includes("cancel")) {
      return false;
    }
    throw err;
  }
};

/**
 * Restore previous purchases (required by Apple guidelines).
 */
export const restorePurchases = async (): Promise<boolean> => {
  if (!isIOSNative()) return false;

  try {
    const { InAppPurchases } = await import("@capawesome/capacitor-in-app-purchases");
    await InAppPurchases.initialize();
    await InAppPurchases.restorePurchases();

    // Re-validate with server
    const { error } = await supabase.functions.invoke("validate-apple-receipt", {
      body: { restore: true },
    });

    return !error;
  } catch {
    return false;
  }
};

/**
 * Open Apple's subscription management page.
 */
export const openAppleSubscriptionManagement = () => {
  if (isIOSNative()) {
    window.open("https://apps.apple.com/account/subscriptions", "_blank");
  }
};
