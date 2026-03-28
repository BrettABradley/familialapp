import { Capacitor } from '@capacitor/core';

/**
 * Opens a URL using the in-app browser on native platforms,
 * or via window.location.href on the web.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
  } else {
    window.location.href = url;
  }
}
