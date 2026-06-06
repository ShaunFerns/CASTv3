import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { usersTable } from "./phase2Access";
import { descriptorSectionsTable, moduleDescriptorsTable, modulesTable } from "./phase2Curriculum";
import {
  documentSectionsTable,
  documentVersionsTable,
  documentsTable,
  evidenceItemsTable,
} from "./phase2Evidence";
import {
  importBatchesTable,
  sourceModulesTable,
  sourceProgrammesTable,
  sourceRecordsTable,
  sourceStructureItemsTable,
} from "./phase2Imports";
import { dataQualityResultsTable } from "./phase2DataQuality";
import { institutionsTable } from "./phase2Tenancy";

export const ingestionRunsTable = pgTable(
  "ingestion_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    pathway: text("pathway").notNull(),
    status: text("status").notNull().default("pending"),
    importBatchId: uuid("import_batch_id").references(() => importBatchesTable.id, { onDelete: "set null" }),
    documentId: uuid("document_id").references(() => documentsTable.id, { onDelete: "set null" }),
    requestedByUserId: uuid("requested_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    summary: jsonb("summary").$type<Record<string, unknown>>().notNull().default({}),
    errorSummary: jsonb("error_summary").$type<Record<string, unknown>>().notNull().default({}),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    check("ingestion_runs_pathway_check", sql`${table.pathway} in ('akari', 'single_pdf', 'manual_module', 'programme_wizard')`),
    check("ingestion_runs_status_check", sql`${table.status} in ('pending', 'running', 'completed', 'completed_with_issues', 'failed', 'cancelled')`),
    index("ingestion_runs_institution_idx").on(table.institutionId),
    index("ingestion_runs_status_idx").on(table.status),
    index("ingestion_runs_pathway_idx").on(table.pathway),
    index("ingestion_runs_import_batch_idx").on(table.importBatchId),
    index("ingestion_runs_document_idx").on(table.documentId),
    index("ingestion_runs_requested_by_idx").on(table.requestedByUserId),
  ],
);

export const ingestionItemsTable = pgTable(
  "ingestion_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ingestionRunId: uuid("ingestion_run_id").notNull().references(() => ingestionRunsTable.id, { onDelete: "cascade" }),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    itemType: text("item_type").notNull().default("module_descriptor"),
    status: text("status").notNull().default("pending"),
    sourceIdentifier: text("source_identifier"),
    rowNumber: text("row_number"),
    inputPayload: jsonb("input_payload").$type<Record<string, unknown>>().notNull().default({}),
    normalizedPayload: jsonb("normalized_payload").$type<Record<string, unknown>>().notNull().default({}),
    summary: jsonb("summary").$type<Record<string, unknown>>().notNull().default({}),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    check("ingestion_items_status_check", sql`${table.status} in ('pending', 'running', 'completed', 'completed_with_issues', 'failed', 'skipped')`),
    index("ingestion_items_run_idx").on(table.ingestionRunId),
    index("ingestion_items_institution_idx").on(table.institutionId),
    index("ingestion_items_type_status_idx").on(table.itemType, table.status),
    index("ingestion_items_source_identifier_idx").on(table.sourceIdentifier),
  ],
);

export const ingestionErrorsTable = pgTable(
  "ingestion_errors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ingestionRunId: uuid("ingestion_run_id").notNull().references(() => ingestionRunsTable.id, { onDelete: "cascade" }),
    ingestionItemId: uuid("ingestion_item_id").references(() => ingestionItemsTable.id, { onDelete: "cascade" }),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    severity: text("severity").notNull().default("warning"),
    code: text("code").notNull(),
    message: text("message").notNull(),
    fieldPath: text("field_path"),
    sourceLocation: jsonb("source_location").$type<Record<string, unknown>>().notNull().default({}),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("ingestion_errors_severity_check", sql`${table.severity} in ('info', 'warning', 'error', 'critical')`),
    index("ingestion_errors_run_idx").on(table.ingestionRunId),
    index("ingestion_errors_item_idx").on(table.ingestionItemId),
    index("ingestion_errors_institution_idx").on(table.institutionId),
    index("ingestion_errors_code_idx").on(table.code),
    index("ingestion_errors_severity_idx").on(table.severity),
  ],
);

export const ingestionRecordLinksTable = pgTable(
  "ingestion_record_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ingestionRunId: uuid("ingestion_run_id").notNull().references(() => ingestionRunsTable.id, { onDelete: "cascade" }),
    ingestionItemId: uuid("ingestion_item_id").references(() => ingestionItemsTable.id, { onDelete: "cascade" }),
    relationship: text("relationship").notNull().default("created"),
    importBatchId: uuid("import_batch_id").references(() => importBatchesTable.id, { onDelete: "restrict" }),
    sourceRecordId: uuid("source_record_id").references(() => sourceRecordsTable.id, { onDelete: "restrict" }),
    sourceProgrammeId: uuid("source_programme_id").references(() => sourceProgrammesTable.id, { onDelete: "restrict" }),
    sourceModuleId: uuid("source_module_id").references(() => sourceModulesTable.id, { onDelete: "restrict" }),
    sourceStructureItemId: uuid("source_structure_item_id").references(() => sourceStructureItemsTable.id, { onDelete: "restrict" }),
    documentId: uuid("document_id").references(() => documentsTable.id, { onDelete: "restrict" }),
    documentVersionId: uuid("document_version_id").references(() => documentVersionsTable.id, { onDelete: "restrict" }),
    documentSectionId: uuid("document_section_id").references(() => documentSectionsTable.id, { onDelete: "restrict" }),
    moduleId: uuid("module_id").references(() => modulesTable.id, { onDelete: "restrict" }),
    moduleDescriptorId: uuid("module_descriptor_id").references(() => moduleDescriptorsTable.id, { onDelete: "restrict" }),
    descriptorSectionId: uuid("descriptor_section_id").references(() => descriptorSectionsTable.id, { onDelete: "restrict" }),
    evidenceItemId: uuid("evidence_item_id").references(() => evidenceItemsTable.id, { onDelete: "restrict" }),
    dataQualityResultId: uuid("data_quality_result_id").references(() => dataQualityResultsTable.id, { onDelete: "restrict" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "ingestion_record_links_single_target_check",
      sql`num_nonnulls(
        ${table.importBatchId},
        ${table.sourceRecordId},
        ${table.sourceProgrammeId},
        ${table.sourceModuleId},
        ${table.sourceStructureItemId},
        ${table.documentId},
        ${table.documentVersionId},
        ${table.documentSectionId},
        ${table.moduleId},
        ${table.moduleDescriptorId},
        ${table.descriptorSectionId},
        ${table.evidenceItemId},
        ${table.dataQualityResultId}
      ) = 1`,
    ),
    index("ingestion_record_links_run_idx").on(table.ingestionRunId),
    index("ingestion_record_links_item_idx").on(table.ingestionItemId),
    index("ingestion_record_links_relationship_idx").on(table.relationship),
    index("ingestion_record_links_module_idx").on(table.moduleId),
    index("ingestion_record_links_descriptor_idx").on(table.moduleDescriptorId),
    index("ingestion_record_links_evidence_idx").on(table.evidenceItemId),
  ],
);

export type IngestionRun = typeof ingestionRunsTable.$inferSelect;
export type InsertIngestionRun = typeof ingestionRunsTable.$inferInsert;
export type IngestionItem = typeof ingestionItemsTable.$inferSelect;
export type InsertIngestionItem = typeof ingestionItemsTable.$inferInsert;
export type IngestionError = typeof ingestionErrorsTable.$inferSelect;
export type InsertIngestionError = typeof ingestionErrorsTable.$inferInsert;
export type IngestionRecordLink = typeof ingestionRecordLinksTable.$inferSelect;
export type InsertIngestionRecordLink = typeof ingestionRecordLinksTable.$inferInsert;
