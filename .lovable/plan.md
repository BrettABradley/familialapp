# Update Pricing Tiers: Per-Circle Member Limits + Price Change

## Summary

Update the pricing display and database to reflect the correct member limits (per circle) and raise the Extended plan price from $10 to $15/month.

---

## Changes

### 1. Pricing Display (Pricing.tsx)

Update the tier feature text to clarify "per circle" and change Extended price:

- **Free**: "Up to 8 members per circle" (was "Up to 8 family members")
- **Family ($5/mo)**: "Up to 20 members per circle" (was "Up to 20 family members")
- **Extended**: Price changes from "$10" to "$15", text becomes "Up to 35 members per circle"

### 2. Database: Add `max_members_per_circle` column

Add a new column to `user_plans` to store and enforce member-per-circle limits:


| Plan     | max_circles | max_members_per_circle |
| -------- | ----------- | ---------------------- |
| free     | 3           | 8                      |
| family   | 2           | 20                     |
| extended | 3           | 35                     |


### 3. Enforcement (optional, for now)

The member limit can be enforced later when inviting or joining circles. For now, this plan focuses on:

- Updating the pricing UI to show the correct numbers
- Storing the limit in the database so it's ready to enforce

---

## Technical Details

### Pricing.tsx text changes

- Free tier line 14: `"Up to 8 members per circle"`
- Family tier line 30: `"Up to 20 members per circle"`
- Extended tier line 43: `price: "$15"`
- Extended tier line 46: `"Up to 50 members per circle"`

### Database migration

```text
ALTER TABLE public.user_plans
  ADD COLUMN max_members_per_circle integer NOT NULL DEFAULT 8;

-- Update existing plans
UPDATE public.user_plans SET max_members_per_circle = 20 WHERE plan = 'family';
UPDATE public.user_plans SET max_members_per_circle = 50 WHERE plan = 'extended';
```