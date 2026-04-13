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
 * Uses @capgo/capacitor-native-purchases (free, open-source StoreKit 2 plugin).
 * Dynamic import avoids build errors when the plugin isn't available in web builds.
 */
export const purchaseSubscription = async (productId: string): Promise<boolean> => {
  if (!isIOSNative()) return false;

  try {
    const mod = await (Function('return import("@capgo/native-purchases")')() as Promise<any>);
    const { NativePurchases, PURCHASE_TYPE } = mod;

    const { products } = await NativePurchases.getProducts({
      productIdentifiers: [productId],
      productType: PURCHASE_TYPE.SUBS,
    });

    if (!products || products.length === 0) {
      throw new Error("Product not found");
    }

    const result = await NativePurchases.purchaseProduct({
      productIdentifier: productId,
      productType: PURCHASE_TYPE.SUBS,
    });

    if (result?.transactionId) {
      const { error } = await supabase.functions.invoke("validate-apple-receipt", {
        body: {
          transactionId: result.transactionId,
          productId,
        },
      });

      if (error) throw error;

      await NativePurchases.finishTransaction({
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
    const mod = await (Function('return import("@capgo/native-purchases")')() as Promise<any>);
    const { NativePurchases } = mod;

    await NativePurchases.getPurchases();

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
