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
const productCache: Record<string, any> = {};

const RETRY_DELAYS_MS = [800, 1500];

// === Pending IAP receipt queue ===========================================
// If validate-apple-receipt fails (network, Apple 401, backend down), we MUST
// NOT lose the receipt. We persist it in localStorage and retry on:
//   - next app launch (drainPendingIapReceipts() called from capacitorInit)
//   - app resume from background
//   - user tapping "Restore Purchases"
// The backend uses a unique index on transaction_id, so retries can never
// double-credit even if the user re-launches multiple times.

const PENDING_KEY = "pendingAppleReceipts.v1";

type PendingReceipt = {
  id: string;                       // local id (random)
  kind: "subscription" | "extra_members";
  productId: string;
  transactionId: string;
  circleId?: string;
  rescue_circle_id?: string;
  jwsRepresentation?: string | null;
  receipt?: string | null;
  createdAt: number;
  lastAttemptAt?: number;
  attempts: number;
  lastError?: string;
};

const readPending = (): PendingReceipt[] => {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writePending = (list: PendingReceipt[]) => {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn("[IAP] writePending failed", e);
  }
};

const enqueuePending = (entry: Omit<PendingReceipt, "id" | "createdAt" | "attempts">) => {
  const list = readPending();
  // Dedupe by transactionId so the same purchase only sits in the queue once.
  if (list.some((p) => p.transactionId === entry.transactionId)) return;
  list.push({
    id: (globalThis.crypto?.randomUUID?.() ?? `pr-${Date.now()}-${Math.random()}`),
    createdAt: Date.now(),
    attempts: 0,
    ...entry,
  });
  writePending(list);
  console.log("[IAP] enqueued pending receipt", { transactionId: entry.transactionId, kind: entry.kind });
};

const removePending = (transactionId: string) => {
  const list = readPending().filter((p) => p.transactionId !== transactionId);
  writePending(list);
};

const markPendingFailure = (transactionId: string, err: string) => {
  const list = readPending();
  const item = list.find((p) => p.transactionId === transactionId);
  if (item) {
    item.attempts += 1;
    item.lastAttemptAt = Date.now();
    item.lastError = err.slice(0, 300);
    writePending(list);
  }
};

export const getPendingReceiptCount = () => readPending().length;

/**
 * Submit a single pending receipt to the backend. Returns:
 *  - 'credited' on success or duplicate (we no longer need this receipt)
 *  - 'retry'    on transient failure (Apple 401, 503, network)
 *  - 'failed'   on permanent failure (bundle mismatch, revoked, etc.)
 */
async function submitReceipt(entry: PendingReceipt): Promise<"credited" | "retry" | "failed"> {
  try {
    const { data, error } = await supabase.functions.invoke("validate-apple-receipt", {
      body: {
        kind: entry.kind,
        transactionId: entry.transactionId,
        productId: entry.productId,
        circleId: entry.circleId,
        rescue_circle_id: entry.rescue_circle_id,
        receipt: entry.receipt ?? null,
        jwsRepresentation: entry.jwsRepresentation ?? null,
      },
    });

    // supabase.functions.invoke surfaces non-2xx as `error`, but the body is
    // still available on `data`. We check both.
    const payload: any = data ?? {};
    if (payload?.success) return "credited";

    const code = payload?.code ?? "";
    const retryable = payload?.retry === true ||
      code === "APPLE_CREDENTIALS_INVALID" ||
      code === "APPLE_TXN_NOT_FOUND" ||
      code === "APPLE_TRANSIENT";

    if (error && retryable) {
      markPendingFailure(entry.transactionId, payload?.error ?? error.message);
      return "retry";
    }
    if (retryable) {
      markPendingFailure(entry.transactionId, payload?.error ?? "retryable");
      return "retry";
    }
    if (error) {
      markPendingFailure(entry.transactionId, payload?.error ?? error.message);
      // For unknown errors prefer retry over discard — we'd rather try again
      // on next launch than silently drop a real purchase.
      return "retry";
    }
    return "credited";
  } catch (err: any) {
    markPendingFailure(entry.transactionId, err?.message ?? String(err));
    return "retry";
  }
}

/**
 * Drain pending receipts. Safe to call repeatedly. Returns how many were
 * credited so callers can refresh their UI.
 */
export const drainPendingIapReceipts = async (): Promise<number> => {
  const list = readPending();
  if (list.length === 0) return 0;
  console.log(`[IAP] draining ${list.length} pending receipt(s)`);
  let credited = 0;
  for (const entry of list) {
    const result = await submitReceipt(entry);
    if (result === "credited") {
      removePending(entry.transactionId);
      credited += 1;
    } else if (result === "failed") {
      // Permanent — give up so it doesn't sit in the queue forever.
      removePending(entry.transactionId);
    }
    // 'retry' → leave it queued for next time.
  }
  return credited;
};

const parseProductList = (res: any): any[] => {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.products)) return res.products;
  return [];
};

/**
 * Pre-warm StoreKit by fetching all known product IDs once.
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
 * Purchase a subscription via Apple IAP. Receipt is saved locally before
 * we try to validate, so a backend failure never loses the purchase.
 *
 * Returns:
 *  - true  → credited, the user's plan was applied
 *  - false → the user canceled the Apple sheet (no charge, no toast needed)
 *  - throws → the purchase was charged AND queued for retry. The thrown
 *             Error has a user-friendly message that callers can show in a
 *             toast.
 */
export const purchaseSubscription = async (
  productId: string,
  extras?: { circleId?: string; rescue_circle_id?: string }
): Promise<boolean> => {
  if (!isIOSNative()) return false;

  const { NativePurchases, PURCHASE_TYPE } = await loadPlugin();

  const ready = await ensureProductLoaded(NativePurchases, productId);
  if (!ready) {
    throw new Error(
      "This subscription isn't available from the App Store right now. Make sure you're signed in with a valid Apple ID, then try again."
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
    // StoreKit returned without a transactionId — purchase did NOT complete.
    return false;
  }

  // Persist BEFORE calling the backend so a failure never loses the receipt.
  enqueuePending({
    kind: "subscription",
    productId,
    transactionId: String(transactionId),
    circleId: extras?.circleId,
    rescue_circle_id: extras?.rescue_circle_id,
    receipt: result?.receipt ?? null,
    jwsRepresentation: result?.jwsRepresentation ?? null,
  });

  const submission = await submitReceipt({
    id: "", createdAt: 0, attempts: 0,
    kind: "subscription",
    productId,
    transactionId: String(transactionId),
    circleId: extras?.circleId,
    rescue_circle_id: extras?.rescue_circle_id,
    receipt: result?.receipt ?? null,
    jwsRepresentation: result?.jwsRepresentation ?? null,
  });

  if (submission === "credited") {
    removePending(String(transactionId));
    return true;
  }

  throw new Error(
    "Your purchase went through and is safely saved on this device. " +
    "We'll finish activating your plan automatically — reopen the app or tap Restore Purchases in Settings."
  );
};

/**
 * Purchase a one-time consumable via Apple IAP (e.g. extra member seats).
 * Same return contract as purchaseSubscription.
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
      "This add-on isn't available from the App Store right now. Make sure you're signed in with a valid Apple ID, then try again."
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
  if (!transactionId) return false;

  enqueuePending({
    kind: extras.kind,
    productId,
    transactionId: String(transactionId),
    circleId: extras.circleId,
    receipt: result?.receipt ?? null,
    jwsRepresentation: result?.jwsRepresentation ?? null,
  });

  const submission = await submitReceipt({
    id: "", createdAt: 0, attempts: 0,
    kind: extras.kind,
    productId,
    transactionId: String(transactionId),
    circleId: extras.circleId,
    receipt: result?.receipt ?? null,
    jwsRepresentation: result?.jwsRepresentation ?? null,
  });

  if (submission === "credited") {
    removePending(String(transactionId));
    return true;
  }

  throw new Error(
    "Your purchase went through and is safely saved on this device. " +
    "We'll finish adding the seats automatically — reopen the app or tap Restore Purchases in Settings."
  );
};

/**
 * Restore previous purchases (required by Apple guidelines).
 * Also drains any locally-queued pending receipts.
 */
export const restorePurchases = async (): Promise<boolean> => {
  if (!isIOSNative()) return false;

  try {
    const { NativePurchases } = await loadPlugin();
    await NativePurchases.restorePurchases();

    const { error } = await supabase.functions.invoke("validate-apple-receipt", {
      body: { restore: true },
    });

    // Drain any consumable receipts that never made it through.
    const credited = await drainPendingIapReceipts();
    console.log("[IAP] restorePurchases drained", { credited });

    return !error;
  } catch (err) {
    console.warn("[IAP] restorePurchases failed:", err);
    await drainPendingIapReceipts();
    return false;
  }
};

