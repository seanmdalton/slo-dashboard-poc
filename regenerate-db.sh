#!/bin/bash

echo "🔄 DATABASE REGENERATION SCRIPT"
echo "================================"
echo ""
echo "This will:"
echo "  1. Drop existing database"
echo "  2. Recreate with new schema"
echo "  3. Seed with corrected data"
echo "  4. Restart services"
echo ""
echo "⚠️  Press Ctrl+C within 5 seconds to cancel..."
sleep 5

echo ""
echo "📦 Step 1: Dropping and recreating database..."
docker exec slo-dashboard-db psql -U slo_user -d postgres -c "DROP DATABASE IF EXISTS slo_dashboard;" 2>/dev/null
docker exec slo-dashboard-db psql -U slo_user -d postgres -c "CREATE DATABASE slo_dashboard;"

if [ $? -ne 0 ]; then
  echo "❌ Failed to recreate database"
  exit 1
fi

echo "✅ Database recreated"
echo ""

echo "📋 Step 2: Running migrations..."
cd api
npm run db:migrate

if [ $? -ne 0 ]; then
  echo "❌ Migration failed"
  exit 1
fi

echo "✅ Migrations completed"
echo ""

echo "🌱 Step 3: Seeding database with corrected data..."
npm run db:seed

if [ $? -ne 0 ]; then
  echo "❌ Seeding failed"
  exit 1
fi

echo ""
echo "🔄 Step 4: Restarting services..."
cd ..

# Stop existing services
lsof -ti:3001 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null
sleep 2

# Start API
cd api
npm start > /tmp/api.log 2>&1 &
cd ..
sleep 3

# Start frontend
VITE_API_URL=http://localhost:3001 npm run dev > /tmp/vite.log 2>&1 &
sleep 2

echo ""
echo "✅ REGENERATION COMPLETE!"
echo "========================="
echo ""
echo "🌐 Dashboard: http://localhost:5173"
echo "🔧 API: http://localhost:3001/health"
echo ""
echo "📊 Summary:"
docker exec slo-dashboard-db psql -U slo_user -d slo_dashboard -c "SELECT COUNT(*) as total_slis FROM slis;"
docker exec slo-dashboard-db psql -U slo_user -d slo_dashboard -c "SELECT COUNT(*) as total_data_points FROM data_points;"
echo ""
echo "⚡ Next Steps:"
echo "  1. Hard refresh browser (Ctrl+Shift+R / Cmd+Shift+R)"
echo "  2. Check latency SLO: 'Receipt Issuance Time p95'"
echo "  3. Verify error budget matches in title and chart"
echo ""
echo "📖 For more details, see REGENERATE_DATABASE.md"
