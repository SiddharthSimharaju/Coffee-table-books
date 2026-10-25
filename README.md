# Bangalore Coffee Shops

🔗 [Project board on Notion](https://app.notion.com/p/siddharthsimharaju/d6017cbefdd4493d8a75e8a2cff8f9ff?v=628fe90d14c1453b876d0e39f93b1fb3&source=copy_link)

Marketing site and waitlist for the *Bangalore Coffee Shops* coffee-table book.

- `site/` — the static website (a 3D book that opens and flips)
- `server.js` — local preview server; also stores waitlist signups in `data/waitlist.json` (`npm start`)
- Live site is deployed from `site/` to GitHub Pages by `.github/workflows/pages.yml`
- `site/config.js` — set `window.WAITLIST_ENDPOINT` to a form service (e.g. Formspree) for the hosted site
