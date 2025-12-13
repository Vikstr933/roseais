export class SimpleLogger {
  private name: string;

  constructor(name: string) {
    this.name = name;
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    if (metadata) {
      console.log(`[${this.name}] INFO: ${message}`, metadata);
    } else {
      console.log(`[${this.name}] INFO: ${message}`);
    }
  }

  warn(message: string, errorOrMetadata?: Error | Record<string, unknown>): void {
    if (errorOrMetadata) {
      console.warn(`[${this.name}] WARN: ${message}`, errorOrMetadata);
    } else {
      console.warn(`[${this.name}] WARN: ${message}`);
    }
  }

  error(message: string, error?: Error): void {
    if (error) {
      console.error(`[${this.name}] ERROR: ${message}`, error);
    } else {
      console.error(`[${this.name}] ERROR: ${message}`);
    }
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    if (metadata) {
      console.debug(`[${this.name}] DEBUG: ${message}`, metadata);
    } else {
      console.debug(`[${this.name}] DEBUG: ${message}`);
    }
  }
}
