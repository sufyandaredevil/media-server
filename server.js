const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const { PORT, rootDir } = require('./config');
const { loadRules } = require('./utils/fileUtils');
const routes = require('./routes');

const app = express();

app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to normalize IPv6-mapped IPv4 addresses
app.use((req, res, next) => {
  if (req.ip && req.ip.startsWith('::ffff:')) {
    req.ip = req.ip.replace('::ffff:', '');
  }
  next();
});

// Load exclusion rules
loadRules();

// Mount routes
app.use('/', routes);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Streaming from: ${rootDir}`);
});
