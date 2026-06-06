import { pgEnum } from "drizzle-orm/pg-core";

export const institutionStatusEnum = pgEnum("institution_status", [
  "active",
  "inactive",
  "suspended",
]);

export const userStatusEnum = pgEnum("user_status", [
  "invited",
  "active",
  "inactive",
  "suspended",
]);

export const membershipStatusEnum = pgEnum("membership_status", [
  "invited",
  "active",
  "inactive",
]);

export const roleScopeEnum = pgEnum("role_scope", [
  "platform",
  "institution",
  "programme",
]);

export const programmeMembershipRoleEnum = pgEnum(
  "programme_membership_role",
  [
    "programme_lead",
    "editor",
    "reviewer",
    "viewer",
    "external_contributor",
  ],
);

export const programmeMembershipStatusEnum = pgEnum(
  "programme_membership_status",
  ["invited", "active", "inactive", "completed", "removed"],
);

export const frameworkStatusEnum = pgEnum("framework_status", [
  "draft",
  "active",
  "retired",
]);

export const lensStatusEnum = pgEnum("lens_status", [
  "draft",
  "active",
  "retired",
]);

export const lensConfigurationScopeEnum = pgEnum("lens_configuration_scope", [
  "global",
  "institution",
  "programme",
]);

export const lensRuleTypeEnum = pgEnum("lens_rule_type", [
  "include",
  "exclude",
  "weight",
  "threshold",
  "prompt",
]);

export const programmeMapStatusEnum = pgEnum("programme_map_status", [
  "draft",
  "active",
  "archived",
]);

export const programmeMapLayerTypeEnum = pgEnum("programme_map_layer_type", [
  "framework",
  "lens",
  "institution_priority",
  "data_quality",
  "readiness",
  "custom",
]);

export const programmeMapCellStatusEnum = pgEnum("programme_map_cell_status", [
  "draft",
  "ai_generated",
  "human_reviewed",
  "approved",
]);

export const programmeMapExportFormatEnum = pgEnum(
  "programme_map_export_format",
  ["pdf", "xlsx", "csv", "png", "json"],
);

export const priorityStatusEnum = pgEnum("priority_status", [
  "draft",
  "active",
  "retired",
]);

export const priorityMappingTargetTypeEnum = pgEnum(
  "priority_mapping_target_type",
  [
    "framework",
    "framework_version",
    "lens",
    "programme",
    "programme_map",
    "module",
    "competency",
  ],
);

export const priorityExpectationLevelEnum = pgEnum(
  "priority_expectation_level",
  ["not_applicable", "introduce", "develop", "integrate", "demonstrate"],
);

export const auditActorTypeEnum = pgEnum("audit_actor_type", [
  "user",
  "system",
  "worker",
]);

export const auditSubjectTypeEnum = pgEnum("audit_subject_type", [
  "institution",
  "user",
  "source_system",
  "import_batch",
  "source_record",
  "source_programme",
  "source_module",
  "source_structure_item",
  "programme_version",
  "module",
  "module_descriptor",
  "descriptor_section",
  "curated_structure",
  "curated_structure_group",
  "curated_structure_item",
  "learning_outcome",
  "assessment_component",
  "document",
  "document_version",
  "document_section",
  "evidence_item",
  "competency_domain",
  "competency",
  "programme_graduate_attribute",
  "competency_evaluation",
  "analysis_run",
  "ai_model_run",
  "ai_claim",
  "human_review",
  "clarification_request",
  "descriptor_improvement_suggestion",
  "prompt_version",
  "review_cycle",
  "readiness_assessment",
  "readiness_assessment_item",
  "swot_item",
  "action_plan",
  "action_plan_item",
  "action_plan_milestone",
  "review_export",
  "data_quality_rule",
  "data_quality_run",
  "data_quality_result",
  "local_worker",
  "worker_job",
  "worker_job_artifact",
  "worker_sync_event",
  "ingestion_run",
  "ingestion_item",
  "ingestion_error",
  "app_session",
  "programme_membership",
  "framework",
  "lens",
  "programme_map",
  "institution_priority",
  "legacy_module_review",
  "legacy_programme",
  "legacy_programme_module",
  "legacy_ga_classification",
]);

export const sourceSystemTypeEnum = pgEnum("source_system_type", [
  "akari",
  "banner",
  "sits",
  "manual_upload",
  "api",
  "csv",
  "other",
]);

export const sourceSystemStatusEnum = pgEnum("source_system_status", [
  "active",
  "inactive",
  "archived",
]);

export const importBatchStatusEnum = pgEnum("import_batch_status", [
  "pending",
  "running",
  "completed",
  "completed_with_errors",
  "failed",
  "cancelled",
]);

export const importBatchTypeEnum = pgEnum("import_batch_type", [
  "programme_catalogue",
  "module_catalogue",
  "programme_structure",
  "document_set",
  "mixed",
]);

export const sourceRecordTypeEnum = pgEnum("source_record_type", [
  "programme",
  "module",
  "structure_item",
  "document",
  "other",
]);

export const sourceRecordStatusEnum = pgEnum("source_record_status", [
  "raw",
  "parsed",
  "reconciled",
  "ignored",
  "error",
]);

export const sourceStructureItemTypeEnum = pgEnum(
  "source_structure_item_type",
  ["module", "group", "choice", "pathway", "stage", "year", "other"],
);

export const reconciliationStatusEnum = pgEnum("reconciliation_status", [
  "candidate",
  "confirmed",
  "rejected",
  "superseded",
]);

export const reconciliationSourceTypeEnum = pgEnum(
  "reconciliation_source_type",
  [
    "source_record",
    "source_programme",
    "source_module",
    "source_structure_item",
  ],
);

export const reconciliationTargetTypeEnum = pgEnum(
  "reconciliation_target_type",
  [
    "legacy_programme",
    "legacy_module_review",
    "legacy_programme_module",
    "programme",
    "programme_version",
    "module",
    "module_descriptor",
    "curated_structure",
    "curated_structure_item",
    "document",
    "other",
  ],
);

export const curriculumVersionStatusEnum = pgEnum("curriculum_version_status", [
  "draft",
  "active",
  "archived",
  "superseded",
]);

export const moduleStatusEnum = pgEnum("module_status", [
  "draft",
  "active",
  "inactive",
  "archived",
]);

export const descriptorSectionTypeEnum = pgEnum("descriptor_section_type", [
  "aims",
  "learning_outcomes",
  "indicative_content",
  "teaching_and_learning_strategy",
  "assessment",
  "requisites",
  "resources",
  "graduate_attributes",
  "modality",
  "other",
]);

export const curatedStructureStatusEnum = pgEnum("curated_structure_status", [
  "draft",
  "active",
  "archived",
]);

export const curatedStructureGroupTypeEnum = pgEnum(
  "curated_structure_group_type",
  [
    "stage",
    "semester",
    "pathway",
    "option_group",
    "elective_group",
    "award_route",
    "custom",
  ],
);

export const curatedStructureItemTypeEnum = pgEnum(
  "curated_structure_item_type",
  ["module", "placeholder", "choice", "note"],
);

export const coreOptionStatusEnum = pgEnum("core_option_status", [
  "core",
  "option",
  "elective",
  "required",
  "optional",
  "unknown",
]);

export const learningOutcomeStatusEnum = pgEnum("learning_outcome_status", [
  "draft",
  "active",
  "archived",
]);

export const assessmentComponentStatusEnum = pgEnum(
  "assessment_component_status",
  ["draft", "active", "archived"],
);

export const documentStatusEnum = pgEnum("document_status", [
  "draft",
  "active",
  "archived",
]);

export const documentTypeEnum = pgEnum("document_type", [
  "programme_specification",
  "module_descriptor",
  "validation_document",
  "accreditation_document",
  "review_report",
  "policy",
  "strategy",
  "assessment_document",
  "other",
]);

export const documentSectionTypeEnum = pgEnum("document_section_type", [
  "heading",
  "paragraph",
  "table",
  "list",
  "appendix",
  "other",
]);

export const evidenceSourceKindEnum = pgEnum("evidence_source_kind", [
  "document_section",
  "descriptor_section",
  "learning_outcome",
  "assessment_component",
  "extracted_text",
  "manual",
  "other",
]);

export const evidenceItemStatusEnum = pgEnum("evidence_item_status", [
  "extracted",
  "reviewed",
  "accepted",
  "rejected",
  "archived",
]);

export const scaffoldingLevelEnum = pgEnum("scaffolding_level", [
  "not_applicable",
  "introduce",
  "develop",
  "integrate",
  "demonstrate",
]);

export const expectationScopeEnum = pgEnum("expectation_scope", [
  "programme",
  "stage",
  "semester",
  "pathway",
  "module_group",
  "module",
]);

export const graduateAttributeStatusEnum = pgEnum("graduate_attribute_status", [
  "draft",
  "active",
  "archived",
]);

export const competencyEvaluationSourceEnum = pgEnum(
  "competency_evaluation_source",
  ["ai", "human", "rule", "import"],
);

export const competencyEvaluationStatusEnum = pgEnum(
  "competency_evaluation_status",
  ["draft", "needs_review", "reviewed", "rejected", "superseded"],
);

export const analysisRunTypeEnum = pgEnum("analysis_run_type", [
  "evidence_extraction",
  "framework_analysis",
  "competency_analysis",
  "descriptor_review",
  "descriptor_improvement",
  "readiness_analysis",
  "other",
]);

export const analysisRunStatusEnum = pgEnum("analysis_run_status", [
  "pending",
  "running",
  "completed",
  "completed_with_errors",
  "failed",
  "cancelled",
]);

export const promptVersionStatusEnum = pgEnum("prompt_version_status", [
  "draft",
  "active",
  "retired",
]);

export const aiModelRunStatusEnum = pgEnum("ai_model_run_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const aiClaimTypeEnum = pgEnum("ai_claim_type", [
  "competency_observation",
  "strength",
  "gap",
  "recommendation",
  "descriptor_issue",
  "readiness_observation",
  "other",
]);

export const aiClaimStatusEnum = pgEnum("ai_claim_status", [
  "draft",
  "needs_review",
  "accepted",
  "rejected",
  "amended",
  "superseded",
]);

export const humanReviewDecisionEnum = pgEnum("human_review_decision", [
  "accept",
  "reject",
  "amend",
  "request_clarification",
  "not_applicable",
]);

export const humanReviewSubjectTypeEnum = pgEnum("human_review_subject_type", [
  "ai_claim",
  "descriptor_improvement_suggestion",
]);

export const clarificationStatusEnum = pgEnum("clarification_status", [
  "open",
  "answered",
  "resolved",
  "cancelled",
]);

export const clarificationSubjectTypeEnum = pgEnum(
  "clarification_subject_type",
  ["ai_claim", "descriptor_improvement_suggestion"],
);

export const descriptorSuggestionTypeEnum = pgEnum(
  "descriptor_suggestion_type",
  [
    "improve_clarity",
    "strengthen_evidence",
    "align_competency",
    "improve_scaffolding",
    "improve_assessment",
    "improve_udl",
    "improve_modality",
    "other",
  ],
);

export const descriptorSuggestionStatusEnum = pgEnum(
  "descriptor_suggestion_status",
  ["draft", "needs_review", "accepted", "rejected", "exported", "superseded"],
);

export const reviewCycleTypeEnum = pgEnum("review_cycle_type", [
  "programme_review",
  "validation",
  "revalidation",
  "accreditation",
  "delta_readiness",
  "institutional_priority_review",
  "other",
]);

export const reviewCycleStatusEnum = pgEnum("review_cycle_status", [
  "draft",
  "planned",
  "active",
  "awaiting_approval",
  "approved",
  "completed",
  "cancelled",
  "archived",
]);

export const reviewAssignmentRoleEnum = pgEnum("review_assignment_role", [
  "owner",
  "lead",
  "contributor",
  "reviewer",
  "approver",
  "external_reviewer",
  "observer",
]);

export const reviewAssignmentStatusEnum = pgEnum("review_assignment_status", [
  "invited",
  "active",
  "completed",
  "declined",
  "removed",
]);

export const readinessAssessmentStatusEnum = pgEnum(
  "readiness_assessment_status",
  [
    "draft",
    "in_progress",
    "awaiting_review",
    "reviewed",
    "approved",
    "archived",
  ],
);

export const readinessRatingEnum = pgEnum("readiness_rating", [
  "not_assessed",
  "emerging",
  "developing",
  "established",
  "leading",
  "not_applicable",
]);

export const readinessItemStatusEnum = pgEnum("readiness_item_status", [
  "draft",
  "needs_evidence",
  "needs_review",
  "reviewed",
  "approved",
  "not_applicable",
]);

export const swotItemTypeEnum = pgEnum("swot_item_type", [
  "strength",
  "weakness",
  "opportunity",
  "threat",
]);

export const swotItemStatusEnum = pgEnum("swot_item_status", [
  "draft",
  "reviewed",
  "approved",
  "archived",
]);

export const actionPlanStatusEnum = pgEnum("action_plan_status", [
  "draft",
  "active",
  "awaiting_approval",
  "approved",
  "completed",
  "cancelled",
  "archived",
]);

export const actionPlanItemStatusEnum = pgEnum("action_plan_item_status", [
  "not_started",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
]);

export const actionPlanPriorityEnum = pgEnum("action_plan_priority", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const actionPlanMilestoneStatusEnum = pgEnum(
  "action_plan_milestone_status",
  ["not_started", "in_progress", "completed", "missed", "cancelled"],
);

export const reviewExportFormatEnum = pgEnum("review_export_format", [
  "pdf",
  "docx",
  "xlsx",
  "csv",
  "json",
]);

export const reviewExportStatusEnum = pgEnum("review_export_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

export const dataQualityRuleStatusEnum = pgEnum("data_quality_rule_status", [
  "draft",
  "active",
  "retired",
]);

export const dataQualityCategoryEnum = pgEnum("data_quality_category", [
  "completeness",
  "consistency",
  "integrity",
  "timeliness",
  "duplication",
  "mapping",
  "assessment",
  "other",
]);

export const dataQualitySeverityEnum = pgEnum("data_quality_severity", [
  "info",
  "warning",
  "error",
  "critical",
]);

export const dataQualityRunStatusEnum = pgEnum("data_quality_run_status", [
  "pending",
  "running",
  "completed",
  "completed_with_issues",
  "failed",
  "cancelled",
]);

export const dataQualityRunTriggerEnum = pgEnum("data_quality_run_trigger", [
  "manual",
  "import",
  "scheduled",
  "worker",
  "api",
  "system",
]);

export const dataQualityResultStatusEnum = pgEnum(
  "data_quality_result_status",
  [
    "open",
    "acknowledged",
    "resolved",
    "accepted_risk",
    "false_positive",
    "superseded",
  ],
);

export const localWorkerStatusEnum = pgEnum("local_worker_status", [
  "pending",
  "active",
  "offline",
  "disabled",
  "revoked",
]);

export const workerConnectionModeEnum = pgEnum("worker_connection_mode", [
  "pull",
  "callback",
  "hybrid",
]);

export const workerJobTypeEnum = pgEnum("worker_job_type", [
  "document_extraction",
  "embeddings",
  "ai_classification",
  "batch_analysis",
  "data_quality",
  "other",
]);

export const workerJobStatusEnum = pgEnum("worker_job_status", [
  "queued",
  "claimed",
  "running",
  "syncing",
  "completed",
  "failed",
  "cancelled",
  "expired",
]);

export const workerDataHandlingModeEnum = pgEnum("worker_data_handling_mode", [
  "cloud_allowed",
  "local_preferred",
  "local_required",
  "restricted",
]);

export const workerArtifactTypeEnum = pgEnum("worker_artifact_type", [
  "input",
  "output",
  "log",
  "manifest",
  "extracted_text",
  "embedding",
  "classification",
  "report",
  "other",
]);

export const workerArtifactLocationEnum = pgEnum("worker_artifact_location", [
  "local_worker",
  "cast_managed",
  "institution_managed",
  "external",
]);

export const workerSyncDirectionEnum = pgEnum("worker_sync_direction", [
  "worker_to_cast",
  "cast_to_worker",
]);

export const workerSyncEventTypeEnum = pgEnum("worker_sync_event_type", [
  "job_claimed",
  "heartbeat",
  "progress",
  "artifact_registered",
  "result_uploaded",
  "job_completed",
  "job_failed",
  "sync_error",
  "other",
]);

export const workerSyncEventStatusEnum = pgEnum("worker_sync_event_status", [
  "pending",
  "accepted",
  "rejected",
  "failed",
]);
