# Familial Mobile App Development Documentation
## Combined PDR (Technical) + MDR (Marketing) for MANUS AI

---

# PART 1: Product Development Report (PDR)
## Technical Architecture and Implementation Guide

---

## Executive Summary

This document provides a comprehensive Product Development Report for converting the Familial web application into native mobile applications (iOS and Android) using the MANUS AI autonomous agent platform. Familial is a private social network SaaS designed for families and close friend groups, featuring circle-based privacy, social feeds, media archival, events calendar, family tree visualization, and a digital "Family Fridge."

---

## 1. Project Overview

### 1.1 Product Vision
Familial is a private social network that connects families without algorithms, ads, or public data harvesting. The platform prioritizes privacy through user-defined "Circles" and provides a safe space for family communication and memory preservation.

### 1.2 Target Users
- Families seeking private digital spaces
- Grandparents and elderly family members (primary mobile users)
- Parents managing family activities and photo sharing
- Extended family members staying connected across distances

### 1.3 Business Model
SaaS subscription model with potential tiered pricing for advanced features.

---

## 2. Current Technical Architecture

### 2.1 Frontend Stack
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.3.1 | UI Framework |
| TypeScript | - | Type Safety |
| Vite | - | Build Tool |
| Tailwind CSS | - | Styling |
| React Router DOM | 6.30.1 | Navigation |
| TanStack Query | 5.83.0 | Server State Management |
| Radix UI | Various | Component Primitives |
| Lucide React | 0.462.0 | Icons |
| date-fns | 3.6.0 | Date Utilities |
| Zod | 3.25.76 | Schema Validation |
| Recharts | 2.15.4 | Data Visualization |

### 2.2 Backend Stack (Lovable Cloud / Supabase)
| Service | Purpose |
|---------|---------|
| PostgreSQL Database | Primary data store |
| Supabase Auth | User authentication |
| Supabase Storage | Media file storage (avatars, post-media) |
| Edge Functions (Deno) | Serverless backend logic |
| Row Level Security (RLS) | Data access control |
| Resend API | Transactional emails |

### 2.3 Existing API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/functions/v1/send-circle-invite` | POST | Send email invitations to join circles |

---

## 3. Database Schema

### 3.1 Core Tables

```text
+-------------------+     +---------------------+     +------------------+
|     profiles      |     |      circles        |     | circle_members   |
+-------------------+     +---------------------+     +------------------+
| id (PK)           |     | id (PK)             |     | id (PK)          |
| user_id (FK)      |     | name                |     | circle_id (FK)   |
| display_name      |     | description         |     | user_id (FK)     |
| avatar_url        |     | owner_id (FK)       |     | role             |
| bio               |     | avatar_url          |     | joined_at        |
| location          |     | created_at          |     +------------------+
+-------------------+     +---------------------+
```

### 3.2 Complete Table List
1. **profiles** - User profile information
2. **circles** - Private family/friend groups
3. **circle_memberships** - User-circle relationships with roles
4. **circle_invites** - Pending invitations with tokens
5. **posts** - Social feed content with media
6. **comments** - Post comments
7. **reactions** - Post reactions (hearts)
8. **events** - Calendar events per circle
9. **photo_albums** - Organized photo collections
10. **album_photos** - Individual photos in albums
11. **fridge_pins** - Family fridge pinned items
12. **family_tree_members** - Genealogy data
13. **notifications** - User notifications
14. **private_messages** - Direct messaging
15. **user_roles** - Admin/moderator roles
16. **photo_permissions** - Download access control

---

## 4. Feature Inventory

### 4.1 Authentication Module
| Feature | Description | Mobile Considerations |
|---------|-------------|----------------------|
| Email/Password Auth | Standard authentication | Biometric login option |
| Email Verification | Confirm user emails | Deep linking for verification |
| Session Management | JWT-based sessions | Secure token storage |

### 4.2 Circles Module
| Feature | Description | Mobile Considerations |
|---------|-------------|----------------------|
| Create Circle | Start new family group | Simple form UI |
| Edit Circle | Update name/description | Admin-only access |
| Delete Circle | Remove circle entirely | Confirmation dialog |
| Invite Members | Email-based invitations | Share sheet integration |
| Manage Members | Role assignment (admin/mod/member) | Easy role picker |
| View Members | List all circle members | Searchable list |

### 4.3 Social Feed Module
| Feature | Description | Mobile Considerations |
|---------|-------------|----------------------|
| Create Post | Text + up to 4 images | Native camera/gallery access |
| View Feed | Chronological posts | Pull-to-refresh |
| React to Posts | Heart reactions | Haptic feedback |
| Comment on Posts | Text comments | Keyboard handling |
| Download Photos | Save to device | Native save functionality |
| Circle Selector | Filter by circle | Dropdown or swipe navigation |

### 4.4 Events Calendar Module
| Feature | Description | Mobile Considerations |
|---------|-------------|----------------------|
| Create Event | Title, date, time, location | Native date/time pickers |
| View Calendar | Monthly calendar view | Touch-friendly calendar |
| Event List | Upcoming events | Scrollable list |
| Delete Event | Remove events | Swipe-to-delete |

### 4.5 Photo Albums Module
| Feature | Description | Mobile Considerations |
|---------|-------------|----------------------|
| Create Album | Named collections | Simple creation flow |
| Upload Photos | Batch image upload | Native image picker |
| View Album | Photo grid | Pinch-to-zoom |
| Delete Photos/Albums | Content removal | Confirmation dialogs |

### 4.6 Family Fridge Module
| Feature | Description | Mobile Considerations |
|---------|-------------|----------------------|
| Pin Items | Notes, photos, reminders | Quick-add FAB |
| View Fridge | Grid of pinned items | Visual fridge metaphor |
| Delete Pins | Remove items | Swipe or long-press |
| Pin Types | Note, Image, Event | Type-specific icons |

### 4.7 Family Tree Module
| Feature | Description | Mobile Considerations |
|---------|-------------|----------------------|
| Add Members | Name, dates, gender, bio | Form with relationships |
| View Tree | Member cards | Potential tree visualization |
| Link Relationships | Parent/spouse connections | Relationship picker |
| Delete Members | Remove from tree | Admin-only |

### 4.8 Messages Module
| Feature | Description | Mobile Considerations |
|---------|-------------|----------------------|
| Conversation List | All active chats | Unread indicators |
| Direct Messages | 1:1 messaging | Real-time updates |
| Search Members | Find circle members | Debounced search |
| Mark as Read | Read status tracking | Auto-mark on view |

### 4.9 Notifications Module
| Feature | Description | Mobile Considerations |
|---------|-------------|----------------------|
| View Notifications | List of all notifications | Push notification integration |
| Mark as Read | Individual/bulk read | Swipe actions |
| Delete Notifications | Remove notifications | Swipe-to-delete |
| Notification Types | Reaction, comment, invite, event | Type-specific icons |

### 4.10 Profile Module
| Feature | Description | Mobile Considerations |
|---------|-------------|----------------------|
| View Profile | Current user info | Profile card |
| Edit Profile | Name, bio, location | Inline editing |
| Avatar Upload | Profile photo | Camera/gallery access |

---

## 5. Mobile-Specific Requirements

### 5.1 Native Capabilities Required

```text
+---------------------------+-----------------------------------+
| Capability                | Use Case                          |
+---------------------------+-----------------------------------+
| Camera                    | Profile photos, posts, albums     |
| Photo Library             | Select existing photos            |
| Push Notifications        | Real-time alerts                  |
| Biometric Auth            | FaceID/TouchID login              |
| Haptic Feedback           | Reaction/action confirmation      |
| Share Sheet               | Share invites, content            |
| Local Storage             | Offline data caching              |
| Background Refresh        | Fetch new content                 |
| Deep Linking              | Email verification, invite links  |
| Calendar Integration      | Export events (optional)          |
+---------------------------+-----------------------------------+
```

### 5.2 UI/UX Requirements
- **Minimum touch target**: 44x44 pixels
- **Bottom navigation**: Primary nav for thumb access
- **Pull-to-refresh**: All list views
- **Skeleton loaders**: Already implemented, maintain consistency
- **Safe area handling**: Account for notches and home indicators
- **Dark mode support**: System preference detection

### 5.3 Offline Capabilities
- Cache recent feed posts
- Queue posts for upload when offline
- Store draft messages
- Display cached profile data

---

## 6. Development Approach: Capacitor (Recommended)

**Approach**: Wrap existing React app in native container

**Pros**:
- Reuse 100% of existing React codebase
- Faster development timeline
- Single codebase for web + mobile
- Native plugin access for camera, notifications, etc.

**Required Plugins**:
```text
@capacitor/core
@capacitor/cli
@capacitor/ios
@capacitor/android
@capacitor/camera
@capacitor/filesystem
@capacitor/push-notifications
@capacitor/share
@capacitor/haptics
@capacitor/local-notifications
@capacitor/app (for deep linking)
```

---

## 7. Implementation Plan

### Phase 1: Project Setup (Week 1)
1. Install Capacitor dependencies
2. Initialize Capacitor project
3. Configure app ID: `app.lovable.familial`
4. Configure app name: `Familial`
5. Add iOS and Android platforms
6. Configure live reload for development

### Phase 2: Core Mobile Adaptations (Week 2-3)
1. Add safe area padding (already using pb-safe)
2. Implement biometric authentication
3. Configure deep linking for invite emails
4. Add haptic feedback to interactions
5. Implement native camera access for uploads
6. Add photo library access

### Phase 3: Push Notifications (Week 3-4)
1. Configure Firebase Cloud Messaging (Android)
2. Configure APNs (iOS)
3. Create notification service edge function
4. Implement notification permission request
5. Handle notification taps and deep links

### Phase 4: Offline Support (Week 4-5)
1. Implement service worker for caching
2. Add offline detection UI
3. Queue offline actions for sync
4. Cache critical data locally

### Phase 5: Testing & Polish (Week 5-6)
1. Device-specific testing (various screen sizes)
2. Performance optimization
3. Accessibility audit
4. App store asset preparation
5. Beta testing

---

## 8. App Store Requirements

### 8.1 iOS App Store
| Requirement | Specification |
|-------------|---------------|
| App Icon | 1024x1024 PNG |
| Screenshots | 6.7", 6.5", 5.5" (required) |
| Privacy Policy URL | Required |
| App Description | Up to 4000 characters |
| Keywords | 100 character limit |
| Developer Account | Apple Developer Program ($99/year) |

### 8.2 Google Play Store
| Requirement | Specification |
|-------------|---------------|
| App Icon | 512x512 PNG |
| Feature Graphic | 1024x500 |
| Screenshots | Minimum 2 per device type |
| Privacy Policy URL | Required |
| App Description | 4000 character limit |
| Developer Account | Google Play Console ($25 one-time) |

---

## 9. Security Considerations

### 9.1 Current Security Measures
- Row Level Security (RLS) on all tables
- JWT-based authentication
- HTTPS-only API communication
- Input validation and sanitization
- Secure password requirements (min 6 chars)

### 9.2 Mobile-Specific Security
- Secure token storage (Keychain/Keystore)
- Biometric authentication gate
- Certificate pinning (optional)
- Jailbreak/root detection (optional)
- Screen capture prevention for sensitive data (optional)

---

## 10. MANUS AI Integration Points

### 10.1 Tasks for MANUS Agent
1. **Capacitor Configuration** - Initialize project with correct app ID, configure platforms
2. **Native Plugin Integration** - Camera, push notifications, share sheet, biometric auth
3. **Code Modifications** - Add native camera capture, push handling, deep link routing
4. **Build Configuration** - iOS Xcode project, Android Gradle, app signing, icons

### 10.2 Key Information

**App Identifier**: `app.lovable.familial`

**Existing URLs**:
- Preview: `https://id-preview--f7454400-93af-4f43-90a6-0d52ff08c778.lovable.app`
- Production: `https://familialapp.lovable.app`

**Backend API**:
- Supabase Project ID: `qxkwxolssapayqyfdwqc`
- API URL: Available via environment variable `VITE_SUPABASE_URL`

**Configured Secrets**:
- `RESEND_API_KEY` - For email sending

---

## 11. File Structure Summary
```text
src/
├── components/
│   ├── fridge/          # Fridge board components
│   ├── landing/         # Marketing page components
│   ├── layout/          # App layout (header, nav, skeleton)
│   └── ui/              # Reusable UI components (shadcn)
├── contexts/
│   └── CircleContext    # Shared circle/profile state
├── hooks/
│   ├── useAuth          # Authentication hook
│   └── use-mobile       # Mobile detection hook
├── integrations/
│   └── supabase/        # Database client and types
├── pages/
│   ├── Feed.tsx         # Social feed
│   ├── Circles.tsx      # Circle management
│   ├── Events.tsx       # Calendar
│   ├── Albums.tsx       # Photo albums
│   ├── Messages.tsx     # Direct messaging
│   ├── Fridge.tsx       # Family fridge
│   ├── FamilyTree.tsx   # Genealogy
│   ├── Notifications.tsx # User notifications
│   ├── Profile.tsx      # User profile
│   └── Auth.tsx         # Authentication
└── supabase/
    └── functions/       # Edge functions
        └── send-circle-invite/
```

---

# PART 2: Marketing Design Report (MDR)
## Visual Identity, Brand Voice, and Feature Messaging Guide

---

## 1. Brand Identity

### 1.1 Brand Name and Tagline
- **Name**: Familial
- **Primary Tagline**: "Where Family Actually Connects"
- **Secondary Taglines**:
  - "Private by Design. No Ads. No Algorithms."
  - "The private social network for families who value connection over content."
  - "Your Family Deserves Better Than Algorithms"

### 1.2 Brand Personality
| Attribute | Description |
|-----------|-------------|
| Warm | Feels like a family album, not a tech product |
| Nostalgic | Evokes memories, scrapbooks, and legacy |
| Clean | Minimalist design that lets content shine |
| Trustworthy | Privacy-first messaging at every touchpoint |
| Accessible | Simple enough for grandparents to use |

### 1.3 Brand Promise
"A private space for the people who matter most. Share moments, plan events, and stay close — without the noise of public social media."

---

## 2. Typography System

### 2.1 Primary Fonts

| Font Family | Usage | Emotional Purpose |
|-------------|-------|-------------------|
| Playfair Display | Headings (h1-h6), Feature titles, Pricing names | Elegance, legacy, "storybook" feel |
| Inter | Body text, Buttons, Navigation, Descriptions | Modern, readable, professional |

### 2.2 Font Loading
```css
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap');
```

### 2.3 Typography Scale
| Element | Font | Size (Mobile) | Size (Desktop) | Weight |
|---------|------|---------------|----------------|--------|
| H1 (Hero) | Playfair Display | 36px (text-4xl) | 72px (text-7xl) | Bold (700) |
| H2 (Section) | Playfair Display | 30px (text-3xl) | 48px (text-5xl) | Bold (700) |
| H3 (Card title) | Playfair Display | 20px (text-xl) | 20px (text-xl) | Semibold (600) |
| Body | Inter | 16px (text-base) | 18px (text-lg) | Regular (400) |
| Small/Label | Inter | 14px (text-sm) | 14px (text-sm) | Medium (500) |
| Button | Inter | 14px-18px | 14px-18px | Medium (500) |

### 2.4 Typography CSS Classes
```css
.font-serif { font-family: 'Playfair Display', Georgia, serif; }
.font-sans  { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
```

---

## 3. Color System

### 3.1 Design Philosophy
The color system is **monochromatic black and white** — intentionally minimal to:
- Create a timeless, elegant aesthetic
- Let family photos and content be the focal point
- Avoid visual noise that distracts from connections
- Evoke the feeling of a classic photo album

### 3.2 Light Mode Palette

| Token | HSL Value | Usage |
|-------|-----------|-------|
| --background | 0 0% 100% | Page background (white) |
| --foreground | 0 0% 8% | Primary text (near-black) |
| --primary | 0 0% 8% | Buttons, links, icons |
| --primary-foreground | 0 0% 100% | Text on primary buttons |
| --secondary | 0 0% 96% | Card backgrounds, badges |
| --secondary-foreground | 0 0% 8% | Text on secondary |
| --muted | 0 0% 96% | Disabled states |
| --muted-foreground | 0 0% 45% | Subtle text (gray) |
| --border | 0 0% 90% | Borders, dividers |
| --card | 0 0% 100% | Card surfaces |
| --destructive | 0 72% 51% | Error states (red) |

### 3.3 Dark Mode Palette

| Token | HSL Value | Usage |
|-------|-----------|-------|
| --background | 0 0% 4% | Page background (dark) |
| --foreground | 0 0% 98% | Primary text (near-white) |
| --primary | 0 0% 98% | Buttons, links, icons |
| --primary-foreground | 0 0% 4% | Text on primary buttons |
| --secondary | 0 0% 15% | Card backgrounds |
| --muted-foreground | 0 0% 65% | Subtle text (gray) |
| --border | 0 0% 18% | Borders, dividers |

### 3.4 Hero Section Gradient
```css
--hero-gradient: linear-gradient(135deg, hsl(0 0% 98%) 0%, hsl(0 0% 100%) 50%, hsl(0 0% 96%) 100%);
```

---

## 4. Logo and Brand Assets

### 4.1 Asset Inventory
| Asset | File | Usage |
|-------|------|-------|
| Full Logo | `src/assets/logo.png` | Hero section, splash screens |
| Icon | `src/assets/icon.png` | Header, footer, app icon base |
| Hero Background | `src/assets/hero-bg.jpg` | Background imagery (optional) |

### 4.2 Logo Specifications
- **Primary Logo**: "Familial" wordmark with icon
- **Icon Only**: Used in navigation header (32-40px height)
- **Full Logo**: Used in hero section (96-128px height)
- **Logo Treatment**: Always paired with serif wordmark "Familial"

### 4.3 App Store Icon Requirements
| Platform | Size | Format |
|----------|------|--------|
| iOS App Store | 1024x1024 | PNG (no transparency) |
| Google Play | 512x512 | PNG |
| Android Adaptive | 108x108 (safe zone: 66x66) | PNG |

---

## 5. UI Component System

### 5.1 Button Variants

| Variant | Style | Usage |
|---------|-------|-------|
| default | Black bg, white text | Primary actions |
| hero | Black bg, shadow, lift | CTA buttons |
| hero-outline | Border, transparent bg | Secondary CTA |
| outline | Border only | Less emphasis |
| ghost | No border, hover bg | Navigation items |
| secondary | Gray bg | Tertiary actions |
| destructive | Red bg | Danger actions |

### 5.2 Button Sizes
| Size | Height | Padding | Font Size | Border Radius |
|------|--------|---------|-----------|---------------|
| sm | 36px (h-9) | 12px | 14px | 8px (rounded-lg) |
| default | 40px (h-10) | 16px | 14px | 8px |
| lg | 48px (h-12) | 32px | 16px | 12px (rounded-xl) |
| xl | 56px (h-14) | 40px | 18px | 12px |

### 5.3 Card Components
- **Border**: 1px solid `--border`
- **Border Radius**: 16px (rounded-2xl)
- **Padding**: 32px (p-8)
- **Hover State**: Border darkens, subtle shadow appears
- **Background**: `--card` (white in light mode)

### 5.4 Icon System
- **Library**: Lucide React
- **Icon Size**: 20px (w-5 h-5) for inline, 28px (w-7 h-7) for feature icons
- **Icon Color**: `--foreground` (black/white based on mode)
- **Icon Containers**: 56px (w-14 h-14) rounded-xl with `--secondary` background

---

## 6. Marketing Page Structure

### 6.1 Landing Page Sections (in order)

```text
1. Header (Fixed)
   └── Logo + Navigation + CTA Buttons

2. Hero Section
   └── Badge → Headline → Subheadline → CTA Buttons → Trust Indicators

3. Features Section
   └── Section Label → Headline → Description → 6-Card Grid

4. How It Works Section
   └── Section Label → Headline → Description → 3-Step Cards → CTA

5. Testimonials Section
   └── Section Label → Headline → Description → 3 Testimonial Cards

6. Pricing Section
   └── Headline → Description → 3 Pricing Cards → Custom Plan CTA

7. CTA Section
   └── Icon → Headline → Description → CTA Buttons → Trust Note

8. Footer
   └── Brand + Links (Product, Company, Legal) + Copyright
```

### 6.2 Section Pattern
Each section follows this consistent pattern:
1. **Label**: Uppercase, small, tracking-wider (e.g., "FEATURES")
2. **Headline**: Playfair Display, large, centered
3. **Description**: Inter, muted color, max-width constrained
4. **Content**: Cards, steps, or testimonials
5. **Optional CTA**: Action button at bottom

---

## 7. Feature Messaging

### 7.1 Core Features and Why They Matter

| Feature | Title | Description | Why It Matters |
|---------|-------|-------------|----------------|
| Circles | Create Your Circles | Organize connections into meaningful groups — Immediate Family, College Friends, Work Crew. Share exactly what you want, with exactly who you want. | Solves the "one-size-fits-all" problem of mainstream social media. |
| Feed | Algorithm-Free Feed | See every post from your circles, in chronological order. No hidden content, no suggested posts, no viral distractions. | Eliminates frustration of missing important family updates. |
| Privacy | True Privacy | Your family photos stay with your family. No data harvesting, no AI training, no advertisers. Your memories belong to you. | Addresses concern about children's photos being used to train AI. |
| Albums | Living Scrapbook | Every photo, video, and milestone is archived in a beautiful timeline. Create a digital family album that grows with you. | Replaces scattered photos with one unified family archive. |
| Events | Event Coordination | Built-in calendar for birthdays, reunions, and gatherings. Never miss a celebration. | Eliminates chaos of planning via group text threads. |
| Messaging | Threaded Conversations | Comments and reactions that stay organized. Every conversation stays connected to its context. | Photos and discussions stay linked for easy memory finding. |

### 7.2 How It Works Messaging

| Step | Title | Description |
|------|-------|-------------|
| 01 | Create Your Account | Sign up in seconds with just your email. No phone number required, no invasive permissions. |
| 02 | Build Your Circles | Invite your family and friends. Create circles for different groups — grandparents, siblings, childhood friends. |
| 03 | Start Sharing | Post photos, updates, and memories. Choose exactly which circles see each post. Watch your family story grow. |

### 7.3 Trust Indicators (Hero Section)
- **100% Ad-Free** — Revenue model isn't based on attention harvesting
- **End-to-End Privacy** — Technical assurance of data protection
- **Family-First Design** — UX priority on accessibility for all ages

---

## 8. Pricing Structure

### 8.1 Tier Overview

| Tier | Price | Users | Key Features |
|------|-------|-------|--------------|
| Free | $0 | 8 | 1 circle, unlimited posts/photos |
| Family | $5/mo | 20 | 2 circles, events, albums |
| Extended | $10/mo | 50 | 3 circles, family tree, messaging |

### 8.2 Pricing Messaging Strategy
- **Lead with "Free"**: Lower barrier to entry
- **Highlight "Most Popular"**: Social proof on Family tier
- **Custom Plans**: Phone CTA for enterprise/community sales

### 8.3 Feature Progression
| Feature | Free | Family | Extended |
|---------|------|--------|----------|
| Circles | 1 | 2 | 3 |
| Members | 8 | 20 | 50 |
| Posts & Photos | Unlimited | Unlimited | Unlimited |
| Event Planning | - | Yes | Yes |
| Photo Albums | - | Yes | Yes |
| Family Tree | - | - | Yes |
| Private Messaging | - | - | Yes |
| Admin Tools | - | - | Yes |
| Priority Support | - | Yes | Yes |

---

## 9. Voice and Tone Guidelines

### 9.1 Brand Voice Characteristics

| Characteristic | Do This | Avoid This |
|----------------|---------|------------|
| Warm | "The people who matter" | "Your network connections" |
| Clear | "No ads, ever." | "Ad-free experience options" |
| Confident | "Your memories belong to you." | "We try our best to protect..." |
| Inclusive | "Simple enough for everyone" | "Easy for non-technical users" |
| Anti-Algorithm | "Chronological order" | "Smart feed optimization" |

### 9.2 Key Phrases to Use
- "Private by design"
- "The people who matter most"
- "No ads. No algorithms. Ever."
- "Where family actually connects"
- "Your family story"
- "Simple enough for grandparents"

### 9.3 Phrases to Avoid
- "Social network" (use "private family space" instead)
- "Users" (use "family members" or "people")
- "Content" (use "moments," "memories," or "updates")
- "Engagement" (implies metric-driven, not relationship-driven)
- "Viral" or "trending" (opposite of our value proposition)

---

## 10. Animation and Interaction Patterns

### 10.1 Entry Animations
```css
.animate-fade-up {
  animation: fadeUp 0.6s ease-out forwards;
}

.animate-fade-in {
  animation: fadeIn 0.5s ease-out forwards;
}

.animate-scale-in {
  animation: scaleIn 0.4s ease-out forwards;
}
```

### 10.2 Animation Staggering
Hero elements use `animation-delay` for cascading reveal:
- Badge: 0s
- Headline: 0.1s
- Subheadline: 0.2s
- CTA Buttons: 0.3s
- Trust Indicators: 0.4s

### 10.3 Hover Interactions
- **Buttons**: Lift effect (`hover:-translate-y-0.5`) with shadow increase
- **Cards**: Border darkens, shadow appears (`hover:shadow-lg`)
- **Links**: Color transition from muted to foreground

---

## 11. Responsive Design Breakpoints

| Breakpoint | Width | Primary Consideration |
|------------|-------|----------------------|
| Default | < 640px | Mobile phones (single column) |
| sm | >= 640px | Large phones |
| md | >= 768px | Tablets (2-column layouts) |
| lg | >= 1024px | Laptops (3-column layouts) |
| xl | >= 1280px | Desktops |
| 2xl | >= 1400px | Large monitors (max container) |

### Mobile-First Priorities
- Bottom navigation for app pages (thumb zone)
- Minimum 44x44px touch targets
- Stack layouts on mobile, grid on desktop
- Hamburger menu for header navigation

---

## 12. Support and Contact Integration

### 12.1 Phone Support
- **Number**: 520-759-5200
- **Display**: Visible in header (desktop), footer, and pricing section
- **Purpose**: Personal touch for a family product; builds trust

### 12.2 Support Domain
- **URL**: support.familialmedia.com
- **Purpose**: Dedicated support portal

---

## 13. Mobile App Onboarding Flow Recommendation

1. Welcome screen with logo and tagline
2. "Create Account" with email/password
3. "Create Your First Circle" with name input
4. "Invite Family" with share sheet or email input
5. "Start Sharing" with camera/gallery prompt

---

## Appendix: Complete Design Token Reference

```css
:root {
  --background: 0 0% 100%;
  --foreground: 0 0% 8%;
  --primary: 0 0% 8%;
  --primary-foreground: 0 0% 100%;
  --secondary: 0 0% 96%;
  --muted: 0 0% 96%;
  --muted-foreground: 0 0% 45%;
  --border: 0 0% 90%;
  --radius: 0.75rem;
  --font-serif: 'Playfair Display', Georgia, serif;
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}
```

---

**Document Prepared For**: MANUS AI Agent Development
**Application**: Familial - Private Family Social Network
**Date**: February 6, 2026
**Version**: 1.0
