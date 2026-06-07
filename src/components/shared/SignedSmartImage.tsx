import { ImgHTMLAttributes, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useSignedMediaUrl } from "@/lib/postMediaUrl";
import { PRESET_TRANSFORM, ImagePreset } from "@/lib/imageUrl";

interface SignedSmartImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet"> {
  /** Bare storage path (e.g. "userId/album/file.jpg") or legacy public URL.
   *  Blob/data URLs and external HTTPS URLs pass through unchanged. */
  path: string | null | undefined;
  /** Storage bucket name. Defaults to "post-media" for back-compat. */
  bucket?: string;
  preset?: ImagePreset;
  priority?: boolean;
  /** Optional smaller preset shown immediately as a placeholder behind the
   *  hi-res image. The thumb variant is usually already cached from the
   *  grid, so it paints in <100ms and is then replaced by the full image. */
  lowPreset?: ImagePreset;
  /** When set, wraps the image in an aspect-ratio container so the layout
   *  reserves space before the image decodes. The container shows an
   *  animated skeleton until the image loads, then fades the image in. */
  reserveAspect?: number;
  /** Called after the image decodes with its naturalWidth/naturalHeight
   *  ratio. Lets parents swap the reserved aspect-ratio to the real one. */
  onAspect?: (ratio: number) => void;
}

// Cap at 2× DPR — anything beyond is wasted bytes for what the eye sees.
const dpr = (): number =>
  typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;

function scaleTransform(t: { width: number; height?: number; quality: number; resize: "contain" | "cover" | "fill" }) {
  const ratio = dpr();
  return {
    width: Math.round(t.width * ratio),
    height: t.height ? Math.round(t.height * ratio) : undefined,
    quality: t.quality,
    resize: t.resize,
  };
}

/**
 * <img> for assets in the private `post-media` bucket.
 *
 * Produces a signed URL that includes the preset's width/quality/resize
 * transform, so the browser downloads a CDN-cached WebP variant
 * (~30–80 KB) instead of the multi-MB original. Width is auto-scaled to
 * the device's DPR (capped at 2×) so retina screens stay sharp without
 * paying double bytes on standard density.
 */
export const SignedSmartImage = ({
  path,
  bucket = "post-media",
  preset = "thumb",
  priority = false,
  lowPreset,
  reserveAspect,
  onAspect,
  className,
  alt = "",
  style,
  onLoad,
  onError,
  ...rest
}: SignedSmartImageProps) => {
  const [useOriginalFallback, setUseOriginalFallback] = useState(false);
  const transform = useOriginalFallback ? undefined : scaleTransform(PRESET_TRANSFORM[preset]);
  const lowTransform = lowPreset && !useOriginalFallback ? scaleTransform(PRESET_TRANSFORM[lowPreset]) : undefined;
  const { url, loading } = useSignedMediaUrl(path, transform, bucket);
  const { url: lowUrl } = useSignedMediaUrl(lowPreset ? path : null, lowTransform, bucket);
  const [hiLoaded, setHiLoaded] = useState(false);

  useEffect(() => {
    setHiLoaded(false);
    setUseOriginalFallback(false);
  }, [path, bucket, preset, lowPreset]);

  useEffect(() => {
    setHiLoaded(false);
  }, [url]);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (!useOriginalFallback && url) {
      setHiLoaded(false);
      setUseOriginalFallback(true);
    }
    onError?.(e);
  };

  const displaySrc = hiLoaded && url ? url : (lowUrl || url);

  const img = !displaySrc ? null : (
    <img
      src={displaySrc}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      // @ts-expect-error - fetchpriority is a valid attribute, types lag
      fetchpriority={priority ? "high" : "auto"}
      className={cn(
        reserveAspect ? "absolute inset-0 h-full w-full transition-opacity duration-300" : "bg-muted",
        reserveAspect && (hiLoaded || lowUrl) ? "opacity-100" : reserveAspect ? "opacity-0" : "",
        className,
      )}
      style={style}
      onLoad={(e) => {
        const t = e.currentTarget;
        if (t.src === url) {
          setHiLoaded(true);
          if (onAspect && t.naturalWidth && t.naturalHeight) {
            onAspect(t.naturalWidth / t.naturalHeight);
          }
        }
        onLoad?.(e);
      }}
      onError={handleImageError}
      {...rest}
    />
  );

  if (reserveAspect) {
    return (
      <div
        className="relative w-full overflow-hidden bg-muted"
        style={{ aspectRatio: reserveAspect }}
        aria-busy={loading || !hiLoaded || undefined}
      >
        {!hiLoaded && !lowUrl && (
          <div className="absolute inset-0 animate-pulse bg-muted" aria-hidden="true" />
        )}
        {img}
        {url && !hiLoaded && lowUrl && (
          <img
            src={url}
            alt=""
            aria-hidden="true"
            decoding="async"
            // @ts-expect-error - fetchpriority is a valid attribute, types lag
            fetchpriority={priority ? "high" : "auto"}
            onLoad={(e) => {
              setHiLoaded(true);
              const t = e.currentTarget;
              if (onAspect && t.naturalWidth && t.naturalHeight) {
                onAspect(t.naturalWidth / t.naturalHeight);
              }
            }}
            onError={handleImageError}
            style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
          />
        )}
      </div>
    );
  }

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
      {img}
      {url && !hiLoaded && lowUrl && (
        <img
          src={url}
          alt=""
          aria-hidden="true"
          decoding="async"
          // @ts-expect-error - fetchpriority is a valid attribute, types lag
          fetchpriority={priority ? "high" : "auto"}
          onLoad={() => setHiLoaded(true)}
          onError={handleImageError}
          style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
        />
      )}
    </>
  );
};
