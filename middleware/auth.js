const { SESSION_TOKEN } = require('../config');

function authMiddleware(req, res, next) {
  if (!SESSION_TOKEN) return next();
  if (req.cookies.mex_session === SESSION_TOKEN) return next();
  if (req.path === '/login') return next();
  res.redirect('/login');
}

module.exports = { authMiddleware };
