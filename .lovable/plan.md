

# Update Circle Invite Email Sender Address

## Overview
Update the circle invitation email sender address from `onboarding@resend.dev` to `Familial Media <welcome@support.familialmedia.com>`.

## Prerequisite
The domain `support.familialmedia.com` (or `familialmedia.com`) must be verified in your Resend account. Without domain verification, Resend will reject emails from this address. If you haven't verified it yet, you'll need to add DNS records (SPF, DKIM) in your domain provider's settings.

## Change

### `supabase/functions/send-circle-invite/index.ts`
- Update the `from` field from `"Familial <onboarding@resend.dev>"` to `"Familial Media <welcome@support.familialmedia.com>"`
- Redeploy the edge function

