import { sql } from "drizzle-orm";
import {
  check,
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
  curatedStructureItemsTable,
  descriptorSectionsTable,
  moduleDescriptorsTable,
  modulesTable,
  programmeVersionsTable,
} from "./phase2Curriculum";
import {
  aiClaimStatusEnum,
  aiClaimTypeEnum,
  aiModelRunStatusEnum,
  analysisRunStatusEnum,
  analysisRunTypeEnum,
  clarificationStatusEnum,
  clarificationSubjectTypeEnum,
  descriptorSuggestionStatusEnum,
  descriptorSuggestionTypeEnum,
  humanReviewDecisionEnum,
  humanReviewSubjectTypeEnum,
  promptVersionStatusEnum,
  scaffoldingLevelEnum,
} from "./phase2Enums";
import {
  competenciesTable,
  evidenceItemsTable,
  programmeGraduateAttributesTable,
} from "./phase2Evidence";
import { frameworkVersionsTable } from "./phase2Frameworks";
import { lensVersionsTable } from "./phase2Lenses";
import { institutionsTable } from "./phase2Tenancy";

export const promptVersionsTable = pgTable(
  "prompt_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").references(() => institutionsTable.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    versionLabel: text("version_label").notNull(),
    status: promptVersionStatusEnum("status").notNull().default("draft"),
    systemPrompt: text("system_prompt"),
    userPromptTemplate: text("user_prompt_template"),
    outputSchema: jsonb("output_schema").$type<Record<string, unknown>>().notNull().default({}),
    configuration: jsonb("configuration").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: uuid("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("prompt_versions_institution_key_label_unique").on(table.institutionId, table.key, table.versionLabel),
    uniqueIndex("prompt_versions_global_key_label_unique")
      .on(table.key, table.versionLabel)
      .where(sql`${table.institutionId} is null`),
    index("prompt_versions_institution_idx").on(table.institutionId),
    index("prompt_versions_status_idx").on(table.status),
  ],
);

export const analysisRunsTable = pgTable(
  "analysis_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    runType: analysisRunTypeEnum("run_type").notNull(),
    status: analysisRunStatusEnum("status").notNull().default("pending"),
    programmeVersionId: uuid("programme_version_id").references(() => programmeVersionsTable.id, { onDelete: "set null" }),
    moduleId: uuid("module_id").references(() => modulesTable.id, { onDelete: "set null" }),
    moduleDescriptorId: uuid("module_descriptor_id").references(() => moduleDescriptorsTable.id, { onDelete: "set null" }),
    lensVersionId: uuid("lens_version_id").references(() => lensVersionsTable.id, { onDelete: "set null" }),
    frameworkVersionId: uuid("framework_version_id").references(() => frameworkVersionsTable.id, { onDelete: "set null" }),
    requestedByUserId: uuid("requested_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    configuration: jsonb("configuration").$type<Record<string, unknown>>().notNull().default({}),
    summary: jsonb("summary").$type<Record<string, unknown>>().notNull().default({}),
    errorSummary: jsonb("error_summary").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("analysis_runs_institution_idx").on(table.institutionId),
    index("analysis_runs_type_status_idx").on(table.runType, table.status),
    index("analysis_runs_programme_idx").on(table.programmeVersionId),
    index("analysis_runs_module_idx").on(table.moduleId),
    index("analysis_runs_descriptor_idx").on(table.moduleDescriptorId),
    index("analysis_runs_lens_idx").on(table.lensVersionId),
    index("analysis_runs_framework_idx").on(table.frameworkVersionId),
  ],
);

export const aiModelRunsTable = pgTable(
  "ai_model_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    analysisRunId: uuid("analysis_run_id").notNull().references(() => analysisRunsTable.id, { onDelete: "cascade" }),
    promptVersionId: uuid("prompt_version_id").references(() => promptVersionsTable.id, { onDelete: "set null" }),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    status: aiModelRunStatusEnum("status").notNull().default("pending"),
    modelConfiguration: jsonb("model_configuration").$type<Record<string, unknown>>().notNull().default({}),
    requestMetadata: jsonb("request_metadata").$type<Record<string, unknown>>().notNull().default({}),
    responseMetadata: jsonb("response_metadata").$type<Record<string, unknown>>().notNull().default({}),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    totalTokens: integer("total_tokens"),
    estimatedCost: real("estimated_cost"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("ai_model_runs_institution_idx").on(table.institutionId),
    index("ai_model_runs_analysis_idx").on(table.analysisRunId),
    index("ai_model_runs_prompt_idx").on(table.promptVersionId),
    index("ai_model_runs_provider_model_idx").on(table.provider, table.model),
    index("ai_model_runs_status_idx").on(table.status),
  ],
);

export const aiClaimsTable = pgTable(
  "ai_claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    analysisRunId: uuid("analysis_run_id").notNull().references(() => analysisRunsTable.id, { onDelete: "cascade" }),
    aiModelRunId: uuid("ai_model_run_id").references(() => aiModelRunsTable.id, { onDelete: "set null" }),
    promptVersionId: uuid("prompt_version_id").references(() => promptVersionsTable.id, { onDelete: "set null" }),
    programmeVersionId: uuid("programme_version_id").references(() => programmeVersionsTable.id, { onDelete: "set null" }),
    moduleId: uuid("module_id").references(() => modulesTable.id, { onDelete: "set null" }),
    moduleDescriptorId: uuid("module_descriptor_id").references(() => moduleDescriptorsTable.id, { onDelete: "set null" }),
    descriptorSectionId: uuid("descriptor_section_id").references(() => descriptorSectionsTable.id, { onDelete: "set null" }),
    curatedStructureItemId: uuid("curated_structure_item_id").references(() => curatedStructureItemsTable.id, { onDelete: "set null" }),
    lensVersionId: uuid("lens_version_id").references(() => lensVersionsTable.id, { onDelete: "set null" }),
    frameworkVersionId: uuid("framework_version_id").references(() => frameworkVersionsTable.id, { onDelete: "set null" }),
    competencyId: uuid("competency_id").references(() => competenciesTable.id, { onDelete: "set null" }),
    programmeGraduateAttributeId: uuid("programme_graduate_attribute_id").references(() => programmeGraduateAttributesTable.id, { onDelete: "set null" }),
    claimType: aiClaimTypeEnum("claim_type").notNull().default("other"),
    status: aiClaimStatusEnum("status").notNull().default("draft"),
    title: text("title"),
    claimText: text("claim_text").notNull(),
    rationale: text("rationale"),
    observedLevel: scaffoldingLevelEnum("observed_level"),
    confidence: real("confidence"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("ai_claims_institution_idx").on(table.institutionId),
    index("ai_claims_analysis_idx").on(table.analysisRunId),
    index("ai_claims_model_run_idx").on(table.aiModelRunId),
    index("ai_claims_prompt_idx").on(table.promptVersionId),
    index("ai_claims_programme_idx").on(table.programmeVersionId),
    index("ai_claims_module_idx").on(table.moduleId),
    index("ai_claims_descriptor_idx").on(table.moduleDescriptorId),
    index("ai_claims_section_idx").on(table.descriptorSectionId),
    index("ai_claims_lens_idx").on(table.lensVersionId),
    index("ai_claims_framework_idx").on(table.frameworkVersionId),
    index("ai_claims_competency_idx").on(table.competencyId),
    index("ai_claims_attribute_idx").on(table.programmeGraduateAttributeId),
    index("ai_claims_type_status_idx").on(table.claimType, table.status),
  ],
);

export const claimEvidenceLinksTable = pgTable(
  "claim_evidence_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    aiClaimId: uuid("ai_claim_id").notNull().references(() => aiClaimsTable.id, { onDelete: "cascade" }),
    evidenceItemId: uuid("evidence_item_id").notNull().references(() => evidenceItemsTable.id, { onDelete: "cascade" }),
    relevance: real("relevance"),
    relationship: text("relationship").notNull().default("supports"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("claim_evidence_links_claim_evidence_unique").on(table.aiClaimId, table.evidenceItemId),
    index("claim_evidence_links_evidence_idx").on(table.evidenceItemId),
  ],
);

export const descriptorImprovementSuggestionsTable = pgTable(
  "descriptor_improvement_suggestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    analysisRunId: uuid("analysis_run_id").references(() => analysisRunsTable.id, { onDelete: "set null" }),
    aiModelRunId: uuid("ai_model_run_id").references(() => aiModelRunsTable.id, { onDelete: "set null" }),
    aiClaimId: uuid("ai_claim_id").references(() => aiClaimsTable.id, { onDelete: "set null" }),
    moduleDescriptorId: uuid("module_descriptor_id").notNull().references(() => moduleDescriptorsTable.id, { onDelete: "cascade" }),
    descriptorSectionId: uuid("descriptor_section_id").notNull().references(() => descriptorSectionsTable.id, { onDelete: "cascade" }),
    lensVersionId: uuid("lens_version_id").references(() => lensVersionsTable.id, { onDelete: "set null" }),
    frameworkVersionId: uuid("framework_version_id").references(() => frameworkVersionsTable.id, { onDelete: "set null" }),
    competencyId: uuid("competency_id").references(() => competenciesTable.id, { onDelete: "set null" }),
    programmeGraduateAttributeId: uuid("programme_graduate_attribute_id").references(() => programmeGraduateAttributesTable.id, { onDelete: "set null" }),
    suggestionType: descriptorSuggestionTypeEnum("suggestion_type").notNull().default("other"),
    status: descriptorSuggestionStatusEnum("status").notNull().default("draft"),
    intendedLevel: scaffoldingLevelEnum("intended_level"),
    evidenceGapSummary: text("evidence_gap_summary"),
    originalText: text("original_text"),
    suggestedText: text("suggested_text").notNull(),
    rationale: text("rationale"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("descriptor_suggestions_institution_idx").on(table.institutionId),
    index("descriptor_suggestions_analysis_idx").on(table.analysisRunId),
    index("descriptor_suggestions_claim_idx").on(table.aiClaimId),
    index("descriptor_suggestions_descriptor_idx").on(table.moduleDescriptorId),
    index("descriptor_suggestions_section_idx").on(table.descriptorSectionId),
    index("descriptor_suggestions_lens_idx").on(table.lensVersionId),
    index("descriptor_suggestions_framework_idx").on(table.frameworkVersionId),
    index("descriptor_suggestions_competency_idx").on(table.competencyId),
    index("descriptor_suggestions_attribute_idx").on(table.programmeGraduateAttributeId),
    index("descriptor_suggestions_type_status_idx").on(table.suggestionType, table.status),
  ],
);

export const humanReviewsTable = pgTable(
  "human_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    subjectType: humanReviewSubjectTypeEnum("subject_type").notNull(),
    aiClaimId: uuid("ai_claim_id").references(() => aiClaimsTable.id, { onDelete: "cascade" }),
    descriptorImprovementSuggestionId: uuid("descriptor_improvement_suggestion_id").references(() => descriptorImprovementSuggestionsTable.id, { onDelete: "cascade" }),
    reviewerUserId: uuid("reviewer_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    decision: humanReviewDecisionEnum("decision").notNull(),
    amendedText: text("amended_text"),
    rationale: text("rationale"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      "human_reviews_subject_check",
      sql`(${table.subjectType} = 'ai_claim' and ${table.aiClaimId} is not null and ${table.descriptorImprovementSuggestionId} is null)
        or (${table.subjectType} = 'descriptor_improvement_suggestion' and ${table.descriptorImprovementSuggestionId} is not null and ${table.aiClaimId} is null)`,
    ),
    index("human_reviews_institution_idx").on(table.institutionId),
    index("human_reviews_claim_idx").on(table.aiClaimId),
    index("human_reviews_suggestion_idx").on(table.descriptorImprovementSuggestionId),
    index("human_reviews_reviewer_idx").on(table.reviewerUserId),
    index("human_reviews_subject_decision_idx").on(table.subjectType, table.decision),
  ],
);

export const clarificationRequestsTable = pgTable(
  "clarification_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    subjectType: clarificationSubjectTypeEnum("subject_type").notNull(),
    aiClaimId: uuid("ai_claim_id").references(() => aiClaimsTable.id, { onDelete: "cascade" }),
    descriptorImprovementSuggestionId: uuid("descriptor_improvement_suggestion_id").references(() => descriptorImprovementSuggestionsTable.id, { onDelete: "cascade" }),
    humanReviewId: uuid("human_review_id").references(() => humanReviewsTable.id, { onDelete: "set null" }),
    requestedByUserId: uuid("requested_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    assignedToUserId: uuid("assigned_to_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    status: clarificationStatusEnum("status").notNull().default("open"),
    question: text("question").notNull(),
    response: text("response"),
    responseMetadata: jsonb("response_metadata").$type<Record<string, unknown>>().notNull().default({}),
    dueAt: timestamp("due_at", { withTimezone: true }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      "clarification_requests_subject_check",
      sql`(${table.subjectType} = 'ai_claim' and ${table.aiClaimId} is not null and ${table.descriptorImprovementSuggestionId} is null)
        or (${table.subjectType} = 'descriptor_improvement_suggestion' and ${table.descriptorImprovementSuggestionId} is not null and ${table.aiClaimId} is null)`,
    ),
    index("clarification_requests_institution_idx").on(table.institutionId),
    index("clarification_requests_claim_idx").on(table.aiClaimId),
    index("clarification_requests_suggestion_idx").on(table.descriptorImprovementSuggestionId),
    index("clarification_requests_review_idx").on(table.humanReviewId),
    index("clarification_requests_assignee_idx").on(table.assignedToUserId),
    index("clarification_requests_subject_status_idx").on(table.subjectType, table.status),
  ],
);

export type PromptVersion = typeof promptVersionsTable.$inferSelect;
export type InsertPromptVersion = typeof promptVersionsTable.$inferInsert;
export type AnalysisRun = typeof analysisRunsTable.$inferSelect;
export type InsertAnalysisRun = typeof analysisRunsTable.$inferInsert;
export type AiModelRun = typeof aiModelRunsTable.$inferSelect;
export type InsertAiModelRun = typeof aiModelRunsTable.$inferInsert;
export type AiClaim = typeof aiClaimsTable.$inferSelect;
export type InsertAiClaim = typeof aiClaimsTable.$inferInsert;
export type ClaimEvidenceLink = typeof claimEvidenceLinksTable.$inferSelect;
export type InsertClaimEvidenceLink = typeof claimEvidenceLinksTable.$inferInsert;
export type DescriptorImprovementSuggestion = typeof descriptorImprovementSuggestionsTable.$inferSelect;
export type InsertDescriptorImprovementSuggestion = typeof descriptorImprovementSuggestionsTable.$inferInsert;
export type HumanReview = typeof humanReviewsTable.$inferSelect;
export type InsertHumanReview = typeof humanReviewsTable.$inferInsert;
export type ClarificationRequest = typeof clarificationRequestsTable.$inferSelect;
export type InsertClarificationRequest = typeof clarificationRequestsTable.$inferInsert;
