#!/bin/bash

# Fix all .toISOString() calls in database .set() operations
# These should be Date objects, not strings, for Drizzle ORM

echo "Fixing timestamp issues in database operations..."

# List of files to fix
files=(
  "server/routes/user.ts"
  "server/routes/workspace.ts"
  "server/routes.ts"
  "server/services/APIKeyService.ts"
  "server/services/GenerationLockService.ts"
  "server/services/BillingService.ts"
)

# Backup originals
for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    cp "$file" "$file.backup"
  fi
done

# Fix patterns - replace .toISOString() with just Date object in .set() calls
find server -name "*.ts" -type f -exec sed -i.bak \
  -e 's/updatedAt: new Date()\.toISOString()/updatedAt: new Date()/g' \
  -e 's/lastUsed: new Date()\.toISOString()/lastUsed: new Date()/g' \
  -e 's/lastModified: new Date()\.toISOString()/lastModified: new Date()/g' \
  -e 's/completedAt: new Date()\.toISOString()/completedAt: new Date()/g' \
  -e 's/lastActivity: new Date()\.toISOString()/lastActivity: new Date()/g' \
  -e 's/joinedAt: new Date()\.toISOString()/joinedAt: new Date()/g' \
  -e 's/lastActive: new Date()\.toISOString()/lastActive: new Date()/g' \
  {} \;

echo "Fixed timestamp issues!"
echo "Backup files created with .backup extension"
