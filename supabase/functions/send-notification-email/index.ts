// Sends the mention / new-album notification emails triggered by the
// notifications table. Called only by the database trigger, which
// authenticates with the shared trigger secret.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { sendAndLogTemplateEmail } from '../_shared/transactional-email-templates/send-and-log.ts'

const ALLOWED_TEMPLATES = new Set(['mention-notification', 'new-album'])
const ALLOWED_URL_PREFIXES = [
  'https://www.familialmedia.com',
  'https://familialmedia.com',
  'https://support.familialmedia.com',
]

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function json(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function isTriggerSecretCaller(req: Request): Promise<boolean> {
  const header = req.headers.get('x-trigger-secret')
  if (!header) return false
  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    const { data, error } = await admin.rpc('get_trigger_secret', {
      _key: 'push_trigger_secret',
    })
    if (error || !data) {
      console.error('get_trigger_secret rpc error:', error)
      return false
    }
    return timingSafeEqual(header, data as string)
  } catch (e) {
    console.error('isTriggerSecretCaller threw:', e)
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  if (!(await isTriggerSecretCaller(req))) {
    return json({ error: 'Forbidden' }, 403)
  }

  let templateName: string
  let recipientEmail: string
  let idempotencyKey: string | undefined
  let templateData: Record<string, unknown> = {}
  try {
    const body = await req.json()
    templateName = String(body.templateName ?? '')
    recipientEmail = String(body.recipientEmail ?? '')
    idempotencyKey = body.idempotencyKey ? String(body.idempotencyKey) : undefined
    if (body.templateData && typeof body.templateData === 'object') {
      templateData = body.templateData
    }
  } catch {
    return json({ error: 'Invalid JSON in request body' }, 400)
  }

  if (!ALLOWED_TEMPLATES.has(templateName)) {
    return json({ error: 'Unsupported template' }, 400)
  }
  if (!recipientEmail) {
    return json({ error: 'recipientEmail is required' }, 400)
  }

  const url = templateData.url
  if (typeof url === 'string' && !ALLOWED_URL_PREFIXES.some((p) => url.startsWith(p))) {
    return json({ error: 'templateData.url must point to a familialmedia.com domain' }, 400)
  }

  try {
    const result = await sendAndLogTemplateEmail(templateName, recipientEmail, {
      templateData,
      idempotencyKey,
    })
    return json({ success: result.sent, reason: result.sent ? undefined : result.reason })
  } catch (e) {
    console.error('notification email send failed', { templateName, error: e })
    return json({ error: 'Failed to send email' }, 500)
  }
})
