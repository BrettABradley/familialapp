import { SignedSmartImage } from "@/components/shared/SignedSmartImage";
import type { ImagePreset } from "@/lib/imageUrl";

interface SquareSignedThumbnailProps {
  path: string | null | undefined;
  alt: string;
  bucket?: string;
  preset?: ImagePreset;
  priority?: boolean;
}

/**
 * Path-based variant of SquareImageThumbnail for private-bucket media.
 * Signed URLs include the preset's resize transform so each tile downloads
 * a small WebP variant instead of the full original.
 */
export const SquareSignedThumbnail = ({
  path,
  alt,
  bucket = "post-media",
  preset = "thumb",
  priority = false,
}: SquareSignedThumbnailProps) => (
  <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-muted">
    <SignedSmartImage
      path={path}
      bucket={bucket}
      preset={preset}
      alt=""
      aria-hidden="true"
      className="absolute inset-0 h-full w-full scale-105 object-cover opacity-35 blur-xl bg-transparent"
    />
    <SignedSmartImage
      path={path}
      bucket={bucket}
      preset={preset}
      priority={priority}
      alt={alt}
      className="relative z-10 h-auto w-full max-w-none object-contain bg-transparent"
      style={{ objectPosition: "center center" }}
    />
  </div>
);
