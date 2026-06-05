import { ImgHTMLAttributes, useState } from "react";
import { cn } from "@/lib/utils";
import { useSignedMediaUrl } from "@/lib/postMediaUrl";
import { PRESET_TRANSFORM, ImagePreset } from "@/lib/imageUrl";

interface SignedSmartImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet"> {
  /** Bare storage path (e.g. "userId/album/file.jpg") or legacy public URL.
   *  Blob/data URLs and external HTTPS URLs pass through unchanged. */
  path: string | null | undefined;
  preset?: ImagePreset;
  priority?: boolean;
  /** Optional smaller preset shown immediately as a placeholder behind the
   *  hi-res image. The thumb variant is usually already cached from the
   *  grid, so it paints in <100ms and is then replaced by the full image. */
  lowPreset?: ImagePreset;
}

/**
 * <img> for assets in the private `post-media` bucket.
 *
 * Produces a signed URL that includes the preset's width/quality/resize
 * transform, so the browser downloads a CDN-cached WebP variant
 * (~30–80 KB) instead of the multi-MB original.
 */
export const SignedSmartImage = ({
  path,
  preset = "thumb",
  priority = false,
  lowPreset,
  className,
  alt = "",
  style,
  ...rest
}: SignedSmartImageProps) => {
  const transform = PRESET_TRANSFORM[preset];
  const lowTransform = lowPreset ? PRESET_TRANSFORM[lowPreset] : undefined;
  const { url, loading } = useSignedMediaUrl(path, transform);
  const { url: lowUrl } = useSignedMediaUrl(lowPreset ? path : null, lowTransform);
  const [hiLoaded, setHiLoaded] = useState(false);

  // While the hi-res hasn't loaded yet, show the low-res variant in its
  // place. We keep a single <img> in the DOM so the lightbox's
  // max-h-full/max-w-full/object-contain sizing keeps working.
  const displaySrc = hiLoaded && url ? url : (lowUrl || url);

  if (!displaySrc) {
    return (
      <div
        className={cn("bg-muted", className)}
        style={style}
        aria-busy={loading || undefined}
        aria-hidden={alt ? undefined : true}
      />
    );
  }

  return (
    <>
      <img
        src={displaySrc}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        // @ts-expect-error - fetchpriority is a valid attribute, types lag
        fetchpriority={priority ? "high" : "auto"}
        className={cn("bg-muted", className)}
        style={style}
        {...rest}
      />
      {url && !hiLoaded && (
        // Hidden decoder for the hi-res image. Once it decodes we swap
        // `displaySrc` above to the hi-res URL.
        <img
          src={url}
          alt=""
          aria-hidden="true"
          decoding="async"
          // @ts-expect-error - fetchpriority is a valid attribute, types lag
          fetchpriority={priority ? "high" : "auto"}
          onLoad={() => setHiLoaded(true)}
          style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
        />
      )}
    </>
  );
};
