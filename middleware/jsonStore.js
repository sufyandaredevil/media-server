const fs = require('fs');
const path = require('path');

class JsonStore {
  constructor(filePath) {
    this.filePath = path.resolve(filePath);
    this.windowMs = 15 * 60 * 1000; // Default fallback
    this.initFile();
  }

  // express-rate-limit calls this if it exists
  init(options) {
    if (options && options.windowMs) {
      this.windowMs = options.windowMs;
    }
  }

  initFile() {
    if (!fs.existsSync(this.filePath)) {
      try {
        fs.writeFileSync(this.filePath, JSON.stringify({}, null, 2));
      } catch (e) {
        console.error('JsonStore: Error creating file:', e.message);
      }
    }
  }

  _read() {
    try {
      if (!fs.existsSync(this.filePath)) return {};
      const data = fs.readFileSync(this.filePath, 'utf8');
      return JSON.parse(data || '{}');
    } catch (e) {
      console.error('JsonStore: Error reading file:', e.message);
      return {};
    }
  }

  _write(data) {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error('JsonStore: Error writing file:', e.message);
    }
  }

  async increment(key) {
    const data = this._read();
    const now = Date.now();

    // Ensure data[key] exists and has a valid resetTime
    if (!data[key] || !data[key].resetTime || data[key].resetTime < now) {
      data[key] = {
        totalHits: 1,
        resetTime: now + this.windowMs
      };
    } else {
      data[key].totalHits++;
    }

    this._write(data);

    // CRITICAL: express-rate-limit expects resetTime to be a Date object
    return {
      totalHits: data[key].totalHits,
      resetTime: new Date(data[key].resetTime)
    };
  }

  async decrement(key) {
    const data = this._read();
    if (data[key] && data[key].totalHits > 0) {
      data[key].totalHits--;
      this._write(data);
    }
  }

  async resetKey(key) {
    const data = this._read();
    delete data[key];
    this._write(data);
  }

  async cleanup() {
    const data = this._read();
    const now = Date.now();
    let changed = false;
    let count = 0;

    for (const key in data) {
      if (data[key].resetTime < now) {
        delete data[key];
        changed = true;
        count++;
      }
    }

    if (changed) {
      this._write(data);
    }
  }
}

module.exports = JsonStore;
