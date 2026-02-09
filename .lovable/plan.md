

# Cookbook Audit Implementation Plan

## Overview

This plan addresses all issues identified across the 9 audit questions, mapped to the cookbook's 7 sections. The work is organized into 8 discrete tasks.

---

## Task 1: Security -- API Keys & Secrets

**Cookbook Section:** Security: API Keys and Secrets

**Current State:** The `.env` file contains only `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_SUPABASE_PROJECT_ID` -- all publishable, client-safe values. Sensitive keys (`RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are configured as server-side secrets only, used exclusively in the `send-circle-invite` edge function. No secrets are hardcoded in source files.

**Finding:** PASS -- No changes needed. The architecture correctly separates publishable client keys from sensitive server-side secrets.

**Prompt Used:** "Are any of my API keys, database credentials, or other secrets visible in the frontend code or committed to version control?"

---

## Task 2: Security -- Authorization (IDOR) & SQL Injection

**Cookbook Section:** Security: Authorization + Database Queries

**Current State:** All data access is scoped through Supabase RLS policies using `auth.uid()` and helper functions like `is_circle_member()`, `shares_circle_with()`, and `is_circle_admin()`. The Supabase JS SDK uses parameterized queries internally, preventing SQL injection. The `Messages.tsx` search function includes an `escapeILIKE()` utility to sanitize wildcards.

**Finding:** PASS -- No structural changes needed. RLS enforces server-side authorization on every table regardless of what IDs a client sends.

**Prompt Used:** "As a logged-in user, can I view or modify data belonging to another user by changing an ID in the URL?"

---

## Task 3: Security -- Input Validation

**Cookbook Section:** Security: Input Validation

**Current State:** Server-side validation triggers exist for all major tables (`validate_post`, `validate_comment`, `validate_circle`, `validate_event`, `validate_private_message`, `validate_fridge_pin`, `validate_notification`, `validate_family_tree_member`, `validate_photo_album`, `validate_store_offer`). Rate limiting triggers are also in place (`check_message_rate_limit`, `check_post_rate_limit`, `check_comment_rate_limit`, `check_invite_rate_limit`, `check_fridge_pin_rate_limit`, `check_store_offer_rate_limit`). Client-side `maxLength` attributes are used on some but not all input fields.

**Changes Needed:**
- Add `maxLength` attributes to input fields that are missing them:
  - `Feed.tsx`: Post content textarea (max 5000)
  - `Circles.tsx`: Circle name input (max 100), description textarea (max 500)
  - `Events.tsx`: Title (max 200), description (max 2000), location (max 300)
  - `Fridge.tsx`: Title (max 100), content (max 1000)
  - `Messages.tsx`: Message input already has maxLength={5000} -- PASS
  - `Profile.tsx`: Display name (max 100), bio (max 1000), location (max 200)

This is a defense-in-depth measure. The server-side triggers already enforce these limits, but client-side `maxLength` prevents users from typing beyond limits and avoids confusing server errors.

---

## Task 4: Security -- Dependencies

**Cookbook Section:** Security: Dependencies

**Current State:** All listed dependencies are recent versions. No known critical vulnerabilities in the current stack. The project uses `date-fns` (not `moment.js`), which is the recommended lightweight alternative.

**Finding:** PASS -- Dependencies are current.

---

## Task 5: UI/UX -- Design Consistency, Loading States, Empty States, Error States

**Cookbook Section:** UI/UX: Design Consistency + Loading States + Empty States + Error States

**Current State:**
- **Design Consistency:** All pages use the same HSL token system from `index.css`, `font-serif` for headings, `font-sans` (Inter) for body text, and consistent card/button patterns. PASS.
- **Loading States:** Every page has skeleton loaders that match the layout of loaded content. Buttons show "Creating...", "Saving...", "Sending..." text and are disabled during async operations. PASS.
- **Empty States:** Every list view has a dedicated empty state with an icon, heading, description, and call-to-action. PASS.
- **Error States:** All mutations use toast notifications with clear, non-technical messages. PASS.

**One Gap Found:** The `handleReaction` function in `Feed.tsx` (line 191-208) silently fails -- no error toast if the reaction insert/delete fails. Same for `markAsRead` and `deleteNotification` in `Notifications.tsx`.

**Changes Needed:**
- Add `try/catch` with toast error handling to `handleReaction` in `Feed.tsx`
- Add `try/catch` with toast error handling to `markAsRead` and `deleteNotification` in `Notifications.tsx`

---

## Task 6: Accessibility -- Semantic HTML, Keyboard Navigation, Screen Reader Support

**Cookbook Section:** Accessibility: Semantic HTML + Screen Reader Support

**Current State:**
- All pages use `<main>` as the top-level content wrapper. PASS.
- `MobileNavigation.tsx` uses `<nav>`. PASS.
- `CircleHeader` uses `<header>`. PASS.
- Focus indicators are preserved via Tailwind's `focus-visible:ring-2` on all interactive components. PASS.

**Gaps Found:**
1. **Heading hierarchy jumps:** Several pages skip from `<h1>` to `<h3>` (e.g., Feed empty state at line 412, Messages empty state, Albums empty state, Fridge empty state). Should use `<h2>`.
2. **Missing `aria-label` on icon-only buttons:** Multiple icon-only buttons lack accessible names:
   - Feed.tsx: Download button (line 474-479), remove preview button (line 370-375), Send comment button (line 555-561)
   - Circles.tsx: Delete circle button (line 294), remove member button (line 361)
   - Events.tsx: Delete event button (line 353-359)
   - Notifications.tsx: Mark as read button (line 195-201), delete button (line 203-209)
   - Albums.tsx: Delete photo button (line 342-348), delete album button (line 313-315)
   - FamilyTree.tsx: Delete member button (line 427-434)
   - Profile.tsx: Camera/upload avatar button (line 167-173)
   - Messages.tsx: Back button (line 236), Send message button (line 268)

**Changes Needed:**
- Change `<h3>` to `<h2>` in all empty-state headings across pages
- Add `aria-label` attributes to all icon-only `<Button>` and `<button>` elements listed above

---

## Task 7: Code Quality -- Component Structure, Error Handling, @ts-nocheck

**Cookbook Section:** Code Quality: Component Structure + Error Handling in Code

**Current State:**
- `Feed.tsx` is 574 lines -- a monolithic component handling post creation, file upload, reactions, comments, and rendering
- `Circles.tsx` uses `// @ts-nocheck` (line 1) and casts `supabase` to `any` (line 43)
- `Fridge.tsx` uses `// @ts-nocheck` (line 1) and casts `supabase` to `any` (line 42)
- `handleReaction` in Feed.tsx has no error handling
- `markAsRead` and `deleteNotification` in Notifications.tsx have no error handling

**Changes Needed:**

### 7a. Refactor Feed.tsx into smaller components
Extract the following into separate files:
- `src/components/feed/CreatePostForm.tsx` -- Post creation form with file upload (lines 325-426)
- `src/components/feed/PostCard.tsx` -- Individual post rendering with reactions and comments (lines 440-567)
- `src/components/feed/PostMediaGrid.tsx` -- Media grid within a post (lines 465-483)
- `src/hooks/useFeedPosts.ts` -- Custom hook for fetching posts, handling reactions, and submitting comments

This reduces Feed.tsx from 574 lines to approximately 80 lines (imports, hook usage, and layout).

### 7b. Remove @ts-nocheck from Circles.tsx and Fridge.tsx
- Remove `// @ts-nocheck` directive
- Remove `const db: any = supabase` casts
- Fix the underlying type issues by using proper type assertions on Supabase query results instead of `as unknown as` chains
- Use the existing types from `@/integrations/supabase/types.ts` where possible

### 7c. Add error handling to silent mutations
- Wrap `handleReaction` in try/catch with toast feedback
- Wrap `markAsRead` in try/catch with toast feedback  
- Wrap `deleteNotification` in try/catch with toast feedback

---

## Task 8: Performance -- Unnecessary Re-renders

**Cookbook Section:** Performance: Rendering Performance

**Current State:**
- `handleReaction` in Feed.tsx calls `fetchPosts()` after every like/unlike, re-fetching all 50 posts with their profiles, reactions, and comments from the database. This is the most significant performance issue.
- `handleSubmitComment` does the same -- full re-fetch after one comment.
- No list virtualization, but posts are capped at 50 via `.limit(50)`, which is a reasonable ceiling for DOM nodes.

**Changes Needed:**

### 8a. Implement optimistic updates for reactions
Instead of calling `fetchPosts()` after a reaction:
- Immediately update the local `posts` state to add/remove the reaction
- If the database call fails, revert the local state and show an error toast

### 8b. Implement optimistic updates for comments
Instead of calling `fetchPosts()` after a comment:
- Immediately append the new comment to the local post's comments array using the current user's profile data
- If the database call fails, revert and show an error toast

This eliminates two full network round-trips per interaction and makes the UI feel instant.

---

## Implementation Order

```text
1. Task 3  - Add maxLength to inputs (quick, low risk)
2. Task 6  - Fix heading hierarchy + aria-labels (quick, low risk)
3. Task 5  - Add error handling to silent mutations (quick)
4. Task 7b - Remove @ts-nocheck from Circles.tsx and Fridge.tsx
5. Task 7a - Refactor Feed.tsx into smaller components
6. Task 8  - Add optimistic updates for reactions and comments
```

Tasks 1, 2, and 4 require no code changes (they passed the audit).

---

## Summary Table

| # | Cookbook Section | Item | Status |
|---|----------------|------|--------|
| 1 | Security | API Keys and Secrets | PASS -- no changes |
| 2 | Security | Authorization (IDOR) + Database Queries (SQLi) | PASS -- RLS enforced |
| 3 | Security | Input Validation | ADD client-side maxLength to 6 pages |
| 4 | Security | Dependencies | PASS -- all current |
| 5 | UI/UX | Design Consistency, Loading, Empty, Error States | ADD error toasts to 3 silent mutations |
| 6 | Accessibility | Semantic HTML + Screen Reader Support | FIX heading hierarchy + add 15+ aria-labels |
| 7 | Code Quality | Component Structure + Error Handling | REFACTOR Feed.tsx, REMOVE @ts-nocheck |
| 8 | Performance | Rendering Performance | ADD optimistic updates for reactions/comments |

