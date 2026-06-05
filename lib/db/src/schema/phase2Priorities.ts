import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import {
  priorityExpectationLevelEnum,
  priorityMappingTargetTypeEnum,
  priorityStatusEnum,
} from "./phase2Enums";
import { institutionMembershipsTable, usersTable } from "./phase2Access";
import { institutionsTable } from "./phase2Tenancy";

export const institutionPrioritiesTable = pgTable(
  "institution_priorities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    status: priorityStatusEnum("status").notNull().default("draft"),
    ownerMembershipId: uuid("owner_membership_id").references(() => institutionMembershipsTable.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: uuid("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("institution_priorities_institution_key_unique").on(table.institutionId, table.key),
    index("institution_priorities_institution_idx").on(table.institutionId),
    index("institution_priorities_status_idx").on(table.status),
  ],
);

export const institutionPriorityVersionsTable = pgTable(
  "institution_priority_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionPriorityId: uuid("institution_priority_id").notNull().references(() => institutionPrioritiesTable.id, { onDelete: "cascade" }),
    versionLabel: text("version_label").notNull(),
    status: priorityStatusEnum("status").notNull().default("draft"),
    definition: jsonb("definition").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: uuid("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("institution_priority_versions_priority_label_unique").on(table.institutionPriorityId, table.versionLabel),
    index("institution_priority_versions_priority_idx").on(table.institutionPriorityId),
    index("institution_priority_versions_status_idx").on(table.status),
  ],
);

export const priorityMappingsTable = pgTable(
  "priority_mappings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionPriorityVersionId: uuid("institution_priority_version_id").notNull().references(() => institutionPriorityVersionsTable.id, { onDelete: "cascade" }),
    targetType: priorityMappingTargetTypeEnum("target_type").notNull(),
    targetId: text("target_id").notNull(),
    mapping: jsonb("mapping").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: uuid("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("priority_mappings_unique").on(table.institutionPriorityVersionId, table.targetType, table.targetId),
    index("priority_mappings_target_idx").on(table.targetType, table.targetId),
  ],
);

export const priorityExpectationsTable = pgTable(
  "priority_expectations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionPriorityVersionId: uuid("institution_priority_version_id").notNull().references(() => institutionPriorityVersionsTable.id, { onDelete: "cascade" }),
    targetType: priorityMappingTargetTypeEnum("target_type").notNull(),
    targetId: text("target_id").notNull(),
    expectedLevel: priorityExpectationLevelEnum("expected_level").notNull().default("not_applicable"),
    rationale: text("rationale"),
    createdByUserId: uuid("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("priority_expectations_unique").on(table.institutionPriorityVersionId, table.targetType, table.targetId),
    index("priority_expectations_level_idx").on(table.expectedLevel),
  ],
);

export type InstitutionPriority = typeof institutionPrioritiesTable.$inferSelect;
export type InsertInstitutionPriority = typeof institutionPrioritiesTable.$inferInsert;
export type InstitutionPriorityVersion = typeof institutionPriorityVersionsTable.$inferSelect;
export type InsertInstitutionPriorityVersion = typeof institutionPriorityVersionsTable.$inferInsert;
export type PriorityMapping = typeof priorityMappingsTable.$inferSelect;
export type InsertPriorityMapping = typeof priorityMappingsTable.$inferInsert;
export type PriorityExpectation = typeof priorityExpectationsTable.$inferSelect;
export type InsertPriorityExpectation = typeof priorityExpectationsTable.$inferInsert;
