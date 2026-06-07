import {
  type AnyPgColumn,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { usersTable } from "./phase2Access";
import {
  assessmentComponentsTable,
  curatedStructureGroupsTable,
  curatedStructureItemsTable,
  descriptorSectionsTable,
  learningOutcomesTable,
  moduleDescriptorsTable,
  modulesTable,
  programmeVersionsTable,
} from "./phase2Curriculum";
import {
  competencyEvaluationSourceEnum,
  competencyEvaluationStatusEnum,
  documentSectionTypeEnum,
  documentStatusEnum,
  documentTypeEnum,
  evidenceItemStatusEnum,
  evidenceSourceKindEnum,
  expectationScopeEnum,
  graduateAttributeStatusEnum,
  scaffoldingLevelEnum,
} from "./phase2Enums";
import { frameworkVersionsTable } from "./phase2Frameworks";
import {
  importBatchesTable,
  sourceRecordsTable,
  sourceSystemsTable,
} from "./phase2Imports";
import { lensVersionsTable } from "./phase2Lenses";
import { institutionsTable } from "./phase2Tenancy";

export const documentsTable = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    sourceSystemId: uuid("source_system_id").references(() => sourceSystemsTable.id, { onDelete: "set null" }),
    sourceRecordId: uuid("source_record_id").references(() => sourceRecordsTable.id, { onDelete: "set null" }),
    programmeVersionId: uuid("programme_version_id").references(() => programmeVersionsTable.id, { onDelete: "set null" }),
    moduleId: uuid("module_id").references(() => modulesTable.id, { onDelete: "set null" }),
    moduleDescriptorId: uuid("module_descriptor_id").references(() => moduleDescriptorsTable.id, { onDelete: "set null" }),
    documentType: documentTypeEnum("document_type").notNull().default("other"),
    title: text("title"),
    externalId: text("external_id"),
    status: documentStatusEnum("status").notNull().default("draft"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: uuid("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("documents_institution_idx").on(table.institutionId),
    index("documents_source_system_idx").on(table.sourceSystemId),
    index("documents_source_record_idx").on(table.sourceRecordId),
    index("documents_programme_version_idx").on(table.programmeVersionId),
    index("documents_module_idx").on(table.moduleId),
    index("documents_module_descriptor_idx").on(table.moduleDescriptorId),
    index("documents_type_status_idx").on(table.documentType, table.status),
  ],
);

export const documentVersionsTable = pgTable(
  "document_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").notNull().references(() => documentsTable.id, { onDelete: "cascade" }),
    importBatchId: uuid("import_batch_id").references(() => importBatchesTable.id, { onDelete: "set null" }),
    sourceRecordId: uuid("source_record_id").references(() => sourceRecordsTable.id, { onDelete: "set null" }),
    versionLabel: text("version_label").notNull(),
    fileName: text("file_name"),
    mimeType: text("mime_type"),
    storageKey: text("storage_key"),
    checksum: text("checksum"),
    rawText: text("raw_text"),
    status: documentStatusEnum("status").notNull().default("draft"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: uuid("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("document_versions_document_label_unique").on(table.documentId, table.versionLabel),
    index("document_versions_institution_idx").on(table.institutionId),
    index("document_versions_import_batch_idx").on(table.importBatchId),
    index("document_versions_source_record_idx").on(table.sourceRecordId),
    index("document_versions_checksum_idx").on(table.checksum),
    index("document_versions_status_idx").on(table.status),
  ],
);

export const documentSectionsTable = pgTable(
  "document_sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    documentVersionId: uuid("document_version_id").notNull().references(() => documentVersionsTable.id, { onDelete: "cascade" }),
    parentSectionId: uuid("parent_section_id").references((): AnyPgColumn => documentSectionsTable.id, { onDelete: "cascade" }),
    sectionType: documentSectionTypeEnum("section_type").notNull().default("other"),
    heading: text("heading"),
    content: text("content"),
    pageStart: integer("page_start"),
    pageEnd: integer("page_end"),
    characterStart: integer("character_start"),
    characterEnd: integer("character_end"),
    orderIndex: integer("order_index").notNull().default(0),
    sourceLocation: jsonb("source_location").$type<Record<string, unknown>>().notNull().default({}),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("document_sections_institution_idx").on(table.institutionId),
    index("document_sections_version_idx").on(table.documentVersionId),
    index("document_sections_parent_idx").on(table.parentSectionId),
    index("document_sections_type_idx").on(table.sectionType),
  ],
);

export const evidenceItemsTable = pgTable(
  "evidence_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    documentVersionId: uuid("document_version_id").references(() => documentVersionsTable.id, { onDelete: "set null" }),
    documentSectionId: uuid("document_section_id").references(() => documentSectionsTable.id, { onDelete: "set null" }),
    descriptorSectionId: uuid("descriptor_section_id").references(() => descriptorSectionsTable.id, { onDelete: "set null" }),
    learningOutcomeId: uuid("learning_outcome_id").references(() => learningOutcomesTable.id, { onDelete: "set null" }),
    assessmentComponentId: uuid("assessment_component_id").references(() => assessmentComponentsTable.id, { onDelete: "set null" }),
    programmeVersionId: uuid("programme_version_id").references(() => programmeVersionsTable.id, { onDelete: "set null" }),
    moduleId: uuid("module_id").references(() => modulesTable.id, { onDelete: "set null" }),
    curatedStructureItemId: uuid("curated_structure_item_id").references(() => curatedStructureItemsTable.id, { onDelete: "set null" }),
    sourceKind: evidenceSourceKindEnum("source_kind").notNull(),
    evidenceText: text("evidence_text"),
    characterStart: integer("character_start"),
    characterEnd: integer("character_end"),
    confidence: real("confidence"),
    status: evidenceItemStatusEnum("status").notNull().default("extracted"),
    sourceLocation: jsonb("source_location").$type<Record<string, unknown>>().notNull().default({}),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: uuid("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("evidence_items_institution_idx").on(table.institutionId),
    index("evidence_items_document_version_idx").on(table.documentVersionId),
    index("evidence_items_document_section_idx").on(table.documentSectionId),
    index("evidence_items_descriptor_section_idx").on(table.descriptorSectionId),
    index("evidence_items_learning_outcome_idx").on(table.learningOutcomeId),
    index("evidence_items_assessment_component_idx").on(table.assessmentComponentId),
    index("evidence_items_programme_version_idx").on(table.programmeVersionId),
    index("evidence_items_module_idx").on(table.moduleId),
    index("evidence_items_structure_item_idx").on(table.curatedStructureItemId),
    index("evidence_items_kind_status_idx").on(table.sourceKind, table.status),
  ],
);

export const evidenceTagsTable = pgTable(
  "evidence_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("evidence_tags_institution_key_unique").on(table.institutionId, table.key),
    index("evidence_tags_institution_idx").on(table.institutionId),
  ],
);

export const evidenceItemTagsTable = pgTable(
  "evidence_item_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    evidenceItemId: uuid("evidence_item_id").notNull().references(() => evidenceItemsTable.id, { onDelete: "cascade" }),
    evidenceTagId: uuid("evidence_tag_id").notNull().references(() => evidenceTagsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("evidence_item_tags_item_tag_unique").on(table.evidenceItemId, table.evidenceTagId),
    index("evidence_item_tags_tag_idx").on(table.evidenceTagId),
  ],
);

export const competencyDomainsTable = pgTable(
  "competency_domains",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    frameworkVersionId: uuid("framework_version_id").notNull().references(() => frameworkVersionsTable.id, { onDelete: "cascade" }),
    parentDomainId: uuid("parent_domain_id").references((): AnyPgColumn => competencyDomainsTable.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    orderIndex: integer("order_index").notNull().default(0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("competency_domains_framework_key_unique").on(table.frameworkVersionId, table.key),
    index("competency_domains_framework_idx").on(table.frameworkVersionId),
    index("competency_domains_parent_idx").on(table.parentDomainId),
  ],
);

export const competenciesTable = pgTable(
  "competencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    frameworkVersionId: uuid("framework_version_id").notNull().references(() => frameworkVersionsTable.id, { onDelete: "cascade" }),
    competencyDomainId: uuid("competency_domain_id").references(() => competencyDomainsTable.id, { onDelete: "set null" }),
    parentCompetencyId: uuid("parent_competency_id").references((): AnyPgColumn => competenciesTable.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    orderIndex: integer("order_index").notNull().default(0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("competencies_framework_key_unique").on(table.frameworkVersionId, table.key),
    index("competencies_framework_idx").on(table.frameworkVersionId),
    index("competencies_domain_idx").on(table.competencyDomainId),
    index("competencies_parent_idx").on(table.parentCompetencyId),
  ],
);

export const programmeGraduateAttributesTable = pgTable(
  "programme_graduate_attributes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    programmeVersionId: uuid("programme_version_id").notNull().references(() => programmeVersionsTable.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    status: graduateAttributeStatusEnum("status").notNull().default("draft"),
    orderIndex: integer("order_index").notNull().default(0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: uuid("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("programme_graduate_attributes_programme_key_unique").on(table.programmeVersionId, table.key),
    index("programme_graduate_attributes_institution_idx").on(table.institutionId),
    index("programme_graduate_attributes_programme_idx").on(table.programmeVersionId),
    index("programme_graduate_attributes_status_idx").on(table.status),
  ],
);

export const programmeAttributeExpectationsTable = pgTable(
  "programme_attribute_expectations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    programmeVersionId: uuid("programme_version_id").notNull().references(() => programmeVersionsTable.id, { onDelete: "cascade" }),
    programmeGraduateAttributeId: uuid("programme_graduate_attribute_id").notNull().references(() => programmeGraduateAttributesTable.id, { onDelete: "cascade" }),
    scope: expectationScopeEnum("scope").notNull().default("programme"),
    stage: text("stage"),
    semester: text("semester"),
    pathway: text("pathway"),
    curatedStructureGroupId: uuid("curated_structure_group_id").references(() => curatedStructureGroupsTable.id, { onDelete: "set null" }),
    moduleId: uuid("module_id").references(() => modulesTable.id, { onDelete: "set null" }),
    expectedLevel: scaffoldingLevelEnum("expected_level").notNull().default("none"),
    rationale: text("rationale"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: uuid("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("programme_attribute_expectations_institution_idx").on(table.institutionId),
    index("programme_attribute_expectations_programme_idx").on(table.programmeVersionId),
    index("programme_attribute_expectations_attribute_idx").on(table.programmeGraduateAttributeId),
    index("programme_attribute_expectations_scope_idx").on(table.scope),
    index("programme_attribute_expectations_group_idx").on(table.curatedStructureGroupId),
    index("programme_attribute_expectations_module_idx").on(table.moduleId),
  ],
);

export const programmeCompetencyExpectationsTable = pgTable(
  "programme_competency_expectations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    programmeVersionId: uuid("programme_version_id").notNull().references(() => programmeVersionsTable.id, { onDelete: "cascade" }),
    competencyId: uuid("competency_id").notNull().references(() => competenciesTable.id, { onDelete: "cascade" }),
    scope: expectationScopeEnum("scope").notNull().default("programme"),
    stage: text("stage"),
    semester: text("semester"),
    pathway: text("pathway"),
    curatedStructureGroupId: uuid("curated_structure_group_id").references(() => curatedStructureGroupsTable.id, { onDelete: "set null" }),
    moduleId: uuid("module_id").references(() => modulesTable.id, { onDelete: "set null" }),
    expectedLevel: scaffoldingLevelEnum("expected_level").notNull().default("none"),
    rationale: text("rationale"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: uuid("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("programme_competency_expectations_institution_idx").on(table.institutionId),
    index("programme_competency_expectations_programme_idx").on(table.programmeVersionId),
    index("programme_competency_expectations_competency_idx").on(table.competencyId),
    index("programme_competency_expectations_scope_idx").on(table.scope),
    index("programme_competency_expectations_group_idx").on(table.curatedStructureGroupId),
    index("programme_competency_expectations_module_idx").on(table.moduleId),
  ],
);

export const competencyEvaluationsTable = pgTable(
  "competency_evaluations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    programmeVersionId: uuid("programme_version_id").references(() => programmeVersionsTable.id, { onDelete: "set null" }),
    competencyId: uuid("competency_id").references(() => competenciesTable.id, { onDelete: "set null" }),
    programmeGraduateAttributeId: uuid("programme_graduate_attribute_id").references(() => programmeGraduateAttributesTable.id, { onDelete: "set null" }),
    lensVersionId: uuid("lens_version_id").references(() => lensVersionsTable.id, { onDelete: "set null" }),
    curatedStructureGroupId: uuid("curated_structure_group_id").references(() => curatedStructureGroupsTable.id, { onDelete: "set null" }),
    curatedStructureItemId: uuid("curated_structure_item_id").references(() => curatedStructureItemsTable.id, { onDelete: "set null" }),
    moduleId: uuid("module_id").references(() => modulesTable.id, { onDelete: "set null" }),
    moduleDescriptorId: uuid("module_descriptor_id").references(() => moduleDescriptorsTable.id, { onDelete: "set null" }),
    observedLevel: scaffoldingLevelEnum("observed_level").notNull().default("none"),
    source: competencyEvaluationSourceEnum("source").notNull().default("human"),
    status: competencyEvaluationStatusEnum("status").notNull().default("draft"),
    confidence: real("confidence"),
    rationale: text("rationale"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: uuid("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("competency_evaluations_institution_idx").on(table.institutionId),
    index("competency_evaluations_programme_idx").on(table.programmeVersionId),
    index("competency_evaluations_competency_idx").on(table.competencyId),
    index("competency_evaluations_attribute_idx").on(table.programmeGraduateAttributeId),
    index("competency_evaluations_lens_idx").on(table.lensVersionId),
    index("competency_evaluations_group_idx").on(table.curatedStructureGroupId),
    index("competency_evaluations_item_idx").on(table.curatedStructureItemId),
    index("competency_evaluations_module_idx").on(table.moduleId),
    index("competency_evaluations_descriptor_idx").on(table.moduleDescriptorId),
    index("competency_evaluations_status_source_idx").on(table.status, table.source),
  ],
);

export const competencyEvaluationEvidenceLinksTable = pgTable(
  "competency_evaluation_evidence_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competencyEvaluationId: uuid("competency_evaluation_id").notNull().references(() => competencyEvaluationsTable.id, { onDelete: "cascade" }),
    evidenceItemId: uuid("evidence_item_id").notNull().references(() => evidenceItemsTable.id, { onDelete: "cascade" }),
    relevance: real("relevance"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("competency_evaluation_evidence_unique").on(table.competencyEvaluationId, table.evidenceItemId),
    index("competency_evaluation_evidence_item_idx").on(table.evidenceItemId),
  ],
);

export type Document = typeof documentsTable.$inferSelect;
export type InsertDocument = typeof documentsTable.$inferInsert;
export type DocumentVersion = typeof documentVersionsTable.$inferSelect;
export type InsertDocumentVersion = typeof documentVersionsTable.$inferInsert;
export type DocumentSection = typeof documentSectionsTable.$inferSelect;
export type InsertDocumentSection = typeof documentSectionsTable.$inferInsert;
export type EvidenceItem = typeof evidenceItemsTable.$inferSelect;
export type InsertEvidenceItem = typeof evidenceItemsTable.$inferInsert;
export type EvidenceTag = typeof evidenceTagsTable.$inferSelect;
export type InsertEvidenceTag = typeof evidenceTagsTable.$inferInsert;
export type CompetencyDomain = typeof competencyDomainsTable.$inferSelect;
export type InsertCompetencyDomain = typeof competencyDomainsTable.$inferInsert;
export type Competency = typeof competenciesTable.$inferSelect;
export type InsertCompetency = typeof competenciesTable.$inferInsert;
export type ProgrammeGraduateAttribute = typeof programmeGraduateAttributesTable.$inferSelect;
export type InsertProgrammeGraduateAttribute = typeof programmeGraduateAttributesTable.$inferInsert;
export type ProgrammeAttributeExpectation = typeof programmeAttributeExpectationsTable.$inferSelect;
export type InsertProgrammeAttributeExpectation = typeof programmeAttributeExpectationsTable.$inferInsert;
export type ProgrammeCompetencyExpectation = typeof programmeCompetencyExpectationsTable.$inferSelect;
export type InsertProgrammeCompetencyExpectation = typeof programmeCompetencyExpectationsTable.$inferInsert;
export type CompetencyEvaluation = typeof competencyEvaluationsTable.$inferSelect;
export type InsertCompetencyEvaluation = typeof competencyEvaluationsTable.$inferInsert;
