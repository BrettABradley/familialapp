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
 * Requires @capawesome/capacitor-in-app-purchases to be installed natively.
 * Uses dynamic require to avoid build errors when the plugin isn't available.
 */
export const purchaseSubscription = async (productId: string): Promise<boolean> => {
  if (!isIOSNative()) return false;

  try {
    // Dynamic import — plugin is only available in native iOS builds
    const mod = await (Function('return import("@capawesome/capacitor-in-app-purchases")')() as Promise<any>);
    const InAppPurchases = mod.InAppPurchases;

    await InAppPurchases.initialize();

    const { products } = await InAppPurchases.getProducts({
      productIdentifiers: [productId],
    });

    if (!products || products.length === 0) {
      throw new Error("Product not found");
    }

    const result = await InAppPurchases.purchaseProduct({
      productIdentifier: productId,
    });

    if (result?.transactionId) {
      const { error } = await supabase.functions.invoke("validate-apple-receipt", {
        body: {
          transactionId: result.transactionId,
          productId,
        },
      });

      if (error) throw error;

      await InAppPurchases.finishTransaction({
        transactionIdentifier: result.transactionId,
      });

      return true;
    }

    return false;
  } catch (err: any) {
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
    const mod = await (Function('return import("@capawesome/capacitor-in-app-purchases")')() as Promise<any>);
    const InAppPurchases = mod.InAppPurchases;
    await InAppPurchases.initialize();
    await InAppPurchases.restorePurchases();

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
