import fs from 'node:fs';
import path from 'node:path';

import { PLATFORM_SCHEMA } from '@/lib/platform/db/schema';

export type SqliteValue = string | number | bigint | Uint8Array | null;

export interface SqliteStatement {
  all(...params: SqliteValue[]): unknown[];
  get(...params: SqliteValue[]): unknown;
  run(...params: SqliteValue[]): unknown;
}

export interface SqliteDatabase {
  close(): void;
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
}

export type PlatformClient =
  | { driver: 'sqlite'; database: SqliteDatabase }
  | { driver: 'jsonl'; directory: string };

let clientPromise: Promise<PlatformClient> | undefined;
let activeClient: PlatformClient | undefined;
let sqliteFallbackWarned = false;

function dataDirectory(): string {
  return process.env.PLATFORM_DATA_DIR ?? path.join(process.cwd(), 'data');
}

function createJsonlClient(directory: string): PlatformClient {
  return { driver: 'jsonl', directory: path.join(directory, 'platform') };
}

async function createClient(): Promise<PlatformClient> {
  if (typeof window !== 'undefined') throw new Error('Platform storage is server-only');
  const directory = dataDirectory();
  if (process.env.PLATFORM_DB_DRIVER === 'jsonl') return createJsonlClient(directory);

  const sqliteModuleName = 'node:sqlite';
  let sqlite: { DatabaseSync: new (fileName: string) => SqliteDatabase };
  try {
    sqlite = (await import(sqliteModuleName)) as unknown as {
      DatabaseSync: new (fileName: string) => SqliteDatabase;
    };
  } catch (error) {
    if (!sqliteFallbackWarned) {
      sqliteFallbackWarned = true;
      console.warn('node:sqlite unavailable; falling back to jsonl platform storage.', error);
    }
    return createJsonlClient(directory);
  }

  fs.mkdirSync(directory, { recursive: true });
  const database = new sqlite.DatabaseSync(path.join(directory, 'platform.db'));
  for (const sql of PLATFORM_SCHEMA.split(';')) {
    const statement = sql.trim();
    if (statement) database.exec(statement);
  }
  // Additive migration: never infer the source of pre-existing records.
  for (const table of ['test_results', 'feedback_records']) {
    const columns = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{
      name: string;
    }>;
    if (!columns.some((column) => column.name === 'record_kind')) {
      database.exec(`ALTER TABLE ${table} ADD COLUMN record_kind TEXT NOT NULL DEFAULT 'legacy'`);
    }
    if (table === 'test_results' && !columns.some((column) => column.name === 'attempt_id')) {
      database.exec('ALTER TABLE test_results ADD COLUMN attempt_id TEXT');
    }
    if (table === 'test_results') {
      for (const [name, type] of [
        ['scene_id', 'TEXT'],
        ['stage_id', 'TEXT'],
        ['attempt_total', 'INTEGER'],
      ]) {
        if (!columns.some((column) => column.name === name))
          database.exec(`ALTER TABLE test_results ADD COLUMN ${name} ${type}`);
      }
    }
  }
  return { driver: 'sqlite', database };
}

export function getPlatformClient(): Promise<PlatformClient> {
  if (!clientPromise) {
    clientPromise = createClient().then((client) => {
      activeClient = client;
      return client;
    });
  }
  return clientPromise;
}

export function resetPlatformClientForTests(): void {
  if (activeClient?.driver === 'sqlite') activeClient.database.close();
  activeClient = undefined;
  clientPromise = undefined;
  sqliteFallbackWarned = false;
}
