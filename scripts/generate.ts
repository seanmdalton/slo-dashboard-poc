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

function genAvailSeries(baseGood = 0.999, volatility = 0.002): Point[] {
  const out: Point[] = [];
  for (let t = new Date(start); t <= now; t = new Date(t.getTime() + stepMin * 60 * 1000)) {
    const pGood = Math.max(0, Math.min(1, randn(baseGood, volatility)));
    const total = 1000;
    const good = Math.round(total * pGood);
    const bad = total - good;
    out.push({ t: t.toISOString(), good, bad });
  }
  return out;
}

function genLatencySeries(targetMs = 1200, sigma = 200): Point[] {
  const out: Point[] = [];
  for (let t = new Date(start); t <= now; t = new Date(t.getTime() + stepMin * 60 * 1000)) {
    const p95 = Math.max(50, randn(targetMs * 0.9, sigma));
    out.push({ t: t.toISOString(), good: 0, bad: 0, value: Math.round(p95) });
  }
  return out;
}

const series = {
  // E-commerce Auth & Account
  "sli-login-2xx": genAvailSeries(0.9996, 0.0008), // 99.95% target
  "sli-registration-2xx": genAvailSeries(0.9991, 0.0012), // 99.9% target
  "sli-pwd-reset-2xx": genAvailSeries(0.996, 0.003), // 99.5% target
  "sli-account-p95": genLatencySeries(800, 120),
  
  // E-commerce Search & Discovery
  "sli-search-2xx": genAvailSeries(0.9991, 0.0015), // 99.9% target
  "sli-search-p95": genLatencySeries(300, 50),
  "sli-search-quality": genAvailSeries(0.955, 0.01), // 95% target
  
  // E-commerce Product Detail (PDP)
  "sli-pdp-2xx": genAvailSeries(0.9996, 0.0008), // 99.95% target
  "sli-pdp-p95": genLatencySeries(1000, 150),
  "sli-pdp-images": genAvailSeries(0.996, 0.003), // 99.5% target
  
  // E-commerce Cart
  "sli-add-cart-2xx": genAvailSeries(0.9991, 0.0012), // 99.9% target
  "sli-cart-p95": genLatencySeries(600, 90),
  "sli-cart-update": genAvailSeries(0.996, 0.003), // 99.5% target
  
  // E-commerce Checkout
  "sli-checkout-2xx": genAvailSeries(0.9996, 0.0008), // 99.95% target
  "sli-place-order-p95-web": genLatencySeries(1200, 180),
  "sli-place-order-p95-app": genLatencySeries(900, 120),
  "sli-auth-approve-overall": genAvailSeries(0.987, 0.002), // 98.5% target
  "sli-psp-2xx": genAvailSeries(0.9996, 0.0005), // 99.95% target
  "sli-3ds-success": genAvailSeries(0.975, 0.008), // 97% target
  "sli-wallet-apple": genAvailSeries(0.993, 0.003), // 99.2% target
  "sli-wallet-google": genAvailSeries(0.993, 0.003), // 99.2% target
  "sli-fraud-p95": genLatencySeries(200, 30),
  "sli-order-correct": genAvailSeries(0.9999, 0.0002), // 99.99% target
  "sli-pricing-correct": genAvailSeries(0.9999, 0.0002), // 99.99% target
  "sli-tax-correct": genAvailSeries(0.9999, 0.0002), // 99.99% target
  "sli-inventory-bopis": genAvailSeries(0.9991, 0.0015), // 99.9% target
  "sli-inventory-ship": genAvailSeries(0.996, 0.002), // 99.5% target
  "sli-promo-apply": genAvailSeries(0.996, 0.003), // 99.5% target
  "sli-address-p95": genLatencySeries(250, 40),
  "sli-cart-checkout": genAvailSeries(0.998, 0.002), // 99.7% target
  "sli-receipt-dispatch": genAvailSeries(0.9991, 0.001), // 99.9% target
  "sli-settlement-time": genAvailSeries(0.9996, 0.0008), // 99.95% target
  
  // E-commerce Payments
  "sli-payment-proc-2xx": genAvailSeries(0.9999, 0.0003), // 99.99% target
  "sli-payment-p95": genLatencySeries(800, 120),
  "sli-gateway-success": genAvailSeries(0.996, 0.003), // 99.5% target
  "sli-refund-success": genAvailSeries(0.9991, 0.001), // 99.9% target
  
  // E-commerce Store Locator & Find-in-Store
  "sli-store-loc-2xx": genAvailSeries(0.9991, 0.0012), // 99.9% target
  "sli-fis-2xx": genAvailSeries(0.996, 0.003), // 99.5% target
  "sli-inv-check-p95": genLatencySeries(500, 80),
  "sli-hours-accuracy": genAvailSeries(0.991, 0.005), // 99% target
  
  // In-store POS Checkout
  "sli-pos-complete": genAvailSeries(0.9996, 0.0008), // 99.95% target
  "sli-tender-overall": genAvailSeries(0.990, 0.003), // 98.8% target
  "sli-tender-contactless": genAvailSeries(0.993, 0.002), // 99.2% target
  "sli-lane-add-item": genLatencySeries(150, 20),
  "sli-lane-total": genLatencySeries(500, 80),
  "sli-lane-tender": genLatencySeries(700, 100),
  "sli-scanner-rate": genAvailSeries(0.995, 0.003), // represents meeting 3.5 scans/s
  "sli-receipt-p95": genLatencySeries(2000, 300),
  "sli-peripheral-ready": genAvailSeries(0.9991, 0.001), // 99.9% target
  "sli-offline-success": genAvailSeries(0.996, 0.002), // 99.5% target
  "sli-price-match": genAvailSeries(0.9999, 0.0002), // 99.99% target
  "sli-loyalty-success": genAvailSeries(0.996, 0.003), // 99.5% target
  "sli-cash-reconcile": genAvailSeries(0.9991, 0.001), // 99.9% target
  
  // In-store Self-Checkout
  "sli-sco-uptime": genAvailSeries(0.996, 0.003), // 99.5% target
  "sli-sco-intervention": genAvailSeries(0.86, 0.02), // 85% target (self-service completion)
  "sli-sco-completion": genAvailSeries(0.925, 0.015), // 92% target (abandon rate)
  "sli-sco-txn-p95": genLatencySeries(180000, 20000), // 180s target (3 min)
  
  // In-store BOPIS/Store Pickup
  "sli-order-locate": genAvailSeries(0.9991, 0.001), // 99.9% target
  "sli-pick-slip": genAvailSeries(0.996, 0.003), // 99.5% target
  "sli-handoff-p95": genLatencySeries(300000, 40000), // 300s target (5 min)
  "sli-ready-notify": genAvailSeries(0.991, 0.005), // 99% target
  
  // In-store Returns & Exchanges
  "sli-rma-lookup": genAvailSeries(0.9991, 0.001), // 99.9% target
  "sli-refund-p95": genLatencySeries(5000, 800), // 5s target
  "sli-tender-parity": genAvailSeries(0.9999, 0.0002), // 99.99% target
  "sli-return-auth": genAvailSeries(0.982, 0.008), // 98% target
  
  // In-store Partner Delivery
  "sli-partner-tx": genAvailSeries(0.9991, 0.001), // 99.9% target
  "sli-partner-api": genAvailSeries(0.996, 0.003), // 99.5% target
  "sli-partner-accept": genAvailSeries(0.955, 0.01), // 95% target
  "sli-pickup-status": genAvailSeries(0.991, 0.005), // 99% target
  
  // Order Management - Promise & Split
  "sli-promise-accuracy": genAvailSeries(0.955, 0.01), // 95% target
  "sli-split-success": genAvailSeries(0.996, 0.003), // 99.5% target
  "sli-backorder-correct": genAvailSeries(0.991, 0.005), // 99% target
  
  // Order Management - Pick/Pack/Ship
  "sli-dc-process": genAvailSeries(0.9991, 0.001), // 99.9% target
  "sli-label-gen": genAvailSeries(0.9991, 0.001), // 99.9% target
  "sli-handoff-scan": genAvailSeries(0.996, 0.003), // 99.5% target
  "sli-pick-accuracy": genAvailSeries(0.998, 0.002), // 99.8% target
  
  // Order Management - Transportation & Last-Mile
  "sli-carrier-api": genAvailSeries(0.996, 0.003), // 99.5% target
  "sli-scan-compliance": genAvailSeries(0.982, 0.008), // 98% target
  "sli-eta-accuracy": genAvailSeries(0.905, 0.015), // 90% target
  
  // Order Management - Curbside & Same-Day
  "sli-ready-p95": genLatencySeries(7200000, 900000), // 2h target
  "sli-stall-wait-p95": genLatencySeries(300000, 40000), // 5 min target
  "sli-curbside-handoff": genAvailSeries(0.996, 0.003), // 99.5% target
  
  // Order Management - Post-Purchase Changes
  "sli-cancel-modify": genAvailSeries(0.996, 0.003), // 99.5% target
  "sli-address-change": genAvailSeries(0.991, 0.005), // 99% target
  "sli-reroute": genAvailSeries(0.955, 0.01), // 95% target
  
  // Order Management - Returns & Refunds
  "sli-rma-create": genAvailSeries(0.9991, 0.001), // 99.9% target
  "sli-om-refund-time": genAvailSeries(0.991, 0.005), // 99% target
  "sli-om-tender-parity": genAvailSeries(0.9999, 0.0002), // 99.99% target
  
  // Marketing & Loyalty - Enrollment & Profile
  "sli-loyalty-join": genAvailSeries(0.996, 0.003), // 99.5% target
  "sli-consent-capture": genAvailSeries(0.9991, 0.001), // 99.9% target
  "sli-account-merge": genAvailSeries(0.991, 0.005), // 99% target
  
  // Marketing & Loyalty - Balance & Offers
  "sli-balance-fetch": genAvailSeries(0.9991, 0.001), // 99.9% target
  "sli-points-accrual": genAvailSeries(0.9999, 0.0002), // 99.99% target
  "sli-expiry-correct": genAvailSeries(0.9991, 0.001), // 99.9% target
  
  // Marketing & Loyalty - Apply at Cart/Checkout
  "sli-offer-apply": genAvailSeries(0.996, 0.003), // 99.5% target
  "sli-discount-persist": genAvailSeries(0.9991, 0.001), // 99.9% target
  
  // Marketing & Loyalty - Campaign & Personalization
  "sli-eligibility-compute": genAvailSeries(0.996, 0.003), // 99.5% target
  "sli-cms-render": genAvailSeries(0.991, 0.005), // 99% target
  "sli-personalization-p95": genLatencySeries(500, 80), // 500ms target
  
  // Marketing & Loyalty - Notifications
  "sli-promo-delivery": genAvailSeries(0.991, 0.005), // 99% target
  "sli-notif-latency-p95": genLatencySeries(5000, 800), // 5s target
  
  // Marketing & Loyalty - Retail Media
  "sli-ad-request": genAvailSeries(0.991, 0.005), // 99% target
  "sli-ad-render-p95": genLatencySeries(300, 50), // 300ms target
  
  // Cross-Journey - Payments Platform
  "sli-psp-uptime": genAvailSeries(0.9999, 0.0002), // 99.99% target
  "sli-issuer-success": genAvailSeries(0.987, 0.002), // 98.5% target
  
  // Cross-Journey - Fraud Detection
  "sli-fraud-decision-p95": genLatencySeries(200, 30), // 200ms target
  "sli-false-positive": genAvailSeries(0.982, 0.008), // 98% target
  
  // Cross-Journey - Tax/Address/Geo Services
  "sli-tax-calc-p95": genLatencySeries(250, 40), // 250ms target
  "sli-address-verify-p95": genLatencySeries(250, 40), // 250ms target
  "sli-tax-correctness": genAvailSeries(0.9999, 0.0002), // 99.99% target
  
  // Cross-Journey - Messaging & Notifications
  "sli-notif-accept-p95": genLatencySeries(2000, 300), // 2s target
  "sli-notif-delivery-success": genAvailSeries(0.9991, 0.001), // 99.9% target
  
  // Cross-Journey - Edge & CDN
  "sli-edge-reachability": genAvailSeries(0.9999, 0.0002), // 99.99% target
  "sli-cdn-ttfb-p95": genLatencySeries(100, 15), // 100ms target
  
  // Cross-Journey - Observability
  "sli-trace-coverage": genAvailSeries(0.905, 0.015), // 90% target
  "sli-metric-age-p95": genLatencySeries(60000, 8000), // 60s target
  
  // Cross-Journey - CI/CD & Release
  "sli-release-breach-rate": genAvailSeries(0.996, 0.003), // 99.5% target
  "sli-rollback-p95": genLatencySeries(600000, 90000), // 10min target
  
  // Cross-Journey - Feature Flags & Config
  "sli-config-isolation": genAvailSeries(0.9991, 0.001), // 99.9% target
  "sli-config-lead-p95": genLatencySeries(30000, 5000), // 30s target
  
  // Cross-Journey - Data/Queues/Cache/DB
  "sli-db-p99": genLatencySeries(50, 8), // 50ms target
  "sli-cache-avail": genAvailSeries(0.9991, 0.001), // 99.9% target
  "sli-queue-p99": genLatencySeries(500, 80), // 500ms target
  "sli-replication-lag-p95": genLatencySeries(1000, 150) // 1s target
};

writeFileSync("./src/data/series.json", JSON.stringify(series, null, 2));
console.log(`Generated series data for ${Object.keys(series).length} SLIs`);
console.log(`Each with ${series["sli-checkout-2xx"].length} data points over 28 days`);
