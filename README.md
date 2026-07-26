# ENF Website Rebuild (Front-End + Donation Backend Scaffold)

Modern rebuild of the ENF website using publicly available live-site content and CMS data, with a recurring-donation backend scaffold prepared for real gateway integration.

## Quick Start

1. Refresh content bundle from live CMS:

```bash
python3 /Users/rashedal-tayyeb/Desktop/ENF/scripts/fetch_enf_content.py
```

2. Serve the project root with a local static server (for example VS Code Live Server) and open:

- `/index.html`

3. Optional: run backend API scaffold for donation endpoints:

```bash
pip install -r /Users/rashedal-tayyeb/Desktop/ENF/backend/requirements.txt
uvicorn app.main:app --reload --app-dir /Users/rashedal-tayyeb/Desktop/ENF/backend
```

## Team Review Link

The repository includes a GitHub Pages workflow in
`.github/workflows/pages.yml`. Pushing `main` deploys the static public website
for visual and content review.

The GitHub Pages preview does not run the FastAPI backend. Admin authentication,
saved CMS edits, and live payment processing require the backend to be deployed
separately with server-side environment variables.

## Rebuild Notes

- Legacy extracted Nuxt HTML snapshot archived at:
  - `docs/legacy-snapshot/index.partial-nuxt-snapshot.html`
- Main app files:
  - `assets/css/styles.css`
  - `assets/js/enf-content.js` (generated)
  - `assets/js/site.js`
  - `pages/*.html`

## Folder Layout

- `assets/css` shared styling
- `assets/js` generated content + page rendering logic
- `assets/images` reserved local media
- `assets/icons` reserved local icons
- `assets/fonts` reserved local fonts
- `pages` main HTML routes
- `components` reserved for future extracted partials/components
- `docs` rebuild docs + source notes
- `backend` recurring donation API scaffold (`FastAPI` + provider adapters + webhook flow)
- `scripts` content generation scripts
