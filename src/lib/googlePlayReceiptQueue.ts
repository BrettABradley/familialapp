// Google Play IAP pending-receipt queue.
// Mirrors the Apple queue in `iapPurchase.ts`: purchases are persisted to
// localStorage BEFORE calling validate-google-receipt, and drained on:
//   - next app launch (capacitorInit)
//   - app resume from background
//   - user sign-in / token-refresh
//   - user tapping "Restore Purchases"
// The backend uses a unique index on purchase_token so retries can never
// double-credit even if the user re-launches multiple times.
import { supabase } from "@/integrations/supabase/client";

const PENDING_KEY = "pendingGoogleReceipts.v1";

export type PendingGoogleReceipt = {
  id: string;
  kind: "subscription" | "extra_members";
  productId: string;
  purchaseToken: string;
  circleId?: string;
  rescue_circle_id?: string;
  createdAt: number;
  lastAttemptAt?: number;
  attempts: number;
  lastError?: string;
};

const readPending = (): PendingGoogleReceipt[] => {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writePending = (list: PendingGoogleReceipt[]) => {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn("[GoogleIAP] writePending failed", e);
  }
};

export const enqueuePendingGoogleReceipt = (
  entry: Omit<PendingGoogleReceipt, "id" | "createdAt" | "attempts">
) => {
  const list = readPending();
  if (list.some((p) => p.purchaseToken === entry.purchaseToken)) return;
  list.push({
    id: globalThis.crypto?.randomUUID?.() ?? `gr-${Date.now()}-${Math.random()}`,
    createdAt: Date.now(),
    attempts: 0,
    ...entry,
  });
  writePending(list);
  console.log("[GoogleIAP] enqueued pending receipt", { productId: entry.productId, kind: entry.kind });
};

export const removePendingGoogleReceipt = (purchaseToken: string) => {
  const list = readPending().filter((p) => p.purchaseToken !== purchaseToken);
  writePending(list);
};

const markFailure = (purchaseToken: string, err: string) => {
  const list = readPending();
  const item = list.find((p) => p.purchaseToken === purchaseToken);
  if (item) {
    item.attempts += 1;
    item.lastAttemptAt = Date.now();
    item.lastError = err.slice(0, 300);
    writePending(list);
  }
};

export const getPendingGoogleReceiptCount = () => readPending().length;

export async function submitGoogleReceipt(
  entry: PendingGoogleReceipt
): Promise<"credited" | "retry" | "failed"> {
  try {
    const { data, error } = await supabase.functions.invoke("validate-google-receipt", {
      body: {
        kind: entry.kind,
        productId: entry.productId,
        purchaseToken: entry.purchaseToken,
        circleId: entry.circleId,
        rescue_circle_id: entry.rescue_circle_id,
      },
    });

    const payload: any = data ?? {};
    if (payload?.success) return "credited";

    const retryable = payload?.retry === true;
    if (retryable) {
      markFailure(entry.purchaseToken, payload?.error ?? "retryable");
      return "retry";
    }
    if (error) {
      markFailure(entry.purchaseToken, payload?.error ?? error.message);
      // Prefer retry over discard for unknown errors — better to retry
      // next launch than to silently drop a real purchase.
      return "retry";
    }
    return "credited";
  } catch (err: any) {
    markFailure(entry.purchaseToken, err?.message ?? String(err));
    return "retry";
  }
}

/**
 * Drain queued Google Play receipts. Safe to call repeatedly.
 * Returns the number of receipts newly credited.
 */
export const drainPendingGoogleReceipts = async (): Promise<number> => {
  const list = readPending();
  if (list.length === 0) return 0;
  console.log(`[GoogleIAP] draining ${list.length} pending receipt(s)`);
  let credited = 0;
  for (const entry of list) {
    const result = await submitGoogleReceipt(entry);
    if (result === "credited") {
      removePendingGoogleReceipt(entry.purchaseToken);
      credited += 1;
    } else if (result === "failed") {
      removePendingGoogleReceipt(entry.purchaseToken);
    }
    // 'retry' → leave it queued.
  }
  return credited;
};
