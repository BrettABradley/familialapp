import { SmartImage } from "@/components/shared/SmartImage";
import type { ImagePreset } from "@/lib/imageUrl";

interface SquareImageThumbnailProps {
  src: string;
  alt: string;
  preset?: ImagePreset;
  priority?: boolean;
}

/**
 * Square preview that keeps the real image at full thumbnail width.
 * Landscape photos are not zoomed/cropped; portrait photos are centered and
 * only crop vertically when needed to preserve the square tile.
 */
export const SquareImageThumbnail = ({
  src,
  alt,
  preset = "thumb",
  priority = false,
}: SquareImageThumbnailProps) => (
  <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-muted">
    <SmartImage
      src={src}
      preset={preset}
      alt=""
      aria-hidden="true"
      className="absolute inset-0 h-full w-full scale-105 object-cover opacity-35 blur-xl bg-transparent"
    />
    <SmartImage
      src={src}
      preset={preset}
      priority={priority}
      alt={alt}
      className="relative z-10 h-auto w-full max-w-none object-contain bg-transparent"
      style={{ objectPosition: "center center" }}
    />
  </div>
);
