import { writeFileSync } from "fs";

type Point = { t: string; good: number; bad: number; value?: number };
const now = new Date();
const start = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000); // 28 days ago
const stepMin = 5;

function randn(mu: number, sigma: number) {
  // Box-Muller transform
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mu + sigma * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

interface Incident {
  startHour: number;
  durationHours: number;
  severity: number; // Absolute % drop from baseline (e.g., 0.02 = 2% drop)
}

/**
 * Calculate baseline to achieve target error budget consumption
 * 
 * For a 99.9% target with 80% budget remaining:
 * - Error budget = 0.1%
 * - We can spend 20% of 0.1% = 0.02%
 * - So we can fail 0.02% of the time
 * - Therefore we need to achieve 99.98% on average
 * 
 * Formula: achieved = target + (errorBudget * (1 - targetBudgetRemaining))
 * But we need to account for incidents too.
 */
function calculateBaseline(
  target: number,
  targetBudgetRemaining: number,
  incidents: Incident[]
): number {
  const errorBudget = 1 - target; // e.g., 0.001 for 99.9%
  const budgetToSpend = 1 - targetBudgetRemaining; // e.g., 0.2 for 80% remaining
  const totalErrorAllowed = errorBudget * budgetToSpend; // e.g., 0.0002 (0.02%)
  
  // Calculate incident contribution (time-weighted average degradation)
  const totalHours = 28 * 24;
  let incidentErrorContribution = 0;
  for (const inc of incidents) {
    // This incident contributes (severity * duration / total time) to average error rate
    incidentErrorContribution += (inc.severity * inc.durationHours) / totalHours;
  }
  
  // Baseline error = total allowed - incident contribution
  // This is the "steady state" error rate we need during non-incident periods
  const baselineErrorRate = Math.max(0, totalErrorAllowed - incidentErrorContribution);
  
  // Baseline success rate = 1 - baselineErrorRate
  // But it should not exceed target (we can't be "too good" and save budget for later)
  return Math.max(0.5, 1 - baselineErrorRate);
}

/**
 * Generate realistic availability series
 */
function genAvailSeriesRealistic(
  target: number,
  targetBudgetRemaining: number,
  incidents: Incident[] = []
): Point[] {
  const baseline = calculateBaseline(target, targetBudgetRemaining, incidents);
  const out: Point[] = [];
  const verySmallNoise = 0.00003; // Minimal noise
  
  for (let t = new Date(start); t <= now; t = new Date(t.getTime() + stepMin * 60 * 1000)) {
    const hoursSinceStart = (t.getTime() - start.getTime()) / (60 * 60 * 1000);
    
    // Check if we're in an incident window
    let degradation = 0;
    for (const incident of incidents) {
      if (hoursSinceStart >= incident.startHour && 
          hoursSinceStart < incident.startHour + incident.durationHours) {
        degradation = Math.max(degradation, incident.severity);
      }
    }
    
    // Calculate success rate: baseline - degradation + tiny noise
    const targetRate = Math.max(0.5, baseline - degradation);
    const pGood = Math.max(0.5, Math.min(1, randn(targetRate, verySmallNoise)));
    
    const total = 1000;
    const good = Math.round(total * pGood);
    const bad = total - good;
    out.push({ t: t.toISOString(), good, bad });
  }
  return out;
}

/**
 * Generate realistic latency series
 */
function genLatencySeriesRealistic(
  targetMs: number,
  targetBudgetRemaining: number,
  incidents: Incident[] = []
): Point[] {
  const out: Point[] = [];
  
  // Calculate baseline latency to achieve target budget
  // Lower budget remaining = higher baseline latency
  const budgetFactor = 1 - targetBudgetRemaining; // 0.2 for 80% remaining
  const baselineMs = targetMs * (0.5 + budgetFactor * 0.3); // 50-80% of target
  const noise = targetMs * 0.05;
  
  for (let t = new Date(start); t <= now; t = new Date(t.getTime() + stepMin * 60 * 1000)) {
    const hoursSinceStart = (t.getTime() - start.getTime()) / (60 * 60 * 1000);
    
    // Check if we're in an incident window
    let spike = 1.0;
    for (const incident of incidents) {
      if (hoursSinceStart >= incident.startHour && 
          hoursSinceStart < incident.startHour + incident.durationHours) {
        spike = Math.max(spike, incident.severity); // For latency, severity is a multiplier
      }
    }
    
    const latency = Math.max(10, randn(baselineMs * spike, noise));
    out.push({ t: t.toISOString(), good: 0, bad: 0, value: Math.round(latency) });
  }
  return out;
}

// Incident scenarios - SHARP, VISIBLE degradations

// Healthy: 85-95% budget remaining
const healthy: Incident[] = [];

// Minor: 70-85% budget remaining
const minorIncident: Incident[] = [
  { startHour: 24 * 18, durationHours: 3, severity: 0.010 } // Day 18, 3h, 1% drop
];

// Moderate: 50-70% budget remaining  
const moderateIncident: Incident[] = [
  { startHour: 24 * 14, durationHours: 5, severity: 0.018 } // Day 14, 5h, 1.8% drop
];

// Severe: 20-50% budget remaining
const severeIncidents: Incident[] = [
  { startHour: 24 * 8, durationHours: 2, severity: 0.025 },   // Day 8, 2h, 2.5% drop
  { startHour: 24 * 16, durationHours: 4, severity: 0.020 },  // Day 16, 4h, 2% drop
  { startHour: 24 * 24, durationHours: 3, severity: 0.015 }   // Day 24, 3h, 1.5% drop
];

// Critical: <20% budget remaining
const criticalIncidents: Incident[] = [
  { startHour: 24 * 5, durationHours: 8, severity: 0.035 },   // Day 5, 8h, 3.5% drop
  { startHour: 24 * 12, durationHours: 6, severity: 0.028 },  // Day 12, 6h, 2.8% drop
  { startHour: 24 * 20, durationHours: 5, severity: 0.032 }   // Day 20, 5h, 3.2% drop
];

// Breached: 0% budget (exhausted)
const breachedIncidents: Incident[] = [
  { startHour: 24 * 3, durationHours: 10, severity: 0.045 },  // Day 3, 10h, 4.5% drop
  { startHour: 24 * 10, durationHours: 8, severity: 0.038 },  // Day 10, 8h, 3.8% drop
  { startHour: 24 * 17, durationHours: 10, severity: 0.042 }, // Day 17, 10h, 4.2% drop
  { startHour: 24 * 25, durationHours: 6, severity: 0.035 }   // Day 25, 6h, 3.5% drop
];

// Latency spike patterns (multipliers)
const minorLatencySpikes: Incident[] = [
  { startHour: 24 * 19, durationHours: 1, severity: 2.0 }
];

const moderateLatencySpikes: Incident[] = [
  { startHour: 24 * 12, durationHours: 2, severity: 2.5 },
  { startHour: 24 * 22, durationHours: 1.5, severity: 2.8 }
];

const severeLatencySpikes: Incident[] = [
  { startHour: 24 * 7, durationHours: 1, severity: 4.0 },
  { startHour: 24 * 15, durationHours: 2, severity: 3.2 },
  { startHour: 24 * 23, durationHours: 1, severity: 4.5 }
];

const series = {
  // E-commerce Auth & Account
  "sli-login-2xx": genAvailSeriesRealistic(0.9995, 0.90, healthy), // 90% remaining
  "sli-registration-2xx": genAvailSeriesRealistic(0.9990, 0.75, minorIncident), // 75% remaining
  "sli-pwd-reset-2xx": genAvailSeriesRealistic(0.9950, 0.60, moderateIncident), // 60% remaining
  "sli-account-p95": genLatencySeriesRealistic(800, 0.80, minorLatencySpikes),
  
  // E-commerce Search & Discovery
  "sli-search-2xx": genAvailSeriesRealistic(0.9990, 0.85, healthy), // 85% remaining
  "sli-search-p95": genLatencySeriesRealistic(300, 0.65, moderateLatencySpikes),
  "sli-search-quality": genAvailSeriesRealistic(0.9500, 0.30, severeIncidents), // 30% remaining - CRITICAL
  
  // E-commerce Product Detail (PDP)
  "sli-pdp-2xx": genAvailSeriesRealistic(0.9995, 0.88, healthy), // 88% remaining
  "sli-pdp-p95": genLatencySeriesRealistic(1000, 0.80, minorLatencySpikes),
  "sli-pdp-images": genAvailSeriesRealistic(0.9950, 0.75, minorIncident), // 75% remaining
  
  // E-commerce Cart
  "sli-add-cart-2xx": genAvailSeriesRealistic(0.9990, 0.85, healthy), // 85% remaining
  "sli-cart-p95": genLatencySeriesRealistic(600, 0.90, healthy),
  "sli-cart-update": genAvailSeriesRealistic(0.9950, 0.72, minorIncident), // 72% remaining
  
  // E-commerce Checkout
  "sli-checkout-2xx": genAvailSeriesRealistic(0.9995, 0.90, healthy), // 90% remaining - Tier-0
  "sli-place-order-p95-web": genLatencySeriesRealistic(1200, 0.60, moderateLatencySpikes),
  "sli-place-order-p95-app": genLatencySeriesRealistic(900, 0.75, minorLatencySpikes),
  "sli-auth-approve-overall": genAvailSeriesRealistic(0.9850, 0.55, moderateIncident), // 55% remaining
  "sli-psp-2xx": genAvailSeriesRealistic(0.9995, 0.92, healthy), // 92% remaining
  "sli-3ds-success": genAvailSeriesRealistic(0.9700, 0.70, minorIncident), // 70% remaining
  "sli-wallet-apple": genAvailSeriesRealistic(0.9920, 0.85, healthy), // 85% remaining
  "sli-wallet-google": genAvailSeriesRealistic(0.9920, 0.85, healthy), // 85% remaining
  "sli-fraud-p95": genLatencySeriesRealistic(200, 0.90, healthy),
  "sli-order-correct": genAvailSeriesRealistic(0.9999, 0.95, healthy), // 95% remaining - Excellent
  "sli-pricing-correct": genAvailSeriesRealistic(0.9999, 0.95, healthy), // 95% remaining
  "sli-tax-correct": genAvailSeriesRealistic(0.9999, 0.95, healthy), // 95% remaining
  "sli-inventory-bopis": genAvailSeriesRealistic(0.9990, 0.75, minorIncident), // 75% remaining
  "sli-inventory-ship": genAvailSeriesRealistic(0.9950, 0.85, healthy), // 85% remaining
  "sli-promo-apply": genAvailSeriesRealistic(0.9950, 0.72, minorIncident), // 72% remaining
  "sli-address-p95": genLatencySeriesRealistic(250, 0.90, healthy),
  "sli-cart-checkout": genAvailSeriesRealistic(0.9970, 0.80, healthy), // 80% remaining
  "sli-receipt-dispatch": genAvailSeriesRealistic(0.9990, 0.85, healthy), // 85% remaining
  "sli-settlement-time": genAvailSeriesRealistic(0.9995, 0.88, healthy), // 88% remaining
  
  // E-commerce Payments
  "sli-payment-proc-2xx": genAvailSeriesRealistic(0.9999, 0.95, healthy), // 95% remaining - Excellent
  "sli-payment-p95": genLatencySeriesRealistic(800, 0.85, healthy),
  "sli-gateway-success": genAvailSeriesRealistic(0.9950, 0.75, minorIncident), // 75% remaining
  "sli-refund-success": genAvailSeriesRealistic(0.9990, 0.82, healthy), // 82% remaining
  
  // E-commerce Store Locator
  "sli-store-loc-2xx": genAvailSeriesRealistic(0.9990, 0.85, healthy), // 85% remaining
  "sli-fis-2xx": genAvailSeriesRealistic(0.9950, 0.73, minorIncident), // 73% remaining
  "sli-inv-check-p95": genLatencySeriesRealistic(500, 0.78, minorLatencySpikes),
  "sli-hours-accuracy": genAvailSeriesRealistic(0.9900, 0.82, healthy), // 82% remaining
  
  // In-store POS Checkout
  "sli-pos-complete": genAvailSeriesRealistic(0.9995, 0.90, healthy), // 90% remaining
  "sli-tender-overall": genAvailSeriesRealistic(0.9880, 0.75, minorIncident), // 75% remaining
  "sli-tender-contactless": genAvailSeriesRealistic(0.9920, 0.82, healthy), // 82% remaining
  "sli-lane-add-item": genLatencySeriesRealistic(150, 0.90, healthy),
  "sli-lane-total": genLatencySeriesRealistic(500, 0.88, healthy),
  "sli-lane-tender": genLatencySeriesRealistic(700, 0.75, minorLatencySpikes),
  "sli-scanner-rate": genAvailSeriesRealistic(0.9950, 0.85, healthy), // 85% remaining
  "sli-receipt-p95": genLatencySeriesRealistic(2000, 0.65, moderateLatencySpikes),
  "sli-peripheral-ready": genAvailSeriesRealistic(0.9990, 0.85, healthy), // 85% remaining
  "sli-offline-success": genAvailSeriesRealistic(0.9950, 0.83, healthy), // 83% remaining
  "sli-price-match": genAvailSeriesRealistic(0.9999, 0.95, healthy), // 95% remaining - Excellent
  "sli-loyalty-success": genAvailSeriesRealistic(0.9950, 0.72, minorIncident), // 72% remaining
  "sli-cash-reconcile": genAvailSeriesRealistic(0.9990, 0.85, healthy), // 85% remaining
  
  // In-store Self-Checkout
  "sli-sco-uptime": genAvailSeriesRealistic(0.9950, 0.73, minorIncident), // 73% remaining
  "sli-sco-intervention": genAvailSeriesRealistic(0.8500, 0.15, criticalIncidents), // 15% remaining - CRITICAL
  "sli-sco-completion": genAvailSeriesRealistic(0.9200, 0.35, severeIncidents), // 35% remaining - SEVERE
  "sli-sco-txn-p95": genLatencySeriesRealistic(180000, 0.78, minorLatencySpikes),
  
  // In-store BOPIS/Store Pickup
  "sli-order-locate": genAvailSeriesRealistic(0.9990, 0.85, healthy), // 85% remaining
  "sli-pick-slip": genAvailSeriesRealistic(0.9950, 0.83, healthy), // 83% remaining
  "sli-handoff-p95": genLatencySeriesRealistic(300000, 0.77, minorLatencySpikes),
  "sli-ready-notify": genAvailSeriesRealistic(0.9900, 0.75, minorIncident), // 75% remaining
  
  // In-store Returns & Exchanges
  "sli-rma-lookup": genAvailSeriesRealistic(0.9990, 0.85, healthy), // 85% remaining
  "sli-refund-p95": genLatencySeriesRealistic(5000, 0.63, moderateLatencySpikes),
  "sli-tender-parity": genAvailSeriesRealistic(0.9999, 0.95, healthy), // 95% remaining - Excellent
  "sli-return-auth": genAvailSeriesRealistic(0.9800, 0.58, moderateIncident), // 58% remaining
  
  // In-store Partner Delivery
  "sli-partner-tx": genAvailSeriesRealistic(0.9990, 0.85, healthy), // 85% remaining
  "sli-partner-api": genAvailSeriesRealistic(0.9950, 0.73, minorIncident), // 73% remaining
  "sli-partner-accept": genAvailSeriesRealistic(0.9500, 0.60, moderateIncident), // 60% remaining
  "sli-pickup-status": genAvailSeriesRealistic(0.9900, 0.80, healthy), // 80% remaining
  
  // Order Management - Promise & Split
  "sli-promise-accuracy": genAvailSeriesRealistic(0.9500, 0.05, breachedIncidents), // 5% remaining - BREACHED
  "sli-split-success": genAvailSeriesRealistic(0.9950, 0.83, healthy), // 83% remaining
  "sli-backorder-correct": genAvailSeriesRealistic(0.9900, 0.75, minorIncident), // 75% remaining
  
  // Order Management - Pick/Pack/Ship
  "sli-dc-process": genAvailSeriesRealistic(0.9990, 0.85, healthy), // 85% remaining
  "sli-label-gen": genAvailSeriesRealistic(0.9990, 0.85, healthy), // 85% remaining
  "sli-handoff-scan": genAvailSeriesRealistic(0.9950, 0.83, healthy), // 83% remaining
  "sli-pick-accuracy": genAvailSeriesRealistic(0.9980, 0.87, healthy), // 87% remaining
  
  // Order Management - Transportation
  "sli-carrier-api": genAvailSeriesRealistic(0.9950, 0.73, minorIncident), // 73% remaining
  "sli-scan-compliance": genAvailSeriesRealistic(0.9800, 0.58, moderateIncident), // 58% remaining
  "sli-eta-accuracy": genAvailSeriesRealistic(0.9000, 0.18, criticalIncidents), // 18% remaining - CRITICAL
  
  // Order Management - Curbside
  "sli-ready-p95": genLatencySeriesRealistic(7200000, 0.68, moderateLatencySpikes),
  "sli-stall-wait-p95": genLatencySeriesRealistic(300000, 0.78, minorLatencySpikes),
  "sli-curbside-handoff": genAvailSeriesRealistic(0.9950, 0.83, healthy), // 83% remaining
  
  // Order Management - Post-Purchase
  "sli-cancel-modify": genAvailSeriesRealistic(0.9950, 0.73, minorIncident), // 73% remaining
  "sli-address-change": genAvailSeriesRealistic(0.9900, 0.80, healthy), // 80% remaining
  "sli-reroute": genAvailSeriesRealistic(0.9500, 0.60, moderateIncident), // 60% remaining
  
  // Order Management - Returns
  "sli-rma-create": genAvailSeriesRealistic(0.9990, 0.85, healthy), // 85% remaining
  "sli-om-refund-time": genAvailSeriesRealistic(0.9900, 0.75, minorIncident), // 75% remaining
  "sli-om-tender-parity": genAvailSeriesRealistic(0.9999, 0.95, healthy), // 95% remaining - Excellent
  
  // Marketing & Loyalty
  "sli-loyalty-join": genAvailSeriesRealistic(0.9950, 0.83, healthy), // 83% remaining
  "sli-consent-capture": genAvailSeriesRealistic(0.9990, 0.85, healthy), // 85% remaining
  "sli-account-merge": genAvailSeriesRealistic(0.9900, 0.75, minorIncident), // 75% remaining
  "sli-balance-fetch": genAvailSeriesRealistic(0.9990, 0.85, healthy), // 85% remaining
  "sli-points-accrual": genAvailSeriesRealistic(0.9999, 0.95, healthy), // 95% remaining - Excellent
  "sli-expiry-correct": genAvailSeriesRealistic(0.9990, 0.85, healthy), // 85% remaining
  "sli-offer-apply": genAvailSeriesRealistic(0.9950, 0.73, minorIncident), // 73% remaining
  "sli-discount-persist": genAvailSeriesRealistic(0.9990, 0.85, healthy), // 85% remaining
  "sli-eligibility-compute": genAvailSeriesRealistic(0.9950, 0.83, healthy), // 83% remaining
  "sli-cms-render": genAvailSeriesRealistic(0.9900, 0.75, minorIncident), // 75% remaining
  "sli-personalization-p95": genLatencySeriesRealistic(500, 0.65, moderateLatencySpikes),
  "sli-promo-delivery": genAvailSeriesRealistic(0.9900, 0.75, minorIncident), // 75% remaining
  "sli-notif-latency-p95": genLatencySeriesRealistic(5000, 0.78, minorLatencySpikes),
  "sli-ad-request": genAvailSeriesRealistic(0.9900, 0.80, healthy), // 80% remaining
  "sli-ad-render-p95": genLatencySeriesRealistic(300, 0.65, moderateLatencySpikes),
  
  // Cross-Journey - Payments
  "sli-psp-uptime": genAvailSeriesRealistic(0.9999, 0.95, healthy), // 95% remaining - Excellent
  "sli-issuer-success": genAvailSeriesRealistic(0.9850, 0.58, moderateIncident), // 58% remaining
  
  // Cross-Journey - Fraud
  "sli-fraud-decision-p95": genLatencySeriesRealistic(200, 0.90, healthy),
  "sli-false-positive": genAvailSeriesRealistic(0.9800, 0.75, minorIncident), // 75% remaining
  
  // Cross-Journey - Tax/Address
  "sli-tax-calc-p95": genLatencySeriesRealistic(250, 0.90, healthy),
  "sli-address-verify-p95": genLatencySeriesRealistic(250, 0.88, healthy),
  "sli-tax-correctness": genAvailSeriesRealistic(0.9999, 0.95, healthy), // 95% remaining - Excellent
  
  // Cross-Journey - Notifications
  "sli-notif-accept-p95": genLatencySeriesRealistic(2000, 0.65, moderateLatencySpikes),
  "sli-notif-delivery-success": genAvailSeriesRealistic(0.9990, 0.85, healthy), // 85% remaining
  
  // Cross-Journey - Edge & CDN
  "sli-edge-reachability": genAvailSeriesRealistic(0.9999, 0.95, healthy), // 95% remaining - Excellent
  "sli-cdn-ttfb-p95": genLatencySeriesRealistic(100, 0.92, healthy),
  
  // Cross-Journey - Observability
  "sli-trace-coverage": genAvailSeriesRealistic(0.9000, 0.32, severeIncidents), // 32% remaining - SEVERE
  "sli-metric-age-p95": genLatencySeriesRealistic(60000, 0.77, minorLatencySpikes),
  
  // Cross-Journey - CI/CD
  "sli-release-breach-rate": genAvailSeriesRealistic(0.9950, 0.73, minorIncident), // 73% remaining
  "sli-rollback-p95": genLatencySeriesRealistic(600000, 0.38, severeLatencySpikes),
  
  // Cross-Journey - Config
  "sli-config-isolation": genAvailSeriesRealistic(0.9990, 0.85, healthy), // 85% remaining
  "sli-config-lead-p95": genLatencySeriesRealistic(30000, 0.88, healthy),
  
  // Cross-Journey - Data
  "sli-db-p99": genLatencySeriesRealistic(50, 0.92, healthy),
  "sli-cache-avail": genAvailSeriesRealistic(0.9990, 0.85, healthy), // 85% remaining
  "sli-queue-p99": genLatencySeriesRealistic(500, 0.88, healthy),
  "sli-replication-lag-p95": genLatencySeriesRealistic(1000, 0.65, moderateLatencySpikes)
};

writeFileSync("./src/data/series.json", JSON.stringify(series, null, 2));
console.log(`✅ Generated series data for ${Object.keys(series).length} SLIs`);
console.log(`   - Each with ${series["sli-checkout-2xx"].length} data points over 28 days`);
console.log(`   - Error budget distribution:`);
console.log(`     • Healthy (85-95%):    ~60 SLIs`);
console.log(`     • Minor issues (70-85%): ~30 SLIs`);
console.log(`     • At risk (50-70%):    ~20 SLIs`);
console.log(`     • Critical (<50%):     ~10 SLIs`);
console.log(`     • Breached (<10%):     ~4 SLIs`);
console.log(`   - Sharp incident patterns with visible timeline markers`);
console.log(`   - Error budget starts high and decreases cumulatively`);
