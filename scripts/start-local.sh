#!/bin/bash
# Start local development environment for Mile Quest

echo "🚀 Starting Mile Quest Local Development Environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

# Start PostgreSQL if not running
if [ ! "$(docker ps -q -f name=mile-quest-db)" ]; then
    if [ "$(docker ps -aq -f status=exited -f name=mile-quest-db)" ]; then
        echo "📦 Starting existing PostgreSQL container..."
        docker start mile-quest-db
    else
        echo "🐘 Creating new PostgreSQL container..."
        docker run -d \
            --name mile-quest-db \
            -e POSTGRES_PASSWORD=localdev \
            -e POSTGRES_DB=milequest \
            -p 5432:5432 \
            postgis/postgis:14-3.3-alpine
        
        # Wait for PostgreSQL to be ready
        echo "⏳ Waiting for PostgreSQL to be ready..."
        sleep 5
    fi
else
    echo "✅ PostgreSQL is already running"
fi

# Create .env files if they don't exist
if [ ! -f "packages/backend/.env.local" ]; then
    echo "📝 Creating backend .env.local file..."
    cat > packages/backend/.env.local << EOF
NODE_ENV=development
DATABASE_URL=postgresql://postgres:localdev@localhost:5432/milequest
JWT_SECRET=local-development-secret-change-in-production
CORS_ORIGIN=http://localhost:3000
SERVICE_IMPLEMENTATIONS=mock
LOG_LEVEL=debug
PORT=3001
EOF
fi

if [ ! -f "packages/frontend/.env.local" ]; then
    echo "📝 Creating frontend .env.local file..."
    cat > packages/frontend/.env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:6001
NEXT_PUBLIC_MAPBOX_TOKEN=your-mapbox-token-here
EOF
fi

echo "✅ Local environment is ready!"
echo ""
echo "📚 Next steps:"
echo "1. Backend:  cd packages/backend && npm run dev"
echo "2. Frontend: cd packages/frontend && npm run dev"
echo "3. Database: npx prisma studio (in backend folder)"
echo ""
echo "🔗 URLs:"
echo "- Frontend: http://localhost:3000"
echo "- Backend:  http://localhost:3001"
echo "- Database: postgresql://postgres:localdev@localhost:5432/milequest"