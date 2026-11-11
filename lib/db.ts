// Yerel SQLite (node:sqlite) üzerinde D1 benzeri küçük bir adaptör.
// Sorgular `db().prepare(sql).bind(...).first()/all()/run()` biçiminde yazılır.
import fs from 'node:fs';
import path from 'node:path';
import type {DatabaseSync as DatabaseSyncType} from 'node:sqlite';

type Sqlite = typeof import('node:sqlite');

export type Statement = {
  bind: (...args: unknown[]) => Statement;
  first: <T = any>() => Promise<T | null>;
  all: <T = any>() => Promise<{results: T[]}>;
  run: () => Promise<{meta: {changes: number}}>;
};
export type Database = {
  prepare: (sql: string) => Statement;
  batch: (statements: Statement[]) => Promise<{meta: {changes: number}}[]>;
};

export const dataDir = () => path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.DATA_DIR || 'data');

function toParam(value: unknown) {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value as any;
}

export function createDatabase(sqlite: DatabaseSyncType): Database {
  const statement = (sql: string, args: unknown[] = []): Statement => ({
    bind: (...next: unknown[]) => statement(sql, next),
    first: async () => (sqlite.prepare(sql).get(...args.map(toParam)) as any) ?? null,
    all: async () => ({results: sqlite.prepare(sql).all(...args.map(toParam)) as any[]}),
    run: async () => ({meta: {changes: Number(sqlite.prepare(sql).run(...args.map(toParam)).changes)}}),
  });
  return {
    prepare: (sql) => statement(sql),
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const s of statements) results.push(await s.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

export function migrate(sqlite: DatabaseSyncType, dir = path.join(/*turbopackIgnore: true*/ process.cwd(), 'migrations')) {
  sqlite.exec('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const done = new Set((sqlite.prepare('SELECT name FROM _migrations').all() as any[]).map((r) => r.name));
  for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()) {
    if (done.has(name)) continue;
    sqlite.exec('BEGIN');
    try {
      sqlite.exec(fs.readFileSync(path.join(dir, name), 'utf8'));
      sqlite.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run(name, new Date().toISOString());
      sqlite.exec('COMMIT');
    } catch (e) {
      sqlite.exec('ROLLBACK');
      throw new Error('Migration başarısız: ' + name + ' — ' + (e as Error).message);
    }
  }
}

const globalStore = globalThis as unknown as {__gyDb?: Database};

export function getDb(): Database {
  if (globalStore.__gyDb) return globalStore.__gyDb;
  // process.getBuiltinModule bundler'ın node:sqlite modülünü paketlemeye çalışmasını engeller.
  const {DatabaseSync} = process.getBuiltinModule('node:sqlite') as Sqlite;
  fs.mkdirSync(dataDir(), {recursive: true});
  const sqlite = new DatabaseSync(path.join(dataDir(), 'app.db'));
  sqlite.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  migrate(sqlite);
  globalStore.__gyDb = createDatabase(sqlite);
  return globalStore.__gyDb;
}
