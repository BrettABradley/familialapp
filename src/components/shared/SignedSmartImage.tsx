import { ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { useSignedMediaUrl } from "@/lib/postMediaUrl";
import { PRESET_TRANSFORM, ImagePreset } from "@/lib/imageUrl";

interface SignedSmartImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet"> {
  /** Bare storage path (e.g. "userId/album/file.jpg") or legacy public URL.
   *  Blob/data URLs and external HTTPS URLs pass through unchanged. */
  path: string | null | undefined;
  preset?: ImagePreset;
  priority?: boolean;
}

/**
 * <img> for assets in the private `post-media` bucket.
 *
 * Internally produces a signed URL that includes the preset's
 * width/quality/resize transform, so the browser downloads a CDN-cached
 * WebP variant (~30–80 KB) instead of the multi-MB original. This is
 * what `SmartImage` does for public URLs — but for signed URLs we have
 * to pass `{ transform }` to `createSignedUrl` because the
 * `/storage/v1/render/image/` endpoint won't accept the sign token.
 */
export const SignedSmartImage = ({
  path,
  preset = "thumb",
  priority = false,
  className,
  alt = "",
  ...rest
}: SignedSmartImageProps) => {
  const transform = PRESET_TRANSFORM[preset];
  const { url, loading } = useSignedMediaUrl(path, transform);

  if (!url) {
    return (
      <div
        className={cn("bg-muted", className)}
        aria-busy={loading || undefined}
        aria-hidden={alt ? undefined : true}
      />
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      // @ts-expect-error - fetchpriority is a valid attribute, types lag
      fetchpriority={priority ? "high" : "auto"}
      className={cn("bg-muted", className)}
      {...rest}
    />
  );
};
