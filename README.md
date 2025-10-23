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

| Technology | Purpose |
|------------|---------|
| **React 19** | UI framework with latest features |
| **TypeScript** | Type safety and developer experience |
| **Vite 7** | Lightning-fast build tool and dev server |
| **Tailwind CSS 4** | Utility-first styling with dark mode support |
| **Recharts** | Composable charting library |
| **Zustand** | Lightweight state management |
| **React Router v6** | Client-side routing |
| **PostCSS** | CSS processing and optimization |

## 📁 Project Structure

```
slo-dashboard-poc/
├── src/
│   ├── components/              # Reusable UI components
│   │   ├── BurnBar.tsx              # Error budget progress bar
│   │   ├── ErrorBudgetHeatmap.tsx   # Hour-by-day heatmap visualization
│   │   ├── ExperienceHeader.tsx     # Experience summary with health metrics
│   │   ├── IncidentTimeline.tsx     # Incident detection and visualization
│   │   ├── JourneyCard.tsx          # Journey preview card (deprecated)
│   │   ├── SLIDial.tsx              # Circular compliance gauge
│   │   └── SLISpark.tsx             # Mini sparkline charts
│   ├── pages/
│   │   ├── Home.tsx                 # Main dashboard with sidebar navigation
│   │   └── Journey.tsx              # Journey detail view (deprecated)
│   ├── lib/
│   │   └── sloMath.ts               # SLO calculation utilities
│   ├── models/
│   │   └── slo.ts                   # TypeScript type definitions
│   ├── store/
│   │   └── useData.ts               # Zustand data store
│   └── data/
│       ├── seed.json                # Static SLO definitions
│       └── series.json              # Generated time series data
├── scripts/
│   └── generate.ts                  # Time series data generator
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm

### Installation

```bash
# Clone the repository
cd slo-dashboard-poc

# Install dependencies
npm install

# Generate time series data (106 SLIs × 8,065 data points)
npm run gen

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173` (or next available port).

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

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build optimized production bundle |
| `npm run preview` | Preview production build locally |
| `npm run gen` | Generate time series data for all SLIs |
| `npm run lint` | Run ESLint for code quality checks |

## 🧮 Data Generation

Time series data is generated using `scripts/generate.ts` with realistic patterns:

```bash
npm run gen
```

**Generates:**
- 28 days of historical data
- 5-minute intervals (8,065 data points per SLI)
- Gaussian distribution with configurable volatility
- Separate generators for availability vs. latency metrics
- Output: `src/data/series.json` (~40MB)

**Generator Functions:**
- `genAvailSeries(baseGood, volatility)` - For availability/quality SLIs
- `genLatencySeries(targetMs, sigma)` - For latency SLIs

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

### Why Client-Side Calculations?
- **Proof of Concept**: No backend required for demo
- **Real-time**: Instant metric updates without API latency
- **Memoization**: Zustand + useMemo for performance optimization
- **Flexibility**: Easy to experiment with different thresholds and formulas

## 🎯 Best Practices Encoded

1. **Customer-Journey Centric**: SLOs organized by customer experiences, not technical services
2. **Multi-Window Monitoring**: Fast detection (1h windows) + trend analysis (3d windows)
3. **Error Budget Focus**: Emphasize remaining budget over raw compliance percentage
4. **Visual Hierarchy**: Critical information prominently displayed with clear status indicators
5. **Actionable Insights**: Owner information and status messages guide response
6. **Accessible Design**: High contrast ratios, semantic colors, keyboard navigation
7. **Dark Mode Support**: Comfortable viewing in any environment
8. **Progressive Disclosure**: Show summary by default, details on demand

## 🔮 Future Enhancements

- [ ] Real-time data streaming via WebSocket
- [ ] Global search by journey/SLO/owner/team
- [ ] Export dashboards to PNG/PDF
- [ ] Custom date range selection
- [ ] Alert configuration UI
- [ ] Historical trend comparison
- [ ] SLO template library
- [ ] Integration with alerting systems (PagerDuty, Slack)
- [ ] Mobile-responsive design
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
