import { Capacitor } from '@capacitor/core';
import { registerForPushNotifications } from './pushNotifications';
import { supabase } from '@/integrations/supabase/client';

/**
 * Initialize Capacitor plugins. Every plugin call is isolated in its own
 * try/catch so a single failing plugin (missing pod, missing entitlement,
 * unsupported API on a device) can never take down the launch sequence.
 *
 * This function is intentionally fire-and-forget — errors are logged but
 * never rethrown. The WebView must render even if every native plugin fails.
 */
export async function initCapacitorPlugins() {
  if (!Capacitor.isNativePlatform()) return;

  // Hide splash screen as soon as we can — never let it linger past launch
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    // Give the JS bundle a beat to mount before hiding, then hide.
    setTimeout(() => {
      SplashScreen.hide().catch((e) => console.warn('[boot] splash hide failed', e));
    }, 300);
  } catch (e) {
    console.warn('[boot] splash plugin load failed', e);
  }

  // Status bar — non-fatal if it fails
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    try { await StatusBar.setOverlaysWebView({ overlay: true }); } catch (e) { console.warn('[boot] StatusBar.setOverlaysWebView failed', e); }
    try { await StatusBar.setStyle({ style: Style.Light }); } catch (e) { console.warn('[boot] StatusBar.setStyle failed', e); }
  } catch (e) {
    console.warn('[boot] StatusBar plugin load failed', e);
  }

  // Keyboard listeners — non-fatal if plugin is missing
  try {
    const { Keyboard } = await import('@capacitor/keyboard');

    Keyboard.addListener('keyboardWillShow', (info) => {
      try {
        document.documentElement.style.setProperty(
          '--keyboard-height',
          `${info.keyboardHeight}px`
        );
        const visualHeight = window.innerHeight - info.keyboardHeight;
        document.documentElement.style.setProperty(
          '--visual-viewport-height',
          `${visualHeight}px`
        );
        document.documentElement.classList.add('keyboard-open');
      } catch (e) {
        console.warn('[boot] keyboardWillShow handler failed', e);
      }
    });

    Keyboard.addListener('keyboardWillHide', () => {
      try {
        document.documentElement.style.setProperty('--keyboard-height', '0px');
        document.documentElement.style.setProperty(
          '--visual-viewport-height',
          `${window.innerHeight}px`
        );
        document.documentElement.classList.remove('keyboard-open');
      } catch (e) {
        console.warn('[boot] keyboardWillHide handler failed', e);
      }
    });
  } catch (e) {
    console.warn('[boot] Keyboard plugin load failed', e);
  }

  // Push notifications — entirely optional. If the entitlement is missing
  // or the device can't register, swallow the error so launch completes.
  try {
    const tryRegister = () => {
      try {
        registerForPushNotifications().catch((e) => console.warn('[boot] push registration rejected', e));
      } catch (e) {
        console.warn('[boot] push registration threw', e);
      }
    };

    supabase.auth
      .getSession()
      .then(({ data }) => { if (data.session) tryRegister(); })
      .catch((e) => console.warn('[boot] getSession failed', e));

    supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        tryRegister();
      }
    });
  } catch (e) {
    console.warn('[boot] push setup failed', e);
  }
}
