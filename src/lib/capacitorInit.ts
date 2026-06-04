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

  // Self-correcting safety net for stuck `.keyboard-open` class.
  // iOS sometimes fires `keyboardWillShow` without a matching
  // `keyboardWillHide` (notably on rotation), which permanently hides
  // anything tagged `.keyboard-hide` (e.g. the bottom nav).
  // Registered OUTSIDE the Keyboard try/catch so it runs even if the
  // Capacitor Keyboard plugin fails to load.
  const forceClearKeyboardState = () => {
    try {
      document.documentElement.classList.remove('keyboard-open');
      document.documentElement.style.setProperty('--keyboard-height', '0px');
      document.documentElement.style.setProperty(
        '--visual-viewport-height',
        `${window.innerHeight}px`
      );
    } catch (e) {
      console.warn('[boot] forceClearKeyboardState failed', e);
    }
  };

  const isEditableFocused = () => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable === true;
  };

  const clearIfKeyboardGone = () => {
    try {
      // If nothing editable is focused, the keyboard cannot be open — clear
      // unconditionally. This is the rotation case.
      if (!isEditableFocused()) {
        forceClearKeyboardState();
        return;
      }
      // Otherwise fall back to the viewport heuristic (e.g. user dismissed
      // keyboard via swipe without blurring the input).
      const visualH = window.visualViewport?.height ?? window.innerHeight;
      if (visualH >= window.innerHeight - 150) {
        forceClearKeyboardState();
      }
    } catch (e) {
      console.warn('[boot] clearIfKeyboardGone failed', e);
    }
  };

  const scheduleRotationCleanup = () => {
    // iOS settles the viewport at unpredictable times after rotation;
    // poll a few times to catch whichever moment it lands.
    setTimeout(clearIfKeyboardGone, 300);
    setTimeout(clearIfKeyboardGone, 800);
    setTimeout(clearIfKeyboardGone, 1500);
    setTimeout(clearIfKeyboardGone, 2500);
  };

  try {
    window.addEventListener('orientationchange', scheduleRotationCleanup);
    try {
      window.screen?.orientation?.addEventListener?.('change', scheduleRotationCleanup);
    } catch {}
    window.visualViewport?.addEventListener('resize', clearIfKeyboardGone);
    // Returning to the app after backgrounding (e.g. rotated while suspended).
    window.addEventListener('pageshow', clearIfKeyboardGone);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') clearIfKeyboardGone();
    });
  } catch (e) {
    console.warn('[boot] rotation cleanup listeners failed', e);
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


  // Android-only: ensure a notification channel exists so FCM notifications
  // surface correctly on Android 8+.
  if (Capacitor.getPlatform() === 'android') {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      await PushNotifications.createChannel({
        id: 'family_activity',
        name: 'Family activity',
        description: 'Posts, comments, messages, and events from your family circles',
        importance: 4, // IMPORTANCE_HIGH
        visibility: 1,
        sound: 'default',
        vibration: true,
        lights: true,
      });
    } catch (e) {
      console.warn('[boot] createChannel failed', e);
    }
  }

  // Push notifications — entirely optional. If the entitlement is missing
  // or the device can't register, swallow the error so launch completes.
  try {
    const tryRegister = (force = false) => {
      try {
        registerForPushNotifications({ force }).catch((e) => console.warn('[boot] push registration rejected', e));
      } catch (e) {
        console.warn('[boot] push registration threw', e);
      }
    };

    supabase.auth
      .getSession()
      .then(({ data }) => { if (data.session) tryRegister(); })
      .catch((e) => console.warn('[boot] getSession failed', e));

    supabase.auth.onAuthStateChange((event, session) => {
      if (!session) return;
      if (event === 'SIGNED_IN') {
        // Force re-registration so a different user signing in on the same
        // device immediately rewrites the push_tokens row to their user_id
        // (via register-push-token's server-side reclaim step).
        tryRegister(true);
      } else if (event === 'TOKEN_REFRESHED') {
        tryRegister();
      }
    });
  } catch (e) {
    console.warn('[boot] push setup failed', e);
  }
}
