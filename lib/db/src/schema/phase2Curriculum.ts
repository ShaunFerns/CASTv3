import { sql } from "drizzle-orm";
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
  assessmentComponentStatusEnum,
  coreOptionStatusEnum,
  curatedStructureGroupTypeEnum,
  curatedStructureItemTypeEnum,
  curatedStructureStatusEnum,
  curriculumVersionStatusEnum,
  descriptorSectionTypeEnum,
  learningOutcomeStatusEnum,
  moduleStatusEnum,
} from "./phase2Enums";
import {
  sourceModulesTable,
  sourceProgrammesTable,
  sourceStructureItemsTable,
} from "./phase2Imports";
import { institutionsTable } from "./phase2Tenancy";

export const programmeVersionsTable = pgTable(
  "programme_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    sourceProgrammeId: uuid("source_programme_id").references(() => sourceProgrammesTable.id, { onDelete: "set null" }),
    legacyProgrammeId: integer("legacy_programme_id"),
    programmeKey: text("programme_key").notNull(),
    programmeCode: text("programme_code"),
    programmeName: text("programme_name"),
    versionLabel: text("version_label").notNull(),
    status: curriculumVersionStatusEnum("status").notNull().default("draft"),
    academicYear: text("academic_year"),
    award: text("award"),
    level: text("level"),
    school: text("school"),
    department: text("department"),
    campus: text("campus"),
    modeOfDelivery: text("mode_of_delivery"),
    totalCredits: real("total_credits"),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: uuid("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("programme_versions_institution_key_label_unique").on(table.institutionId, table.programmeKey, table.versionLabel),
    index("programme_versions_institution_idx").on(table.institutionId),
    index("programme_versions_source_programme_idx").on(table.sourceProgrammeId),
    index("programme_versions_legacy_programme_idx").on(table.legacyProgrammeId),
    index("programme_versions_code_idx").on(table.programmeCode),
    index("programme_versions_status_idx").on(table.status),
  ],
);

export const modulesTable = pgTable(
  "modules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    sourceModuleId: uuid("source_module_id").references(() => sourceModulesTable.id, { onDelete: "set null" }),
    legacyModuleReviewId: integer("legacy_module_review_id"),
    moduleCode: text("module_code"),
    moduleTitle: text("module_title"),
    status: moduleStatusEnum("status").notNull().default("draft"),
    school: text("school"),
    department: text("department"),
    campus: text("campus"),
    disciplineFamily: text("discipline_family"),
    defaultCredits: real("default_credits"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: uuid("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("modules_institution_code_unique").on(table.institutionId, table.moduleCode).where(sql`${table.moduleCode} is not null`),
    index("modules_institution_idx").on(table.institutionId),
    index("modules_source_module_idx").on(table.sourceModuleId),
    index("modules_legacy_module_review_idx").on(table.legacyModuleReviewId),
    index("modules_status_idx").on(table.status),
  ],
);

export const moduleDescriptorsTable = pgTable(
  "module_descriptors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id").notNull().references(() => modulesTable.id, { onDelete: "cascade" }),
    sourceModuleId: uuid("source_module_id").references(() => sourceModulesTable.id, { onDelete: "set null" }),
    legacyModuleReviewId: integer("legacy_module_review_id"),
    versionLabel: text("version_label").notNull(),
    status: curriculumVersionStatusEnum("status").notNull().default("draft"),
    descriptorText: text("descriptor_text"),
    sourceType: text("source_type"),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: uuid("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("module_descriptors_module_label_unique").on(table.moduleId, table.versionLabel),
    index("module_descriptors_institution_idx").on(table.institutionId),
    index("module_descriptors_source_module_idx").on(table.sourceModuleId),
    index("module_descriptors_legacy_module_review_idx").on(table.legacyModuleReviewId),
    index("module_descriptors_status_idx").on(table.status),
  ],
);

export const descriptorSectionsTable = pgTable(
  "descriptor_sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    moduleDescriptorId: uuid("module_descriptor_id").notNull().references(() => moduleDescriptorsTable.id, { onDelete: "cascade" }),
    sectionType: descriptorSectionTypeEnum("section_type").notNull().default("other"),
    title: text("title"),
    content: text("content"),
    orderIndex: integer("order_index").notNull().default(0),
    sourceLocation: jsonb("source_location").$type<Record<string, unknown>>().notNull().default({}),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("descriptor_sections_institution_idx").on(table.institutionId),
    index("descriptor_sections_descriptor_idx").on(table.moduleDescriptorId),
    index("descriptor_sections_type_idx").on(table.sectionType),
  ],
);

export const learningOutcomesTable = pgTable(
  "learning_outcomes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    moduleDescriptorId: uuid("module_descriptor_id").notNull().references(() => moduleDescriptorsTable.id, { onDelete: "cascade" }),
    descriptorSectionId: uuid("descriptor_section_id").references(() => descriptorSectionsTable.id, { onDelete: "set null" }),
    outcomeCode: text("outcome_code"),
    outcomeText: text("outcome_text"),
    orderIndex: integer("order_index").notNull().default(0),
    status: learningOutcomeStatusEnum("status").notNull().default("draft"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("learning_outcomes_institution_idx").on(table.institutionId),
    index("learning_outcomes_descriptor_idx").on(table.moduleDescriptorId),
    index("learning_outcomes_section_idx").on(table.descriptorSectionId),
    index("learning_outcomes_status_idx").on(table.status),
  ],
);

export const assessmentComponentsTable = pgTable(
  "assessment_components",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    moduleDescriptorId: uuid("module_descriptor_id").notNull().references(() => moduleDescriptorsTable.id, { onDelete: "cascade" }),
    descriptorSectionId: uuid("descriptor_section_id").references(() => descriptorSectionsTable.id, { onDelete: "set null" }),
    componentName: text("component_name"),
    componentType: text("component_type"),
    assessmentMode: text("assessment_mode"),
    weighting: real("weighting"),
    description: text("description"),
    orderIndex: integer("order_index").notNull().default(0),
    status: assessmentComponentStatusEnum("status").notNull().default("draft"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("assessment_components_institution_idx").on(table.institutionId),
    index("assessment_components_descriptor_idx").on(table.moduleDescriptorId),
    index("assessment_components_section_idx").on(table.descriptorSectionId),
    index("assessment_components_status_idx").on(table.status),
  ],
);

export const curatedStructuresTable = pgTable(
  "curated_structures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    programmeVersionId: uuid("programme_version_id").notNull().references(() => programmeVersionsTable.id, { onDelete: "cascade" }),
    sourceProgrammeId: uuid("source_programme_id").references(() => sourceProgrammesTable.id, { onDelete: "set null" }),
    legacyProgrammeId: integer("legacy_programme_id"),
    key: text("key").notNull(),
    name: text("name"),
    status: curatedStructureStatusEnum("status").notNull().default("draft"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: uuid("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("curated_structures_programme_key_unique").on(table.programmeVersionId, table.key),
    index("curated_structures_institution_idx").on(table.institutionId),
    index("curated_structures_source_programme_idx").on(table.sourceProgrammeId),
    index("curated_structures_legacy_programme_idx").on(table.legacyProgrammeId),
    index("curated_structures_status_idx").on(table.status),
  ],
);

export const curatedStructureGroupsTable = pgTable(
  "curated_structure_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    curatedStructureId: uuid("curated_structure_id").notNull().references(() => curatedStructuresTable.id, { onDelete: "cascade" }),
    parentGroupId: uuid("parent_group_id").references((): AnyPgColumn => curatedStructureGroupsTable.id, { onDelete: "cascade" }),
    sourceStructureItemId: uuid("source_structure_item_id").references(() => sourceStructureItemsTable.id, { onDelete: "set null" }),
    groupType: curatedStructureGroupTypeEnum("group_type").notNull().default("custom"),
    key: text("key").notNull(),
    name: text("name"),
    stage: text("stage"),
    semester: text("semester"),
    pathway: text("pathway"),
    minCredits: real("min_credits"),
    maxCredits: real("max_credits"),
    orderIndex: integer("order_index").notNull().default(0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("curated_structure_groups_structure_key_unique").on(table.curatedStructureId, table.key),
    index("curated_structure_groups_institution_idx").on(table.institutionId),
    index("curated_structure_groups_structure_idx").on(table.curatedStructureId),
    index("curated_structure_groups_parent_idx").on(table.parentGroupId),
    index("curated_structure_groups_source_item_idx").on(table.sourceStructureItemId),
    index("curated_structure_groups_type_idx").on(table.groupType),
  ],
);

export const curatedStructureItemsTable = pgTable(
  "curated_structure_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    curatedStructureId: uuid("curated_structure_id").notNull().references(() => curatedStructuresTable.id, { onDelete: "cascade" }),
    curatedStructureGroupId: uuid("curated_structure_group_id").references(() => curatedStructureGroupsTable.id, { onDelete: "set null" }),
    moduleId: uuid("module_id").references(() => modulesTable.id, { onDelete: "set null" }),
    moduleDescriptorId: uuid("module_descriptor_id").references(() => moduleDescriptorsTable.id, { onDelete: "set null" }),
    sourceStructureItemId: uuid("source_structure_item_id").references(() => sourceStructureItemsTable.id, { onDelete: "set null" }),
    sourceModuleId: uuid("source_module_id").references(() => sourceModulesTable.id, { onDelete: "set null" }),
    legacyProgrammeModuleId: integer("legacy_programme_module_id"),
    itemType: curatedStructureItemTypeEnum("item_type").notNull().default("module"),
    coreOption: coreOptionStatusEnum("core_option").notNull().default("unknown"),
    stage: text("stage"),
    semester: text("semester"),
    pathway: text("pathway"),
    credits: real("credits"),
    orderIndex: integer("order_index").notNull().default(0),
    label: text("label"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("curated_structure_items_institution_idx").on(table.institutionId),
    index("curated_structure_items_structure_idx").on(table.curatedStructureId),
    index("curated_structure_items_group_idx").on(table.curatedStructureGroupId),
    index("curated_structure_items_module_idx").on(table.moduleId),
    index("curated_structure_items_descriptor_idx").on(table.moduleDescriptorId),
    index("curated_structure_items_source_item_idx").on(table.sourceStructureItemId),
    index("curated_structure_items_source_module_idx").on(table.sourceModuleId),
    index("curated_structure_items_legacy_idx").on(table.legacyProgrammeModuleId),
  ],
);

export type ProgrammeVersion = typeof programmeVersionsTable.$inferSelect;
export type InsertProgrammeVersion = typeof programmeVersionsTable.$inferInsert;
export type Module = typeof modulesTable.$inferSelect;
export type InsertModule = typeof modulesTable.$inferInsert;
export type ModuleDescriptor = typeof moduleDescriptorsTable.$inferSelect;
export type InsertModuleDescriptor = typeof moduleDescriptorsTable.$inferInsert;
export type DescriptorSection = typeof descriptorSectionsTable.$inferSelect;
export type InsertDescriptorSection = typeof descriptorSectionsTable.$inferInsert;
export type LearningOutcome = typeof learningOutcomesTable.$inferSelect;
export type InsertLearningOutcome = typeof learningOutcomesTable.$inferInsert;
export type AssessmentComponent = typeof assessmentComponentsTable.$inferSelect;
export type InsertAssessmentComponent = typeof assessmentComponentsTable.$inferInsert;
export type CuratedStructure = typeof curatedStructuresTable.$inferSelect;
export type InsertCuratedStructure = typeof curatedStructuresTable.$inferInsert;
export type CuratedStructureGroup = typeof curatedStructureGroupsTable.$inferSelect;
export type InsertCuratedStructureGroup = typeof curatedStructureGroupsTable.$inferInsert;
export type CuratedStructureItem = typeof curatedStructureItemsTable.$inferSelect;
export type InsertCuratedStructureItem = typeof curatedStructureItemsTable.$inferInsert;
