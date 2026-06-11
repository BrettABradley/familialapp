import { Capacitor } from '@capacitor/core';
import { registerForPushNotifications } from './pushNotifications';
import { supabase } from '@/integrations/supabase/client';
import { drainPendingIapReceipts, isIOSNative } from './iapPurchase';


/**
 * Initialize Capacitor plugins. Every plugin call is isolated in its own
 * try/catch so a single failing plugin (missing pod, missing entitlement,
 * unsupported API on a device) can never take down the launch sequence.
 *
 * This function is intentionally fire-and-forget — errors are logged but
 * never rethrown. The WebView must render even if every native plugin fails.
 */
export async function hideSplashScreen() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide({ fadeOutDuration: 400 });
  } catch (e) {
    console.warn('[boot] splash hide failed', e);
  }
}

export async function initCapacitorPlugins() {
  if (!Capacitor.isNativePlatform()) return;

  // NOTE: Splash hiding is now driven from main.tsx after React's first
  // paint to eliminate the black flash that occurred when the splash was
  // hidden before the WebView had committed its first frame.

  // Status bar — non-fatal if it fails. Match the system color scheme so
  // the status-bar icons stay legible whether the user is in light or dark
  // mode (Style.Light = light icons for dark backgrounds; Style.Dark =
  // dark icons for light backgrounds).
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    try { await StatusBar.setOverlaysWebView({ overlay: true }); } catch (e) { console.warn('[boot] StatusBar.setOverlaysWebView failed', e); }

    const applyStatusBarStyle = async () => {
      try {
        const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
        await StatusBar.setStyle({ style: prefersDark ? Style.Light : Style.Dark });
      } catch (e) {
        console.warn('[boot] StatusBar.setStyle failed', e);
      }
    };
    await applyStatusBarStyle();

    try {
      window
        .matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', () => { applyStatusBarStyle(); });
    } catch (e) {
      console.warn('[boot] prefers-color-scheme listener failed', e);
    }
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

  // iOS IAP recovery: if a previous purchase didn't make it through to the
  // backend (e.g. Apple App Store Server API was briefly returning 401, or
  // the network died right after Apple Pay), the receipt is queued locally.
  // Retry on launch and on every app resume so the user never has to manually
  // tap Restore Purchases to recover a paid purchase.
  if (isIOSNative()) {
    const tryDrain = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return; // Need to be signed in to call the function
        const credited = await drainPendingIapReceipts();
        if (credited > 0) {
          console.log(`[boot] IAP recovery credited ${credited} pending purchase(s)`);
          // Best-effort UI nudge — reload so member caps / plan badges refresh.
          try { window.dispatchEvent(new CustomEvent('iap-credited', { detail: { credited } })); } catch {}
        }
      } catch (e) {
        console.warn('[boot] drainPendingIapReceipts failed', e);
      }
    };

    // Initial drain shortly after launch (let auth settle first).
    setTimeout(tryDrain, 2500);

    // Drain again whenever the app comes back to the foreground.
    try {
      const { App } = await import('@capacitor/app');
      App.addListener('appStateChange', (state) => {
        if (state.isActive) tryDrain();
      });
    } catch (e) {
      console.warn('[boot] App.addListener failed', e);
    }

    // Drain after sign-in too (a user might be on /auth when the queue exists).
    supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        setTimeout(tryDrain, 500);
      }
    });
  }
}

