import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import SEO from "@/components/shared/SEO";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-unsubscribe`;

type Status = "loading" | "valid" | "already" | "invalid" | "success" | "error";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const email = params.get("email") || "";
  const token = params.get("token") || "";

  const [status, setStatus] = useState<Status>("loading");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const validate = async () => {
      if (!email || !token) {
        setStatus("invalid");
        return;
      }
      try {
        const res = await fetch(
          `${FN_URL}?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`,
        );
        const data = await res.json();
        if (!res.ok || !data.valid) {
          setStatus("invalid");
          setErrorMsg(data.error || "This unsubscribe link is invalid or expired.");
          return;
        }
        setStatus(data.alreadyUnsubscribed ? "already" : "valid");
      } catch {
        setStatus("invalid");
        setErrorMsg("Couldn't reach the server. Please try again.");
      }
    };
    validate();
  }, [email, token]);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error || "Failed to unsubscribe.");
      } else {
        setStatus("success");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SEO title="Unsubscribe — Familial" description="Manage your Familial email preferences." />
      <main className="min-h-[100dvh] flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-md text-center space-y-6">
          <h1 className="font-serif text-3xl text-foreground">Email Preferences</h1>

          {status === "loading" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Verifying link…</p>
            </div>
          )}

          {status === "valid" && (
            <div className="space-y-5">
              <p className="text-foreground">
                Unsubscribe <span className="font-medium">{email}</span> from Familial invite emails?
              </p>
              <p className="text-xs text-muted-foreground">
                You'll still receive essential account emails (security codes, password resets, receipts).
              </p>
              <Button onClick={handleConfirm} disabled={submitting} className="w-full">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Unsubscribe"}
              </Button>
            </div>
          )}

          {status === "already" && (
            <div className="space-y-3 py-4">
              <CheckCircle2 className="w-10 h-10 mx-auto text-foreground" />
              <p className="text-foreground">You're already unsubscribed.</p>
              <p className="text-sm text-muted-foreground">{email}</p>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-3 py-4">
              <CheckCircle2 className="w-10 h-10 mx-auto text-foreground" />
              <p className="text-foreground">You've been unsubscribed.</p>
              <p className="text-sm text-muted-foreground">
                We won't send any more invite emails to {email}.
              </p>
            </div>
          )}

          {(status === "invalid" || status === "error") && (
            <div className="space-y-3 py-4">
              <XCircle className="w-10 h-10 mx-auto text-muted-foreground" />
              <p className="text-foreground">
                {status === "invalid" ? "Invalid link" : "Something went wrong"}
              </p>
              <p className="text-sm text-muted-foreground">
                {errorMsg || "Please contact support@familialmedia.com if you need help."}
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
