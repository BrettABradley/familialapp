import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE_URL = 'https://www.familialmedia.com'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  // Find pending rows that have been unread >= 1 hour and not yet emailed
  const { data: pending, error } = await supabase
    .from('pending_unread_email_notifications')
    .select('id, recipient_id, sender_id, first_unread_at, last_message_at')
    .is('email_sent_at', null)
    .lte('first_unread_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .limit(200)

  if (error) {
    console.error('Failed to fetch pending unread emails', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!pending || pending.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let sent = 0
  for (const row of pending) {
    try {
      // Look up recipient email + pref
      const { data: recipientAuth } = await supabase.auth.admin.getUserById(row.recipient_id)
      const recipientEmail = recipientAuth?.user?.email
      if (!recipientEmail) continue

      const { data: recipientProfile } = await supabase
        .from('profiles')
        .select('email_on_unread_dm')
        .eq('user_id', row.recipient_id)
        .maybeSingle()

      if (recipientProfile && recipientProfile.email_on_unread_dm === false) {
        // Mark sent so we don't keep checking
        await supabase
          .from('pending_unread_email_notifications')
          .update({ email_sent_at: new Date().toISOString() })
          .eq('id', row.id)
        continue
      }

      // Get sender name + alias if any
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', row.sender_id)
        .maybeSingle()

      const { data: alias } = await supabase
        .from('member_aliases')
        .select('alias')
        .eq('user_id', row.recipient_id)
        .eq('target_user_id', row.sender_id)
        .maybeSingle()

      const senderName = alias?.alias || senderProfile?.display_name || 'Someone'

      // Send the email via send-transactional-email
      const { error: sendError } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'unseen-message',
          recipientEmail,
          idempotencyKey: `unread-dm-${row.id}-${new Date(row.first_unread_at).getTime()}`,
          templateData: {
            senderName,
            url: `${SITE_URL}/messages`,
          },
        },
      })

      if (sendError) {
        console.error('Failed to send unread-dm email', { row: row.id, error: sendError })
        continue
      }

      await supabase
        .from('pending_unread_email_notifications')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', row.id)

      sent++
    } catch (e) {
      console.error('Error processing unread email row', { row: row.id, error: e })
    }
  }

  return new Response(JSON.stringify({ processed: pending.length, sent }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
