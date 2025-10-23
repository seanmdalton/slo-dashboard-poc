import 'dotenv/config';

/**
 * Centralized configuration for the SLO Dashboard API
 * All values can be overridden via environment variables
 */

const config = {
  // Server Configuration
  server: {
    port: parseInt(process.env.PORT || '3001'),
    nodeEnv: process.env.NODE_ENV || 'development',
    isDevelopment: (process.env.NODE_ENV || 'development') === 'development',
    isProduction: process.env.NODE_ENV === 'production',
  },

  // Database Configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'slo_user',
    password: process.env.DB_PASSWORD || 'slo_password',
    name: process.env.DB_NAME || 'slo_dashboard',
    poolSize: parseInt(process.env.DB_POOL_SIZE || '10'),
    // Direct connection string (takes precedence if set)
    url: process.env.DATABASE_URL,
  },

  // Rate Limiting Configuration
  rateLimit: {
    // Enable/disable rate limiting
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false', // Enabled by default
    
    // General API rate limit
    api: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes default
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // 100 requests per window
      message: process.env.RATE_LIMIT_MESSAGE || 'Too many requests, please try again later.',
      skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESSFUL === 'true',
      skipFailedRequests: process.env.RATE_LIMIT_SKIP_FAILED === 'true',
    },
    
    // Stricter limit for expensive endpoints (like /api/series)
    heavy: {
      windowMs: parseInt(process.env.RATE_LIMIT_HEAVY_WINDOW_MS || '900000'), // 15 minutes
      maxRequests: parseInt(process.env.RATE_LIMIT_HEAVY_MAX_REQUESTS || '20'), // 20 requests per window
      message: 'Too many data requests, please try again later.',
    },
  },

  // CORS Configuration
  cors: {
    enabled: process.env.CORS_ENABLED !== 'false',
    origin: process.env.CORS_ORIGIN || '*', // In production, set to specific domain
    credentials: process.env.CORS_CREDENTIALS === 'true',
  },

  // Compression Configuration
  compression: {
    enabled: process.env.COMPRESSION_ENABLED !== 'false',
    level: parseInt(process.env.COMPRESSION_LEVEL || '6'), // 1-9, higher = more compression
    threshold: parseInt(process.env.COMPRESSION_THRESHOLD || '1024'), // Min bytes to compress
  },

  // Data Query Configuration
  data: {
    // Default number of days to return if not specified
    defaultDays: parseInt(process.env.DATA_DEFAULT_DAYS || '28'),
    // Maximum number of days that can be requested
    maxDays: parseInt(process.env.DATA_MAX_DAYS || '90'),
    // Maximum number of SLIs in a batch request
    maxBatchSize: parseInt(process.env.DATA_MAX_BATCH_SIZE || '50'),
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info', // error, warn, info, debug
    requests: process.env.LOG_REQUESTS === 'true', // Log all HTTP requests
  },

  // Security Configuration
  security: {
    // Trust proxy (important for Render and other platforms)
    trustProxy: process.env.TRUST_PROXY === 'true' || process.env.NODE_ENV === 'production',
    // Enable detailed error messages (disable in production)
    verboseErrors: process.env.VERBOSE_ERRORS === 'true' || process.env.NODE_ENV === 'development',
  },
};

// Helper functions
export const getConnectionString = () => {
  if (config.database.url) {
    return config.database.url;
  }
  return `postgresql://${config.database.user}:${config.database.password}@${config.database.host}:${config.database.port}/${config.database.name}`;
};

export const logConfig = () => {
  console.log('📋 Configuration:');
  console.log(`   Environment: ${config.server.nodeEnv}`);
  console.log(`   Port: ${config.server.port}`);
  console.log(`   Database: ${config.database.host}:${config.database.port}/${config.database.name}`);
  console.log(`   Rate Limiting: ${config.rateLimit.enabled ? 'Enabled' : 'Disabled'}`);
  if (config.rateLimit.enabled) {
    console.log(`     - API: ${config.rateLimit.api.maxRequests} req / ${config.rateLimit.api.windowMs / 60000} min`);
    console.log(`     - Heavy: ${config.rateLimit.heavy.maxRequests} req / ${config.rateLimit.heavy.windowMs / 60000} min`);
  }
  console.log(`   CORS: ${config.cors.enabled ? config.cors.origin : 'Disabled'}`);
  console.log(`   Compression: ${config.compression.enabled ? 'Enabled' : 'Disabled'}`);
};

export default config;


