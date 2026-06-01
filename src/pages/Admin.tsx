import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, ShieldAlert, ShieldCheck, FileText, AlertTriangle, Clock, Users, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { AdminsUsersTab } from "@/components/admin/AdminsUsersTab";

type ModAction =
  | "dismiss" | "restore" | "delete_content"
  | "warn" | "suspend_7d" | "ban" | "mark_spam_reporter";

const ACTION_LABELS: Record<ModAction, string> = {
  dismiss: "Dismiss",
  restore: "Restore",
  delete_content: "Delete content",
  warn: "Warn user",
  suspend_7d: "Suspend 7 days",
  ban: "Ban user",
  mark_spam_reporter: "Flag reporter as spammer",
};

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState("reports");
  const [reportStatus, setReportStatus] = useState("pending");
  const [appealStatus, setAppealStatus] = useState("pending");
  const [data, setData] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [subscriptions, setSubscriptions] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionTarget, setActionTarget] = useState<{ report: any; action: ModAction } | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Check platform admin status
  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase.from("platform_admins" as any).select("user_id").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const fetchData = useCallback(async (tab: string, status?: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ tab });
      if (status) params.set("status", status);
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-dashboard?${params}`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        },
      );
      const json = await res.json();
      if (tab === "metrics") setMetrics(json.data || null);
      else if (tab === "subscriptions") setSubscriptions(json.data || null);
      else setData(json.data || []);
    } catch {
      toast({ title: "Failed to load data", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!isAdmin) return;
    if (activeTab === "admins-users") return; // managed by its own component
    if (activeTab === "reports") fetchData("reports", reportStatus);
    else if (activeTab === "appeals") fetchData("appeals", appealStatus);
    else fetchData(activeTab);
  }, [isAdmin, activeTab, reportStatus, appealStatus, fetchData]);

  const submitAction = async () => {
    if (!actionTarget) return;
    setActionLoading(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/moderation-action`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            report_id: actionTarget.report.id,
            action: actionTarget.action,
            note: actionNote,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Action failed");
      toast({ title: ACTION_LABELS[actionTarget.action], description: (json.results || []).join(" · ") });
      setActionTarget(null);
      setActionNote("");
      fetchData("reports", reportStatus);
    } catch (e: any) {
      toast({ title: "Action failed", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const resolveAppeal = async (appeal: any, grant: boolean) => {
    const note = prompt(`${grant ? "Grant" : "Deny"} appeal — note (optional):`) ?? "";
    const updates: any = {
      status: grant ? "granted" : "denied",
      resolved_at: new Date().toISOString(),
      resolved_by: user?.id,
      reviewer_note: note,
    };
    const { error } = await supabase.from("user_appeals" as any).update(updates).eq("id", appeal.id);
    if (error) { toast({ title: "Failed", variant: "destructive" }); return; }
    if (grant && appeal.user_id) {
      await supabase.functions.invoke("admin-manage-users", {
        body: { action: "restore_user", user_id: appeal.user_id },
      });
      toast({ title: "Appeal granted", description: "Profile re-activated." });
    } else {
      toast({ title: grant ? "Appeal granted" : "Appeal denied" });
    }
    fetchData("appeals", appealStatus);
  };
  const unbanEmail = async (b: any) => {
    if (!confirm(`Unban ${b.email}? They will be able to create an account again.`)) return;
    const { data: result, error } = await supabase.functions.invoke("admin-manage-users", {
      body: { action: "unban_email", banned_id: b.id, email: b.email },
    });
    if (error || (result as any)?.error) {
      toast({ title: "Unban failed", description: error?.message || (result as any)?.error, variant: "destructive" });
      return;
    }
    toast({ title: "Unbanned", description: b.email });
    fetchData("banned");
  };


  if (authLoading || isAdmin === null) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-sm">
          <CardContent className="pt-6 text-center">
            <ShieldAlert className="w-12 h-12 mx-auto text-destructive mb-4" />
            <h2 className="text-lg font-semibold">Access Denied</h2>
            <p className="text-sm text-muted-foreground mt-2">You don't have moderator permission.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 max-w-6xl mx-auto pb-32">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/circles")} aria-label="Back to Familial">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <ShieldCheck className="w-6 h-6 text-primary" />
        <h1 className="font-serif text-2xl font-bold">Moderation Console</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="reports">Queue</TabsTrigger>
          <TabsTrigger value="appeals">Appeals</TabsTrigger>
          <TabsTrigger value="banned">Banned</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="admins-users"><Users className="w-4 h-4 mr-1" />Admins & Users</TabsTrigger>
        </TabsList>

        {/* QUEUE */}
        <TabsContent value="reports" className="space-y-3">
          <div className="flex gap-2 mt-4">
            {["pending", "resolved", "dismissed"].map((s) => (
              <Button key={s} size="sm" variant={reportStatus === s ? "default" : "outline"} onClick={() => setReportStatus(s)}>
                {s[0].toUpperCase() + s.slice(1)}
              </Button>
            ))}
          </div>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : data.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No {reportStatus} reports.</p>
          ) : data.map((r: any) => (
            <Card key={r.id} className={r.overdue ? "border-destructive" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm">{r.reason}</CardTitle>
                    <Badge variant={r.severity === "high" ? "destructive" : "secondary"}>{r.severity}</Badge>
                    {r.overdue && (
                      <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" />SLA overdue</Badge>
                    )}
                    {!r.overdue && r.status === "pending" && (
                      <Badge variant="outline" className="gap-1">
                        <Clock className="w-3 h-3" />due {new Date(r.sla_due_at).toLocaleString()}
                      </Badge>
                    )}
                  </div>
                  <Badge variant="outline">{r.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {r.details && <p className="italic text-muted-foreground">"{r.details}"</p>}
                {(r.post_snippet || r.comment_snippet) && (
                  <div className="bg-muted p-3 rounded text-xs">
                    <p className="font-medium mb-1">Reported content:</p>
                    <p className="whitespace-pre-wrap">{r.post_snippet || r.comment_snippet}</p>
                    {r.post_media?.length > 0 && (
                      <p className="mt-1 text-muted-foreground">+ {r.post_media.length} media</p>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>
                    Reporter: <span className="text-foreground">{r.reporter_name || r.reporter_id?.slice(0, 8)}</span>
                    {r.reporter_is_spam && <Badge variant="destructive" className="ml-1">spam</Badge>}
                  </div>
                  <div>
                    Target: <span className="text-foreground">{r.target_name || r.reported_user_id?.slice(0, 8) || "—"}</span>
                    {r.target_status && r.target_status !== "active" && <Badge variant="destructive" className="ml-1">{r.target_status}</Badge>}
                  </div>
                  <div>Active strikes: <span className="text-foreground">{r.target_active_strikes}</span></div>
                  <div>Filed: {new Date(r.created_at).toLocaleString()}</div>
                </div>

                {r.status === "pending" && (
                  <div className="flex gap-2 flex-wrap pt-2">
                    {(["dismiss", "restore", "delete_content", "warn", "suspend_7d", "ban", "mark_spam_reporter"] as ModAction[]).map((a) => (
                      <Button
                        key={a}
                        size="sm"
                        variant={a === "ban" || a === "delete_content" ? "destructive" : a === "dismiss" || a === "restore" ? "outline" : "secondary"}
                        onClick={() => { setActionTarget({ report: r, action: a }); setActionNote(""); }}
                      >
                        {ACTION_LABELS[a]}
                      </Button>
                    ))}
                  </div>
                )}
                {r.resolution_note && (
                  <p className="text-xs text-muted-foreground pt-2 border-t">Resolution: {r.resolution_note}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* APPEALS */}
        <TabsContent value="appeals" className="space-y-3">
          <div className="flex gap-2 mt-4">
            {["pending", "granted", "denied"].map((s) => (
              <Button key={s} size="sm" variant={appealStatus === s ? "default" : "outline"} onClick={() => setAppealStatus(s)}>
                {s[0].toUpperCase() + s.slice(1)}
              </Button>
            ))}
          </div>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : data.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No {appealStatus} appeals.</p>
          ) : data.map((a: any) => (
            <Card key={a.id}>
              <CardContent className="pt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{a.email}</p>
                  <Badge variant="outline">{a.status}</Badge>
                </div>
                <p className="whitespace-pre-wrap text-muted-foreground">{a.message}</p>
                <p className="text-xs text-muted-foreground">Submitted {new Date(a.created_at).toLocaleString()}</p>
                {a.status === "pending" && (
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" onClick={() => resolveAppeal(a, true)}>Grant</Button>
                    <Button size="sm" variant="destructive" onClick={() => resolveAppeal(a, false)}>Deny</Button>
                  </div>
                )}
                {a.reviewer_note && <p className="text-xs italic">Note: {a.reviewer_note}</p>}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* BANNED */}
        <TabsContent value="banned" className="space-y-3">
          {isLoading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          : data.length === 0 ? <p className="text-muted-foreground text-sm py-8 text-center">No banned users.</p>
          : data.map((b: any) => (
            <Card key={b.id}><CardContent className="pt-4 text-sm space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="font-medium">{b.email}</p>
                {b.pending_appeal_id && (
                  <Badge variant="secondary" className="gap-1">
                    <AlertTriangle className="w-3 h-3" />Pending appeal
                  </Badge>
                )}
              </div>
              {b.reason && <p className="text-xs text-muted-foreground">{b.reason}</p>}
              <p className="text-xs text-muted-foreground">Banned: {new Date(b.banned_at).toLocaleString()}</p>
              <div className="flex gap-2 pt-1">
                {b.pending_appeal_id && (
                  <Button size="sm" variant="outline" onClick={() => { setAppealStatus("pending"); setActiveTab("appeals"); }}>
                    View appeal
                  </Button>
                )}
                <Button size="sm" variant="destructive" onClick={() => unbanEmail(b)}>
                  Unban
                </Button>
              </div>
            </CardContent></Card>
          ))}
        </TabsContent>


        {/* AUDIT */}
        <TabsContent value="audit" className="space-y-3">
          {isLoading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          : data.length === 0 ? <p className="text-muted-foreground text-sm py-8 text-center">No audit entries.</p>
          : data.map((e: any) => (
            <Card key={e.id}><CardContent className="pt-4 text-sm space-y-1">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{e.action_type}</span>
              </div>
              <p className="text-xs text-muted-foreground">By: {e.admin_email}</p>
              {e.details && <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">{JSON.stringify(e.details, null, 2)}</pre>}
              <p className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</p>
            </CardContent></Card>
          ))}
        </TabsContent>

        {/* METRICS */}
        <TabsContent value="metrics" className="space-y-3">
          {isLoading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          : metrics ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              {[
                { label: "Total Users", value: metrics.totalUsers },
                { label: "New Signups (7d)", value: metrics.newSignups },
                { label: "Active Users (7d)", value: metrics.activeUsersWeek },
                { label: "Total Posts", value: metrics.totalPosts },
                { label: "Posts Today", value: metrics.postsToday },
                { label: "Posts This Week", value: metrics.postsThisWeek },
                { label: "Pending Reports", value: metrics.pendingReports },
                { label: "Banned Users", value: metrics.bannedCount },
              ].map((s) => (
                <Card key={s.label}><CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </CardContent></Card>
              ))}
            </div>
          ) : <p className="text-muted-foreground text-sm py-8 text-center">No metrics.</p>}
        </TabsContent>

        {/* ADMINS & USERS */}
        <TabsContent value="admins-users">
          {user && <AdminsUsersTab currentUserId={user.id} />}
        </TabsContent>
      </Tabs>

      {/* Action confirmation dialog */}
      <Dialog open={!!actionTarget} onOpenChange={(o) => !o && setActionTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionTarget ? ACTION_LABELS[actionTarget.action] : ""}</DialogTitle>
            <DialogDescription>
              {actionTarget?.action === "ban" && "This will permanently ban the user, delete the content, remove them from all circles, and put their owned circles on transfer block."}
              {actionTarget?.action === "suspend_7d" && "User will be suspended for 7 days and receive a strike."}
              {actionTarget?.action === "warn" && "User will receive a warning notification."}
              {actionTarget?.action === "delete_content" && "Content will be permanently deleted and the user will receive a strike."}
              {actionTarget?.action === "dismiss" && "Report is closed and the content is restored."}
              {actionTarget?.action === "restore" && "Content is unhidden and the report is closed."}
              {actionTarget?.action === "mark_spam_reporter" && "All future reports from this user will be silently ignored. Content is restored."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Optional note (visible in audit log)"
            value={actionNote}
            onChange={(e) => setActionNote(e.target.value)}
            maxLength={1000}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionTarget(null)} disabled={actionLoading}>Cancel</Button>
            <Button
              variant={actionTarget?.action === "ban" || actionTarget?.action === "delete_content" ? "destructive" : "default"}
              onClick={submitAction}
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
