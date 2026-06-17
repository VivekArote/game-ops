const fs = require('fs').promises;
const path = require('path');
const logger = require('../middleware/logger');

/**
 * FileLock serializes asynchronous file operations using a Promise queue.
 * This ensures that multiple concurrent writes do not corrupt our JSON file database.
 */
class FileLock {
  constructor() {
    this.queue = Promise.resolve();
  }

  /**
   * Run an asynchronous function sequentially in the file execution queue.
   * @param {Function} fn - Async function returning a promise.
   * @returns {Promise<any>}
   */
  async runSequentially(fn) {
    return new Promise((resolve, reject) => {
      this.queue = this.queue
        .then(async () => {
          try {
            const result = await fn();
            resolve(result);
          } catch (err) {
            reject(err);
          }
        })
        .catch((err) => {
          // Catch and log error, but still resolve so the queue doesn't lock permanently
          logger.error('Error in FileLock execution queue:', err);
          reject(err);
        });
    });
  }

  /**
   * Safely read JSON from file path.
   * @param {string} filePath 
   * @returns {Promise<Array>}
   */
  async readJson(filePath) {
    return this.runSequentially(async () => {
      try {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data || '[]');
      } catch (err) {
        if (err.code === 'ENOENT') {
          // File does not exist, return empty array
          return [];
        }
        throw err;
      }
    });
  }

  /**
   * Safely write JSON to file path.
   * @param {string} filePath 
   * @param {Array} data 
   * @returns {Promise<void>}
   */
  async writeJson(filePath, data) {
    return this.runSequentially(async () => {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const tempPath = `${filePath}.tmp`;
      // Write to temp file first
      await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
      // Atomic rename to replace the actual file
      await fs.rename(tempPath, filePath);
    });
  }
}

module.exports = new FileLock();
