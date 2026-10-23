// Where the waitlist form posts { email, source } as JSON.
// - Local preview (npm start): the built-in server at /api/waitlist stores signups in data/waitlist.json.
// - GitHub Pages is static, so point this at a form service that returns JSON (e.g. Formspree:
//   'https://formspree.io/f/YOUR_FORM_ID'). Left empty, the form says the waitlist isn't connected yet.
window.WAITLIST_ENDPOINT = location.hostname.endsWith('github.io') ? '' : '/api/waitlist';
