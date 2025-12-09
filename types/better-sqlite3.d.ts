declare module 'better-sqlite3' {
  interface Database {
    prepare(sql: string): Statement;
    close(): void;
    exec(sql: string): this;
    pragma(sql: string): any;
  }

  interface Statement {
    all(...params: any[]): any[];
    get(...params: any[]): any;
    run(...params: any[]): {
      changes: number;
      lastInsertRowid: number | bigint;
    };
    bind(...params: any[]): this;
  }

  interface DatabaseConstructor {
    new (filename: string): Database;
    (filename: string): Database;
  }

  const Database: DatabaseConstructor;
  export = Database;
}
