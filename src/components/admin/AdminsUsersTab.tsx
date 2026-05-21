import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Search, Gift, Building2, Shield } from "lucide-react";

interface Props {
  currentUserId: string;
}

type LookupUser = {
  user_id: string;
  email?: string;
  display_name?: string;
  account_status?: string;
  created_at?: string;
  plan: string;
  comped_by_admin_at?: string | null;
  comp_note?: string | null;
  max_circles?: number;
  max_members_per_circle?: number;
  circles_owned: number;
  stripe_status: string | null;
};

const invoke = async (action: string, payload: any = {}) => {
  const { data, error } = await supabase.functions.invoke("admin-manage-users", {
    body: { action, ...payload },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
};

const emailStatusText = (email?: any, label = "Email") => {
  if (!email?.requested) return `${label} skipped.`;
  if (email.queued) return `${label} queued.`;
  if (email.suppressed) return `${label} suppressed.`;
  return `${label} not queued${email?.error ? `: ${email.error}` : "."}`;
};

export const AdminsUsersTab = ({ currentUserId }: Props) => {
  const { toast } = useToast();

  // moderators
  const [moderators, setModerators] = useState<any[]>([]);
  const [modLoading, setModLoading] = useState(false);
  const [addModOpen, setAddModOpen] = useState(false);
  const [newModEmail, setNewModEmail] = useState("");
  const [newModNote, setNewModNote] = useState("");
  const [confirmRemoveMod, setConfirmRemoveMod] = useState<any>(null);

  // user lookup
  const [query, setQuery] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [results, setResults] = useState<LookupUser[]>([]);
  const [compTarget, setCompTarget] = useState<LookupUser | null>(null);
  const [compPlan, setCompPlan] = useState<"family" | "extended">("family");
  const [compNote, setCompNote] = useState("");
  const [compSendEmail, setCompSendEmail] = useState(true);
  const [enterpriseTarget, setEnterpriseTarget] = useState<LookupUser | null>(null);

  // active comps
  const [comps, setComps] = useState<any[]>([]);
  const [compsLoading, setCompsLoading] = useState(false);
  const [compsPage, setCompsPage] = useState(1);
  const COMPS_PER_PAGE = 10;

  // enterprise
  const [enterprise, setEnterprise] = useState<any[]>([]);
  const [entLoading, setEntLoading] = useState(false);
  const [entPage, setEntPage] = useState(1);
  const ENT_PER_PAGE = 10;
  const [entDialog, setEntDialog] = useState<{ row: any | null; is_new: boolean; user_id?: string; account_email?: string } | null>(null);
  const [entForm, setEntForm] = useState({
    contact_email: "", agreed_price_cents: 0, billing_cadence: "monthly",
    max_circles: 10, max_members_per_circle: 100, next_invoice_due_at: "",
    notes: "", send_gift_email: false,
  });
  const [actionLoading, setActionLoading] = useState(false);

  const loadModerators = useCallback(async () => {
    setModLoading(true);
    try { const d = await invoke("list_moderators"); setModerators(d.moderators ?? []); }
    catch (e: any) { toast({ title: "Failed to load moderators", description: e.message, variant: "destructive" }); }
    finally { setModLoading(false); }
  }, [toast]);

  const loadComps = useCallback(async () => {
    setCompsLoading(true);
    try { const d = await invoke("list_comps"); setComps(d.comps ?? []); }
    catch (e: any) { toast({ title: "Failed to load comps", description: e.message, variant: "destructive" }); }
    finally { setCompsLoading(false); }
  }, [toast]);

  const loadEnterprise = useCallback(async () => {
    setEntLoading(true);
    try { const d = await invoke("list_enterprise"); setEnterprise(d.enterprise ?? []); }
    catch (e: any) { toast({ title: "Failed to load enterprise", description: e.message, variant: "destructive" }); }
    finally { setEntLoading(false); }
  }, [toast]);

  useEffect(() => { loadModerators(); loadComps(); loadEnterprise(); }, [loadModerators, loadComps, loadEnterprise]);

  const runLookup = async () => {
    if (!query.trim()) return;
    setLookupLoading(true);
    try { const d = await invoke("lookup_user", { query }); setResults(d.users ?? []); }
    catch (e: any) { toast({ title: "Lookup failed", description: e.message, variant: "destructive" }); }
    finally { setLookupLoading(false); }
  };

  const addModerator = async () => {
    setActionLoading(true);
    try {
      await invoke("add_moderator", { email: newModEmail, note: newModNote });
      toast({ title: "Moderator added" });
      setAddModOpen(false); setNewModEmail(""); setNewModNote("");
      loadModerators();
    } catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
    finally { setActionLoading(false); }
  };

  const removeModerator = async (user_id: string) => {
    setActionLoading(true);
    try {
      await invoke("remove_moderator", { user_id });
      toast({ title: "Moderator removed" });
      setConfirmRemoveMod(null);
      loadModerators();
    } catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
    finally { setActionLoading(false); }
  };

  const submitComp = async () => {
    if (!compTarget) return;
    setActionLoading(true);
    try {
      const data = await invoke("comp_plan", {
        user_id: compTarget.user_id, plan: compPlan, note: compNote, send_gift_email: compSendEmail,
      });
      toast({ title: "Plan comped", description: `${compTarget.email} → ${compPlan}. ${emailStatusText(data.email, "Founder email")}` });
      setCompTarget(null); setCompNote(""); setCompPlan("family"); setCompSendEmail(true);
      runLookup(); loadComps();
    } catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
    finally { setActionLoading(false); }
  };

  const revokeComp = async (user_id: string) => {
    if (!confirm("Revoke this comp and drop user back to free?")) return;
    setActionLoading(true);
    try {
      await invoke("revoke_comp", { user_id });
      toast({ title: "Comp revoked" });
      loadComps(); runLookup();
    } catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
    finally { setActionLoading(false); }
  };

  const openEnterpriseNew = (u: LookupUser) => {
    setEntDialog({ row: null, is_new: true, user_id: u.user_id, account_email: u.email });
    setEntForm({
      contact_email: u.email ?? "", agreed_price_cents: 0, billing_cadence: "monthly",
      max_circles: 10, max_members_per_circle: 100, next_invoice_due_at: "",
      notes: "", send_gift_email: false,
    });
  };

  const openEnterpriseEdit = (row: any) => {
    setEntDialog({ row, is_new: false, user_id: row.user_id, account_email: row.account_email });
    setEntForm({
      contact_email: row.contact_email ?? "",
      agreed_price_cents: row.agreed_price_cents ?? 0,
      billing_cadence: row.billing_cadence ?? "monthly",
      max_circles: row.max_circles ?? 10,
      max_members_per_circle: row.max_members_per_circle ?? 100,
      next_invoice_due_at: row.next_invoice_due_at ? new Date(row.next_invoice_due_at).toISOString().slice(0, 10) : "",
      notes: row.notes ?? "", send_gift_email: false,
    });
  };

  const submitEnterprise = async () => {
    if (!entDialog?.user_id) return;
    setActionLoading(true);
    try {
      const data = await invoke("upsert_enterprise", {
        user_id: entDialog.user_id,
        is_new: entDialog.is_new,
        contact_email: entForm.contact_email,
        agreed_price_cents: entForm.agreed_price_cents,
        billing_cadence: entForm.billing_cadence,
        max_circles: entForm.max_circles,
        max_members_per_circle: entForm.max_members_per_circle,
        next_invoice_due_at: entForm.next_invoice_due_at || null,
        notes: entForm.notes,
        send_gift_email: entForm.send_gift_email,
      });
      toast({
        title: entDialog.is_new ? "Enterprise account created" : "Enterprise account updated",
        description: entDialog.is_new
          ? `${emailStatusText(data.welcome_email, "Enterprise welcome")} ${emailStatusText(data.gift_email, "Founder email")}`
          : undefined,
      });
      setEntDialog(null);
      loadEnterprise(); if (query) runLookup();
    } catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
    finally { setActionLoading(false); }
  };

  const markInvoiceSent = async (id: string) => {
    setActionLoading(true);
    try { await invoke("mark_invoice_sent", { enterprise_account_id: id }); toast({ title: "Invoice marked sent" }); loadEnterprise(); }
    catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
    finally { setActionLoading(false); }
  };

  const removeEnterprise = async (user_id: string) => {
    if (!confirm("Remove enterprise plan and drop user back to free?")) return;
    setActionLoading(true);
    try { await invoke("remove_enterprise", { user_id }); toast({ title: "Enterprise removed" }); loadEnterprise(); }
    catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
    finally { setActionLoading(false); }
  };

  const canComp = (u: LookupUser) => u.plan === "free" && !u.stripe_status;

  return (
    <TooltipProvider>
      <div className="space-y-8 mt-4">
        {/* ============ MODERATORS ============ */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif text-xl font-bold flex items-center gap-2">
              <Shield className="w-5 h-5" /> Manage Moderators
            </h2>
            <Button size="sm" onClick={() => setAddModOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> Add Admin
            </Button>
          </div>
          {modLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
            <div className="space-y-2">
              {moderators.map((m) => (
                <Card key={m.user_id}>
                  <CardContent className="pt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div>
                      <p className="font-medium">{m.email ?? m.user_id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.display_name && <>{m.display_name} · </>}
                        Granted {new Date(m.granted_at).toLocaleDateString()}
                        {m.user_id === currentUserId && <Badge variant="outline" className="ml-2">You</Badge>}
                      </p>
                      {m.note && <p className="text-xs italic mt-1">{m.note}</p>}
                    </div>
                    <Button
                      size="sm" variant="destructive"
                      disabled={m.user_id === currentUserId}
                      onClick={() => setConfirmRemoveMod(m)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* ============ USER LOOKUP ============ */}
        <section>
          <h2 className="font-serif text-xl font-bold flex items-center gap-2 mb-3">
            <Search className="w-5 h-5" /> User Lookup & Plan Comp
          </h2>
          <div className="flex gap-2 mb-3">
            <Input
              placeholder="Search by email or display name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runLookup()}
            />
            <Button onClick={runLookup} disabled={lookupLoading}>
              {lookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
            </Button>
          </div>
          <div className="space-y-2">
            {results.map((u) => {
              const compAllowed = canComp(u);
              return (
                <Card key={u.user_id}>
                  <CardContent className="pt-4 space-y-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{u.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {u.display_name} · {u.circles_owned} circle(s) owned · joined {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1 items-center">
                        <Badge variant="secondary">{u.plan}</Badge>
                        {u.comped_by_admin_at && <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">comped</Badge>}
                        {u.stripe_status && <Badge variant="destructive">stripe: {u.stripe_status}</Badge>}
                        {u.account_status && u.account_status !== "active" && <Badge variant="destructive">{u.account_status}</Badge>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2">
                      {compAllowed ? (
                        <>
                          <Button size="sm" onClick={() => { setCompTarget(u); setCompPlan("family"); }}>
                            <Gift className="w-4 h-4 mr-1" /> Comp Plan
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openEnterpriseNew(u)}>
                            <Building2 className="w-4 h-4 mr-1" /> Make Enterprise
                          </Button>
                        </>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span><Button size="sm" disabled>Comp unavailable</Button></span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {u.stripe_status
                              ? `User has an ${u.stripe_status} Stripe subscription.`
                              : `User is already on '${u.plan}'.`}
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {u.comped_by_admin_at && (
                        <Button size="sm" variant="destructive" onClick={() => revokeComp(u.user_id)}>
                          Revoke comp
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {!lookupLoading && query && results.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">No matches.</p>
            )}
          </div>
        </section>

        {/* ============ ACTIVE COMPS ============ */}
        <section>
          <h2 className="font-serif text-xl font-bold flex items-center gap-2 mb-3">
            <Gift className="w-5 h-5" /> Active Comps
          </h2>
          {compsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : comps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active comps.</p>
          ) : (
            <>
              <div className="space-y-2">
                {comps.slice((compsPage - 1) * COMPS_PER_PAGE, compsPage * COMPS_PER_PAGE).map((c) => {
                  const status = c.email_status as string | null;
                  const dotColor =
                    status === "sent" ? "bg-green-500" :
                    status === "pending" ? "bg-yellow-500" :
                    status ? "bg-red-500" : "bg-muted-foreground/40";
                  const dotLabel =
                    status === "sent" ? `Founder email sent${c.email_sent_at ? ` ${new Date(c.email_sent_at).toLocaleString()}` : ""}` :
                    status === "pending" ? "Founder email pending" :
                    status ? `Founder email ${status}${c.email_error ? `: ${c.email_error}` : ""}` :
                    "No founder email on record";
                  return (
                  <Card key={c.user_id}>
                    <CardContent className="pt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={`inline-block w-2.5 h-2.5 rounded-full ${dotColor}`} aria-label={dotLabel} />
                            </TooltipTrigger>
                            <TooltipContent>{dotLabel}</TooltipContent>
                          </Tooltip>
                          <p className="font-medium">{c.email}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {c.display_name && <>{c.display_name} · </>}
                          {c.plan} · since {new Date(c.comped_by_admin_at).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Reach: <span className="text-foreground font-medium">{c.members_brought_in ?? 0}</span> member{(c.members_brought_in ?? 0) === 1 ? "" : "s"} across <span className="text-foreground font-medium">{c.circles_owned ?? 0}</span> circle{(c.circles_owned ?? 0) === 1 ? "" : "s"}
                        </p>
                        {c.comp_note && <p className="text-xs italic mt-1">"{c.comp_note}"</p>}
                      </div>
                      <Button size="sm" variant="destructive" onClick={() => revokeComp(c.user_id)}>
                        Revoke
                      </Button>
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
              {comps.length > COMPS_PER_PAGE && (
                <div className="flex items-center justify-between mt-3 text-sm">
                  <span className="text-muted-foreground">
                    Showing {(compsPage - 1) * COMPS_PER_PAGE + 1}–{Math.min(compsPage * COMPS_PER_PAGE, comps.length)} of {comps.length}
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={compsPage === 1}
                      onClick={() => setCompsPage((p) => Math.max(1, p - 1))}>
                      Previous
                    </Button>
                    <Button size="sm" variant="outline"
                      disabled={compsPage * COMPS_PER_PAGE >= comps.length}
                      onClick={() => setCompsPage((p) => p + 1)}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>


        {/* ============ ENTERPRISE ============ */}
        <section>
          <h2 className="font-serif text-xl font-bold flex items-center gap-2 mb-3">
            <Building2 className="w-5 h-5" /> Enterprise Accounts
          </h2>
          {entLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : enterprise.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No enterprise accounts yet. Use User Lookup → "Make Enterprise" to create one.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                {enterprise.slice((entPage - 1) * ENT_PER_PAGE, entPage * ENT_PER_PAGE).map((e) => (
                  <Card key={e.id}>
                    <CardContent className="pt-4 space-y-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">{e.account_email}</p>
                          <p className="text-xs text-muted-foreground">
                            {e.display_name && <>{e.display_name} · </>}
                            Contact: {e.contact_email}
                          </p>
                        </div>
                        <Badge variant="secondary">{e.plan}</Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                        <div>Circles: <span className="text-foreground">{e.max_circles}</span></div>
                        <div>Members/circle: <span className="text-foreground">{e.max_members_per_circle}</span></div>
                        <div>${(e.agreed_price_cents / 100).toFixed(2)} {e.currency} / {e.billing_cadence}</div>
                        <div>Next invoice: {e.next_invoice_due_at ? new Date(e.next_invoice_due_at).toLocaleDateString() : "—"}</div>
                      </div>
                      {e.notes && <p className="text-xs italic">{e.notes}</p>}
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Button size="sm" variant="outline" onClick={() => openEnterpriseEdit(e)}>Edit</Button>
                        <Button size="sm" onClick={() => markInvoiceSent(e.id)}>Mark invoice sent</Button>
                        <Button size="sm" variant="destructive" onClick={() => removeEnterprise(e.user_id)}>Remove</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {enterprise.length > ENT_PER_PAGE && (
                <div className="flex items-center justify-between mt-3 text-sm">
                  <span className="text-muted-foreground">
                    Showing {(entPage - 1) * ENT_PER_PAGE + 1}–{Math.min(entPage * ENT_PER_PAGE, enterprise.length)} of {enterprise.length}
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={entPage === 1}
                      onClick={() => setEntPage((p) => Math.max(1, p - 1))}>
                      Previous
                    </Button>
                    <Button size="sm" variant="outline"
                      disabled={entPage * ENT_PER_PAGE >= enterprise.length}
                      onClick={() => setEntPage((p) => p + 1)}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* ============ DIALOGS ============ */}
        <Dialog open={addModOpen} onOpenChange={setAddModOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Moderator</DialogTitle>
              <DialogDescription>The account must already exist on Familial.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Email</Label>
                <Input value={newModEmail} onChange={(e) => setNewModEmail(e.target.value)} type="email" placeholder="user@example.com" />
              </div>
              <div>
                <Label>Note (optional)</Label>
                <Input value={newModNote} onChange={(e) => setNewModNote(e.target.value)} placeholder="e.g. Support inbox owner" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddModOpen(false)} disabled={actionLoading}>Cancel</Button>
              <Button onClick={addModerator} disabled={actionLoading || !newModEmail}>
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!confirmRemoveMod} onOpenChange={(o) => !o && setConfirmRemoveMod(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove Moderator</DialogTitle>
              <DialogDescription>
                Remove <strong>{confirmRemoveMod?.email}</strong> from moderators? They will lose access to /admin.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmRemoveMod(null)} disabled={actionLoading}>Cancel</Button>
              <Button variant="destructive" onClick={() => removeModerator(confirmRemoveMod.user_id)} disabled={actionLoading}>
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Remove
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!compTarget} onOpenChange={(o) => !o && setCompTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Comp Plan — {compTarget?.email}</DialogTitle>
              <DialogDescription>
                Gift a paid plan. User is updated immediately and (optionally) receives a founder email.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Plan</Label>
                <Select value={compPlan} onValueChange={(v) => setCompPlan(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="family">Family (20 members)</SelectItem>
                    <SelectItem value="extended">Extended (35 members)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Gift note (internal)</Label>
                <Input value={compNote} onChange={(e) => setCompNote(e.target.value)} placeholder="e.g. Friend gift — Founder" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={compSendEmail} onCheckedChange={(c) => setCompSendEmail(!!c)} />
                Send founder gift email
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCompTarget(null)} disabled={actionLoading}>Cancel</Button>
              <Button onClick={submitComp} disabled={actionLoading}>
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Apply Comp
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!entDialog} onOpenChange={(o) => !o && setEntDialog(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {entDialog?.is_new ? "Create" : "Edit"} Enterprise — {entDialog?.account_email}
              </DialogTitle>
              <DialogDescription>
                Off-platform billing. Limits accept any value from 1 to 10,000.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Max circles</Label>
                  <Input type="number" min={1} max={10000}
                    value={entForm.max_circles}
                    onChange={(e) => setEntForm({ ...entForm, max_circles: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Max members/circle</Label>
                  <Input type="number" min={1} max={10000}
                    value={entForm.max_members_per_circle}
                    onChange={(e) => setEntForm({ ...entForm, max_members_per_circle: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <Label>Contact email</Label>
                <Input type="email" value={entForm.contact_email}
                  onChange={(e) => setEntForm({ ...entForm, contact_email: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Price (USD)</Label>
                  <Input type="number" min={0} step="0.01"
                    value={(entForm.agreed_price_cents / 100).toString()}
                    onChange={(e) => setEntForm({ ...entForm, agreed_price_cents: Math.round(Number(e.target.value) * 100) })} />
                </div>
                <div>
                  <Label>Billing cadence</Label>
                  <Select value={entForm.billing_cadence} onValueChange={(v) => setEntForm({ ...entForm, billing_cadence: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Next invoice due</Label>
                <Input type="date" value={entForm.next_invoice_due_at}
                  onChange={(e) => setEntForm({ ...entForm, next_invoice_due_at: e.target.value })} />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea rows={2} value={entForm.notes}
                  onChange={(e) => setEntForm({ ...entForm, notes: e.target.value })} />
              </div>
              {entDialog?.is_new && (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={entForm.send_gift_email} onCheckedChange={(c) => setEntForm({ ...entForm, send_gift_email: !!c })} />
                  Send founder gift email
                </label>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEntDialog(null)} disabled={actionLoading}>Cancel</Button>
              <Button onClick={submitEnterprise} disabled={actionLoading}>
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {entDialog?.is_new ? "Create" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};
