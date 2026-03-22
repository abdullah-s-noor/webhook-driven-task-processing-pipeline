import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { JsonValue } from "../types/pipeline.js";

export const jobStatusEnum = pgEnum("job_status", [
  "pending",
  "processing",
  "processed",
  "failed",
]);

export const deliveryStatusEnum = pgEnum("delivery_status", [
  "pending",
  "success",
  "failed",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const pipelines = pgTable(
  "pipelines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    username: varchar("username", { length: 255 }).notNull(),
    sourceUrl: text("source_url").notNull(),
    signingSecret: text("signing_secret").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    usernameUnique: unique("pipelines_username_unique").on(table.username),
    sourceUrlUnique: unique("pipelines_source_url_unique").on(table.sourceUrl),
  })
);

export const pipelineSteps = pgTable(
  "pipeline_steps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pipelineId: uuid("pipeline_id")
      .notNull()
      .references(() => pipelines.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 100 }).notNull(),
    config: jsonb("config").$type<JsonValue>().notNull(),
    order: integer("order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    pipelineOrderUnique: unique("pipeline_steps_pipeline_id_order_unique").on(
      table.pipelineId,
      table.order
    ),
  })
);

export const subscribers = pgTable("subscribers", {
  id: uuid("id").defaultRandom().primaryKey(),
  pipelineId: uuid("pipeline_id")
    .notNull()
    .references(() => pipelines.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pipelineId: uuid("pipeline_id")
      .notNull()
      .references(() => pipelines.id, { onDelete: "cascade" }),
    payload: jsonb("payload").$type<JsonValue>().notNull(),
    stepsSnapshot: jsonb("steps_snapshot").$type<JsonValue>().notNull(),
    processedPayload: jsonb("processed_payload").$type<JsonValue>(),
    status: jobStatusEnum("status").default("pending").notNull(),
    filterReason: text("filter_reason"),
    attemptCount: integer("attempt_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => ({
    statusIndex: index("jobs_status_idx").on(table.status),
  })
);

export const deliveries = pgTable("deliveries", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  subscriberId: uuid("subscriber_id")
    .notNull()
    .references(() => subscribers.id, { onDelete: "cascade" }),
  status: deliveryStatusEnum("status").default("pending").notNull(),
  attemptCount: integer("attempt_count").default(0).notNull(),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
});

export const deliveryAttempts = pgTable("delivery_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  deliveryId: uuid("delivery_id")
    .notNull()
    .references(() => deliveries.id, { onDelete: "cascade" }),
  attemptNumber: integer("attempt_number").notNull(),
  statusCode: integer("status_code"),
  error: text("error"),
  attemptedAt: timestamp("attempted_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
