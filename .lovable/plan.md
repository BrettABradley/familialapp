

## Plan: Populate "Test" circle with demo data

**Circle**: `ff8b3fee-518c-4701-98ef-5db86f6dfd17` (owner: `59b40736-dbc2-48aa-9c78-4e4b7bfc78cd`)

### Approach
Use a database migration (runs as superuser, bypasses RLS) to insert all demo data in one batch.

### Data to insert

1. **6 fake profiles** with random UUIDs (Mom, Dad, Sister, Brother, Cousin, Grandma) — these won't be real auth users but will display correctly in the UI
2. **6 circle memberships** linking fake profiles to the Test circle
3. **~10 feed posts** from various members (mix of text-only and text with content — no media URLs since we don't have uploaded files)
4. **3 photo albums** (e.g., "Summer BBQ 2025", "Thanksgiving 2025", "Family Reunion") with placeholder descriptions
5. **4 events** (upcoming and past) — 2-3 linked to albums via `album_id`
6. **5-6 fridge pins** (notes, reminders — text-only since we can't upload images)
7. **A few reactions and comments** on the posts for realism

### Limitation
- Fake members won't have auth accounts, so they can't log in — but their names, posts, and contributions will show up throughout the app for demo purposes
- No actual media files (images/videos) since that requires storage uploads — posts and albums will be text-based

### Files to modify
- None — this is purely a database data insertion via migration

