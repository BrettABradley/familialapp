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

// Module-level cache of StoreKit Product objects, keyed by productIdentifier.
// Populated by prewarmProducts() so subsequent purchase attempts hit a warm
// cache and the UI can render Apple-validated localized prices.
const productCache: Record<string, any> = {};

const RETRY_DELAYS_MS = [800, 1500];

const parseProductList = (res: any): any[] => {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.products)) return res.products;
  return [];
};

/**
 * Pre-warm StoreKit by fetching all known product IDs once. Call on mount
 * of any screen that may trigger a purchase (Pricing page, Upgrade dialog,
 * Rescue dialog) so by the time the user taps Buy, the product is cached.
 *
 * Required by App Store guideline 2.1(b) — reviewers were hitting "Cannot
 * find product" because StoreKit hadn't finished loading on cold start.
 *
 * Returns the list of loaded products (empty if iOS not native or load failed).
 */
export const prewarmProducts = async (): Promise<any[]> => {
  if (!isIOSNative()) return [];

  const productIds = [
    APPLE_PRODUCTS.family,
    APPLE_PRODUCTS.extended,
    APPLE_PRODUCTS.extraMembers,
  ];

  try {
    const { NativePurchases } = await loadPlugin();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res: any = await NativePurchases.getProducts({ productIdentifiers: productIds });
        const list = parseProductList(res);
        console.log("[IAP][diag] prewarmProducts", {
          platform: "ios",
          attempt: attempt + 1,
          requested: productIds,
          returned: list.map((p: any) => p?.identifier ?? p?.productIdentifier),
        });
        if (list.length > 0) {
          for (const p of list) {
            const id = p?.identifier ?? p?.productIdentifier;
            if (id) productCache[id] = p;
          }
          return list;
        }
      } catch (err) {
        console.warn("[IAP][diag] prewarm attempt failed:", attempt + 1, err);
      }
      if (attempt < 2) await sleep(RETRY_DELAYS_MS[attempt] ?? 1500);
    }
  } catch (err) {
    console.warn("[IAP][diag] prewarm plugin load failed:", err);
  }
  return [];
};

export const getCachedProducts = (): Record<string, any> => productCache;

/**
 * Fetch the product from StoreKit with up to 3 attempts and incremental
 * backoff. App Review's sandbox cold start sometimes takes >1s to surface
 * products, so we retry generously to avoid spurious 2.1(b) rejections.
 */
const ensureProductLoaded = async (
  NativePurchases: any,
  productId: string
): Promise<boolean> => {
  if (productCache[productId]) return true;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res: any = await NativePurchases.getProducts({
        productIdentifiers: [productId],
      });
      const list = parseProductList(res);
      console.log("[IAP][diag] ensureProductLoaded", {
        platform: "ios",
        productId,
        attempt: attempt + 1,
        returned: list.map((p: any) => p?.identifier ?? p?.productIdentifier),
      });
      if (list.length > 0) {
        for (const p of list) {
          const id = p?.identifier ?? p?.productIdentifier;
          if (id) productCache[id] = p;
        }
        return true;
      }
    } catch (err) {
      console.warn("[IAP][diag] getProducts attempt failed:", attempt + 1, err);
    }
    if (attempt < 2) await sleep(RETRY_DELAYS_MS[attempt] ?? 1500);
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
