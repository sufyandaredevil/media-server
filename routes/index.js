const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { ACCESS_KEY, SESSION_TOKEN, rootDir } = require('../config');
const { getDirectoryChildren, safeResolve, isPathAllowed, getMimeType } = require('../utils/fileUtils');
const { authMiddleware } = require('../middleware/auth');

router.get('/login', async (req, res) => {
  if (!SESSION_TOKEN || req.cookies.mex_session === SESSION_TOKEN) {
    return res.redirect('/');
  }
  const template = await fs.readFile(path.join(__dirname, '..', 'views', 'login.html'), 'utf8');
  const errorHtml = req.query.error ? '<div class="error-msg">Invalid Access Key</div>' : '';
  res.send(template.replace('{{ERROR}}', errorHtml));
});

router.post('/login', (req, res) => {
  const { key } = req.body;
  if (key === ACCESS_KEY) {
    res.cookie('mex_session', SESSION_TOKEN, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });
    res.redirect('/');
  } else {
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
