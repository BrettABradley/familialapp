/**
 * Supabase Storage image-transform helpers.
 *
 * Supabase exposes on-the-fly image transforms via the `render/image` path.
 * Any public/signed storage URL like:
 *   https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<path>
 * can be rewritten to:
 *   https://<ref>.supabase.co/storage/v1/render/image/public/<bucket>/<path>?width=W&quality=Q&resize=contain
 * which returns a WebP-encoded, CDN-cached, properly sized image.
 *
 * For non-Supabase URLs (external avatars, data URIs, etc.) we return the
 * original URL untouched.
 */

export type ImagePreset = "thumb" | "card" | "full" | "avatar";

const PRESETS: Record<ImagePreset, { width: number; height?: number; quality: number; resize?: TransformOpts["resize"] }> = {
  thumb: { width: 400, quality: 70 },   // feed grid tiles, album grid, fridge tiles
  card: { width: 800, quality: 75 },    // single-image post
  full: { width: 1600, quality: 80 },   // lightbox
  // Square 256px so retina/large avatars stay crisp and are always 1:1 cropped
  avatar: { width: 256, height: 256, quality: 80, resize: "cover" },
};

/** Public preset transform map — used by signed-URL helpers to pass the
 *  same resize/quality params to `createSignedUrl({ transform })`. */
export const PRESET_TRANSFORM: Record<ImagePreset, { width: number; height?: number; quality: number; resize: "contain" | "cover" | "fill" }> = {
  thumb: { width: 400, quality: 70, resize: "contain" },
  card: { width: 800, quality: 75, resize: "contain" },
  full: { width: 1600, quality: 80, resize: "contain" },
  avatar: { width: 256, height: 256, quality: 80, resize: "cover" },
};

function isSupabaseStorageUrl(url: string): boolean {
  return /\/storage\/v1\/object\/(public|sign)\//.test(url);
}

function isSignedStorageUrl(url: string): boolean {
  return /\/storage\/v1\/object\/sign\//.test(url);
}

export interface TransformOpts {
  width?: number;
  height?: number;
  quality?: number;
  resize?: "cover" | "contain" | "fill";
}

/** Build a transformed Supabase Storage URL. No-op for non-Supabase URLs.
 *  Signed URLs are returned as-is because their token is bound to the
 *  /object/sign/ path and won't validate on the /render/image/ endpoint. */
export function transformedImage(url: string | null | undefined, opts: TransformOpts = {}): string {
  if (!url) return "";
  if (!isSupabaseStorageUrl(url)) return url;
  if (isSignedStorageUrl(url)) return url;

  const { width, height, quality = 75, resize = "contain" } = opts;
  const rewritten = url.replace("/storage/v1/object/", "/storage/v1/render/image/");
  const params = new URLSearchParams();
  if (width) params.set("width", String(width));
  if (height) params.set("height", String(height));
  params.set("quality", String(quality));
  params.set("resize", resize);
  const sep = rewritten.includes("?") ? "&" : "?";
  return `${rewritten}${sep}${params.toString()}`;
}

/** Convenience: apply a named preset. */
export function presetImage(url: string | null | undefined, preset: ImagePreset): string {
  if (!url) return "";
  return transformedImage(url, PRESETS[preset]);
}

/** Build a 1x/2x srcSet for a given preset width. */
export function srcSetFor(url: string | null | undefined, baseWidth: number, quality = 75): string {
  if (!url || !isSupabaseStorageUrl(url)) return "";
  if (isSignedStorageUrl(url)) return "";
  const x1 = transformedImage(url, { width: baseWidth, quality });
  const x2 = transformedImage(url, { width: baseWidth * 2, quality });
  return `${x1} 1x, ${x2} 2x`;
}

/** Avatar shorthand used by AvatarImage call sites. */
export function avatarUrl(url: string | null | undefined): string {
  return presetImage(url, "avatar");
}
