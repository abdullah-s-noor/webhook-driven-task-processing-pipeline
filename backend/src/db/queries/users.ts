import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db } from "../client.js";
import { users } from "../schema.js";
import type { User } from "../../types/user.js";

const PASSWORD_SALT_ROUNDS = 12;

interface CreateUserInput {
  email: string;
  password: string;
}

function toUser(record: typeof users.$inferSelect): User {
  return {
    id: record.id,
    email: record.email,
    passwordHash: record.passwordHash,
    createdAt: record.createdAt,
  };
}

export async function findByEmail(email: string): Promise<User | null> {
  const record = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  return record ? toUser(record) : null;
}

export async function create(input: CreateUserInput): Promise<User> {
  const passwordHash = await bcrypt.hash(input.password, PASSWORD_SALT_ROUNDS);

  const [record] = await db
    .insert(users)
    .values({
      email: input.email,
      passwordHash,
    })
    .returning();

  return toUser(record);
}
