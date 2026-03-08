const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { ACCESS_KEY, SESSION_TOKEN, rootDir, LOGIN_COOLDOWN_MINUTES, MAX_LOGIN_ATTEMPTS, SESSION_EXPIRY_DAYS, RATE_LIMIT_CLEANUP_MINUTES } = require('../config');
const { getDirectoryChildren, safeResolve, isPathAllowed, getMimeType } = require('../utils/fileUtils');
const { authMiddleware } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const JsonStore = require('../middleware/jsonStore');

const jsonStore = new JsonStore(path.join(__dirname, '..', 'rate-limits.json'));

const loginLimiter = rateLimit({
  windowMs: LOGIN_COOLDOWN_MINUTES * 60 * 1000,
  max: MAX_LOGIN_ATTEMPTS,
  message: `Too many login attempts, please try again after ${LOGIN_COOLDOWN_MINUTES} minutes`,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  store: jsonStore,
});

// Periodic cleanup of expired entries
if (RATE_LIMIT_CLEANUP_MINUTES > 0) {
  setInterval(() => {
    if (typeof jsonStore.cleanup === 'function') {
      jsonStore.cleanup();
    }
  }, RATE_LIMIT_CLEANUP_MINUTES * 60 * 1000);
}

router.get('/login', async (req, res) => {
  if (!SESSION_TOKEN || req.cookies.mex_session === SESSION_TOKEN) {
    return res.redirect('/');
  }
  const template = await fs.readFile(path.join(__dirname, '..', 'views', 'login.html'), 'utf8');
  let errorHtml = '';
  if (req.query.error === '1') {
    errorHtml = '<div class="error-msg">Invalid Access Key</div>';
  } else if (req.query.error === '2') {
    errorHtml = `<div class="error-msg">Too many login attempts, please try again after ${LOGIN_COOLDOWN_MINUTES} minutes</div>`;
  }
  res.send(template.replace('{{ERROR}}', errorHtml));
});

router.post('/login', loginLimiter, async (req, res) => {
  const { key } = req.body;
  if (key === ACCESS_KEY) {
    // SUCCESS: Clear failed attempts for this IP
    if (typeof jsonStore.resetKey === 'function') {
      await jsonStore.resetKey(req.ip);
    }
    res.cookie('mex_session', SESSION_TOKEN, { maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000, httpOnly: true });
    res.redirect('/');
  } else {
    // FAILURE: Check if they have reached the limit
    const data = jsonStore._read();
    const hits = data[req.ip] ? data[req.ip].totalHits : 0;

    if (hits >= MAX_LOGIN_ATTEMPTS) {
      return res.redirect(`/login?error=2`);
    }
    res.redirect('/login?error=1');
  }
});

router.use(authMiddleware);

router.post('/api/ls', async (req, res) => {
  try {
    const relPath = req.body.path || '';
    const absolutePath = safeResolve(relPath);
    const stats = await fs.stat(absolutePath);
    const etag = `W/"${stats.mtime.getTime()}"`;

    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'no-cache');

    const children = await getDirectoryChildren(relPath);
    res.json(children);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  const rootName = path.basename(rootDir) || rootDir;
  const template = await fs.readFile(path.join(__dirname, '..', 'views', 'index.html'), 'utf8');
  res.send(template.replace('{{ROOT_NAME}}', rootName));
});

router.get(/^\/stream\/(.*)/, async (req, res) => {
  try {
    const relPath = decodeURIComponent(req.params[0]);
    const filePath = safeResolve(relPath);
    const isInitialRequest = !req.headers.range || req.headers.range === 'bytes=0-' || req.headers.range.startsWith('bytes=0-');

    const stat = await fs.stat(filePath);
    const ext = path.extname(filePath).toLowerCase();

    if (!isPathAllowed(filePath)) {
      return res.status(403).send('Access Denied');
    }

    if (ext === '.vtt') {
      res.setHeader('Content-Type', 'text/vtt');
      return fsSync.createReadStream(filePath).pipe(res);
    }

    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fsSync.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': getMimeType(filePath),
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': getMimeType(filePath),
      };
      res.writeHead(200, head);
      fsSync.createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    res.status(403).send(err.message);
  }
});

module.exports = router;
