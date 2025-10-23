import { db, sql, testConnection } from './connection.js';
import { experiences, journeys, slos, slis, dataPoints } from './schema.js';
import { eq } from 'drizzle-orm';
import seedData from '../../src/data/seed.json' assert { type: 'json' };

// Helper: Generate UUID-like ID
function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Helper: Box-Muller transform for normal distribution
function randn(mu, sigma) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mu + sigma * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Calculate baseline to achieve target error budget consumption
function calculateBaseline(target, targetBudgetRemaining, incidents) {
  const errorBudget = 1 - target;
  const budgetToSpend = 1 - targetBudgetRemaining;
  const totalErrorAllowed = errorBudget * budgetToSpend;
  
  const totalHours = 28 * 24;
  let incidentErrorContribution = 0;
  for (const inc of incidents) {
    incidentErrorContribution += (inc.severity * inc.durationHours) / totalHours;
  }
  
  const baselineErrorRate = Math.max(0, totalErrorAllowed - incidentErrorContribution);
  return Math.max(0.5, 1 - baselineErrorRate);
}

// Generate realistic availability data points
function generateAvailabilityDataPoints(sliId, target, targetBudgetRemaining, incidents, startDate, endDate) {
  const points = [];
  const baseline = calculateBaseline(target, targetBudgetRemaining, incidents);
  const verySmallNoise = 0.00003;
  const stepMs = 5 * 60 * 1000; // 5 minutes
  
  for (let t = new Date(startDate); t <= endDate; t = new Date(t.getTime() + stepMs)) {
    const hoursSinceStart = (t.getTime() - startDate.getTime()) / (60 * 60 * 1000);
    
    let degradation = 0;
    for (const incident of incidents) {
      if (hoursSinceStart >= incident.startHour && 
          hoursSinceStart < incident.startHour + incident.durationHours) {
        degradation = Math.max(degradation, incident.severity);
      }
    }
    
    const targetRate = Math.max(0.5, baseline - degradation);
    const pGood = Math.max(0.5, Math.min(1, randn(targetRate, verySmallNoise)));
    
    const total = 1000;
    const good = Math.round(total * pGood);
    const bad = total - good;
    
    points.push({
      id: generateId('dp'),
      sliId,
      timestamp: new Date(t),
      good,
      bad,
      value: null,
    });
  }
  
  return points;
}

// Generate realistic latency data points
function generateLatencyDataPoints(sliId, targetMs, targetBudgetRemaining, incidents, startDate, endDate) {
  const points = [];
  const budgetFactor = 1 - targetBudgetRemaining;
  const baselineMs = targetMs * (0.5 + budgetFactor * 0.3);
  const noise = targetMs * 0.05;
  const stepMs = 5 * 60 * 1000; // 5 minutes
  
  for (let t = new Date(startDate); t <= endDate; t = new Date(t.getTime() + stepMs)) {
    const hoursSinceStart = (t.getTime() - startDate.getTime()) / (60 * 60 * 1000);
    
    let spike = 1.0;
    for (const incident of incidents) {
      if (hoursSinceStart >= incident.startHour && 
          hoursSinceStart < incident.startHour + incident.durationHours) {
        spike = Math.max(spike, incident.severity);
      }
    }
    
    const latency = Math.max(10, randn(baselineMs * spike, noise));
    
    points.push({
      id: generateId('dp'),
      sliId,
      timestamp: new Date(t),
      good: 0,
      bad: 0,
      value: Math.round(latency).toString(),
    });
  }
  
  return points;
}

// Incident patterns
// For availability metrics, severity = error rate (fraction of bad events)
// For 99.9% SLO: error budget = 0.1% → need ~0.065% errors for 65% consumed (at-risk)
// For 99.9% SLO: error budget = 0.1% → need ~0.095% errors for 95% consumed (breached)
const incidentPatterns = {
  healthy: [],
  minor: [{ startHour: 24 * 18, durationHours: 3, severity: 0.015 }], // 1.5% error rate
  moderate: [{ startHour: 24 * 14, durationHours: 5, severity: 0.025 }], // 2.5% error rate
  severe: [
    // At-risk: Target 65% error budget consumed
    // Multiple incidents with 5-8% error rates to accumulate significant budget spend
    { startHour: 24 * 6, durationHours: 4, severity: 0.08 },  // 8% errors for 4h
    { startHour: 24 * 14, durationHours: 5, severity: 0.06 }, // 6% errors for 5h  
    { startHour: 24 * 22, durationHours: 3, severity: 0.05 }  // 5% errors for 3h
  ],
  critical: [
    { startHour: 24 * 5, durationHours: 8, severity: 0.10 },  // 10% errors
    { startHour: 24 * 12, durationHours: 6, severity: 0.08 }, // 8% errors
    { startHour: 24 * 20, durationHours: 5, severity: 0.12 }  // 12% errors
  ],
  breached: [
    // Breached: Target 95% error budget consumed (only 5% remaining)
    // Sustained high error rates across multiple periods
    { startHour: 24 * 2, durationHours: 8, severity: 0.15 },   // 15% errors for 8h
    { startHour: 24 * 10, durationHours: 10, severity: 0.12 }, // 12% errors for 10h
    { startHour: 24 * 18, durationHours: 6, severity: 0.18 },  // 18% errors for 6h
    { startHour: 24 * 25, durationHours: 4, severity: 0.10 }   // 10% errors for 4h
  ],
  minorLatency: [{ startHour: 24 * 19, durationHours: 2, severity: 1.5 }], // 50% above baseline
  moderateLatency: [
    { startHour: 24 * 12, durationHours: 3, severity: 2.0 }, // 2x baseline (e.g., 500ms → 1000ms)
    { startHour: 24 * 22, durationHours: 2, severity: 2.2 }  // 2.2x baseline
  ],
  severeLatency: [
    // At-risk: Multiple significant latency spikes
    // For p95 targets, severity multiplier affects % of requests exceeding target
    { startHour: 24 * 6, durationHours: 4, severity: 4.0 },   // 4x baseline (e.g., 500ms → 2000ms)
    { startHour: 24 * 14, durationHours: 5, severity: 3.5 },  // 3.5x baseline
    { startHour: 24 * 22, durationHours: 3, severity: 5.0 }   // 5x baseline
  ],
  criticalLatency: [
    { startHour: 24 * 5, durationHours: 8, severity: 6.0 },   // 6x baseline
    { startHour: 24 * 12, durationHours: 6, severity: 5.0 },  // 5x baseline
    { startHour: 24 * 20, durationHours: 5, severity: 7.0 }   // 7x baseline
  ],
  breachedLatency: [
    // Breached: Sustained extreme latency degradation
    { startHour: 24 * 2, durationHours: 8, severity: 8.0 },   // 8x baseline (e.g., 500ms → 4000ms)
    { startHour: 24 * 10, durationHours: 10, severity: 7.0 }, // 7x baseline
    { startHour: 24 * 18, durationHours: 6, severity: 10.0 }, // 10x baseline (severe degradation)
    { startHour: 24 * 25, durationHours: 4, severity: 6.0 }   // 6x baseline
  ],
  
  // Recent Changes patterns (for triggering "Recent Changes" feed)
  // Days 1-7 = last 168 hours (24*7), Days 8-14 = hours 168-336
  recentWorsening: [
    // Healthy in days 8-14, incident starts in last 7 days
    { startHour: 24 * 25, durationHours: 48, severity: 0.05 }  // 5% errors in last 2 days
  ],
  recentWorseningLatency: [
    // Healthy before, latency spike in last 7 days
    { startHour: 24 * 26, durationHours: 24, severity: 3.0 }   // 3x baseline in last day
  ],
  recentImproving: [
    // Had issues in days 8-14, recovered in last 7 days
    { startHour: 24 * 8, durationHours: 72, severity: 0.04 }   // 4% errors days 8-11, then recovery
  ],
  recentImprovingLatency: [
    // Had latency issues days 8-14, recovered recently
    { startHour: 24 * 10, durationHours: 96, severity: 2.5 }   // 2.5x baseline days 10-14, then recovery
  ],
  recentlyBreaching: [
    // Recently breached in last few days
    { startHour: 24 * 26, durationHours: 36, severity: 0.12 }  // 12% errors in last 1.5 days
  ],
  recentlyBreachingLatency: [
    // Recently breached in last few days
    { startHour: 24 * 26, durationHours: 30, severity: 6.0 }   // 6x baseline in last ~1 day
  ]
};

// SLO configurations with incident patterns and budget targets
const sloConfigs = {
  // Tier-0: Excellent health (90%+ budget)
  'tier0-healthy': { budgetRemaining: 0.90, incidents: 'healthy' },
  
  // Tier-1: Minor issues (70-85% budget)
  'tier1-minor': { budgetRemaining: 0.75, incidents: 'minor' },
  
  // Tier-2: Moderate issues (50-70% budget)
  'tier2-moderate': { budgetRemaining: 0.60, incidents: 'moderate' },
  
  // At risk: Severe issues (20-50% budget)
  'at-risk': { budgetRemaining: 0.35, incidents: 'severe' },
  
  // Critical: Major problems (<20% budget)
  'critical': { budgetRemaining: 0.15, incidents: 'critical' },
  
  // Breached: Exhausted budget
  'breached': { budgetRemaining: 0.05, incidents: 'breached' },
  
  // Recent Changes (for triggering Recent Changes feed)
  'recent-worsening': { budgetRemaining: 0.85, incidents: 'recentWorsening' },
  'recent-improving': { budgetRemaining: 0.75, incidents: 'recentImproving' },
  'recent-breaching': { budgetRemaining: 0.10, incidents: 'recentlyBreaching' },
};

async function seed() {
  console.log('🌱 Starting database seed...');
  
  // Test connection
  const connected = await testConnection();
  if (!connected) {
    console.error('❌ Cannot seed: database connection failed');
    process.exit(1);
  }
  
  const startDate = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
  const endDate = new Date();
  
  console.log('📊 Seeding from existing seed.json structure...');
  
  try {
    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await db.delete(dataPoints);
    await db.delete(slis);
    await db.delete(slos);
    await db.delete(journeys);
    await db.delete(experiences);
    
    let totalDataPoints = 0;
    
    // Seed experiences, journeys, SLOs, and SLIs
    for (const exp of seedData.experiences) {
      console.log(`\n📦 Seeding experience: ${exp.name}`);
      
      // Insert experience
      await db.insert(experiences).values({
        id: exp.name.toLowerCase().replace(/\s+/g, '-'),
        name: exp.name,
      });
      
      for (const journey of exp.journeys) {
        console.log(`  📍 Seeding journey: ${journey.name}`);
        
        // Insert journey
        await db.insert(journeys).values({
          id: journey.id,
          experienceId: exp.name.toLowerCase().replace(/\s+/g, '-'),
          name: journey.name,
        });
        
        for (const slo of journey.slos) {
          console.log(`    🎯 Seeding SLO: ${slo.name}`);
          
          // Determine incident pattern based on journey and criticality
          let config;
          
          // Custom SLO-level configurations for Recent Changes
          if (slo.id === 'slo-pos-transaction') {
            // POS Transaction Success: Recently worsening
            config = sloConfigs['recent-worsening'];
            console.log(`      📉 Setting POS Transaction to RECENT WORSENING (for Recent Changes)`);
          } else if (slo.id === 'slo-payment-gateway-success') {
            // Payment Gateway: Recently improving
            config = sloConfigs['recent-improving'];
            console.log(`      📈 Setting Payment Gateway to RECENT IMPROVING (for Recent Changes)`);
          } else if (slo.id === 'slo-fraud-latency') {
            // Fraud Decision Service: Recently breaching
            config = sloConfigs['recent-breaching'];
            console.log(`      🚨 Setting Fraud Decision to RECENT BREACHING (for Recent Changes)`);
          } else if (slo.id === 'slo-sco-transaction-time') {
            // SCO Transaction Time: Recently worsening (latency)
            config = sloConfigs['recent-worsening'];
            console.log(`      📉 Setting SCO Transaction Time to RECENT WORSENING (for Recent Changes)`);
          } else if (journey.id === 'journey-ecomm-cart') {
            // Cart journey: At risk (20-40% budget remaining)
            config = sloConfigs['at-risk'];
            console.log(`      ⚠️  Setting Cart SLO to AT RISK (35% budget remaining)`);
          } else if (journey.id === 'journey-ecomm-store-locator') {
            // Store Locator journey: Breaching (<20% budget remaining)
            config = sloConfigs['breached'];
            console.log(`      🔴 Setting Store Locator SLO to BREACHED (5% budget remaining)`);
          } else if (slo.criticality === 'tier-0') {
            config = Math.random() > 0.8 ? sloConfigs['tier1-minor'] : sloConfigs['tier0-healthy'];
          } else if (slo.criticality === 'tier-1') {
            const rand = Math.random();
            config = rand > 0.7 ? sloConfigs['tier2-moderate'] : 
                    rand > 0.3 ? sloConfigs['tier1-minor'] : 
                    sloConfigs['tier0-healthy'];
          } else if (slo.criticality === 'tier-2') {
            const rand = Math.random();
            config = rand > 0.7 ? sloConfigs['at-risk'] :
                    rand > 0.4 ? sloConfigs['tier2-moderate'] :
                    sloConfigs['tier1-minor'];
          } else {
            config = sloConfigs['tier2-moderate'];
          }
          
          // Insert SLO
          await db.insert(slos).values({
            id: slo.id,
            journeyId: journey.id,
            name: slo.name,
            description: slo.description,
            criticality: slo.criticality,
            owner: slo.owner,
            budgetingWindowDays: slo.budgetingWindowDays,
            objectivePercent: slo.objectivePercent.toString(),
            errorBudgetPercent: slo.errorBudgetPercent.toString(),
          });
          
          // Seed SLIs and data points
          for (const sli of slo.indicators) {
            console.log(`      📈 Seeding SLI: ${sli.name} (${sli.type})`);
            
            // Insert SLI
            await db.insert(slis).values({
              id: sli.id,
              sloId: slo.id,
              name: sli.name,
              type: sli.type,
              unit: sli.unit,
              objectiveDirection: sli.objectiveDirection,
              target: sli.target.toString(),
              source: sli.source,
            });
            
            // Generate data points
            let dataPointsToInsert;
            const incidents = incidentPatterns[config.incidents] || [];
            
            if (sli.type === 'latency') {
              // Use latency-specific incidents if available
              let latencyIncidents;
              if (config.incidents.includes('Latency')) {
                latencyIncidents = incidents;
              } else if (config.incidents === 'recentWorsening' || config.incidents === 'recentImproving' || config.incidents === 'recentlyBreaching') {
                // For recent changes patterns, use the corresponding latency version
                const latencyPattern = config.incidents === 'recentWorsening' ? 'recentWorseningLatency'
                  : config.incidents === 'recentImproving' ? 'recentImprovingLatency'
                  : 'recentlyBreachingLatency';
                latencyIncidents = incidentPatterns[latencyPattern] || [];
              } else {
                latencyIncidents = incidentPatterns[`${config.incidents === 'healthy' ? 'healthy' : 'minor'}Latency`] || [];
              }
              dataPointsToInsert = generateLatencyDataPoints(
                sli.id,
                parseFloat(sli.target),
                config.budgetRemaining,
                latencyIncidents,
                startDate,
                endDate
              );
            } else {
              dataPointsToInsert = generateAvailabilityDataPoints(
                sli.id,
                parseFloat(sli.target) / 100, // Convert to decimal
                config.budgetRemaining,
                incidents,
                startDate,
                endDate
              );
            }
            
            // Batch insert data points (in chunks of 1000)
            const chunkSize = 1000;
            for (let i = 0; i < dataPointsToInsert.length; i += chunkSize) {
              const chunk = dataPointsToInsert.slice(i, i + chunkSize);
              await db.insert(dataPoints).values(chunk);
            }
            
            totalDataPoints += dataPointsToInsert.length;
            console.log(`        ✓ Generated ${dataPointsToInsert.length} data points`);
          }
        }
      }
    }
    
    console.log('\n✅ Seed completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Experiences: ${seedData.experiences.length}`);
    console.log(`   - Total data points: ${totalDataPoints.toLocaleString()}`);
    console.log(`   - Time range: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
    
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Run seed
seed().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

