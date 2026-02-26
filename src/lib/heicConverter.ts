import heic2any from "heic2any";

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

  const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
  const resultBlob = Array.isArray(blob) ? blob[0] : blob;
  const newName = file.name.replace(/\.[^/.]+$/, ".jpg");
  return new File([resultBlob], newName, { type: "image/jpeg" });
}

export async function convertHeicFiles(files: File[]): Promise<File[]> {
  return Promise.all(files.map(convertHeicToJpeg));
}
