import rateLimit from 'express-rate-limit';
import config from '../config.js';

/**
 * Request logging middleware
 */
export const requestLogger = (req, res, next) => {
  if (config.logging.requests) {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    });
  }
  
  next();
};

/**
 * Error handling middleware
 */
export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  if (config.security.verboseErrors) {
    return res.status(500).json({
      error: 'Internal server error',
      message: err.message,
      stack: err.stack,
    });
  }

  res.status(500).json({
    error: 'Internal server error',
    message: 'Something went wrong',
  });
};

/**
 * Rate limiting middleware factory
 */
export const createRateLimiter = (options = {}) => {
  if (!config.rateLimit.enabled) {
    // Return no-op middleware if rate limiting is disabled
    return (req, res, next) => next();
  }

  const defaults = config.rateLimit.api;
  
  return rateLimit({
    windowMs: options.windowMs || defaults.windowMs,
    max: options.maxRequests || defaults.maxRequests,
    message: { error: options.message || defaults.message },
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    skipSuccessfulRequests: options.skipSuccessfulRequests || defaults.skipSuccessfulRequests,
    skipFailedRequests: options.skipFailedRequests || defaults.skipFailedRequests,
    // Let express-rate-limit handle IP key generation (supports IPv4 & IPv6)
  });
};

/**
 * Pre-configured rate limiters
 */
export const rateLimiters = {
  // Standard API rate limit
  api: createRateLimiter(),
  
  // Stricter limit for heavy/expensive endpoints
  heavy: createRateLimiter({
    windowMs: config.rateLimit.heavy.windowMs,
    maxRequests: config.rateLimit.heavy.maxRequests,
    message: config.rateLimit.heavy.message,
  }),
  
  // Very permissive for health checks
  health: createRateLimiter({
    windowMs: 60000, // 1 minute
    maxRequests: 60, // 60 requests per minute
    message: 'Too many health check requests',
  }),
};

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors and pass to error middleware
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Not found handler
 */
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Cannot ${req.method} ${req.path}`,
  });
};

/**
 * Cache control middleware
 */
export const cacheControl = (maxAge = 300) => {
  return (req, res, next) => {
    if (config.server.isProduction) {
      res.set('Cache-Control', `public, max-age=${maxAge}`);
    }
    next();
  };
};

