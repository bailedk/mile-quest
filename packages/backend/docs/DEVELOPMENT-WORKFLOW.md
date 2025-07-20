# Mile Quest Development Workflow

## Overview

During development, Mile Quest uses a simplified database workflow without migrations. Since the project isn't deployed yet, we can freely modify the schema and recreate the database as needed.

## Key Concepts

1. **No Migrations During Development** - We use `prisma db push` instead of migrations
2. **SQL Scripts for Optimizations** - Performance indexes and views are in separate SQL files
3. **Clean State** - Easy to reset and start fresh anytime

## Development Commands

### Initial Setup
```bash
# First time setup - creates database and applies optimizations
npm run db:setup
```

### Schema Changes
```bash
# After modifying schema.prisma, push changes to database
npm run db:push

# Generate updated Prisma Client
npm run db:generate
```

### Reset Database
```bash
# Completely reset database and reapply everything
npm run db:reset
```

### View Database
```bash
# Open Prisma Studio to browse data
npm run db:studio
```

## File Structure

```
packages/backend/
├── prisma/
│   └── schema.prisma          # Single source of truth for schema
├── scripts/
│   ├── dev-setup.sh          # Setup script
│   └── sql/
│       ├── performance-indexes.sql    # Performance indexes
│       └── materialized-views.sql     # Dashboard views
└── migrations/               # Keep for production deployment later
```

## Workflow Examples

### Making Schema Changes

1. Edit `prisma/schema.prisma`
2. Run `npm run db:push` to apply changes
3. Run `npm run db:generate` to update client

### Adding New Indexes

1. Add index to `scripts/sql/performance-indexes.sql`
2. Run the SQL manually or run `npm run db:reset`

### Starting Fresh

```bash
npm run db:reset
```

This will:
- Drop all tables
- Recreate schema from scratch
- Apply all performance optimizations
- Generate fresh Prisma Client

## When to Use Migrations

Once you're ready to deploy to production:

1. Create an initial migration from your final schema:
   ```bash
   npx prisma migrate dev --name init
   ```

2. All future production changes will use migrations:
   ```bash
   npx prisma migrate dev --name add_feature_x
   ```

## Benefits of This Approach

- ✅ **Faster Development** - No migration overhead during rapid changes
- ✅ **Clean History** - Start with one migration when deploying
- ✅ **Easy Experimentation** - Try changes without commitment
- ✅ **Performance Optimizations** - Keep them separate and optional

## Notes

- The `prisma/migrations/` folder contains work we did but isn't used in development
- When ready for production, create a single clean initial migration
- Performance optimizations are kept in SQL files for flexibility