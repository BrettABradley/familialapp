

# Enhanced Account Deletion: 3-Step Confirmation + Complete Data Cleanup + Transfer Block

## Overview

Upgrade the account deletion flow with a 3-step "Are you sure?" confirmation, comprehensive billing cancellation, full user data cleanup, and automatic transfer block for owned circles that still have members. Also reposition the Delete Account button below Sign Out and make it smaller/less prominent.

## Changes

### 1. Settings UI (`src/pages/Settings.tsx`)

**Layout change**: Move the Delete Account card *below* the Sign Out button. Make the delete button smaller (`size="sm"`, `variant="ghost"` with destructive text) so it's clearly secondary to Sign Out.

**3-Step confirmation dialog**:
- **Step 1 — Warning** (1/3): "This will permanently delete your account." Lists consequences: all data removed, subscriptions canceled, owned circles transferred or deleted. Buttons: Cancel / "I understand, continue"
- **Step 2 — What gets deleted** (2/3): Specific list — posts, comments, messages, photos, fridge pins, memberships. Notes that owned circles with members will be placed on transfer block. Buttons: Back / "Continue to final step"  
- **Step 3 — Type DELETE** (3/3): Final confirmation with text input. Buttons: Back / "Delete Forever"

State: replace `deleteDialogOpen` boolean with `deleteStep` (0 = closed, 1–3).

### 2. Edge Function (`supabase/functions/delete-account/index.ts`)

**Billing cleanup expansion**:
- Query Stripe subscriptions with `status=active&status=trialing&status=past_due` (currently only `active`)

**Transfer block for owned circles with members**:
- Before deleting owned circles, check each for remaining members
- If a circle has other members: set `transfer_block = true` and skip deletion (leave circle intact for members to claim)
- If a circle has no other members: delete it and all its data (existing logic)

**Global user data cleanup** (content authored in circles they don't own):
- Delete user's posts in any circle → cascade comments/reactions on those posts
- Delete user's comments, reactions, fridge pins, campfire stories, event RSVPs
- Delete user's album photos
- Delete user's group chat messages
- Clean up storage files (avatars bucket: `{userId}/` prefix)

**Order of operations**:
1. Cancel Stripe subscriptions (active, trialing, past_due)
2. Handle owned circles: transfer-block those with members, delete empty ones
3. Delete user-authored content globally (posts, comments, reactions, pins, stories, RSVPs, album photos, group chat messages)
4. Remove circle memberships
5. Delete user-specific records (notifications, DMs, push tokens, profile images, user plans, aliases, store offers, profiles)
6. Clean up storage files
7. Delete auth user

### Files to modify

| Action | File |
|--------|------|
| Modify | `src/pages/Settings.tsx` — 3-step dialog, reposition delete below sign out, smaller button |
| Modify | `supabase/functions/delete-account/index.ts` — transfer block logic, expanded billing + data cleanup |

