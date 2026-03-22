import { Pool } from "pg";
import { config } from "../config.js";

export const db = new Pool({
  connectionString: config.databaseUrl,
});

export async function testDbConnection() {
  const client = await db.connect();

  try {
    const result = await client.query("SELECT NOW()");
    console.log("Database connected:", result.rows[0]);
  } finally {
    client.release();
  }
}
