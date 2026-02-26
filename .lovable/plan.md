

## Plan: Replace support email text with icon button in header

### Change in `src/components/landing/Header.tsx`

**Desktop**: Replace the `Mail` icon + "support@familialmedia.com" text link with just a `Mail` icon button (tooltip: "Contact Support") that links to `mailto:support@familialmedia.com`.

**Mobile menu**: Keep the full email text since mobile menus benefit from explicit labels, but this can be simplified too if preferred.

### Files to modify
- `src/components/landing/Header.tsx` — replace email text with icon-only mailto link in desktop nav

