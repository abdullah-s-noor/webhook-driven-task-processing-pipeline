import { sql } from "drizzle-orm";
import { db } from "../../db/client.js";

async function tryAcquireLock(scope: string, key: string): Promise<boolean> {
  const result = await db.execute<{ locked: boolean }>(
    sql`SELECT pg_try_advisory_lock(hashtext(${scope}), hashtext(${key})) AS locked`
  );

  return Boolean(result.rows[0]?.locked);
}

async function releaseLock(scope: string, key: string): Promise<void> {
  await db.execute(
    sql`SELECT pg_advisory_unlock(hashtext(${scope}), hashtext(${key}))`
  );
}

export async function withAdvisoryLock(
  scope: string,
  key: string,
  work: () => Promise<void>
): Promise<boolean> {
  const acquired = await tryAcquireLock(scope, key);

  if (!acquired) {
    return false;
  }

  try {
    await work();
    return true;
  } finally {
    await releaseLock(scope, key);
  }
}
