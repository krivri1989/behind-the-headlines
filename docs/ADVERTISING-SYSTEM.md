# Advertising System — Living Specification

> This document is the source of truth for the advertising system on the Behind The Headlines news portal. Update it whenever a requirement, slot, ad type, or integration point changes. It is referenced during implementation and future modifications.

---

## 1. Overview

The portal supports a full advertising system with admin-managed ad units. Ads appear on the homepage, category pages, article pages, and as full-screen interstitials. Admins manage everything from a new **Advertisements** dashboard page.

### Goals

- Support multiple ad types: direct uploads, third-party tags, YouTube, VAST-lite video, 1x1 trackers
- Per-page / per-category / site-wide (ALL) targeting with ALL as a fallback
- "Advertisement" label on every visible ad slot
- Third-party impression/click tracking pixels with cache-busting
- Interstitial overlay (once per session)
- Sponsored article pin-to-top (RSS imports must not replace pinned content)
- Admin-only management (editors cannot access)

---

## 2. Ad Types

| Type | Admin input | Rendering | Use case |
|---|---|---|---|
| **Direct creative** | Upload image/GIF/MP4 to RustFS OR paste URL | `<img>` / `<video>` tag | Self-hosted ads |
| **Third-party tag** | Paste raw JS/HTML (DoubleClick, Flashtalking, etc.) | Sandboxed `<iframe srcDoc>` | Ad network tags from agencies |
| **YouTube video** | Paste YouTube URL | YouTube iframe (autoplay, muted, unmute button, auto-thumbnail) | Brand video ads |
| **VAST-lite video** | Paste VAST URL | Server fetches VAST XML → extracts media URL → plays in `<video>` | Google Ad Manager video ads |
| **1x1 tracker** | Paste impression pixel URL + click URL | Hidden 1x1 pixel, no visible ad | Verification (DoubleVerify), third-party counting |

### Notes on each type

#### Direct creative
- Admin uploads file (image/GIF/MP4) to RustFS via `/api/ads/upload`, OR pastes an external URL
- `clickUrl` is the landing page URL (where the user goes when they click)
- Optional `impressionPixelUrl` and `clickTrackingUrl` for third-party tracking

#### Third-party tag
- Admin pastes raw JavaScript/HTML (e.g., DoubleClick `document.write(...)` tags)
- Rendered in a sandboxed iframe: `sandbox="allow-scripts"` (no `allow-same-origin`, no `allow-top-navigation`)
- Cache-busting macros are auto-replaced server-side before rendering:
  - `[timestamp]` → `Date.now() + Math.random()`
  - `[CACHEBUSTER]` → `Date.now() + Math.random()`
  - `ord=[timestamp]` → `ord={random}`

#### YouTube video
- Admin pastes a YouTube URL (e.g., `https://www.youtube.com/watch?v=ZNretJtmTZA`)
- System auto-extracts the video ID
- Thumbnail auto-fetched from `img.youtube.com/vi/{id}/maxresdefault.jpg`
- Renders as YouTube iframe with `autoplay=1&mute=1` params
- Unmute button overlay toggles `mute=0/1`

#### VAST-lite video
- Admin pastes a VAST URL (e.g., `https://pubads.g.doubleclick.net/gampad/ads?...&output=vast&...`)
- Server fetches the VAST XML, parses the first `<MediaFile>` tag, returns the media URL
- Client plays the media URL in a standard `<video>` tag
- **Limitations:** Does not support VPAID (interactive video ads), companion ads, or VAST tracking events. Full IMA SDK support can be added later if needed.

#### 1x1 tracker
- No visible creative — just a hidden 1x1 pixel that fires on page load
- Used for third-party verification (DoubleVerify) and impression counting
- Admin enters: impression pixel URL + optional click tracking URL

---

## 3. Ad Sizes

### Web (Desktop)

| Size | Formats | Use |
|---|---|---|
| 300x250 | static + GIF + MP4 | Standard rectangle |
| 300x600 | static + GIF + MP4 | Half-page |
| 728x90 | static + GIF + MP4 | Leaderboard |
| 1x1 | tracker | Verification/counting |
| video | YouTube / VAST | Video ad |

### Mobile

| Size | Formats | Use |
|---|---|---|
| 300x250 | static + GIF + MP4 | Standard rectangle |
| 300x600 | static + GIF + MP4 | Half-page |
| 728x90 | static + GIF + MP4 | Leaderboard |
| 320x480 | static + GIF + MP4 | Interstitial (mobile) |
| 1x1 | tracker | Verification/counting |
| video | YouTube / VAST | Video ad |

---

## 4. Ad Slot Naming Convention

### Format

```
{page}_{position}
```

### Pages

```
homepage    → Homepage
category    → Any category page (/category/{slug})
article     → Any article page (/article/{slug})
all         → Site-wide (ALL fallback)
```

### Positions

```
tri_col_top       → Top of 3rd column (homepage 3-col section)
sidebar_top       → Top of sidebar
category_top      → Above category news section (homepage)
above_breadcrumb  → Above breadcrumb (category/article pages)
related_stories   → In Related Stories sidebar (article page)
interstitial_web  → Full-screen overlay (desktop)
interstitial_mobile → Full-screen overlay (mobile)
video             → Video ad unit (configurable placement)
```

### Complete slot list

| Slot name | Page | Position | Default size | Description |
|---|---|---|---|---|
| `homepage_tri_col_top` | Homepage | 3rd col top | 300x250 | Top of JJD Special column |
| `homepage_sidebar_top` | Homepage | Sidebar top | 300x250 / 300x600 | Top of trending sidebar |
| `homepage_category_top` | Homepage | Above each category section | 728x90 | Above National, Sports, etc. |
| `category_above_breadcrumb` | Category page | Above breadcrumb | 728x90 | /category/{slug} |
| `article_above_breadcrumb` | Article page | Above breadcrumb | 728x90 | /article/{slug} |
| `article_related_stories` | Article page | Related Stories sidebar | 300x250 | In sidebar |
| `interstitial_web` | All pages | Overlay (desktop) | TBD | Once per session |
| `interstitial_mobile` | All pages | Overlay (mobile) | 320x480 | Once per session |
| `video_ad` | Configurable | Configurable slot | video | YouTube/VAST video ad |

### Naming rules

- Slot names are lowercase, snake_case
- Each slot maps to exactly one position on one page type
- The admin UI shows human-readable names (e.g., "Homepage — 3rd Column Top") but stores the machine name
- New slots can be added by updating this table and the slot enum in the model

---

## 5. Scope / Targeting (with ALL fallback)

### Scope values

```
scope: "all"       → Fills any matching-size slot site-wide (fallback)
scope: "homepage"  → Only homepage slots
scope: "category"  → Only specific category (categorySlug field required)
scope: "article"   → Only article pages (optional: categorySlug to target a specific category's articles)
```

### Resolution priority

When resolving which ad to show for a given slot:

1. **Category-specific** (scope=category, categorySlug matches, active, within date range) — highest priority
2. **Page-specific** (scope=homepage or scope=article, matching the current page type)
3. **ALL fallback** (scope=all, matching size) — lowest priority
4. Return `null` if nothing matches

If multiple ads match at the same priority level, the one with the highest `priority` field wins.

### Example

- Admin creates a 300x250 ad with scope=all → it appears in every 300x250 slot across the site
- Admin creates a 300x250 ad with scope=category, categorySlug=national → it overrides the ALL ad only in the National category's slots
- Admin creates a 728x90 ad with scope=homepage → it fills all 728x90 slots on the homepage only

---

## 6. Ad Placement Map (where ads appear)

### Homepage

```
┌─────────────────────────────────────────────────────────────┐
│ [BREAKING TICKER]                                            │
├──────────────────┬──────────────────┬───────────────────────┤
│ Col 1: Latest    │ Col 2: Trending  │ Col 3: JJD Special    │
│ by Category      │                  │ ┌───────────────────┐ │
│                  │                  │ │ [300x250 AD]      │ ← homepage_tri_col_top
│                  │                  │ │ Advertisement     │ │
│                  │                  │ └───────────────────┘ │
│                  │                  │ [article list]        │
└──────────────────┴──────────────────┴───────────────────────┘

┌──────────────────────────────┬──────────────────────────────┐
│ Main column                  │ Sidebar                      │
│                              │ ┌──────────────────────────┐ │
│ ┌──────────────────────────┐ │ │ [300x250/600 AD]        │ ← homepage_sidebar_top
│ │ [728x90 AD]              │ │ │ Advertisement           │ │
│ │ Advertisement            │ │ └──────────────────────────┘ │
│ └──────────────────────────┘ │ [Trending list]              │
│ [NATIONAL section]           │ [Latest Updates]             │
│   [sponsored pin-to-top]     │                              │
│   [1 big + 5 compact]        │                              │
│                              │                              │
│ ┌──────────────────────────┐ │                              │
│ │ [728x90 AD]              │ │                              │
│ │ Advertisement            │ │                              │
│ └──────────────────────────┘ │                              │
│ [SPORTS section]             │                              │
│   [sponsored pin-to-top]     │                              │
│   [1 big + 5 compact]        │                              │
│ ...                          │                              │
└──────────────────────────────┴──────────────────────────────┘
```

- **300x250 at 3rd col top:** `homepage_tri_col_top`
- **300x250/600 at sidebar top:** `homepage_sidebar_top`
- **728x90 above each category section:** `homepage_category_top` (with `categorySlug` for targeting)

### Category page (/category/{slug})

```
┌─────────────────────────────────────────────────────────────┐
│ ┌──────────────────────────┐                                │
│ │ [728x90 AD]              │ ← category_above_breadcrumb    │
│ │ Advertisement            │                                │
│ └──────────────────────────┘                                │
│ [breadcrumb: Home / National]                               │
│ [Category header]                                           │
│ [sponsored pin-to-top]                                      │
│ [lead article]                                              │
│ [article grid]                                              │
│ [pagination]                                                │
└─────────────────────────────────────────────────────────────┘
```

### Article page (/article/{slug})

```
┌──────────────────────────────┬──────────────────────────────┐
│ ┌──────────────────────────┐ │                              │
│ │ [728x90 AD]              │ ← article_above_breadcrumb    │
│ │ Advertisement            │ │                              │
│ └──────────────────────────┘ │                              │
│ [breadcrumb: Home / Cat]     │ ┌──────────────────────────┐ │
│ [Article body]               │ │ [300x250 AD]            │ ← article_related_stories
│ [Article nav]                │ │ Advertisement           │ │
│ [Comments]                   │ └──────────────────────────┘ │
│                              │ [Related Stories list]       │
└──────────────────────────────┴──────────────────────────────┘
```

### Interstitial (all pages, once per session)

```
┌─────────────────────────────────────────────────────────────┐
│ [semi-transparent overlay]                                  │
│        ┌─────────────────────────┐                          │
│        │ [X close]               │                          │
│        │ [Interstitial AD]      │                          │
│        │ Advertisement           │                          │
│        └─────────────────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

- Desktop: TBD
- Mobile: 320x480
- Shows once per browser session (sessionStorage flag)
- Close button (X) in top-right
- Not shown to crawlers (UA detection)

---

## 7. Sponsored Article — PIN TO TOP

### What it is

Admins can pin content to the top of a category's article list. This pinned content stays at the top regardless of new RSS imports. RSS imports create new articles with normal `publishedAt` sorting, so they naturally appear below the pinned sponsored content.

### Two types

| Type | Description |
|---|---|
| **article_pin** | A real published article (editorial or manually created) is pinned to the top of a category. Shown with a "Sponsored" badge. |
| **ad_card** | A sponsored ad card (not a real article) that links to an external URL or internal page. Looks like an article card but labeled "Sponsored". |

### Admin form fields

**For both types:**
- Category (which category to pin to)
- Label (default "Sponsored")
- Active toggle
- Priority (if multiple sponsored items in the same category)

**For article_pin:**
- Article selector (search published articles by title)

**For ad_card:**
- Title
- Image upload (to RustFS) or image URL
- Click URL (external or internal)
- Description (optional)

### Rendering

- Rendered as the first item(s) in the category's article list (homepage category sections + category page)
- Styled like an article card but with a "Sponsored" badge/label
- For article_pin: uses the ArticleCard component with a Sponsored badge overlay
- For ad_card: custom card with image, title, "Sponsored" label, links to clickUrl

---

## 8. Tracking & Cache-Busting

### Third-party impression pixels

- Each ad can have an optional `impressionPixelUrl`
- When the ad renders, a hidden 1x1 `<img>` with `display:none` is added to the page
- The pixel URL has cache-busting macros replaced:
  - `[timestamp]` → `Date.now() + Math.random()`
  - `[CACHEBUSTER]` → `Date.now() + Math.random()`
  - `ord=[timestamp]` → `ord={random}`

### Third-party click tracking

- Each ad can have an optional `clickTrackingUrl`
- When a user clicks an ad, the click is first sent to `/api/ads/track` (server-side)
- The server fires the `clickTrackingUrl` (with cache-busting) and then redirects to the `clickUrl`
- This ensures the click is tracked by the third-party server before the user lands on the advertiser's page

### Internal counters

- `impressions` and `clicks` fields on the Advertisement model
- Incremented via `/api/ads/track` (best-effort, non-blocking)
- Visible in the admin dashboard

### Cache-busting macro replacement

The following macros are replaced server-side at render time:

| Macro | Replaced with |
|---|---|
| `[timestamp]` | `Date.now() + Math.random()` |
| `[CACHEBUSTER]` | `Date.now() + Math.random()` |
| `ord=[timestamp]` | `ord={random}` |
| `${GDPR}` | Left as-is (for India-targeted ads, typically ignored) |
| `${GDPR_CONSENT_*}` | Left as-is |

---

## 9. Database Models

### `Advertisement` model

```typescript
{
  name: string;              // Admin label, e.g., "Homepage 300x250 — Otrivin July 26"
  slot: string;              // Slot name (see Section 4)
  size: string;              // "300x250" | "300x600" | "728x90" | "320x480" | "1x1" | "video"
  type: string;              // "direct" | "third_party" | "youtube" | "vast" | "tracker"

  // For type=direct
  mediaUrl?: string;         // RustFS URL or external URL (image/gif/mp4)
  clickUrl?: string;         // Landing page URL

  // For type=third_party
  rawTag?: string;           // Raw JS/HTML string

  // For type=youtube
  youtubeUrl?: string;
  youtubeId?: string;        // Auto-extracted from youtubeUrl

  // For type=vast
  vastUrl?: string;

  // Optional for all types
  impressionPixelUrl?: string;  // 1x1 tracking pixel URL
  clickTrackingUrl?: string;    // Click tracking URL (fires before redirect to clickUrl)

  // Targeting
  scope: string;             // "all" | "homepage" | "category" | "article"
  categorySlug?: string;     // When scope=category or article

  // Scheduling & status
  active: boolean;
  startDate?: Date;
  endDate?: Date;
  priority: number;          // Higher = preferred when multiple ads match a slot

  // Internal counters
  impressions: number;
  clicks: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:**
- `{ slot: 1, scope: 1, categorySlug: 1, active: 1, startDate: 1, endDate: 1 }`
- `{ active: 1, startDate: 1, endDate: 1 }`

### `SponsoredContent` model

```typescript
{
  type: string;              // "article_pin" | "ad_card"
  categorySlug: string;      // Which category to pin to

  // For type=article_pin
  articleId?: ObjectId;      // References Article

  // For type=ad_card
  title?: string;
  imageUrl?: string;
  clickUrl?: string;
  description?: string;

  // Common
  label: string;             // Default "Sponsored"
  active: boolean;
  priority: number;

  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:**
- `{ categorySlug: 1, active: 1, priority: -1 }`

---

## 10. API Routes

### Admin-only (requireAdmin)

| Route | Method | Purpose |
|---|---|---|
| `/api/ads` | GET | List all ads (with filters) |
| `/api/ads` | POST | Create ad |
| `/api/ads/[id]` | PUT | Update ad |
| `/api/ads/[id]` | DELETE | Delete ad |
| `/api/ads/upload` | POST | Upload ad creative (image/gif/mp4) to RustFS |
| `/api/sponsored` | GET | List all sponsored content |
| `/api/sponsored` | POST | Create sponsored content |
| `/api/sponsored/[id]` | PUT | Update sponsored content |
| `/api/sponsored/[id]` | DELETE | Delete sponsored content |

### Public (no auth)

| Route | Method | Purpose |
|---|---|---|
| `/api/ads/public` | GET | Resolve ads for given slots + context. Params: `slots` (comma-sep), `categorySlug`, `page` |
| `/api/ads/track` | POST | Increment impression/click counter. Body: `{ adId, type: "impression"\|"click" }` |
| `/api/ads/vast` | GET | Fetch VAST XML and return extracted media URL. Param: `url` |
| `/api/sponsored/public` | GET | Get sponsored content for a category. Param: `categorySlug` |

---

## 11. Components

### `src/components/ad-slot.tsx` (server component)

- Props: `slot`, `categorySlug?`, `context?`
- Fetches resolved ad from `public-data.ts`
- Renders "Advertisement" label above creative
- By type:
  - `direct` image/gif → `<a href={clickUrl}><img src={mediaUrl} /></a>` + impression pixel
  - `direct` mp4 → `<video src={mediaUrl} autoplay muted loop />` + impression pixel
  - `third_party` → sandboxed `<iframe srcDoc={cacheBustedTag} sandbox="allow-scripts" />`
  - `youtube` → `<VideoAd youtubeId={...} />`
  - `vast` → fetch media URL via `/api/ads/vast`, render `<video>`
  - `tracker` → hidden 1x1 pixel only (no visible ad, no "Advertisement" label)
- Fires impression pixel (if set) via `<img>` with cache-busted URL
- Click tracking: wraps clickUrl with `/api/ads/track` redirect

### `src/components/interstitial-ad.tsx` (client component)

- Shows once per session (`sessionStorage` flag)
- Detects mobile vs desktop (window width < 768px = mobile)
- Renders full-screen overlay with close button
- Contains the ad creative inside
- Doesn't render for crawlers (UA check)
- Close button sets sessionStorage flag and hides overlay

### `src/components/video-ad.tsx` (client component)

- YouTube iframe with `autoplay=1&mute=1` params
- Unmute button overlay (toggles `mute=0/1`)
- Thumbnail auto-fetched from `img.youtube.com/vi/{id}/maxresdefault.jpg` (shown before play)
- For VAST-lite: plays media URL in `<video>` tag with controls

### `src/components/sponsored-card.tsx`

- For `article_pin`: renders the pinned ArticleCard with "Sponsored" badge
- For `ad_card`: renders a card with image, title, "Sponsored" label, links to clickUrl

---

## 12. Dashboard — Advertisements Page

**File: `src/app/dashboard/advertisements/page.tsx`**

- Admin-only (wrapped in `AdminGuard`)
- Two tabs: **Ad Units** and **Sponsored Content**

### Ad Units tab

**Table columns:**
- Name
- Slot (human-readable)
- Size
- Type
- Scope (ALL / Homepage / Category / Article)
- Category (if scope=category)
- Status (Active + within date range)
- Impressions
- Clicks
- Actions (Edit, Delete)

**Create/Edit form fields:**
- Name (text)
- Slot (dropdown — see Section 4)
- Size (dropdown — filtered by slot)
- Type (dropdown — direct / third_party / youtube / vast / tracker)

**Conditional fields by type:**
- **If type=direct:**
  - Upload file (image/gif/mp4 → RustFS via `/api/ads/upload`) OR paste media URL
  - Click URL (landing page)
- **If type=third_party:**
  - Textarea for raw JS/HTML tag
- **If type=youtube:**
  - YouTube URL input (auto-extract ID, show thumbnail preview)
- **If type=vast:**
  - VAST URL input
- **If type=tracker:**
  - Impression pixel URL
  - Click tracking URL

**Optional for all types:**
- Impression pixel URL (1x1 tracking)
- Click tracking URL

**Targeting:**
- Scope (ALL / Homepage / Category / Article)
- Category dropdown (if scope=category or article)

**Scheduling:**
- Active toggle
- Start date (datetime)
- End date (datetime)
- Priority (number)

**Live preview:** Show a preview of the ad creative in the form.

### Sponsored Content tab

**Table columns:**
- Type (Pin Article / Ad Card)
- Category
- Title / Article
- Active
- Priority
- Actions (Edit, Delete)

**Create/Edit form fields:**
- Type (Pin Article / Ad Card)
- Category dropdown
- **If type=article_pin:** Article search/selector (search published articles by title)
- **If type=ad_card:** Title, Image upload (to RustFS), Click URL, Description
- Label (default "Sponsored")
- Active toggle
- Priority (number)

---

## 13. Dashboard Sidebar

**File: `src/app/dashboard/page.tsx`**

Add to `adminNavigation`:
```javascript
{ label: "Advertisements", icon: Megaphone, href: "/dashboard/advertisements" }
```

---

## 14. CSS Styling

**File: `src/app/(public)/public.css`**

```
.ad-slot                      — container, centered, margin
.ad-slot-label                — "Advertisement" text (small, gray, centered, above creative)
.ad-slot img                  — responsive, max-width per size
.ad-slot video                — responsive, max-width per size
.ad-slot-300x250              — fixed 300x250 dimensions
.ad-slot-300x600              — fixed 300x600 dimensions
.ad-slot-728x90               — fixed 728x90 dimensions, full-width on mobile
.ad-slot-iframe               — sandboxed iframe styling (borderless)
.ad-interstitial-overlay      — fixed full-screen, semi-transparent bg, z-index high
.ad-interstitial-close        — X button top-right, cursor pointer
.ad-interstitial-content      — centered content, max-width per device
.ad-video-wrap                — 16:9 aspect ratio container for video ads
.ad-video-unmute              — unmute button overlay (bottom-right of video)
.sponsored-card               — article card style with "Sponsored" badge
.sponsored-badge              — small badge label (top corner of card)
.ad-tracker                   — display:none for 1x1 pixels
```

**Mobile responsive:**
- 728x90 → full-width with auto height on mobile
- Desktop interstitial → 320x480 on mobile
- 300x600 → 300x250 fallback on small screens (optional)

---

## 15. Files to Modify

| File | Changes |
|---|---|
| `src/lib/models.ts` | Add `Advertisement` + `SponsoredContent` models with indexes |
| `src/lib/data.ts` | Add CRUD functions for ads + sponsored content |
| `src/lib/public-data.ts` | Add ad resolution, VAST fetch, cache-busting, sponsored fetch, Redis caching |
| `src/app/(public)/page.tsx` | Insert ad slots (3rd col top, sidebar top, above each category section) + sponsored cards |
| `src/app/(public)/category/[slug]/page.tsx` | Insert 728x90 above breadcrumb + sponsored pin-to-top |
| `src/app/(public)/article/[slug]/page.tsx` | Insert 728x90 above breadcrumb + pass sidebar ad to ArticleReader |
| `src/app/(public)/layout.tsx` | Render interstitial ad |
| `src/components/article-reader.tsx` | Insert 300x250 in Related Stories sidebar |
| `src/app/dashboard/page.tsx` | Add "Advertisements" nav item |
| `src/app/(public)/public.css` | Add all ad styling + mobile responsive rules |

## 16. New Files

| File | Purpose |
|---|---|
| `src/components/ad-slot.tsx` | Server component for rendering ad units |
| `src/components/interstitial-ad.tsx` | Client component for interstitial overlay |
| `src/components/video-ad.tsx` | Client component for YouTube/VAST video ad |
| `src/components/sponsored-card.tsx` | Sponsored article/ad card |
| `src/app/dashboard/advertisements/page.tsx` | Admin ad management page |
| `src/app/api/ads/route.ts` | Admin ad CRUD (GET, POST) |
| `src/app/api/ads/[id]/route.ts` | Admin ad (PUT, DELETE) |
| `src/app/api/ads/public/route.ts` | Public ad resolution (GET) |
| `src/app/api/ads/upload/route.ts` | Admin ad creative upload to RustFS |
| `src/app/api/ads/track/route.ts` | Public impression/click tracking |
| `src/app/api/ads/vast/route.ts` | Public VAST XML fetcher |
| `src/app/api/sponsored/route.ts` | Admin sponsored CRUD (GET, POST) |
| `src/app/api/sponsored/[id]/route.ts` | Admin sponsored (PUT, DELETE) |
| `src/app/api/sponsored/public/route.ts` | Public sponsored fetch |

---

## 17. Verification Checklist

Before considering the ads system complete, verify:

- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` succeeds
- [ ] Admin creates a direct-upload 300x250 ad (scope=all) → appears in homepage 3rd col top + sidebar + article sidebar
- [ ] Admin creates a third-party JS tag ad (DoubleClick style) → renders in sandboxed iframe with cache-busting applied
- [ ] Admin creates a YouTube video ad → autoplays muted, unmute button works, thumbnail shows
- [ ] Admin creates a VAST-lite video ad → server fetches VAST XML, media URL extracted, plays in `<video>`
- [ ] Admin creates a 1x1 tracker ad → hidden pixel fires on page load
- [ ] Admin creates a category-specific 728x90 (scope=category, categorySlug=national) → appears above National section on homepage + above breadcrumb on /category/national
- [ ] ALL-scope ad fills slots without specific ads
- [ ] Impression pixel fires with `[timestamp]` replaced by random number
- [ ] Click tracking fires on ad click (redirects through `/api/ads/track`)
- [ ] Interstitial shows once per session, close button works, correct size on mobile/desktop
- [ ] Sponsored article pinned to top of category, RSS imports don't replace it
- [ ] "Advertisement" label shows on every visible ad slot
- [ ] Editors cannot access Advertisements page or ad APIs (AdminGuard + requireAdmin)
- [ ] Mobile responsive: 320x480 interstitial on mobile
- [ ] Ad creative upload accepts image (jpeg/png/webp/gif/avif) + video (mp4)
- [ ] Date scheduling works (ad only shows between startDate and endDate)
- [ ] Priority works (higher priority ad wins when multiple match a slot)

---

## 18. Risks & Considerations

### Security

- **Third-party tags:** Raw JS/HTML tags render in a sandboxed iframe (`sandbox="allow-scripts"` — no `allow-same-origin`, no `allow-top-navigation`). This prevents the ad script from accessing the parent page's cookies, DOM, or redirecting the user. Click-throughs are handled via the click tag, not top-level navigation from the iframe.
- **Click URLs:** Validated to be HTTPS only. No `javascript:` URLs allowed.
- **YouTube URLs:** Sanitized to extract only the video ID. No extra params passed through.
- **Ad APIs:** All admin routes use `requireAdmin()`. Public routes return only active ads with minimal fields (no admin metadata).

### Performance

- All ad resolutions are batch-fetched server-side with Redis caching (60s TTL)
- Third-party tags render in iframes (async, don't block page load)
- Impression pixels fire asynchronously (don't block rendering)
- VAST XML is fetched server-side (avoids CORS issues + client-side latency)

### VAST-lite limitations

- Server-side VAST fetch only extracts the first `<MediaFile>` URL
- Does not support VPAID (interactive video ads), companion ads, or VAST tracking events
- Full IMA SDK support can be added later if needed

### GDPR macros

- `${GDPR}`, `${GDPR_CONSENT_*}` are left as-is (not replaced)
- For India-targeted ads, these are typically ignored by the ad server
- If EU targeting is added later, these macros will need to be replaced with consent values from the cookie consent banner

### Sponsored pin vs RSS

- Sponsored content is a separate `SponsoredContent` record rendered before the article list
- RSS imports create articles with normal `publishedAt` sorting — they naturally appear below the pinned sponsored content
- The pin is not a sort field on the Article model, so RSS imports cannot override it

### CSP (Content Security Policy)

- When ads go live, CSP will need to allow third-party domains:
  - `doubleclick.net`, `googlesyndication.com` (Google ads)
  - `flashtalking.com` (tracking)
  - `doubleverify.com` (verification)
  - `youtube.com`, `ytimg.com` (YouTube embeds)
  - `pubads.g.doubleclick.net` (VAST)
- CSP is not currently configured — this is a follow-up task

### Interstitial frequency

- Once per browser session via `sessionStorage`
- Not shown to crawlers (detected via User-Agent) to avoid SEO issues
- Can be configured to show once per N hours if needed (future enhancement)

---

## 19. Future Enhancements (out of scope for initial build)

- **Google IMA SDK:** Full VPAID/VAST support with interactive video ads
- **Ad rotation:** Rotate multiple ads in the same slot (weighted random)
- **Frequency capping:** Limit how many times a user sees an ad per day/week
- **Geo-targeting:** Show ads only to users in specific regions
- **Device targeting:** Show different ads on mobile vs desktop
- **A/B testing:** Test multiple ad creatives in the same slot
- **Ad reports/export:** Export impression/click reports as CSV
- **Direct ad server integration:** Google Ad Manager (GAM), Xandr, etc.
- **Consent management:** Replace GDPR macros with values from the cookie consent banner
- **Lazy-loading:** Load ads only when they enter the viewport (Intersection Observer)
- **Ad blocker detection:** Show a message to ad blocker users
