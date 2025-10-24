import express from 'express';
import compression from 'compression';
import cors from 'cors';
import config, { logConfig } from './config.js';
import { db, testConnection } from './db/connection.js';
import { experiences, journeys, slos, slis, dataPoints } from './db/schema.js';
import { eq, and, gte, sql } from 'drizzle-orm';
import { validators } from './validation/schemas.js';
import {
  rateLimiters,
  requestLogger,
  errorHandler,
  asyncHandler,
  notFoundHandler,
  cacheControl,
} from './middleware/index.js';

const app = express();

// --- Trust Proxy (important for Render and other platforms) ---
if (config.security.trustProxy) {
  app.set('trust proxy', 1);
}

// --- Middleware ---
app.use(requestLogger);

// CORS
if (config.cors.enabled) {
  app.use(cors({
    origin: config.cors.origin,
    credentials: config.cors.credentials,
  }));
}

// Compression
if (config.compression.enabled) {
  app.use(compression({
    level: config.compression.level,
    threshold: config.compression.threshold,
  }));
}

app.use(express.json());

// --- Health Check (with light rate limiting) ---
app.get('/health', rateLimiters.health, asyncHandler(async (req, res) => {
  const dbHealthy = await testConnection();
  res.status(dbHealthy ? 200 : 500).json({
    status: dbHealthy ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
    database: dbHealthy ? 'connected' : 'disconnected',
    version: '2.0.0',
    environment: config.server.nodeEnv,
  });
}));

// --- API Routes (with rate limiting and validation) ---

/**
 * GET /api/seed
 * Returns the structure: experiences with nested journeys and SLOs
 */
app.get('/api/seed', rateLimiters.api, cacheControl(300), asyncHandler(async (req, res) => {
  // Fetch all experiences with their relationships
  const allExperiences = await db.query.experiences.findMany({
    with: {
      journeys: {
        with: {
          slos: {
            with: {
              indicators: true
            }
          }
        }
      }
    }
  });
  
  // Transform to match frontend expected format
  const formatted = allExperiences.map(exp => ({
    name: exp.name,
    journeys: exp.journeys.map(journey => ({
      id: journey.id,
      name: journey.name,
      experience: exp.name,
      slos: journey.slos.map(slo => ({
        id: slo.id,
        name: slo.name,
        description: slo.description,
        criticality: slo.criticality,
        owner: slo.owner,
        budgetingWindowDays: slo.budgetingWindowDays,
        objectivePercent: parseFloat(slo.objectivePercent),
        errorBudgetPercent: parseFloat(slo.errorBudgetPercent),
        indicators: slo.indicators.map(sli => ({
          id: sli.id,
          name: sli.name,
          type: sli.type,
          unit: sli.unit,
          objectiveDirection: sli.objectiveDirection,
          target: parseFloat(sli.target),
          source: sli.source
        }))
      }))
    }))
  }));
  
  res.json({ experiences: formatted });
}));

/**
 * GET /api/series?days=28&aggregate=hourly
 * Returns all time series data for all SLIs
 * Format: { [sliId]: [{ t, good, bad, value }] }
 * 
 * NOTE: Demo data is anchored to Sept 26 - Oct 24, 2025 (fixed dates)
 * This prevents data from aging/creating gaps over time
 * 
 * Supports aggregation to reduce payload:
 * - raw: Return all 5-minute intervals (default for ≤7 days)
 * - hourly: Aggregate to hourly averages
 * - daily: Aggregate to daily averages (default for >7 days)
 */
app.get('/api/series', rateLimiters.heavy, validators.seriesQuery, cacheControl(60), asyncHandler(async (req, res) => {
  const { days } = req.query;
  const aggregate = req.query.aggregate || (days > 7 ? 'daily' : 'raw');
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  // For raw data, use the original N+1 approach (actually faster for individual queries)
  if (aggregate === 'raw') {
    const allSlis = await db.select({ id: slis.id }).from(slis);
    const seriesData = {};
    
    // Fetch in parallel using Promise.all for better performance
    await Promise.all(
      allSlis.map(async (sli) => {
        const points = await db
          .select({
            t: dataPoints.timestamp,
            good: dataPoints.good,
            bad: dataPoints.bad,
            value: dataPoints.value,
            p50: dataPoints.p50,
            p90: dataPoints.p90,
            p95: dataPoints.p95,
            p99: dataPoints.p99
          })
          .from(dataPoints)
          .where(
            and(
              eq(dataPoints.sliId, sli.id),
              gte(dataPoints.timestamp, cutoffDate)
            )
          )
          .orderBy(dataPoints.timestamp);
        
        seriesData[sli.id] = points.map(p => ({
          t: p.t.toISOString(),
          good: p.good,
          bad: p.bad,
          value: p.value ? parseFloat(p.value) : undefined,
          p50: p.p50 ? parseFloat(p.p50) : undefined,
          p90: p.p90 ? parseFloat(p.p90) : undefined,
          p95: p.p95 ? parseFloat(p.p95) : undefined,
          p99: p.p99 ? parseFloat(p.p99) : undefined
        }));
      })
    );
    
    return res.json(seriesData);
  }
  
  // For aggregated data, use raw SQL for reliability
  const truncFunc = aggregate === 'hourly' ? 'hour' : 'day';
  
  // Format cutoff date as ISO string for SQL
  const cutoffISO = cutoffDate.toISOString();
  
  // Use raw SQL query - completely bypassing Drizzle's template system
  const queryText = `
    SELECT 
      sli_id,
      date_trunc('${truncFunc}', timestamp) as bucket,
      SUM(good)::integer as good,
      SUM(bad)::integer as bad,
      AVG(value) as avg_value,
      AVG(p50) as avg_p50,
      AVG(p90) as avg_p90,
      AVG(p95) as avg_p95,
      AVG(p99) as avg_p99,
      COUNT(*)::integer as count
    FROM data_points
    WHERE timestamp >= '${cutoffISO}'
    GROUP BY sli_id, date_trunc('${truncFunc}', timestamp)
    ORDER BY sli_id, bucket
  `;
  
  const result = await db.execute(sql.raw(queryText));
  
  // The result is an array of rows directly
  const rows = Array.isArray(result) ? result : (result.rows || []);
  
  // Group by SLI ID
  const seriesData = {};
  
  for (const row of rows) {
    if (!seriesData[row.sli_id]) {
      seriesData[row.sli_id] = [];
    }
    
    seriesData[row.sli_id].push({
      t: new Date(row.bucket).toISOString(),
      good: parseInt(row.good),
      bad: parseInt(row.bad),
      value: row.avg_value ? parseFloat(parseFloat(row.avg_value).toFixed(2)) : undefined,
      p50: row.avg_p50 ? parseFloat(parseFloat(row.avg_p50).toFixed(2)) : undefined,
      p90: row.avg_p90 ? parseFloat(parseFloat(row.avg_p90).toFixed(2)) : undefined,
      p95: row.avg_p95 ? parseFloat(parseFloat(row.avg_p95).toFixed(2)) : undefined,
      p99: row.avg_p99 ? parseFloat(parseFloat(row.avg_p99).toFixed(2)) : undefined
    });
  }
  
  res.json(seriesData);
}));

/**
 * GET /api/series/:sliId?days=28
 * Returns time series data for a specific SLI
 */
app.get(
  '/api/series/:sliId',
  rateLimiters.api,
  validators.sliIdParam,
  validators.seriesQuery,
  cacheControl(60),
  asyncHandler(async (req, res) => {
    const { sliId } = req.params;
    const { days } = req.query;
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const points = await db
      .select({
        t: dataPoints.timestamp,
        good: dataPoints.good,
        bad: dataPoints.bad,
        value: dataPoints.value,
        p50: dataPoints.p50,
        p90: dataPoints.p90,
        p95: dataPoints.p95,
        p99: dataPoints.p99
      })
      .from(dataPoints)
      .where(
        and(
          eq(dataPoints.sliId, sliId),
          gte(dataPoints.timestamp, cutoffDate)
        )
      )
      .orderBy(dataPoints.timestamp);
    
    if (points.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: `No data found for SLI: ${sliId}`
      });
    }
    
    const formatted = points.map(p => ({
      t: p.t.toISOString(),
      good: p.good,
      bad: p.bad,
      value: p.value ? parseFloat(p.value) : undefined,
      p50: p.p50 ? parseFloat(p.p50) : undefined,
      p90: p.p90 ? parseFloat(p.p90) : undefined,
      p95: p.p95 ? parseFloat(p.p95) : undefined,
      p99: p.p99 ? parseFloat(p.p99) : undefined
    }));
    
    res.json(formatted);
  })
);

/**
 * POST /api/series/batch
 * Returns time series data for multiple SLIs
 * Body: { sliIds: string[] }
 */
app.post(
  '/api/series/batch',
  rateLimiters.heavy,
  validators.batchBody,
  validators.seriesQuery,
  cacheControl(60),
  asyncHandler(async (req, res) => {
    const { sliIds } = req.body;
    const { days } = req.query;
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const seriesData = {};
    
    for (const sliId of sliIds) {
      const points = await db
        .select({
          t: dataPoints.timestamp,
          good: dataPoints.good,
          bad: dataPoints.bad,
          value: dataPoints.value,
          p50: dataPoints.p50,
          p90: dataPoints.p90,
          p95: dataPoints.p95,
          p99: dataPoints.p99
        })
        .from(dataPoints)
        .where(
          and(
            eq(dataPoints.sliId, sliId),
            gte(dataPoints.timestamp, cutoffDate)
          )
        )
        .orderBy(dataPoints.timestamp);
      
      seriesData[sliId] = points.map(p => ({
        t: p.t.toISOString(),
        good: p.good,
        bad: p.bad,
        value: p.value ? parseFloat(p.value) : undefined,
        p50: p.p50 ? parseFloat(p.p50) : undefined,
        p90: p.p90 ? parseFloat(p.p90) : undefined,
        p95: p.p95 ? parseFloat(p.p95) : undefined,
        p99: p.p99 ? parseFloat(p.p99) : undefined
      }));
    }
    
    res.json(seriesData);
  })
);

// --- Error Handlers ---
app.use(notFoundHandler);
app.use(errorHandler);

// --- Server Start ---
const startServer = async () => {
  const dbHealthy = await testConnection();
  
  if (!dbHealthy) {
    console.error('❌ Cannot start server: database connection failed');
    console.error('   Please ensure PostgreSQL is running:');
    console.error('   docker compose up -d postgres');
    process.exit(1);
  }
  
  app.listen(config.server.port, () => {
    console.log('🚀 SLO Dashboard API Server running');
    console.log(`   Local:   http://localhost:${config.server.port}`);
    console.log(`   Health:  http://localhost:${config.server.port}/health`);
    console.log('');
    logConfig();
    console.log('');
    console.log('📊 Available endpoints:');
    console.log('   GET  /api/seed                  - Get experiences/journeys metadata');
    console.log('   GET  /api/series?days=28        - Get all series data');
    console.log('   GET  /api/series/:sliId?days=28 - Get series for specific SLI');
    console.log('   POST /api/series/batch          - Get series for multiple SLIs');
    console.log('');
    console.log('✨ Features:');
    console.log('   ✓ PostgreSQL database');
    console.log('   ✓ Drizzle ORM with type safety');
    console.log('   ✓ Zod validation');
    console.log(`   ${config.rateLimit.enabled ? '✓' : '✗'} Rate limiting`);
    console.log(`   ${config.cors.enabled ? '✓' : '✗'} CORS`);
    console.log(`   ${config.compression.enabled ? '✓' : '✗'} Gzip compression`);
    console.log('   ✓ Error handling');
  });
};

startServer();
