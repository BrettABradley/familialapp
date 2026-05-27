import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

type Status = "verifying" | "success" | "error";

const VERIFIED_FLAG = "familial:emailJustVerified";

/**
 * /auth/callback — landing page for the email verification link.
 *
 * Branches by platform:
 *
 * - **Web**: Supabase's /auth/v1/verify endpoint already set
 *   email_confirmed_at server-side before redirecting here. We don't need
 *   a browser session to "prove" the verification, so we deliberately skip
 *   exchangeCodeForSession entirely. Just strip the URL, set a flag for
 *   the post-login flash, and render the green check. The browser stays
 *   signed out — user is expected to return to the iOS app.
 *
 * - **Native (Capacitor)**: Tapping the email link opens the app via
 *   Universal Link (AASA whitelists /auth/callback). Here we DO want to
 *   exchange the code so the user is signed in immediately, then route to
 *   /circles where the onboarding gate continues the funnel and the
 *   "Email verified" flash fires once.
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("verifying");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        // On web, the early inline script in index.html may have stripped
        // the PKCE ?code=... off the URL (so supabase-js wouldn't auto-
        // exchange it). Recover the originals from sessionStorage for
        // error reporting only.
        let originalSearch = window.location.search;
        let originalHash = window.location.hash;
        try {
          const stash = sessionStorage.getItem("familial:pendingVerifyParams");
          if (stash) {
            const parsed = JSON.parse(stash);
            if (parsed?.search) originalSearch = parsed.search;
            if (parsed?.hash) originalHash = parsed.hash;
            sessionStorage.removeItem("familial:pendingVerifyParams");
          }
        } catch { /* non-fatal */ }

        const searchParams = new URLSearchParams(originalSearch);
        const hashParams = new URLSearchParams(originalHash.replace(/^#/, ""));
        const hashError =
          hashParams.get("error_description") ||
          searchParams.get("error_description");

        if (hashError) {
          throw new Error(hashError.replace(/\+/g, " "));
        }


        if (isNative) {
          // Inside the app — we want a real session so the user lands in
          // onboarding immediately.
          const code = searchParams.get("code");
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");

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
            const { data } = await supabase.auth.getSession();
            if (!data.session) {
              throw new Error("This verification link is incomplete or expired.");
            }
          }

          try {
            localStorage.setItem(VERIFIED_FLAG, "1");
          } catch {
            // non-fatal
          }

          if (cancelled) return;
          // Hand off to the authenticated app — AppLayout will show the
          // green-check flash and route through onboarding gates.
          navigate("/circles", { replace: true });
          return;
        }

        // ----- Web path -----
        // Do NOT exchange the code. Supabase already confirmed the email
        // server-side. Creating a session here would auto-sign-in the
        // browser, which is exactly what we're trying to avoid.
        try {
          localStorage.setItem(VERIFIED_FLAG, "1");
        } catch {
          // non-fatal
        }

        // Strip any tokens from the URL so they don't sit in history.
        window.history.replaceState({}, "", "/auth/callback");

        // Belt-and-suspenders: if supabase-js managed to slip a session into
        // localStorage before this page ran (shouldn't happen now that the
        // index.html interceptor reroutes hash tokens), drop it.
        try {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            await supabase.auth.signOut();
          }
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
  }, [navigate, isNative]);




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
            You may proceed back to the app.
          </p>
        </div>
      )}
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
