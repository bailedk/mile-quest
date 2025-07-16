#!/bin/bash

# Start Development Environment Script for Mile Quest
echo "🚀 Starting Mile Quest development environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

# Start PostgreSQL if not running
if ! docker ps | grep -q mile-quest-db; then
    echo "🗄️ Starting PostgreSQL database..."
    if docker ps -a | grep -q mile-quest-db; then
        docker start mile-quest-db
    else
        docker run --name mile-quest-db \
          -e POSTGRES_PASSWORD=password \
          -e POSTGRES_DB=mile_quest_dev \
          -p 5432:5432 \
          -d postgres:14
    fi
    echo "⏳ Waiting for database to be ready..."
    sleep 5
else
    echo "✅ PostgreSQL already running"
fi

# Start all development servers in background
echo "🚀 Starting all development servers..."

# Start Prisma Studio in background
echo "Starting Prisma Studio..."
cd packages/backend && npm run db:studio > /dev/null 2>&1 &
cd ../..

# Start backend API in background
echo "Starting backend API..."
cd packages/backend && npm run dev > /dev/null 2>&1 &
cd ../..

# Start frontend in background
echo "Starting frontend..."
npm run dev > /dev/null 2>&1 &

echo ""
echo "⏳ Waiting for servers to start..."
sleep 8

echo ""
echo "✅ All servers started!"
echo ""
echo "🔗 URLs:"
echo "   Frontend:      http://localhost:3000"
echo "   Backend API:   http://localhost:3001"  
echo "   Database UI:   http://localhost:5555"
echo ""
echo "🛑 To stop everything: npm run kill"