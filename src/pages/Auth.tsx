import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import logo from "@/assets/logo.png";
import { isIOSNative, purchaseSubscription, APPLE_PRODUCTS } from "@/lib/iapPurchase";
import { Eye, EyeOff, Mail, CheckCircle2 } from "lucide-react";
import { PullToRefreshWrapper } from "@/components/shared/PullToRefreshWrapper";

const PENDING_VERIFY_EMAIL_KEY = "pendingVerificationEmail";
const PENDING_VERIFY_PWD_KEY = "pendingVerificationPwd";
const RESEND_VERIFY_KEY = "lastVerificationResendAt";
const RESEND_VERIFY_COOLDOWN = 60;

const RESET_COOLDOWN_SECONDS = 60;
const RESET_COOLDOWN_KEY = "lastPasswordResetAt";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

const PLAN_PRICES: Record<string, { priceId: string; mode: "subscription" }> = {
  family: { priceId: "price_1T3N5bCiWDzualH5Cf7G7VsM", mode: "subscription" },
  extended: { priceId: "price_1T3N5nCiWDzualH5SBHxbHqo", mode: "subscription" },
};

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; age?: string }>({});
  const [verificationSentTo, setVerificationSentTo] = useState<string | null>(() =>
    typeof window !== "undefined" ? sessionStorage.getItem(PENDING_VERIFY_EMAIL_KEY) : null
  );
  const [confirmed, setConfirmed] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const checkoutTriggered = useRef(false);
  // Stashed signup password so we can silently poll signInWithPassword
  // until Supabase flips email_confirmed_at — auto-advances the app off
  // the "Check your email" screen as soon as the user clicks the link.
  // Persisted to sessionStorage so polling survives an app relaunch
  // between signup and the user tapping the verification link.
  const pendingPasswordRef = useRef<string | null>(
    typeof window !== "undefined" ? sessionStorage.getItem(PENDING_VERIFY_PWD_KEY) : null
  );
  // Bumped on focus/visibility/manual pull to re-trigger the poll effect.
  const [pollNonce, setPollNonce] = useState(0);
  




  // Rate limiting state
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);

  // Duplicate-account inline message (signup)
  const [duplicateAccount, setDuplicateAccount] = useState(false);

  // Password reset cooldown
  const [resetCooldown, setResetCooldown] = useState(0);

  const { signIn, signUp, user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const planParam = searchParams.get("plan");

  // Honor ?mode=signup|login and ?email=... from invite links so a fresh
  // recipient lands on the correct form with their email prefilled.
  useEffect(() => {
    const mode = searchParams.get("mode");
    if (mode === "signup") setIsLogin(false);
    else if (mode === "login") setIsLogin(true);
    const prefillEmail = searchParams.get("email");
    if (prefillEmail) {
      try {
        const decoded = decodeURIComponent(prefillEmail);
        if (emailSchema.safeParse(decoded).success) setEmail(decoded);
      } catch { /* ignore malformed */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const navigateIntoApp = useCallback(() => {
    // Check for a saved return URL (e.g. from checkout redirect through auth)
    const savedRedirect = localStorage.getItem("postAuthRedirect");
    if (savedRedirect && !savedRedirect.startsWith("/settings") && !savedRedirect.startsWith("/profile")) {
      localStorage.removeItem("postAuthRedirect");
      navigate(savedRedirect, { replace: true });
    } else {
      localStorage.removeItem("postAuthRedirect");
      navigate("/circles", { replace: true });
    }
  }, [navigate]);

  // Lockout countdown timer
  useEffect(() => {
    if (!lockoutUntil) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
      setLockoutRemaining(remaining);
      if (remaining <= 0) {
        setLockoutUntil(null);
        setFailedAttempts(0);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const isLockedOut = lockoutUntil !== null && Date.now() < lockoutUntil;

  // Initialize reset cooldown from sessionStorage
  useEffect(() => {
    const last = Number(sessionStorage.getItem(RESET_COOLDOWN_KEY) || 0);
    if (last) {
      const remaining = Math.ceil((last + RESET_COOLDOWN_SECONDS * 1000 - Date.now()) / 1000);
      if (remaining > 0) setResetCooldown(remaining);
    }
  }, []);

  // Reset cooldown countdown
  useEffect(() => {
    if (resetCooldown <= 0) return;
    const t = setInterval(() => setResetCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resetCooldown]);

  // Resend cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  // Initialize resend cooldown from sessionStorage
  useEffect(() => {
    const last = Number(sessionStorage.getItem(RESEND_VERIFY_KEY) || 0);
    if (last) {
      const remaining = Math.ceil((last + RESEND_VERIFY_COOLDOWN * 1000 - Date.now()) / 1000);
      if (remaining > 0) setResendCooldown(remaining);
    }
  }, []);

  // After login, if there's a plan param, trigger checkout
  useEffect(() => {
    if (loading || !user) return;

    // Email-verification success: show green check. A separate effect owns
    // the timeout/navigation so this effect can't clear it when confirmed flips.
    const pendingEmail = sessionStorage.getItem(PENDING_VERIFY_EMAIL_KEY);
    if (pendingEmail && pendingEmail === user.email && !confirmed) {
      setConfirmed(true);
      return;
    }
    if (confirmed) return; // wait for timeout


    if (!loading && user && planParam && PLAN_PRICES[planParam] && !checkoutTriggered.current) {
      checkoutTriggered.current = true;

      // iOS native: must use Apple IAP (App Store guideline 3.1.1)
      if (isIOSNative()) {
        const appleProductId = APPLE_PRODUCTS[planParam as keyof typeof APPLE_PRODUCTS];
        if (appleProductId) {
          (async () => {
            try {
              const success = await purchaseSubscription(appleProductId);
              if (success) {
                toast({ title: "Plan activated!", description: `You're now on the ${planParam.charAt(0).toUpperCase() + planParam.slice(1)} plan.` });
              }
            } catch (err: any) {
              toast({ title: "Purchase failed", description: err?.message || "Could not complete purchase.", variant: "destructive" });
            } finally {
              navigate("/circles");
            }
          })();
        } else {
          navigate("/circles");
        }
        return;
      }

      const { priceId, mode } = PLAN_PRICES[planParam];
      supabase.functions.invoke("create-checkout", {
        body: { priceId, mode },
      }).then(({ data, error }) => {
        if (error || !data?.url) {
          toast({ title: "Checkout error", description: "Could not start checkout. Please try again from your circles page.", variant: "destructive" });
          navigate("/circles");
        } else {
          window.location.href = data.url;
        }
      });
      return; // Don't navigate to /circles yet
    }

    if (!loading && user && !planParam) {
      navigateIntoApp();
    }
  }, [user, loading, navigate, planParam, toast, confirmed, navigateIntoApp]);

  useEffect(() => {
    if (!confirmed || !user) return;

    const t = setTimeout(() => {
      sessionStorage.removeItem(PENDING_VERIFY_EMAIL_KEY);
      sessionStorage.removeItem(PENDING_VERIFY_PWD_KEY);
      pendingPasswordRef.current = null;
      setVerificationSentTo(null);
      navigateIntoApp();
    }, 1500);

    return () => clearTimeout(t);
  }, [confirmed, user, navigateIntoApp]);

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};
    
    try {
      emailSchema.parse(email);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.email = e.errors[0].message;
      }
    }
    
    try {
      passwordSchema.parse(password);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.password = e.errors[0].message;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(email);
    } catch {
      setErrors({ email: "Please enter a valid email address" });
      return;
    }
    if (resetCooldown > 0) return;
    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setIsLoading(false);
    // Start cooldown regardless (prevents burning through server-side limit)
    sessionStorage.setItem(RESET_COOLDOWN_KEY, String(Date.now()));
    setResetCooldown(RESET_COOLDOWN_SECONDS);

    if (error) {
      const msg = (error.message || "").toLowerCase();
      const isRateLimit =
        msg.includes("rate limit") ||
        msg.includes("over_email_send_rate_limit") ||
        (error as any).status === 429;
      if (isRateLimit) {
        toast({
          title: "Please wait a moment",
          description:
            "Too many reset requests. Check your inbox (and spam folder) for an earlier link, or try again in a minute.",
          variant: "destructive",
        });
        setIsForgotPassword(false);
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    } else {
      toast({ title: "Check your email", description: "We've sent you a password reset link. Check spam if you don't see it." });
      setIsForgotPassword(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          const newAttempts = failedAttempts + 1;
          setFailedAttempts(newAttempts);
          if (newAttempts >= 5) {
            setLockoutUntil(Date.now() + 5 * 60 * 1000);
            toast({ title: "Too many attempts", description: "Account locked for 5 minutes.", variant: "destructive" });
          } else if (error.message.includes("Invalid login credentials")) {
            toast({
              title: "Login failed",
              description: `Invalid email or password.${newAttempts >= 3 ? ` ${5 - newAttempts} attempts remaining.` : ""}`,
              variant: "destructive",
            });
          } else {
            toast({ title: "Login failed", description: error.message, variant: "destructive" });
          }
        } else {
          setFailedAttempts(0);
          setLockoutUntil(null);
          toast({ title: "Welcome back!", description: "You've successfully signed in." });
        }

      } else {
        // Age confirmation (COPPA 13+). TOS is collected post email-verification
        // by TermsAcceptanceGate, before the onboarding flow.
        if (!ageConfirmed) {
          setErrors({ age: "Please confirm you are at least 13 years old." });
          setIsLoading(false);
          return;
        }

        const { error } = await signUp(email, password, displayName);
        if (error) {
          const dup =
            error.message.includes("User already registered") ||
            error.message.toLowerCase().includes("already") ||
            error.message.toLowerCase().includes("identities");
          if (dup) {
            setDuplicateAccount(true);
          } else {
            toast({
              title: "Sign up failed",
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          // Show the dedicated "check your email" verification panel.
          sessionStorage.setItem(PENDING_VERIFY_EMAIL_KEY, email);
          setVerificationSentTo(email);
          // Keep the password in memory + sessionStorage so the polling
          // effect can silently re-attempt sign-in once the email is
          // confirmed, even if the user backgrounds/relaunches the app.
          pendingPasswordRef.current = password;
          try { sessionStorage.setItem(PENDING_VERIFY_PWD_KEY, password); } catch { /* non-fatal */ }
          setPassword("");
          // Start a resend cooldown so they can't immediately re-trigger Supabase rate limits
          sessionStorage.setItem(RESEND_VERIFY_KEY, String(Date.now()));
          setResendCooldown(RESEND_VERIFY_COOLDOWN);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!verificationSentTo || resendCooldown > 0 || isResending) return;
    setIsResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: verificationSentTo,
      options: { emailRedirectTo: window.location.origin },
    });
    setIsResending(false);
    sessionStorage.setItem(RESEND_VERIFY_KEY, String(Date.now()));
    setResendCooldown(RESEND_VERIFY_COOLDOWN);
    if (error) {
      toast({ title: "Could not resend", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Email resent", description: `New verification link sent to ${verificationSentTo}.` });
    }
  };

  const handleUseDifferentEmail = () => {
    sessionStorage.removeItem(PENDING_VERIFY_EMAIL_KEY);
    sessionStorage.removeItem(PENDING_VERIFY_PWD_KEY);
    sessionStorage.removeItem("pendingTermsAcceptance");
    pendingPasswordRef.current = null;
    setVerificationSentTo(null);
    setIsLogin(false);
    setEmail("");
  };

  // Poll for email verification while sitting on the "Check your email"
  // panel. As soon as Supabase flips email_confirmed_at server-side
  // (user clicked the link in their browser), signInWithPassword will
  // succeed — the existing user-effect then shows the green check and
  // routes into the app. No manual action required.
  useEffect(() => {
    if (!verificationSentTo || confirmed || user) return;
    const pwd = pendingPasswordRef.current;
    if (!pwd) return; // No stashed password (e.g. after page reload) — can't poll silently.
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try {
        await supabase.auth.signInWithPassword({
          email: verificationSentTo,
          password: pwd,
        });
        // On success the onAuthStateChange listener in useAuth fires and
        // the user-effect above handles the rest. Errors (esp. "Email not
        // confirmed") are expected and intentionally ignored.
      } catch {
        // swallow
      }
    };
    const interval = setInterval(tick, 3000);
    // Fire one immediate attempt too — covers the case where the user
    // returns to the app right after clicking the link.
    tick();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [verificationSentTo, confirmed, user, pollNonce]);

  // Restart the poll whenever the app regains focus / visibility — covers
  // the case where iOS pauses JS timers while the app is backgrounded
  // (e.g. user switches to Mail, taps the link, then comes back).
  useEffect(() => {
    if (!verificationSentTo || confirmed || user) return;
    const bump = () => setPollNonce((n) => n + 1);
    window.addEventListener("focus", bump);
    document.addEventListener("visibilitychange", bump);
    return () => {
      window.removeEventListener("focus", bump);
      document.removeEventListener("visibilitychange", bump);
    };
  }, [verificationSentTo, confirmed, user]);

  // Manual pull-to-refresh check — same logic as the poll but with a
  // user-visible result toast when the link still hasn't been clicked.
  const handleVerifyPullRefresh = async () => {
    if (!verificationSentTo) return;
    const pwd = pendingPasswordRef.current;
    if (pwd) {
      const { error } = await supabase.auth.signInWithPassword({
        email: verificationSentTo,
        password: pwd,
      });
      if (!error) return; // success — useEffect handles the green check
    } else {
      // No stashed password (app relaunched after signup): refresh any
      // existing session in case Supabase already flipped the flag.
      await supabase.auth.refreshSession();
    }
    toast({
      title: "Not verified yet",
      description: "Tap the link in your email, then pull down again.",
    });
  };

  // On the "Email confirmed!" screen, let the user pull down to force the
  // hand-off into the app in case the auto-navigate timer got interrupted
  // (backgrounded tab, slow device, etc.). Also re-checks the session so
  // a confirmation that happened on another device gets picked up.
  const handleConfirmedPullRefresh = async () => {
    await supabase.auth.refreshSession();
    navigateIntoApp();
  };




  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center px-4">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Sign-in fits on one screen — kill the page scroll. Sign-up + forgot
  // password have more fields and the keyboard needs to push content up,
  // so they keep the generous bottom padding.
  const needsScrollRoom = !isLogin || isForgotPassword;
  return (
    <div
      className={`min-h-[100dvh] bg-background flex flex-col items-center justify-start pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] sm:justify-center sm:pt-0 px-4 ${needsScrollRoom ? "overflow-y-auto" : "overflow-hidden"}`}
      style={{
        paddingBottom: needsScrollRoom
          ? "calc(env(safe-area-inset-bottom, 0px) + var(--keyboard-height, 0px) + 10rem)"
          : "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)",
      }}
    >
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={logo} alt="Familial" className="h-24 w-auto" />
          </div>
          <CardTitle className="font-serif text-2xl">
            {confirmed
              ? "Email confirmed!"
              : verificationSentTo
              ? "Check your email"
              : isForgotPassword
              ? "Reset Password"
              : isLogin
              ? "Welcome"
              : "Join Familial"}
          </CardTitle>
          <CardDescription>
            {confirmed
              ? "Welcome to Familial"
              : verificationSentTo
              ? "We sent a verification link to finish setting up your account"
              : isForgotPassword
              ? "Enter your email and we'll send you a reset link"
              : isLogin
              ? "Sign in or sign up to connect with your family"
              : "Create an account to start your family circle"}
          </CardDescription>
          {planParam && PLAN_PRICES[planParam] && !confirmed && !verificationSentTo && (
            <p className="text-sm text-primary mt-2">
              {isLogin ? "Sign in" : "Sign up"} to continue with the {planParam.charAt(0).toUpperCase() + planParam.slice(1)} plan purchase
            </p>
          )}
        </CardHeader>
        <CardContent>
          {confirmed ? (
            <PullToRefreshWrapper onRefresh={handleConfirmedPullRefresh}>
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <div className="rounded-full bg-green-500/10 p-4 animate-in zoom-in-50 duration-500">
                  <CheckCircle2 className="h-16 w-16 text-green-600" strokeWidth={2.5} />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Taking you in...
                </p>
                <p className="text-xs text-muted-foreground/70 text-center">
                  Pull down to refresh if you're not redirected.
                </p>
              </div>
            </PullToRefreshWrapper>
          ) : verificationSentTo ? (
            <PullToRefreshWrapper onRefresh={handleVerifyPullRefresh}>
              <div className="space-y-5 py-2">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="rounded-full bg-primary/10 p-4">
                    <Mail className="h-10 w-10 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    We sent a verification link to
                  </p>
                  <p className="font-medium break-all">{verificationSentTo}</p>
                  <p className="text-sm text-muted-foreground">
                    Open the email on this device and tap the link. Once confirmed,
                    you'll be brought right in.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pull down to check manually.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleResendVerification}
                  disabled={resendCooldown > 0 || isResending}
                >
                  {isResending
                    ? "Resending..."
                    : resendCooldown > 0
                    ? `Resend available in ${resendCooldown}s`
                    : "Resend verification email"}
                </Button>
                <button
                  type="button"
                  onClick={handleUseDifferentEmail}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Use a different email
                </button>
                <p className="text-xs text-muted-foreground text-center">
                  Didn't get it? Check your spam folder.
                </p>
              </div>
            </PullToRefreshWrapper>
          ) : isForgotPassword ? (
            <>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    style={{ scrollMarginBottom: "calc(var(--keyboard-height, 0px) + 8rem)" }}
                    className={errors.email ? "border-destructive" : ""}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={isLoading || resetCooldown > 0}>
                  {isLoading
                    ? "Sending..."
                    : resetCooldown > 0
                    ? `Resend available in ${resetCooldown}s`
                    : "Send Reset Link"}
                </Button>
              </form>
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => { setIsForgotPassword(false); setErrors({}); }}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Back to Sign In
                </button>
              </div>
            </>
          ) : (
            <>


              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <>
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      id="displayName"
                      type="text"
                      placeholder="Your name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      style={{ scrollMarginBottom: "calc(var(--keyboard-height, 0px) + 8rem)" }}
                    />
                  </div>
                  <div className="flex items-start gap-2">
                    <input
                      id="age-confirm"
                      type="checkbox"
                      checked={ageConfirmed}
                      onChange={(e) => {
                        setAgeConfirmed(e.target.checked);
                        setErrors((prev) => ({ ...prev, age: undefined }));
                      }}
                      className="mt-1 h-4 w-4 accent-primary"
                    />
                    <Label htmlFor="age-confirm" className="text-sm font-normal leading-snug cursor-pointer">
                      I confirm I am at least 13 years old.
                    </Label>
                  </div>
                  {errors.age && (
                    <p className="text-sm text-destructive">{errors.age}</p>
                  )}
                  </>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrors((prev) => ({ ...prev, email: undefined }));
                      setDuplicateAccount(false);
                    }}
                    style={{ scrollMarginBottom: "calc(var(--keyboard-height, 0px) + 8rem)" }}
                    className={errors.email ? "border-destructive" : ""}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setErrors((prev) => ({ ...prev, password: undefined }));
                      }}
                      onFocus={(e) => {
                        // iOS keyboard can cover the password field — scroll the
                        // field into the center of the visible area so both the
                        // field and the Create Account button stay reachable.
                        const el = e.currentTarget;
                        const scroll = () => {
                          try {
                            el.scrollIntoView({ behavior: "smooth", block: "center" });
                          } catch {}
                        };
                        // Two passes: once right away, again after the iOS
                        // keyboard finishes animating and --keyboard-height is set.
                        setTimeout(scroll, 50);
                        setTimeout(scroll, 380);
                      }}
                      style={{ scrollMarginTop: "10vh", scrollMarginBottom: "calc(var(--keyboard-height, 0px) + 8rem)" }}
                      className={`pr-11 ${errors.password ? "border-destructive" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-0 top-0 h-full w-11 flex items-center justify-center text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
                </div>
                {!isLogin && duplicateAccount && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    Looks like you already have an account —{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setIsLogin(true);
                        setDuplicateAccount(false);
                        setErrors({});
                      }}
                      className="underline font-medium hover:opacity-80"
                    >
                      login
                    </button>
                  </div>
                )}
                {isLogin && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => { setIsForgotPassword(true); setErrors({}); }}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
                {isLockedOut && (
                  <p className="text-sm text-destructive text-center">
                    Too many failed attempts. Try again in {Math.floor(lockoutRemaining / 60)}:{String(lockoutRemaining % 60).padStart(2, "0")}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={isLoading || isLockedOut}>
                  {isLockedOut
                    ? "Locked"
                    : isLoading
                    ? "Loading..."
                    : isLogin
                    ? "Sign In"
                    : "Create Account"}
                </Button>
              </form>
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setErrors({});
                    setAgeConfirmed(false);
                    
                    setDuplicateAccount(false);
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isLogin
                    ? "Don't have an account? Sign up"
                    : "Already have an account? Sign in"}
                </button>
              </div>
            </>
          )}


        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
