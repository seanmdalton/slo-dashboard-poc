import { writeFileSync } from "fs";
import { addMinutes, subDays } from "date-fns";

type Point = { t: string; good: number; bad: number; value?: number };
const now = new Date();
const start = subDays(now, 28);
const stepMin = 5;

function randn(mu:number, sigma:number){ // Box-Muller
  let u=0,v=0; while(u===0)u=Math.random(); while(v===0)v=Math.random();
  return mu + sigma * Math.sqrt(-2.0*Math.log(u))*Math.cos(2*Math.PI*v);
}

function genAvailSeries(baseGood=0.999, volatility=0.002): Point[] {
  const out: Point[] = [];
  for (let t = new Date(start); t <= now; t = addMinutes(t, stepMin)) {
    const pGood = Math.max(0, Math.min(1, randn(baseGood, volatility)));
    const total = 1000;
    const good = Math.round(total * pGood);
    const bad = total - good;
    out.push({ t: t.toISOString(), good, bad });
  }
  return out;
}

function genLatencySeries(targetMs=1200, sigma=200): Point[] {
  const out: Point[] = [];
  for (let t = new Date(start); t <= now; t = addMinutes(t, stepMin)) {
    const p95 = Math.max(50, randn(targetMs*0.9, sigma));
    out.push({ t: t.toISOString(), good: 0, bad: 0, value: Math.round(p95) });
  }
  return out;
}

const series = {
  "sli-200-ratio": genAvailSeries(0.999, 0.0015),
  "sli-p95-ms": genLatencySeries(1200, 180),
  "sli-inv-fresh": genAvailSeries(0.99, 0.004),
  "sli-auth-approve": genAvailSeries(0.9995, 0.0008),
  "sli-p90-min": genLatencySeries(3600000, 8*60*1000)
};

writeFileSync("./src/data/series.json", JSON.stringify(series, null, 2));
console.log("Wrote src/data/series.json");
