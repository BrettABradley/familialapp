import { Capacitor } from '@capacitor/core';

export interface PickedImage {
  dataUrl: string;
  file: File;
}

/**
 * Re-encode a picked image to a normalized JPEG with EXIF orientation baked
 * into the pixels and EXIF metadata stripped. This is the canonical fix for
 * profile pictures that come out stretched/rotated/mismatched after cropping
 * on iOS — Capacitor's data URL keeps the original EXIF rotation flag, but
 * Cropper components and our cropping canvas don't agree on how to apply it,
 * so different dimensions end up sampled vs. drawn.
 */
async function normalizeImageOrientation(dataUrl: string, fallbackName: string): Promise<PickedImage> {
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();

    let bitmap: ImageBitmap;
    try {
      // @ts-ignore — imageOrientation is supported in modern Safari/Chrome
      bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch {
      // Older browsers: fall back to plain decode (browser may auto-orient anyway)
      bitmap = await createImageBitmap(blob);
    }

    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d context unavailable');
    ctx.drawImage(bitmap, 0, 0);

    const normalizedBlob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
        'image/jpeg',
        0.92,
      );
    });

    const normalizedFile = new File([normalizedBlob], fallbackName.replace(/\.[^.]+$/, '') + '.jpg', {
      type: 'image/jpeg',
    });
    const normalizedDataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(normalizedBlob);
    });

    return { dataUrl: normalizedDataUrl, file: normalizedFile };
  } catch {
    // If normalization fails for any reason, fall back to the original dataUrl
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], fallbackName, { type: blob.type || 'image/jpeg' });
    return { dataUrl, file };
  }
}

/**
 * Pick an image using the native photo picker on Capacitor or file input on web.
 * On native, explicitly requests photos permission first so we can show a clean
 * error if the user has previously denied it (iOS otherwise silently fails
 * with a generic "no access" message).
 */
export async function pickImage(): Promise<PickedImage | null> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');

      // Proactively request photos permission. iOS shows the system prompt the
      // first time; subsequent calls return the current status. If the user
      // previously denied, we throw a clear error pointing them to Settings.
      try {
        const status = await Camera.checkPermissions();
        if (status.photos !== 'granted' && status.photos !== 'limited') {
          const requested = await Camera.requestPermissions({ permissions: ['photos'] });
          if (requested.photos !== 'granted' && requested.photos !== 'limited') {
            throw new Error(
              "Familial doesn't have access to your photos yet. Open Settings → Familial → Photos and choose \"All Photos\" or \"Selected Photos\", then try again.",
            );
          }
        }
      } catch (permErr: any) {
        // If permission check itself fails (older plugin versions), continue —
        // getPhoto will trigger the system prompt anyway.
        if (permErr?.message?.includes("doesn't have access")) throw permErr;
      }

      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        // Photos source avoids the iPad popover-anchor crash that
        // CameraSource.Prompt triggers (action sheets must be popovers on iPad).
        source: CameraSource.Photos,
      });

      if (!photo.dataUrl) return null;

      return await normalizeImageOrientation(photo.dataUrl, `photo.${photo.format || 'jpeg'}`);
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('User cancelled') || msg.includes('cancelled')) return null;
      // Surface a friendlier permission error for the common iOS case.
      if (msg.includes('denied') || msg.toLowerCase().includes('permission')) {
        throw new Error(
          "Familial doesn't have access to your photos yet. Open Settings → Familial → Photos and choose \"All Photos\" or \"Selected Photos\", then try again.",
        );
      }
      throw err;
    }
  }

  // Web fallback: hidden file input.
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.heic,.heif';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        try {
          resolve(await normalizeImageOrientation(dataUrl, file.name));
        } catch {
          resolve({ dataUrl, file });
        }
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    input.click();
    window.addEventListener(
      'focus',
      function onFocus() {
        window.removeEventListener('focus', onFocus);
        setTimeout(() => {
          if (!input.files?.length) resolve(null);
        }, 500);
      },
      { once: true },
    );
  });
}
