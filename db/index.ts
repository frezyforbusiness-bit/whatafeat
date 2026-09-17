import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";
import ws from "ws";

let cached: ReturnType<typeof drizzle<typeof schema>> | null = null;
let pool: Pool | null = null;

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add a Neon connection string to .env.local for Prod 1.0 mode.",
    );
  }
  if (!cached) {
    if (typeof WebSocket === "undefined") {
      neonConfig.webSocketConstructor = ws;
    }
    pool = new Pool({ connectionString: url });
    cached = drizzle(pool, { schema });
  }
  return cached;
}

export type Database = ReturnType<typeof getDb>;
