import heic2any from "heic2any";
import { toast } from "sonner";

const MAX_EDGE = 2400; // long-edge cap; feed shows ≤1600px so this is plenty
const JPEG_QUALITY = 0.9;

export function isHeicFile(file: File): boolean {
  const type = file.type.toLowerCase();
  const ext = file.name.split(".").pop()?.toLowerCase();
  return (
    type === "image/heic" ||
    type === "image/heif" ||
    ext === "heic" ||
    ext === "heif"
  );
}

async function fileToBlob(file: File): Promise<Blob> {
  const buffer = await file.arrayBuffer();
  return new Blob([buffer], { type: file.type || "image/heic" });
}

/**
 * Downscale a JPEG/PNG/WebP File to MAX_EDGE on the long side.
 * Returns the original file if it's already small enough or if downscale fails.
 * Skips animated GIFs, SVGs, and non-images.
 */
async function downscaleImageFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;

  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new window.Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = url;
    });
    const longEdge = Math.max(img.naturalWidth, img.naturalHeight);
    if (longEdge <= MAX_EDGE) {
      URL.revokeObjectURL(url);
      return file;
    }
    const scale = MAX_EDGE / longEdge;
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(url);
      return file;
    }
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );
    if (!blob) return file;
    const newName = file.name.replace(/\.[^/.]+$/, ".jpg");
    return new File([blob], newName, { type: "image/jpeg" });
  } catch (err) {
    console.warn("Image downscale failed; using original:", err);
    return file;
  }
}

export async function convertHeicToJpeg(file: File): Promise<File> {
  if (!isHeicFile(file)) return downscaleImageFile(file);

  const toastId = toast.loading("Converting image format…");
  try {
    const blob = await fileToBlob(file);
    const result = await heic2any({ blob, toType: "image/jpeg", quality: 0.92 });
    const resultBlob = Array.isArray(result) ? result[0] : result;
    const newName = file.name.replace(/\.[^/.]+$/, ".jpg");
    toast.dismiss(toastId);
    const jpeg = new File([resultBlob], newName, { type: "image/jpeg" });
    return await downscaleImageFile(jpeg);
  } catch (err) {
    toast.dismiss(toastId);
    toast.error("Failed to convert image. Please try a different file.");
    throw err;
  }
}

export async function convertHeicFiles(files: File[]): Promise<File[]> {
  const hasHeic = files.some(isHeicFile);
  const toastId = hasHeic ? toast.loading("Converting image format…") : null;
  const results: File[] = [];

  for (const file of files) {
    if (!isHeicFile(file)) {
      results.push(await downscaleImageFile(file));
      continue;
    }
    try {
      const blob = await fileToBlob(file);
      const result = await heic2any({ blob, toType: "image/jpeg", quality: 0.92 });
      const resultBlob = Array.isArray(result) ? result[0] : result;
      const newName = file.name.replace(/\.[^/.]+$/, ".jpg");
      const jpeg = new File([resultBlob], newName, { type: "image/jpeg" });
      results.push(await downscaleImageFile(jpeg));
    } catch (err) {
      console.warn(`Skipping HEIC conversion for ${file.name}:`, err);
    }
  }

  if (toastId) toast.dismiss(toastId);

  if (results.length === 0 && files.length > 0) {
    toast.error("Failed to convert images. Please try different files.");
  }

  return results;
}
