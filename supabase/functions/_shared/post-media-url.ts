// Sign post-media storage paths (or legacy public URLs) into short-lived
// signed URLs using the service-role client. Mirrors src/lib/postMediaUrl.ts.

const BUCKET = "post-media";

export function toPostMediaPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("blob:") || value.startsWith("data:")) return null;
  const marker = `/${BUCKET}/`;
  const idx = value.indexOf(marker);
  if (idx >= 0) return value.slice(idx + marker.length).split("?")[0];
  if (!value.startsWith("http")) return value.replace(/^\/+/, "");
  return null;
}

export async function signPostMediaUrl(
  admin: any,
  value: string | null | undefined,
  ttlSeconds = 60 * 60,
): Promise<string> {
  if (!value) return "";
  const path = toPostMediaPath(value);
  if (!path) return value as string;
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(path, ttlSeconds);
  if (error || !data?.signedUrl) return "";
  return data.signedUrl;
}

export async function signPostMediaUrls(
  admin: any,
  values: (string | null | undefined)[] | null | undefined,
  ttlSeconds = 60 * 60,
): Promise<string[]> {
  if (!values || values.length === 0) return [];
  return Promise.all(values.map((v) => signPostMediaUrl(admin, v, ttlSeconds)));
}
