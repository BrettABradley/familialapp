

## Create Push Notification Edge Function for APNs

### Overview
Build a backend function that your mobile app can call to send Apple Push Notifications, plus a table to store device push tokens. Your mobile app authenticates with its user JWT — no service role key needed.

### Required Secrets
Before implementation, you'll need to add these secrets via Lovable Cloud → Secrets:
- **APNS_KEY_ID** — Your APNs Key ID (from Apple Developer → Keys)
- **APNS_TEAM_ID** — Your Apple Developer Team ID
- **APNS_BUNDLE_ID** — Your app's bundle identifier (e.g., `com.familial.app`)
- **APNS_AUTH_KEY_P8** — The contents of your `.p8` private key file (paste the full text including `-----BEGIN PRIVATE KEY-----`)

### Database Changes

**New table: `push_tokens`**
- `id` (uuid, PK)
- `user_id` (uuid, not null) — references the authenticated user
- `device_token` (text, not null) — the APNs device token
- `platform` (text, default `'ios'`)
- `created_at` (timestamptz)
- Unique constraint on `(user_id, device_token)`
- RLS: users can insert/update/delete/select their own tokens only

### Edge Functions

**1. `register-push-token`** — Mobile app calls this after obtaining an APNs device token
- Authenticates via JWT (`getClaims`)
- Upserts the device token into `push_tokens`

**2. `send-push-notification`** — Called by database triggers or other edge functions (server-to-server) when a notification is created
- Uses `SUPABASE_SERVICE_ROLE_KEY` to query `push_tokens` for the target user
- Signs and sends the push via APNs HTTP/2 API using the `.p8` key
- Triggered by a database trigger on the `notifications` table (INSERT)

### Architecture

```text
Mobile App                    Lovable Cloud
───────────                   ────────────
Register token ──JWT──→  register-push-token
                              ↓ upserts push_tokens

DB trigger (notification INSERT)
              ──→  send-push-notification
                      ↓ reads push_tokens
                      ↓ signs JWT for APNs
                      ↓ sends to APNs HTTP/2
```

### Key Details
- The mobile app only needs its user JWT to register tokens — no service role key
- Push sending happens server-side via a database webhook/trigger on `notifications` INSERT
- APNs authentication uses the token-based (`.p8` key) method, not certificates
- The edge function constructs a short-lived JWT signed with the `.p8` key for each APNs request

### Steps
1. Add the 4 APNs secrets
2. Create `push_tokens` table with RLS
3. Create `register-push-token` edge function
4. Create `send-push-notification` edge function
5. Add `supabase/config.toml` entries for both functions
6. Set up a database webhook on `notifications` INSERT to invoke `send-push-notification`

