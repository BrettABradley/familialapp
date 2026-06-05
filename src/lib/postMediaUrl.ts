import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "post-media";
const TTL_SECONDS = 60 * 60; // 1 hour
const REFRESH_BEFORE_MS = 5 * 60 * 1000; // refresh 5 min before expiry

export interface SignTransform {
  width?: number;
  height?: number;
  quality?: number;
  resize?: "cover" | "contain" | "fill";
}

type CacheEntry = { url: string; expiresAt: number; promise?: Promise<string> };
const cache = new Map<string, CacheEntry>();

function variantKey(path: string, t?: SignTransform): string {
  if (!t) return path;
  return `${path}|w=${t.width ?? ""}|h=${t.height ?? ""}|q=${t.quality ?? ""}|r=${t.resize ?? ""}`;
}

/**
 * Extracts the storage path from either a bare path ("uid/file.jpg") or a
 * legacy public URL ("https://.../storage/v1/object/public/post-media/uid/file.jpg").
 * Returns null for blob:/data: URLs (in-flight previews).
 */
export function toPostMediaPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("blob:") || value.startsWith("data:")) return null;

  // Legacy public URL
  const publicMarker = `/${BUCKET}/`;
  const idx = value.indexOf(publicMarker);
  if (idx >= 0) {
    return value.slice(idx + publicMarker.length).split("?")[0];
  }
  // Already a bare path
  if (!value.startsWith("http")) return value.replace(/^\/+/, "");

  // Unknown http URL (e.g. external) — return as-is signal
  return null;
}

async function signOne(path: string, transform?: SignTransform): Promise<string> {
  const opts = transform ? { transform } : undefined;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, TTL_SECONDS, opts as any);
  if (error || !data?.signedUrl) {
    throw error ?? new Error("Failed to sign URL");
  }
  return data.signedUrl;
}

/**
 * Resolve a stored value (path or legacy public URL or blob/external) to a
 * displayable URL. Blob/data/external values pass through unchanged.
 * Optionally apply a Supabase Storage image transform (resize/quality) so
 * the returned signed URL points at a CDN-cached WebP variant.
 */
export async function getPostMediaUrl(
  value: string | null | undefined,
  transform?: SignTransform,
): Promise<string> {
  if (!value) return "";
  if (value.startsWith("blob:") || value.startsWith("data:")) return value;

  const path = toPostMediaPath(value);
  if (!path) return value; // external URL — let it through

  const key = variantKey(path, transform);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt - REFRESH_BEFORE_MS > now) return cached.url;
  if (cached?.promise) return cached.promise;

  const promise = signOne(path, transform).then((url) => {
    cache.set(key, { url, expiresAt: Date.now() + TTL_SECONDS * 1000 });
    return url;
  });
  cache.set(key, {
    url: cached?.url ?? "",
    expiresAt: cached?.expiresAt ?? 0,
    promise,
  });
  try {
    return await promise;
  } catch (e) {
    cache.delete(key);
    throw e;
  }
}

export async function getPostMediaUrls(
  values: (string | null | undefined)[],
  transform?: SignTransform,
): Promise<string[]> {
  return Promise.all(values.map((v) => getPostMediaUrl(v, transform).catch(() => "")));
}

/**
 * Warm the in-memory signed-URL cache AND the browser image cache for an
 * upcoming asset. Safe to call repeatedly — duplicates are deduped by the
 * signed-URL cache and the browser's HTTP cache.
 */
export function prefetchSignedMediaUrl(
  value: string | null | undefined,
  transform?: SignTransform,
): void {
  if (!value) return;
  if (typeof window === "undefined") return;
  getPostMediaUrl(value, transform)
    .then((url) => {
      if (!url) return;
      const img = new Image();
      // @ts-expect-error - fetchpriority is a valid attribute, types lag
      img.fetchpriority = "low";
      img.decoding = "async";
      img.src = url;
    })
    .catch(() => {});
}

/** React hook returning a resolved signed URL. */
export function useSignedMediaUrl(
  value: string | null | undefined,
  transform?: SignTransform,
): {
  url: string;
  loading: boolean;
} {
  const tKey = transform ? `${transform.width ?? ""}x${transform.height ?? ""}q${transform.quality ?? ""}r${transform.resize ?? ""}` : "";
  const [url, setUrl] = useState<string>(() => {
    if (!value) return "";
    if (value.startsWith("blob:") || value.startsWith("data:")) return value;
    const path = toPostMediaPath(value);
    if (!path) return value;
    const cached = cache.get(variantKey(path, transform));
    return cached?.url ?? "";
  });
  const [loading, setLoading] = useState(!url && !!value);

  useEffect(() => {
    let cancelled = false;
    if (!value) {
      setUrl("");
      setLoading(false);
      return;
    }
    if (value.startsWith("blob:") || value.startsWith("data:")) {
      setUrl(value);
      setLoading(false);
      return;
    }
    setLoading(true);
    getPostMediaUrl(value, transform)
      .then((resolved) => {
        if (!cancelled) {
          setUrl(resolved);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUrl("");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, tKey]);

  return { url, loading };
}

/** Hook for an array of values (e.g. post media_urls). Preserves order. */
export function useSignedMediaUrls(
  values: (string | null | undefined)[],
  transform?: SignTransform,
): {
  urls: string[];
  loading: boolean;
} {
  const key = values.join("|");
  const tKey = transform ? `${transform.width ?? ""}x${transform.height ?? ""}q${transform.quality ?? ""}r${transform.resize ?? ""}` : "";
  const [urls, setUrls] = useState<string[]>(() => values.map(() => ""));
  const [loading, setLoading] = useState(values.length > 0);

  useEffect(() => {
    let cancelled = false;
    if (values.length === 0) {
      setUrls([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    getPostMediaUrls(values, transform)
      .then((resolved) => {
        if (!cancelled) {
          setUrls(resolved);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tKey]);

  return { urls, loading };
}
