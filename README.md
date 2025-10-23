# SLO Dashboard - Sean's Automotive Parts & More

A comprehensive Service Level Objective (SLO) monitoring dashboard for tracking customer journeys across retail operations. Built with React, TypeScript, and Tailwind CSS to demonstrate best practices in observability and SLO management.

## 🎯 Overview

This dashboard provides a unified view of service reliability across **124 SLIs** spanning five major business domains:
- **E-commerce** (7 journeys): Auth, Search, Product Detail, Cart, Checkout, Payments, Store Locator
- **In-store** (5 journeys): POS, Self-Checkout, BOPIS Pickup, Returns, Partner Delivery
- **Order Management** (6 journeys): Promise & Split, Pick/Pack/Ship, Transportation, Curbside, Post-Purchase Changes, Returns
- **Marketing & Loyalty** (6 journeys): Enrollment, Balance & Offers, Cart/Checkout Apply, Campaigns, Notifications, Retail Media
- **Cross-Journey** (9 journeys): Payments Platform, Fraud Detection, Tax/Address/Geo, Messaging, Edge/CDN, Observability, CI/CD, Feature Flags, Data Infrastructure

Each journey contains multiple SLOs (Service Level Objectives) with real-time monitoring, error budget tracking, and automated incident detection.

## ✨ Features

### Master-Detail Navigation
- **Sidebar navigation** with hierarchical experience/journey structure
- **Collapsible sections** for each experience with health indicators
- **Master-detail pattern**: Click a journey to view full details in the main panel
- **Welcome screen** with global stats when no selection is made
- **Dark mode toggle** for comfortable viewing in any environment

### Smart Health Visualization
- **Stacked bar charts** showing SLO status distribution (OK/Warning/Critical) by tier
- **Auto-expand alerts**: Breaching or at-risk SLOs automatically expand for immediate attention
- **Color-coded indicators**:
  - 🟢 Green: Meeting objectives (< 50% error budget spent)
  - 🟡 Amber: At risk (50-80% budget spent)
  - 🔴 Red: Breaching (> 80% budget spent)

### Detailed SLO Monitoring
- **Compliance dial**: Visual gauge showing % of SLOs meeting objectives
- **Burn rate badges**: Real-time monitoring across 1h, 6h, 24h, and 3d windows
- **Error budget tracking**: Visual progress bars showing budget consumption
- **Time series charts**: 7-day primary SLI visualization with Recharts
- **Error budget heatmap**: Hour-by-day grid showing budget consumption patterns
- **Incident timeline**: Automated detection and visualization of service disruptions

### Progressive Disclosure
- **Collapsible tier sections**: Manage information density (Tier-0 expanded by default)
- **Expandable SLO cards**: Collapsed view shows key metrics, expanded view shows full details
- **Quick filters**: Filter by status (Breaching/At Risk/All) or owner team
- **Smart defaults**: Auto-expand problematic SLOs regardless of tier

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 19** | UI framework with latest features |
| **TypeScript** | Type safety and developer experience |
| **Vite 7** | Lightning-fast build tool and dev server |
| **Tailwind CSS 4** | Utility-first styling with dark mode support |
| **Recharts** | Composable charting library |
| **Zustand** | Lightweight state management |
| **React Router v6** | Client-side routing |

### Backend
| Technology | Purpose |
|------------|---------|
| **Node.js + Express** | REST API server |
| **PostgreSQL 16** | Relational database with 1M+ data points |
| **Drizzle ORM** | Type-safe database queries with migrations |
| **Zod** | Runtime validation and type safety |
| **Docker Compose** | Local development environment |

## 📁 Project Structure

```
slo-dashboard-poc/
├── src/                         # Frontend React application
│   ├── components/              # Reusable UI components
│   │   ├── BurnBar.tsx              # Error budget progress bar
│   │   ├── ExperienceHeader.tsx     # Experience summary with health metrics
│   │   ├── IncidentTimeline.tsx     # Incident detection and visualization
│   │   ├── SLIDial.tsx              # Circular compliance gauge
│   │   └── SLISpark.tsx             # Mini sparkline charts
│   ├── pages/
│   │   ├── Home.tsx                 # Main dashboard with sidebar navigation
│   │   └── Journey.tsx              # Journey detail view
│   ├── lib/
│   │   └── sloMath.ts               # SLO calculation utilities
│   ├── models/
│   │   └── slo.ts                   # TypeScript type definitions
│   ├── store/
│   │   └── useData.ts               # Zustand data store (API integration)
│   └── data/
│       └── seed.json                # Static SLO definitions (used by seeder)
├── api/                         # Backend Express API
│   ├── db/
│   │   ├── schema.js                # Drizzle ORM schema definitions
│   │   ├── connection.js            # PostgreSQL connection
│   │   ├── migrate.js               # Migration runner
│   │   ├── seed.js                  # Intelligent data seeder
│   │   └── migrations/              # Version-controlled SQL migrations
│   ├── server.js                    # Express API server
│   ├── package.json
│   └── drizzle.config.js            # Drizzle Kit configuration
├── docker-compose.yml           # PostgreSQL container
├── DATABASE.md                  # Database setup guide
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Docker & Docker Compose

### Installation

```bash
# 1. Start PostgreSQL database
docker compose up -d postgres

# 2. Install frontend dependencies
npm install

# 3. Install API dependencies and set up database
cd api
npm install
npm run db:setup  # Runs migrations + seeds 1M data points

# 4. Start API server (in one terminal)
npm start  # Runs on http://localhost:3001

# 5. Start frontend dev server (in another terminal)
cd ..
npm run dev  # Runs on http://localhost:5173
```

The application will be available at `http://localhost:5173`.

**See [DATABASE.md](DATABASE.md) for detailed database setup and management.**

## 📊 Key Concepts

### Service Level Indicators (SLIs)
Quantitative measures of service quality with five types:
- **Availability**: Ratio of successful requests (e.g., % 2xx responses)
- **Latency**: Response time percentiles (p95, p99)
- **Quality**: Success rates for specific operations (e.g., auth approval rate)
- **Correctness**: Data accuracy metrics (e.g., pricing/tax correctness)
- **Freshness**: Data recency and timeliness

### Service Level Objectives (SLOs)
Target values for SLIs over a time window:
- **Objective**: Target percentage (e.g., 99.9% availability)
- **Budgeting Window**: Measurement period (default: 28 days)
- **Error Budget**: Allowed failure = 100% - Objective%
  - Example: 99.9% SLO → 0.1% error budget

### Error Budget Calculation
```typescript
spent = (100 - achievedPercent) / errorBudgetPercent
remaining = max(0, 1 - spent)
```

**Status Thresholds:**
- 🟢 **Healthy**: < 50% budget spent
- 🟡 **At Risk**: 50-80% budget spent
- 🔴 **Breaching**: > 80% budget spent

### Burn Rate
Rate at which error budget is consumed:
```typescript
burnRate = (100 - currentPercent) / (100 - objectivePercent)
```

**Interpretation:**
- **< 1.0x**: Burning slower than target (green)
- **1.0-2.0x**: Burning faster, needs attention (amber)
- **> 2.0x**: Critical burn rate (red)

### Tier Classifications
- **Tier-0** (Purple): Critical customer-facing SLOs (99.9-99.99% targets)
- **Tier-1** (Blue): Important but not critical (95-99% targets)
- **Tier-2** (Gray): Internal or lower-priority services

### Automated Incident Detection
Incidents are automatically detected and marked when:
- **Availability/Quality SLIs**: Value drops below `target - 0.3%`
- **Latency SLIs**: Value exceeds `target × 1.25`

## 🎨 Design System

### Color Palette
| Status | Color | Hex | Usage |
|--------|-------|-----|-------|
| Success | Green | `#10b981` | Meeting objectives, within budget |
| Warning | Amber | `#f59e0b` | At risk, warning state |
| Critical | Red | `#ef4444` | Breaching, critical alerts |
| Tier-0 | Purple | `#a855f7` | Critical tier badge |
| Tier-1 | Blue | `#3b82f6` | Important tier badge |
| Tier-2 | Gray | `#6b7280` | Standard tier badge |

### Dark Mode
- Automatically detects system preference on first load
- Persists user selection in `localStorage`
- Toggle via button in top navigation bar
- Full support across all components and visualizations

## 📜 Available Scripts

### Frontend (root directory)
| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build optimized production bundle |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint for code quality checks |

### API (api directory)
| Command | Description |
|---------|-------------|
| `npm start` | Start API server |
| `npm run dev` | Start with auto-reload |
| `npm run db:generate` | Generate migration from schema changes |
| `npm run db:migrate` | Run pending migrations |
| `npm run db:seed` | Seed database with realistic test data |
| `npm run db:setup` | Full setup (migrate + seed) |

### Docker
| Command | Description |
|---------|-------------|
| `docker compose up -d` | Start PostgreSQL in background |
| `docker compose down` | Stop and remove containers |
| `docker compose logs postgres` | View PostgreSQL logs |

## 🧮 Data Generation

Time series data is intelligently generated and stored in PostgreSQL:

```bash
cd api
npm run db:seed
```

**Generates:**
- **28 days** of historical data (5-minute intervals)
- **1,000,000+ data points** across 124 SLIs
- **Realistic incident patterns** with sharp degradations
- **Monotonic error budget consumption**
- **Diverse health states**: 60 healthy, 30 minor issues, 20 at-risk, 10 critical, 4 breached

**Incident Patterns:**
- **Healthy** (85-95% budget): No incidents
- **Minor** (70-85%): Single 3-hour incident
- **Moderate** (50-70%): Single 5-hour incident
- **Severe** (20-50%): Multiple incidents across month
- **Critical** (<20%): Chronic issues
- **Breached** (<10%): Major outages exhausting budget

Each SLO's data generation is calibrated to reach a specific error budget target, creating realistic demonstration scenarios.

## 🏗️ Architecture Decisions

### Why Master-Detail Pattern?
- **Focus**: Shows only relevant information, reducing cognitive load
- **Scalability**: Handles 100+ SLOs without overwhelming the interface
- **Navigation**: Clear hierarchy makes finding specific journeys intuitive
- **Progressive Disclosure**: Details appear only when needed

### Why Collapsible Sections?
- **Information Density**: Manages large datasets effectively
- **Prioritization**: Tier-0 (critical) expanded by default
- **Smart Defaults**: Auto-expands problematic SLOs for immediate attention
- **User Control**: Expand/collapse based on investigation needs

### Why PostgreSQL + Drizzle ORM?
- **Type Safety**: End-to-end TypeScript types from database to UI
- **Schema Migrations**: Version-controlled database evolution
- **Performance**: Indexed queries for fast time series retrieval
- **Production Ready**: Scalable architecture for real deployments
- **Developer Experience**: Type-safe queries with excellent tooling

## 🎯 Best Practices Encoded

1. **Customer-Journey Centric**: SLOs organized by customer experiences, not technical services
2. **Multi-Window Monitoring**: Fast detection (1h windows) + trend analysis (3d windows)
3. **Error Budget Focus**: Emphasize remaining budget over raw compliance percentage
4. **Visual Hierarchy**: Critical information prominently displayed with clear status indicators
5. **Actionable Insights**: Owner information and status messages guide response
6. **Accessible Design**: High contrast ratios, semantic colors, keyboard navigation
7. **Dark Mode Support**: Comfortable viewing in any environment
8. **Progressive Disclosure**: Show summary by default, details on demand

## 🚀 Deployment to Render

### Prerequisites
1. A [Render account](https://render.com) (free tier works)
2. Git repository pushed to GitHub/GitLab
3. Render CLI installed (optional, for seeding): `npm install -g render`

### Automatic Deployment

The project includes `render.yaml` which defines all services:
- **PostgreSQL database** (slo-dashboard-db)
- **API backend** (slo-dashboard-api)
- **Frontend** (slo-dashboard-poc)

**Steps**:

1. **Connect Repository**:
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Blueprint"
   - Connect your GitHub/GitLab repository
   - Render will detect `render.yaml` automatically

2. **Configure Environment Variables**:
   - Frontend (`slo-dashboard-poc`):
     - `VITE_API_URL` is auto-set to `https://slo-dashboard-api.onrender.com`
   - API (`slo-dashboard-api`):
     - `DATABASE_URL` is auto-linked to the PostgreSQL database
     - Set `CORS_ORIGIN` to your frontend URL (e.g., `https://slo-dashboard-poc.onrender.com`)
     - `RATE_LIMIT_ENABLED` is set to `true` for production

3. **Deploy**:
   - Click "Apply" to create all services
   - Wait for builds to complete (~5 minutes)
   - Database migrations run automatically during API build

4. **Seed the Database**:
   ```bash
   # Option 1: Using Render CLI
   ./scripts/seed-production.sh
   
   # Option 2: Using Render Dashboard
   # Go to slo-dashboard-api → Shell
   # Run: cd api && npm run db:seed
   ```

5. **Verify**:
   - Visit your frontend URL
   - You should see the dashboard with all SLOs populated

### Manual Deployment

If you prefer manual setup:

1. **Create PostgreSQL Database**:
   - New → PostgreSQL
   - Name: `slo-dashboard-db`
   - Database: `slo_dashboard`
   - User: `slo_user`
   - Plan: Free

2. **Create API Service**:
   - New → Web Service
   - Connect repository
   - Root Directory: `./`
   - Build Command: `cd api && npm install && npm run db:migrate`
   - Start Command: `cd api && npm start`
   - Environment Variables:
     - `NODE_ENV=production`
     - `DATABASE_URL` (from database)
     - `RATE_LIMIT_ENABLED=true`
     - `CORS_ORIGIN=<your-frontend-url>`

3. **Create Frontend Service**:
   - New → Static Site
   - Build Command: `npm install && npm run build`
   - Publish Directory: `dist`
   - Environment Variables:
     - `VITE_API_URL=<your-api-url>`

### Post-Deployment

- **Check API Health**: `https://your-api.onrender.com/health`
- **Monitor Logs**: Render Dashboard → Service → Logs
- **Update Data**: Re-run seed script anytime to refresh demo data

### Cost
- **Free Tier**: Everything runs on free tier
  - Database: 1GB storage, expires after 90 days
  - Services: Spin down after 15min inactivity, cold start ~30s
- **Paid Tier**: Faster, persistent, no cold starts ($7/month per service)

## 🔮 Future Enhancements

- [ ] Real-time data streaming via WebSocket
- [ ] Global search by journey/SLO/owner/team
- [ ] Export dashboards to PNG/PDF
- [ ] Custom date range selection
- [ ] Alert configuration UI
- [ ] Historical trend comparison
- [ ] SLO template library
- [ ] Integration with alerting systems (PagerDuty, Slack)
- [ ] Multi-tenancy support
- [ ] Custom dashboard layouts with drag-and-drop

## 📚 Learning Resources

This project demonstrates concepts from:
- [Google SRE Book - Service Level Objectives](https://sre.google/sre-book/service-level-objectives/)
- [The Site Reliability Workbook - Implementing SLOs](https://sre.google/workbook/implementing-slos/)
- [Sloth - SLO Calculator](https://github.com/slok/sloth)

## 🤝 Contributing

This is a proof-of-concept project. Feel free to fork and adapt for your needs.

## 📄 License

MIT

---

**Built with ❤️ to demonstrate best practices in SLO management and observability**
