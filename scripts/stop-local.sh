#!/bin/bash
# Stop local development environment for Mile Quest

echo "🛑 Stopping Mile Quest Local Development Environment..."

# Stop PostgreSQL
if [ "$(docker ps -q -f name=milequest-postgres)" ]; then
    echo "📦 Stopping PostgreSQL container..."
    docker stop milequest-postgres
    echo "✅ PostgreSQL stopped"
else
    echo "ℹ️  PostgreSQL was not running"
fi

echo "✅ Local environment stopped"
echo ""
echo "💡 Tip: To completely remove the database and start fresh:"
echo "   docker rm milequest-postgres"