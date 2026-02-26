import heic2any from "heic2any";
import { toast } from "sonner";

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

export async function convertHeicToJpeg(file: File): Promise<File> {
  if (!isHeicFile(file)) return file;

  const toastId = toast.loading("Converting image format…");
  try {
    const blob = await fileToBlob(file);
    const result = await heic2any({ blob, toType: "image/jpeg", quality: 0.92 });
    const resultBlob = Array.isArray(result) ? result[0] : result;
    const newName = file.name.replace(/\.[^/.]+$/, ".jpg");
    toast.dismiss(toastId);
    return new File([resultBlob], newName, { type: "image/jpeg" });
  } catch (err) {
    toast.dismiss(toastId);
    toast.error("Failed to convert image. Please try a different file.");
    throw err;
  }
}

export async function convertHeicFiles(files: File[]): Promise<File[]> {
  const hasHeic = files.some(isHeicFile);
  if (!hasHeic) return files;

  const toastId = toast.loading("Converting image format…");
  const results: File[] = [];

  for (const file of files) {
    if (!isHeicFile(file)) {
      results.push(file);
      continue;
    }
    try {
      const blob = await fileToBlob(file);
      const result = await heic2any({ blob, toType: "image/jpeg", quality: 0.92 });
      const resultBlob = Array.isArray(result) ? result[0] : result;
      const newName = file.name.replace(/\.[^/.]+$/, ".jpg");
      results.push(new File([resultBlob], newName, { type: "image/jpeg" }));
    } catch (err) {
      console.warn(`Skipping HEIC conversion for ${file.name}:`, err);
      // Skip failed file rather than aborting entire batch
    }
  }

  toast.dismiss(toastId);

  if (results.length === 0 && files.length > 0) {
    toast.error("Failed to convert images. Please try different files.");
  }

  return results;
}
