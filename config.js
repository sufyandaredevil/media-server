require('dotenv').config();
const path = require('path');
const fsSync = require('fs');
const crypto = require('crypto');

const rootDir = (process.argv[2] || process.env.ROOT_DIR) ? path.resolve(process.argv[2] || process.env.ROOT_DIR) : null;

if (!rootDir || !fsSync.existsSync(rootDir) || !fsSync.statSync(rootDir).isDirectory()) {
  console.error('Error: Please provide a valid absolute path to the root directory.');
  console.error('Usage: node server.js "DRIVENAME:/path/to/media"');
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
const LOGIN_COOLDOWN_MINUTES = parseInt(process.env.LOGIN_COOLDOWN_MINUTES || '15', 10);
const MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10);
const SESSION_EXPIRY_DAYS = parseInt(process.env.SESSION_EXPIRY_DAYS || '30', 10);
const RATE_LIMIT_CLEANUP_MINUTES = parseInt(process.env.RATE_LIMIT_CLEANUP_MINUTES || '5', 10);

module.exports = {
  rootDir,
  ACCESS_KEY,
  SESSION_TOKEN,
  PORT,
  LOGIN_COOLDOWN_MINUTES,
  MAX_LOGIN_ATTEMPTS,
  SESSION_EXPIRY_DAYS,
  RATE_LIMIT_CLEANUP_MINUTES
};
