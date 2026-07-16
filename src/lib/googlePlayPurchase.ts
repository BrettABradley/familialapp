import { supabase } from "@/integrations/supabase/client";
import { isAndroidNative } from "./platform";
import {
  enqueuePendingGoogleReceipt,
  removePendingGoogleReceipt,
  submitGoogleReceipt,
} from "./googlePlayReceiptQueue";


/**
 * Google Play product IDs — must match Play Console SKUs.
 * Configured in Play Console → Monetize → In-app products / Subscriptions.
 */
export const GOOGLE_PRODUCTS = {
  family: "family_monthly",
  extended: "extended_monthly",
  extraMembers: "extra_members",
};

// Subscription IDs vs. one-time products are treated differently by
// Play Billing — kept here so the validator knows which API to hit.
const SUBSCRIPTION_PRODUCT_IDS = new Set<string>([
  GOOGLE_PRODUCTS.family,
  GOOGLE_PRODUCTS.extended,
]);

const productCache: Record<string, any> = {};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const RETRY_DELAYS_MS = [800, 1500];

const loadPlugin = async () => {
  try {
    // @vite-ignore — only loaded on Android native, never bundled into web SSR paths.
    const mod = await import("@capgo/capacitor-purchases");
    return mod;
  } catch (err) {
    console.warn("[GoogleIAP] plugin load failed:", err);
    throw new Error(
      "In-app purchases aren't available right now. Please update the app from Google Play and try again."
    );
  }
};

const parseProductList = (res: any): any[] => {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.products)) return res.products;
  return [];
};

export const prewarmProducts = async (): Promise<any[]> => {
  if (!isAndroidNative()) return [];

  const productIds = [
    GOOGLE_PRODUCTS.family,
    GOOGLE_PRODUCTS.extended,
    GOOGLE_PRODUCTS.extraMembers,
  ];

  try {
    const plugin: any = await loadPlugin();
    const PurchasesPlugin = plugin.Purchases ?? plugin.CapacitorPurchases ?? plugin.default;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res: any = await PurchasesPlugin.getProducts({ productIdentifiers: productIds });
        const list = parseProductList(res);
        if (list.length > 0) {
          for (const p of list) {
            const id = p?.identifier ?? p?.productIdentifier ?? p?.productId;
            if (id) productCache[id] = p;
          }
          return list;
        }
      } catch (err) {
        console.warn("[GoogleIAP] prewarm attempt failed:", attempt + 1, err);
      }
      if (attempt < 2) await sleep(RETRY_DELAYS_MS[attempt] ?? 1500);
    }
  } catch (err) {
    console.warn("[GoogleIAP] prewarm plugin load failed:", err);
  }
  return [];
};

export const getCachedProducts = (): Record<string, any> => productCache;

const isCancelError = (err: any) => {
  const msg = String(err?.message ?? err ?? "").toLowerCase();
  return (
    err?.code === "USER_CANCELLED" ||
    err?.code === 1 || // BillingResponseCode.USER_CANCELED
    msg.includes("cancel")
  );
};

const extractPurchaseToken = (result: any): string | null =>
  result?.purchaseToken ??
  result?.transactionId ??
  result?.purchase?.purchaseToken ??
  null;

export const purchaseSubscription = async (
  productId: string,
  extras?: { circleId?: string; rescue_circle_id?: string }
): Promise<boolean> => {
  if (!isAndroidNative()) return false;

  const plugin: any = await loadPlugin();
  const PurchasesPlugin = plugin.Purchases ?? plugin.CapacitorPurchases ?? plugin.default;

  let result: any;
  try {
    result = await PurchasesPlugin.purchaseProduct({
      productIdentifier: productId,
      productType: "subs",
    });
  } catch (err: any) {
    if (isCancelError(err)) return false;
    throw err;
  }

  const purchaseToken = extractPurchaseToken(result);
  if (!purchaseToken) {
    throw new Error("Purchase completed but no purchase token was returned.");
  }

  // Persist BEFORE calling the backend so a failure never loses the receipt.
  // The queue drains on launch / resume / sign-in and the server-side
  // google_iap_grants unique index makes retries safe.
  enqueuePendingGoogleReceipt({
    kind: "subscription",
    productId,
    purchaseToken,
    circleId: extras?.circleId,
    rescue_circle_id: extras?.rescue_circle_id,
  });

  const submission = await submitGoogleReceipt({
    id: "", createdAt: 0, attempts: 0,
    kind: "subscription",
    productId,
    purchaseToken,
    circleId: extras?.circleId,
    rescue_circle_id: extras?.rescue_circle_id,
  });

  if (submission === "credited") {
    removePendingGoogleReceipt(purchaseToken);
    return true;
  }

  throw new Error(
    "Google confirmed your payment. We'll finish activating your plan automatically — usually within a few minutes. " +
    "You can close the app safely; no further action is needed."
  );
};

export const purchaseConsumable = async (
  productId: string,
  extras: { circleId: string; kind: "extra_members" }
): Promise<boolean> => {
  if (!isAndroidNative()) return false;

  const plugin: any = await loadPlugin();
  const PurchasesPlugin = plugin.Purchases ?? plugin.CapacitorPurchases ?? plugin.default;

  let result: any;
  try {
    result = await PurchasesPlugin.purchaseProduct({
      productIdentifier: productId,
      productType: "inapp",
    });
  } catch (err: any) {
    if (isCancelError(err)) return false;
    throw err;
  }

  const purchaseToken = extractPurchaseToken(result);
  if (!purchaseToken) {
    throw new Error("Purchase completed but no purchase token was returned.");
  }

  enqueuePendingGoogleReceipt({
    kind: extras.kind,
    productId,
    purchaseToken,
    circleId: extras.circleId,
  });

  const submission = await submitGoogleReceipt({
    id: "", createdAt: 0, attempts: 0,
    kind: extras.kind,
    productId,
    purchaseToken,
    circleId: extras.circleId,
  });

  if (submission === "credited") {
    removePendingGoogleReceipt(purchaseToken);
    return true;
  }

  throw new Error(
    "Google confirmed your payment. We'll finish adding your seats automatically — usually within a few minutes. " +
    "You can close the app safely; no further action is needed."
  );
};

export const restorePurchases = async (): Promise<boolean> => {
  if (!isAndroidNative()) return false;
  try {
    const plugin: any = await loadPlugin();
    const PurchasesPlugin = plugin.Purchases ?? plugin.CapacitorPurchases ?? plugin.default;
    await PurchasesPlugin.restorePurchases();
    const { error } = await supabase.functions.invoke("validate-google-receipt", {
      body: { restore: true },
    });
    // Also drain any queued receipts that never made it through.
    const { drainPendingGoogleReceipts } = await import("./googlePlayReceiptQueue");
    const credited = await drainPendingGoogleReceipts();
    console.log("[GoogleIAP] restorePurchases drained", { credited });
    return !error;
  } catch (err) {
    console.warn("[GoogleIAP] restorePurchases failed:", err);
    try {
      const { drainPendingGoogleReceipts } = await import("./googlePlayReceiptQueue");
      await drainPendingGoogleReceipts();
    } catch {}
    return false;
  }
};

/**
 * Open Google Play's subscription management page (Play policy 3.4).
 */
export const openPlaySubscriptionManagement = (
  productId?: string,
  packageName?: string
) => {
  if (!isAndroidNative()) return;
  const base = "https://play.google.com/store/account/subscriptions";
  const params = new URLSearchParams();
  if (productId && SUBSCRIPTION_PRODUCT_IDS.has(productId)) params.set("sku", productId);
  if (packageName) params.set("package", packageName);
  const url = params.toString() ? `${base}?${params}` : base;
  window.open(url, "_blank");
};
