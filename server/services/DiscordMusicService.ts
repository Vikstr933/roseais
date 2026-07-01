import { Message, TextChannel, VoiceBasedChannel, Client } from 'discord.js';
import { SimpleLogger } from '../utils/SimpleLogger';

const logger = new SimpleLogger('DiscordMusicService');

type MusicAction = 'play' | 'skip' | 'stop' | 'pause' | 'resume' | 'queue' | 'nowplaying';

export interface ParsedMusicCommand {
  action: MusicAction;
  query?: string;
}

interface MusicTrack {
  title: string;
  url: string;
  duration?: string;
  requestedBy: string;
  sourceQuery: string;
}

interface GuildMusicState {
  connection: any;
  player: any;
  queue: MusicTrack[];
  current?: MusicTrack;
  textChannelId?: string;
  idleTimer?: NodeJS.Timeout;
}

export class DiscordMusicService {
  private states = new Map<string, GuildMusicState>();

  parseMusicCommand(content: string): ParsedMusicCommand | null {
    const normalized = content.trim();
    const lower = normalized.toLowerCase();

    const playMatch = normalized.match(/^(?:kan du\s+)?(?:play|musik|music)\s+(.+)$/i);
    if (playMatch?.[1]?.trim()) {
      return { action: 'play', query: playMatch[1].trim() };
    }

    if (/^(?:pausa|pause)$/i.test(lower)) return { action: 'pause' };
    if (/^(?:fortsätt|fortsatt|resume|continue|unpause)$/i.test(lower)) return { action: 'resume' };
    if (/^(?:skippa|skip|nästa|nasta|next)$/i.test(lower)) return { action: 'skip' };
    if (/^(?:stoppa|stop|leave|disconnect|stäng av musiken|stang av musiken)$/i.test(lower)) return { action: 'stop' };
    if (/^(?:kö|ko|queue)$/i.test(lower)) return { action: 'queue' };
    if (/^(?:np|nowplaying|now playing|nu spelas)$/i.test(lower)) return { action: 'nowplaying' };

    return null;
  }

  async handleMessageCommand(message: Message, command: ParsedMusicCommand): Promise<void> {
    try {
      if (!message.guild) {
        await message.reply('Musik fungerar bara inne på en Discord-server med voice channels.');
        return;
      }

      switch (command.action) {
        case 'play': {
          const voiceChannel = message.member?.voice?.channel;
          if (!voiceChannel) {
            await message.reply('Gå in i en voice channel först, så hoppar jag in där.');
            return;
          }

          const result = await this.enqueue({
            guildId: message.guild.id,
            voiceChannel,
            textChannel: message.channel instanceof TextChannel ? message.channel : null,
            requestedBy: message.author.username,
            query: command.query || '',
          });
          await message.reply(result);
          return;
        }
        case 'skip':
          await message.reply(await this.skip(message.guild.id));
          return;
        case 'stop':
          await message.reply(await this.stop(message.guild.id));
          return;
        case 'pause':
          await message.reply(await this.pause(message.guild.id));
          return;
        case 'resume':
          await message.reply(await this.resume(message.guild.id));
          return;
        case 'queue':
          await message.reply(this.getQueueMessage(message.guild.id));
          return;
        case 'nowplaying':
          await message.reply(this.getNowPlayingMessage(message.guild.id));
          return;
      }
    } catch (error) {
      logger.error('Music command failed', error as Error);
      await message.reply(this.formatMusicError(error));
    }
  }

  async handleInteractionCommand(
    client: Client | null,
    interaction: any,
    command: ParsedMusicCommand
  ): Promise<void> {
    if (!client) {
      logger.warn('Discord client unavailable for music interaction');
      await this.updateInteractionResponse(
        interaction,
        'Elon är inte inloggad i Discord just nu. Starta om backend eller kontrollera DISCORD_BOT_TOKEN.'
      );
      return;
    }

    const guildId = interaction.guild_id;
    const userId = interaction.member?.user?.id || interaction.user?.id;
    const textChannelId = interaction.channel_id;

    if (!guildId || !userId || !textChannelId) {
      logger.warn('Missing guild/user/channel for music interaction');
      return;
    }

    try {
      switch (command.action) {
        case 'play': {
          const guild = await client.guilds.fetch(guildId);
          const member = await guild.members.fetch(userId);
          const voiceChannel = member.voice?.channel;
          if (!voiceChannel) {
            await this.updateInteractionResponse(interaction, 'Gå in i en voice channel först, så hoppar jag in där.');
            return;
          }

          const result = await this.enqueue({
            guildId,
            voiceChannel,
            textChannel: null,
            requestedBy: member.user.username,
            query: command.query || '',
          });
          await this.updateInteractionResponse(interaction, result);
          return;
        }
        case 'skip':
          await this.updateInteractionResponse(interaction, await this.skip(guildId));
          return;
        case 'stop':
          await this.updateInteractionResponse(interaction, await this.stop(guildId));
          return;
        case 'pause':
          await this.updateInteractionResponse(interaction, await this.pause(guildId));
          return;
        case 'resume':
          await this.updateInteractionResponse(interaction, await this.resume(guildId));
          return;
        case 'queue':
          await this.updateInteractionResponse(interaction, this.getQueueMessage(guildId));
          return;
        case 'nowplaying':
          await this.updateInteractionResponse(interaction, this.getNowPlayingMessage(guildId));
          return;
      }
    } catch (error) {
      logger.error('Music interaction failed', error as Error);
      await this.updateInteractionResponse(interaction, this.formatMusicError(error));
    }
  }

  private async updateInteractionResponse(interaction: any, content: string): Promise<void> {
    const applicationId = interaction.application_id;
    const token = interaction.token;

    if (!applicationId || !token) {
      logger.warn('Cannot update Discord interaction response without application_id and token');
      return;
    }

    try {
      const response = await fetch(
        `https://discord.com/api/v10/webhooks/${applicationId}/${token}/messages/@original`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        }
      );

      if (!response.ok) {
        logger.warn(`Failed to update Discord interaction response: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      logger.error('Failed to update Discord interaction response', error as Error);
    }
  }

  private async enqueue(params: {
    guildId: string;
    voiceChannel: VoiceBasedChannel;
    textChannel: TextChannel | null;
    requestedBy: string;
    query: string;
  }): Promise<string> {
    if (!params.query.trim()) {
      return 'Skriv en låt, Spotify-länk eller YouTube-länk efter `play`.';
    }

    const track = await this.resolveTrack(params.query, params.requestedBy);
    const state = await this.getOrCreateState(params.guildId, params.voiceChannel, params.textChannel?.id);
    state.textChannelId = params.textChannel?.id || state.textChannelId;
    state.queue.push(track);

    if (!state.current) {
      await this.playNext(params.guildId);
      return `🎶 Spelar nu: **${track.title}**`;
    }

    return `➕ Lade till i kön: **${track.title}** (${state.queue.length} låt${state.queue.length === 1 ? '' : 'ar'} i kö)`;
  }

  private async getOrCreateState(
    guildId: string,
    voiceChannel: VoiceBasedChannel,
    textChannelId?: string
  ): Promise<GuildMusicState> {
    const existing = this.states.get(guildId);
    if (existing) {
      return existing;
    }

    const voice = await this.loadVoicePackage();
    const player = voice.createAudioPlayer();
    const connection = voice.joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: true,
    });

    const state: GuildMusicState = {
      connection,
      player,
      queue: [],
      textChannelId,
    };

    connection.subscribe(player);
    this.states.set(guildId, state);

    player.on(voice.AudioPlayerStatus.Idle, () => {
      state.current = undefined;
      void this.playNext(guildId);
    });

    player.on('error', (error: Error) => {
      logger.error('Discord audio player error', error);
      state.current = undefined;
      void this.playNext(guildId);
    });

    connection.on(voice.VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          voice.entersState(connection, voice.VoiceConnectionStatus.Signalling, 5_000),
          voice.entersState(connection, voice.VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        this.destroyState(guildId);
      }
    });

    return state;
  }

  private async playNext(guildId: string): Promise<void> {
    const state = this.states.get(guildId);
    if (!state) return;

    if (state.idleTimer) {
      clearTimeout(state.idleTimer);
      state.idleTimer = undefined;
    }

    const next = state.queue.shift();
    if (!next) {
      state.idleTimer = setTimeout(() => this.destroyState(guildId), 120_000);
      return;
    }

    try {
      const voice = await this.loadVoicePackage();
      const play = await this.loadPlayPackage();
      const streamInfo = await play.stream(next.url);
      const resource = voice.createAudioResource(streamInfo.stream, {
        inputType: streamInfo.type,
      });

      state.current = next;
      state.player.play(resource);
    } catch (error) {
      logger.error(`Failed to play track ${next.title}`, error as Error);
      state.current = undefined;
      await this.playNext(guildId);
    }
  }

  private async resolveTrack(query: string, requestedBy: string): Promise<MusicTrack> {
    const play = await this.loadPlayPackage();
    const trimmed = query.trim();

    if (this.isSpotifyUrl(trimmed)) {
      const spotifyQuery = await this.resolveSpotifySearchQuery(trimmed);
      return this.searchYouTube(spotifyQuery, requestedBy, trimmed);
    }

    if (this.isUrl(trimmed)) {
      const type = await play.validate(trimmed);
      if (type === 'yt_video') {
        const info = await play.video_info(trimmed);
        const details = info.video_details;
        return {
          title: details.title || trimmed,
          url: details.url || trimmed,
          duration: details.durationRaw,
          requestedBy,
          sourceQuery: trimmed,
        };
      }
    }

    return this.searchYouTube(trimmed, requestedBy, trimmed);
  }

  private async resolveSpotifySearchQuery(url: string): Promise<string> {
    const play = await this.loadPlayPackage();

    try {
      const spotify = await play.spotify(url);
      if (spotify?.type === 'track') {
        const artists = Array.isArray(spotify.artists)
          ? spotify.artists.map((artist: any) => artist?.name || artist).filter(Boolean).join(' ')
          : '';
        return `${spotify.name || spotify.title || ''} ${artists}`.trim();
      }

      if (typeof spotify?.all_tracks === 'function') {
        const tracks = await spotify.all_tracks();
        const first = tracks?.[0];
        if (first) {
          const artists = Array.isArray(first.artists)
            ? first.artists.map((artist: any) => artist?.name || artist).filter(Boolean).join(' ')
            : '';
          return `${first.name || first.title || ''} ${artists}`.trim();
        }
      }
    } catch (error) {
      logger.warn('play-dl could not parse Spotify URL, falling back to oEmbed', error as Error);
    }

    const response = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
    if (!response.ok) {
      throw new Error('Kunde inte läsa Spotify-länken. Testa att skriva låtnamn och artist i stället.');
    }

    const data = await response.json() as { title?: string };
    const title = (data.title || '').replace(/\s*\|\s*Spotify\s*$/i, '').replace(/\s+-\s+song by\s+/i, ' ');
    if (!title.trim()) {
      throw new Error('Spotify-länken saknade titel. Testa att skriva låtnamn och artist i stället.');
    }

    return title.trim();
  }

  private async searchYouTube(query: string, requestedBy: string, sourceQuery: string): Promise<MusicTrack> {
    const play = await this.loadPlayPackage();
    const results = await play.search(query, { limit: 1 });
    const first = results?.[0];

    if (!first?.url) {
      throw new Error(`Hittade ingen spelbar låt för "${query}".`);
    }

    return {
      title: first.title || query,
      url: first.url,
      duration: first.durationRaw,
      requestedBy,
      sourceQuery,
    };
  }

  private async skip(guildId: string): Promise<string> {
    const state = this.states.get(guildId);
    if (!state?.current) return 'Det spelas inget just nu.';
    const skipped = state.current.title;
    state.player.stop(true);
    return `⏭️ Skippade **${skipped}**`;
  }

  private async stop(guildId: string): Promise<string> {
    const state = this.states.get(guildId);
    if (!state) return 'Jag spelar inget just nu.';
    this.destroyState(guildId);
    return '⏹️ Stoppade musiken och lämnade voice channel.';
  }

  private async pause(guildId: string): Promise<string> {
    const state = this.states.get(guildId);
    if (!state?.current) return 'Det spelas inget just nu.';
    state.player.pause(true);
    return '⏸️ Pausade musiken.';
  }

  private async resume(guildId: string): Promise<string> {
    const state = this.states.get(guildId);
    if (!state?.current) return 'Det finns inget att fortsätta spela.';
    state.player.unpause();
    return '▶️ Fortsätter spela.';
  }

  private getQueueMessage(guildId: string): string {
    const state = this.states.get(guildId);
    if (!state || (!state.current && state.queue.length === 0)) {
      return 'Kön är tom.';
    }

    const current = state.current ? `Nu: **${state.current.title}**\n` : '';
    const upcoming = state.queue
      .slice(0, 10)
      .map((track, index) => `${index + 1}. ${track.title}`)
      .join('\n');

    return `🎵 **Musikkö**\n${current}${upcoming || 'Inga kommande låtar.'}`;
  }

  private getNowPlayingMessage(guildId: string): string {
    const current = this.states.get(guildId)?.current;
    if (!current) return 'Det spelas inget just nu.';
    return `🎧 Nu spelas: **${current.title}**${current.duration ? ` (${current.duration})` : ''}`;
  }

  private destroyState(guildId: string): void {
    const state = this.states.get(guildId);
    if (!state) return;
    if (state.idleTimer) clearTimeout(state.idleTimer);
    try {
      state.player.stop(true);
      state.connection.destroy();
    } catch {
      // Connection may already be gone.
    }
    this.states.delete(guildId);
  }

  private async loadVoicePackage(): Promise<any> {
    try {
      const packageName = '@discordjs/voice';
      return await import(packageName);
    } catch {
      throw new Error('Discord voice-paket saknas. Kör: npm install @discordjs/voice prism-media ffmpeg-static');
    }
  }

  private async loadPlayPackage(): Promise<any> {
    try {
      const packageName = 'play-dl';
      const mod = await import(packageName);
      return mod.default || mod;
    } catch {
      throw new Error('Music extractor saknas. Kör: npm install play-dl');
    }
  }

  private isUrl(value: string): boolean {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  private isSpotifyUrl(value: string): boolean {
    return /^https?:\/\/open\.spotify\.com\/(track|album|playlist)\//i.test(value);
  }

  private formatMusicError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return `❌ Kunde inte spela musiken: ${message}`;
  }
}

export const discordMusicService = new DiscordMusicService();
