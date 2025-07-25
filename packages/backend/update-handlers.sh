#!/bin/bash

# Script to update all handlers to use shared auth helpers

handlers=(
  "teams/index.ts"
  "leaderboards/index.ts"  
  "progress/index.ts"
  "dashboard/index.ts"
  "goals/index.ts"
  "users/index.ts"
)

for handler in "${handlers[@]}"; do
  file="src/handlers/$handler"
  echo "Updating $file..."
  
  # Add import for getUserFromEvent if not already present
  if ! grep -q "getUserFromEvent" "$file"; then
    # Find the line with jwt.utils import and add after it
    sed -i '' '/import.*jwt\.utils/a\
import { getUserFromEvent } from '\''../../utils/auth/auth-helpers'\'';' "$file"
  fi
  
  # Remove the duplicate getUserFromEvent function definition
  # This is a bit complex with sed, so we'll use a marker approach
  sed -i '' '/^const getUserFromEvent = /,/^};$/d' "$file"
  
  # Replace user.sub with user.id
  sed -i '' 's/user\.sub/user.id/g' "$file"
  
  # Remove verifyToken import if it's only used in getUserFromEvent
  if ! grep -q "verifyToken(" "$file" | grep -v "getUserFromEvent"; then
    sed -i '' 's/, verifyToken//g' "$file"
    sed -i '' 's/verifyToken, //g' "$file"
  fi
  
  # Remove UnauthorizedError import from lambda-handler if not used elsewhere
  if ! grep -q "UnauthorizedError" "$file" | grep -v "getUserFromEvent"; then
    sed -i '' 's/, UnauthorizedError//g' "$file"
    sed -i '' 's/UnauthorizedError, //g' "$file"
  fi
done

echo "All handlers updated!"