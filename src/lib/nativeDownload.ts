import { Capacitor } from "@capacitor/core";

/**
 * Download a file from a URL.
 *
 * On native iOS/Android (Capacitor), writes the file to the cache directory
 * and opens the native share sheet so the user can "Save Image" to Photos
 * or "Save to Files" for other file types — `<a download>` doesn't work in
 * iOS WKWebView.
 *
 * On web, falls back to the standard anchor-tag download flow.
 */
function isImageFilename(name: string): boolean {
  return /\.(jpe?g|png|gif|heic|heif|webp|bmp|tiff?)$/i.test(name);
}

function isVideoFilename(name: string): boolean {
  return /\.(mp4|mov|m4v|3gp|avi|mkv)$/i.test(name);
}

export async function downloadFile(url: string, suggestedName?: string): Promise<void> {
  const filename =
    suggestedName ||
    url.split("/").pop()?.split("?")[0] ||
    `download-${Date.now()}`;

  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");

    // Fetch the remote file to a local cache path. The community Media
    // plugin (and iOS PHPhotoLibrary) requires a local file:// URI — passing
    // a remote https URL silently fails.
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch file (${res.status})`);
    const blob = await res.blob();
    const base64 = await blobToBase64(blob);

    const cachePath = `download-${Date.now()}-${filename}`;
    const written = await Filesystem.writeFile({
      path: cachePath,
      data: base64,
      directory: Directory.Cache,
    });

    // For images/videos: save the LOCAL file to the device camera roll
    if (isImageFilename(filename) || isVideoFilename(filename)) {
      try {
        const { Media } = await import("@capacitor-community/media");
        if (isImageFilename(filename)) {
          await Media.savePhoto({ path: written.uri });
        } else {
          await Media.saveVideo({ path: written.uri });
        }
        // Best-effort cleanup
        try {
          await Filesystem.deleteFile({
            path: cachePath,
            directory: Directory.Cache,
          });
        } catch {}
        try {
          const { toast } = await import("sonner");
          toast.success("Saved to Photos");
        } catch {}
        return;
      } catch (err) {
        console.warn("Media.save failed, falling back to share sheet:", err);
        // Fall through to share-sheet fallback below
      }
    }

    try {
      await Share.share({
        url: written.uri,
        dialogTitle: "Save",
      });
    } catch (err: any) {
      if (!/cancel/i.test(err?.message || "")) throw err;
    }
    return;
  }

  // Web fallback
  const res = await fetch(url);
  const blob = await res.blob();
  await downloadBlob(blob, filename);
}

/**
 * Download an in-memory Blob (e.g. a zipped archive).
 * On native, writes to cache + shares; on web, uses anchor download.
 */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const base64 = await blobToBase64(blob);
    const written = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
    });
    try {
      await Share.share({ url: written.uri, dialogTitle: "Save" });
    } catch (err: any) {
      if (!/cancel/i.test(err?.message || "")) throw err;
    }
    return;
  }
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Strip the data: prefix — Capacitor expects raw base64
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
