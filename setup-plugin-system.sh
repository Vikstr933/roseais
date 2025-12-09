#!/bin/bash

# Plugin System Setup Script
# Installs dependencies and prepares the system

echo "🚀 Setting up AI Library Plugin System..."
echo ""

# Step 1: Install Google API dependencies
echo "📦 Step 1: Installing Google API dependencies..."
npm install googleapis google-auth-library

# Step 2: Verify environment variables
echo ""
echo "✅ Step 2: Checking environment variables..."

if [ -f .env ]; then
  if grep -q "GOOGLE_CLIENT_ID" .env && \
     grep -q "GOOGLE_CLIENT_SECRET" .env && \
     grep -q "GOOGLE_REDIRECT_URI" .env; then
    echo "   ✓ Google OAuth credentials found in .env"
  else
    echo "   ⚠️  Missing Google OAuth credentials in .env"
    echo "   Add these to your .env file:"
    echo "   GOOGLE_CLIENT_ID=your-client-id"
    echo "   GOOGLE_CLIENT_SECRET=your-client-secret"
    echo "   GOOGLE_REDIRECT_URI=http://localhost:5000/api/plugins/gmail/callback"
  fi

  if grep -q "ANTHROPIC_API_KEY" .env; then
    echo "   ✓ Anthropic API key found"
  else
    echo "   ⚠️  Missing ANTHROPIC_API_KEY in .env"
  fi
else
  echo "   ❌ .env file not found!"
  echo "   Create a .env file with required credentials"
fi

# Step 3: Run database migration
echo ""
echo "🗄️  Step 3: Running database migration..."

if [ -f "migrations/2010_add_plugin_system_tables.sql" ]; then
  if [ ! -z "$DATABASE_URL" ]; then
    echo "   Running migration..."
    psql "$DATABASE_URL" -f migrations/2010_add_plugin_system_tables.sql
    echo "   ✓ Migration complete"
  else
    echo "   ⚠️  DATABASE_URL not set. Run migration manually:"
    echo "   psql \$DATABASE_URL -f migrations/2010_add_plugin_system_tables.sql"
  fi
else
  echo "   ❌ Migration file not found!"
fi

# Step 4: Verify files exist
echo ""
echo "📁 Step 4: Verifying implementation files..."

FILES=(
  "server/plugins/BaseProductivityPlugin.ts"
  "server/services/PluginRegistry.ts"
  "server/plugins/GmailPlugin.ts"
  "server/agents/PersonalAssistantAgent.ts"
  "server/services/AssistantOrchestratorBridge.ts"
  "server/routes/plugins.ts"
  "client/src/components/AssistantWidget.tsx"
  "client/src/pages/Integrations.tsx"
  "client/src/pages/Assistant.tsx"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "   ✓ $file"
  else
    echo "   ❌ Missing: $file"
  fi
done

# Step 5: Summary
echo ""
echo "📊 Setup Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Complete implementation includes:"
echo "   • Plugin system foundation"
echo "   • Gmail plugin with OAuth 2.0"
echo "   • Personal assistant agent"
echo "   • Assistant-orchestrator bridge"
echo "   • AssistantWidget component"
echo "   • Integrations & Assistant UI pages"
echo ""
echo "📚 Documentation available:"
echo "   • PLUGIN_SYSTEM_IMPLEMENTATION.md"
echo "   • INTEGRATED_SYSTEM_USE_CASES.md"
echo "   • QUICK_START_GUIDE.md"
echo ""
echo "🎯 Next Steps:"
echo "   1. Verify .env has all required credentials"
echo "   2. Run: npm run dev"
echo "   3. Go to: http://localhost:3000/integrations"
echo "   4. Connect Gmail plugin"
echo "   5. Click the assistant widget (bottom-right)"
echo "   6. Try: 'What are my high priority emails?'"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎉 Setup complete! Start the server with: npm run dev"
