import { pgTable, text, serial, timestamp, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const moduleReviewsTable = pgTable("module_reviews", {
  id: serial("id").primaryKey(),
  moduleCode: text("module_code").notNull(),
  moduleTitle: text("module_title").notNull(),
  sourceType: text("source_type").notNull(),
  sourceFileName: text("source_file_name"),
  rawText: text("raw_text"),
  overview: text("overview"),
  learningOutcomes: text("learning_outcomes"),
  indicativeSyllabus: text("indicative_syllabus"),
  teachingMethods: text("teaching_methods"),

  primarySarAi: text("primary_sar_ai"),
  secondarySarAi: text("secondary_sar_ai"),
  sarConfidence: text("sar_confidence"),
  sarRationale: text("sar_rationale"),
  selectedSarFinal: text("selected_sar_final"),

  criterion1Name: text("criterion_1_name"),
  criterion1ScoreAi: real("criterion_1_score_ai"),
  criterion1RationaleAi: text("criterion_1_rationale_ai"),
  criterion1ScoreFinal: real("criterion_1_score_final"),

  criterion2Name: text("criterion_2_name"),
  criterion2ScoreAi: real("criterion_2_score_ai"),
  criterion2RationaleAi: text("criterion_2_rationale_ai"),
  criterion2ScoreFinal: real("criterion_2_score_final"),

  criterion3Name: text("criterion_3_name"),
  criterion3ScoreAi: real("criterion_3_score_ai"),
  criterion3RationaleAi: text("criterion_3_rationale_ai"),
  criterion3ScoreFinal: real("criterion_3_score_final"),

  criterion4Name: text("criterion_4_name"),
  criterion4ScoreAi: real("criterion_4_score_ai"),
  criterion4RationaleAi: text("criterion_4_rationale_ai"),
  criterion4ScoreFinal: real("criterion_4_score_final"),

  criterion5Name: text("criterion_5_name"),
  criterion5ScoreAi: real("criterion_5_score_ai"),
  criterion5RationaleAi: text("criterion_5_rationale_ai"),
  criterion5ScoreFinal: real("criterion_5_score_final"),

  averageScoreAi: real("average_score_ai"),
  averageScoreFinal: real("average_score_final"),
  overallCommentAi: text("overall_comment_ai"),
  overallCommentFinal: text("overall_comment_final"),
  suitabilityNoteAi: text("suitability_note_ai"),
  suitabilityNoteFinal: text("suitability_note_final"),
  reviewerNote: text("reviewer_note"),

  stageInferred: text("stage_inferred"),
  credits: text("credits"),
  semester: text("semester"),
  campus: text("campus"),
  scoreBand: text("score_band"),
  reviewStatus: text("review_status").notNull().default("pending"),

  school: text("school"),
  disciplineFamily: text("discipline_family"),
  accessibilityScoreAi: real("accessibility_score_ai"),
  stageAppropriatenessScoreAi: real("stage_appropriateness_score_ai"),
  breadthTransferabilityScoreAi: real("breadth_transferability_score_ai"),
  freeElectiveAverageAi: real("free_elective_average_ai"),
  freeElectiveBandAi: text("free_elective_band_ai"),
  tagExplore: boolean("tag_explore"),
  tagUsefulSkills: boolean("tag_useful_skills"),
  tagPathwaySupport: boolean("tag_pathway_support"),
  freeElectiveRationaleAi: text("free_elective_rationale_ai"),
  freeElectiveProcessedAt: timestamp("free_elective_processed_at", { withTimezone: true }),

  constraints: text("constraints"),
  assessmentText: text("assessment_text"),
  requisitesStatus: text("requisites_status"),
  requisitesRaw: text("requisites_raw"),
  embedding: text("embedding"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertModuleReviewSchema = createInsertSchema(moduleReviewsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertModuleReview = z.infer<typeof insertModuleReviewSchema>;
export type ModuleReview = typeof moduleReviewsTable.$inferSelect;
