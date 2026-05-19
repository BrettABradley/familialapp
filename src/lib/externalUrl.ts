import { Capacitor } from '@capacitor/core';

/**
 * Opens a URL in the **system browser** (Safari on iOS, Chrome on Android)
 * so the user gets a real address bar + back/forward and can always return
 * to our app via the OS task switcher. We deliberately avoid the in-app
 * SFSafariViewController because Stripe Checkout's "Return to app" link
 * doesn't always re-foreground the WKWebView cleanly.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      // App plugin's openUrl hands the URL to the OS, which launches Safari/Chrome.
      const { App } = await import('@capacitor/app');
      // @ts-expect-error - openUrl exists at runtime on iOS/Android
      if (typeof App.openUrl === 'function') {
        // @ts-expect-error
        await App.openUrl({ url });
        return;
      }
    } catch {
      // fall through to Browser plugin
    }
    try {
      const { Browser } = await import('@capacitor/browser');
      // presentationStyle 'fullscreen' keeps SFSafariViewController's Done
      // button visible at the top-left so the user can always exit.
      await Browser.open({ url, presentationStyle: 'fullscreen' });
      return;
    } catch {
      // last resort
    }
  }
  window.open(url, '_blank');
}
