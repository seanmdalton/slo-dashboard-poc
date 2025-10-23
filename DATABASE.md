# SLO Dashboard - Database Setup

## Overview

The SLO Dashboard now uses **PostgreSQL** with **Drizzle ORM** for data persistence, replacing the previous JSON file approach. This provides:

- ✅ **Type-safe** database queries with full TypeScript support
- ✅ **Schema migrations** for version-controlled database evolution
- ✅ **Intelligent data seeding** with realistic incident patterns
- ✅ **1M+ data points** for comprehensive SLO analysis
- ✅ **Production-ready** architecture

## Tech Stack

- **Database**: PostgreSQL 16 (Alpine)
- **ORM**: Drizzle ORM v0.36
- **Schema Management**: Drizzle Kit
- **Validation**: Zod (ready for API validation)
- **Connection**: postgres.js client

## Database Schema

### Tables

1. **experiences** - Top-level groupings (e.g., "E-commerce", "In-store")
2. **journeys** - User flows within experiences (e.g., "Checkout", "Auth")
3. **slos** - Service Level Objectives with targets and owners
4. **slis** - Service Level Indicators (metrics) for each SLO
5. **data_points** - Time series data (1M+ points over 28 days)

### Relationships

```
experiences
  └── journeys
       └── slos
            └── slis
                 └── data_points
```

## Local Development Setup

### Prerequisites

- Docker & Docker Compose
- Node.js 18+
- npm

### Quick Start

```bash
# 1. Start PostgreSQL
docker compose up -d postgres

# 2. Install API dependencies
cd api
npm install

# 3. Run migrations
npm run db:migrate

# 4. Seed database with realistic data
npm run db:seed

# 5. Start API server
npm start
```

The API will be available at `http://localhost:3001`

### Environment Variables

Copy `.env.example` to `.env` (already done):

```bash
DB_HOST=localhost
DB_PORT=5432
DB_USER=slo_user
DB_PASSWORD=slo_password
DB_NAME=slo_dashboard
PORT=3001
```

## Database Commands

```bash
# Generate new migration from schema changes
npm run db:generate

# Run pending migrations
npm run db:migrate

# Seed database with test data
npm run db:seed

# Complete setup (migrate + seed)
npm run db:setup
```

## Data Seeding Strategy

The seed script (`api/db/seed.js`) generates **realistic SLO data** with:

### Incident Patterns

- **Healthy** (85-95% budget): No incidents
- **Minor** (70-85% budget): 1 incident, 3 hours
- **Moderate** (50-70% budget): 1 incident, 5 hours
- **Severe** (20-50% budget): 3 incidents across the month
- **Critical** (<20% budget): Chronic issues, multiple incidents
- **Breached** (<10% budget): Major outages exhausting budget

### Data Distribution

- **~60 SLOs**: Healthy services (85-95% budget)
- **~30 SLOs**: Minor issues (70-85% budget)
- **~20 SLOs**: At risk (50-70% budget)
- **~10 SLOs**: Critical (<50% budget)
- **~4 SLOs**: Breached (<10% budget)

### Time Series Data

- **8,065 data points** per SLI
- **5-minute intervals** over 28 days
- **Sharp incident degradations** visible in charts
- **Monotonic error budget consumption**

## API Endpoints

### `GET /health`
Health check with database connection status

### `GET /api/seed`
Returns all experiences, journeys, and SLOs with their indicators
```json
{
  "experiences": [
    {
      "name": "E-commerce",
      "journeys": [...]
    }
  ]
}
```

### `GET /api/series?days=28`
Returns time series data for all SLIs
```json
{
  "sli-login-2xx": [
    { "t": "2025-10-01T12:00:00Z", "good": 1000, "bad": 0 }
  ]
}
```

### `GET /api/series/:sliId?days=28`
Returns time series for a specific SLI

### `POST /api/series/batch`
Batch fetch time series for multiple SLIs
```json
{
  "sliIds": ["sli-login-2xx", "sli-checkout-2xx"]
}
```

## Schema Management

### Making Schema Changes

1. **Edit schema**: `api/db/schema.js`
2. **Generate migration**: `npm run db:generate`
3. **Review migration SQL**: Check `api/db/migrations/`
4. **Run migration**: `npm run db:migrate`

### Example: Adding a New Column

```javascript
// In api/db/schema.js
export const slos = pgTable('slos', {
  // ... existing columns
  tags: jsonb('tags'), // NEW COLUMN
});
```

```bash
npm run db:generate  # Generates migration
npm run db:migrate   # Applies migration
```

## Production Deployment

### Database Setup

1. **Provision PostgreSQL** (Render, AWS RDS, etc.)
2. **Set DATABASE_URL** environment variable
3. **Run migrations**: `npm run db:migrate`
4. **Optional**: Seed demo data for staging

### Environment Variables (Production)

```bash
DATABASE_URL=postgresql://user:pass@host:5432/dbname
PORT=3001
NODE_ENV=production
```

### Render Deployment

Update `render-api.yaml`:

```yaml
services:
  - type: web
    name: slo-dashboard-api
    runtime: node
    plan: free
    buildCommand: cd api && npm install && npm run db:migrate
    startCommand: cd api && npm start
    envVars:
      - key: DATABASE_URL
        sync: false # Set in Render dashboard
```

Add PostgreSQL database in Render:
1. Create "New PostgreSQL" database
2. Copy connection string to `DATABASE_URL`
3. Redeploy API service

## Monitoring & Maintenance

### Database Size

Current seed generates:
- **~1,000,000 data points**
- **~50-100 MB** database size
- **~8,000 points per SLI**

### Data Retention

To implement data retention (e.g., keep only 90 days):

```sql
DELETE FROM data_points 
WHERE timestamp < NOW() - INTERVAL '90 days';
```

### Performance

- **Indexes** on `sli_id` + `timestamp` for fast queries
- **Connection pooling** (default: 10 connections)
- **Query optimization** via Drizzle ORM

## Troubleshooting

### Database won't start

```bash
# Check Docker status
docker compose ps

# View logs
docker compose logs postgres

# Restart
docker compose restart postgres
```

### Connection refused

```bash
# Verify PostgreSQL is accepting connections
docker exec slo-dashboard-db pg_isready -U slo_user

# Check port
lsof -i :5432
```

### Migration fails

```bash
# Roll back manually if needed
docker exec -it slo-dashboard-db psql -U slo_user -d slo_dashboard

# List tables
\dt

# Drop and recreate (dev only!)
docker compose down -v
docker compose up -d postgres
npm run db:setup
```

### Slow queries

```bash
# Check query performance
docker exec -it slo-dashboard-db psql -U slo_user -d slo_dashboard

# Enable query logging
SET log_statement = 'all';
```

## Next Steps

- [ ] Add Zod validation schemas for API inputs
- [ ] Implement data aggregation/rollups for older data
- [ ] Add database backup strategy
- [ ] Set up monitoring alerts for database health
- [ ] Implement rate limiting per client
- [ ] Add caching layer (Redis) for frequently accessed data

## Resources

- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Docker Compose Docs](https://docs.docker.com/compose/)


