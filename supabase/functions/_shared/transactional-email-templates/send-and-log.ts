import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  sendTemplateEmail,
  type SendTemplateEmailOptions,
  type SendTemplateEmailResult,
} from './send-email.ts'

// Sends a registered template through Lovable's managed email API and records
// the outcome in the app's email_send_log table (append-only history the admin
// surfaces read). Delivery, retries and suppression are handled by Lovable.

async function logSend(
  templateName: string,
  recipient: string,
  status: 'sent' | 'suppressed' | 'failed',
  errorMessage?: string,
) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return
  try {
    const supabase = createClient(supabaseUrl, serviceKey)
    const { error } = await supabase.from('email_send_log').insert({
      message_id: null,
      template_name: templateName,
      recipient_email: recipient,
      status,
      error_message: errorMessage ? errorMessage.slice(0, 1000) : null,
    })
    if (error) {
      console.error('Failed to write email_send_log row', {
        template_name: templateName,
        status,
        error,
      })
    }
  } catch (e) {
    console.error('email_send_log write threw', e)
  }
}

export async function sendAndLogTemplateEmail(
  templateName: string,
  to: string,
  options: SendTemplateEmailOptions = {},
): Promise<SendTemplateEmailResult> {
  try {
    const result = await sendTemplateEmail(templateName, to, options)
    await logSend(
      templateName,
      to,
      result.sent ? 'sent' : 'suppressed',
      result.sent ? undefined : 'Recipient is suppressed',
    )
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await logSend(templateName, to, 'failed', message)
    throw error
  }
}
