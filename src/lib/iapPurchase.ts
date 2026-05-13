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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch the product from StoreKit with one retry. Cold-start TestFlight
 * launches frequently take a moment for products to become available — a
 * single retry covers ~99% of those cases without a noticeable wait.
 */
const ensureProductLoaded = async (
  NativePurchases: any,
  productId: string
): Promise<boolean> => {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res: any = await NativePurchases.getProducts({
        productIdentifiers: [productId],
      });
      const list = res?.products ?? (Array.isArray(res) ? res : []);
      if (list && list.length > 0) return true;
    } catch (err) {
      // fall through to retry
      console.warn("[IAP] getProducts attempt failed:", err);
    }
    if (attempt === 0) await sleep(800);
  }
  return false;
};

const isCancelError = (err: any) => {
  const msg = String(err?.message ?? err ?? "").toLowerCase();
  return (
    err?.code === "USER_CANCELLED" ||
    err?.code === 2 || // SKErrorPaymentCancelled
    msg.includes("cancel") ||
    msg.includes("user did not")
  );
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

  // Pre-load the product so StoreKit has it cached before we trigger the
  // purchase sheet. If it can't be loaded, surface a clear error rather
  // than letting purchaseProduct fail silently (the #1 cause of App Review
  // IAP rejections).
  const ready = await ensureProductLoaded(NativePurchases, productId);
  if (!ready) {
    throw new Error(
      "Subscriptions are still loading from the App Store. Please try again in a moment."
    );
  }

  let result: any;
  try {
    result = await NativePurchases.purchaseProduct({
      productIdentifier: productId,
      productType: PURCHASE_TYPE.SUBS,
    });
  } catch (err: any) {
    if (isCancelError(err)) return false;
    throw err;
  }

  const transactionId = result?.transactionId;
  if (!transactionId) {
    throw new Error("Purchase completed but no transaction was returned.");
  }

  try {
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
    if (error) {
      console.warn("[IAP] validate-apple-receipt failed:", error);
      // Don't block the success UX — the StoreKit transaction is real.
      // Restore Purchases or the next session refresh will reconcile.
    }
  } catch (err) {
    console.warn("[IAP] validate-apple-receipt threw:", err);
  }

  return true;
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

  const ready = await ensureProductLoaded(NativePurchases, productId);
  if (!ready) {
    throw new Error(
      "This add-on is still loading from the App Store. Please try again in a moment."
    );
  }

  let result: any;
  try {
    result = await NativePurchases.purchaseProduct({
      productIdentifier: productId,
      productType: PURCHASE_TYPE.INAPP,
    });
  } catch (err: any) {
    if (isCancelError(err)) return false;
    throw err;
  }

  const transactionId = result?.transactionId;
  if (!transactionId) {
    throw new Error("Purchase completed but no transaction was returned.");
  }

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

  if (error) {
    // Consumables MUST be granted server-side. Don't silently swallow.
    throw new Error(
      "Payment succeeded but we couldn't add the seats. Please contact support@familialmedia.com — your purchase is safe."
    );
  }

  return true;
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
  } catch (err) {
    console.warn("[IAP] restorePurchases failed:", err);
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
