import { forwardRef, useState, ImgHTMLAttributes, useEffect } from "react";
import { cn } from "@/lib/utils";
import { presetImage, srcSetFor, ImagePreset } from "@/lib/imageUrl";

interface SmartImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet"> {
  /** Original Supabase Storage (or external) URL */
  src: string | null | undefined;
  /** Size preset — picks width/quality + srcSet base */
  preset?: ImagePreset;
  /** Mark as priority (above the fold) — disables lazy loading + sets fetchpriority=high */
  priority?: boolean;
}

const PRESET_BASE_WIDTH: Record<ImagePreset, number> = {
  thumb: 400,
  card: 800,
  full: 1600,
  avatar: 128,
};

/**
 * Drop-in <img> replacement that:
 *  - rewrites Supabase Storage URLs through the on-the-fly image transformer
 *  - emits a 1x/2x srcSet
 *  - lazy-loads + async-decodes by default (override with `priority`)
 *  - falls back to the original URL on transform failure
 *  - shows a neutral background while decoding (prevents flash)
 */
export const SmartImage = forwardRef<HTMLImageElement, SmartImageProps>(
  ({ src, preset = "thumb", priority = false, className, onError, alt = "", ...rest }, ref) => {
    const original = src || "";
    const [errored, setErrored] = useState(false);

    // Reset error state if src changes
    useEffect(() => {
      setErrored(false);
    }, [original]);

    const baseWidth = PRESET_BASE_WIDTH[preset];
    const transformed = errored ? original : presetImage(original, preset);
    const srcSet = errored ? undefined : srcSetFor(original, baseWidth) || undefined;

    return (
      <img
        ref={ref}
        src={transformed}
        srcSet={srcSet}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        // @ts-expect-error - fetchpriority is a valid attribute, types lag
        fetchpriority={priority ? "high" : "auto"}
        onError={(e) => {
          if (!errored) setErrored(true);
          onError?.(e);
        }}
        className={cn("bg-muted", className)}
        {...rest}
      />
    );
  }
);
SmartImage.displayName = "SmartImage";
