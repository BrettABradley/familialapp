import { supabase } from "@/integrations/supabase/client";
import { isAndroidNative } from "./platform";

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
  // @vite-ignore — only loaded on Android native, never bundled into web SSR paths.
  const mod = await import("@capgo/capacitor-purchases");
  return mod;
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

  const { data, error } = await supabase.functions.invoke("validate-google-receipt", {
    body: {
      kind: "subscription",
      productId,
      purchaseToken,
      ...(extras ?? {}),
    },
  });

  if (error || (data as any)?.error) {
    const detail = (data as any)?.error || error?.message || "Unknown validation error";
    console.error("[GoogleIAP] validate-google-receipt failed:", detail);
    throw new Error(
      `Payment went through, but we couldn't activate your plan automatically. ` +
      `Please tap "Restore Purchases" or contact support@familialmedia.com — your purchase is safe. (${detail})`
    );
  }
  return true;
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

  const { error } = await supabase.functions.invoke("validate-google-receipt", {
    body: {
      kind: extras.kind,
      productId,
      purchaseToken,
      circleId: extras.circleId,
    },
  });

  if (error) {
    throw new Error(
      "Payment succeeded but we couldn't add the seats. Please contact support@familialmedia.com — your purchase is safe."
    );
  }

  return true;
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
    return !error;
  } catch (err) {
    console.warn("[GoogleIAP] restorePurchases failed:", err);
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
