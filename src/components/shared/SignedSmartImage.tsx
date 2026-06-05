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
  /** Optional smaller preset to paint underneath the hi-res image while it
   *  loads. The thumb variant is usually already in cache from the grid,
   *  so it paints in <100ms and fades into the full image on load. */
  lowPreset?: ImagePreset;
}

/**
 * <img> for assets in the private `post-media` bucket.
 *
 * Internally produces a signed URL that includes the preset's
 * width/quality/resize transform, so the browser downloads a CDN-cached
 * WebP variant (~30–80 KB) instead of the multi-MB original.
 */
export const SignedSmartImage = ({
  path,
  preset = "thumb",
  priority = false,
  lowPreset,
  className,
  alt = "",
  ...rest
}: SignedSmartImageProps) => {
  const transform = PRESET_TRANSFORM[preset];
  const lowTransform = lowPreset ? PRESET_TRANSFORM[lowPreset] : undefined;
  const { url, loading } = useSignedMediaUrl(path, transform);
  const { url: lowUrl } = useSignedMediaUrl(lowPreset ? path : null, lowTransform);
  const [hiLoaded, setHiLoaded] = useState(false);

  if (!url && !lowUrl) {
    return (
      <div
        className={cn("bg-muted", className)}
        aria-busy={loading || undefined}
        aria-hidden={alt ? undefined : true}
      />
    );
  }

  // Progressive: stack low-res underneath, fade in hi-res on load.
  if (lowUrl) {
    return (
      <div className={cn("relative bg-muted", className)}>
        <img
          src={lowUrl}
          alt=""
          aria-hidden="true"
          decoding="async"
          className={cn(
            "absolute inset-0 h-full w-full",
            // Mirror object-fit from incoming className when present
            className?.includes("object-cover") ? "object-cover" : "object-contain",
          )}
        />
        {url && (
          <img
            src={url}
            alt={alt}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            // @ts-expect-error - fetchpriority is a valid attribute, types lag
            fetchpriority={priority ? "high" : "auto"}
            onLoad={() => setHiLoaded(true)}
            className={cn(
              "relative h-full w-full transition-opacity duration-200",
              className?.includes("object-cover") ? "object-cover" : "object-contain",
              hiLoaded ? "opacity-100" : "opacity-0",
            )}
            {...rest}
          />
        )}
      </div>
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
