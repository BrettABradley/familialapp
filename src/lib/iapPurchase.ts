import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

// Apple IAP product IDs — must match App Store Connect
export const APPLE_PRODUCTS = {
  family: "com.familialmedia.familial.family.monthly",
  extended: "com.familialmedia.familial.extended.monthly",
  extraMembers: "com.familialmedia.familial.extramembers",
};

export const isIOSNative = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

const loadPlugin = async () => {
  // @vite-ignore
  const mod = await import("@capgo/native-purchases");
  return mod;
};

/**
 * Purchase a subscription via Apple IAP.
 * Optional `extras` are forwarded to validate-apple-receipt for circle
 * rescue / membership transfer flows.
 */
export const purchaseSubscription = async (
  productId: string,
  extras?: { circleId?: string; rescue_circle_id?: string }
): Promise<boolean> => {
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
        kind: "subscription",
        transactionId,
        productId,
        receipt: result?.receipt ?? null,
        jwsRepresentation: result?.jwsRepresentation ?? null,
        ...(extras ?? {}),
      },
    });

    if (error) throw error;
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
 * Purchase a one-time consumable via Apple IAP (e.g. extra member seats).
 */
export const purchaseConsumable = async (
  productId: string,
  extras: { circleId: string; kind: "extra_members" }
): Promise<boolean> => {
  if (!isIOSNative()) return false;

  const { NativePurchases, PURCHASE_TYPE } = await loadPlugin();

  try {
    const result: any = await NativePurchases.purchaseProduct({
      productIdentifier: productId,
      productType: PURCHASE_TYPE.CONSUMABLE,
    });

    const transactionId = result?.transactionId;
    if (!transactionId) return false;

    const { error } = await supabase.functions.invoke("validate-apple-receipt", {
      body: {
        kind: extras.kind,
        transactionId,
        productId,
        circleId: extras.circleId,
        receipt: result?.receipt ?? null,
        jwsRepresentation: result?.jwsRepresentation ?? null,
      },
    });

    if (error) throw error;
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
