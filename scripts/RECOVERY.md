# Article Recovery & Backfill Guide

This document describes how to:
1. **Backfill** missed articles when the RSS worker has been down
2. **Recover** damaged or deleted individual articles

## Prerequisites

- `.env.local` must contain `MONGODB_URI`
- Node.js 18+ (for built-in `fetch`)
- The `sanitize-html` and `mongoose` packages (already in the project)

## Two Tools Available

| Script | Purpose |
| --- | --- |
| `scripts/backfill-from-ians.mjs` | Fetch all missed articles from the last N hours (use when worker was down) |
| `scripts/recover-article.mjs` | Recover a single damaged/truncated article by slug or ID |

## How It Works

Every RSS article stores these fields in MongoDB:
- `sourceUrl` — the original article URL on the source website (e.g. `https://ians.in/detail/...`)
- `rssGuid` — the RSS feed's unique identifier
- `sourceName` — the RSS source name (e.g. "IANS - Entertainment")
- `origin` — set to `"rss"` for imported articles

To recover content, we use the **IANS CMS public API** which serves full article content by slug.

### IANS CMS Detail API

```
GET https://cms.iansnews.in/api/elastic/news/detail/en/{slug}/?language=english&website=1
Authorization: Bearer {IANS_TOKEN}
```
<!-- Authorization: Bearer {IANS_WEB_TOKEN}
- `{IANS_WEB_TOKEN}` is the public web token embedded in the IANS frontend JS bundle at 
`https://ians.in/assets/index-D-hguXWu.js`. It is set as `localStorage.WebIT` when a whitelisted 
IP visits the site. As of July 2026 the token is `48fabccf0f860b0640aa49e9438c60ed273669ce`.
- If the token stops working, fetch the IANS homepage JS bundle and search for 
`localStorage.setItem("WebIT","...")` to find the current token. -->


- `{slug}` is extracted from the article's `sourceUrl` (the last path segment, without trailing slash)
- `{IANS_TOKEN}` must be provided by the admin. In the dashboard, enter it in the token field on the Recover page. For CLI scripts, pass it via the `--token` argument or `IANS_TOKEN` environment variable.

### Response Format

```json
{
  "results": [
    {
      "content": "<p>Full article HTML content...</p>",
      "title": "...",
      "byline": "IANS",
      ...
    }
  ]
}
```

The `results[0].content` field contains the full original HTML content.

## Backfill: When the Worker Has Been Down

If the RSS worker/cron has been down for a day or more, articles will have
expired from the RSS feeds (feeds only keep ~20 recent items). The IANS CMS
API supports pagination (200+ pages, 7+ days of history) and can recover
articles that are no longer in the RSS feeds.

### Usage

```bash
# Backfill all categories for the last 48 hours (default)
node --env-file=.env.local scripts/backfill-from-ians.mjs --hours 48

# Backfill last 24 hours only
node --env-file=.env.local scripts/backfill-from-ians.mjs --hours 24

# Backfill last 3 days
node --env-file=.env.local scripts/backfill-from-ians.mjs --hours 72

# Backfill a specific category only
node --env-file=.env.local scripts/backfill-from-ians.mjs --hours 24 --category entertainment

# Dry run (see what would be imported without saving)
node --env-file=.env.local scripts/backfill-from-ians.mjs --hours 48 --dry-run
```

### How It Works

1. Paginates through `https://cms.iansnews.in/api/elastic/news/list/?language=english&website=1&page=N`
2. Filters articles by `created_at` timestamp (only newer than the cutoff)
3. Skips articles already in the database (dedup by `sourceUrl`, `rssGuid`, and `contentHash`)
4. Maps each article to the correct RSS source using its IANS tags
5. Fetches full content from the detail API
6. Sanitizes HTML and strips agency artifacts (same pipeline as RSS import)
7. Inserts the article as `published` with the correct category

### Tag-to-Source Mapping

The IANS CMS API returns all articles mixed together. The script maps IANS
tag slugs to RSS source names:

| IANS Tag | RSS Source |
| --- | --- |
| national, politics, crime, law, society, education | IANS - NAtional |
| international, diplomacy, security, terrorism, defence | IANS - World |
| business, economy, markets | IANS - Business |
| entertainment, cinema | IANS - Entertainment |
| sports, cricket, football, other-sports, motorsports | IANS - Sports |
| science, technology, environment | IANS - Science/Tech |
| health, lifestyle | IANS - Health/Medicine |

## Single Article Recovery

### Usage

```bash
# Recover a single article by slug or ID
node --env-file=.env.local scripts/recover-article.mjs <slug-or-id>

# Recover by exact source URL
node --env-file=.env.local scripts/recover-article.mjs --url "https://ians.in/detail/slug/"

# Auto-detect and recover all damaged articles
node --env-file=.env.local scripts/recover-article.mjs --all-damaged
```

### How It Works

1. Finds the article(s) in MongoDB by slug, ID, or auto-detection of damaged content
2. Extracts the slug from the article's `sourceUrl`
3. Fetches the full content from the IANS CMS Detail API
4. Sanitizes the HTML (same `sanitizeRssContent` rules as the import pipeline)
5. Strips leading duplicate images (`stripLeadingImages`)
6. Safely strips trailing IANS agency sign-offs (`stripAgencyArtifactsSafe` — requires a dash prefix, never touches in-body "told IANS" attributions)
7. Updates the article's `content` field in MongoDB only if the new content is longer than the current content

## Safety Notes

- The script **never overwrites** content that is longer than the fetched version — it only restores if the fetched content is significantly longer (50+ chars)
- The `stripAgencyArtifactsSafe` function requires a dash (`--`, `—`, `–`, `-`) before `IANS` to trigger trailing sign-off removal, so legitimate in-body attributions like "he told IANS" are preserved
- Always test on a single article first before running `--all-damaged`

## IANS Token

The IANS CMS API requires a bearer token. The token expires periodically.
- **Dashboard:** Enter the token in the "IANS Token" field on the Recover page (`/dashboard/recover`)
- **CLI scripts:** Pass the token via the `--token` argument or `IANS_TOKEN` environment variable
