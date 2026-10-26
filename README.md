# رِحلتي مع القرآن

An Arabic, right-to-left Quran memorization and revision tracker. The app helps learners record memorized material, plan revisions, track recitation sessions, and follow an Ijazah journey.

## Features

- Dashboard with daily tasks, progress, streaks, and upcoming reviews.
- Memorization records by complete surah, ayah range, Mushaf pages, or a manual description.
- Spaced revision scheduling based on self-assessment.
- Baseline assessments for previously memorized material.
- Recitation session history and planned teacher sessions.
- Study goals, calendar, analytics, dark mode, and responsive Arabic RTL layouts.
- JSON export/import for backup and restore.
- Browser-local storage; no account or server database is required.

## Requirements

- Node.js 18 or newer.
- Wrangler for direct Cloudflare Pages deployments; `npx` can fetch it when needed.

## Development

```bash
npm start
```

Open [http://localhost:4173](http://localhost:4173).

Run the test suite:

```bash
npm test
```

## Build and deploy to Cloudflare Pages

The app is vanilla HTML, CSS, and JavaScript modules, so it has no framework compilation step. The Pages build script copies only the web app into `dist/`; it excludes tests, the local Node server, and documentation from the public asset bundle.

For a direct production deployment, authenticate Wrangler once with `npx wrangler login`, then run:

```bash
npm run deploy:pages
```

This builds the static bundle and deploys it to the `rihlati-quran` Cloudflare Pages project on the `main` production branch. The production build command for a Git-integrated Pages project is `npm run build:pages`, with `dist` as the output directory. Cloudflare Pages is connected to the private GitHub repository [`Nawar-Altibi/rihlati-quran`](https://github.com/Nawar-Altibi/rihlati-quran). Pushes to `main` automatically deploy to production; other branches and pull requests receive preview deployments.

Production URL: <https://rihlati-quran.pages.dev>

## Data and backups

Progress is stored in browser `localStorage` for the current origin and device. It does not sync across browsers or devices. Moving from localhost or another domain does not move localStorage automatically. Export a JSON backup from the existing app, open the deployed site, then import that backup there. Keep personal backup files out of Git; the repository `.gitignore` excludes common backup names.

## Project structure

- `index.html` — RTL app shell and metadata.
- `styles.css` — responsive visual system and theme styles.
- `src/app.js` — application views, forms, and interactions.
- `src/data.js` — surah metadata and initial data.
- `src/logic.js` — progress, validation, scheduling, and date calculations.
- `src/storage.js` — local persistence and data migration.
- `scripts/build-pages.mjs` — creates the clean static `dist/` bundle.
- `test/logic.test.js` — logic and storage migration tests.
- `server.js` — local development server.
