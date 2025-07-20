#!/bin/bash
# Development Database Setup Script
# This script sets up the database for development without using migrations

echo "🚀 Setting up Mile Quest development database..."

# Push the schema to the database (this will create/update tables)
echo "📦 Applying schema to database..."
npx prisma db push --skip-generate

# Generate Prisma Client
echo "🔧 Generating Prisma Client..."
npx prisma generate

# Apply performance optimizations
echo "⚡ Applying performance optimizations..."
psql $DATABASE_URL -f scripts/sql/performance-indexes.sql
psql $DATABASE_URL -f scripts/sql/materialized-views.sql

echo "✅ Development database setup complete!"
echo ""
echo "To reset your database, run: npm run db:reset"
echo "To apply schema changes, run: npm run db:push"