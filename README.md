# H.Wood Inventory Workflow

Automated multi-venue inventory variance tracker. Parses Slack messages with AI, cross-references Craftable variance data, scores severity, and generates recount decision reports.

**Single-file app → GitHub Pages → Zero backend.**

## What It Does

```
Slack Messages ──→ GPT-4o-mini ──→ Cross-Reference ──→ Severity Score ──→ Recount CSV
  (staff reports)   (parses)    (+ Craftable data)    (auto-scored)    (for count team)
```

## Features

- **AI Parsing** — Paste Slack messages, GPT-4o-mini (via GitHub Models) extracts products, quantities, issue types, locations
- **Craftable API Integration** — Auto-pulls variance data via API, or import CSV manually
- **API Explorer** — Auto-discovers Craftable endpoints from Swagger spec
- **Cross-Reference Engine** — Fuzzy-matches parsed issues to Craftable products (handles typos)
- **Severity Scoring** — CRITICAL → HIGH → MEDIUM → WATCH → LOW (auto-scored)
- **Recount Flagging** — Items exceeding thresholds get flagged for physical recount
- **Automation** — Configurable auto-pull interval (15m / 30m / 1hr / 2hr)
- **Two CSV Exports** — Streamlined Recount CSV for counting team + Full CSV for records
- **Multi-Venue** — Pre-loaded with H.Wood venues, add more on the fly
- **Persistent** — Data saved in browser localStorage across sessions

## Quick Start

1. Upload files to a new GitHub repo
2. Enable GitHub Pages (Settings → Pages → main branch)
3. Open the app and go to **Settings** tab
4. Add your **GitHub token** (PAT from [github.com/settings/tokens](https://github.com/settings/tokens) — no special scopes needed)
5. Add your **Craftable API key** and base URL
6. Go to **API Explorer** tab → click the 4 discovery buttons
7. Enable auto-pull in **Settings → Automation**

Full setup guide: open `guide.html` in your browser.

## Files

```
index.html    ← The app (everything in one file)
guide.html    ← Interactive setup & operations guide
README.md     ← This file
.nojekyll     ← Tells GitHub Pages to serve files as-is
404.html      ← Redirects back to the app
```

## Pre-Loaded Venues

- Bird Streets Club
- Delilah - LA
- Deliliah - Miami
- Keys
- Poppy
- The Nice Guy

Add/remove venues anytime in Settings or while parsing.

## Severity Logic

| Level | Criteria | Recount? |
|-------|----------|----------|
| CRITICAL | Active 10+ weeks, or 5+ weeks with $200+ variance | Always |
| HIGH | Active 5+ weeks, or inactive with $500+ variance | Always |
| MEDIUM | Active 3+ weeks, or active with variance above threshold | If $100+ or 3+ weeks |
| WATCH | Active 2 weeks | No |
| LOW | New or inactive low-variance | No |

## API Configuration

```
Base URL:    https://api.craftable.com/v1
Swagger UI:  https://api.craftable.com/v1/swagger-ui/index.html
Auth:        Bearer token (or X-API-Key, or query param)
```

The API Explorer auto-discovers endpoints. If CORS blocks browser calls, use CSV import instead.

## License

MIT
