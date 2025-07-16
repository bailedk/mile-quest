#!/bin/bash

# Kill Development Servers Script for Mile Quest
echo "🛑 Stopping Mile Quest development servers..."

# Kill Next.js frontend (port 3000)
echo "Stopping Next.js frontend..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || echo "  No process on port 3000"

# Kill SAM Local backend (port 3001)
echo "Stopping SAM Local backend..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || echo "  No process on port 3001"

# Kill Prisma Studio (port 5555)
echo "Stopping Prisma Studio..."
lsof -ti:5555 | xargs kill -9 2>/dev/null || echo "  No process on port 5555"

# Kill SAM processes by name
echo "Stopping SAM CLI processes..."
pkill -f "sam local" 2>/dev/null || echo "  No SAM processes found"

# Kill Node processes related to our project
echo "Stopping project Node processes..."
pkill -f "next dev" 2>/dev/null || echo "  No Next.js dev processes found"
pkill -f "prisma studio" 2>/dev/null || echo "  No Prisma Studio processes found"

# Kill any npm/node processes in our project directory
PROJECT_DIR="/Users/dougbailey/Documents/gitrepos/personal/mile-quest"
echo "Stopping npm processes in project directory..."
ps aux | grep -E "(npm|node)" | grep "$PROJECT_DIR" | awk '{print $2}' | xargs kill -9 2>/dev/null || echo "  No project npm processes found"

echo ""
echo "✅ Development servers stopped!"
echo "💡 To stop Docker PostgreSQL: docker stop mile-quest-db"
echo "💡 To remove Docker PostgreSQL: docker rm mile-quest-db"