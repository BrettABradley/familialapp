import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

let registrationAttempted = false;
let lastRegisteredUserId: string | null = null;
let lastRegisteredDeviceToken: string | null = null;
let registrationWatchdog: number | null = null;
let activeRegistration: Promise<PushRegistrationResult> | null = null;

export type PushRegistrationResult = {
  ok: boolean;
  status:
    | 'registered'
    | 'already_attempted'
    | 'not_native'
    | 'no_session'
    | 'permission_denied'
    | 'registration_error'
    | 'upload_failed'
    | 'timeout'
    | 'setup_failed';
  message: string;
};

/**
 * Most recently uploaded APNs device token for this app session, or null
 * if registration hasn't completed. Used at sign-out to tell the server
 * which row to remove from push_tokens so the device stops receiving
 * pushes for the user that just signed out.
 */
export function getRegisteredDeviceToken(): string | null {
  return lastRegisteredDeviceToken;
}

/**
 * Reset the in-memory registration guard. Called on sign-out / user-switch
 * so the next sign-in re-runs registration. Without this, a second account
 * signing in on the same device session would silently no-op.
 */
export function resetPushRegistrationState() {
  registrationAttempted = false;
  lastRegisteredUserId = null;
  lastRegisteredDeviceToken = null;
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
export async function registerForPushNotifications(options: { force?: boolean } = {}): Promise<PushRegistrationResult> {
  const platform = Capacitor.getPlatform();
  if (!Capacitor.isNativePlatform() || (platform !== 'ios' && platform !== 'android')) {
    console.log('[push] skip — not a native mobile platform');
    return { ok: false, status: 'not_native', message: 'Push registration only runs in the iOS/Android app.' };
  }

  if (activeRegistration) return activeRegistration;

  // Allow re-registration if the signed-in user changed
  const { data: sessionData } = await supabase.auth.getSession();
  const currentUserId = sessionData.session?.user?.id ?? null;
  if (!currentUserId) {
    registrationAttempted = false;
    lastRegisteredUserId = null;
    return { ok: false, status: 'no_session', message: 'Please sign in again before enabling push notifications.' };
  }

  if (!options.force && registrationAttempted && lastRegisteredUserId === currentUserId) {
    console.log('[push] already attempted this session for this user');
    return { ok: true, status: 'already_attempted', message: 'Push registration already ran for this session.' };
  }
  registrationAttempted = true;
  lastRegisteredUserId = currentUserId;

  activeRegistration = runPushRegistration().finally(() => {
    activeRegistration = null;
  });

  return activeRegistration;
}

async function runPushRegistration(): Promise<PushRegistrationResult> {
  const clearWatchdog = () => {
    if (registrationWatchdog) {
      window.clearTimeout(registrationWatchdog);
      registrationWatchdog = null;
    }
  };

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
      return { ok: false, status: 'permission_denied', message: 'Push permission is not enabled for Familial in iOS Settings.' };
    }

    await PushNotifications.removeAllListeners();

    return await new Promise<PushRegistrationResult>(async (resolve) => {
      let settled = false;
      const settle = (result: PushRegistrationResult) => {
        if (settled) return;
        settled = true;
        clearWatchdog();
        resolve(result);
      };

      await PushNotifications.addListener('registration', async (token) => {
        console.log('[push] token-received (APNs OK), length=', token.value?.length);
        try {
          const { data: sd } = await supabase.auth.getSession();
          if (!sd.session) {
            console.warn('[push] no session at token-received time — skipping upload');
            registrationAttempted = false;
            settle({ ok: false, status: 'no_session', message: 'Please sign in again so this device can be saved for push notifications.' });
            return;
          }

          const { error } = await supabase.functions.invoke('register-push-token', {
            headers: { Authorization: `Bearer ${sd.session.access_token}` },
            body: { device_token: token.value, platform: Capacitor.getPlatform() },
          });

          if (error) {
            console.error('[push] token-upload-failed:', error);
            registrationAttempted = false;
            settle({ ok: false, status: 'upload_failed', message: error.message || 'The device token could not be saved.' });
          } else {
            console.log('[push] token-uploaded ✅');
            lastRegisteredDeviceToken = token.value ?? null;
            settle({ ok: true, status: 'registered', message: 'This device is registered for push notifications.' });
          }
        } catch (e) {
          console.error('[push] token-upload threw:', e);
          registrationAttempted = false;
          settle({ ok: false, status: 'upload_failed', message: e instanceof Error ? e.message : 'The device token could not be saved.' });
        }
      });

      await PushNotifications.addListener('registrationError', (err) => {
        const msg = String(err?.error ?? err ?? '');
        console.error('[push] registration-error:', msg);
        if (/aps-environment|entitlement/i.test(msg)) {
          console.error(
            '[push] ⚠️ FIX: Open ios/App/App.xcworkspace → App target → ' +
              'Signing & Capabilities → + Capability → "Push Notifications". ' +
              'Without the aps-environment entitlement APNs cannot issue a token.'
          );
        }
        if (Capacitor.getPlatform() === 'android' && /FirebaseApp|google-services|FIS_AUTH|SERVICE_NOT_AVAILABLE/i.test(msg)) {
          console.error(
            '[push] android-fcm-not-configured — google-services.json is missing or invalid. ' +
              'Drop android/app/google-services.json from Firebase console and rebuild the AAB.'
          );
        }
        registrationAttempted = false; // allow retry on next sign-in
        settle({ ok: false, status: 'registration_error', message: msg || 'This device could not be registered for push notifications.' });
      });

      await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const link = action.notification?.data?.link;
        if (link && typeof link === 'string') {
          // Hand off to the React Router bridge in <App />. The bridge calls
          // navigate(link) so React Router owns the history entry — no
          // synthetic popstate, no duplicate pushState, no collisions with
          // Messages' sentinel history entry. This keeps the back button /
          // bottom nav fully interactive after a deep-link tap on iOS.
          window.dispatchEvent(new CustomEvent('familial:deep-link', { detail: link }));
        }
      });


      console.log('[push] register-called');
      try {
        await PushNotifications.register();
      } catch (e) {
        console.error('[push] register threw:', e);
        registrationAttempted = false;
        settle({ ok: false, status: 'registration_error', message: e instanceof Error ? e.message : 'iOS could not register this device with APNs.' });
        return;
      }

      registrationWatchdog = window.setTimeout(() => {
        console.warn(
          '[push] no registration callback after 15s. If permission was granted, add the AppDelegate bridge from Capacitor PushNotifications docs, then run npm run cap:sync:ios and upload a new TestFlight build.'
        );
        registrationAttempted = false;
        settle({ ok: false, status: 'timeout', message: 'iOS did not return an APNs token. Rebuild after running the iOS sync script so the AppDelegate push bridge is included.' });
      }, 15000);
    });
  } catch (e) {
    console.error('[push] setup failed:', e);
    registrationAttempted = false;
    clearWatchdog();
    return { ok: false, status: 'setup_failed', message: e instanceof Error ? e.message : 'Push notifications could not be initialized.' };
  }
}
