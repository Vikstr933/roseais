export class SimpleLogger {
  private name: string;

  constructor(name: string) {
    this.name = name;
  }

  info(message: string): void {
    console.log(`[${this.name}] INFO: ${message}`);
  }

  warn(message: string): void {
    console.warn(`[${this.name}] WARN: ${message}`);
  }

  error(message: string, error?: Error): void {
    console.error(`[${this.name}] ERROR: ${message}`, error);
  }

  debug(message: string): void {
    console.debug(`[${this.name}] DEBUG: ${message}`);
  }
}
