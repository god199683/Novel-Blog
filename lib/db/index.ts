import { drizzle, LibSQLDatabase } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

type DB = LibSQLDatabase<typeof schema>;

let _db: DB | null = null;

function getDb(): DB {
  if (_db) return _db;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) throw new Error("TURSO_DATABASE_URL is not set");
  const client = createClient({ url, authToken });
  _db = drizzle(client, { schema });
  return _db;
}

export const db = new Proxy({} as DB, {
  get(_target, prop) {
    const instance = getDb() as unknown as Record<string | symbol, unknown>;
    const value = instance[prop];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
