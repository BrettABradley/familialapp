

## Fix: Desktop Nav Collapses Too Late

**Problem**: The full horizontal nav (8 items with icon+label) shows starting at `md` (768px), but needs ~1100px+ to display properly. Between 768–1100px it's jumbled and unusable.

**Solution**: Raise the full nav breakpoint to `xl` (1280px) and add a hamburger menu for the `md`–`xl` range.

### Changes

**`src/components/layout/CircleHeader.tsx`**

1. Change the inline nav from `hidden md:flex` → `hidden xl:flex` and update centering from `lg:absolute` → `xl:absolute`
2. Add a hamburger menu (Sheet from right side) visible at `md`–`xl` range (`hidden md:block xl:hidden`):
   - Menu icon button that opens a Sheet
   - All nav items listed vertically with icons
   - Sign Out at the bottom
   - Each link closes the sheet on click
3. Bell icon visibility: change from `!isMobile` to show on both hamburger and full nav ranges

**`src/components/layout/CircleHeaderSkeleton.tsx`**
- Mirror the same breakpoint change (`md` → `xl`) for the skeleton nav placeholder

**No mobile changes** — bottom nav bar and header pin/bell stay exactly the same.

### Breakpoint behavior after fix
- **< 768px**: Mobile bottom nav + header pin/bell (unchanged)
- **768px–1279px**: Hamburger menu icon in header → opens Sheet with nav items
- **≥ 1280px**: Full centered horizontal nav (unchanged look)

