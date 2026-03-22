import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { config } from "../config.js";
import * as schema from "./schema.js";

const pool = new Pool({
  connectionString: config.databaseUrl,
});

export const db = drizzle(pool, { schema });

export async function testDbConnection() {
  const client = await pool.connect();

  try {
    const result = await client.query("SELECT NOW()");
    console.log("Database connected:", result.rows[0]);
  } finally {
    client.release();
  }
}
