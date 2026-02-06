

# Marketing Design Report (MDR) for Familial Mobile Application
## Visual Identity, Brand Voice, and Feature Messaging Guide for MANUS AI

---

## Executive Summary

This document provides the complete marketing and design specifications for the Familial mobile application. It covers the visual identity system, typography, color scheme, brand voice, feature messaging, and UI component patterns. This guide ensures visual and messaging consistency when MANUS AI develops the mobile application.

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

```text
+-------------------+------------------+-------------------------+
| Font Family       | Usage            | Emotional Purpose       |
+-------------------+------------------+-------------------------+
| Playfair Display  | Headings (h1-h6) | Elegance, legacy,       |
|                   | Feature titles   | "storybook" feel        |
|                   | Pricing names    |                         |
+-------------------+------------------+-------------------------+
| Inter             | Body text        | Modern, readable,       |
|                   | Buttons          | professional            |
|                   | Navigation       |                         |
|                   | Descriptions     |                         |
+-------------------+------------------+-------------------------+
```

### 2.2 Font Loading
Fonts are loaded via Google Fonts:
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

```text
+----------------------+----------------+---------------------------+
| Token                | HSL Value      | Usage                     |
+----------------------+----------------+---------------------------+
| --background         | 0 0% 100%      | Page background (white)   |
| --foreground         | 0 0% 8%        | Primary text (near-black) |
| --primary            | 0 0% 8%        | Buttons, links, icons     |
| --primary-foreground | 0 0% 100%      | Text on primary buttons   |
| --secondary          | 0 0% 96%       | Card backgrounds, badges  |
| --secondary-foreground| 0 0% 8%       | Text on secondary         |
| --muted              | 0 0% 96%       | Disabled states           |
| --muted-foreground   | 0 0% 45%       | Subtle text (gray)        |
| --border             | 0 0% 90%       | Borders, dividers         |
| --card               | 0 0% 100%      | Card surfaces             |
| --destructive        | 0 72% 51%      | Error states (red)        |
+----------------------+----------------+---------------------------+
```

### 3.3 Dark Mode Palette

```text
+----------------------+----------------+---------------------------+
| Token                | HSL Value      | Usage                     |
+----------------------+----------------+---------------------------+
| --background         | 0 0% 4%        | Page background (dark)    |
| --foreground         | 0 0% 98%       | Primary text (near-white) |
| --primary            | 0 0% 98%       | Buttons, links, icons     |
| --primary-foreground | 0 0% 4%        | Text on primary buttons   |
| --secondary          | 0 0% 15%       | Card backgrounds          |
| --muted-foreground   | 0 0% 65%       | Subtle text (gray)        |
| --border             | 0 0% 18%       | Borders, dividers         |
+----------------------+----------------+---------------------------+
```

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

```text
+----------------+----------------------------+----------------------+
| Variant        | Style                      | Usage                |
+----------------+----------------------------+----------------------+
| default        | Black bg, white text       | Primary actions      |
| hero           | Black bg, shadow, lift     | CTA buttons          |
| hero-outline   | Border, transparent bg     | Secondary CTA        |
| outline        | Border only                | Less emphasis        |
| ghost          | No border, hover bg        | Navigation items     |
| secondary      | Gray bg                    | Tertiary actions     |
| destructive    | Red bg                     | Danger actions       |
+----------------+----------------------------+----------------------+
```

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
| Circles | Create Your Circles | Organize connections into meaningful groups — Immediate Family, College Friends, Work Crew. Share exactly what you want, with exactly who you want. | Solves the "one-size-fits-all" problem of mainstream social media. Families can have multiple contexts. |
| Feed | Algorithm-Free Feed | See every post from your circles, in chronological order. No hidden content, no suggested posts, no viral distractions. | Eliminates the frustration of missing important family updates because an algorithm hid them. |
| Privacy | True Privacy | Your family photos stay with your family. No data harvesting, no AI training, no advertisers. Your memories belong to you. | Addresses growing concern about children's photos being used to train AI models. |
| Albums | Living Scrapbook | Every photo, video, and milestone is archived in a beautiful timeline. Create a digital family album that grows with you. | Replaces scattered photos across devices with one unified family archive. |
| Events | Event Coordination | Built-in calendar for birthdays, reunions, and gatherings. Never miss a celebration, and keep all the planning in one place. | Eliminates the chaos of planning via group text threads. |
| Messaging | Threaded Conversations | Comments and reactions that stay organized. Unlike chaotic group chats, every conversation stays connected to its context. | Photos and discussions stay linked, making it easy to find memories later. |

### 7.2 How It Works Messaging

| Step | Title | Description |
|------|-------|-------------|
| 01 | Create Your Account | Sign up in seconds with just your email. No phone number required, no invasive permissions. |
| 02 | Build Your Circles | Invite your family and friends. Create circles for different groups — grandparents, siblings, childhood friends. |
| 03 | Start Sharing | Post photos, updates, and memories. Choose exactly which circles see each post. Watch your family story grow. |

### 7.3 Trust Indicators (Hero Section)
- **100% Ad-Free** — Communicates revenue model isn't based on attention harvesting
- **End-to-End Privacy** — Technical assurance of data protection
- **Family-First Design** — UX priority on accessibility for all ages

---

## 8. Pricing Structure

### 8.1 Tier Overview

```text
+-------------+--------+--------+------------------------------------+
| Tier        | Price  | Users  | Key Features                       |
+-------------+--------+--------+------------------------------------+
| Free        | $0     | 8      | 1 circle, unlimited posts/photos   |
| Family      | $5/mo  | 20     | 2 circles, events, albums          |
| Extended    | $10/mo | 50     | 3 circles, family tree, messaging  |
+-------------+--------+--------+------------------------------------+
```

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

## 9. Testimonial Strategy

### 9.1 Testimonial Personas

| Persona | Quote Focus | Why It Works |
|---------|-------------|--------------|
| Mother of 3 | Privacy for kids' photos | Addresses parental concern about children online |
| Expat Family Member | Staying connected across distance | Resonates with diaspora families |
| Multi-generational | Simplicity for elderly | Overcomes "my parents won't use it" objection |

### 9.2 Testimonial Format
- 5-star rating (visual credibility)
- First-person quote in quotation marks
- Avatar initials (builds trust without requiring real photos)
- Role/context descriptor (relatable situation)

---

## 10. Voice and Tone Guidelines

### 10.1 Brand Voice Characteristics

```text
+------------------+----------------------------+----------------------------------+
| Characteristic   | Do This                    | Avoid This                       |
+------------------+----------------------------+----------------------------------+
| Warm             | "The people who matter"    | "Your network connections"       |
| Clear            | "No ads, ever."            | "Ad-free experience options"     |
| Confident        | "Your memories belong to   | "We try our best to protect..."  |
|                  | you."                      |                                  |
| Inclusive        | "Simple enough for         | "Easy for non-technical users"   |
|                  | everyone"                  |                                  |
| Anti-Algorithm   | "Chronological order"      | "Smart feed optimization"        |
+------------------+----------------------------+----------------------------------+
```

### 10.2 Key Phrases to Use
- "Private by design"
- "The people who matter most"
- "No ads. No algorithms. Ever."
- "Where family actually connects"
- "Your family story"
- "Simple enough for grandparents"

### 10.3 Phrases to Avoid
- "Social network" (use "private family space" instead)
- "Users" (use "family members" or "people")
- "Content" (use "moments," "memories," or "updates")
- "Engagement" (implies metric-driven, not relationship-driven)
- "Viral" or "trending" (opposite of our value proposition)

---

## 11. Animation and Interaction Patterns

### 11.1 Entry Animations
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

### 11.2 Animation Staggering
Hero elements use `animation-delay` for cascading reveal:
- Badge: 0s
- Headline: 0.1s
- Subheadline: 0.2s
- CTA Buttons: 0.3s
- Trust Indicators: 0.4s

### 11.3 Hover Interactions
- **Buttons**: Lift effect (`hover:-translate-y-0.5`) with shadow increase
- **Cards**: Border darkens, shadow appears (`hover:shadow-lg`)
- **Links**: Color transition from muted to foreground

---

## 12. Responsive Design Breakpoints

### 12.1 Breakpoint System
| Breakpoint | Width | Primary Consideration |
|------------|-------|----------------------|
| Default | < 640px | Mobile phones (single column) |
| sm | >= 640px | Large phones |
| md | >= 768px | Tablets (2-column layouts) |
| lg | >= 1024px | Laptops (3-column layouts) |
| xl | >= 1280px | Desktops |
| 2xl | >= 1400px | Large monitors (max container) |

### 12.2 Mobile-First Priorities
- Bottom navigation for app pages (thumb zone)
- Minimum 44x44px touch targets
- Stack layouts on mobile, grid on desktop
- Hamburger menu for header navigation

---

## 13. Support and Contact Integration

### 13.1 Phone Support
- **Number**: 520-759-5200
- **Display**: Visible in header (desktop), footer, and pricing section
- **Purpose**: Personal touch for a family product; builds trust

### 13.2 Support Domain
- **URL**: support.familialmedia.com
- **Purpose**: Dedicated support portal

---

## 14. Implementation Notes for MANUS AI

### 14.1 Mobile App Considerations
1. **Fonts**: Bundle Playfair Display and Inter locally for offline support
2. **Colors**: Use the same HSL token system; detect system dark mode preference
3. **Icons**: Use Lucide icons or equivalent vector icons
4. **Animations**: Keep animations subtle (0.2-0.6s) for mobile performance
5. **Touch**: Ensure all interactive elements meet 44x44px minimum

### 14.2 App Store Marketing Assets Needed
| Asset | Specification |
|-------|---------------|
| App Icon | 1024x1024 (iOS), 512x512 (Android) |
| Feature Graphic | 1024x500 (Google Play) |
| Screenshots | 6.7", 6.5", 5.5" for iOS; phone + tablet for Android |
| App Description | Use Hero copy + Feature descriptions |
| Keywords | family, private, social, photos, events, circles |

### 14.3 Onboarding Flow Recommendation
1. Welcome screen with logo and tagline
2. "Create Account" with email/password
3. "Create Your First Circle" with name input
4. "Invite Family" with share sheet or email input
5. "Start Sharing" with camera/gallery prompt

---

## Appendix: Design Token Reference

### Complete CSS Custom Properties
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

