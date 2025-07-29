#!/bin/bash
# Script to apply materialized view updates to the database

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL environment variable is not set"
  echo "Please ensure your .env file contains DATABASE_URL"
  exit 1
fi

echo "Applying materialized view updates..."

# Apply the SQL script
psql "$DATABASE_URL" -f ./scripts/sql/materialized-views.sql

if [ $? -eq 0 ]; then
  echo "✅ Materialized views updated successfully"
  echo ""
  echo "Refreshing all materialized views..."
  psql "$DATABASE_URL" -c "SELECT refresh_all_materialized_views();"
  
  if [ $? -eq 0 ]; then
    echo "✅ All materialized views refreshed"
  else
    echo "❌ Failed to refresh materialized views"
    exit 1
  fi
else
  echo "❌ Failed to update materialized views"
  exit 1
fi

echo ""
echo "✅ Database update complete!"