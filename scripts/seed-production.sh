#!/bin/bash

echo "🌱 Seeding Production Database"
echo "==============================="
echo ""
echo "⚠️  WARNING: This will populate your production database with demo data."
echo ""
read -p "Enter your Render service name (e.g., slo-dashboard-api): " SERVICE_NAME

if [ -z "$SERVICE_NAME" ]; then
  echo "❌ Service name required"
  exit 1
fi

echo ""
echo "Running seed on Render service: $SERVICE_NAME"
echo ""

# Run the seed command on Render
render shell $SERVICE_NAME --command "cd api && npm run db:seed"

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Seeding completed successfully!"
  echo ""
  echo "Your dashboard should now show:"
  echo "  - Cart journey (at-risk)"
  echo "  - Store Locator journey (breached)"
  echo "  - POS Transaction (worsening)"
  echo "  - Payment Gateway (improving)"
  echo "  - Fraud Decision (recently breaching)"
  echo "  - SCO Transaction Time (worsening)"
else
  echo ""
  echo "❌ Seeding failed. Check the output above for errors."
fi

