import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { getRegisteredDeviceToken, resetPushRegistrationState } from "@/lib/pushNotifications";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: Error | null; needsVerification?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resendVerification: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, displayName?: string) => {
    // Verification gate (added after launch): every new signup must click the
    // confirmation link before they can use the app. /auth/callback exchanges
    // the token, shows a green check, and signs them in officially.
    const redirectUrl = `${window.location.origin}/auth/callback`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          display_name: displayName,
        }
      }
    });

    // Supabase returns a fake user with empty identities for duplicate emails
    // when email confirmation is disabled
    if (!error && data?.user && (!data.user.identities || data.user.identities.length === 0)) {
      return { error: new Error("User already registered") };
    }

    // Safety net: if Supabase ever hands back a session before the email is
    // verified (race / config drift), drop it immediately so the unverified
    // account can't bypass the gate.
    if (!error && data?.session && !data.user?.email_confirmed_at) {
      try { await supabase.auth.signOut(); } catch {}
    }

    return { error: error as Error | null, needsVerification: !error };
  };

  const resendVerification = async (email: string) => {
    const redirectUrl = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: redirectUrl },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    // BEFORE clearing the session: tell the server to remove this device's
    // push token row so the signed-out phone stops receiving notifications.
    // Bounded to 2s so a slow network never blocks sign-out UX.
    if (Capacitor.isNativePlatform()) {
      const deviceToken = getRegisteredDeviceToken();
      if (deviceToken) {
        try {
          await Promise.race([
            supabase.functions.invoke("unregister-push-token", {
              body: { device_token: deviceToken },
            }),
            new Promise((resolve) => setTimeout(resolve, 2000)),
          ]);
        } catch {
          // Non-fatal: register-push-token's reclaim logic will clean
          // this row up the next time anyone registers this device token.
        }
      }
    }
    resetPushRegistrationState();

    try {
      await supabase.auth.signOut();
    } catch {
      // If session is already expired/invalid, signOut may throw —
      // we still want to clear local state and redirect.
    }
    // Force-clear persisted auth token from localStorage so stale sessions
    // don't silently re-authenticate on next page load.
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        localStorage.removeItem(key);
      }
    });
    try {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith('twoFactorVerified:')) localStorage.removeItem(k);
      });
      Object.keys(sessionStorage).forEach((k) => {
        if (k.startsWith('twoFactorVerified:')) sessionStorage.removeItem(k);
      });
    } catch {}

    setSession(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
