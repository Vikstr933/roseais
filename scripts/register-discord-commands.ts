/**
 * Register Discord Slash Commands
 * 
 * This script registers slash commands with Discord so users can use
 * commands like /help, /projects, /status, /play in Discord servers.
 * 
 * Run with: npx tsx scripts/register-discord-commands.ts
 */

import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { discordApplicationCommands, registerDiscordApplicationCommands } from '../server/services/DiscordCommandRegistry';

// Load .env file if it exists
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });
dotenv.config({ path: join(__dirname, '../.env.discord') }); // Also try .env.discord

// Get from environment variables or command line arguments
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || process.argv[2];
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || process.argv[3];
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID || process.argv[4];

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

(async () => {
  try {
    console.log('🔄 Registering slash commands with Discord...');
    console.log(`   Client ID: ${DISCORD_CLIENT_ID}`);
    if (DISCORD_GUILD_ID) {
      console.log(`   Guild ID: ${DISCORD_GUILD_ID}`);
    }
    console.log(`   Commands: ${discordApplicationCommands.map(c => c.name).join(', ')}`);

    const data = await registerDiscordApplicationCommands({
      botToken: DISCORD_BOT_TOKEN,
      clientId: DISCORD_CLIENT_ID,
      guildId: DISCORD_GUILD_ID,
    });

    console.log(`✅ Successfully registered ${data.length} slash command(s)!`);
    console.log('\n📋 Registered commands:');
    data.forEach((cmd: any) => {
      console.log(`   - /${cmd.name}: ${cmd.description}`);
    });

    if (DISCORD_GUILD_ID) {
      console.log('\n💡 Guild commands should appear almost immediately in that server.');
    } else {
      console.log('\n💡 Note: Global commands may take several minutes to appear in Discord.');
      console.log('   For instant testing, set DISCORD_GUILD_ID and run the script again.');
    }
    console.log('   If commands do not appear, re-invite the bot with the applications.commands scope.');
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
