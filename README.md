# Bangalore Coffee Shops

Marketing site and waitlist for the *Bangalore Coffee Shops* coffee-table book.

- `site/` — the static website (a 3D book that opens and flips)
- `server.js` — local preview server; also stores waitlist signups in `data/waitlist.json` (`npm start`)
- Live site is deployed from `site/` to GitHub Pages by `.github/workflows/pages.yml`
- `site/config.js` — set `window.WAITLIST_ENDPOINT` to a form service (e.g. Formspree) for the hosted site
