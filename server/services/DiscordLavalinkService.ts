import { Client, VoiceBasedChannel } from 'discord.js';
import { LavalinkManager } from 'lavalink-client';
import { SimpleLogger } from '../utils/SimpleLogger';

const logger = new SimpleLogger('DiscordLavalinkService');

interface LavalinkPlayParams {
  client: Client;
  guildId: string;
  voiceChannel: VoiceBasedChannel;
  textChannelId?: string;
  query: string;
  requestedBy: {
    id?: string;
    username?: string;
  };
}

interface LavalinkSearchChoice {
  name: string;
  value: string;
}

export class DiscordLavalinkService {
  private manager: LavalinkManager | null = null;
  private initializedClientId: string | null = null;

  isConfigured(): boolean {
    return Boolean(this.getNodeConfig());
  }

  isReady(): boolean {
    return Boolean(this.manager?.useable);
  }

  async initialize(client: Client<true>): Promise<void> {
    const node = this.getNodeConfig();
    if (!node) {
      logger.info('Lavalink is not configured; Discord music will use play-dl fallback');
      return;
    }

    if (this.manager && this.initializedClientId === client.user.id) {
      return;
    }

    logger.info(`Initializing Lavalink node ${node.id} at ${node.secure ? 'wss' : 'ws'}://${node.host}:${node.port}`);

    this.manager = new LavalinkManager({
      nodes: [node],
      sendToShard: (guildId, payload) => {
        const guild = client.guilds.cache.get(guildId);
        guild?.shard?.send(payload);
      },
      autoSkip: true,
      client: {
        id: client.user.id,
        username: client.user.username,
      },
      playerOptions: {
        defaultSearchPlatform: this.getDefaultSearchSource() as any,
        onDisconnect: {
          autoReconnect: true,
          destroyPlayer: false,
        },
        onEmptyQueue: {
          destroyAfterMs: 120_000,
        },
        volumeDecrementer: 0.75,
      },
    });

    this.attachEvents();
    await this.manager.init({
      id: client.user.id,
      username: client.user.username,
    });
    this.initializedClientId = client.user.id;
  }

  async sendRawData(data: any): Promise<void> {
    if (!this.manager) return;

    try {
      await this.manager.sendRawData(data);
    } catch (error) {
      logger.warn('Failed to forward Discord raw voice event to Lavalink', error as Error);
    }
  }

  async play(params: LavalinkPlayParams): Promise<string> {
    await this.ensureInitialized(params.client);
    if (!this.manager?.useable) {
      throw new Error('Lavalink är inte ansluten ännu. Kontrollera LAVALINK_HOST/PORT/PASSWORD och att Lavalink-servern kör.');
    }

    const query = params.query.trim();
    if (!query) {
      return 'Skriv en låt, Spotify-länk eller YouTube-länk efter `play`.';
    }

    const player = this.manager.createPlayer({
      guildId: params.guildId,
      voiceChannelId: params.voiceChannel.id,
      textChannelId: params.textChannelId,
      selfDeaf: true,
      selfMute: false,
      volume: this.getDefaultVolume(),
    });

    await player.connect();

    const result = await player.search(this.buildSearchQuery(query), params.requestedBy, false);
    const tracks = (result?.tracks || []).filter((track: any) => this.isPlayableTrack(track));

    if (tracks.length === 0) {
      throw new Error(`Lavalink hittade ingen spelbar låt för "${query}". Testa en direkt Spotify-/YouTube-länk eller välj i dropdownen.`);
    }

    const track = this.pickBestTrack(tracks, query);
    await player.queue.add(track);

    if (!player.playing && !player.paused) {
      await player.play();
    }

    const title = track?.info?.title || query;
    const queued = player.queue.tracks?.length || 0;
    return queued > 0 && player.queue.current
      ? `➕ Lade till via Lavalink: **${title}** (${queued} i kö)`
      : `🎶 Spelar via Lavalink: **${title}**`;
  }

  async autocomplete(query: string, client?: Client | null): Promise<LavalinkSearchChoice[]> {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 3) {
      return [];
    }

    if (client?.isReady()) {
      await this.ensureInitialized(client);
    }

    if (!this.manager?.useable) {
      return [];
    }

    try {
      const node = this.manager.nodeManager.leastUsedNodes?.('memory')?.[0];
      const result = node
        ? await node.search(this.buildSearchQuery(trimmed), { id: 'autocomplete' }, false)
        : null;

      return (result?.tracks || [])
        .filter((track: any) => this.isPlayableTrack(track))
        .sort((a: any, b: any) => this.scoreTrack(b, trimmed) - this.scoreTrack(a, trimmed))
        .slice(0, 5)
        .map((track: any) => ({
          name: this.truncate(`${track.info.title}${track.info.author ? ` - ${track.info.author}` : ''}`, 100),
          value: this.truncate(track.info.uri || track.info.title, 100),
        }))
        .filter((choice: LavalinkSearchChoice) => Boolean(choice.value));
    } catch (error) {
      logger.warn('Lavalink autocomplete failed', error as Error);
      return [];
    }
  }

  async skip(guildId: string): Promise<string | null> {
    const player = this.manager?.getPlayer(guildId);
    if (!player) return null;
    const current = player.queue.current?.info?.title || 'låten';
    await player.skip();
    return `⏭️ Skippade **${current}**`;
  }

  async stop(guildId: string): Promise<string | null> {
    const player = this.manager?.getPlayer(guildId);
    if (!player) return null;
    await player.destroy('Stopped by user');
    return '⏹️ Stoppade musiken och lämnade voice channel.';
  }

  async pause(guildId: string): Promise<string | null> {
    const player = this.manager?.getPlayer(guildId);
    if (!player) return null;
    await player.pause();
    return '⏸️ Pausade musiken.';
  }

  async resume(guildId: string): Promise<string | null> {
    const player = this.manager?.getPlayer(guildId);
    if (!player) return null;
    await player.resume();
    return '▶️ Fortsätter spela.';
  }

  getQueueMessage(guildId: string): string | null {
    const player = this.manager?.getPlayer(guildId);
    if (!player) return null;

    const current = player.queue.current?.info?.title ? `Nu: **${player.queue.current.info.title}**\n` : '';
    const upcoming = (player.queue.tracks || [])
      .slice(0, 10)
      .map((track: any, index: number) => `${index + 1}. ${track.info?.title || 'Okänd låt'}`)
      .join('\n');

    if (!current && !upcoming) return 'Kön är tom.';
    return `🎵 **Musikkö**\n${current}${upcoming || 'Inga kommande låtar.'}`;
  }

  getNowPlayingMessage(guildId: string): string | null {
    const current = this.manager?.getPlayer(guildId)?.queue.current;
    if (!current) return null;
    const duration = current.info?.duration ? ` (${this.formatDuration(current.info.duration)})` : '';
    return `🎧 Nu spelas via Lavalink: **${current.info?.title || 'Okänd låt'}**${duration}`;
  }

  private async ensureInitialized(client: Client): Promise<void> {
    if (!client.isReady()) {
      throw new Error('Discord-botten är inte redo ännu.');
    }

    await this.initialize(client);
  }

  private getNodeConfig(): any | null {
    const rawHost = process.env.LAVALINK_URL || process.env.LAVALINK_HOST;
    const password = process.env.LAVALINK_PASSWORD || process.env.LAVALINK_AUTHORIZATION || 'youshallnotpass';
    if (!rawHost) return null;

    const value = rawHost.trim();
    if (!value) return null;

    if (/^https?:\/\//i.test(value)) {
      const parsed = new URL(value);
      return {
        id: process.env.LAVALINK_NODE_ID || 'Main Node',
        host: parsed.hostname,
        port: Number(process.env.LAVALINK_PORT || parsed.port || (parsed.protocol === 'https:' ? 443 : 80)),
        authorization: password,
        secure: parsed.protocol === 'https:',
      };
    }

    return {
      id: process.env.LAVALINK_NODE_ID || 'Main Node',
      host: value.replace(/\/+$/, ''),
      port: Number(process.env.LAVALINK_PORT || 2333),
      authorization: password,
      secure: this.getBooleanEnv(process.env.LAVALINK_SECURE),
    };
  }

  private attachEvents(): void {
    if (!this.manager) return;

    this.manager.nodeManager.on('connect', (node: any) => {
      logger.info(`Lavalink node connected: ${node.id}`);
    });
    this.manager.nodeManager.on('error', (node: any, error: Error) => {
      logger.error(`Lavalink node error: ${node?.id || 'unknown'}`, error);
    });
    this.manager.nodeManager.on('disconnect', (node: any, reason: any) => {
      logger.warn(`Lavalink node disconnected: ${node?.id || 'unknown'} ${String(reason || '')}`);
    });
    this.manager.on('trackStart', (_player: any, track: any) => {
      logger.info(`Lavalink track started: ${track?.info?.title || 'Unknown track'}`);
    });
    this.manager.on('trackError', (_player: any, track: any, payload: any) => {
      logger.error(`Lavalink track error: ${track?.info?.title || 'Unknown track'}`, new Error(JSON.stringify(payload || {})));
    });
  }

  private buildSearchQuery(query: string): any {
    if (this.isUrl(query)) {
      return { query };
    }

    return {
      query,
      source: this.getDefaultSearchSource() as any,
    };
  }

  private pickBestTrack(tracks: any[], query: string): any {
    return [...tracks].sort((a, b) => this.scoreTrack(b, query) - this.scoreTrack(a, query))[0];
  }

  private isPlayableTrack(track: any): boolean {
    return Boolean(track?.encoded && track?.info?.title);
  }

  private scoreTrack(track: any, query: string): number {
    const title = String(track?.info?.title || '').toLowerCase();
    const author = String(track?.info?.author || '').toLowerCase();
    const combined = `${title} ${author}`;
    const tokens = query
      .toLowerCase()
      .replace(/[-–—]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length >= 2 && !['song', 'official', 'audio', 'låt'].includes(token));
    let score = 0;

    for (const token of tokens) {
      if (combined.includes(token)) score += 8;
      if (title.includes(token)) score += 4;
    }

    if (/\bofficial\b|\baudio\b|\blyrics?\b|\bmusic video\b|\btopic\b/i.test(combined)) score += 10;
    if (/\bassembly\b|\breview\b|\btutorial\b|\bunboxing\b|\bmanual\b|\bbaby\b|\bstroller\b|\b4\s*in\s*1\b|\beng\b/i.test(combined)) score -= 60;
    return score;
  }

  private getDefaultSearchSource(): string {
    return process.env.LAVALINK_SEARCH_SOURCE || 'ytmsearch';
  }

  private getDefaultVolume(): number {
    return Number(process.env.LAVALINK_DEFAULT_VOLUME || 80);
  }

  private getBooleanEnv(value: string | undefined): boolean {
    return /^(true|1|yes)$/i.test(value || '');
  }

  private isUrl(value: string): boolean {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  private truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    return value.slice(0, maxLength - 1).trimEnd();
  }

  private formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

export const discordLavalinkService = new DiscordLavalinkService();
