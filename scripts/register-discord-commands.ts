/**
 * Register Discord Slash Commands
 * 
 * This script registers slash commands with Discord so users can use
 * commands like /help, /projects, /status in Discord servers.
 * 
 * Run with: npx tsx scripts/register-discord-commands.ts
 */

import { REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env file if it exists
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });
dotenv.config({ path: join(__dirname, '../.env.discord') }); // Also try .env.discord

// Get from environment variables or command line arguments
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || process.argv[2];
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || process.argv[3];

if (!DISCORD_BOT_TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN is not set');
  console.error('   Set it as environment variable: export DISCORD_BOT_TOKEN="your_token"');
  console.error('   Or pass as argument: npx tsx scripts/register-discord-commands.ts "your_token" "your_client_id"');
  process.exit(1);
}

if (!DISCORD_CLIENT_ID) {
  console.error('❌ DISCORD_CLIENT_ID is not set');
  console.error('   Set it as environment variable: export DISCORD_CLIENT_ID="your_client_id"');
  console.error('   Or pass as argument: npx tsx scripts/register-discord-commands.ts "your_token" "your_client_id"');
  process.exit(1);
}

const commands = [
  {
    name: 'help',
    description: 'Show help and available commands for Elon AI Assistant',
  },
  {
    name: 'projects',
    description: 'List your projects on the platform',
  },
  {
    name: 'status',
    description: 'Check system status and bot connection',
  },
];

const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN);

(async () => {
  try {
    console.log('🔄 Registering slash commands with Discord...');
    console.log(`   Client ID: ${DISCORD_CLIENT_ID}`);
    console.log(`   Commands: ${commands.map(c => c.name).join(', ')}`);

    // Register commands globally (available in all servers)
    const data = await rest.put(
      Routes.applicationCommands(DISCORD_CLIENT_ID),
      { body: commands }
    ) as any[];

    console.log(`✅ Successfully registered ${data.length} slash command(s)!`);
    console.log('\n📋 Registered commands:');
    data.forEach((cmd: any) => {
      console.log(`   - /${cmd.name}: ${cmd.description}`);
    });

    console.log('\n💡 Note: It may take a few minutes for commands to appear in Discord.');
    console.log('   If commands don\'t appear, try restarting Discord or waiting a few minutes.');
  } catch (error: any) {
    console.error('❌ Error registering slash commands:', error);
    
    if (error.code === 50035) {
      console.error('\n💡 Tip: Check that your command names and descriptions are valid.');
      console.error('   Command names must be lowercase and contain no spaces.');
    }
    
    if (error.status === 401) {
      console.error('\n💡 Tip: Check that DISCORD_BOT_TOKEN is correct.');
    }
    
    if (error.status === 403) {
      console.error('\n💡 Tip: Make sure your bot has the "applications.commands" scope.');
      console.error('   Re-invite the bot with this scope enabled.');
    }
    
    process.exit(1);
  }
})();

