import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldAlert, ShieldCheck, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const FOUNDER_EMAIL = "brettbradley007@gmail.com";

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("reports");
  const [reportStatus, setReportStatus] = useState("pending");
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isAuthorized = user?.email === FOUNDER_EMAIL;

  const fetchData = async (tab: string, status?: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ tab });
      if (status) params.set("status", status);
      const { data: result, error } = await supabase.functions.invoke("admin-dashboard", {
        body: null,
        headers: {},
      });
      // Use query params approach
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-dashboard?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      const json = await response.json();
      setData(json.data || []);
    } catch {
      toast({ title: "Failed to load data", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      fetchData(activeTab, activeTab === "reports" ? reportStatus : undefined);
    }
  }, [isAuthorized, activeTab, reportStatus]);

  const handleModerate = async (reportId: string, action: "ban_user" | "dismiss") => {
    setActionLoading(reportId);
    try {
      const adminSecret = prompt("Enter admin secret:");
      if (!adminSecret) return;
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/moderate-reported-user?report_id=${reportId}&action=${action}&secret=${adminSecret}`,
        { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );
      if (response.ok) {
        toast({ title: action === "ban_user" ? "User banned" : "Report dismissed" });
        fetchData(activeTab, reportStatus);
      } else {
        toast({ title: "Action failed", variant: "destructive" });
      }
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-sm">
          <CardContent className="pt-6 text-center">
            <ShieldAlert className="w-12 h-12 mx-auto text-destructive mb-4" />
            <h2 className="text-lg font-semibold">Access Denied</h2>
            <p className="text-sm text-muted-foreground mt-2">You don't have permission to view this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck className="w-6 h-6 text-primary" />
        <h1 className="font-serif text-2xl font-bold">Admin Dashboard</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="banned">Banned Users</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="space-y-4">
          <div className="flex gap-2 mt-4">
            {["pending", "resolved", "dismissed"].map((s) => (
              <Button
                key={s}
                size="sm"
                variant={reportStatus === s ? "default" : "outline"}
                onClick={() => setReportStatus(s)}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : data.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No {reportStatus} reports.</p>
          ) : (
            data.map((report: any) => (
              <Card key={report.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      {report.reason}
                    </CardTitle>
                    <Badge variant="outline">{report.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground">
                  {report.details && <p>{report.details}</p>}
                  <p>Post: {report.post_id || "—"} | Comment: {report.comment_id || "—"}</p>
                  <p>Reported user: {report.reported_user_id || "—"}</p>
                  <p>Reported: {new Date(report.created_at).toLocaleString()}</p>
                  {report.status === "pending" && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={actionLoading === report.id}
                        onClick={() => handleModerate(report.id, "ban_user")}
                      >
                        {actionLoading === report.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                        Ban User
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionLoading === report.id}
                        onClick={() => handleModerate(report.id, "dismiss")}
                      >
                        Dismiss
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="banned" className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : data.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No banned users.</p>
          ) : (
            data.map((ban: any) => (
              <Card key={ban.id}>
                <CardContent className="pt-4 text-sm space-y-1">
                  <p className="font-medium">{ban.email}</p>
                  {ban.reason && <p className="text-muted-foreground text-xs">{ban.reason}</p>}
                  <p className="text-xs text-muted-foreground">
                    Banned: {new Date(ban.banned_at).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : data.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No audit entries yet.</p>
          ) : (
            data.map((entry: any) => (
              <Card key={entry.id}>
                <CardContent className="pt-4 text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{entry.action_type}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">By: {entry.admin_email}</p>
                  {entry.details && (
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                      {JSON.stringify(entry.details, null, 2)}
                    </pre>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {new Date(entry.created_at).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Admin;
