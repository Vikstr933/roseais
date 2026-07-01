import { REST, Routes } from 'discord.js';
import { SimpleLogger } from '../utils/SimpleLogger';

const logger = new SimpleLogger('DiscordCommandRegistry');

export const discordApplicationCommands = [
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
  {
    name: 'play',
    description: 'Play music from a song name, Spotify link, or YouTube link',
    options: [
      {
        name: 'query',
        description: 'Song name, Spotify link, or YouTube link',
        type: 3,
        required: true,
        autocomplete: true,
      },
    ],
  },
  {
    name: 'skip',
    description: 'Skip the currently playing song',
  },
  {
    name: 'stop',
    description: 'Stop music and leave the voice channel',
  },
  {
    name: 'pause',
    description: 'Pause the current song',
  },
  {
    name: 'resume',
    description: 'Resume the paused song',
  },
  {
    name: 'queue',
    description: 'Show the music queue',
  },
  {
    name: 'nowplaying',
    description: 'Show the currently playing song',
  },
];

export async function registerDiscordApplicationCommands(params: {
  botToken: string;
  clientId: string;
  guildId?: string;
}): Promise<any[]> {
  const rest = new REST({ version: '10' }).setToken(params.botToken);
  const route = params.guildId
    ? Routes.applicationGuildCommands(params.clientId, params.guildId)
    : Routes.applicationCommands(params.clientId);

  const data = await rest.put(route, { body: discordApplicationCommands }) as any[];
  logger.info(
    `Registered ${data.length} Discord slash command(s) ${params.guildId ? `for guild ${params.guildId}` : 'globally'}`
  );
  return data;
}
