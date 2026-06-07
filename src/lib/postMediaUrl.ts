import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_BUCKET = "post-media";
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
type BlobCacheEntry = { url: string; promise?: Promise<string> };
const blobCache = new Map<string, BlobCacheEntry>();
const dataUrlCache = new Map<string, BlobCacheEntry>();

function safeDecodePath(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function variantKey(bucket: string, path: string, t?: SignTransform): string {
  const base = `${bucket}|${path}`;
  if (!t) return base;
  return `${base}|w=${t.width ?? ""}|h=${t.height ?? ""}|q=${t.quality ?? ""}|r=${t.resize ?? ""}`;
}

/**
 * Extracts the storage path from either a bare path ("uid/file.jpg") or a
 * legacy public URL ("https://.../storage/v1/object/public/<bucket>/uid/file.jpg").
 * Returns null for blob:/data: URLs (in-flight previews).
 */
export function toBucketPath(
  value: string | null | undefined,
  bucket: string = DEFAULT_BUCKET,
): string | null {
  if (!value) return null;
  if (value.startsWith("blob:") || value.startsWith("data:")) return null;

  // Legacy public/signed URL
  const marker = `/${bucket}/`;
  const idx = value.indexOf(marker);
  if (idx >= 0) {
    return safeDecodePath(value.slice(idx + marker.length).split("?")[0]);
  }
  // Already a bare path
  if (!value.startsWith("http")) return safeDecodePath(value.replace(/^\/+/, ""));

  // Unknown http URL (e.g. external) — return as-is signal
  return null;
}

/** Back-compat alias for the post-media-only helper. */
export function toPostMediaPath(value: string | null | undefined): string | null {
  return toBucketPath(value, DEFAULT_BUCKET);
}

async function signOne(bucket: string, path: string, transform?: SignTransform): Promise<string> {
  // Native iOS can keep the app process alive for a long time; refresh the
  // session before Storage signing so private-bucket URLs are minted with a
  // current token instead of silently producing unusable image responses.
  await supabase.auth.getSession();
  const storage = supabase.storage.from(bucket);
  const { data, error } = transform
    ? await storage.createSignedUrl(path, TTL_SECONDS, { transform })
    : await storage.createSignedUrl(path, TTL_SECONDS);
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
  bucket: string = DEFAULT_BUCKET,
): Promise<string> {
  if (!value) return "";
  if (value.startsWith("blob:") || value.startsWith("data:")) return value;

  const path = toBucketPath(value, bucket);
  if (!path) return value; // external URL — let it through

  const key = variantKey(bucket, path, transform);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt - REFRESH_BEFORE_MS > now) return cached.url;
  if (cached?.promise) return cached.promise;

  const promise = signOne(bucket, path, transform).then((url) => {
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
  bucket: string = DEFAULT_BUCKET,
): Promise<string[]> {
  return Promise.all(values.map((v) => getPostMediaUrl(v, transform, bucket).catch(() => "")));
}

/** Drop a cached signed URL after the browser reports it as broken. */
export function invalidateSignedMediaUrl(
  value: string | null | undefined,
  transform?: SignTransform,
  bucket: string = DEFAULT_BUCKET,
): void {
  const path = toBucketPath(value, bucket);
  if (!path) return;
  cache.delete(variantKey(bucket, path, transform));
}

async function downloadOne(bucket: string, path: string): Promise<string> {
  await supabase.auth.getSession();
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) {
    throw error ?? new Error("Failed to download media");
  }
  return URL.createObjectURL(data);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read media"));
    reader.readAsDataURL(blob);
  });
}

async function downloadOneAsDataUrl(bucket: string, path: string): Promise<string> {
  await supabase.auth.getSession();
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) {
    throw error ?? new Error("Failed to download media");
  }
  return blobToDataUrl(data);
}

/** Resolve private storage media by downloading it to a local blob URL.
 *  Used for iOS surfaces that render signed object URLs as broken images. */
export async function getStorageBlobUrl(
  value: string | null | undefined,
  bucket: string = DEFAULT_BUCKET,
): Promise<string> {
  if (!value) return "";
  if (value.startsWith("blob:") || value.startsWith("data:")) return value;
  if (typeof URL === "undefined") return getPostMediaUrl(value, undefined, bucket);

  const path = toBucketPath(value, bucket);
  if (!path) return value;

  const key = variantKey(bucket, path);
  const cached = blobCache.get(key);
  if (cached?.url) return cached.url;
  if (cached?.promise) return cached.promise;

  const promise = downloadOne(bucket, path).then((url) => {
    blobCache.set(key, { url });
    return url;
  });
  blobCache.set(key, { url: "", promise });
  try {
    return await promise;
  } catch (e) {
    blobCache.delete(key);
    throw e;
  }
}

/** Drop a cached blob URL after the browser reports it as broken. */
export function invalidateStorageBlobUrl(
  value: string | null | undefined,
  bucket: string = DEFAULT_BUCKET,
): void {
  const path = toBucketPath(value, bucket);
  if (!path) return;
  const key = variantKey(bucket, path);
  const cached = blobCache.get(key);
  if (cached?.url?.startsWith("blob:")) URL.revokeObjectURL(cached.url);
  blobCache.delete(key);
}

/** Resolve private storage media as a data URL for native WebViews that show
 *  broken-image placeholders for remote signed/object URLs and blob URLs. */
export async function getStorageDataUrl(
  value: string | null | undefined,
  bucket: string = DEFAULT_BUCKET,
): Promise<string> {
  if (!value) return "";
  if (value.startsWith("data:")) return value;
  if (value.startsWith("blob:")) return value;
  if (typeof FileReader === "undefined") return getPostMediaUrl(value, undefined, bucket);

  const path = toBucketPath(value, bucket);
  if (!path) return value;

  const key = variantKey(bucket, path);
  const cached = dataUrlCache.get(key);
  if (cached?.url) return cached.url;
  if (cached?.promise) return cached.promise;

  const promise = downloadOneAsDataUrl(bucket, path).then((url) => {
    dataUrlCache.set(key, { url });
    return url;
  });
  dataUrlCache.set(key, { url: "", promise });
  try {
    return await promise;
  } catch (e) {
    dataUrlCache.delete(key);
    throw e;
  }
}

export function invalidateStorageDataUrl(
  value: string | null | undefined,
  bucket: string = DEFAULT_BUCKET,
): void {
  const path = toBucketPath(value, bucket);
  if (!path) return;
  dataUrlCache.delete(variantKey(bucket, path));
}

/**
 * Warm the in-memory signed-URL cache AND the browser image cache for an
 * upcoming asset. Safe to call repeatedly — duplicates are deduped by the
 * signed-URL cache and the browser's HTTP cache.
 */
export function prefetchSignedMediaUrl(
  value: string | null | undefined,
  transform?: SignTransform,
  bucket: string = DEFAULT_BUCKET,
): void {
  if (!value) return;
  if (typeof window === "undefined") return;
  getPostMediaUrl(value, transform, bucket)
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
  bucket: string = DEFAULT_BUCKET,
  refreshKey: string | number = 0,
): {
  url: string;
  loading: boolean;
} {
  const tKey = transform ? `${transform.width ?? ""}x${transform.height ?? ""}q${transform.quality ?? ""}r${transform.resize ?? ""}` : "";
  const [url, setUrl] = useState<string>(() => {
    if (!value) return "";
    if (value.startsWith("blob:") || value.startsWith("data:")) return value;
    const path = toBucketPath(value, bucket);
    if (!path) return value;
    const cached = cache.get(variantKey(bucket, path, transform));
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
    const path = toBucketPath(value, bucket);
    const cached = path ? cache.get(variantKey(bucket, path, transform)) : null;
    setUrl(cached?.url ?? (path ? "" : value));
    setLoading(true);
    getPostMediaUrl(value, transform, bucket)
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
  }, [value, tKey, bucket, refreshKey]);

  return { url, loading };
}

/** React hook returning a local blob URL from private storage. */
export function useStorageBlobUrl(
  value: string | null | undefined,
  bucket: string = DEFAULT_BUCKET,
  refreshKey: string | number = 0,
): {
  url: string;
  loading: boolean;
} {
  const [url, setUrl] = useState<string>(() => {
    if (!value) return "";
    if (value.startsWith("blob:") || value.startsWith("data:")) return value;
    const path = toBucketPath(value, bucket);
    if (!path) return value;
    return blobCache.get(variantKey(bucket, path))?.url ?? "";
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
    const path = toBucketPath(value, bucket);
    const cached = path ? blobCache.get(variantKey(bucket, path)) : null;
    setUrl(cached?.url ?? (path ? "" : value));
    setLoading(true);
    getStorageBlobUrl(value, bucket)
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
  }, [value, bucket, refreshKey]);

  return { url, loading };
}

/** Hook for an array of values (e.g. post media_urls). Preserves order. */
export function useSignedMediaUrls(
  values: (string | null | undefined)[],
  transform?: SignTransform,
  bucket: string = DEFAULT_BUCKET,
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
    getPostMediaUrls(values, transform, bucket)
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
  }, [key, tKey, bucket]);

  return { urls, loading };
}
