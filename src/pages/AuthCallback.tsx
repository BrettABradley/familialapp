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
 * Supabase email verification redirects here with either:
 *   - `?code=...` (PKCE / new flow)        → exchangeCodeForSession
 *   - `#access_token=...&refresh_token=..` (implicit / legacy) → setSession
 *
 * On success: show "Verified ✓", then route into the app.
 * On failure: show "This link expired" with a Resend hint back to /auth.
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
          // No token at all — likely the user opened /auth/callback directly.
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            throw new Error("This verification link is incomplete or expired.");
          }
        }

        // Strip tokens from the URL so they don't sit in history.
        window.history.replaceState({}, "", "/auth/callback");

        if (cancelled) return;
        setStatus("success");

        // Brief celebratory pause, then route.
        setTimeout(() => {
          const saved = localStorage.getItem("postAuthRedirect");
          const next = url.searchParams.get("next");
          const target = next || saved || "/circles";
          if (saved) localStorage.removeItem("postAuthRedirect");
          navigate(target.startsWith("/") ? target : "/circles", { replace: true });
        }, 1400);
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
        <div className="flex flex-col items-center gap-4 animate-in zoom-in-50 fade-in duration-500">
          <div className="rounded-full bg-emerald-50 dark:bg-emerald-950/30 p-4">
            <CheckCircle2 className="h-16 w-16 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />
          </div>
          <h1 className="font-serif text-3xl text-foreground">Verified</h1>
          <p className="text-sm text-muted-foreground">Welcome to Familial. Signing you in…</p>
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
