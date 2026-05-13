import { Capacitor } from '@capacitor/core';

export interface PickedImage {
  dataUrl: string;
  file: File;
}

/**
 * Pick an image using the native camera on Capacitor or file input on web.
 * On native, uses @capacitor/camera with CameraSource.Prompt (camera or gallery).
 * On web, falls back to a hidden file input.
 */
export async function pickImage(): Promise<PickedImage | null> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      // Use Photos source on iOS to avoid the iPad popover-anchor crash that
      // CameraSource.Prompt triggers (action sheets must be presented as
      // popovers on iPad). Users can take a new photo from inside the
      // native photo picker via the camera button there.
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
      });

      if (!photo.dataUrl) return null;

      // Convert data URL to File
      const res = await fetch(photo.dataUrl);
      const blob = await res.blob();
      const ext = photo.format || 'jpeg';
      const file = new File([blob], `photo.${ext}`, { type: `image/${ext}` });

      return { dataUrl: photo.dataUrl, file };
    } catch (err: any) {
      // User cancelled or permission denied
      if (err?.message?.includes('User cancelled') || err?.message?.includes('cancelled')) {
        return null;
      }
      throw err;
    }
  }

  // Web fallback: use a hidden file input
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.heic,.heif';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        resolve({ dataUrl: reader.result as string, file });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    // Handle cancel (no reliable event, but this covers most cases)
    input.click();
    // If focus returns without a file, resolve null after a delay
    window.addEventListener('focus', function onFocus() {
      window.removeEventListener('focus', onFocus);
      setTimeout(() => {
        if (!input.files?.length) resolve(null);
      }, 500);
    }, { once: true });
  });
}
