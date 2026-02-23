

## Plan: Transfer Ownership Approval Flow and Transfer Block

### Overview
Two new ownership transfer mechanisms replacing the current instant transfer:

1. **Request-based transfer** -- Owner selects a member, that member gets a notification with Accept/Deny buttons. Transfer only happens on Accept.
2. **Transfer Block** -- Owner puts the circle "up for grabs." All members see a banner and can claim ownership. Circle stays fully accessible during this period.

---

### 1. New Database Table: `circle_transfer_requests`

Tracks pending transfer requests to specific members.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| circle_id | uuid | FK to circles |
| from_user_id | uuid | Current owner |
| to_user_id | uuid | Proposed new owner |
| status | text | `pending`, `accepted`, `declined` |
| leave_after_transfer | boolean | Whether the original owner wants to leave after transfer |
| created_at | timestamptz | Default now() |
| resolved_at | timestamptz | Nullable, set on accept/decline |

RLS policies:
- SELECT: Both `from_user_id` and `to_user_id` can view
- INSERT: Only circle owner (`from_user_id = auth.uid()`)
- UPDATE: Only recipient (`to_user_id = auth.uid()`) can accept/decline

### 2. New Column on `circles`: `transfer_block`

Add a boolean column `transfer_block` (default false) to the `circles` table. When true, any member can claim ownership.

### 3. Modified Transfer Flow (Circles.tsx)

**Instead of calling `transfer_circle_ownership` immediately:**
- Insert a row into `circle_transfer_requests` with status `pending`
- Create a notification for the recipient with type `transfer_request`
- Show a toast: "Transfer request sent to [name]. They'll be notified."
- The "Transfer & Leave" flow sets `leave_after_transfer = true`

**Cancel:** Owner can cancel a pending request (delete the row).

### 4. Notification Accept/Deny UI (Notifications.tsx)

When a notification has type `transfer_request`:
- Show Accept and Deny buttons inline
- **Accept**: Call `transfer_circle_ownership` RPC, update request status to `accepted`, notify original owner. If `leave_after_transfer` is true, also remove the old owner from memberships.
- **Deny**: Update request status to `declined`, notify original owner that the transfer was declined.

### 5. Transfer Block Feature

**Activating (Circles.tsx):**
- New button in the Transfer Ownership dialog: "Put on Transfer Block"
- Sets `circles.transfer_block = true`
- Creates a notification for all circle members: "Circle [name] needs a new owner"

**Banner (new component or extend ReadOnlyBanner):**
- On every circle page, if `transfer_block = true`, show a banner: "[Circle name] needs a new owner. Claim ownership to keep it going."
- Non-owners see a "Claim Ownership" button
- The current owner sees "This circle is on transfer block. Waiting for someone to claim ownership."

**Claiming:**
- Member clicks "Claim Ownership" -> calls `transfer_circle_ownership` RPC
- Sets `transfer_block = false`
- Notifies old owner: "[name] has claimed ownership of [circle]"

### 6. Database Migration Summary

```sql
-- 1. Transfer requests table
CREATE TABLE public.circle_transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  leave_after_transfer boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.circle_transfer_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Participants can view transfer requests"
  ON public.circle_transfer_requests FOR SELECT TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Circle owners can create transfer requests"
  ON public.circle_transfer_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Recipients can respond to transfer requests"
  ON public.circle_transfer_requests FOR UPDATE TO authenticated
  USING (auth.uid() = to_user_id AND status = 'pending');

CREATE POLICY "Senders can cancel transfer requests"
  ON public.circle_transfer_requests FOR DELETE TO authenticated
  USING (auth.uid() = from_user_id AND status = 'pending');

-- 2. Transfer block column on circles
ALTER TABLE public.circles ADD COLUMN transfer_block boolean NOT NULL DEFAULT false;
```

### 7. Files to Modify

- **`src/pages/Circles.tsx`** -- Replace instant transfer with request creation; add "Put on Transfer Block" button; show pending transfer state
- **`src/pages/Notifications.tsx`** -- Add Accept/Deny buttons for `transfer_request` type notifications; handle the accept/deny logic
- **`src/components/layout/CircleHeader.tsx`** or new **`src/components/circles/TransferBlockBanner.tsx`** -- Banner shown when `transfer_block = true` with "Claim Ownership" button
- **`src/contexts/CircleContext.tsx`** -- Include `transfer_block` in the Circle interface and fetch it
- **`src/integrations/supabase/types.ts`** -- Auto-updated after migration

### 8. Flow Diagrams

**Request-based transfer:**
```text
Owner clicks "Transfer" on a member
  -> Creates transfer_request (pending)
  -> Sends notification to recipient
  -> Recipient sees Accept / Deny in notifications
     -> Accept: transfer_circle_ownership runs, old owner notified
     -> Deny: request marked declined, old owner notified
```

**Transfer Block:**
```text
Owner clicks "Put on Transfer Block"
  -> circles.transfer_block = true
  -> All members notified
  -> Banner appears on circle pages
  -> Any member clicks "Claim Ownership"
     -> transfer_circle_ownership runs
     -> transfer_block set to false
     -> Old owner notified
```

