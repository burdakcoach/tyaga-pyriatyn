import "dotenv/config";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import * as schemaModule from "./schema";

// Reuse a single connection across hot reloads (Next.js dev) and across the bot process.
const globalForDb = globalThis as unknown as {
  __tyagaSqlite?: Database.Database;
  __tyagaDb?: ReturnType<typeof drizzle>;
};

// Lazy connection: the actual DB file is only opened the first time something
// touches `db`/`sqlite`, not at module-import time. This matters because
// Next.js imports every API route module during `next build` (to collect
// page data), and on Railway the persistent Volume (where DATABASE_FILE
// lives) is only mounted at *runtime*, not during the build step. Opening
// the file eagerly at import time crashed the build with ENOENT.
function getSqlite(): Database.Database {
  if (globalForDb.__tyagaSqlite) return globalForDb.__tyagaSqlite;

  // Always resolve via DATABASE_FILE (absolute path recommended). Falling back to
  // __dirname is unsafe once this package is bundled by Next.js/webpack, since the
  // bundle's __dirname does not match the source file's location.
  const dbFile = process.env.DATABASE_FILE || path.join(process.cwd(), "data", "tyaga.db");
  const dir = path.dirname(dbFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(dbFile, {
    // Keep it simple; fileMustExist is false so first run creates the file.
  });
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  globalForDb.__tyagaSqlite = sqlite;
  return sqlite;
}

function getDb() {
  if (!globalForDb.__tyagaDb) {
    globalForDb.__tyagaDb = drizzle(getSqlite(), { schema: schemaModule });
  }
  return globalForDb.__tyagaDb;
}

function lazyProxy<T extends object>(getTarget: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop, _receiver) {
      const real = getTarget();
      const value = Reflect.get(real as object, prop, real as object);
      return typeof value === "function" ? value.bind(real) : value;
    },
    has(_target, prop) {
      return prop in getTarget();
    },
  });
}

export const db = lazyProxy(getDb);
export const sqlite = lazyProxy(getSqlite);

export * from "./schema";
