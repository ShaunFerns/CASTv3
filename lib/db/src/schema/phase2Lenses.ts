import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import {
  lensConfigurationScopeEnum,
  lensRuleTypeEnum,
  lensStatusEnum,
} from "./phase2Enums";
import { frameworkVersionsTable, frameworksTable } from "./phase2Frameworks";
import { institutionsTable } from "./phase2Tenancy";
import { usersTable } from "./phase2Access";

export const lensesTable = pgTable(
  "lenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").references(() => institutionsTable.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    status: lensStatusEnum("status").notNull().default("draft"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: uuid("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("lenses_institution_key_unique").on(table.institutionId, table.key),
    uniqueIndex("lenses_global_key_unique").on(table.key).where(sql`${table.institutionId} is null`),
    index("lenses_institution_idx").on(table.institutionId),
    index("lenses_status_idx").on(table.status),
  ],
);

export const lensVersionsTable = pgTable(
  "lens_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lensId: uuid("lens_id").notNull().references(() => lensesTable.id, { onDelete: "cascade" }),
    versionLabel: text("version_label").notNull(),
    status: lensStatusEnum("status").notNull().default("draft"),
    analysisContract: jsonb("analysis_contract").$type<Record<string, unknown>>().notNull().default({}),
    outputContract: jsonb("output_contract").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: uuid("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("lens_versions_lens_label_unique").on(table.lensId, table.versionLabel),
    index("lens_versions_lens_idx").on(table.lensId),
    index("lens_versions_status_idx").on(table.status),
  ],
);

export const lensGroupsTable = pgTable(
  "lens_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").references(() => institutionsTable.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("lens_groups_institution_key_unique").on(table.institutionId, table.key),
    uniqueIndex("lens_groups_global_key_unique").on(table.key).where(sql`${table.institutionId} is null`),
    index("lens_groups_institution_idx").on(table.institutionId),
  ],
);

export const lensGroupMembersTable = pgTable(
  "lens_group_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lensGroupId: uuid("lens_group_id").notNull().references(() => lensGroupsTable.id, { onDelete: "cascade" }),
    lensId: uuid("lens_id").notNull().references(() => lensesTable.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("lens_group_members_group_lens_unique").on(table.lensGroupId, table.lensId),
    index("lens_group_members_lens_idx").on(table.lensId),
  ],
);

export const lensConfigurationsTable = pgTable(
  "lens_configurations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lensVersionId: uuid("lens_version_id").notNull().references(() => lensVersionsTable.id, { onDelete: "cascade" }),
    institutionId: uuid("institution_id").references(() => institutionsTable.id, { onDelete: "cascade" }),
    scope: lensConfigurationScopeEnum("scope").notNull().default("global"),
    targetType: text("target_type"),
    targetId: text("target_id"),
    configuration: jsonb("configuration").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: uuid("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("lens_configurations_lens_version_idx").on(table.lensVersionId),
    index("lens_configurations_institution_idx").on(table.institutionId),
    index("lens_configurations_scope_idx").on(table.scope),
  ],
);

export const lensFrameworkBindingsTable = pgTable(
  "lens_framework_bindings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lensVersionId: uuid("lens_version_id").notNull().references(() => lensVersionsTable.id, { onDelete: "cascade" }),
    frameworkId: uuid("framework_id").notNull().references(() => frameworksTable.id, { onDelete: "cascade" }),
    frameworkVersionId: uuid("framework_version_id").references(() => frameworkVersionsTable.id, { onDelete: "set null" }),
    bindingRole: text("binding_role").notNull().default("primary"),
    configuration: jsonb("configuration").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("lens_framework_bindings_unique").on(table.lensVersionId, table.frameworkId, table.frameworkVersionId),
    index("lens_framework_bindings_framework_idx").on(table.frameworkId),
  ],
);

export const lensOutputSchemasTable = pgTable(
  "lens_output_schemas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lensVersionId: uuid("lens_version_id").notNull().references(() => lensVersionsTable.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    schema: jsonb("schema").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("lens_output_schemas_lens_key_unique").on(table.lensVersionId, table.key),
  ],
);

export const lensEvidenceRulesTable = pgTable(
  "lens_evidence_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lensVersionId: uuid("lens_version_id").notNull().references(() => lensVersionsTable.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    ruleType: lensRuleTypeEnum("rule_type").notNull(),
    rule: jsonb("rule").$type<Record<string, unknown>>().notNull().default({}),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("lens_evidence_rules_lens_key_unique").on(table.lensVersionId, table.key),
    index("lens_evidence_rules_rule_type_idx").on(table.ruleType),
  ],
);

export type Lens = typeof lensesTable.$inferSelect;
export type InsertLens = typeof lensesTable.$inferInsert;
export type LensVersion = typeof lensVersionsTable.$inferSelect;
export type InsertLensVersion = typeof lensVersionsTable.$inferInsert;
export type LensGroup = typeof lensGroupsTable.$inferSelect;
export type InsertLensGroup = typeof lensGroupsTable.$inferInsert;
export type LensConfiguration = typeof lensConfigurationsTable.$inferSelect;
export type InsertLensConfiguration = typeof lensConfigurationsTable.$inferInsert;
export type LensFrameworkBinding = typeof lensFrameworkBindingsTable.$inferSelect;
export type InsertLensFrameworkBinding = typeof lensFrameworkBindingsTable.$inferInsert;
export type LensOutputSchema = typeof lensOutputSchemasTable.$inferSelect;
export type InsertLensOutputSchema = typeof lensOutputSchemasTable.$inferInsert;
export type LensEvidenceRule = typeof lensEvidenceRulesTable.$inferSelect;
export type InsertLensEvidenceRule = typeof lensEvidenceRulesTable.$inferInsert;
