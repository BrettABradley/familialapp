

## Push Notifications via Expo Push (No Apple Secrets Needed)

### Why Expo Push
Expo's push service is a free proxy that handles APNs/FCM for you. Your edge function sends a simple HTTP POST to `https://exp.host/--/api/v2/push/send` with the Expo push token — no `.p8` keys, no Key ID, no Team ID required. Expo manages the APNs connection on their end.

### No Secrets Required
- Expo push tokens look like `ExponentPushToken[xxxx]`
- The Expo push API is **unauthenticated** for basic usage (no API key needed)
- Zero Apple Developer credentials needed on the server side

### Database Changes

**New table: `push_tokens`**
- `id` (uuid, PK)
- `user_id` (uuid, not null)
- `expo_token` (text, not null) — the Expo push token
- `created_at` (timestamptz, default now())
- Unique constraint on `(user_id, expo_token)`
- RLS: users can insert/select/delete their own tokens only

### Edge Functions

**1. `register-push-token`**
- Mobile app calls with user JWT after getting Expo push token
- Upserts token into `push_tokens`

**2. `send-push-notification`**
- Triggered by a database trigger on `notifications` INSERT
- Uses service role key to look up target user's Expo tokens
- POSTs to `https://exp.host/--/api/v2/push/send` with title, body, data
- No secrets needed for the Expo API call

### Architecture
```text
Mobile App (Expo)              Lovable Cloud
─────────────────              ────────────
getExpoPushTokenAsync()
  → register-push-token ──→ [push_tokens table]

DB trigger (notification INSERT)
  → send-push-notification
      → reads push_tokens
      → POST to exp.host/--/api/v2/push/send
      → Push delivered via APNs/FCM automatically
```

### Steps
1. Create `push_tokens` table with RLS
2. Create `register-push-token` edge function
3. Create `send-push-notification` edge function
4. Add config.toml entries for both functions
5. Add database trigger on `notifications` INSERT to call `send-push-notification`

