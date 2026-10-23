// Zero-dependency server: serves ./site and stores waitlist signups in ./data/waitlist.json
const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const PORT = Number(process.env.PORT) || 3000;
const SITE_DIR = path.join(__dirname, 'site');
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'waitlist.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req, limit = 4096) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function loadList() {
  try {
    return JSON.parse(await fsp.readFile(DATA_FILE, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

// Serialise writes so two simultaneous signups can't clobber each other.
let writeQueue = Promise.resolve();
function addSignup(email, source) {
  const job = writeQueue.then(async () => {
    const list = await loadList();
    if (list.some((entry) => entry.email === email)) return { already: true, count: list.length };
    list.push({ email, source, joinedAt: new Date().toISOString() });
    await fsp.mkdir(DATA_DIR, { recursive: true });
    const tmp = `${DATA_FILE}.tmp`;
    await fsp.writeFile(tmp, JSON.stringify(list, null, 2));
    await fsp.rename(tmp, DATA_FILE);
    return { already: false, count: list.length };
  });
  writeQueue = job.catch(() => {});
  return job;
}

async function handleWaitlist(req, res) {
  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch {
    return sendJson(res, 400, { ok: false, error: 'Invalid request.' });
  }
  const email = String(payload.email || '').trim().toLowerCase();
  const source = String(payload.source || 'site').slice(0, 40);
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return sendJson(res, 422, { ok: false, error: 'Please enter a valid email address.' });
  }
  try {
    const result = await addSignup(email, source);
    return sendJson(res, 200, { ok: true, already: result.already });
  } catch (err) {
    console.error('waitlist write failed:', err);
    return sendJson(res, 500, { ok: false, error: 'Something went wrong. Please try again.' });
  }
}

function serveStatic(req, res) {
  const { pathname } = new URL(req.url, 'http://localhost');
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }
  if (rel.endsWith('/')) rel += 'index.html';
  const filePath = path.normalize(path.join(SITE_DIR, rel));
  if (filePath !== SITE_DIR && !filePath.startsWith(SITE_DIR + path.sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(filePath).pipe(res);
  });
}

http
  .createServer((req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname === '/api/waitlist' && req.method === 'POST') return handleWaitlist(req, res);
    if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res);
    res.writeHead(405).end('Method not allowed');
  })
  .listen(PORT, () => {
    console.log(`Bangalore Coffee Shops → http://localhost:${PORT}`);
  });
