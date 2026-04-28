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
 * Lazy-load the @capgo/native-purchases plugin only on native iOS.
 * Using a normal dynamic import (Vite resolves it at build time) — the
 * previous Function('return import(...)') trick was being blocked by the
 * WKWebView CSP, which is why purchases silently failed on device.
 */
const loadPlugin = async () => {
  // @vite-ignore — the plugin is installed but only registered on native
  const mod = await import("@capgo/native-purchases");
  return mod;
};

/**
 * Purchase a subscription via Apple IAP.
 */
export const purchaseSubscription = async (productId: string): Promise<boolean> => {
  if (!isIOSNative()) return false;

  const { NativePurchases, PURCHASE_TYPE } = await loadPlugin();

  try {
    const result: any = await NativePurchases.purchaseProduct({
      productIdentifier: productId,
      productType: PURCHASE_TYPE.SUBS,
    });

    const transactionId = result?.transactionId;
    if (!transactionId) return false;

    const { error } = await supabase.functions.invoke("validate-apple-receipt", {
      body: {
        transactionId,
        productId,
        receipt: result?.receipt ?? null,
        jwsRepresentation: result?.jwsRepresentation ?? null,
      },
    });

    if (error) throw error;

    try {
      await NativePurchases.finishTransaction({ transactionIdentifier: transactionId });
    } catch {
      // non-fatal — Apple may have already finished the transaction
    }

    return true;
  } catch (err: any) {
    const msg = String(err?.message ?? err ?? "").toLowerCase();
    if (err?.code === "USER_CANCELLED" || msg.includes("cancel")) {
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
    const { NativePurchases } = await loadPlugin();
    await NativePurchases.restorePurchases();

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
