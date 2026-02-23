import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Receipt, RefreshCw, Loader2 } from "lucide-react";

interface ReceiptItem {
  id: string;
  date: string;
  description: string;
  amount: string;
  type: string;
}

const ReceiptHistory = () => {
  const { user } = useAuth();
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
                <span className="text-sm font-semibold text-foreground ml-4 flex-shrink-0">{receipt.amount}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReceiptHistory;
