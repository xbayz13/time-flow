import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  text,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const activityCategory = ["deep_work", "admin", "health", "social"] as const;
export const activityStatus = ["PLANNED", "PENDING_CONFIRMATION", "COMPLETED"] as const;

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }),
  bufferMinutes: integer("buffer_minutes").notNull().default(15),
  timezone: varchar("timezone", { length: 63 }).notNull().default("Asia/Jakarta"),
  sleepStart: varchar("sleep_start", { length: 5 }).notNull().default("22:00"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const activities = pgTable("activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  isFixed: boolean("is_fixed").notNull().default(false),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  priority: integer("priority").notNull().default(3),
  category: varchar("category", { length: 20 }).$type<
    (typeof activityCategory)[number]
  >().notNull().default("admin"),
  status: varchar("status", { length: 30 }).$type<
    (typeof activityStatus)[number]
  >().notNull().default("PLANNED"),
  aiReasoning: text("ai_reasoning"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  activities: many(activities),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  user: one(users),
}));

/** Audit trail: log perubahan aktivitas (AI vs User) untuk fitur undo */
export const auditSource = ["AI", "USER"] as const;

export const activityAuditLogs = pgTable("activity_audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  activityId: uuid("activity_id"), // nullable: untuk DELETE activity sudah terhapus
  action: varchar("action", { length: 10 }).notNull(), // CREATE, UPDATE, DELETE
  source: varchar("source", { length: 10 }).$type<(typeof auditSource)[number]>().notNull(), // AI | USER
  payloadBefore: text("payload_before"), // JSON snapshot before change
  payloadAfter: text("payload_after"), // JSON snapshot after change
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const activityAuditLogsRelations = relations(activityAuditLogs, ({ one }) => ({
  user: one(users),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
