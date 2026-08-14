import "dotenv/config";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import * as schemaModule from "./schema";

// Reuse a single connection across hot reloads (Next.js dev) and across the bot process.
const globalForDb = globalThis as unknown as { __tyagaSqlite?: Database.Database };

// Always resolve via DATABASE_FILE (absolute path recommended). Falling back to
// __dirname is unsafe once this package is bundled by Next.js/webpack, since the
// bundle's __dirname does not match the source file's location.
const dbFile = process.env.DATABASE_FILE || path.join(process.cwd(), "data", "tyaga.db");

const sqlite =
  globalForDb.__tyagaSqlite ??
  new Database(dbFile, {
    // Keep it simple; fileMustExist is false so first run creates the file.
  });
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

if (process.env.NODE_ENV !== "production") {
  globalForDb.__tyagaSqlite = sqlite;
}

export const db = drizzle(sqlite, { schema: schemaModule });
export * from "./schema";
export { sqlite };
