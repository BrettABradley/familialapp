import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

let registrationAttempted = false;

/**
 * Register the device for APNs push notifications (iOS native only).
 * Safe to call multiple times — only attempts once per app session.
 * Must be called when a user is authenticated so the token can be persisted.
 */
export async function registerForPushNotifications() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') return;
  if (registrationAttempted) return;
  registrationAttempted = true;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') {
      console.log('[push] permission not granted:', perm.receive);
      return;
    }

    // Listeners (idempotent — Capacitor de-dupes by reference, but we only call once)
    await PushNotifications.removeAllListeners();

    await PushNotifications.addListener('registration', async (token) => {
      console.log('[push] APNs token received');
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          console.warn('[push] no session — skipping token upload');
          return;
        }
        const { error } = await supabase.functions.invoke('register-push-token', {
          body: { device_token: token.value },
        });
        if (error) console.error('[push] register-push-token failed:', error);
      } catch (e) {
        console.error('[push] token upload threw:', e);
      }
    });

    await PushNotifications.addListener('registrationError', (err) => {
      console.error('[push] registrationError:', err);
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const link = action.notification?.data?.link;
      if (link && typeof link === 'string') {
        window.location.href = link;
      }
    });

    await PushNotifications.register();
  } catch (e) {
    console.error('[push] setup failed:', e);
    registrationAttempted = false; // allow retry
  }
}
