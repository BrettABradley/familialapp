import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

let registrationAttempted = false;
let lastRegisteredUserId: string | null = null;
let registrationWatchdog: number | null = null;

/**
 * Reset the in-memory registration guard. Called on sign-out / user-switch
 * so the next sign-in re-runs registration. Without this, a second account
 * signing in on the same device session would silently no-op.
 */
export function resetPushRegistrationState() {
  registrationAttempted = false;
  lastRegisteredUserId = null;
}

/**
 * Register the device for APNs push notifications (iOS native only).
 *
 * Common silent-failure mode: if the iOS "Push Notifications" capability
 * has NOT been enabled in Xcode (Signing & Capabilities → + Capability →
 * Push Notifications), iOS will still show the permission prompt and
 * return `granted`, but APNs will reject `register()` and the
 * `registrationError` listener will fire with a message like:
 *   "no valid 'aps-environment' entitlement string found for application"
 * In that case nothing ever lands in the push_tokens table — which is
 * exactly what we observed in production. The logs below make this
 * diagnosable from Safari Web Inspector.
 */
export async function registerForPushNotifications() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
    console.log('[push] skip — not native iOS');
    return;
  }

  // Allow re-registration if the signed-in user changed
  const { data: sessionData } = await supabase.auth.getSession();
  const currentUserId = sessionData.session?.user?.id ?? null;
  if (registrationAttempted && lastRegisteredUserId === currentUserId) {
    console.log('[push] already attempted this session for this user');
    return;
  }
  registrationAttempted = true;
  lastRegisteredUserId = currentUserId;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    let perm = await PushNotifications.checkPermissions();
    console.log('[push] permission-status (initial):', perm.receive);
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
      console.log('[push] permission-status (after prompt):', perm.receive);
    }
    if (perm.receive !== 'granted') {
      console.warn('[push] permission not granted — aborting:', perm.receive);
      registrationAttempted = false; // allow retry if user re-enables in Settings
      return;
    }

    await PushNotifications.removeAllListeners();

    await PushNotifications.addListener('registration', async (token) => {
      if (registrationWatchdog) {
        window.clearTimeout(registrationWatchdog);
        registrationWatchdog = null;
      }
      console.log('[push] token-received (APNs OK), length=', token.value?.length);
      try {
        const { data: sd } = await supabase.auth.getSession();
        if (!sd.session) {
          console.warn('[push] no session at token-received time — skipping upload');
          return;
        }
        const { error } = await supabase.functions.invoke('register-push-token', {
          body: { device_token: token.value },
        });
        if (error) {
          console.error('[push] token-upload-failed:', error);
        } else {
          console.log('[push] token-uploaded ✅');
        }
      } catch (e) {
        console.error('[push] token-upload threw:', e);
      }
    });

    await PushNotifications.addListener('registrationError', (err) => {
      if (registrationWatchdog) {
        window.clearTimeout(registrationWatchdog);
        registrationWatchdog = null;
      }
      const msg = String(err?.error ?? err ?? '');
      console.error('[push] registration-error:', msg);
      if (/aps-environment|entitlement/i.test(msg)) {
        console.error(
          '[push] ⚠️ FIX: Open ios/App/App.xcworkspace → App target → ' +
            'Signing & Capabilities → + Capability → "Push Notifications". ' +
            'Without the aps-environment entitlement APNs cannot issue a token.'
        );
      }
      registrationAttempted = false; // allow retry on next sign-in
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const link = action.notification?.data?.link;
      if (link && typeof link === 'string') {
        window.location.href = link;
      }
    });

    console.log('[push] register-called');
    await PushNotifications.register();
    registrationWatchdog = window.setTimeout(() => {
      console.warn(
        '[push] no registration callback after 15s. If permission was granted, add the AppDelegate bridge from Capacitor PushNotifications docs, then run npm run cap:sync:ios and upload a new TestFlight build.'
      );
      registrationAttempted = false;
      registrationWatchdog = null;
    }, 15000);
  } catch (e) {
    console.error('[push] setup failed:', e);
    registrationAttempted = false;
  }
}
