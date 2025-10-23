import { z } from 'zod';
import config from '../config.js';

/**
 * Zod validation schemas for API endpoints
 */

// Query parameter validation for days
export const daysQuerySchema = z.object({
  days: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : config.data.defaultDays))
    .pipe(
      z.number()
        .int()
        .min(1, 'Days must be at least 1')
        .max(config.data.maxDays, `Days cannot exceed ${config.data.maxDays}`)
    ),
});

// Path parameter validation for SLI ID
export const sliIdParamSchema = z.object({
  sliId: z
    .string()
    .min(1, 'SLI ID is required')
    .max(255, 'SLI ID too long')
    .regex(/^[a-zA-Z0-9-_]+$/, 'SLI ID must contain only alphanumeric characters, hyphens, and underscores'),
});

// Body validation for batch requests
export const batchRequestSchema = z.object({
  sliIds: z
    .array(z.string().min(1).max(255))
    .min(1, 'At least one SLI ID is required')
    .max(config.data.maxBatchSize, `Cannot request more than ${config.data.maxBatchSize} SLIs at once`),
});

// Combined validation for series endpoints
export const seriesQuerySchema = daysQuerySchema.merge(
  z.object({
    // Aggregation level for time series data
    aggregate: z
      .enum(['raw', 'hourly', 'daily'])
      .optional(),
    includeMetadata: z
      .string()
      .optional()
      .transform((val) => val === 'true'),
  })
);

/**
 * Validation middleware factory
 * Creates Express middleware that validates request data using Zod schemas
 */
export const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      let data;
      
      switch (source) {
        case 'body':
          data = req.body;
          break;
        case 'query':
          data = req.query;
          break;
        case 'params':
          data = req.params;
          break;
        default:
          throw new Error(`Invalid validation source: ${source}`);
      }

      const result = schema.safeParse(data);

      if (!result.success) {
        const errors = result.error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
        }));

        return res.status(400).json({
          error: 'Validation failed',
          details: errors,
        });
      }

      // Replace the original data with the validated (and transformed) data
      switch (source) {
        case 'body':
          req.body = result.data;
          break;
        case 'query':
          req.query = result.data;
          break;
        case 'params':
          req.params = result.data;
          break;
      }

      next();
    } catch (error) {
      console.error('Validation error:', error);
      res.status(500).json({ error: 'Internal validation error' });
    }
  };
};

/**
 * Validation helpers for common patterns
 */
export const validators = {
  // Validate query parameters with days
  daysQuery: validate(daysQuerySchema, 'query'),
  
  // Validate series query (days + other params)
  seriesQuery: validate(seriesQuerySchema, 'query'),
  
  // Validate SLI ID in path
  sliIdParam: validate(sliIdParamSchema, 'params'),
  
  // Validate batch request body
  batchBody: validate(batchRequestSchema, 'body'),
};

