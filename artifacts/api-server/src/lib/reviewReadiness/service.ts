import { and, desc, eq, inArray } from "drizzle-orm";
import {
  assessmentComponentsTable,
  db,
  moduleDescriptorsTable,
  readinessAssessmentItemsTable,
  readinessAssessmentsTable,
  reviewCycleParticipantsTable,
  reviewCyclesTable,
  reviewExportsTable,
  reviewNotesTable,
  type ReviewCycle,
} from "@workspace/db";
import { getCuratedStructure, getProgrammeOverview } from "../programmeWorkspace/service.js";

type ActorContext = {
  institutionId: string;
  userId?: string;
};

type ReadinessRating = "not_assessed" | "emerging" | "developing" | "established";
type ReviewCycleStatus = "draft" | "planned" | "active" | "completed" | "archived" | "cancelled";
type ReviewCycleType =
  | "programme_review"
  | "validation"
  | "revalidation"
  | "accreditation"
  | "delta_readiness"
  | "institutional_priority_review"
  | "other";

type ReadinessArea = {
  key: string;
  title: string;
  rating: ReadinessRating;
  statusLabel: string;
  strengths: string[];
  gaps: string[];
  observations: string[];
  evidenceReferences: Array<{ type: string; label: string; count?: number }>;
  metrics: Record<string, number>;
};

const reviewTypeLabels: Record<ReviewCycleType, string> = {
  programme_review: "Programme Review",
  validation: "Validation",
  revalidation: "Revalidation",
  accreditation: "Accreditation",
  delta_readiness: "DELTA Readiness",
  institutional_priority_review: "Institutional Priority Review",
  other: "Internal Enhancement Review",
};

function parseDate(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function ratingLabel(rating: ReadinessRating) {
  const labels: Record<ReadinessRating, string> = {
    not_assessed: "Not Started",
    emerging: "Emerging",
    developing: "Developing",
    established: "Established",
  };
  return labels[rating];
}

function ratioRating(numerator: number, denominator: number, thresholds = { emerging: 0.25, developing: 0.6, established: 0.85 }): ReadinessRating {
  if (denominator <= 0 || numerator <= 0) return "not_assessed";
  const ratio = numerator / denominator;
  if (ratio >= thresholds.established) return "established";
  if (ratio >= thresholds.developing) return "developing";
  if (ratio >= thresholds.emerging) return "emerging";
  return "not_assessed";
}

function weakestRating(ratings: ReadinessRating[]): ReadinessRating {
  const order: ReadinessRating[] = ["not_assessed", "emerging", "developing", "established"];
  return ratings.reduce((weakest, rating) => (order.indexOf(rating) < order.indexOf(weakest) ? rating : weakest), "established" as ReadinessRating);
}

function area(
  key: string,
  title: string,
  rating: ReadinessRating,
  strengths: string[],
  gaps: string[],
  observations: string[],
  evidenceReferences: ReadinessArea["evidenceReferences"],
  metrics: Record<string, number>,
): ReadinessArea {
  return {
    key,
    title,
    rating,
    statusLabel: ratingLabel(rating),
    strengths,
    gaps,
    observations,
    evidenceReferences,
    metrics,
  };
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function listReviewCycles(context: ActorContext, programmeVersionId?: string) {
  const cycles = await db
    .select()
    .from(reviewCyclesTable)
    .where(and(
      eq(reviewCyclesTable.institutionId, context.institutionId),
      programmeVersionId ? eq(reviewCyclesTable.programmeVersionId, programmeVersionId) : undefined,
    ))
    .orderBy(desc(reviewCyclesTable.createdAt));

  const cycleIds = cycles.map((cycle) => cycle.id);
  const [participants, notes, assessments] = cycleIds.length
    ? await Promise.all([
        db.select().from(reviewCycleParticipantsTable).where(inArray(reviewCycleParticipantsTable.reviewCycleId, cycleIds)),
        db.select().from(reviewNotesTable).where(inArray(reviewNotesTable.reviewCycleId, cycleIds)),
        db.select().from(readinessAssessmentsTable).where(inArray(readinessAssessmentsTable.reviewCycleId, cycleIds)),
      ])
    : [[], [], []];

  return {
    reviewCycles: cycles.map((cycle) => ({
      ...cycle,
      typeLabel: reviewTypeLabels[cycle.cycleType as ReviewCycleType] ?? cycle.cycleType,
      participantCount: participants.filter((participant) => participant.reviewCycleId === cycle.id).length,
      noteCount: notes.filter((note) => note.reviewCycleId === cycle.id).length,
      readinessAssessmentCount: assessments.filter((assessment) => assessment.reviewCycleId === cycle.id).length,
    })),
  };
}

export async function getReviewCycle(context: ActorContext, reviewCycleId: string) {
  const [cycle] = await db
    .select()
    .from(reviewCyclesTable)
    .where(and(eq(reviewCyclesTable.id, reviewCycleId), eq(reviewCyclesTable.institutionId, context.institutionId)))
    .limit(1);
  if (!cycle) throw new Error("Review cycle not found");

  const [participants, notes, readinessAssessments] = await Promise.all([
    db.select().from(reviewCycleParticipantsTable).where(eq(reviewCycleParticipantsTable.reviewCycleId, reviewCycleId)).orderBy(reviewCycleParticipantsTable.createdAt),
    db.select().from(reviewNotesTable).where(eq(reviewNotesTable.reviewCycleId, reviewCycleId)).orderBy(desc(reviewNotesTable.createdAt)),
    db.select().from(readinessAssessmentsTable).where(eq(readinessAssessmentsTable.reviewCycleId, reviewCycleId)).orderBy(desc(readinessAssessmentsTable.createdAt)),
  ]);

  return {
    reviewCycle: { ...cycle, typeLabel: reviewTypeLabels[cycle.cycleType as ReviewCycleType] ?? cycle.cycleType },
    participants,
    notes,
    readinessAssessments,
  };
}

export async function createReviewCycle(
  context: ActorContext,
  input: {
    programmeVersionId?: string;
    title?: string;
    cycleType?: ReviewCycleType;
    description?: string;
    startDate?: string;
    targetCompletionDate?: string;
    status?: ReviewCycleStatus;
  },
) {
  if (!input.programmeVersionId) throw new Error("Programme version is required");
  const [created] = await db
    .insert(reviewCyclesTable)
    .values({
      institutionId: context.institutionId,
      programmeVersionId: input.programmeVersionId,
      title: input.title?.trim() || "Programme Review",
      cycleType: input.cycleType ?? "programme_review",
      description: input.description,
      status: input.status ?? "draft",
      plannedStartAt: parseDate(input.startDate),
      plannedEndAt: parseDate(input.targetCompletionDate),
      dueAt: parseDate(input.targetCompletionDate),
      createdByUserId: context.userId,
      metadata: { phase: "7B.1", evidenceInformed: true },
    })
    .returning();
  return created;
}

export async function updateReviewCycle(
  context: ActorContext,
  reviewCycleId: string,
  input: Partial<{
    title: string;
    cycleType: ReviewCycleType;
    description: string;
    startDate: string;
    targetCompletionDate: string;
    status: ReviewCycleStatus;
  }>,
) {
  const [updated] = await db
    .update(reviewCyclesTable)
    .set({
      title: input.title,
      cycleType: input.cycleType,
      description: input.description,
      status: input.status,
      plannedStartAt: input.startDate !== undefined ? parseDate(input.startDate) : undefined,
      plannedEndAt: input.targetCompletionDate !== undefined ? parseDate(input.targetCompletionDate) : undefined,
      dueAt: input.targetCompletionDate !== undefined ? parseDate(input.targetCompletionDate) : undefined,
    })
    .where(and(eq(reviewCyclesTable.id, reviewCycleId), eq(reviewCyclesTable.institutionId, context.institutionId)))
    .returning();
  if (!updated) throw new Error("Review cycle not found");
  return updated;
}

export async function addReviewParticipant(
  context: ActorContext,
  reviewCycleId: string,
  input: { name?: string; role?: string; status?: string; comments?: string },
) {
  const cycle = await getReviewCycle(context, reviewCycleId);
  const [participant] = await db
    .insert(reviewCycleParticipantsTable)
    .values({
      institutionId: context.institutionId,
      reviewCycleId: cycle.reviewCycle.id,
      name: input.name?.trim() || "Unnamed participant",
      role: input.role?.trim() || "Contributor",
      status: input.status?.trim() || "active",
      comments: input.comments,
      createdByUserId: context.userId,
      metadata: { phase: "7B.1" },
    })
    .returning();
  return participant;
}

export async function addReviewNote(
  context: ActorContext,
  reviewCycleId: string,
  input: {
    programmeVersionId?: string;
    moduleId?: string;
    aiClaimId?: string;
    humanReviewId?: string;
    programmeMapId?: string;
    programmeMapCellId?: string;
    noteType?: string;
    title?: string;
    body?: string;
  },
) {
  const cycle = await getReviewCycle(context, reviewCycleId);
  if (!input.body?.trim()) throw new Error("Review note body is required");
  const [note] = await db
    .insert(reviewNotesTable)
    .values({
      institutionId: context.institutionId,
      reviewCycleId: cycle.reviewCycle.id,
      programmeVersionId: input.programmeVersionId ?? cycle.reviewCycle.programmeVersionId,
      moduleId: input.moduleId,
      aiClaimId: input.aiClaimId,
      humanReviewId: input.humanReviewId,
      programmeMapId: input.programmeMapId,
      programmeMapCellId: input.programmeMapCellId,
      noteType: input.noteType ?? "observation",
      title: input.title,
      body: input.body.trim(),
      createdByUserId: context.userId,
      metadata: { phase: "7B.1" },
    })
    .returning();
  return note;
}

async function assessmentMetrics(context: ActorContext, programmeVersionId: string) {
  const structure = await getCuratedStructure(context, programmeVersionId);
  const descriptorIds = structure.items.map((item) => item.moduleDescriptorId).filter((id): id is string => Boolean(id));
  if (descriptorIds.length === 0) {
    return {
      descriptorCount: 0,
      componentCount: 0,
      descriptorsWithCompleteWeighting: 0,
      assessmentVariety: 0,
      assessmentTypes: [] as string[],
    };
  }

  const [descriptors, components] = await Promise.all([
    db.select().from(moduleDescriptorsTable).where(inArray(moduleDescriptorsTable.id, descriptorIds)),
    db.select().from(assessmentComponentsTable).where(inArray(assessmentComponentsTable.moduleDescriptorId, descriptorIds)),
  ]);
  const weightsByDescriptor = new Map<string, number>();
  for (const component of components) {
    weightsByDescriptor.set(component.moduleDescriptorId, (weightsByDescriptor.get(component.moduleDescriptorId) ?? 0) + Number(component.weighting ?? 0));
  }
  const assessmentTypes = [...new Set(components.map((component) => component.componentType || component.assessmentMode || component.componentName).filter((value): value is string => Boolean(value)))];
  return {
    descriptorCount: descriptors.length,
    componentCount: components.length,
    descriptorsWithCompleteWeighting: [...weightsByDescriptor.values()].filter((weighting) => Math.abs(weighting - 100) < 0.1).length,
    assessmentVariety: assessmentTypes.length,
    assessmentTypes,
  };
}

export async function buildReadinessSummary(context: ActorContext, programmeVersionId: string) {
  const [overview, assessment] = await Promise.all([
    getProgrammeOverview(context, programmeVersionId),
    assessmentMetrics(context, programmeVersionId),
  ]);

  const moduleCount = overview.summary.moduleCount;
  const structureGaps = overview.dataQuality.missingStageSemester + overview.dataQuality.missingCredits + overview.dataQuality.missingModuleCodes;
  const curriculumRating = structureGaps === 0 && moduleCount > 0
    ? "established"
    : moduleCount > 0 && overview.summary.stageCount > 0
      ? "developing"
      : moduleCount > 0
        ? "emerging"
        : "not_assessed";

  const frameworkValues = ["greencomp", "digcomp", "entrecomp", "lifecomp"].map((key) => overview.curriculumCoverage.frameworks[key]?.coveragePercent ?? 0);
  const averageFrameworkCoverage = Math.round(frameworkValues.reduce((sum, value) => sum + value, 0) / frameworkValues.length);
  const frameworkRating = ratioRating(averageFrameworkCoverage, 100);

  const assessmentRating = weakestRating([
    ratioRating(assessment.descriptorsWithCompleteWeighting, Math.max(assessment.descriptorCount, 1), { emerging: 0.15, developing: 0.55, established: 0.8 }),
    ratioRating(assessment.assessmentVariety, 5, { emerging: 0.2, developing: 0.5, established: 0.8 }),
  ]);

  const qualityIssueCount = Object.values(overview.dataQuality).reduce((sum, value) => sum + value, 0);
  const dataQualityRating = qualityIssueCount === 0 && moduleCount > 0 ? "established" : qualityIssueCount <= Math.max(2, moduleCount * 0.1) ? "developing" : qualityIssueCount <= moduleCount ? "emerging" : "not_assessed";

  const reviewTotal = overview.reviewStatus.claimsReviewed + overview.reviewStatus.findingsAccepted + overview.reviewStatus.findingsAmended;
  const reviewedFindingsRating = overview.reviewStatus.claimsGenerated === 0
    ? "not_assessed"
    : ratioRating(reviewTotal, overview.reviewStatus.claimsGenerated, { emerging: 0.1, developing: 0.45, established: 0.75 });

  const areas: ReadinessArea[] = [
    area(
      "curriculum_structure",
      "Curriculum Structure",
      curriculumRating,
      [
        moduleCount > 0 ? `${moduleCount} modules are linked to the programme workspace.` : "",
        overview.summary.stageCount > 0 ? `${overview.summary.stageCount} stages are represented.` : "",
      ].filter(Boolean),
      [
        overview.dataQuality.missingStageSemester > 0 ? `${overview.dataQuality.missingStageSemester} modules need stage or semester clarification.` : "",
        overview.dataQuality.missingCredits > 0 ? `${overview.dataQuality.missingCredits} modules need credit clarification.` : "",
      ].filter(Boolean),
      ["Structure readiness is inferred from curated programme structure and data-quality diagnostics."],
      [{ type: "programme_structure", label: "Curated programme structure", count: moduleCount }],
      { moduleCount, stageCount: overview.summary.stageCount, semesterCount: overview.summary.semesterCount, structureGaps },
    ),
    area(
      "framework_coverage",
      "Framework Coverage",
      frameworkRating,
      frameworkValues.filter((value) => value > 0).length > 0 ? [`Framework evidence exists across ${frameworkValues.filter((value) => value > 0).length} framework families.`] : [],
      averageFrameworkCoverage < 40 ? ["Framework evidence coverage is still limited and may need human review."] : [],
      ["Coverage is based on existing framework evaluations only; CAST does not infer new framework judgements here."],
      [{ type: "framework_evaluations", label: "Framework coverage signals", count: frameworkValues.filter((value) => value > 0).length }],
      {
        greenCompCoverage: overview.curriculumCoverage.frameworks.greencomp?.coveragePercent ?? 0,
        digCompCoverage: overview.curriculumCoverage.frameworks.digcomp?.coveragePercent ?? 0,
        entreCompCoverage: overview.curriculumCoverage.frameworks.entrecomp?.coveragePercent ?? 0,
        lifeCompCoverage: overview.curriculumCoverage.frameworks.lifecomp?.coveragePercent ?? 0,
        averageFrameworkCoverage,
      },
    ),
    area(
      "assessment_design",
      "Assessment Design",
      assessmentRating,
      [
        assessment.componentCount > 0 ? `${assessment.componentCount} assessment components are available.` : "",
        assessment.assessmentVariety > 1 ? `${assessment.assessmentVariety} assessment types are represented.` : "",
      ].filter(Boolean),
      [
        assessment.componentCount === 0 ? "Assessment component evidence is not yet available." : "",
        assessment.descriptorsWithCompleteWeighting < assessment.descriptorCount ? "Some modules may need assessment weighting clarification." : "",
      ].filter(Boolean),
      ["Assessment readiness is based on descriptor-linked assessment components and weight completeness."],
      [{ type: "assessment_components", label: "Assessment components", count: assessment.componentCount }],
      {
        componentCount: assessment.componentCount,
        descriptorsWithCompleteWeighting: assessment.descriptorsWithCompleteWeighting,
        descriptorCount: assessment.descriptorCount,
        assessmentVariety: assessment.assessmentVariety,
      },
    ),
    area(
      "data_quality",
      "Data Quality",
      dataQualityRating,
      qualityIssueCount === 0 && moduleCount > 0 ? ["No current programme data-quality issues are visible in the overview."] : [],
      [
        overview.dataQuality.missingModuleCodes > 0 ? `${overview.dataQuality.missingModuleCodes} modules have missing codes.` : "",
        overview.dataQuality.modulesWithNoLearningOutcomes > 0 ? `${overview.dataQuality.modulesWithNoLearningOutcomes} modules have no learning outcomes.` : "",
        overview.dataQuality.modulesWithNoAssessments > 0 ? `${overview.dataQuality.modulesWithNoAssessments} modules have no assessments.` : "",
        overview.dataQuality.duplicatePlacementWarnings > 0 ? `${overview.dataQuality.duplicatePlacementWarnings} duplicate placement warnings need review.` : "",
      ].filter(Boolean),
      ["Poor source data is preserved and surfaced as readiness context rather than silently fixed."],
      [{ type: "data_quality", label: "Programme data-quality diagnostics", count: qualityIssueCount }],
      { ...overview.dataQuality, qualityIssueCount },
    ),
    area(
      "human_reviewed_findings",
      "Human Reviewed Findings",
      reviewedFindingsRating,
      [
        overview.reviewStatus.findingsAccepted > 0 ? `${overview.reviewStatus.findingsAccepted} accepted findings are available.` : "",
        overview.reviewStatus.findingsAmended > 0 ? `${overview.reviewStatus.findingsAmended} amended findings are available.` : "",
      ].filter(Boolean),
      [
        overview.reviewStatus.findingsRequiringClarification > 0 ? `${overview.reviewStatus.findingsRequiringClarification} findings require clarification.` : "",
        overview.reviewStatus.claimsGenerated > 0 && overview.reviewStatus.claimsReviewed === 0 ? "Claims exist but have not yet been human reviewed." : "",
      ].filter(Boolean),
      ["Only accepted or amended human-reviewed claims should be treated as findings."],
      [{ type: "human_reviews", label: "Human review records", count: overview.reviewStatus.claimsReviewed }],
      { ...overview.reviewStatus },
    ),
  ];

  return {
    programme: overview.programme,
    generatedAt: new Date().toISOString(),
    overallRating: weakestRating(areas.map((item) => item.rating)),
    overallStatusLabel: ratingLabel(weakestRating(areas.map((item) => item.rating))),
    areas,
    note: "Evidence-informed readiness indicators support human judgement; they are not institutional decisions.",
  };
}

export async function createReadinessAssessment(context: ActorContext, reviewCycleId: string) {
  const cycle = await getReviewCycle(context, reviewCycleId);
  if (!cycle.reviewCycle.programmeVersionId) throw new Error("Review cycle is not linked to a programme version");
  const summary = await buildReadinessSummary(context, cycle.reviewCycle.programmeVersionId);
  const [assessment] = await db
    .insert(readinessAssessmentsTable)
    .values({
      institutionId: context.institutionId,
      reviewCycleId,
      programmeVersionId: cycle.reviewCycle.programmeVersionId,
      status: "draft",
      title: `${cycle.reviewCycle.title} Readiness Summary`,
      summary: summary.note,
      overallRating: summary.overallRating,
      methodology: "Evidence-informed CAST readiness summary using current programme structure, framework coverage, assessment evidence, data-quality diagnostics and human-reviewed findings.",
      metadata: { phase: "7B.2", summary },
    })
    .returning();

  const items = [];
  for (const [index, item] of summary.areas.entries()) {
    const [created] = await db
      .insert(readinessAssessmentItemsTable)
      .values({
        readinessAssessmentId: assessment.id,
        criterionKey: item.key,
        title: item.title,
        finding: [
          item.strengths.length ? `Strengths: ${item.strengths.join(" ")}` : "",
          item.gaps.length ? `Gaps: ${item.gaps.join(" ")}` : "",
          item.observations.length ? `Observations: ${item.observations.join(" ")}` : "",
        ].filter(Boolean).join("\n"),
        rationale: "Generated from existing CAST evidence to support review-team discussion.",
        rating: item.rating,
        status: item.gaps.length ? "needs_review" : "draft",
        orderIndex: index,
        scope: { programmeVersionId: cycle.reviewCycle.programmeVersionId },
        metadata: { phase: "7B.2", area: item },
      })
      .returning();
    items.push(created);
  }

  return { readinessAssessment: assessment, items, summary };
}

export async function getReadinessAssessments(context: ActorContext, programmeVersionId: string) {
  const assessments = await db
    .select()
    .from(readinessAssessmentsTable)
    .where(and(eq(readinessAssessmentsTable.institutionId, context.institutionId), eq(readinessAssessmentsTable.programmeVersionId, programmeVersionId)))
    .orderBy(desc(readinessAssessmentsTable.createdAt));
  const assessmentIds = assessments.map((assessment) => assessment.id);
  const items = assessmentIds.length
    ? await db.select().from(readinessAssessmentItemsTable).where(inArray(readinessAssessmentItemsTable.readinessAssessmentId, assessmentIds)).orderBy(readinessAssessmentItemsTable.orderIndex)
    : [];
  return { readinessAssessments: assessments, items };
}

function reviewCycleCsv(cycle: Awaited<ReturnType<typeof getReviewCycle>>) {
  const rows = [
    ["Section", "Field", "Value"],
    ["Review Cycle", "Title", cycle.reviewCycle.title],
    ["Review Cycle", "Type", cycle.reviewCycle.typeLabel],
    ["Review Cycle", "Status", cycle.reviewCycle.status],
    ["Review Cycle", "Description", cycle.reviewCycle.description ?? ""],
    ...cycle.participants.map((participant) => ["Participant", participant.role, `${participant.name}${participant.comments ? ` - ${participant.comments}` : ""}`]),
    ...cycle.notes.map((note) => ["Review Note", note.noteType, `${note.title ? `${note.title}: ` : ""}${note.body}`]),
  ];
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function readinessCsv(summary: Awaited<ReturnType<typeof buildReadinessSummary>>) {
  const rows = [
    ["Area", "Status", "Strengths", "Gaps", "Observations"],
    ...summary.areas.map((item) => [
      item.title,
      item.statusLabel,
      item.strengths.join(" "),
      item.gaps.join(" "),
      item.observations.join(" "),
    ]),
  ];
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

export async function exportReviewCycle(
  context: ActorContext,
  reviewCycleId: string,
  format: "json" | "csv" = "json",
) {
  const cycle = await getReviewCycle(context, reviewCycleId);
  const payload = format === "csv" ? reviewCycleCsv(cycle) : JSON.stringify(cycle, null, 2);
  const [reviewExport] = await db
    .insert(reviewExportsTable)
    .values({
      institutionId: context.institutionId,
      reviewCycleId,
      requestedByUserId: context.userId,
      format,
      status: "completed",
      completedAt: new Date(),
      configuration: { exportType: "review_cycle_summary" },
      metadata: { inlineExport: true },
    })
    .returning();
  return {
    reviewExport,
    filename: `cast-review-cycle-${reviewCycleId}.${format}`,
    contentType: format === "csv" ? "text/csv" : "application/json",
    payload,
  };
}

export async function exportReadinessSummary(
  context: ActorContext,
  reviewCycleId: string,
  format: "json" | "csv" = "json",
) {
  const cycle = await getReviewCycle(context, reviewCycleId);
  if (!cycle.reviewCycle.programmeVersionId) throw new Error("Review cycle is not linked to a programme version");
  const summary = await buildReadinessSummary(context, cycle.reviewCycle.programmeVersionId);
  const payload = format === "csv" ? readinessCsv(summary) : JSON.stringify(summary, null, 2);
  const [reviewExport] = await db
    .insert(reviewExportsTable)
    .values({
      institutionId: context.institutionId,
      reviewCycleId,
      requestedByUserId: context.userId,
      format,
      status: "completed",
      completedAt: new Date(),
      configuration: { exportType: "readiness_summary" },
      metadata: { inlineExport: true, programmeVersionId: cycle.reviewCycle.programmeVersionId },
    })
    .returning();
  return {
    reviewExport,
    filename: `cast-readiness-summary-${reviewCycleId}.${format}`,
    contentType: format === "csv" ? "text/csv" : "application/json",
    payload,
    summary,
  };
}
