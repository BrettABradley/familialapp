import { useState, useEffect, useRef } from "react";
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
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const checkoutTriggered = useRef(false);

  // Rate limiting state
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  const { signIn, signUp, user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const planParam = searchParams.get("plan");

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

  // After login, if there's a plan param, trigger checkout
  useEffect(() => {
    if (!loading && user && planParam && PLAN_PRICES[planParam] && !checkoutTriggered.current) {
      checkoutTriggered.current = true;
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
      // Check for a saved return URL (e.g. from checkout redirect through auth)
      const savedRedirect = localStorage.getItem("postAuthRedirect");
      if (savedRedirect && !savedRedirect.startsWith("/settings") && !savedRedirect.startsWith("/profile")) {
        localStorage.removeItem("postAuthRedirect");
        navigate(savedRedirect);
      } else {
        localStorage.removeItem("postAuthRedirect");
        navigate("/circles");
      }
    }
  }, [user, loading, navigate, planParam, toast]);

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
    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setIsLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Check your email", description: "We've sent you a password reset link." });
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
        const { error } = await signUp(email, password, displayName);
        if (error) {
          if (error.message.includes("User already registered")) {
            toast({
              title: "Account exists",
              description: "This email is already registered. Please sign in instead.",
              variant: "destructive",
            });
            setIsLogin(true);
          } else {
            toast({
              title: "Sign up failed",
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Account created!",
            description: "Welcome to Familial. Let's set up your first circle.",
          });
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center px-4">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-start pt-[calc(env(safe-area-inset-top,0px)+3rem)] sm:justify-center sm:pt-0 px-4 overflow-y-auto pb-[env(safe-area-inset-bottom,0px)]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={logo} alt="Familial" className="h-24 w-auto" />
          </div>
          <CardTitle className="font-serif text-2xl">
            {isForgotPassword ? "Reset Password" : isLogin ? "Welcome" : "Join Familial"}
          </CardTitle>
          <CardDescription>
            {isForgotPassword
              ? "Enter your email and we'll send you a reset link"
              : isLogin
              ? "Sign in or sign up to connect with your family"
              : "Create an account to start your family circle"}
          </CardDescription>
          {planParam && PLAN_PRICES[planParam] && (
            <p className="text-sm text-primary mt-2">
              {isLogin ? "Sign in" : "Sign up"} to continue with the {planParam.charAt(0).toUpperCase() + planParam.slice(1)} plan purchase
            </p>
          )}
        </CardHeader>
        <CardContent>
          {isForgotPassword ? (
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
                    className={errors.email ? "border-destructive" : ""}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Sending..." : "Send Reset Link"}
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
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      id="displayName"
                      type="text"
                      placeholder="Your name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </div>
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
                    }}
                    className={errors.email ? "border-destructive" : ""}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    className={errors.password ? "border-destructive" : ""}
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
                </div>
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
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading
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
