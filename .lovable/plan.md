## Plan: Remove Moderator Role, Open Fridge and Invites to All Members

**Status: COMPLETED**

All three changes have been implemented:

1. ✅ **Removed moderator role** — DB enum updated, `has_circle_role` recreated, Circles.tsx dropdown updated
2. ✅ **Fridge open to all members** — RLS policies updated, frontend admin gating removed, any member can pin/delete own pins
3. ✅ **Invites open to all members** — `circle_invites` INSERT policy now uses `is_circle_member`
