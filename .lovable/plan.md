

# Add Album Hyperlink to "Too Many Files" Toast

## What needs to change

The toast messages in `CreatePostForm.tsx` that fire when users exceed the 4-file limit currently show plain text mentioning Albums. We need to add a clickable "Go to Albums" action button that navigates to `/albums`.

## Approach

The shadcn toast system already supports an `action` prop via `ToastAction`. We can use this to add a button that navigates to `/albums` when clicked.

## File: `src/components/feed/CreatePostForm.tsx`

Two toast calls need updating (lines 37 and 57). Both will:
- Import `ToastAction` from `@/components/ui/toast`
- Import `useNavigate` from `react-router-dom`
- Add an `action` prop with a `ToastAction` that calls `navigate("/albums")` on click

The toast calls will look like:
```typescript
toast({
  title: "Too many files",
  description: "You can upload up to 4 files per post. For more images, try creating an Album!",
  variant: "destructive",
  action: (
    <ToastAction altText="Go to Albums" onClick={() => navigate("/albums")}>
      Go to Albums
    </ToastAction>
  ),
});
```

This uses the existing toast action pattern -- no new components or infrastructure needed. The `ToastAction` already has destructive-variant styling built in.

