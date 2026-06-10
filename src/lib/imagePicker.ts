import { Capacitor } from '@capacitor/core';

export interface PickedImage {
  dataUrl: string;
  file: File;
}

export type PickImageSource = 'prompt' | 'photos' | 'camera';

export interface PickImageOptions {
  /**
   * Where the image should come from on native platforms.
   * - 'prompt' (default): OS action sheet — Take Photo / Choose from Library
   * - 'photos': open photo library only
   * - 'camera': open camera only
   * Web always falls back to the file picker regardless of this value.
   */
  source?: PickImageSource;
}

/**
 * iPad detection — `CameraSource.Prompt` shows an action sheet which crashes
 * on iPad without a popover anchor. Force 'photos' there.
 */
function isIPad(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad/i.test(ua)) return true;
  // Modern iPadOS reports as Mac — disambiguate via touch points.
  return /Mac/i.test(ua) && (navigator.maxTouchPoints || 0) > 1;
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
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], fallbackName, { type: blob.type || 'image/jpeg' });
    return { dataUrl, file };
  }
}

async function ensurePhotosPermission(): Promise<void> {
  const { Camera } = await import('@capacitor/camera');
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
    if (permErr?.message?.includes("doesn't have access")) throw permErr;
  }
}

/**
 * Pick a single image. On native, opens an action sheet by default so the user
 * can Take Photo or Choose from Library; pass `source` to lock to one.
 */
export async function pickImage(options: PickImageOptions = {}): Promise<PickedImage | null> {
  const desiredSource: PickImageSource = options.source ?? 'prompt';

  if (Capacitor.isNativePlatform()) {
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');

      await ensurePhotosPermission();

      // iPad's action sheet needs a popover anchor — fall back to Photos.
      const effective: PickImageSource =
        desiredSource === 'prompt' && isIPad() ? 'photos' : desiredSource;

      const capSource =
        effective === 'camera'
          ? CameraSource.Camera
          : effective === 'photos'
          ? CameraSource.Photos
          : CameraSource.Prompt;

      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: capSource,
        promptLabelHeader: 'Add Photo',
        promptLabelPhoto: 'Choose from Library',
        promptLabelPicture: 'Take Photo',
      });

      if (!photo.dataUrl) return null;

      return await normalizeImageOrientation(photo.dataUrl, `photo.${photo.format || 'jpeg'}`);
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('User cancelled') || msg.includes('cancelled')) return null;
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
    // Hint mobile browsers to open the camera when explicitly requested.
    if (desiredSource === 'camera') input.setAttribute('capture', 'environment');
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

export interface PickImagesOptions {
  /** Maximum number of images the user may select. 0 = unlimited (default 0). */
  limit?: number;
}

/**
 * Pick multiple images. On native uses Capacitor's `Camera.pickImages` which
 * gives a real multi-select UI on both iOS and Android. On web falls back to
 * a hidden `<input type="file" multiple>`.
 */
export async function pickImages(options: PickImagesOptions = {}): Promise<PickedImage[]> {
  const limit = Math.max(0, options.limit ?? 0);

  if (Capacitor.isNativePlatform()) {
    try {
      const { Camera } = await import('@capacitor/camera');
      await ensurePhotosPermission();

      const result = await Camera.pickImages({
        quality: 90,
        limit, // 0 = unlimited
      });

      const picked: PickedImage[] = [];
      for (const photo of result.photos || []) {
        const url = photo.webPath || (photo as any).path;
        if (!url) continue;
        try {
          const res = await fetch(url);
          const blob = await res.blob();
          const dataUrl: string = await new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.onerror = () => reject(r.error);
            r.readAsDataURL(blob);
          });
          const normalized = await normalizeImageOrientation(
            dataUrl,
            `photo.${photo.format || 'jpeg'}`,
          );
          picked.push(normalized);
        } catch {
          // Skip files we couldn't decode — keep the rest.
        }
      }
      return picked;
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('User cancelled') || msg.includes('cancelled')) return [];
      if (msg.includes('denied') || msg.toLowerCase().includes('permission')) {
        throw new Error(
          "Familial doesn't have access to your photos yet. Open Settings → Familial → Photos and choose \"All Photos\" or \"Selected Photos\", then try again.",
        );
      }
      throw err;
    }
  }

  // Web fallback: hidden file input with `multiple`.
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.heic,.heif';
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      if (!files.length) {
        resolve([]);
        return;
      }
      const picked: PickedImage[] = [];
      for (const file of files) {
        try {
          const dataUrl: string = await new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result as string);
            r.onerror = () => rej(r.error);
            r.readAsDataURL(file);
          });
          try {
            picked.push(await normalizeImageOrientation(dataUrl, file.name));
          } catch {
            picked.push({ dataUrl, file });
          }
        } catch {
          // skip
        }
      }
      resolve(picked);
    };
    input.click();
    window.addEventListener(
      'focus',
      function onFocus() {
        window.removeEventListener('focus', onFocus);
        setTimeout(() => {
          if (!input.files?.length) resolve([]);
        }, 500);
      },
      { once: true },
    );
  });
}
