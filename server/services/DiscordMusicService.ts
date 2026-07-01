import { Message, TextChannel, VoiceBasedChannel, Client } from 'discord.js';
import { SimpleLogger } from '../utils/SimpleLogger';

const logger = new SimpleLogger('DiscordMusicService');

type MusicAction = 'play' | 'skip' | 'stop' | 'pause' | 'resume' | 'queue' | 'nowplaying';

export interface ParsedMusicCommand {
  action: MusicAction;
  query?: string;
}

export interface MusicAutocompleteChoice {
  name: string;
  value: string;
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
  private playTokensConfigured = false;
  private unhandledRejectionHandlerInstalled = false;

  constructor() {
    this.installUnhandledRejectionHandler();
  }

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

  async getAutocompleteChoices(query: string): Promise<MusicAutocompleteChoice[]> {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 3) {
      return [];
    }

    if (this.isPlayableHttpUrl(trimmed)) {
      if (trimmed.length > 100) {
        return [];
      }

      return [{
        name: this.truncateChoiceText(`Använd länk: ${trimmed}`, 100),
        value: trimmed,
      }];
    }

    try {
      const results = await this.searchYouTubeResults(trimmed, 10);

      return (results || [])
        .map((result: any) => {
          const url = this.getPlayableYouTubeUrl(result);
          if (!url) return null;

          const title = result.title || trimmed;
          const duration = result.durationRaw ? ` (${result.durationRaw})` : '';
          return {
            name: this.truncateChoiceText(`${title}${duration}`, 100),
            value: this.truncateChoiceText(url, 100),
          };
        })
        .filter(Boolean)
        .slice(0, 5) as MusicAutocompleteChoice[];
    } catch (error) {
      if (this.isYouTubeRateLimitError(error)) {
        logger.warn('YouTube autocomplete was rate limited', error as Error);
        return [];
      }

      logger.warn('Failed to build music autocomplete choices', error as Error);
      return [];
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
      const started = await this.playNext(params.guildId);
      if (!started) {
        throw new Error('Kunde inte starta låten.');
      }
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
      void this.playNext(guildId).catch((error) => {
        logger.error('Failed to continue Discord music queue after idle', error as Error);
      });
    });

    player.on('error', (error: Error) => {
      logger.error('Discord audio player error', error);
      state.current = undefined;
      void this.playNext(guildId).catch((queueError) => {
        logger.error('Failed to continue Discord music queue after player error', queueError as Error);
      });
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

  private async playNext(guildId: string): Promise<boolean> {
    const state = this.states.get(guildId);
    if (!state) return false;

    if (state.idleTimer) {
      clearTimeout(state.idleTimer);
      state.idleTimer = undefined;
    }

    const next = state.queue.shift();
    if (!next) {
      state.idleTimer = setTimeout(() => this.destroyState(guildId), 120_000);
      return false;
    }

    try {
      const voice = await this.loadVoicePackage();
      const play = await this.loadPlayPackage();
      if (!this.isPlayableHttpUrl(next.url)) {
        throw new Error(`Ogiltig ljudkälla för "${next.title}".`);
      }
      const streamInfo = await play.stream(next.url);
      const resource = voice.createAudioResource(streamInfo.stream, {
        inputType: streamInfo.type,
      });

      state.current = next;
      state.player.play(resource);
      return true;
    } catch (error) {
      logger.error(`Failed to play track ${next.title}`, error as Error);
      state.current = undefined;
      if (this.isYouTubeBotCheckError(error)) {
        throw new Error(this.getYouTubeBotCheckMessage());
      }
      if (this.isYouTubeRateLimitError(error)) {
        throw new Error(this.getYouTubeRateLimitMessage());
      }
      return this.playNext(guildId);
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
        let info: any;
        try {
          info = await play.video_info(trimmed);
        } catch (error) {
          if (this.isYouTubeRateLimitError(error)) {
            throw new Error(this.getYouTubeRateLimitMessage());
          }
          throw error;
        }
        const details = info.video_details;
        const playableUrl = this.isPlayableHttpUrl(details?.url) ? details.url : trimmed;
        return {
          title: details.title || trimmed,
          url: playableUrl,
          duration: details.durationRaw,
          requestedBy,
          sourceQuery: trimmed,
        };
      }

      if (this.isYouTubeUrl(trimmed)) {
        return {
          title: trimmed,
          url: trimmed,
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
    const results = await this.searchYouTubeResults(query, 10);
    const first = results?.find((result) =>
      this.getPlayableYouTubeUrl(result) && this.scoreMusicSearchResult(result, query) > 0
    );
    const url = this.getPlayableYouTubeUrl(first);

    if (!first || !url) {
      throw new Error(`Hittade ingen relevant låt för "${query}". Testa artist + låtnamn, en Spotify-länk eller välj rätt låt i dropdownen.`);
    }

    return {
      title: first.title || query,
      url,
      duration: first.durationRaw,
      requestedBy,
      sourceQuery,
    };
  }

  private async searchYouTubeResults(query: string, limit: number): Promise<any[]> {
    const play = await this.loadPlayPackage();
    const searchQueries = this.buildMusicSearchQueries(query);
    const seen = new Set<string>();
    const results: any[] = [];

    for (const searchQuery of searchQueries) {
      try {
        const found = await play.search(searchQuery, {
          limit,
          source: { youtube: 'video' },
        });

        for (const result of found || []) {
          const url = this.getPlayableYouTubeUrl(result);
          if (!url) continue;

          const key = result.id || url;
          if (seen.has(key)) continue;

          seen.add(key);
          results.push(result);
        }
      } catch (error) {
        if (this.isYouTubeRateLimitError(error)) {
          throw new Error(this.getYouTubeRateLimitMessage());
        }

        logger.warn(`YouTube search failed for "${searchQuery}"`, error as Error);
      }

      if (results.length >= limit) {
        break;
      }
    }

    return results
      .filter((result) => this.scoreMusicSearchResult(result, query) > 0)
      .sort((a, b) => this.scoreMusicSearchResult(b, query) - this.scoreMusicSearchResult(a, query))
      .slice(0, limit);
  }

  private buildMusicSearchQueries(query: string): string[] {
    const normalized = query.replace(/\s+/g, ' ').trim();
    const queries: string[] = [];
    const dashMatch = normalized.match(/^(.+?)\s*[-–—]\s*(.+)$/);

    if (dashMatch) {
      const artist = dashMatch[1].trim();
      const title = dashMatch[2].trim();
      queries.push(`${artist} ${title} låt official audio`);
      queries.push(`${artist} ${title} song`);
    } else {
      queries.push(`${normalized} låt official audio`);
      queries.push(`${normalized} song`);
    }

    queries.push(normalized);

    return Array.from(new Set(queries.filter(Boolean)));
  }

  private scoreMusicSearchResult(result: any, query: string): number {
    const title = String(result?.title || '').toLowerCase();
    const channel = String(result?.channel?.name || result?.channel?.title || '').toLowerCase();
    const combined = `${title} ${channel}`;
    const normalizedQuery = query.toLowerCase().replace(/\s+/g, ' ').trim();
    const queryParts = this.getSearchTokens(normalizedQuery);
    let score = 0;

    for (const token of queryParts) {
      if (combined.includes(token)) score += 8;
      if (title.includes(token)) score += 4;
    }

    if (title.includes(normalizedQuery.replace(/\s*[-–—]\s*/g, ' '))) score += 20;
    if (/\bofficial\b|\baudio\b|\blyrics?\b|\bmusic video\b|\btopic\b|\bprovided to youtube\b/i.test(combined)) score += 12;
    if (/\bassembly\b|\breview\b|\btutorial\b|\bunboxing\b|\bmanual\b|\bhow to\b|\binstallation\b|\bguide\b|\bbaby\b|\bstroller\b|\b4\s*in\s*1\b|\beng\b/i.test(combined)) score -= 60;
    if (result?.durationInSec && result.durationInSec > 45 && result.durationInSec < 900) score += 8;
    if (result?.live || result?.upcoming) score -= 20;

    return score;
  }

  private getSearchTokens(value: string): string[] {
    return value
      .replace(/[-–—]/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2 && !['the', 'and', 'official', 'audio', 'song', 'låt'].includes(token));
  }

  private getPlayableYouTubeUrl(result: any): string | null {
    if (!result) return null;

    const directUrl = typeof result.url === 'string' ? result.url.trim() : '';
    if (this.isPlayableHttpUrl(directUrl)) {
      return directUrl;
    }

    const id = typeof result.id === 'string' ? result.id.trim() : '';
    if (/^[a-zA-Z0-9_-]{11}$/.test(id)) {
      return `https://www.youtube.com/watch?v=${id}`;
    }

    return null;
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
      const play = mod.default || mod;
      await this.configurePlayPackage(play);
      return play;
    } catch {
      throw new Error('Music extractor saknas. Kör: npm install play-dl');
    }
  }

  private async configurePlayPackage(play: any): Promise<void> {
    if (this.playTokensConfigured || typeof play?.setToken !== 'function') {
      return;
    }

    const youtubeCookie =
      process.env.PLAY_DL_YOUTUBE_COOKIE ||
      process.env.YOUTUBE_COOKIE ||
      process.env.YOUTUBE_COOKIES;
    const userAgents = this.getConfiguredUserAgents();
    const tokens: any = {
      useragent: userAgents.length > 0 ? userAgents : [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
      ],
    };

    if (youtubeCookie?.trim()) {
      tokens.youtube = { cookie: youtubeCookie.trim() };
    }

    try {
      await play.setToken(tokens);
      this.playTokensConfigured = true;
      logger.info(`Configured play-dl YouTube tokens${tokens.youtube ? ' with cookie' : ' with user-agent fallback'}`);
    } catch (error) {
      this.playTokensConfigured = true;
      logger.warn('Failed to configure play-dl tokens', error as Error);
    }
  }

  private getConfiguredUserAgents(): string[] {
    const raw = process.env.PLAY_DL_USER_AGENTS || process.env.YOUTUBE_USER_AGENTS || process.env.YOUTUBE_USER_AGENT;
    if (!raw) return [];
    return raw
      .split(/\r?\n|\|/)
      .map((value) => value.trim())
      .filter(Boolean);
  }

  private truncateChoiceText(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    return value.slice(0, maxLength - 1).trimEnd();
  }

  private isUrl(value: string): boolean {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  private isPlayableHttpUrl(value: string | undefined | null): value is string {
    if (!value || value === 'undefined' || value === 'null') {
      return false;
    }

    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private isYouTubeUrl(value: string): boolean {
    try {
      const host = new URL(value).hostname.toLowerCase();
      return host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be';
    } catch {
      return false;
    }
  }

  private isSpotifyUrl(value: string): boolean {
    return /^https?:\/\/open\.spotify\.com\/(track|album|playlist)\//i.test(value);
  }

  private formatMusicError(error: unknown): string {
    if (this.isYouTubeBotCheckError(error)) {
      return `❌ ${this.getYouTubeBotCheckMessage()}`;
    }
    if (this.isYouTubeRateLimitError(error)) {
      return `❌ ${this.getYouTubeRateLimitMessage()}`;
    }
    const message = error instanceof Error ? error.message : String(error);
    return `❌ Kunde inte spela musiken: ${message}`;
  }

  private isYouTubeRateLimitError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /\b429\b|too many requests|rate.?limit/i.test(message);
  }

  private isYouTubeBotCheckError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /sign in to confirm|not a bot|confirm you.?re not a bot|unusual traffic/i.test(message);
  }

  private getYouTubeRateLimitMessage(): string {
    return 'YouTube rate-limitade servern (429), så jag kunde inte hämta ljudet. Lägg till PLAY_DL_YOUTUBE_COOKIE eller YOUTUBE_COOKIE i backendens env, eller testa igen om en stund.';
  }

  private getYouTubeBotCheckMessage(): string {
    return 'YouTube kräver bot-verifiering för servern, så jag kunde inte hämta ljudet. Testa en färsk PLAY_DL_YOUTUBE_COOKIE från ett separat YouTube-konto; om det fortsätter behövs Lavalink med youtube-source OAuth/poToken.';
  }

  private installUnhandledRejectionHandler(): void {
    if (this.unhandledRejectionHandlerInstalled) return;
    this.unhandledRejectionHandlerInstalled = true;

    process.on('unhandledRejection', (reason) => {
      if (this.isYouTubeRateLimitError(reason)) {
        logger.warn(`Suppressed play-dl YouTube rate limit rejection: ${reason instanceof Error ? reason.message : String(reason)}`);
        return;
      }
      if (this.isYouTubeBotCheckError(reason)) {
        logger.warn(`Suppressed play-dl YouTube bot-check rejection: ${reason instanceof Error ? reason.message : String(reason)}`);
        return;
      }
      logger.error('Unhandled promise rejection in Discord music service', reason instanceof Error ? reason : new Error(String(reason)));
    });
  }
}

export const discordMusicService = new DiscordMusicService();
