// Daily cron-driven reminder for enterprise invoices.
// Sends an internal reminder email to brettbradley007@gmail.com when an
// enterprise account's next_invoice_due_at falls 7 days away or today.
// Idempotent per (enterprise_account_id, due_date, days_until_due) via
// the send-transactional-email idempotencyKey.
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendAndLogTemplateEmail } from "../_shared/transactional-email-templates/send-and-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date();
  const startToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const { data: accounts, error } = await supabase
    .from("enterprise_accounts")
    .select("*")
    .not("next_invoice_due_at", "is", null);

  if (error) {
    console.error("query failed", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let sent = 0;

  for (const acc of accounts ?? []) {
    const due = new Date(acc.next_invoice_due_at);
    const dueDay = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate()));
    const diffDays = Math.round((dueDay.getTime() - startToday.getTime()) / 86400000);
    if (diffDays !== 7 && diffDays !== 0) continue;

    // Lookup customer name
    let customerName: string | undefined;
    const { data: prof } = await supabase
      .from("profiles").select("display_name").eq("user_id", acc.user_id).maybeSingle();
    if (prof?.display_name) customerName = prof.display_name;
    if (!customerName) {
      const { data: u } = await supabase.auth.admin.getUserById(acc.user_id);
      customerName = u?.user?.email ?? "Enterprise customer";
    }

    const amountUsd = ((acc.agreed_price_cents ?? 0) / 100).toFixed(2);
    const dueDate = dueDay.toISOString().slice(0, 10);
    const idempotencyKey = `ent-invoice-${acc.id}-${dueDate}-${diffDays}`;

    try {
      const result = await sendAndLogTemplateEmail(
        "enterprise-invoice-reminder",
        "brettbradley007@gmail.com",
        {
          idempotencyKey,
          templateData: {
            customerName,
            contactEmail: acc.contact_email,
            amountUsd,
            cadence: acc.billing_cadence,
            dueDate,
            daysUntilDue: diffDays,
          },
        },
      );
      if (result.sent) sent++;
      else console.warn("send skipped", { reason: result.reason });
    } catch (e) {
      console.error("send failed", e);
    }
  }

  return new Response(JSON.stringify({ ok: true, sent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
