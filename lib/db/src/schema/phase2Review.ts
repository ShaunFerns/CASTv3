import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { aiClaimsTable, humanReviewsTable } from "./phase2Analysis";
import { institutionMembershipsTable, usersTable } from "./phase2Access";
import { programmeVersionsTable } from "./phase2Curriculum";
import {
  actionPlanItemStatusEnum,
  actionPlanMilestoneStatusEnum,
  actionPlanPriorityEnum,
  actionPlanStatusEnum,
  readinessAssessmentStatusEnum,
  readinessItemStatusEnum,
  readinessRatingEnum,
  reviewAssignmentRoleEnum,
  reviewAssignmentStatusEnum,
  reviewCycleStatusEnum,
  reviewCycleTypeEnum,
  reviewExportFormatEnum,
  reviewExportStatusEnum,
  swotItemStatusEnum,
  swotItemTypeEnum,
} from "./phase2Enums";
import {
  competenciesTable,
  evidenceItemsTable,
  programmeGraduateAttributesTable,
} from "./phase2Evidence";
import { frameworkVersionsTable } from "./phase2Frameworks";
import { lensVersionsTable } from "./phase2Lenses";
import { institutionPriorityVersionsTable } from "./phase2Priorities";
import { programmeMapCellsTable, programmeMapsTable } from "./phase2ProgrammeMaps";
import { institutionsTable } from "./phase2Tenancy";
import { modulesTable } from "./phase2Curriculum";

export const reviewCyclesTable = pgTable(
  "review_cycles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutionsTable.id, { onDelete: "cascade" }),
    programmeVersionId: uuid("programme_version_id").references(
      () => programmeVersionsTable.id,
      { onDelete: "set null" },
    ),
    institutionPriorityVersionId: uuid(
      "institution_priority_version_id",
    ).references(() => institutionPriorityVersionsTable.id, {
      onDelete: "set null",
    }),
    cycleType: reviewCycleTypeEnum("cycle_type").notNull(),
    status: reviewCycleStatusEnum("status").notNull().default("draft"),
    title: text("title").notNull(),
    description: text("description"),
    methodology: text("methodology"),
    ownerMembershipId: uuid("owner_membership_id").references(
      () => institutionMembershipsTable.id,
      { onDelete: "set null" },
    ),
    approvedByMembershipId: uuid("approved_by_membership_id").references(
      () => institutionMembershipsTable.id,
      { onDelete: "set null" },
    ),
    plannedStartAt: timestamp("planned_start_at", { withTimezone: true }),
    plannedEndAt: timestamp("planned_end_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
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
    index("review_cycles_institution_idx").on(table.institutionId),
    index("review_cycles_programme_idx").on(table.programmeVersionId),
    index("review_cycles_priority_idx").on(table.institutionPriorityVersionId),
    index("review_cycles_type_status_idx").on(table.cycleType, table.status),
    index("review_cycles_owner_idx").on(table.ownerMembershipId),
  ],
);

export const reviewAssignmentsTable = pgTable(
  "review_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reviewCycleId: uuid("review_cycle_id")
      .notNull()
      .references(() => reviewCyclesTable.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => institutionMembershipsTable.id, {
        onDelete: "cascade",
      }),
    role: reviewAssignmentRoleEnum("role").notNull(),
    status: reviewAssignmentStatusEnum("status").notNull().default("invited"),
    responsibilities: text("responsibilities"),
    isRequired: boolean("is_required").notNull().default(true),
    dueAt: timestamp("due_at", { withTimezone: true }),
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
    uniqueIndex("review_assignments_cycle_membership_role_unique").on(
      table.reviewCycleId,
      table.membershipId,
      table.role,
    ),
    index("review_assignments_membership_idx").on(table.membershipId),
    index("review_assignments_role_status_idx").on(table.role, table.status),
  ],
);

export const reviewCycleParticipantsTable = pgTable(
  "review_cycle_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reviewCycleId: uuid("review_cycle_id")
      .notNull()
      .references(() => reviewCyclesTable.id, { onDelete: "cascade" }),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutionsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    role: text("role").notNull(),
    status: text("status").notNull().default("active"),
    comments: text("comments"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
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
    index("review_cycle_participants_cycle_idx").on(table.reviewCycleId),
    index("review_cycle_participants_institution_idx").on(table.institutionId),
    index("review_cycle_participants_role_status_idx").on(table.role, table.status),
  ],
);

export const reviewNotesTable = pgTable(
  "review_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutionsTable.id, { onDelete: "cascade" }),
    reviewCycleId: uuid("review_cycle_id")
      .notNull()
      .references(() => reviewCyclesTable.id, { onDelete: "cascade" }),
    programmeVersionId: uuid("programme_version_id").references(
      () => programmeVersionsTable.id,
      { onDelete: "set null" },
    ),
    moduleId: uuid("module_id").references(() => modulesTable.id, {
      onDelete: "set null",
    }),
    aiClaimId: uuid("ai_claim_id").references(() => aiClaimsTable.id, {
      onDelete: "set null",
    }),
    humanReviewId: uuid("human_review_id").references(() => humanReviewsTable.id, {
      onDelete: "set null",
    }),
    programmeMapId: uuid("programme_map_id").references(() => programmeMapsTable.id, {
      onDelete: "set null",
    }),
    programmeMapCellId: uuid("programme_map_cell_id").references(() => programmeMapCellsTable.id, {
      onDelete: "set null",
    }),
    noteType: text("note_type").notNull().default("observation"),
    title: text("title"),
    body: text("body").notNull(),
    visibility: text("visibility").notNull().default("review_team"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
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
    index("review_notes_institution_idx").on(table.institutionId),
    index("review_notes_cycle_idx").on(table.reviewCycleId),
    index("review_notes_programme_idx").on(table.programmeVersionId),
    index("review_notes_module_idx").on(table.moduleId),
    index("review_notes_claim_idx").on(table.aiClaimId),
    index("review_notes_human_review_idx").on(table.humanReviewId),
    index("review_notes_map_idx").on(table.programmeMapId),
    index("review_notes_map_cell_idx").on(table.programmeMapCellId),
    index("review_notes_type_idx").on(table.noteType),
  ],
);

export const readinessAssessmentsTable = pgTable(
  "readiness_assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutionsTable.id, { onDelete: "cascade" }),
    reviewCycleId: uuid("review_cycle_id")
      .notNull()
      .references(() => reviewCyclesTable.id, { onDelete: "cascade" }),
    programmeVersionId: uuid("programme_version_id").references(
      () => programmeVersionsTable.id,
      { onDelete: "set null" },
    ),
    lensVersionId: uuid("lens_version_id").references(
      () => lensVersionsTable.id,
      { onDelete: "set null" },
    ),
    frameworkVersionId: uuid("framework_version_id").references(
      () => frameworkVersionsTable.id,
      { onDelete: "set null" },
    ),
    institutionPriorityVersionId: uuid(
      "institution_priority_version_id",
    ).references(() => institutionPriorityVersionsTable.id, {
      onDelete: "set null",
    }),
    status: readinessAssessmentStatusEnum("status").notNull().default("draft"),
    title: text("title").notNull(),
    summary: text("summary"),
    overallRating: readinessRatingEnum("overall_rating")
      .notNull()
      .default("not_assessed"),
    methodology: text("methodology"),
    ownerMembershipId: uuid("owner_membership_id").references(
      () => institutionMembershipsTable.id,
      { onDelete: "set null" },
    ),
    approvedByMembershipId: uuid("approved_by_membership_id").references(
      () => institutionMembershipsTable.id,
      { onDelete: "set null" },
    ),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("readiness_assessments_institution_idx").on(table.institutionId),
    index("readiness_assessments_review_cycle_idx").on(table.reviewCycleId),
    index("readiness_assessments_programme_idx").on(table.programmeVersionId),
    index("readiness_assessments_lens_idx").on(table.lensVersionId),
    index("readiness_assessments_framework_idx").on(table.frameworkVersionId),
    index("readiness_assessments_priority_idx").on(
      table.institutionPriorityVersionId,
    ),
    index("readiness_assessments_status_idx").on(table.status),
  ],
);

export const readinessAssessmentItemsTable = pgTable(
  "readiness_assessment_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    readinessAssessmentId: uuid("readiness_assessment_id")
      .notNull()
      .references(() => readinessAssessmentsTable.id, { onDelete: "cascade" }),
    competencyId: uuid("competency_id").references(() => competenciesTable.id, {
      onDelete: "set null",
    }),
    programmeGraduateAttributeId: uuid(
      "programme_graduate_attribute_id",
    ).references(() => programmeGraduateAttributesTable.id, {
      onDelete: "set null",
    }),
    lensVersionId: uuid("lens_version_id").references(
      () => lensVersionsTable.id,
      { onDelete: "set null" },
    ),
    frameworkVersionId: uuid("framework_version_id").references(
      () => frameworkVersionsTable.id,
      { onDelete: "set null" },
    ),
    institutionPriorityVersionId: uuid(
      "institution_priority_version_id",
    ).references(() => institutionPriorityVersionsTable.id, {
      onDelete: "set null",
    }),
    criterionKey: text("criterion_key").notNull(),
    title: text("title").notNull(),
    finding: text("finding"),
    rationale: text("rationale"),
    rating: readinessRatingEnum("rating").notNull().default("not_assessed"),
    status: readinessItemStatusEnum("status").notNull().default("draft"),
    orderIndex: integer("order_index").notNull().default(0),
    scope: jsonb("scope")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    reviewedByMembershipId: uuid("reviewed_by_membership_id").references(
      () => institutionMembershipsTable.id,
      { onDelete: "set null" },
    ),
    approvedByMembershipId: uuid("approved_by_membership_id").references(
      () => institutionMembershipsTable.id,
      { onDelete: "set null" },
    ),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("readiness_items_assessment_criterion_unique").on(
      table.readinessAssessmentId,
      table.criterionKey,
    ),
    index("readiness_items_competency_idx").on(table.competencyId),
    index("readiness_items_attribute_idx").on(
      table.programmeGraduateAttributeId,
    ),
    index("readiness_items_lens_idx").on(table.lensVersionId),
    index("readiness_items_framework_idx").on(table.frameworkVersionId),
    index("readiness_items_priority_idx").on(
      table.institutionPriorityVersionId,
    ),
    index("readiness_items_rating_status_idx").on(table.rating, table.status),
  ],
);

export const readinessAssessmentItemEvidenceLinksTable = pgTable(
  "readiness_assessment_item_evidence_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    readinessAssessmentItemId: uuid("readiness_assessment_item_id")
      .notNull()
      .references(() => readinessAssessmentItemsTable.id, {
        onDelete: "cascade",
      }),
    evidenceItemId: uuid("evidence_item_id")
      .notNull()
      .references(() => evidenceItemsTable.id, { onDelete: "cascade" }),
    relationship: text("relationship").notNull().default("supports"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("readiness_item_evidence_unique").on(
      table.readinessAssessmentItemId,
      table.evidenceItemId,
    ),
    index("readiness_item_evidence_evidence_idx").on(table.evidenceItemId),
  ],
);

export const readinessAssessmentItemClaimLinksTable = pgTable(
  "readiness_assessment_item_claim_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    readinessAssessmentItemId: uuid("readiness_assessment_item_id")
      .notNull()
      .references(() => readinessAssessmentItemsTable.id, {
        onDelete: "cascade",
      }),
    aiClaimId: uuid("ai_claim_id")
      .notNull()
      .references(() => aiClaimsTable.id, { onDelete: "cascade" }),
    relationship: text("relationship").notNull().default("informs"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("readiness_item_claim_unique").on(
      table.readinessAssessmentItemId,
      table.aiClaimId,
    ),
    index("readiness_item_claim_claim_idx").on(table.aiClaimId),
  ],
);

export const swotItemsTable = pgTable(
  "swot_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutionsTable.id, { onDelete: "cascade" }),
    reviewCycleId: uuid("review_cycle_id")
      .notNull()
      .references(() => reviewCyclesTable.id, { onDelete: "cascade" }),
    programmeVersionId: uuid("programme_version_id").references(
      () => programmeVersionsTable.id,
      { onDelete: "set null" },
    ),
    itemType: swotItemTypeEnum("item_type").notNull(),
    status: swotItemStatusEnum("status").notNull().default("draft"),
    title: text("title").notNull(),
    description: text("description"),
    rationale: text("rationale"),
    ownerMembershipId: uuid("owner_membership_id").references(
      () => institutionMembershipsTable.id,
      { onDelete: "set null" },
    ),
    impact: integer("impact"),
    likelihood: integer("likelihood"),
    approvedByMembershipId: uuid("approved_by_membership_id").references(
      () => institutionMembershipsTable.id,
      { onDelete: "set null" },
    ),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("swot_items_institution_idx").on(table.institutionId),
    index("swot_items_review_cycle_idx").on(table.reviewCycleId),
    index("swot_items_programme_idx").on(table.programmeVersionId),
    index("swot_items_type_status_idx").on(table.itemType, table.status),
  ],
);

export const swotItemEvidenceLinksTable = pgTable(
  "swot_item_evidence_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    swotItemId: uuid("swot_item_id")
      .notNull()
      .references(() => swotItemsTable.id, { onDelete: "cascade" }),
    evidenceItemId: uuid("evidence_item_id")
      .notNull()
      .references(() => evidenceItemsTable.id, { onDelete: "cascade" }),
    relationship: text("relationship").notNull().default("informs"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("swot_item_evidence_unique").on(
      table.swotItemId,
      table.evidenceItemId,
    ),
    index("swot_item_evidence_evidence_idx").on(table.evidenceItemId),
  ],
);

export const swotItemClaimLinksTable = pgTable(
  "swot_item_claim_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    swotItemId: uuid("swot_item_id")
      .notNull()
      .references(() => swotItemsTable.id, { onDelete: "cascade" }),
    aiClaimId: uuid("ai_claim_id")
      .notNull()
      .references(() => aiClaimsTable.id, { onDelete: "cascade" }),
    relationship: text("relationship").notNull().default("informs"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("swot_item_claim_unique").on(table.swotItemId, table.aiClaimId),
    index("swot_item_claim_claim_idx").on(table.aiClaimId),
  ],
);

export const swotItemHumanReviewLinksTable = pgTable(
  "swot_item_human_review_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    swotItemId: uuid("swot_item_id")
      .notNull()
      .references(() => swotItemsTable.id, { onDelete: "cascade" }),
    humanReviewId: uuid("human_review_id")
      .notNull()
      .references(() => humanReviewsTable.id, { onDelete: "cascade" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("swot_item_human_review_unique").on(
      table.swotItemId,
      table.humanReviewId,
    ),
    index("swot_item_human_review_review_idx").on(table.humanReviewId),
  ],
);

export const swotItemProgrammeMapLinksTable = pgTable(
  "swot_item_programme_map_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    swotItemId: uuid("swot_item_id")
      .notNull()
      .references(() => swotItemsTable.id, { onDelete: "cascade" }),
    programmeMapId: uuid("programme_map_id")
      .notNull()
      .references(() => programmeMapsTable.id, { onDelete: "cascade" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("swot_item_programme_map_unique").on(
      table.swotItemId,
      table.programmeMapId,
    ),
    index("swot_item_programme_map_map_idx").on(table.programmeMapId),
  ],
);

export const swotItemCompetencyLinksTable = pgTable(
  "swot_item_competency_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    swotItemId: uuid("swot_item_id")
      .notNull()
      .references(() => swotItemsTable.id, { onDelete: "cascade" }),
    competencyId: uuid("competency_id")
      .notNull()
      .references(() => competenciesTable.id, { onDelete: "cascade" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("swot_item_competency_unique").on(
      table.swotItemId,
      table.competencyId,
    ),
    index("swot_item_competency_competency_idx").on(table.competencyId),
  ],
);

export const swotItemPriorityLinksTable = pgTable(
  "swot_item_priority_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    swotItemId: uuid("swot_item_id")
      .notNull()
      .references(() => swotItemsTable.id, { onDelete: "cascade" }),
    institutionPriorityVersionId: uuid("institution_priority_version_id")
      .notNull()
      .references(() => institutionPriorityVersionsTable.id, {
        onDelete: "cascade",
      }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("swot_item_priority_unique").on(
      table.swotItemId,
      table.institutionPriorityVersionId,
    ),
    index("swot_item_priority_priority_idx").on(
      table.institutionPriorityVersionId,
    ),
  ],
);

export const swotItemReadinessLinksTable = pgTable(
  "swot_item_readiness_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    swotItemId: uuid("swot_item_id")
      .notNull()
      .references(() => swotItemsTable.id, { onDelete: "cascade" }),
    readinessAssessmentItemId: uuid("readiness_assessment_item_id")
      .notNull()
      .references(() => readinessAssessmentItemsTable.id, {
        onDelete: "cascade",
      }),
    relationship: text("relationship").notNull().default("informs"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("swot_item_readiness_unique").on(
      table.swotItemId,
      table.readinessAssessmentItemId,
    ),
    index("swot_item_readiness_readiness_idx").on(
      table.readinessAssessmentItemId,
    ),
  ],
);

export const swotItemReviewNoteLinksTable = pgTable(
  "swot_item_review_note_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    swotItemId: uuid("swot_item_id")
      .notNull()
      .references(() => swotItemsTable.id, { onDelete: "cascade" }),
    reviewNoteId: uuid("review_note_id")
      .notNull()
      .references(() => reviewNotesTable.id, { onDelete: "cascade" }),
    relationship: text("relationship").notNull().default("informs"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("swot_item_review_note_unique").on(
      table.swotItemId,
      table.reviewNoteId,
    ),
    index("swot_item_review_note_note_idx").on(table.reviewNoteId),
  ],
);

export const actionPlansTable = pgTable(
  "action_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutionsTable.id, { onDelete: "cascade" }),
    reviewCycleId: uuid("review_cycle_id")
      .notNull()
      .references(() => reviewCyclesTable.id, { onDelete: "cascade" }),
    programmeVersionId: uuid("programme_version_id").references(
      () => programmeVersionsTable.id,
      { onDelete: "set null" },
    ),
    title: text("title").notNull(),
    description: text("description"),
    status: actionPlanStatusEnum("status").notNull().default("draft"),
    ownerMembershipId: uuid("owner_membership_id").references(
      () => institutionMembershipsTable.id,
      { onDelete: "set null" },
    ),
    indicatorsOfSuccess: text("indicators_of_success"),
    startAt: timestamp("start_at", { withTimezone: true }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    approvedByMembershipId: uuid("approved_by_membership_id").references(
      () => institutionMembershipsTable.id,
      { onDelete: "set null" },
    ),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("action_plans_institution_idx").on(table.institutionId),
    index("action_plans_review_cycle_idx").on(table.reviewCycleId),
    index("action_plans_programme_idx").on(table.programmeVersionId),
    index("action_plans_status_idx").on(table.status),
    index("action_plans_owner_idx").on(table.ownerMembershipId),
  ],
);

export const actionPlanItemsTable = pgTable(
  "action_plan_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actionPlanId: uuid("action_plan_id")
      .notNull()
      .references(() => actionPlansTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: actionPlanItemStatusEnum("status").notNull().default("not_started"),
    priority: actionPlanPriorityEnum("priority").notNull().default("medium"),
    ownerMembershipId: uuid("owner_membership_id").references(
      () => institutionMembershipsTable.id,
      { onDelete: "set null" },
    ),
    timeframe: text("timeframe"),
    indicatorsOfSuccess: text("indicators_of_success"),
    orderIndex: integer("order_index").notNull().default(0),
    startAt: timestamp("start_at", { withTimezone: true }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    approvedByMembershipId: uuid("approved_by_membership_id").references(
      () => institutionMembershipsTable.id,
      { onDelete: "set null" },
    ),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("action_plan_items_plan_idx").on(table.actionPlanId),
    index("action_plan_items_status_priority_idx").on(
      table.status,
      table.priority,
    ),
    index("action_plan_items_owner_idx").on(table.ownerMembershipId),
    index("action_plan_items_due_idx").on(table.dueAt),
  ],
);

export const actionPlanItemPartnersTable = pgTable(
  "action_plan_item_partners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actionPlanItemId: uuid("action_plan_item_id")
      .notNull()
      .references(() => actionPlanItemsTable.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => institutionMembershipsTable.id, {
        onDelete: "cascade",
      }),
    role: text("role").notNull().default("partner"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("action_plan_item_partners_unique").on(
      table.actionPlanItemId,
      table.membershipId,
      table.role,
    ),
    index("action_plan_item_partners_membership_idx").on(table.membershipId),
  ],
);

export const actionPlanMilestonesTable = pgTable(
  "action_plan_milestones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actionPlanItemId: uuid("action_plan_item_id")
      .notNull()
      .references(() => actionPlanItemsTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: actionPlanMilestoneStatusEnum("status")
      .notNull()
      .default("not_started"),
    orderIndex: integer("order_index").notNull().default(0),
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("action_plan_milestones_item_idx").on(table.actionPlanItemId),
    index("action_plan_milestones_status_due_idx").on(
      table.status,
      table.dueAt,
    ),
  ],
);

export const actionPlanItemSwotLinksTable = pgTable(
  "action_plan_item_swot_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actionPlanItemId: uuid("action_plan_item_id")
      .notNull()
      .references(() => actionPlanItemsTable.id, { onDelete: "cascade" }),
    swotItemId: uuid("swot_item_id")
      .notNull()
      .references(() => swotItemsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("action_plan_item_swot_unique").on(
      table.actionPlanItemId,
      table.swotItemId,
    ),
    index("action_plan_item_swot_swot_idx").on(table.swotItemId),
  ],
);

export const actionPlanItemReadinessLinksTable = pgTable(
  "action_plan_item_readiness_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actionPlanItemId: uuid("action_plan_item_id")
      .notNull()
      .references(() => actionPlanItemsTable.id, { onDelete: "cascade" }),
    readinessAssessmentItemId: uuid("readiness_assessment_item_id")
      .notNull()
      .references(() => readinessAssessmentItemsTable.id, {
        onDelete: "cascade",
      }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("action_plan_item_readiness_unique").on(
      table.actionPlanItemId,
      table.readinessAssessmentItemId,
    ),
    index("action_plan_item_readiness_readiness_idx").on(
      table.readinessAssessmentItemId,
    ),
  ],
);

export const actionPlanEvidenceLinksTable = pgTable(
  "action_plan_evidence_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actionPlanItemId: uuid("action_plan_item_id")
      .notNull()
      .references(() => actionPlanItemsTable.id, { onDelete: "cascade" }),
    evidenceItemId: uuid("evidence_item_id")
      .notNull()
      .references(() => evidenceItemsTable.id, { onDelete: "cascade" }),
    relationship: text("relationship").notNull().default("informs"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("action_plan_evidence_unique").on(
      table.actionPlanItemId,
      table.evidenceItemId,
    ),
    index("action_plan_evidence_evidence_idx").on(table.evidenceItemId),
  ],
);

export const actionPlanItemPriorityLinksTable = pgTable(
  "action_plan_item_priority_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actionPlanItemId: uuid("action_plan_item_id")
      .notNull()
      .references(() => actionPlanItemsTable.id, { onDelete: "cascade" }),
    institutionPriorityVersionId: uuid("institution_priority_version_id")
      .notNull()
      .references(() => institutionPriorityVersionsTable.id, {
        onDelete: "cascade",
      }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("action_plan_item_priority_unique").on(
      table.actionPlanItemId,
      table.institutionPriorityVersionId,
    ),
    index("action_plan_item_priority_priority_idx").on(
      table.institutionPriorityVersionId,
    ),
  ],
);

export const actionPlanItemClaimLinksTable = pgTable(
  "action_plan_item_claim_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actionPlanItemId: uuid("action_plan_item_id")
      .notNull()
      .references(() => actionPlanItemsTable.id, { onDelete: "cascade" }),
    aiClaimId: uuid("ai_claim_id")
      .notNull()
      .references(() => aiClaimsTable.id, { onDelete: "cascade" }),
    relationship: text("relationship").notNull().default("informs"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("action_plan_item_claim_unique").on(
      table.actionPlanItemId,
      table.aiClaimId,
    ),
    index("action_plan_item_claim_claim_idx").on(table.aiClaimId),
  ],
);

export const actionPlanItemHumanReviewLinksTable = pgTable(
  "action_plan_item_human_review_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actionPlanItemId: uuid("action_plan_item_id")
      .notNull()
      .references(() => actionPlanItemsTable.id, { onDelete: "cascade" }),
    humanReviewId: uuid("human_review_id")
      .notNull()
      .references(() => humanReviewsTable.id, { onDelete: "cascade" }),
    relationship: text("relationship").notNull().default("informs"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("action_plan_item_human_review_unique").on(
      table.actionPlanItemId,
      table.humanReviewId,
    ),
    index("action_plan_item_human_review_review_idx").on(table.humanReviewId),
  ],
);

export const actionPlanItemReviewNoteLinksTable = pgTable(
  "action_plan_item_review_note_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actionPlanItemId: uuid("action_plan_item_id")
      .notNull()
      .references(() => actionPlanItemsTable.id, { onDelete: "cascade" }),
    reviewNoteId: uuid("review_note_id")
      .notNull()
      .references(() => reviewNotesTable.id, { onDelete: "cascade" }),
    relationship: text("relationship").notNull().default("informs"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("action_plan_item_review_note_unique").on(
      table.actionPlanItemId,
      table.reviewNoteId,
    ),
    index("action_plan_item_review_note_note_idx").on(table.reviewNoteId),
  ],
);

export const reviewExportsTable = pgTable(
  "review_exports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutionsTable.id, { onDelete: "cascade" }),
    reviewCycleId: uuid("review_cycle_id")
      .notNull()
      .references(() => reviewCyclesTable.id, { onDelete: "cascade" }),
    requestedByUserId: uuid("requested_by_user_id").references(
      () => usersTable.id,
      { onDelete: "set null" },
    ),
    format: reviewExportFormatEnum("format").notNull(),
    status: reviewExportStatusEnum("status").notNull().default("pending"),
    storageKey: text("storage_key"),
    errorMessage: text("error_message"),
    configuration: jsonb("configuration")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
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
    index("review_exports_institution_idx").on(table.institutionId),
    index("review_exports_review_cycle_idx").on(table.reviewCycleId),
    index("review_exports_status_idx").on(table.status),
  ],
);

export type ReviewCycle = typeof reviewCyclesTable.$inferSelect;
export type InsertReviewCycle = typeof reviewCyclesTable.$inferInsert;
export type ReviewAssignment = typeof reviewAssignmentsTable.$inferSelect;
export type InsertReviewAssignment = typeof reviewAssignmentsTable.$inferInsert;
export type ReviewCycleParticipant =
  typeof reviewCycleParticipantsTable.$inferSelect;
export type InsertReviewCycleParticipant =
  typeof reviewCycleParticipantsTable.$inferInsert;
export type ReviewNote = typeof reviewNotesTable.$inferSelect;
export type InsertReviewNote = typeof reviewNotesTable.$inferInsert;
export type ReadinessAssessment = typeof readinessAssessmentsTable.$inferSelect;
export type InsertReadinessAssessment =
  typeof readinessAssessmentsTable.$inferInsert;
export type ReadinessAssessmentItem =
  typeof readinessAssessmentItemsTable.$inferSelect;
export type InsertReadinessAssessmentItem =
  typeof readinessAssessmentItemsTable.$inferInsert;
export type SwotItem = typeof swotItemsTable.$inferSelect;
export type InsertSwotItem = typeof swotItemsTable.$inferInsert;
export type ActionPlan = typeof actionPlansTable.$inferSelect;
export type InsertActionPlan = typeof actionPlansTable.$inferInsert;
export type ActionPlanItem = typeof actionPlanItemsTable.$inferSelect;
export type InsertActionPlanItem = typeof actionPlanItemsTable.$inferInsert;
export type ActionPlanMilestone = typeof actionPlanMilestonesTable.$inferSelect;
export type InsertActionPlanMilestone =
  typeof actionPlanMilestonesTable.$inferInsert;
export type ReviewExport = typeof reviewExportsTable.$inferSelect;
export type InsertReviewExport = typeof reviewExportsTable.$inferInsert;
