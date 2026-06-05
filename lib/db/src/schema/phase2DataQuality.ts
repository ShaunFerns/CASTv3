import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { institutionMembershipsTable, usersTable } from "./phase2Access";
import { analysisRunsTable } from "./phase2Analysis";
import {
  curatedStructureGroupsTable,
  curatedStructureItemsTable,
  curatedStructuresTable,
  moduleDescriptorsTable,
  modulesTable,
  programmeVersionsTable,
} from "./phase2Curriculum";
import {
  dataQualityCategoryEnum,
  dataQualityResultStatusEnum,
  dataQualityRuleStatusEnum,
  dataQualityRunStatusEnum,
  dataQualityRunTriggerEnum,
  dataQualitySeverityEnum,
  localWorkerStatusEnum,
  workerArtifactLocationEnum,
  workerArtifactTypeEnum,
  workerConnectionModeEnum,
  workerDataHandlingModeEnum,
  workerJobStatusEnum,
  workerJobTypeEnum,
  workerSyncDirectionEnum,
  workerSyncEventStatusEnum,
  workerSyncEventTypeEnum,
} from "./phase2Enums";
import {
  competenciesTable,
  documentVersionsTable,
  evidenceItemsTable,
} from "./phase2Evidence";
import {
  importBatchesTable,
  sourceModulesTable,
  sourceProgrammesTable,
  sourceRecordsTable,
  sourceStructureItemsTable,
  sourceSystemsTable,
} from "./phase2Imports";
import { reviewCyclesTable } from "./phase2Review";
import { institutionsTable } from "./phase2Tenancy";

export const dataQualityRulesTable = pgTable(
  "data_quality_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").references(
      () => institutionsTable.id,
      {
        onDelete: "cascade",
      },
    ),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    category: dataQualityCategoryEnum("category").notNull(),
    defaultSeverity: dataQualitySeverityEnum("default_severity")
      .notNull()
      .default("warning"),
    status: dataQualityRuleStatusEnum("status").notNull().default("draft"),
    implementationKey: text("implementation_key").notNull(),
    ruleDefinition: jsonb("rule_definition")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    remediationGuidance: text("remediation_guidance"),
    isSystemManaged: boolean("is_system_managed").notNull().default(false),
    createdByUserId: uuid("created_by_user_id").references(
      () => usersTable.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("data_quality_rules_institution_key_unique").on(
      table.institutionId,
      table.key,
    ),
    uniqueIndex("data_quality_rules_global_key_unique")
      .on(table.key)
      .where(sql`${table.institutionId} is null`),
    index("data_quality_rules_institution_idx").on(table.institutionId),
    index("data_quality_rules_category_status_idx").on(
      table.category,
      table.status,
    ),
    index("data_quality_rules_implementation_idx").on(table.implementationKey),
  ],
);

export const dataQualityRunsTable = pgTable(
  "data_quality_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutionsTable.id, { onDelete: "cascade" }),
    sourceSystemId: uuid("source_system_id").references(
      () => sourceSystemsTable.id,
      { onDelete: "set null" },
    ),
    importBatchId: uuid("import_batch_id").references(
      () => importBatchesTable.id,
      { onDelete: "set null" },
    ),
    programmeVersionId: uuid("programme_version_id").references(
      () => programmeVersionsTable.id,
      { onDelete: "set null" },
    ),
    curatedStructureId: uuid("curated_structure_id").references(
      () => curatedStructuresTable.id,
      { onDelete: "set null" },
    ),
    reviewCycleId: uuid("review_cycle_id").references(
      () => reviewCyclesTable.id,
      { onDelete: "set null" },
    ),
    status: dataQualityRunStatusEnum("status").notNull().default("pending"),
    trigger: dataQualityRunTriggerEnum("trigger").notNull().default("manual"),
    scope: jsonb("scope")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    configuration: jsonb("configuration")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    summary: jsonb("summary")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    errorSummary: jsonb("error_summary")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    requestedByUserId: uuid("requested_by_user_id").references(
      () => usersTable.id,
      { onDelete: "set null" },
    ),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("data_quality_runs_institution_idx").on(table.institutionId),
    index("data_quality_runs_source_system_idx").on(table.sourceSystemId),
    index("data_quality_runs_import_batch_idx").on(table.importBatchId),
    index("data_quality_runs_programme_idx").on(table.programmeVersionId),
    index("data_quality_runs_structure_idx").on(table.curatedStructureId),
    index("data_quality_runs_review_cycle_idx").on(table.reviewCycleId),
    index("data_quality_runs_status_trigger_idx").on(
      table.status,
      table.trigger,
    ),
  ],
);

export const dataQualityResultsTable = pgTable(
  "data_quality_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutionsTable.id, { onDelete: "cascade" }),
    dataQualityRunId: uuid("data_quality_run_id")
      .notNull()
      .references(() => dataQualityRunsTable.id, { onDelete: "cascade" }),
    dataQualityRuleId: uuid("data_quality_rule_id")
      .notNull()
      .references(() => dataQualityRulesTable.id, { onDelete: "restrict" }),
    severity: dataQualitySeverityEnum("severity").notNull(),
    status: dataQualityResultStatusEnum("status").notNull().default("open"),
    fingerprint: text("fingerprint"),
    title: text("title").notNull(),
    message: text("message"),
    details: jsonb("details")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    observedValue: jsonb("observed_value")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    expectedValue: jsonb("expected_value")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    resolutionNotes: text("resolution_notes"),
    reviewedByMembershipId: uuid("reviewed_by_membership_id").references(
      () => institutionMembershipsTable.id,
      { onDelete: "set null" },
    ),
    firstDetectedAt: timestamp("first_detected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastDetectedAt: timestamp("last_detected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("data_quality_results_run_rule_fingerprint_unique")
      .on(table.dataQualityRunId, table.dataQualityRuleId, table.fingerprint)
      .where(sql`${table.fingerprint} is not null`),
    index("data_quality_results_institution_idx").on(table.institutionId),
    index("data_quality_results_run_idx").on(table.dataQualityRunId),
    index("data_quality_results_rule_idx").on(table.dataQualityRuleId),
    index("data_quality_results_severity_status_idx").on(
      table.severity,
      table.status,
    ),
    index("data_quality_results_reviewer_idx").on(table.reviewedByMembershipId),
  ],
);

export const dataQualityResultLinksTable = pgTable(
  "data_quality_result_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dataQualityResultId: uuid("data_quality_result_id")
      .notNull()
      .references(() => dataQualityResultsTable.id, { onDelete: "cascade" }),
    sourceSystemId: uuid("source_system_id").references(
      () => sourceSystemsTable.id,
      { onDelete: "restrict" },
    ),
    importBatchId: uuid("import_batch_id").references(
      () => importBatchesTable.id,
      { onDelete: "restrict" },
    ),
    sourceRecordId: uuid("source_record_id").references(
      () => sourceRecordsTable.id,
      { onDelete: "restrict" },
    ),
    sourceProgrammeId: uuid("source_programme_id").references(
      () => sourceProgrammesTable.id,
      { onDelete: "restrict" },
    ),
    sourceModuleId: uuid("source_module_id").references(
      () => sourceModulesTable.id,
      { onDelete: "restrict" },
    ),
    sourceStructureItemId: uuid("source_structure_item_id").references(
      () => sourceStructureItemsTable.id,
      { onDelete: "restrict" },
    ),
    programmeVersionId: uuid("programme_version_id").references(
      () => programmeVersionsTable.id,
      { onDelete: "restrict" },
    ),
    curatedStructureId: uuid("curated_structure_id").references(
      () => curatedStructuresTable.id,
      { onDelete: "restrict" },
    ),
    curatedStructureGroupId: uuid("curated_structure_group_id").references(
      () => curatedStructureGroupsTable.id,
      { onDelete: "restrict" },
    ),
    curatedStructureItemId: uuid("curated_structure_item_id").references(
      () => curatedStructureItemsTable.id,
      { onDelete: "restrict" },
    ),
    moduleId: uuid("module_id").references(() => modulesTable.id, {
      onDelete: "restrict",
    }),
    moduleDescriptorId: uuid("module_descriptor_id").references(
      () => moduleDescriptorsTable.id,
      { onDelete: "restrict" },
    ),
    evidenceItemId: uuid("evidence_item_id").references(
      () => evidenceItemsTable.id,
      { onDelete: "restrict" },
    ),
    reviewCycleId: uuid("review_cycle_id").references(
      () => reviewCyclesTable.id,
      { onDelete: "restrict" },
    ),
    competencyId: uuid("competency_id").references(() => competenciesTable.id, {
      onDelete: "restrict",
    }),
    relationship: text("relationship").notNull().default("affected_record"),
    locator: jsonb("locator")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "data_quality_result_links_single_target_check",
      sql`num_nonnulls(
        ${table.sourceSystemId},
        ${table.importBatchId},
        ${table.sourceRecordId},
        ${table.sourceProgrammeId},
        ${table.sourceModuleId},
        ${table.sourceStructureItemId},
        ${table.programmeVersionId},
        ${table.curatedStructureId},
        ${table.curatedStructureGroupId},
        ${table.curatedStructureItemId},
        ${table.moduleId},
        ${table.moduleDescriptorId},
        ${table.evidenceItemId},
        ${table.reviewCycleId},
        ${table.competencyId}
      ) = 1`,
    ),
    index("data_quality_result_links_result_idx").on(table.dataQualityResultId),
    index("data_quality_result_links_source_system_idx").on(
      table.sourceSystemId,
    ),
    index("data_quality_result_links_import_batch_idx").on(table.importBatchId),
    index("data_quality_result_links_source_record_idx").on(
      table.sourceRecordId,
    ),
    index("data_quality_result_links_source_programme_idx").on(
      table.sourceProgrammeId,
    ),
    index("data_quality_result_links_source_module_idx").on(
      table.sourceModuleId,
    ),
    index("data_quality_result_links_source_structure_idx").on(
      table.sourceStructureItemId,
    ),
    index("data_quality_result_links_programme_idx").on(
      table.programmeVersionId,
    ),
    index("data_quality_result_links_structure_idx").on(
      table.curatedStructureId,
    ),
    index("data_quality_result_links_structure_group_idx").on(
      table.curatedStructureGroupId,
    ),
    index("data_quality_result_links_structure_item_idx").on(
      table.curatedStructureItemId,
    ),
    index("data_quality_result_links_module_idx").on(table.moduleId),
    index("data_quality_result_links_descriptor_idx").on(
      table.moduleDescriptorId,
    ),
    index("data_quality_result_links_evidence_idx").on(table.evidenceItemId),
    index("data_quality_result_links_review_cycle_idx").on(table.reviewCycleId),
    index("data_quality_result_links_competency_idx").on(table.competencyId),
  ],
);

export const localWorkersTable = pgTable(
  "local_workers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutionsTable.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    status: localWorkerStatusEnum("status").notNull().default("pending"),
    connectionMode: workerConnectionModeEnum("connection_mode")
      .notNull()
      .default("pull"),
    softwareVersion: text("software_version"),
    runtime: text("runtime"),
    publicKey: text("public_key"),
    credentialFingerprint: text("credential_fingerprint"),
    capabilities: jsonb("capabilities")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    allowedDataClasses: jsonb("allowed_data_classes")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    configuration: jsonb("configuration")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    registeredByUserId: uuid("registered_by_user_id").references(
      () => usersTable.id,
      { onDelete: "set null" },
    ),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("local_workers_institution_key_unique").on(
      table.institutionId,
      table.key,
    ),
    index("local_workers_institution_idx").on(table.institutionId),
    index("local_workers_status_idx").on(table.status),
    index("local_workers_last_seen_idx").on(table.lastSeenAt),
    index("local_workers_credential_fingerprint_idx").on(
      table.credentialFingerprint,
    ),
  ],
);

export const workerJobsTable = pgTable(
  "worker_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutionsTable.id, { onDelete: "cascade" }),
    localWorkerId: uuid("local_worker_id").references(
      () => localWorkersTable.id,
      { onDelete: "set null" },
    ),
    analysisRunId: uuid("analysis_run_id").references(
      () => analysisRunsTable.id,
      { onDelete: "set null" },
    ),
    dataQualityRunId: uuid("data_quality_run_id").references(
      () => dataQualityRunsTable.id,
      { onDelete: "set null" },
    ),
    importBatchId: uuid("import_batch_id").references(
      () => importBatchesTable.id,
      { onDelete: "set null" },
    ),
    documentVersionId: uuid("document_version_id").references(
      () => documentVersionsTable.id,
      { onDelete: "set null" },
    ),
    jobType: workerJobTypeEnum("job_type").notNull(),
    status: workerJobStatusEnum("status").notNull().default("queued"),
    dataHandlingMode: workerDataHandlingModeEnum("data_handling_mode")
      .notNull()
      .default("local_preferred"),
    priority: integer("priority").notNull().default(0),
    idempotencyKey: text("idempotency_key"),
    inputManifest: jsonb("input_manifest")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    configuration: jsonb("configuration")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    provenance: jsonb("provenance")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    errorMessage: text("error_message"),
    attemptCount: integer("attempt_count").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    requestedByUserId: uuid("requested_by_user_id").references(
      () => usersTable.id,
      { onDelete: "set null" },
    ),
    availableAt: timestamp("available_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("worker_jobs_institution_idempotency_unique")
      .on(table.institutionId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} is not null`),
    index("worker_jobs_institution_idx").on(table.institutionId),
    index("worker_jobs_worker_idx").on(table.localWorkerId),
    index("worker_jobs_type_status_idx").on(table.jobType, table.status),
    index("worker_jobs_analysis_run_idx").on(table.analysisRunId),
    index("worker_jobs_data_quality_run_idx").on(table.dataQualityRunId),
    index("worker_jobs_import_batch_idx").on(table.importBatchId),
    index("worker_jobs_document_version_idx").on(table.documentVersionId),
    index("worker_jobs_available_idx").on(table.status, table.availableAt),
  ],
);

export const workerJobArtifactsTable = pgTable(
  "worker_job_artifacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutionsTable.id, { onDelete: "cascade" }),
    workerJobId: uuid("worker_job_id")
      .notNull()
      .references(() => workerJobsTable.id, { onDelete: "cascade" }),
    artifactType: workerArtifactTypeEnum("artifact_type").notNull(),
    location: workerArtifactLocationEnum("location").notNull(),
    name: text("name"),
    locator: text("locator"),
    contentType: text("content_type"),
    checksum: text("checksum"),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    isSensitive: boolean("is_sensitive").notNull().default(false),
    encryptionMetadata: jsonb("encryption_metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("worker_job_artifacts_job_type_checksum_unique")
      .on(table.workerJobId, table.artifactType, table.checksum)
      .where(sql`${table.checksum} is not null`),
    index("worker_job_artifacts_institution_idx").on(table.institutionId),
    index("worker_job_artifacts_job_idx").on(table.workerJobId),
    index("worker_job_artifacts_type_location_idx").on(
      table.artifactType,
      table.location,
    ),
    index("worker_job_artifacts_checksum_idx").on(table.checksum),
  ],
);

export const workerSyncEventsTable = pgTable(
  "worker_sync_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutionsTable.id, { onDelete: "cascade" }),
    localWorkerId: uuid("local_worker_id")
      .notNull()
      .references(() => localWorkersTable.id, { onDelete: "cascade" }),
    workerJobId: uuid("worker_job_id").references(() => workerJobsTable.id, {
      onDelete: "set null",
    }),
    workerJobArtifactId: uuid("worker_job_artifact_id").references(
      () => workerJobArtifactsTable.id,
      { onDelete: "set null" },
    ),
    direction: workerSyncDirectionEnum("direction").notNull(),
    eventType: workerSyncEventTypeEnum("event_type").notNull(),
    status: workerSyncEventStatusEnum("status").notNull().default("pending"),
    idempotencyKey: text("idempotency_key"),
    correlationId: text("correlation_id"),
    sequenceNumber: integer("sequence_number"),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    errorMessage: text("error_message"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("worker_sync_events_worker_idempotency_unique")
      .on(table.localWorkerId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} is not null`),
    index("worker_sync_events_institution_idx").on(table.institutionId),
    index("worker_sync_events_worker_idx").on(table.localWorkerId),
    index("worker_sync_events_job_idx").on(table.workerJobId),
    index("worker_sync_events_artifact_idx").on(table.workerJobArtifactId),
    index("worker_sync_events_type_status_idx").on(
      table.eventType,
      table.status,
    ),
    index("worker_sync_events_received_idx").on(table.receivedAt),
  ],
);

export type DataQualityRule = typeof dataQualityRulesTable.$inferSelect;
export type InsertDataQualityRule = typeof dataQualityRulesTable.$inferInsert;
export type DataQualityRun = typeof dataQualityRunsTable.$inferSelect;
export type InsertDataQualityRun = typeof dataQualityRunsTable.$inferInsert;
export type DataQualityResult = typeof dataQualityResultsTable.$inferSelect;
export type InsertDataQualityResult =
  typeof dataQualityResultsTable.$inferInsert;
export type DataQualityResultLink =
  typeof dataQualityResultLinksTable.$inferSelect;
export type InsertDataQualityResultLink =
  typeof dataQualityResultLinksTable.$inferInsert;
export type LocalWorker = typeof localWorkersTable.$inferSelect;
export type InsertLocalWorker = typeof localWorkersTable.$inferInsert;
export type WorkerJob = typeof workerJobsTable.$inferSelect;
export type InsertWorkerJob = typeof workerJobsTable.$inferInsert;
export type WorkerJobArtifact = typeof workerJobArtifactsTable.$inferSelect;
export type InsertWorkerJobArtifact =
  typeof workerJobArtifactsTable.$inferInsert;
export type WorkerSyncEvent = typeof workerSyncEventsTable.$inferSelect;
export type InsertWorkerSyncEvent = typeof workerSyncEventsTable.$inferInsert;
