# Project Rules - SLO Dashboard

## General Principles

- **Show, don't tell**: Implement fixes and changes directly rather than describing them
- **Verify after changes**: Check linters, run tests, verify services are running
- **One concern per change**: Keep commits focused and atomic
- **Performance matters**: This is a data-heavy dashboard with 1M+ data points

## Documentation

### ❌ DON'T
- Create standalone markdown files explaining changes (REGENERATE_DATABASE.md, FIX_SUMMARY.md, etc.)
- Write verbose explanations of problems and solutions in separate files
- Create documentation files for temporary issues or fixes

### ✅ DO
- Update README.md and DATABASE.md if architecture fundamentally changes
- Write clear code comments for complex logic (error budget calculations, data aggregation)
- Add JSDoc comments for exported functions and complex types
- Keep commit messages descriptive
- Explain fixes directly in the chat response

## Code Style

### TypeScript/React
- Use functional components with hooks
- Prefer `const` over `let`
- Use explicit types, avoid `any`
- Use `useMemo` for expensive calculations
- Use `useCallback` for handlers passed to children

### Naming
- Components: PascalCase (`SLOCard`, `IncidentTimeline`)
- Files: Match component name (`SLOCard.tsx`)
- Functions: camelCase, descriptive verbs (`calculateErrorBudget`, `getLatencyCompliancePercent`)
- Constants: SCREAMING_SNAKE_CASE for true constants (`API_BASE_URL`)

### Imports
- Group: React, libraries, local components, types
- Use absolute imports from `src/` when appropriate
- Avoid deep relative imports (`../../../utils`)

## Testing

### Current State
- No test suite implemented yet
- Manual testing via browser + hard refresh
- API health checks: `curl http://localhost:3001/health`

### When to Test
- After data model changes (error budget calculations)
- After API changes (new endpoints, aggregation logic)
- Before committing breaking changes
- When fixing bugs (verify the fix works)

### How to Test
1. **Frontend**: Hard refresh browser (Ctrl+Shift+R), check console for errors
2. **API**: Check `/health` endpoint, verify response times
3. **Database**: Query counts, verify seed data structure
4. **Integration**: Navigate through journeys, expand SLOs, check charts

### Future Testing Strategy
- Add Vitest for unit tests (error budget math, data transformations)
- Add React Testing Library for component tests
- Add Playwright for E2E tests (critical user flows)
- Focus on high-value tests (not 100% coverage)

## Database & Data

### Seed Data
- Located in `api/db/seed.js`
- Generates 1M+ data points (28 days @ 5min intervals)
- Uses incident patterns for realistic degradation
- Regenerate: `./regenerate-db.sh` or `npm run db:seed`

### Key Concepts
- **Error budgets are cumulative**: Once spent, they don't recover within the window
- **Latency metrics**: Calculate % of time meeting target (not average latency)
- **Availability metrics**: Calculate good/(good+bad) ratio
- **Aggregation**: Use `hourly` for 28-day views (672 points vs 8064 raw)

### Database Commands
```bash
# Check connection
docker exec slo-dashboard-db pg_isready -U slo_user

# Query data
docker exec slo-dashboard-db psql -U slo_user -d slo_dashboard -c "SELECT COUNT(*) FROM data_points;"

# Reset database
docker-compose down -v && docker-compose up -d
```

## Performance

### Critical Paths
- `/api/series?days=28&aggregate=hourly` - Main data endpoint (~1s)
- Chart rendering with 672 data points per SLI
- Zustand state updates (debounce if needed)

### Optimization Rules
- Use server-side aggregation (raw SQL for complex queries)
- Memoize expensive calculations in React (`useMemo`, `useCallback`)
- Lazy load chart components if performance degrades
- Consider virtualization for long SLO lists (not needed yet)

### What to Monitor
- API response times (check browser DevTools Network tab)
- Initial page load (should be <3s)
- Chart interactions (should feel instant)
- Database query times (check API logs)

## API Development

### Configuration
- All config in `api/config.js` (environment variables)
- Rate limiting disabled for local dev (`.env`: `RATE_LIMIT_ENABLED=false`)
- CORS enabled for localhost:5173

### Adding Endpoints
1. Add route in `api/server.js`
2. Add Zod validation schema in `api/validation/schemas.js`
3. Apply rate limiter middleware
4. Test with curl before integrating frontend

### Database Queries
- Use Drizzle ORM for simple queries
- Use raw SQL (`db.execute(sql.raw(...))`) for complex aggregations
- Always use parameterized queries (SQL injection prevention)
- Add indexes if query times > 100ms

## Error Handling

### Frontend
- Show user-friendly error messages
- Log errors to console (use `console.error`, not `console.log`)
- Handle loading states (show skeletons or spinners)
- Handle empty states (no data, no SLOs)

### Backend
- Use try-catch in async route handlers
- Return appropriate HTTP status codes
- Include error details in development, generic messages in production
- Log errors with context (req.path, req.query)

## Common Pitfalls

### Error Budget Calculations
- ❌ Using average latency instead of compliance percentage
- ❌ Calculating per-day instead of cumulative
- ❌ Forgetting to convert latency to percentage before `calculateErrorBudget()`
- ✅ Use `getLatencyCompliancePercent()` for all latency metrics
- ✅ Track cumulative good/bad/compliance across time

### Data Aggregation
- ❌ Fetching raw 5-minute data for 28-day views (too slow)
- ❌ Using Drizzle ORM for complex GROUP BY queries (generates bad SQL)
- ✅ Use `?aggregate=hourly` for views > 7 days
- ✅ Use raw SQL for `date_trunc`, `SUM`, `AVG`, `COUNT`

### Caching
- ❌ Browser caching old JavaScript (user sees stale data)
- ✅ Always instruct user to hard refresh after code changes
- ✅ Consider cache busting in production build

### State Management
- ❌ Storing 1M data points in React state (too slow)
- ❌ Re-calculating error budgets on every render
- ✅ Use Zustand for global state (series data)
- ✅ Memoize calculations in components

## Development Workflow

### Starting Services
```bash
# Start database
docker-compose up -d

# Start API (in api/)
npm start

# Start frontend (in root)
npm run dev
```

### Making Changes
1. Make code changes
2. Check linter output (if editing)
3. Test in browser (hard refresh!)
4. Check browser console and network tab
5. Verify in multiple scenarios (healthy, at-risk, breached SLOs)

### Regenerating Data
```bash
# Quick regeneration
./regenerate-db.sh

# Manual
npm run db:seed  # in api/
```

### Debugging
- **Frontend**: Browser DevTools (Console, Network, React DevTools)
- **API**: Check `/tmp/api.log` for request logs and errors
- **Database**: Use `psql` to query directly
- **React**: Use React DevTools to inspect state and props

## Mobile Responsiveness

### Breakpoints (Tailwind)
- Mobile: `<768px` (default styles)
- Tablet: `md:` (768px+)
- Desktop: `lg:` (1024px+)

### Touch Targets
- Minimum 44px height for interactive elements
- Use `min-h-[44px]` utility class
- Test on actual mobile device or Chrome DevTools device emulation

### Chart Behavior
- Hide complex charts on mobile (show summary cards instead)
- Make tables horizontally scrollable
- Collapse sidebar into hamburger menu

## When Things Break

### Frontend won't load
1. Hard refresh browser
2. Check `/tmp/vite.log`
3. Restart: `lsof -ti:5173 | xargs kill -9 && npm run dev`

### API not responding
1. Check API is running: `curl http://localhost:3001/health`
2. Check `/tmp/api.log`
3. Restart: `lsof -ti:3001 | xargs kill -9 && cd api && npm start`

### Database connection errors
1. Check Docker: `docker ps | grep slo-dashboard-db`
2. Test connection: `docker exec slo-dashboard-db pg_isready`
3. Restart: `docker-compose restart`

### Data looks wrong
1. Check when data was last seeded: query `data_points` table
2. Regenerate: `./regenerate-db.sh`
3. Verify aggregation: check `/api/series` response in browser

## Summary

- ✅ Write code, not documentation files
- ✅ Test your changes (browser, curl, database)
- ✅ Mind performance (aggregation, memoization)
- ✅ Use cumulative error budget calculations
- ✅ Hard refresh browser after frontend changes
- ❌ Don't create markdown documentation files
- ❌ Don't use average latency for error budgets
- ❌ Don't fetch raw data for long time ranges

