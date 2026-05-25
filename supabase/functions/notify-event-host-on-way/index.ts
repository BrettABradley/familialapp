import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const callerId = userData.user.id

    const { eventId } = await req.json().catch(() => ({}))
    if (!eventId || typeof eventId !== 'string') {
      return new Response(JSON.stringify({ error: 'eventId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(supabaseUrl, serviceKey)

    const { data: event, error: eventErr } = await admin
      .from('events')
      .select('id, title, circle_id, created_by')
      .eq('id', eventId)
      .maybeSingle()
    if (eventErr || !event) {
      return new Response(JSON.stringify({ error: 'Event not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (event.created_by === callerId) {
      return new Response(JSON.stringify({ ok: true, skipped: 'self' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: isMember } = await admin.rpc('is_circle_member', {
      _user_id: callerId, _circle_id: event.circle_id,
    })
    if (!isMember) {
      return new Response(JSON.stringify({ error: 'Not a circle member' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Rate-limit: one ping per (caller, event-host) per 30 min
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const { data: recent } = await admin
      .from('notifications')
      .select('id')
      .eq('user_id', event.created_by)
      .eq('related_user_id', callerId)
      .eq('type', 'event_on_my_way')
      .gte('created_at', thirtyMinAgo)
      .limit(1)
    if (recent && recent.length > 0) {
      return new Response(JSON.stringify({ ok: true, skipped: 'rate_limited' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: actorProfile } = await admin
      .from('profiles').select('display_name').eq('user_id', callerId).maybeSingle()
    const actorName = actorProfile?.display_name || 'Someone'

    const { data: aliasRow } = await admin
      .from('member_aliases')
      .select('alias')
      .eq('user_id', event.created_by)
      .eq('target_user_id', callerId)
      .maybeSingle()
    const displayActor = aliasRow?.alias || actorName

    const { data: circle } = await admin
      .from('circles').select('name').eq('id', event.circle_id).maybeSingle()
    const circleName = circle?.name || ''

    const link = `/events?circle=${event.circle_id}&eventId=${event.id}`

    const { error: notifErr } = await admin.from('notifications').insert({
      user_id: event.created_by,
      type: 'event_on_my_way',
      title: 'On the way',
      message: `${displayActor} is on the way to "${event.title}"`,
      related_user_id: callerId,
      related_circle_id: event.circle_id,
      link,
    })
    if (notifErr) console.error('notification insert failed', notifErr)

    const { data: hostUser } = await admin.auth.admin.getUserById(event.created_by)
    const hostEmail = hostUser?.user?.email
    if (hostEmail) {
      try {
        await admin.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'event-on-my-way',
            recipientEmail: hostEmail,
            idempotencyKey: `event-on-my-way-${event.id}-${callerId}-${Math.floor(Date.now() / (30 * 60 * 1000))}`,
            templateData: {
              actorName: displayActor,
              eventTitle: event.title,
              circleName,
              url: `https://www.familialmedia.com${link}`,
            },
          },
        })
      } catch (e) {
        console.error('email invoke failed', e)
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('notify-event-host-on-way error', err)
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
