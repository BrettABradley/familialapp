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

export async function convertHeicToJpeg(file: File): Promise<File> {
  if (!isHeicFile(file)) return file;

  const toastId = toast.loading("Converting image format…");
  try {
    const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
    const resultBlob = Array.isArray(blob) ? blob[0] : blob;
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
  try {
    const results = await Promise.all(
      files.map(async (file) => {
        if (!isHeicFile(file)) return file;
        const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
        const resultBlob = Array.isArray(blob) ? blob[0] : blob;
        const newName = file.name.replace(/\.[^/.]+$/, ".jpg");
        return new File([resultBlob], newName, { type: "image/jpeg" });
      })
    );
    toast.dismiss(toastId);
    return results;
  } catch (err) {
    toast.dismiss(toastId);
    toast.error("Failed to convert image. Please try a different file.");
    throw err;
  }
}
