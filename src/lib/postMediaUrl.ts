import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "post-media";
const TTL_SECONDS = 60 * 60; // 1 hour
const REFRESH_BEFORE_MS = 5 * 60 * 1000; // refresh 5 min before expiry

type CacheEntry = { url: string; expiresAt: number; promise?: Promise<string> };
const cache = new Map<string, CacheEntry>();

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

async function signOne(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, TTL_SECONDS);
  if (error || !data?.signedUrl) {
    throw error ?? new Error("Failed to sign URL");
  }
  return data.signedUrl;
}

/**
 * Resolve a stored value (path or legacy public URL or blob/external) to a
 * displayable URL. Blob/data/external values pass through unchanged.
 */
export async function getPostMediaUrl(
  value: string | null | undefined,
): Promise<string> {
  if (!value) return "";
  if (value.startsWith("blob:") || value.startsWith("data:")) return value;

  const path = toPostMediaPath(value);
  if (!path) return value; // external URL — let it through

  const now = Date.now();
  const cached = cache.get(path);
  if (cached && cached.expiresAt - REFRESH_BEFORE_MS > now) return cached.url;
  if (cached?.promise) return cached.promise;

  const promise = signOne(path).then((url) => {
    cache.set(path, { url, expiresAt: Date.now() + TTL_SECONDS * 1000 });
    return url;
  });
  cache.set(path, {
    url: cached?.url ?? "",
    expiresAt: cached?.expiresAt ?? 0,
    promise,
  });
  try {
    return await promise;
  } catch (e) {
    cache.delete(path);
    throw e;
  }
}

export async function getPostMediaUrls(
  values: (string | null | undefined)[],
): Promise<string[]> {
  return Promise.all(values.map((v) => getPostMediaUrl(v).catch(() => "")));
}

/** React hook returning a resolved signed URL. */
export function useSignedMediaUrl(value: string | null | undefined): {
  url: string;
  loading: boolean;
} {
  const [url, setUrl] = useState<string>(() => {
    if (!value) return "";
    if (value.startsWith("blob:") || value.startsWith("data:")) return value;
    const path = toPostMediaPath(value);
    if (!path) return value;
    const cached = cache.get(path);
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
    getPostMediaUrl(value)
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
  }, [value]);

  return { url, loading };
}

/** Hook for an array of values (e.g. post media_urls). Preserves order. */
export function useSignedMediaUrls(values: (string | null | undefined)[]): {
  urls: string[];
  loading: boolean;
} {
  const key = values.join("|");
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
    getPostMediaUrls(values)
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
  }, [key]);

  return { urls, loading };
}
