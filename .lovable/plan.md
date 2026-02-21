

# Deduplicate Pending Invites for the Same Circle

## Problem
A user can receive multiple invites to the same circle (e.g., from different family members). Currently, accepting or declining one invite leaves the other duplicate invites still showing as pending. This is confusing -- the user shouldn't have to respond to the same circle invite multiple times.

## Solution

Two changes, both in `PendingInvites.tsx`:

### 1. Deduplicate the displayed invites
When fetching invites, group them by `circle_id` and only show one card per circle (the most recent invite). This way even if 3 people invited the user to the same circle, they see one clean card.

### 2. Resolve all duplicates on accept/decline
When accepting or declining, update ALL pending invites for the same `circle_id` and email -- not just the single invite that was clicked. This clears out every duplicate in one action.

- **Accept**: mark all pending invites for that circle as "accepted", then join the circle
- **Decline**: mark all pending invites for that circle as "declined"

The user can still be re-invited later (a new invite row would be created with "pending" status), so declining doesn't permanently block them.

---

## Technical Details

### PendingInvites.tsx changes

**Deduplication in `fetchInvites`:**
After filtering valid invites, deduplicate by `circle_id` -- keep only the most recent invite per circle.

**In `handleAccept`:**
Replace the single-invite update:
```text
.update({ status: "accepted" }).eq("id", invite.id)
```
with a bulk update targeting all pending invites for the same circle and email:
```text
.update({ status: "accepted" })
.eq("circle_id", invite.circle_id)
.eq("email", user.email)
.eq("status", "pending")
```
Then remove all invites with that `circle_id` from local state.

**In `handleDecline`:**
Same pattern -- update all pending invites for that circle/email combo to "declined", then remove all matching from local state.

No database migration needed -- the existing RLS UPDATE policy on `circle_invites` already allows the invited user to update any of their own pending invites.
