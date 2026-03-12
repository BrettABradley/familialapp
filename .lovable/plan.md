

## Make @Mentions Clickable Profile Links

**Problem**: When a user @mentions someone in a post or comment, the name appears as plain text with no link to their profile.

**Solution**: Enhance `LinkifiedText` to detect `@Name` patterns and render them as clickable links to `/profile/:userId`. Since `LinkifiedText` is a shared component, we'll pass in an optional members list to resolve names to user IDs.

### Changes

**`src/components/shared/LinkifiedText.tsx`**
- Add an optional `members` prop: `Array<{ user_id: string; display_name: string | null }>`
- After splitting by URL regex, further split text segments by `@mention` pattern (`@(\w[\w\s]*?)(?=\s@|\s|$)` or similar)
- When a mention matches a member's `display_name`, render as `<Link to={/profile/${userId}}>@Name</Link>` styled with `text-primary font-medium`
- Non-matching `@` text stays as plain text

**`src/components/feed/PostCard.tsx`**
- Import and use `useCircleMembers` hook
- Pass `members` to all `<LinkifiedText>` instances (post content on ~line 247 and comment content on ~line 391)

**`src/components/feed/CreatePostForm.tsx`** — no changes needed (already uses MentionInput for composing)

### Profile route
Already exists: `/profile/:userId` → `ProfileView` component. No routing changes needed.

