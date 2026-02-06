
# Product Development Report (PDR) for Familial Mobile Application
## For Development with MANUS AI Agent

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

## 6. Development Approach Options

### 6.1 Option A: Capacitor (Recommended)

**Approach**: Wrap existing React app in native container

**Pros**:
- Reuse 100% of existing React codebase
- Faster development timeline
- Single codebase for web + mobile
- Native plugin access for camera, notifications, etc.

**Cons**:
- Slightly less native feel than pure native
- WebView performance limitations for complex animations

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

### 6.2 Option B: Progressive Web App (PWA)

**Approach**: Enhance web app for installability

**Pros**:
- No app store submission
- Instant updates
- Single codebase

**Cons**:
- Limited native feature access (especially iOS)
- No push notifications on iOS
- Less discoverable than native apps

### 6.3 Option C: React Native Rebuild

**Approach**: Rebuild UI layer in React Native

**Pros**:
- True native UI components
- Better performance for complex UIs
- Access to all native APIs

**Cons**:
- Significant development effort
- Duplicate UI code maintenance
- Longer timeline

---

## 7. Recommended Implementation Plan (Capacitor)

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
1. **Capacitor Configuration**
   - Initialize project with correct app ID
   - Configure iOS and Android platforms
   - Set up live reload for development

2. **Native Plugin Integration**
   - Camera plugin for photo capture
   - Push notifications setup
   - Share sheet integration
   - Biometric authentication

3. **Code Modifications**
   - Add native camera capture to file upload flows
   - Implement push notification handling
   - Add deep link routing
   - Haptic feedback on interactions

4. **Build Configuration**
   - iOS Xcode project setup
   - Android Gradle configuration
   - App signing setup
   - Icon and splash screen generation

### 10.2 Information for MANUS

**Existing URLs**:
- Preview: `https://id-preview--f7454400-93af-4f43-90a6-0d52ff08c778.lovable.app`
- Production: `https://familialapp.lovable.app`

**Backend API**:
- Supabase Project ID: `qxkwxolssapayqyfdwqc`
- API URL: Available via environment variable `VITE_SUPABASE_URL`

**Configured Secrets**:
- `RESEND_API_KEY` - For email sending

---

## 11. Success Metrics

| Metric | Target |
|--------|--------|
| App Store Rating | 4.5+ stars |
| Crash-free Sessions | 99.5%+ |
| App Launch Time | < 2 seconds |
| Push Notification Opt-in | 70%+ |
| Daily Active Users | Track baseline and growth |
| Photo Upload Success Rate | 99%+ |

---

## 12. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| iOS review rejection | Medium | High | Follow HIG, proper permissions |
| Push notification issues | Medium | Medium | Thorough testing, fallback to in-app |
| Performance on older devices | Low | Medium | Test on min supported devices |
| Data sync conflicts | Low | High | Implement conflict resolution |
| Storage limitations | Low | Medium | Image compression, cleanup |

---

## 13. Appendix

### 13.1 File Structure Summary
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

### 13.2 Environment Variables
```text
VITE_SUPABASE_URL         # Supabase API URL
VITE_SUPABASE_PUBLISHABLE_KEY  # Supabase anon key
VITE_SUPABASE_PROJECT_ID  # Project identifier
RESEND_API_KEY            # Email service (edge function)
```

---

**Document Prepared For**: MANUS AI Agent Development
**Application**: Familial - Private Family Social Network
**Date**: February 6, 2026
**Version**: 1.0
