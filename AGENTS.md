# News Portal — Living Product Specification

This file is the source of truth for the product requirements and technical direction of this repository. Update it whenever a requirement, decision, workflow, or deployment assumption changes.

## Product Goal

Build a fast, responsive, English-language news portal using Next.js and Node.js. The portal publishes content from two sources:

1. **Licensed RSS sources** — feed items are imported automatically, including permitted content and images, then published to their configured category.
2. **Editor-authored news** — authenticated editors write and publish their own articles.

The public experience should use the information hierarchy of a major news portal: dynamic category navigation, prominent lead stories, latest-news lists, category sections, article pages, and a footer subscriber form. Do not copy another publisher's branding, code, content, or design assets.

## Confirmed Product Decisions

| Area | Decision |
| --- | --- |
| Publication name | Behind The Headlines (temporary/configurable until final brand assets are supplied) |
| Initial language | English only |
| Production platform | VPS / Docker |
| Primary database | Managed MongoDB (MongoDB Atlas recommended) |
| RSS publishing | Automatically publish after successful import and validation; each source has its own category and interval |
| RSS rights | Full content and source images may be stored and republished only for licensed/authorized sources |
| Editor publishing | Editors may immediately publish their own articles |
| Editor RSS access | Editors cannot manage RSS feeds or schedules |
| Subscriber form | Save consented email addresses in the portal database initially |
| Media storage | RustFS on the Hostinger VPS, using its S3-compatible API and persistent Docker volume |
| Category/menu management | Admin-managed and fully dynamic |
| Authentication | Email/password sign-in, email reset via Resend, and admin-initiated password resets |
| Initial administrator | Seeded only from server-side environment variables |
| Dashboard design | Light, professional CMS design |
| Content editor | Classic Word-like rich-text editor |
| Schedule timezone | Asia/Kolkata (India Standard Time) |
| Public URL pattern | `/category/article-slug` |
| Public search | Published article title, summary, and body content |
| First implementation | CMS only: complete navigable admin/editor prototype using read-only sample data and configuration placeholders; public portal follows in the next milestone |
| Demo access | Role-selection demo login for admin/editor views until real authentication is connected |
| Dummy-data behavior | Read-only sample data: actions are visual placeholders and do not alter browser or server data |
| Dummy RSS behavior | Built-in sample feeds plus optional live feed preview; no feed is saved, scheduled, imported, or published in this phase |
| Advertising | Deferred; prepare controlled placements only, do not activate ad scripts now |

## User Roles and Authorization

### Admin

Admins have complete access to:

- All articles, including publish, unpublish, edit, archive, and delete actions.
- Editor accounts: create, edit, deactivate, and delete.
- Categories, tags, header menus, footer menus, and site settings.
- RSS sources, category mapping, publishing configuration, and schedules.
- Subscriber records and future exports/integrations.
- Future advertising placement configuration.
- Import history, scheduler/job failures, and audit history.

### Editor

Editors may:

- View only the articles they authored in their dashboard.
- Create, publish, edit, unpublish, and delete only their own articles.
- Upload/select images for their own articles.
- Set article titles, summaries, content, categories, tags, featured images, and SEO fields according to editorial permissions.

Editors must not be able to view, edit, delete, or otherwise access another editor's articles, including through manually constructed URLs or API requests. Enforce ownership on the server and in database queries; hiding UI controls is not sufficient.

## Content Model

### Articles

Articles originate from either `editorial` or `rss` and should include:

- Title, URL slug, excerpt/summary, sanitized rich content.
- Status: `draft`, `published`, `unpublished`, or `archived`.
- Author, source attribution, source/canonical URL, and source-published timestamp where applicable.
- One or more categories and optional tags.
- Featured image, image alt text, caption, credit, and locally stored media URLs.
- Publication, update, and archive timestamps.
- SEO title, SEO description, canonical URL, Open Graph overrides, and structured-data fields.
- RSS metadata needed for deduplication: GUID, original URL, normalized title/content hash, source ID, and import timestamp.

### Categories and Tags

Admins manage categories dynamically. Categories should support name, slug, optional parent, description, image, display order, and visibility. Articles may have multiple categories and tags; designate a primary category for URL/display purposes if required.

### Navigation

Admins manage independent **header** and **footer** menus. A menu item can point to:

- A category or internal portal route.
- An internal article or static page.
- An approved external URL.

Admin users can add, edit, reorder, hide, and remove menu items. Menu changes must render dynamically without a redeployment.

### Subscribers

The footer displays a subscriber form. For the first release, store validated, consented email addresses in the database. Store the subscription state, consent timestamp, source page, and unsubscribe token/state. Avoid duplicates and add a privacy-policy link and consent wording.

## RSS Importing and Scheduling

### RSS Source Configuration

Only admins can create and manage RSS sources. Each source should store:

- Display name and RSS feed URL.
- Active/inactive state.
- Assigned local category.
- Interval/schedule.
- Default source/author attribution.
- Automatic-publish policy (enabled for the agreed first release).
- Last successful run, last failure, next scheduled run, and error details.

The dashboard should allow human-friendly intervals such as 15, 30, or 45 minutes; 1, 2, 3, 5, or 10 hours; and one or more days. Normalize the selected value internally to a consistent duration or cron expression.

### Worker Workflow

Use a persistent, separate background worker in Docker rather than an in-process `setInterval` inside the web server.

1. A durable scheduler identifies sources that are due.
2. It enqueues an import job for each due RSS source.
3. The worker fetches the feed with timeouts and safe retry behavior.
4. The worker parses entries and validates required data.
5. It deduplicates entries using GUID, canonical URL, and normalized title/content hash.
6. It sanitizes imported HTML before it is stored or rendered.
7. It downloads permitted featured and inline images to project-controlled object storage.
8. It generates optimized local image variants and writes local URLs to the article.
9. It creates the article under the configured category and publishes it automatically.
10. It records counts, skipped duplicates, imported article IDs, and errors in import history.

Temporary failures should retry with exponential backoff. Retries must be idempotent and must not create duplicate articles. Repeated failures should surface in the admin dashboard and trigger an operational alert once notifications are added.

## Media and Performance Requirements

- Store permitted RSS images on project-controlled storage; do not serve article imagery by repeatedly hotlinking RSS source URLs.
- Use object storage compatible with S3 (for example, S3, Cloudflare R2, or MinIO).
- Generate responsive image sizes and modern formats such as WebP or AVIF when supported.
- Set explicit image dimensions to reduce cumulative layout shift.
- Lazy-load non-critical images. Load only the above-the-fold lead image with priority where appropriate.
- Use server rendering/static regeneration and targeted cache invalidation after article, category, or menu changes.
- Keep client-side JavaScript minimal, paginate or incrementally load long article listings, optimize fonts, and cache high-traffic pages.
- Validate rendering on current Chrome, Safari, Firefox, Edge, and common mobile browsers.

## Public Portal

### Required Pages

- Homepage.
- Category archives.
- Article detail pages.
- Search and tag pages (start with database-backed search; evaluate a dedicated search engine as article volume grows).
- Author pages if authors are displayed publicly.
- Dynamic header and footer navigation.
- Privacy, terms, copyright/takedown, contact, and about pages.

### Homepage Structure

The homepage should provide a clear editorial hierarchy, including:

- Breaking-news or latest-news strip.
- Dynamic header navigation.
- Prominent lead story.
- Secondary story grid.
- Dynamic category sections.
- Latest-news feed with pagination or load-more behavior.
- Subscriber form in the footer.
- Dynamic footer navigation.

All public pages must be responsive for mobile, tablet, laptop, and wide desktop screen sizes.

## SEO and Sharing

Each published article URL must render server-side metadata generated from stored article data:

- Page title and meta description.
- Canonical URL.
- Open Graph title, description, URL, type, and locally stored featured image.
- Twitter/X card metadata.
- Publication and modification timestamps, author/source metadata where available.
- `NewsArticle` structured data.

Also provide XML sitemap(s), robots directives, and correct canonical handling. Metadata must be available to crawlers when the URL is shared, without requiring client-side JavaScript.

## Dashboard Requirements

### Admin Dashboard

Provide management sections for:

- Articles and all editorial content.
- Editors.
- Categories and tags.
- Header and footer menus.
- RSS sources, schedules, import history, and failures.
- Subscriber records.
- Site settings.
- Audit history.
- Future advertising placement configuration.

### Editor Dashboard

Provide:

- A list filtered to only the logged-in editor's articles.
- Create/edit/publish/unpublish/delete actions for owned articles.
- Rich text editing, media handling, category/tag selection, SEO inputs, article preview, and publication status controls.

Rich content must be sanitized before public rendering.

## Advertising Preparation

Advertising is out of scope for the initial portal. Preserve an extension point for placements in `header`, `body`, and `footer`.

When advertising is implemented:

- Restrict script configuration to an admin-only workflow.
- Use explicit placement records and an allowlist rather than unrestricted arbitrary script execution.
- Maintain a content security policy and audit records.
- Reserve layout space where practical to avoid layout shifts.
- Do not allow general editors to enter advertising scripts.

## Recommended Infrastructure

Run the following services through Docker Compose (or an equivalent production setup):

- **Web:** Next.js application for public pages, dashboard, and application APIs.
- **Database:** Managed MongoDB, with MongoDB Atlas recommended for local and production access through a managed connection URI. Add indexes for public listings, category references, editor ownership, slugs, RSS duplicate detection, and scheduling queries.
- **Queue/cache:** Redis. Cache public page data and navigation, and use it for durable RSS job queues and scheduling.
- **Delivery:** CDN-backed static assets and cached public pages. MongoDB must be deployed in a region close to the VPS; caching, local optimized images, and minimal client JavaScript are the primary mechanisms for a sub-two-second page-load target.
- **Worker:** persistent Node.js RSS scheduler/import worker.
- **Storage:** RustFS on the Hostinger VPS, accessed through its S3-compatible API. Use a persistent Docker volume outside the application container so media survives deployments. The local development app and deployed app must use the same RustFS bucket and stable media URLs.
- **Proxy/CDN:** HTTPS termination, compression, caching, and static asset delivery. Expose RustFS through a dedicated HTTPS media subdomain; do not expose its administrative interface or credentials publicly.

Use a durable queue/scheduling system so jobs survive web-server restarts and can be retried, monitored, and audited.

## Security and Operational Requirements

- Use secure authenticated sessions and role-based authorization.
- Rate-limit authentication, subscription, and import-related endpoints.
- Validate all input and sanitize rich content.
- Verify upload content types and scan uploaded files if a scanning service is available.
- Never expose secrets in logs, browser bundles, source control, or API responses.
- Configure a Content Security Policy before allowing third-party advertising scripts.
- Keep audit records for publishing, deletion, RSS configuration, user, and future advertising changes.
- Use managed MongoDB backups and point-in-time recovery where available; document and periodically test restoration of both the database and object storage.
- Define source quotas, request timeouts, and feed item limits so a faulty feed cannot exhaust resources.
- Provide a clear correction, takedown, attribution, and article-archiving policy.

## Suggested Initial Data Entities

- `users`
- `articles`
- `article_images`
- `categories`
- `tags`
- `article_categories`
- `article_tags`
- `menus`
- `menu_items`
- `subscribers`
- `rss_sources`
- `rss_imports`
- `scheduled_jobs` or queue job history
- `site_settings`
- `audit_logs`

Exact schema and naming can follow the selected ORM/project conventions.

## Delivery Phases

1. **Foundation:** Next.js setup, Docker, managed MongoDB, Redis, object storage, schema/index setup, environment validation, and observability.
2. **Identity and editorial core:** authentication, roles, article model, media uploads, and editor/admin authorization.
3. **Dynamic CMS:** categories, tags, header/footer menus, site settings, and public article/category pages.
4. **RSS pipeline:** source management, scheduler, background worker, feed parsing, deduplication, local media download, import history, retries, and automatic publishing.
5. **Portal experience:** responsive homepage, latest-news sections, search, subscriber collection, SEO, sitemap, and structured data.
6. **Quality and production:** accessibility, browser compatibility, performance testing, backups, monitoring, rate limiting, and deployment hardening.
7. **Deferred capabilities:** newsletter provider/digest, controlled advertising UI, advanced search, additional languages, and more newsroom roles.

## Required Verification

Before a release, verify:

- Database migrations and data integrity.
- Editor ownership protections, including direct-request/API authorization tests.
- RSS parsing, scheduling, retries, deduplication, category mapping, and automatic-publication behavior using fixtures.
- Local image persistence: articles continue working if the originating RSS source is unavailable.
- Metadata, canonical URLs, Open Graph images, XML sitemap output, and NewsArticle structured data.
- Mobile, tablet, and desktop behavior in current major browsers.
- Accessibility: semantic headings, keyboard navigation, focus visibility, contrast, accessible forms, and alt text.
- Performance on homepage, category, and article pages using Lighthouse/Core Web Vitals.
- Docker deployment integration across database, Redis, web app, and worker.
- Backup and restore procedure.

## Open Decisions for Future Updates

- Exact visual brand, logo, colors, typography, and design system.
- Whether categories should support nested/category-parent navigation at launch.
- Slug change and permanent-redirect policy.
- Article duplication policy when different licensed RSS feeds publish the same story.
- Analytics, cookie-consent, and privacy requirements.
- Specific subscriber email provider and whether to add double opt-in before campaigns begin.
- Automated alerting channel for failed jobs and infrastructure health.
- Whether future editorial roles such as author, reviewer, publisher, and advertising manager are required.
- Database/ORM, authentication provider, queue library, and object-storage provider selection.
