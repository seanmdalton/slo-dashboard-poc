# Quick Deployment Guide

## 🚀 Deploy to Render in 5 Steps

### 1. Push to Git
```bash
git add .
git commit -m "Add database, seed scripts, and Render deployment config"
git push origin main
```

### 2. Connect to Render
- Go to https://dashboard.render.com
- Click "New +" → "Blueprint"
- Connect your repository
- Select branch (main)

### 3. Review Services
Render will detect `render.yaml` and show:
- ✅ PostgreSQL Database (slo-dashboard-db)
- ✅ API Backend (slo-dashboard-api)
- ✅ Frontend (slo-dashboard-poc)

### 4. Set Environment Variable
Only one manual config needed:
- Service: `slo-dashboard-api`
- Variable: `CORS_ORIGIN`
- Value: Your frontend URL (shown after deployment)

### 5. Seed Database
After deployment completes:
```bash
# Go to Render Dashboard → slo-dashboard-api → Shell
cd api && npm run db:seed
```

Or use CLI:
```bash
./scripts/seed-production.sh
```

## ⏱️ Timeline
- **Database**: ~2 min
- **API Build**: ~3 min (includes migrations)
- **Frontend Build**: ~2 min
- **Seed**: ~30 sec

## 🔍 Verification
1. Check API health: `https://slo-dashboard-api.onrender.com/health`
2. View frontend: `https://slo-dashboard-poc.onrender.com`
3. Verify Recent Changes feed shows 4+ items

## 💰 Cost
Everything runs on **free tier**:
- Database: 1GB, 90-day expiry
- Services: Spin down after 15min idle
- Cold start: ~30 seconds

## 🐛 Troubleshooting

### API won't start
- Check logs for `DATABASE_URL` error
- Verify database is connected in Render dashboard

### Frontend shows errors
- Check `VITE_API_URL` points to correct API URL
- Verify CORS is configured with frontend URL

### No data showing
- Run seed script: `cd api && npm run db:seed`
- Check database has tables: Render dashboard → Database → Metrics

## 📊 What You'll See After Deployment

**Recent Changes Feed** (4 items):
- 📉 POS Transaction Success (worsening)
- 📉 SCO Transaction Time (worsening)
- 📈 Payment Gateway Success (improving)
- 🚨 Fraud Decision Service (recently breaching)

**At-Risk Journeys**:
- 🟡 Cart journey (~35% budget remaining)
- 🔴 Store Locator journey (~5% remaining)

**Total**: 124 SLIs across 5 experiences, 34 journeys, 117 SLOs
