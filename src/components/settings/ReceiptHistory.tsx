import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Receipt, RefreshCw, Loader2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReceiptItem {
  id: string;
  date: string;
  description: string;
  amount: string;
  type: string;
  receipt_url: string | null;
}

const ReceiptHistory = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const fetchReceipts = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("receipt-history");
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setReceipts(data?.receipts ?? []);
    } catch (err: any) {
      setError(err.message || "Failed to load receipts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, [user]);

  const handleGenerateReceipt = async (receipt: ReceiptItem) => {
    setGeneratingId(receipt.id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-receipt", {
        body: { session_id: receipt.id },
      });

      if (error) throw error;

      // data is a Blob when Content-Type is application/pdf
      const blob = data instanceof Blob ? data : new Blob([data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Familial-Receipt-${new Date(receipt.date).toLocaleDateString("en-US").replace(/\//g, "-")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Generate receipt error:", err);
      toast({
        title: "Error",
        description: "Could not generate receipt. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGeneratingId(null);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  if (loading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-7 w-40" /></CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="font-serif text-2xl flex items-center gap-3">
            <Receipt className="h-5 w-5" />
            Receipt History
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={fetchReceipts} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="text-sm text-destructive mb-4">{error}</p>
        )}
        {receipts.length === 0 && !error ? (
          <p className="text-sm text-muted-foreground">No receipts found.</p>
        ) : (
          <div className="divide-y divide-border">
            {receipts.map((receipt) => (
              <div key={receipt.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{receipt.description}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(receipt.date)}</p>
                </div>
                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                  <span className="text-sm font-semibold text-foreground">{receipt.amount}</span>
                  {receipt.receipt_url ? (
                    <a
                      href={receipt.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Download receipt"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  ) : receipt.type === "checkout" ? (
                    <button
                      onClick={() => handleGenerateReceipt(receipt)}
                      disabled={generatingId === receipt.id}
                      className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                      aria-label="Download receipt"
                    >
                      {generatingId === receipt.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReceiptHistory;
