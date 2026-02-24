const fs = require('fs').promises;
const path = require('path');
const ignore = require('ignore');
const { rootDir } = require('../config');

let ig = ignore();

async function loadRules() {
  try {
    const data = await fs.readFile(path.join(__dirname, '..', 'rules.json'), 'utf8');
    const rulesJson = JSON.parse(data);
    ig = ignore().add(rulesJson.exclude || []);
  } catch (e) {
    console.warn('Could not load rules.json, using defaults.');
    ig = ignore();
  }
}

function isPathAllowed(filePath) {
  const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');
  if (relPath === '' || relPath === '.') return true;
  return !ig.ignores(relPath);
}

function safeResolve(reqPath) {
  const resolvedPath = path.resolve(rootDir, reqPath || '');
  if (!resolvedPath.startsWith(rootDir)) {
    throw new Error('Access Denied: Path traversal detected.');
  }
  return resolvedPath;
}

async function getDirectoryChildren(dirPath) {
  const absolutePath = safeResolve(dirPath);
  const files = await fs.readdir(absolutePath);
  const children = [];

  for (const file of files) {
    const fullPath = path.join(absolutePath, file);
    const relPath = path.relative(rootDir, fullPath);
    try {
      if (!isPathAllowed(fullPath)) continue;

      const stats = await fs.stat(fullPath);
      const ext = path.extname(file).toLowerCase();
      const basename = path.basename(file, ext);

      let subtitlePath = null;
      if (['.mp4', '.mkv', '.webm', '.mp3', '.wav', '.ogg'].includes(ext)) {
        const vttFile = basename + '.vtt';
        const vttPath = path.join(absolutePath, vttFile);
        try {
          await fs.access(vttPath);
          subtitlePath = path.join(path.dirname(relPath), vttFile).replace(/\\/g, '/');
          if (subtitlePath.startsWith('/')) subtitlePath = subtitlePath.substring(1);
        } catch (e) { }
      }

      children.push({
        name: file,
        path: relPath.replace(/\\/g, '/'),
        isDirectory: stats.isDirectory(),
        ext: ext,
        subtitles: subtitlePath
      });
    } catch (e) { }
  }
  return children.sort((a, b) => (b.isDirectory - a.isDirectory) || a.name.localeCompare(b.name));
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap = {
    '.mp4': 'video/mp4',
    '.mkv': 'video/x-matroska',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.flac': 'audio/flac',
    '.alac': 'audio/alac',
    '.vtt': 'text/vtt'
  };
  return mimeMap[ext] || 'application/octet-stream';
}

module.exports = {
  loadRules,
  isPathAllowed,
  safeResolve,
  getDirectoryChildren,
  getMimeType
};
