import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { frameworkStatusEnum } from "./phase2Enums";
import { institutionsTable } from "./phase2Tenancy";
import { usersTable } from "./phase2Access";

export const frameworksTable = pgTable(
  "frameworks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").references(() => institutionsTable.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    ownerType: text("owner_type").notNull().default("system"),
    status: frameworkStatusEnum("status").notNull().default("draft"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: uuid("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("frameworks_institution_key_unique").on(table.institutionId, table.key),
    uniqueIndex("frameworks_global_key_unique").on(table.key).where(sql`${table.institutionId} is null`),
    index("frameworks_institution_idx").on(table.institutionId),
    index("frameworks_status_idx").on(table.status),
  ],
);

export const frameworkVersionsTable = pgTable(
  "framework_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    frameworkId: uuid("framework_id").notNull().references(() => frameworksTable.id, { onDelete: "cascade" }),
    versionLabel: text("version_label").notNull(),
    status: frameworkStatusEnum("status").notNull().default("draft"),
    definition: jsonb("definition").$type<Record<string, unknown>>().notNull().default({}),
    sourceUrl: text("source_url"),
    notes: text("notes"),
    validFrom: timestamp("valid_from", { withTimezone: true }),
    validTo: timestamp("valid_to", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("framework_versions_framework_label_unique").on(table.frameworkId, table.versionLabel),
    index("framework_versions_framework_idx").on(table.frameworkId),
    index("framework_versions_status_idx").on(table.status),
  ],
);

export type Framework = typeof frameworksTable.$inferSelect;
export type InsertFramework = typeof frameworksTable.$inferInsert;
export type FrameworkVersion = typeof frameworkVersionsTable.$inferSelect;
export type InsertFrameworkVersion = typeof frameworkVersionsTable.$inferInsert;
