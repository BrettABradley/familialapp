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

/**
 * Opens a maps app for the given location/query. On native, we try the
 * platform's native scheme first (so iOS Apple Maps opens the actual app,
 * not Safari), then fall back to the universal https:// link.
 */
export async function openMapsApp(
  app: 'apple' | 'google',
  query: string
): Promise<void> {
  const encoded = encodeURIComponent(query);
  const platform = Capacitor.getPlatform();

  const tryOpen = async (url: string): Promise<boolean> => {
    try {
      const { App } = await import('@capacitor/app');
      // @ts-expect-error - openUrl exists at runtime on iOS/Android
      if (typeof App.openUrl === 'function') {
        // @ts-expect-error - canOpenUrl is available on iOS
        const can = App.canOpenUrl ? await App.canOpenUrl({ url }).catch(() => ({ value: true })) : { value: true };
        if (can?.value === false) return false;
        // @ts-expect-error
        const res = await App.openUrl({ url });
        return res?.completed !== false;
      }
    } catch {
      return false;
    }
    return false;
  };

  if (Capacitor.isNativePlatform()) {
    // 1) Native scheme first
    if (app === 'apple' && platform === 'ios') {
      if (await tryOpen(`maps://?q=${encoded}`)) return;
      if (await tryOpen(`https://maps.apple.com/?q=${encoded}`)) return;
    } else if (app === 'google') {
      if (platform === 'ios') {
        if (await tryOpen(`comgooglemaps://?q=${encoded}`)) return;
      } else if (platform === 'android') {
        if (await tryOpen(`geo:0,0?q=${encoded}`)) return;
      }
      if (await tryOpen(`https://www.google.com/maps/search/?api=1&query=${encoded}`)) return;
    } else if (app === 'apple' && platform === 'android') {
      // Apple Maps doesn't exist on Android — silently use Google Maps instead
      if (await tryOpen(`geo:0,0?q=${encoded}`)) return;
      if (await tryOpen(`https://www.google.com/maps/search/?api=1&query=${encoded}`)) return;
    }
  }

  // Web / final fallback
  const webUrl =
    app === 'apple'
      ? `https://maps.apple.com/?q=${encoded}`
      : `https://www.google.com/maps/search/?api=1&query=${encoded}`;
  await openExternalUrl(webUrl);
}
