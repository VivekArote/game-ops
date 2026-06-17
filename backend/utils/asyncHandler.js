/**
 * Wraps asynchronous express middleware/controllers to catch promise rejections 
 * and forward them to the global error handler middleware.
 * 
 * @param {Function} fn - Async middleware function
 * @returns {Function} Express middleware function
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
