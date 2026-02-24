require('dotenv').config();
const path = require('path');
const fsSync = require('fs');
const crypto = require('crypto');

const rootDir = process.argv[2] ? path.resolve(process.argv[2]) : null;

if (!rootDir || !fsSync.existsSync(rootDir) || !fsSync.statSync(rootDir).isDirectory()) {
  console.error('Error: Please provide a valid absolute path to the root directory.');
  console.error('Usage: node server.js "D:/path/to/media"');
  process.exit(1);
}

const ACCESS_KEY = process.env.MEX_ACCESS_KEY;
if (!ACCESS_KEY) {
  console.warn('WARNING: MEX_ACCESS_KEY environment variable is not set. The server will be publicly accessible!');
}

const SESSION_TOKEN = ACCESS_KEY
  ? crypto.createHash('sha256').update(ACCESS_KEY).digest('hex')
  : null;

const PORT = 3000;

module.exports = {
  rootDir,
  ACCESS_KEY,
  SESSION_TOKEN,
  PORT
};
