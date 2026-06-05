import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, real, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { usersTable } from "./phase2Access";
import {
  importBatchStatusEnum,
  importBatchTypeEnum,
  reconciliationSourceTypeEnum,
  reconciliationStatusEnum,
  reconciliationTargetTypeEnum,
  sourceRecordStatusEnum,
  sourceRecordTypeEnum,
  sourceStructureItemTypeEnum,
  sourceSystemStatusEnum,
  sourceSystemTypeEnum,
} from "./phase2Enums";
import { institutionsTable } from "./phase2Tenancy";

export const sourceSystemsTable = pgTable(
  "source_systems",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    systemType: sourceSystemTypeEnum("system_type").notNull().default("other"),
    status: sourceSystemStatusEnum("status").notNull().default("active"),
    connectionConfig: jsonb("connection_config").$type<Record<string, unknown>>().notNull().default({}),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: uuid("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("source_systems_institution_key_unique").on(table.institutionId, table.key),
    index("source_systems_institution_idx").on(table.institutionId),
    index("source_systems_type_idx").on(table.systemType),
    index("source_systems_status_idx").on(table.status),
  ],
);

export const importBatchesTable = pgTable(
  "import_batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    sourceSystemId: uuid("source_system_id").notNull().references(() => sourceSystemsTable.id, { onDelete: "cascade" }),
    batchType: importBatchTypeEnum("batch_type").notNull().default("mixed"),
    status: importBatchStatusEnum("status").notNull().default("pending"),
    externalBatchId: text("external_batch_id"),
    sourceStartedAt: timestamp("source_started_at", { withTimezone: true }),
    sourceCompletedAt: timestamp("source_completed_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    summary: jsonb("summary").$type<Record<string, unknown>>().notNull().default({}),
    errorSummary: jsonb("error_summary").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: uuid("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("import_batches_source_external_unique").on(table.sourceSystemId, table.externalBatchId).where(sql`${table.externalBatchId} is not null`),
    index("import_batches_institution_idx").on(table.institutionId),
    index("import_batches_source_system_idx").on(table.sourceSystemId),
    index("import_batches_status_idx").on(table.status),
    index("import_batches_type_idx").on(table.batchType),
  ],
);

export const sourceRecordsTable = pgTable(
  "source_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    importBatchId: uuid("import_batch_id").notNull().references(() => importBatchesTable.id, { onDelete: "cascade" }),
    sourceSystemId: uuid("source_system_id").notNull().references(() => sourceSystemsTable.id, { onDelete: "cascade" }),
    recordType: sourceRecordTypeEnum("record_type").notNull(),
    status: sourceRecordStatusEnum("status").notNull().default("raw"),
    sourceIdentifier: text("source_identifier"),
    sourceHash: text("source_hash"),
    rowNumber: integer("row_number"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    rawText: text("raw_text"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("source_records_batch_identifier_unique")
      .on(table.importBatchId, table.recordType, table.sourceIdentifier)
      .where(sql`${table.sourceIdentifier} is not null`),
    index("source_records_institution_idx").on(table.institutionId),
    index("source_records_batch_idx").on(table.importBatchId),
    index("source_records_system_idx").on(table.sourceSystemId),
    index("source_records_type_status_idx").on(table.recordType, table.status),
    index("source_records_hash_idx").on(table.sourceHash),
  ],
);

export const sourceProgrammesTable = pgTable(
  "source_programmes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    importBatchId: uuid("import_batch_id").notNull().references(() => importBatchesTable.id, { onDelete: "cascade" }),
    sourceSystemId: uuid("source_system_id").notNull().references(() => sourceSystemsTable.id, { onDelete: "cascade" }),
    sourceRecordId: uuid("source_record_id").references(() => sourceRecordsTable.id, { onDelete: "set null" }),
    externalId: text("external_id"),
    code: text("code"),
    name: text("name"),
    award: text("award"),
    level: text("level"),
    school: text("school"),
    department: text("department"),
    owningUnit: text("owning_unit"),
    campus: text("campus"),
    modeOfDelivery: text("mode_of_delivery"),
    rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>().notNull().default({}),
    normalizedPayload: jsonb("normalized_payload").$type<Record<string, unknown>>().notNull().default({}),
    legacyProgrammeId: integer("legacy_programme_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("source_programmes_system_external_unique").on(table.sourceSystemId, table.externalId).where(sql`${table.externalId} is not null`),
    index("source_programmes_institution_idx").on(table.institutionId),
    index("source_programmes_batch_idx").on(table.importBatchId),
    index("source_programmes_code_idx").on(table.code),
    index("source_programmes_legacy_idx").on(table.legacyProgrammeId),
  ],
);

export const sourceModulesTable = pgTable(
  "source_modules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    importBatchId: uuid("import_batch_id").notNull().references(() => importBatchesTable.id, { onDelete: "cascade" }),
    sourceSystemId: uuid("source_system_id").notNull().references(() => sourceSystemsTable.id, { onDelete: "cascade" }),
    sourceRecordId: uuid("source_record_id").references(() => sourceRecordsTable.id, { onDelete: "set null" }),
    externalId: text("external_id"),
    moduleCode: text("module_code"),
    moduleTitle: text("module_title"),
    credits: text("credits"),
    level: text("level"),
    stage: text("stage"),
    semester: text("semester"),
    school: text("school"),
    department: text("department"),
    campus: text("campus"),
    moduleStatus: text("module_status"),
    descriptorText: text("descriptor_text"),
    rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>().notNull().default({}),
    normalizedPayload: jsonb("normalized_payload").$type<Record<string, unknown>>().notNull().default({}),
    legacyModuleReviewId: integer("legacy_module_review_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("source_modules_system_external_unique").on(table.sourceSystemId, table.externalId).where(sql`${table.externalId} is not null`),
    index("source_modules_institution_idx").on(table.institutionId),
    index("source_modules_batch_idx").on(table.importBatchId),
    index("source_modules_code_idx").on(table.moduleCode),
    index("source_modules_legacy_idx").on(table.legacyModuleReviewId),
  ],
);

export const sourceStructureItemsTable = pgTable(
  "source_structure_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    importBatchId: uuid("import_batch_id").notNull().references(() => importBatchesTable.id, { onDelete: "cascade" }),
    sourceSystemId: uuid("source_system_id").notNull().references(() => sourceSystemsTable.id, { onDelete: "cascade" }),
    sourceRecordId: uuid("source_record_id").references(() => sourceRecordsTable.id, { onDelete: "set null" }),
    sourceProgrammeId: uuid("source_programme_id").references(() => sourceProgrammesTable.id, { onDelete: "set null" }),
    sourceModuleId: uuid("source_module_id").references(() => sourceModulesTable.id, { onDelete: "set null" }),
    itemType: sourceStructureItemTypeEnum("item_type").notNull().default("module"),
    externalId: text("external_id"),
    parentExternalId: text("parent_external_id"),
    stage: text("stage"),
    semester: text("semester"),
    pathway: text("pathway"),
    groupName: text("group_name"),
    coreOption: text("core_option"),
    credits: text("credits"),
    orderIndex: integer("order_index").notNull().default(0),
    rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>().notNull().default({}),
    normalizedPayload: jsonb("normalized_payload").$type<Record<string, unknown>>().notNull().default({}),
    legacyProgrammeModuleId: integer("legacy_programme_module_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("source_structure_items_system_external_unique").on(table.sourceSystemId, table.externalId).where(sql`${table.externalId} is not null`),
    index("source_structure_items_institution_idx").on(table.institutionId),
    index("source_structure_items_batch_idx").on(table.importBatchId),
    index("source_structure_items_programme_idx").on(table.sourceProgrammeId),
    index("source_structure_items_module_idx").on(table.sourceModuleId),
    index("source_structure_items_legacy_idx").on(table.legacyProgrammeModuleId),
  ],
);

export const reconciliationLinksTable = pgTable(
  "reconciliation_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    sourceType: reconciliationSourceTypeEnum("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    targetType: reconciliationTargetTypeEnum("target_type").notNull(),
    targetId: text("target_id").notNull(),
    status: reconciliationStatusEnum("status").notNull().default("candidate"),
    confidence: real("confidence"),
    rationale: text("rationale"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: uuid("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("reconciliation_links_source_target_unique").on(table.institutionId, table.sourceType, table.sourceId, table.targetType, table.targetId),
    index("reconciliation_links_source_idx").on(table.sourceType, table.sourceId),
    index("reconciliation_links_target_idx").on(table.targetType, table.targetId),
    index("reconciliation_links_status_idx").on(table.status),
  ],
);

export type SourceSystem = typeof sourceSystemsTable.$inferSelect;
export type InsertSourceSystem = typeof sourceSystemsTable.$inferInsert;
export type ImportBatch = typeof importBatchesTable.$inferSelect;
export type InsertImportBatch = typeof importBatchesTable.$inferInsert;
export type SourceRecord = typeof sourceRecordsTable.$inferSelect;
export type InsertSourceRecord = typeof sourceRecordsTable.$inferInsert;
export type SourceProgramme = typeof sourceProgrammesTable.$inferSelect;
export type InsertSourceProgramme = typeof sourceProgrammesTable.$inferInsert;
export type SourceModule = typeof sourceModulesTable.$inferSelect;
export type InsertSourceModule = typeof sourceModulesTable.$inferInsert;
export type SourceStructureItem = typeof sourceStructureItemsTable.$inferSelect;
export type InsertSourceStructureItem = typeof sourceStructureItemsTable.$inferInsert;
export type ReconciliationLink = typeof reconciliationLinksTable.$inferSelect;
export type InsertReconciliationLink = typeof reconciliationLinksTable.$inferInsert;
