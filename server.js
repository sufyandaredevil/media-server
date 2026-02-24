const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const { PORT, rootDir } = require('./config');
const { loadRules } = require('./utils/fileUtils');
const routes = require('./routes');

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Load exclusion rules
loadRules();

// Mount routes
app.use('/', routes);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Streaming from: ${rootDir}`);
});
