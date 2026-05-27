import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

type Status = "verifying" | "success" | "error";

/**
 * /auth/callback — landing page for the email verification link.
 *
 * On success we deliberately DO NOT auto-sign-in the browser. The user
 * almost always signed up inside the native iOS app; we just want to
 * confirm the email server-side, then tell them to return to the app.
 * The web session created by exchangeCodeForSession is immediately
 * cleared so Chrome/Safari doesn't end up logged in.
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("verifying");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const hashError = hashParams.get("error_description") || url.searchParams.get("error_description");

        if (hashError) {
          throw new Error(hashError.replace(/\+/g, " "));
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else {
          // No token — likely opened /auth/callback directly. Treat as success
          // if there's already a session, otherwise error.
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            throw new Error("This verification link is incomplete or expired.");
          }
        }

        // Strip tokens from the URL so they don't sit in history.
        window.history.replaceState({}, "", "/auth/callback");

        // Immediately drop the web session so the browser isn't signed in.
        // Email confirmation is already persisted server-side at this point.
        try {
          await supabase.auth.signOut();
        } catch {
          // non-fatal
        }
        try {
          Object.keys(localStorage).forEach((key) => {
            if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
              localStorage.removeItem(key);
            }
          });
        } catch {
          // non-fatal
        }

        if (cancelled) return;
        setStatus("success");
      } catch (err: any) {
        if (cancelled) return;
        setErrorMessage(err?.message || "We couldn't verify this link.");
        setStatus("error");
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const openApp = () => {
    // Universal link — iOS hands off to the Familial app if installed
    // (AASA whitelists /auth/callback for the real bundle ID). Otherwise
    // the browser just stays on this page.
    window.location.href = "https://familialapp.lovable.app/auth/callback?verified=1";
  };

  return (
    <div
      className="min-h-[100dvh] bg-background flex flex-col items-center justify-center px-6 text-center"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <img src={logo} alt="Familial" className="h-16 w-auto mb-8 opacity-80" />

      {status === "verifying" && (
        <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
          <Loader2 className="h-12 w-12 text-muted-foreground animate-spin" />
          <p className="font-serif text-xl text-foreground">Verifying your email…</p>
        </div>
      )}

      {status === "success" && (
        <div className="flex flex-col items-center gap-5 max-w-sm animate-in zoom-in-50 fade-in duration-500">
          <div className="rounded-full bg-emerald-50 dark:bg-emerald-950/30 p-4">
            <CheckCircle2 className="h-16 w-16 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />
          </div>
          <h1 className="font-serif text-3xl text-foreground">Email verified</h1>
          <p className="text-sm text-muted-foreground">
            You're all set. Open the Familial app on your phone and sign in to finish setting up your account.
          </p>
          <div className="flex flex-col gap-2 w-full mt-2">
            <Button onClick={openApp} className="w-full">
              Open Familial app
            </Button>
            <button
              type="button"
              onClick={() => navigate("/auth", { replace: true })}
              className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
            >
              Continue in browser
            </button>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col items-center gap-4 max-w-sm animate-in fade-in duration-300">
          <XCircle className="h-12 w-12 text-destructive" strokeWidth={1.75} />
          <h1 className="font-serif text-2xl text-foreground">Link expired</h1>
          <p className="text-sm text-muted-foreground">{errorMessage}</p>
          <Button onClick={() => navigate("/auth", { replace: true })} className="mt-2">
            Back to sign in
          </Button>
        </div>
      )}
    </div>
  );
};

export default AuthCallback;
