import { supabase } from "@/integrations/supabase/client";
import { isAndroidNative } from "./platform";
import { openInAppBrowser } from "./externalUrl";
import {
  enqueuePendingGoogleReceipt,
  removePendingGoogleReceipt,
  submitGoogleReceipt,
  drainPendingGoogleReceipts,
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

/**
 * Android uses the SAME plugin as iOS (@capgo/native-purchases, Google Play
 * Billing 8 under the hood). The previous @capgo/capacitor-purchases plugin
 * only supported Capacitor 5 and was crashing the Android app at launch
 * during native plugin registration.
 */
const loadPlugin = async () => {
  try {
    // @vite-ignore — only loaded on Android native.
    const mod = await import("@capgo/native-purchases");
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
    const { NativePurchases } = await loadPlugin();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res: any = await NativePurchases.getProducts({ productIdentifiers: productIds });
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
      if (list.length > 0) {
        for (const p of list) {
          const id = p?.identifier ?? p?.productIdentifier ?? p?.productId;
          if (id) productCache[id] = p;
        }
        return true;
      }
    } catch (err) {
      console.warn("[GoogleIAP] getProducts attempt failed:", attempt + 1, err);
    }
    if (attempt < 2) await sleep(RETRY_DELAYS_MS[attempt] ?? 1500);
  }
  return false;
};

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
  result?.purchase?.purchaseToken ??
  result?.transactionId ??
  null;

export const purchaseSubscription = async (
  productId: string,
  extras?: { circleId?: string; rescue_circle_id?: string }
): Promise<boolean> => {
  if (!isAndroidNative()) return false;

  const { NativePurchases, PURCHASE_TYPE } = await loadPlugin();

  const ready = await ensureProductLoaded(NativePurchases, productId);
  if (!ready) {
    throw new Error(
      "This subscription isn't available from Google Play right now. Make sure you're signed in to the Play Store, then try again."
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

  if (submission === "failed") {
    removePendingGoogleReceipt(purchaseToken);
    throw new Error(
      "Google confirmed your payment, but we couldn't activate your plan. Please contact support@familialmedia.com and we'll sort it out right away."
    );
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

  const { NativePurchases, PURCHASE_TYPE } = await loadPlugin();

  const ready = await ensureProductLoaded(NativePurchases, productId);
  if (!ready) {
    throw new Error(
      "This add-on isn't available from Google Play right now. Make sure you're signed in to the Play Store, then try again."
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

  if (submission === "failed") {
    removePendingGoogleReceipt(purchaseToken);
    throw new Error(
      "Google confirmed your payment, but we couldn't add your seats. Please contact support@familialmedia.com and we'll sort it out right away."
    );
  }

  throw new Error(
    "Google confirmed your payment. We'll finish adding your seats automatically — usually within a few minutes. " +
    "You can close the app safely; no further action is needed."
  );
};

export const restorePurchases = async (): Promise<boolean> => {
  if (!isAndroidNative()) return false;
  try {
    const { NativePurchases } = await loadPlugin();
    await NativePurchases.restorePurchases();
    const { error } = await supabase.functions.invoke("validate-google-receipt", {
      body: { restore: true },
    });
    // Also drain any queued receipts that never made it through.
    const credited = await drainPendingGoogleReceipts();
    console.log("[GoogleIAP] restorePurchases drained", { credited });
    return !error;
  } catch (err) {
    console.warn("[GoogleIAP] restorePurchases failed:", err);
    try {
      await drainPendingGoogleReceipts();
    } catch {}
    return false;
  }
};

/**
 * Open Google Play's subscription management page (Play policy 3.4).
 * Uses a Chrome Custom Tab so the user returns cleanly to the app —
 * a plain window.open can silently no-op inside the Android WebView.
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
  void openInAppBrowser(url);
};
