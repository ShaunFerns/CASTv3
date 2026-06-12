import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import {
  aiClaimsTable,
  assessmentComponentsTable,
  competencyEvaluationsTable,
  competenciesTable,
  curatedStructureGroupsTable,
  curatedStructureItemsTable,
  curatedStructuresTable,
  dataQualityResultLinksTable,
  dataQualityResultsTable,
  dataQualityRulesTable,
  dataQualityRunsTable,
  db,
  evidenceItemsTable,
  frameworkVersionsTable,
  frameworksTable,
  humanReviewsTable,
  importBatchesTable,
  learningOutcomesTable,
  moduleDescriptorsTable,
  modulesTable,
  programmeMapsTable,
  programmeMapVersionsTable,
  programmeVersionsTable,
  reconciliationLinksTable,
  sourceModulesTable,
  sourceProgrammesTable,
  sourceStructureItemsTable,
} from "@workspace/db";

type ActorContext = {
  institutionId: string;
  userId?: string;
};

type SourceStructureItemRow = typeof sourceStructureItemsTable.$inferSelect;
type CuratedStructureItemRow = typeof curatedStructureItemsTable.$inferSelect;
type ModuleRow = typeof modulesTable.$inferSelect;
type ModuleDescriptorRow = typeof moduleDescriptorsTable.$inferSelect;
type AssessmentComponentRow = typeof assessmentComponentsTable.$inferSelect;
type AiClaimRow = typeof aiClaimsTable.$inferSelect;
type HumanReviewRow = typeof humanReviewsTable.$inferSelect;

type QualityIssue = {
  key: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "error" | "critical";
  category: "completeness" | "consistency" | "integrity" | "timeliness" | "duplication" | "mapping" | "assessment" | "other";
  target: {
    programmeVersionId?: string;
    curatedStructureId?: string;
    curatedStructureGroupId?: string;
    curatedStructureItemId?: string;
    moduleId?: string;
    moduleDescriptorId?: string;
    sourceProgrammeId?: string;
    sourceModuleId?: string;
    sourceStructureItemId?: string;
    duplicateKey?: string;
    duplicateCount?: number;
    duplicatePlacementIds?: string[];
  };
};

const programmeQualityRules = [
  ["programme.missing_programme_code", "Missing programme code", "Programme version does not have a programme code.", "completeness", "warning"],
  ["programme.missing_programme_name", "Missing programme name", "Programme version does not have a programme name.", "completeness", "error"],
  ["programme.no_curated_structure", "No curated structure", "Programme version does not have an editable curated structure.", "mapping", "error"],
  ["programme.item_missing_module", "Structure item missing module", "A curated structure item is not linked to a module.", "integrity", "error"],
  ["programme.item_missing_stage", "Structure item missing stage", "A curated structure item is missing stage/year.", "mapping", "warning"],
  ["programme.item_missing_semester", "Structure item missing semester", "A curated structure item is missing semester/teaching period.", "mapping", "warning"],
  ["programme.item_missing_credits", "Structure item missing credits", "A curated structure item is missing credits.", "completeness", "warning"],
  ["programme.item_unknown_core_option", "Unknown core/optional status", "A curated structure item has unknown core/optional status.", "mapping", "warning"],
  ["programme.item_missing_descriptor", "Structure item missing descriptor", "A module placement is not linked to a module descriptor.", "completeness", "warning"],
  ["programme.duplicate_placement", "Duplicate programme placement", "More than one programme placement has the same module, stage, semester, pathway, group and core/optional status.", "duplication", "warning"],
] as const;

function keyPart(value: string | null | undefined, fallback: string): string {
  return value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || fallback;
}

function coreOption(value: string | null | undefined): "core" | "option" | "elective" | "required" | "optional" | "unknown" {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return "unknown";
  if (["core", "mandatory"].includes(normalized)) return "core";
  if (["required", "compulsory"].includes(normalized)) return "required";
  if (["option", "optional"].includes(normalized)) return normalized as "option" | "optional";
  if (normalized.includes("elective")) return "elective";
  return "unknown";
}

function placementPart(value: string | null | undefined, fallback = "none"): string {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") || fallback;
}

function placementModuleKey(input: { moduleId?: string | null; sourceModuleId?: string | null }): string {
  return input.moduleId ? `module:${input.moduleId}` : input.sourceModuleId ? `source:${input.sourceModuleId}` : "module:none";
}

function placementSemanticKey(input: {
  moduleId?: string | null;
  sourceModuleId?: string | null;
  stage?: string | null;
  semester?: string | null;
  pathway?: string | null;
  groupId?: string | null;
  coreOption?: string | null;
}): string {
  return [
    placementModuleKey(input),
    `stage:${placementPart(input.stage)}`,
    `semester:${placementPart(input.semester)}`,
    `pathway:${placementPart(input.pathway)}`,
    `group:${input.groupId ?? "none"}`,
    `core:${placementPart(input.coreOption, "unknown")}`,
  ].join("|");
}

function itemPlacementSemanticKey(item: CuratedStructureItemRow): string {
  return placementSemanticKey({
    moduleId: item.moduleId,
    sourceModuleId: item.sourceModuleId,
    stage: item.stage,
    semester: item.semester,
    pathway: item.pathway,
    groupId: item.curatedStructureGroupId,
    coreOption: item.coreOption,
  });
}

function sourcePlacementSemanticKey(input: {
  sourceItem: SourceStructureItemRow;
  moduleId?: string | null;
  groupId?: string | null;
}): string {
  return placementSemanticKey({
    moduleId: input.moduleId,
    sourceModuleId: input.sourceItem.sourceModuleId,
    stage: input.sourceItem.stage,
    semester: input.sourceItem.semester,
    pathway: input.sourceItem.pathway,
    groupId: input.groupId,
    coreOption: coreOption(input.sourceItem.coreOption),
  });
}

function mergedPlacementMetadata(
  existing: Record<string, unknown> | null | undefined,
  input: { semanticKey: string; sourceStructureItemId: string; sourceGroupName?: string | null; sourceCoreOption?: string | null },
): Record<string, unknown> {
  const previous = existing ?? {};
  const sourceIds = Array.isArray(previous["sourceStructureItemIds"])
    ? previous["sourceStructureItemIds"].filter((id): id is string => typeof id === "string")
    : [];
  return {
    ...previous,
    semanticPlacementKey: input.semanticKey,
    sourceCoreOption: input.sourceCoreOption,
    sourceGroupName: input.sourceGroupName,
    sourceStructureItemIds: [...new Set([...sourceIds, input.sourceStructureItemId])],
    generatedBy: previous["generatedBy"] ?? "phase4b_structure_builder",
  };
}

function itemSourceStructureIds(item: CuratedStructureItemRow): string[] {
  const sourceIds = Array.isArray(item.metadata?.["sourceStructureItemIds"])
    ? item.metadata["sourceStructureItemIds"].filter((id): id is string => typeof id === "string")
    : [];
  return [...new Set([item.sourceStructureItemId, ...sourceIds].filter((id): id is string => Boolean(id)))];
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function latestDate(dates: Array<Date | null | undefined>): string | null {
  const timestamps = dates.map((date) => date?.getTime()).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (timestamps.length === 0) return null;
  return new Date(Math.max(...timestamps)).toISOString();
}

function incrementCounter(map: Map<string, number>, key: string | null | undefined, amount = 1) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + amount);
}

function maturityDistribution() {
  return { none: 0, developing: 0, consolidating: 0, leading: 0 };
}

function normaliseAssessmentType(component: AssessmentComponentRow) {
  const text = `${component.componentType ?? ""} ${component.componentName ?? ""} ${component.assessmentMode ?? ""}`.toLowerCase();
  if (/(exam|test|quiz|mcq)/.test(text)) return "Exam";
  if (/(project|capstone|dissertation)/.test(text)) return "Project";
  if (/portfolio/.test(text)) return "Portfolio";
  if (/(presentation|pitch|viva)/.test(text)) return "Presentation";
  if (/(practical|lab|laboratory|studio|fieldwork|workshop)/.test(text)) return "Practical";
  if (/(reflect|journal|logbook)/.test(text)) return "Reflective";
  if (/(report|essay|paper|case study)/.test(text)) return "Report";
  return "Other";
}

function assessmentTriangleContribution(component: AssessmentComponentRow) {
  const metadata = component.metadata ?? {};
  const text = `${component.componentName ?? ""} ${component.componentType ?? ""} ${component.assessmentMode ?? ""} ${component.description ?? ""} ${Object.values(metadata).join(" ")}`.toLowerCase();
  if (/(reflect|journal|self|peer|portfolio|learning log|critique)/.test(text)) return "as_learning";
  if (/(formative|feedback|feedforward|draft|review|workshop)/.test(text)) return "for_learning";
  return "of_learning";
}

function indicatorBand(value: number, thresholds: { low: number; high: number }) {
  if (value < thresholds.low) return "Low";
  if (value >= thresholds.high) return "High";
  return "Moderate";
}

function incrementRecord(record: Record<string, number>, key: string, amount = 1) {
  record[key] = (record[key] ?? 0) + amount;
}

function latestReviewsByClaim(reviews: HumanReviewRow[]): Map<string, HumanReviewRow> {
  const byClaim = new Map<string, HumanReviewRow>();
  for (const review of [...reviews].sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))) {
    if (!review.aiClaimId || byClaim.has(review.aiClaimId)) continue;
    byClaim.set(review.aiClaimId, review);
  }
  return byClaim;
}

function reviewStatusForClaims(claims: AiClaimRow[], latestReviews: Map<string, HumanReviewRow>): string {
  if (claims.length === 0) return "No claims";
  const latest = claims.map((claim) => latestReviews.get(claim.id)).filter((review): review is HumanReviewRow => Boolean(review));
  if (latest.length === 0) return "Not reviewed";
  if (latest.some((review) => review.decision === "request_clarification")) return "Clarification required";
  if (latest.some((review) => review.decision === "amend")) return "Amended finding";
  if (latest.some((review) => review.decision === "accept")) return "Accepted finding";
  return "Reviewed";
}

function moduleDisplay(module: ModuleRow | undefined, fallback?: CuratedStructureItemRow) {
  return {
    code: module?.moduleCode ?? null,
    title: module?.moduleTitle ?? fallback?.label ?? null,
  };
}

function buildAssessmentIntelligence(input: {
  items: CuratedStructureItemRow[];
  moduleIds: string[];
  moduleById: Map<string, ModuleRow>;
  assessments: AssessmentComponentRow[];
  descriptorToModule: Map<string, string>;
}) {
  const itemByModule = new Map<string, CuratedStructureItemRow>();
  for (const item of input.items) {
    if (item.moduleId && !itemByModule.has(item.moduleId)) itemByModule.set(item.moduleId, item);
  }

  const typeDistribution: Record<string, number> = {};
  const weightingByType: Record<string, number> = {};
  const triangle = { ofLearning: 0, forLearning: 0, asLearning: 0 };
  const moduleAssessmentTypes = new Map<string, Set<string>>();
  const moduleAssessmentCounts = new Map<string, number>();
  const moduleAssessmentWeighting = new Map<string, number>();
  const semesterBuckets = new Map<string, { stage: string; semester: string; assessmentCount: number; totalWeighting: number; types: Set<string>; modules: Set<string> }>();

  for (const component of input.assessments) {
    const moduleId = input.descriptorToModule.get(component.moduleDescriptorId);
    const type = normaliseAssessmentType(component);
    const weighting = Number(component.weighting) || 0;
    incrementRecord(typeDistribution, type);
    incrementRecord(weightingByType, type, weighting);

    const contribution = assessmentTriangleContribution(component);
    if (contribution === "as_learning") triangle.asLearning += 1;
    else if (contribution === "for_learning") triangle.forLearning += 1;
    else triangle.ofLearning += 1;

    if (!moduleId) continue;
    moduleAssessmentCounts.set(moduleId, (moduleAssessmentCounts.get(moduleId) ?? 0) + 1);
    moduleAssessmentWeighting.set(moduleId, (moduleAssessmentWeighting.get(moduleId) ?? 0) + weighting);
    const typeSet = moduleAssessmentTypes.get(moduleId) ?? new Set<string>();
    typeSet.add(type);
    moduleAssessmentTypes.set(moduleId, typeSet);

    const item = itemByModule.get(moduleId);
    const stage = item?.stage ?? "Unknown";
    const semester = item?.semester ?? "Unknown";
    const key = `${stage}::${semester}`;
    const bucket = semesterBuckets.get(key) ?? { stage, semester, assessmentCount: 0, totalWeighting: 0, types: new Set<string>(), modules: new Set<string>() };
    bucket.assessmentCount += 1;
    bucket.totalWeighting += weighting;
    bucket.types.add(type);
    bucket.modules.add(moduleId);
    semesterBuckets.set(key, bucket);
  }

  const totalAssessments = input.assessments.length;
  const moduleCount = Math.max(input.moduleIds.length, 1);
  const semesterCount = Math.max(new Set(input.items.map((item) => `${item.stage ?? "Unknown"}::${item.semester ?? "Unknown"}`)).size, 1);
  const dominantEntry = Object.entries(typeDistribution).sort((a, b) => b[1] - a[1])[0];
  const dominantShare = totalAssessments > 0 ? (dominantEntry?.[1] ?? 0) / totalAssessments : 0;
  const diverseTypes = Object.values(typeDistribution).filter((count) => count > 0).length;
  const overloadedSemesters = [...semesterBuckets.values()].filter((bucket) => bucket.assessmentCount / Math.max(bucket.modules.size, 1) > 3);
  const modulesWithManyAssessments = input.moduleIds.filter((moduleId) => (moduleAssessmentCounts.get(moduleId) ?? 0) > 3).length;

  const observations = [
    dominantShare >= 0.5 && dominantEntry ? `Assessment is heavily concentrated in ${dominantEntry[0]}.` : "",
    diverseTypes >= 5 ? "Assessment evidence suggests a broad mix of assessment types across the programme." : "",
    diverseTypes > 0 && diverseTypes <= 2 ? "Assessment diversity appears limited across the current programme evidence." : "",
    overloadedSemesters.length > 0 ? `${overloadedSemesters.length} stage/semester grouping${overloadedSemesters.length === 1 ? "" : "s"} show potential assessment concentration.` : "",
    modulesWithManyAssessments > 0 ? `${modulesWithManyAssessments} module${modulesWithManyAssessments === 1 ? "" : "s"} include more than three assessment components.` : "",
    (typeDistribution.Portfolio ?? 0) === 0 ? "Portfolio assessment is not visible in the current assessment evidence." : "",
    (typeDistribution.Practical ?? 0) === 0 ? "Practical assessment is not visible in the current assessment evidence." : "",
  ].filter(Boolean);

  return {
    provisionalNotice: "Provisional analysis. Review required before formal use.",
    totalAssessments,
    averageAssessmentsPerModule: Number((totalAssessments / moduleCount).toFixed(1)),
    averageAssessmentsPerSemester: Number((totalAssessments / semesterCount).toFixed(1)),
    typeDistribution,
    weightingByType,
    semesterDistribution: [...semesterBuckets.values()].map((bucket) => ({
      stage: bucket.stage,
      semester: bucket.semester,
      assessmentCount: bucket.assessmentCount,
      totalWeighting: Math.round(bucket.totalWeighting),
      diversity: bucket.types.size,
      moduleCount: bucket.modules.size,
    })).sort((a, b) => `${a.stage}${a.semester}`.localeCompare(`${b.stage}${b.semester}`)),
    moduleMatrix: input.moduleIds.map((moduleId) => {
      const module = input.moduleById.get(moduleId);
      const item = itemByModule.get(moduleId);
      return {
        moduleId,
        moduleCode: module?.moduleCode ?? item?.label ?? null,
        moduleTitle: module?.moduleTitle ?? item?.label ?? null,
        stage: item?.stage ?? null,
        semester: item?.semester ?? null,
        assessmentCount: moduleAssessmentCounts.get(moduleId) ?? 0,
        totalWeighting: Math.round(moduleAssessmentWeighting.get(moduleId) ?? 0),
        typeCount: moduleAssessmentTypes.get(moduleId)?.size ?? 0,
        types: [...(moduleAssessmentTypes.get(moduleId) ?? new Set<string>())],
      };
    }).sort((a, b) => `${a.stage ?? ""}${a.semester ?? ""}${a.moduleCode ?? ""}`.localeCompare(`${b.stage ?? ""}${b.semester ?? ""}${b.moduleCode ?? ""}`)),
    indicators: {
      diversity: indicatorBand(diverseTypes, { low: 3, high: 5 }),
      concentration: indicatorBand(dominantShare, { low: 0.35, high: 0.5 }),
      balance: indicatorBand(overloadedSemesters.length + modulesWithManyAssessments, { low: 1, high: 4 }),
    },
    triangle,
    observations: observations.length ? observations : ["Assessment evidence is available for programme discussion, with no immediate deterministic concentration signal."],
    rules: [
      "Assessment type is inferred from component type, name and mode using transparent keyword rules.",
      "Assessment OF/FOR/AS learning is inferred from formative, feedback, reflective, portfolio and summative language where available.",
      "Concentration is based on dominant assessment type share and module/semester assessment volume.",
      "Balance and diversity are provisional indicators for curriculum discussion, not formal judgements.",
    ],
  };
}

async function ensureProgrammeQualityRules() {
  for (const [key, name, description, category, severity] of programmeQualityRules) {
    const [existing] = await db.select().from(dataQualityRulesTable).where(eq(dataQualityRulesTable.key, key)).limit(1);
    if (existing) continue;
    await db.insert(dataQualityRulesTable).values({
      key,
      name,
      description,
      category,
      defaultSeverity: severity,
      status: "active",
      implementationKey: key,
      ruleDefinition: { phase: "4B" },
      remediationGuidance: "Review source-versus-curated data and update the curated programme workspace.",
      isSystemManaged: true,
    });
  }
}

export async function listSourceProgrammes(context: ActorContext) {
  return db
    .select()
    .from(sourceProgrammesTable)
    .where(eq(sourceProgrammesTable.institutionId, context.institutionId))
    .orderBy(asc(sourceProgrammesTable.code), asc(sourceProgrammesTable.name));
}

export async function listProgrammeVersions(context: ActorContext) {
  return db
    .select()
    .from(programmeVersionsTable)
    .where(eq(programmeVersionsTable.institutionId, context.institutionId))
    .orderBy(asc(programmeVersionsTable.programmeName), asc(programmeVersionsTable.versionLabel));
}

export async function getProgrammeVersion(context: ActorContext, programmeVersionId: string) {
  const [programme] = await db
    .select()
    .from(programmeVersionsTable)
    .where(and(eq(programmeVersionsTable.id, programmeVersionId), eq(programmeVersionsTable.institutionId, context.institutionId)))
    .limit(1);
  return programme;
}

export async function createProgrammeVersionFromSource(
  context: ActorContext,
  input: { sourceProgrammeId: string; versionLabel?: string; academicYear?: string },
) {
  const [source] = await db
    .select()
    .from(sourceProgrammesTable)
    .where(and(eq(sourceProgrammesTable.id, input.sourceProgrammeId), eq(sourceProgrammesTable.institutionId, context.institutionId)))
    .limit(1);
  if (!source) throw new Error("Source programme not found");

  const programmeKey = source.code ?? source.externalId ?? source.id;
  const versionLabel = input.versionLabel?.trim() || "Draft";

  const [existing] = await db
    .select()
    .from(programmeVersionsTable)
    .where(
      and(
        eq(programmeVersionsTable.institutionId, context.institutionId),
        eq(programmeVersionsTable.programmeKey, programmeKey),
        eq(programmeVersionsTable.versionLabel, versionLabel),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(programmeVersionsTable)
      .set({
        sourceProgrammeId: existing.sourceProgrammeId ?? source.id,
        programmeCode: existing.programmeCode ?? source.code,
        programmeName: existing.programmeName ?? source.name,
        academicYear: existing.academicYear ?? input.academicYear,
        award: existing.award ?? source.award,
        level: existing.level ?? source.level,
        school: existing.school ?? source.school,
        department: existing.department ?? source.department,
        campus: existing.campus ?? source.campus,
        modeOfDelivery: existing.modeOfDelivery ?? source.modeOfDelivery,
        updatedAt: new Date(),
        metadata: {
          ...existing.metadata,
          createdFromSourceProgrammeId: existing.metadata["createdFromSourceProgrammeId"] ?? source.id,
          reusedFromAkariAffiliation: true,
        },
      })
      .where(eq(programmeVersionsTable.id, existing.id))
      .returning();

    await upsertReconciliation(context, {
      sourceType: "source_programme",
      sourceId: source.id,
      targetType: "programme_version",
      targetId: updated.id,
      status: "confirmed",
      confidence: 1,
      rationale: "Reused existing draft programme version from Akari source programme.",
    });
    return updated;
  }

  const [programme] = await db
    .insert(programmeVersionsTable)
    .values({
      institutionId: context.institutionId,
      sourceProgrammeId: source.id,
      programmeKey,
      programmeCode: source.code,
      programmeName: source.name,
      versionLabel,
      academicYear: input.academicYear,
      award: source.award,
      level: source.level,
      school: source.school,
      department: source.department,
      campus: source.campus,
      modeOfDelivery: source.modeOfDelivery,
      status: "draft",
      createdByUserId: context.userId,
      metadata: { createdFromSourceProgrammeId: source.id },
    })
    .returning();

  await upsertReconciliation(context, {
    sourceType: "source_programme",
    sourceId: source.id,
    targetType: "programme_version",
    targetId: programme.id,
    status: "confirmed",
    confidence: 1,
    rationale: "Created programme version from source programme.",
  });

  return programme;
}

export async function upsertReconciliation(
  context: ActorContext,
  input: {
    sourceType: "source_programme" | "source_module" | "source_structure_item" | "source_record";
    sourceId: string;
    targetType: "programme_version" | "module" | "module_descriptor" | "curated_structure" | "curated_structure_item" | "other";
    targetId: string;
    status?: "candidate" | "confirmed" | "rejected" | "superseded";
    confidence?: number;
    rationale?: string;
  },
) {
  const [existing] = await db
    .select()
    .from(reconciliationLinksTable)
    .where(
      and(
        eq(reconciliationLinksTable.institutionId, context.institutionId),
        eq(reconciliationLinksTable.sourceType, input.sourceType),
        eq(reconciliationLinksTable.sourceId, input.sourceId),
        eq(reconciliationLinksTable.targetType, input.targetType),
        eq(reconciliationLinksTable.targetId, input.targetId),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(reconciliationLinksTable)
      .set({
        status: input.status ?? existing.status,
        confidence: input.confidence ?? existing.confidence,
        rationale: input.rationale ?? existing.rationale,
        updatedAt: new Date(),
      })
      .where(eq(reconciliationLinksTable.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(reconciliationLinksTable)
    .values({
      institutionId: context.institutionId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      targetType: input.targetType,
      targetId: input.targetId,
      status: input.status ?? "candidate",
      confidence: input.confidence,
      rationale: input.rationale,
      createdByUserId: context.userId,
      metadata: { phase: "4B" },
    })
    .returning();
  return created;
}

async function findOrCreateModule(context: ActorContext, sourceModuleId: string | null) {
  if (!sourceModuleId) return undefined;

  const [source] = await db
    .select()
    .from(sourceModulesTable)
    .where(and(eq(sourceModulesTable.id, sourceModuleId), eq(sourceModulesTable.institutionId, context.institutionId)))
    .limit(1);
  if (!source) return undefined;

  const [bySource] = await db.select().from(modulesTable).where(eq(modulesTable.sourceModuleId, source.id)).limit(1);
  if (bySource) return bySource;

  if (source.moduleCode) {
    const [byCode] = await db
      .select()
      .from(modulesTable)
      .where(and(eq(modulesTable.institutionId, context.institutionId), eq(modulesTable.moduleCode, source.moduleCode)))
      .limit(1);
    if (byCode) return byCode;
  }

  const credits = source.credits ? Number(String(source.credits).replace(/[^\d.]/g, "")) : undefined;
  const [module] = await db
    .insert(modulesTable)
    .values({
      institutionId: context.institutionId,
      sourceModuleId: source.id,
      moduleCode: source.moduleCode,
      moduleTitle: source.moduleTitle,
      defaultCredits: Number.isFinite(credits) ? credits : undefined,
      school: source.school,
      department: source.department,
      campus: source.campus,
      status: source.moduleCode && source.moduleTitle ? "active" : "draft",
      createdByUserId: context.userId,
      metadata: { createdFromSourceModuleId: source.id },
    })
    .returning();
  await upsertReconciliation(context, {
    sourceType: "source_module",
    sourceId: source.id,
    targetType: "module",
    targetId: module.id,
    status: "confirmed",
    confidence: 0.95,
    rationale: "Matched or created module from source module while building curated structure.",
  });
  return module;
}

async function findDescriptor(moduleId: string, sourceModuleId: string | null) {
  if (sourceModuleId) {
    const [bySource] = await db.select().from(moduleDescriptorsTable).where(eq(moduleDescriptorsTable.sourceModuleId, sourceModuleId)).limit(1);
    if (bySource) return bySource;
  }
  const [byModule] = await db.select().from(moduleDescriptorsTable).where(eq(moduleDescriptorsTable.moduleId, moduleId)).limit(1);
  return byModule;
}

async function ensureGroup(
  context: ActorContext,
  input: {
    curatedStructureId: string;
    parentGroupId?: string;
    groupType: "stage" | "semester" | "pathway" | "option_group" | "elective_group" | "custom";
    key: string;
    name: string;
    stage?: string | null;
    semester?: string | null;
    pathway?: string | null;
    orderIndex: number;
  },
) {
  const [existing] = await db
    .select()
    .from(curatedStructureGroupsTable)
    .where(and(eq(curatedStructureGroupsTable.curatedStructureId, input.curatedStructureId), eq(curatedStructureGroupsTable.key, input.key)))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(curatedStructureGroupsTable)
    .values({
      institutionId: context.institutionId,
      curatedStructureId: input.curatedStructureId,
      parentGroupId: input.parentGroupId,
      groupType: input.groupType,
      key: input.key,
      name: input.name,
      stage: input.stage,
      semester: input.semester,
      pathway: input.pathway,
      orderIndex: input.orderIndex,
      metadata: { generatedBy: "phase4b_structure_builder" },
    })
    .returning();
  return created;
}

export async function buildInitialCuratedStructure(context: ActorContext, programmeVersionId: string) {
  const programme = await getProgrammeVersion(context, programmeVersionId);
  if (!programme) throw new Error("Programme version not found");

  const key = "primary";
  const [existing] = await db
    .select()
    .from(curatedStructuresTable)
    .where(and(eq(curatedStructuresTable.programmeVersionId, programme.id), eq(curatedStructuresTable.key, key)))
    .limit(1);
  const structure =
    existing ??
    (
      await db
        .insert(curatedStructuresTable)
        .values({
          institutionId: context.institutionId,
          programmeVersionId: programme.id,
          sourceProgrammeId: programme.sourceProgrammeId,
          key,
          name: `${programme.programmeName ?? programme.programmeCode ?? "Programme"} structure`,
          status: "draft",
          createdByUserId: context.userId,
          metadata: { generatedBy: "phase4b_structure_builder" },
        })
        .returning()
    )[0];

  await upsertReconciliation(context, {
    sourceType: "source_programme",
    sourceId: programme.sourceProgrammeId ?? programme.id,
    targetType: "curated_structure",
    targetId: structure.id,
    status: programme.sourceProgrammeId ? "confirmed" : "candidate",
    confidence: programme.sourceProgrammeId ? 0.9 : 0.3,
    rationale: "Curated structure created for programme version.",
  });

  if (!programme.sourceProgrammeId) return { structure, groupsCreated: 0, itemsCreated: 0 };

  const sourceItems = await db
    .select()
    .from(sourceStructureItemsTable)
    .where(eq(sourceStructureItemsTable.sourceProgrammeId, programme.sourceProgrammeId))
    .orderBy(asc(sourceStructureItemsTable.orderIndex));

  let groupsCreated = 0;
  let itemsCreated = 0;
  let itemsReused = 0;
  for (const [index, sourceItem] of sourceItems.entries()) {
    const stageKey = `stage-${keyPart(sourceItem.stage, "unknown")}`;
    const stageGroup = await ensureGroup(context, {
      curatedStructureId: structure.id,
      groupType: "stage",
      key: stageKey,
      name: sourceItem.stage ? `Stage ${sourceItem.stage}` : "Stage unknown",
      stage: sourceItem.stage,
      orderIndex: index,
    });
    groupsCreated += 1;

    const semesterKey = `${stageKey}-semester-${keyPart(sourceItem.semester, "unknown")}`;
    const semesterGroup = await ensureGroup(context, {
      curatedStructureId: structure.id,
      parentGroupId: stageGroup.id,
      groupType: "semester",
      key: semesterKey,
      name: sourceItem.semester ? `Semester ${sourceItem.semester}` : "Semester unknown",
      stage: sourceItem.stage,
      semester: sourceItem.semester,
      orderIndex: index,
    });
    groupsCreated += 1;

    const parentGroup = sourceItem.pathway
      ? await ensureGroup(context, {
          curatedStructureId: structure.id,
          parentGroupId: semesterGroup.id,
          groupType: "pathway",
          key: `${semesterKey}-pathway-${keyPart(sourceItem.pathway, "default")}`,
          name: sourceItem.pathway,
          stage: sourceItem.stage,
          semester: sourceItem.semester,
          pathway: sourceItem.pathway,
          orderIndex: index,
        })
      : semesterGroup;

    const module = await findOrCreateModule(context, sourceItem.sourceModuleId);
    const descriptor = module ? await findDescriptor(module.id, sourceItem.sourceModuleId) : undefined;
    const credits = sourceItem.credits ? Number(String(sourceItem.credits).replace(/[^\d.]/g, "")) : undefined;
    const resolvedCoreOption = coreOption(sourceItem.coreOption);
    const semanticPlacementKey = sourcePlacementSemanticKey({ sourceItem, moduleId: module?.id, groupId: parentGroup.id });

    const [existingItem] = await db
      .select()
      .from(curatedStructureItemsTable)
      .where(and(eq(curatedStructureItemsTable.curatedStructureId, structure.id), eq(curatedStructureItemsTable.sourceStructureItemId, sourceItem.id)))
      .limit(1);
    const existingSemanticItem = existingItem
      ? undefined
      : (
          await db
            .select()
            .from(curatedStructureItemsTable)
            .where(eq(curatedStructureItemsTable.curatedStructureId, structure.id))
        ).find((item) => itemPlacementSemanticKey(item) === semanticPlacementKey || item.metadata?.["semanticPlacementKey"] === semanticPlacementKey);
    const itemToReuse = existingItem ?? existingSemanticItem;

    if (itemToReuse) {
      await db
        .update(curatedStructureItemsTable)
        .set({
          curatedStructureGroupId: itemToReuse.curatedStructureGroupId ?? parentGroup.id,
          moduleId: itemToReuse.moduleId ?? module?.id,
          moduleDescriptorId: itemToReuse.moduleDescriptorId ?? descriptor?.id,
          sourceStructureItemId: itemToReuse.sourceStructureItemId ?? sourceItem.id,
          sourceModuleId: itemToReuse.sourceModuleId ?? sourceItem.sourceModuleId,
          stage: itemToReuse.stage ?? sourceItem.stage,
          semester: itemToReuse.semester ?? sourceItem.semester,
          pathway: itemToReuse.pathway ?? sourceItem.pathway,
          credits: itemToReuse.credits ?? (Number.isFinite(credits) ? credits : undefined),
          label: itemToReuse.label ?? module?.moduleTitle ?? sourceItem.externalId,
          metadata: mergedPlacementMetadata(itemToReuse.metadata, {
            semanticKey: semanticPlacementKey,
            sourceStructureItemId: sourceItem.id,
            sourceCoreOption: sourceItem.coreOption,
            sourceGroupName: sourceItem.groupName,
          }),
          updatedAt: new Date(),
        })
        .where(eq(curatedStructureItemsTable.id, itemToReuse.id));
      itemsReused += 1;
      await upsertReconciliation(context, {
        sourceType: "source_structure_item",
        sourceId: sourceItem.id,
        targetType: "curated_structure_item",
        targetId: itemToReuse.id,
        status: "confirmed",
        confidence: existingItem ? 0.9 : 0.85,
        rationale: existingItem
          ? "Reused curated structure item from matching source structure item."
          : "Reused curated structure item from semantic programme placement match.",
      });
      continue;
    }

    const [item] = await db
      .insert(curatedStructureItemsTable)
      .values({
        institutionId: context.institutionId,
        curatedStructureId: structure.id,
        curatedStructureGroupId: parentGroup.id,
        moduleId: module?.id,
        moduleDescriptorId: descriptor?.id,
        sourceStructureItemId: sourceItem.id,
        sourceModuleId: sourceItem.sourceModuleId,
        itemType: "module",
        coreOption: resolvedCoreOption,
        stage: sourceItem.stage,
        semester: sourceItem.semester,
        pathway: sourceItem.pathway,
        credits: Number.isFinite(credits) ? credits : undefined,
        orderIndex: sourceItem.orderIndex ?? index,
        label: module?.moduleTitle ?? sourceItem.externalId,
        metadata: mergedPlacementMetadata({
          sourceCoreOption: sourceItem.coreOption,
          sourceGroupName: sourceItem.groupName,
          generatedBy: "phase4b_structure_builder",
        }, {
          semanticKey: semanticPlacementKey,
          sourceStructureItemId: sourceItem.id,
          sourceCoreOption: sourceItem.coreOption,
          sourceGroupName: sourceItem.groupName,
        }),
      })
      .returning();
    itemsCreated += 1;

    await upsertReconciliation(context, {
      sourceType: "source_structure_item",
      sourceId: sourceItem.id,
      targetType: "curated_structure_item",
      targetId: item.id,
      status: "confirmed",
      confidence: 0.9,
      rationale: "Generated curated structure item from source structure item.",
    });
  }

  return { structure, groupsCreated, itemsCreated, itemsReused };
}

export async function generateDraftProgrammesFromSourceProgrammes(
  context: ActorContext,
  input: { importBatchId?: string; sourceProgrammeIds?: string[]; versionLabel?: string; academicYear?: string },
) {
  const sourceProgrammes = input.sourceProgrammeIds?.length
    ? await db
        .select()
        .from(sourceProgrammesTable)
        .where(and(eq(sourceProgrammesTable.institutionId, context.institutionId), inArray(sourceProgrammesTable.id, input.sourceProgrammeIds)))
        .orderBy(asc(sourceProgrammesTable.code), asc(sourceProgrammesTable.name))
    : input.importBatchId
      ? await db
          .select()
          .from(sourceProgrammesTable)
          .where(and(eq(sourceProgrammesTable.institutionId, context.institutionId), eq(sourceProgrammesTable.importBatchId, input.importBatchId)))
          .orderBy(asc(sourceProgrammesTable.code), asc(sourceProgrammesTable.name))
      : [];

  const uniqueSourceProgrammes = sourceProgrammes.filter((source, index, all) => (
    all.findIndex((candidate) => candidate.id === source.id) === index
  ));

  const generated = [];
  for (const source of uniqueSourceProgrammes) {
    const programme = await createProgrammeVersionFromSource(context, {
      sourceProgrammeId: source.id,
      versionLabel: input.versionLabel ?? "Draft",
      academicYear: input.academicYear,
    });
    const structure = await buildInitialCuratedStructure(context, programme.id);
    generated.push({
      sourceProgrammeId: source.id,
      programmeVersionId: programme.id,
      curatedStructureId: structure.structure.id,
      groupsCreated: structure.groupsCreated,
      itemsCreated: structure.itemsCreated,
      itemsReused: structure.itemsReused,
    });
  }

  return {
    programmeVersionsCreatedOrReused: generated.length,
    generated,
  };
}

export async function getCuratedStructure(context: ActorContext, programmeVersionId: string) {
  const programme = await getProgrammeVersion(context, programmeVersionId);
  if (!programme) throw new Error("Programme version not found");
  const structures = await db
    .select()
    .from(curatedStructuresTable)
    .where(eq(curatedStructuresTable.programmeVersionId, programme.id))
    .orderBy(asc(curatedStructuresTable.key));
  const structure = structures[0];
  if (!structure) return { programme, structures, groups: [], items: [] };

  const groups = await db
    .select()
    .from(curatedStructureGroupsTable)
    .where(eq(curatedStructureGroupsTable.curatedStructureId, structure.id))
    .orderBy(asc(curatedStructureGroupsTable.orderIndex), asc(curatedStructureGroupsTable.key));
  const items = await db
    .select()
    .from(curatedStructureItemsTable)
    .where(eq(curatedStructureItemsTable.curatedStructureId, structure.id))
    .orderBy(asc(curatedStructureItemsTable.orderIndex), asc(curatedStructureItemsTable.label));
  return { programme, structures, structure, groups, items };
}

export async function updateStructureGroup(
  context: ActorContext,
  groupId: string,
  input: { name?: string; stage?: string; semester?: string; pathway?: string; minCredits?: number; maxCredits?: number; orderIndex?: number },
) {
  const [existing] = await db
    .select()
    .from(curatedStructureGroupsTable)
    .where(and(eq(curatedStructureGroupsTable.id, groupId), eq(curatedStructureGroupsTable.institutionId, context.institutionId)))
    .limit(1);
  if (!existing) throw new Error("Curated structure group not found");
  const [updated] = await db.update(curatedStructureGroupsTable).set({ ...input, updatedAt: new Date() }).where(eq(curatedStructureGroupsTable.id, groupId)).returning();
  return updated;
}

export async function updateStructureItem(
  context: ActorContext,
  itemId: string,
  input: { curatedStructureGroupId?: string; coreOption?: "core" | "option" | "elective" | "required" | "optional" | "unknown"; stage?: string; semester?: string; pathway?: string; credits?: number; orderIndex?: number; label?: string; notes?: string },
) {
  const [existing] = await db
    .select()
    .from(curatedStructureItemsTable)
    .where(and(eq(curatedStructureItemsTable.id, itemId), eq(curatedStructureItemsTable.institutionId, context.institutionId)))
    .limit(1);
  if (!existing) throw new Error("Curated structure item not found");
  const [updated] = await db.update(curatedStructureItemsTable).set({ ...input, updatedAt: new Date() }).where(eq(curatedStructureItemsTable.id, itemId)).returning();
  return updated;
}

export async function sourceComparison(context: ActorContext, programmeVersionId: string) {
  const structureData = await getCuratedStructure(context, programmeVersionId);
  const sourceProgramme = structureData.programme.sourceProgrammeId
    ? (
        await db
          .select()
          .from(sourceProgrammesTable)
          .where(eq(sourceProgrammesTable.id, structureData.programme.sourceProgrammeId))
          .limit(1)
      )[0]
    : undefined;

  const metadata = [
    ["programmeCode", sourceProgramme?.code, structureData.programme.programmeCode],
    ["programmeName", sourceProgramme?.name, structureData.programme.programmeName],
    ["award", sourceProgramme?.award, structureData.programme.award],
    ["level", sourceProgramme?.level, structureData.programme.level],
    ["school", sourceProgramme?.school, structureData.programme.school],
    ["department", sourceProgramme?.department, structureData.programme.department],
  ].map(([field, sourceValue, curatedValue]) => ({
    field,
    sourceValue,
    curatedValue,
    status: sourceValue === curatedValue ? "same" : sourceValue == null ? "curated_only" : curatedValue == null ? "source_only" : "changed",
  }));

  const sourceItems: SourceStructureItemRow[] = structureData.programme.sourceProgrammeId
    ? await db.select().from(sourceStructureItemsTable).where(eq(sourceStructureItemsTable.sourceProgrammeId, structureData.programme.sourceProgrammeId))
    : [];
  const curatedItems = structureData.items as CuratedStructureItemRow[];
  return {
    programme: structureData.programme,
    metadata,
    counts: {
      sourceStructureItems: sourceItems.length,
      curatedStructureItems: curatedItems.length,
      curatedGroups: structureData.groups.length,
    },
    missingFromCurated: sourceItems.filter((sourceItem) => !curatedItems.some((item) => itemSourceStructureIds(item).includes(sourceItem.id))),
    curatedOnly: curatedItems.filter((item) => !item.sourceStructureItemId),
  };
}

export async function runProgrammeQualityChecks(context: ActorContext, programmeVersionId: string) {
  await ensureProgrammeQualityRules();
  const structureData = await getCuratedStructure(context, programmeVersionId);
  const issues: QualityIssue[] = [];

  if (!structureData.programme.programmeCode) {
    issues.push({ key: "programme.missing_programme_code", title: "Missing programme code", message: "Programme version has no programme code.", severity: "warning", category: "completeness", target: { programmeVersionId } });
  }
  if (!structureData.programme.programmeName) {
    issues.push({ key: "programme.missing_programme_name", title: "Missing programme name", message: "Programme version has no programme name.", severity: "error", category: "completeness", target: { programmeVersionId } });
  }
  if (!structureData.structure) {
    issues.push({ key: "programme.no_curated_structure", title: "No curated structure", message: "Programme version has no curated structure.", severity: "error", category: "mapping", target: { programmeVersionId } });
  }

  for (const item of structureData.items) {
    if (!item.moduleId) issues.push({ key: "programme.item_missing_module", title: "Structure item missing module", message: "A structure item is not linked to a module.", severity: "error", category: "integrity", target: { curatedStructureItemId: item.id } });
    if (!item.stage) issues.push({ key: "programme.item_missing_stage", title: "Structure item missing stage", message: "A structure item is missing stage/year.", severity: "warning", category: "mapping", target: { curatedStructureItemId: item.id } });
    if (!item.semester) issues.push({ key: "programme.item_missing_semester", title: "Structure item missing semester", message: "A structure item is missing semester.", severity: "warning", category: "mapping", target: { curatedStructureItemId: item.id } });
    if (item.credits == null) issues.push({ key: "programme.item_missing_credits", title: "Structure item missing credits", message: "A structure item is missing credits.", severity: "warning", category: "completeness", target: { curatedStructureItemId: item.id } });
    if (item.coreOption === "unknown") issues.push({ key: "programme.item_unknown_core_option", title: "Unknown core/optional status", message: "A structure item has unknown core/optional status.", severity: "warning", category: "mapping", target: { curatedStructureItemId: item.id } });
    if (!item.moduleDescriptorId) issues.push({ key: "programme.item_missing_descriptor", title: "Structure item missing descriptor", message: "A structure item is not linked to a descriptor.", severity: "warning", category: "completeness", target: { curatedStructureItemId: item.id } });
  }

  const placementsByKey = new Map<string, CuratedStructureItemRow[]>();
  for (const item of structureData.items as CuratedStructureItemRow[]) {
    const key = itemPlacementSemanticKey(item);
    placementsByKey.set(key, [...(placementsByKey.get(key) ?? []), item]);
  }
  for (const [duplicateKey, items] of placementsByKey) {
    if (items.length <= 1) continue;
    for (const item of items.slice(1)) {
      issues.push({
        key: "programme.duplicate_placement",
        title: "Duplicate programme placement",
        message: "This module appears more than once with the same stage, semester, pathway, group and core/optional status.",
        severity: "warning",
        category: "duplication",
        target: {
          curatedStructureItemId: item.id,
          moduleId: item.moduleId ?? undefined,
          sourceModuleId: item.sourceModuleId ?? undefined,
          sourceStructureItemId: item.sourceStructureItemId ?? undefined,
          duplicateKey,
          duplicateCount: items.length,
          duplicatePlacementIds: items.map((candidate) => candidate.id),
        },
      });
    }
  }

  const [qualityRun] = await db
    .insert(dataQualityRunsTable)
    .values({
      institutionId: context.institutionId,
      programmeVersionId,
      curatedStructureId: structureData.structure?.id,
      status: issues.length > 0 ? "completed_with_issues" : "completed",
      trigger: "api",
      scope: { programmeVersionId, phase: "4B" },
      requestedByUserId: context.userId,
      startedAt: new Date(),
      completedAt: new Date(),
      summary: { issueCount: issues.length },
    })
    .returning();

  const results = [];
  for (const issue of issues) {
    const [rule] = await db.select().from(dataQualityRulesTable).where(eq(dataQualityRulesTable.key, issue.key)).limit(1);
    if (!rule) continue;
    const [result] = await db
      .insert(dataQualityResultsTable)
      .values({
        institutionId: context.institutionId,
        dataQualityRunId: qualityRun.id,
        dataQualityRuleId: rule.id,
        severity: issue.severity,
        fingerprint: `${programmeVersionId}:${issue.key}:${JSON.stringify(issue.target)}`,
        title: issue.title,
        message: issue.message,
        details: issue.target,
        expectedValue: { quality: "complete" },
      })
      .returning();
    results.push(result);

    await db.insert(dataQualityResultLinksTable).values({
      dataQualityResultId: result.id,
      programmeVersionId: issue.target.programmeVersionId,
      curatedStructureId: issue.target.curatedStructureId,
      curatedStructureGroupId: issue.target.curatedStructureGroupId,
      curatedStructureItemId: issue.target.curatedStructureItemId,
      moduleId: issue.target.moduleId,
      moduleDescriptorId: issue.target.moduleDescriptorId,
      sourceProgrammeId: issue.target.sourceProgrammeId,
      sourceModuleId: issue.target.sourceModuleId,
      sourceStructureItemId: issue.target.sourceStructureItemId,
      relationship: "quality_target",
    });
  }

  return { qualityRun, results };
}

export async function getProgrammeOverview(context: ActorContext, programmeVersionId: string) {
  const structureData = await getCuratedStructure(context, programmeVersionId);
  const items = structureData.items as CuratedStructureItemRow[];
  const moduleIds = [...new Set(items.map((item) => item.moduleId).filter((id): id is string => Boolean(id)))];
  const sourceStructureIds = [...new Set(items.flatMap((item) => itemSourceStructureIds(item)))];
  const sourceModuleIds = [...new Set(items.map((item) => item.sourceModuleId).filter((id): id is string => Boolean(id)))];

  const [modules, descriptors, sourceStructures, sourceModules] = await Promise.all([
    moduleIds.length
      ? db.select().from(modulesTable).where(and(eq(modulesTable.institutionId, context.institutionId), inArray(modulesTable.id, moduleIds)))
      : Promise.resolve([]),
    moduleIds.length
      ? db.select().from(moduleDescriptorsTable).where(and(eq(moduleDescriptorsTable.institutionId, context.institutionId), inArray(moduleDescriptorsTable.moduleId, moduleIds)))
      : Promise.resolve([]),
    sourceStructureIds.length
      ? db.select().from(sourceStructureItemsTable).where(and(eq(sourceStructureItemsTable.institutionId, context.institutionId), inArray(sourceStructureItemsTable.id, sourceStructureIds)))
      : Promise.resolve([]),
    sourceModuleIds.length
      ? db.select().from(sourceModulesTable).where(and(eq(sourceModulesTable.institutionId, context.institutionId), inArray(sourceModulesTable.id, sourceModuleIds)))
      : Promise.resolve([]),
  ]);

  const descriptorRows = descriptors as ModuleDescriptorRow[];
  const descriptorIds = descriptorRows.map((descriptor) => descriptor.id);
  const moduleById = new Map((modules as ModuleRow[]).map((module) => [module.id, module]));
  const descriptorsByModule = new Map<string, ModuleDescriptorRow[]>();
  const descriptorToModule = new Map<string, string>();
  for (const descriptor of descriptorRows) {
    descriptorsByModule.set(descriptor.moduleId, [...(descriptorsByModule.get(descriptor.moduleId) ?? []), descriptor]);
    descriptorToModule.set(descriptor.id, descriptor.moduleId);
  }

  const importBatchIds = [
    ...new Set([
      ...sourceStructures.map((source) => source.importBatchId),
      ...sourceModules.map((source) => source.importBatchId),
    ].filter((id): id is string => Boolean(id))),
  ];
  const importBatches = importBatchIds.length
    ? await db.select().from(importBatchesTable).where(and(eq(importBatchesTable.institutionId, context.institutionId), inArray(importBatchesTable.id, importBatchIds)))
    : [];

  const [evidenceRows, learningOutcomeRows, assessmentRows, evaluationRows, claimRows] = await Promise.all([
    moduleIds.length
      ? db.select().from(evidenceItemsTable).where(and(eq(evidenceItemsTable.institutionId, context.institutionId), inArray(evidenceItemsTable.moduleId, moduleIds)))
      : Promise.resolve([]),
    descriptorIds.length
      ? db.select().from(learningOutcomesTable).where(and(eq(learningOutcomesTable.institutionId, context.institutionId), inArray(learningOutcomesTable.moduleDescriptorId, descriptorIds)))
      : Promise.resolve([]),
    descriptorIds.length
      ? db.select().from(assessmentComponentsTable).where(and(eq(assessmentComponentsTable.institutionId, context.institutionId), inArray(assessmentComponentsTable.moduleDescriptorId, descriptorIds)))
      : Promise.resolve([]),
    moduleIds.length
      ? db
          .select({
            evaluation: competencyEvaluationsTable,
            competency: competenciesTable,
            frameworkVersion: frameworkVersionsTable,
            framework: frameworksTable,
          })
          .from(competencyEvaluationsTable)
          .leftJoin(competenciesTable, eq(competencyEvaluationsTable.competencyId, competenciesTable.id))
          .leftJoin(frameworkVersionsTable, eq(competenciesTable.frameworkVersionId, frameworkVersionsTable.id))
          .leftJoin(frameworksTable, eq(frameworkVersionsTable.frameworkId, frameworksTable.id))
          .where(and(
            eq(competencyEvaluationsTable.institutionId, context.institutionId),
            or(eq(competencyEvaluationsTable.programmeVersionId, programmeVersionId), inArray(competencyEvaluationsTable.moduleId, moduleIds)),
          ))
      : db
          .select({
            evaluation: competencyEvaluationsTable,
            competency: competenciesTable,
            frameworkVersion: frameworkVersionsTable,
            framework: frameworksTable,
          })
          .from(competencyEvaluationsTable)
          .leftJoin(competenciesTable, eq(competencyEvaluationsTable.competencyId, competenciesTable.id))
          .leftJoin(frameworkVersionsTable, eq(competenciesTable.frameworkVersionId, frameworkVersionsTable.id))
          .leftJoin(frameworksTable, eq(frameworkVersionsTable.frameworkId, frameworksTable.id))
          .where(and(eq(competencyEvaluationsTable.institutionId, context.institutionId), eq(competencyEvaluationsTable.programmeVersionId, programmeVersionId))),
    moduleIds.length
      ? db.select().from(aiClaimsTable).where(and(eq(aiClaimsTable.institutionId, context.institutionId), or(eq(aiClaimsTable.programmeVersionId, programmeVersionId), inArray(aiClaimsTable.moduleId, moduleIds))))
      : db.select().from(aiClaimsTable).where(and(eq(aiClaimsTable.institutionId, context.institutionId), eq(aiClaimsTable.programmeVersionId, programmeVersionId))),
  ]);

  const claimIds = claimRows.map((claim) => claim.id);
  const reviewRows = claimIds.length
    ? await db.select().from(humanReviewsTable).where(and(eq(humanReviewsTable.institutionId, context.institutionId), inArray(humanReviewsTable.aiClaimId, claimIds)))
    : [];
  const latestReviewByClaim = latestReviewsByClaim(reviewRows);

  const evidenceByModule = new Map<string, number>();
  for (const evidence of evidenceRows) incrementCounter(evidenceByModule, evidence.moduleId);

  const outcomesByModule = new Map<string, number>();
  for (const outcome of learningOutcomeRows) incrementCounter(outcomesByModule, descriptorToModule.get(outcome.moduleDescriptorId));

  const assessmentsByModule = new Map<string, number>();
  for (const assessment of assessmentRows) incrementCounter(assessmentsByModule, descriptorToModule.get(assessment.moduleDescriptorId));

  const claimsByModule = new Map<string, AiClaimRow[]>();
  for (const claim of claimRows) {
    if (!claim.moduleId) continue;
    claimsByModule.set(claim.moduleId, [...(claimsByModule.get(claim.moduleId) ?? []), claim]);
  }

  const frameworkKeys = ["greencomp", "lifecomp", "entrecomp", "digcomp"] as const;
  const frameworkVersionRows = await db
    .select({ framework: frameworksTable, version: frameworkVersionsTable })
    .from(frameworksTable)
    .innerJoin(frameworkVersionsTable, eq(frameworkVersionsTable.frameworkId, frameworksTable.id))
    .where(inArray(frameworksTable.key, [...frameworkKeys]));
  const frameworkVersionIds = frameworkVersionRows.map((row) => row.version.id);
  const competencyRows = frameworkVersionIds.length
    ? await db.select().from(competenciesTable).where(inArray(competenciesTable.frameworkVersionId, frameworkVersionIds))
    : [];

  const totalCompetenciesByFramework = new Map<string, number>();
  const frameworkKeyByVersion = new Map(frameworkVersionRows.map((row) => [row.version.id, row.framework.key]));
  for (const competency of competencyRows) {
    incrementCounter(totalCompetenciesByFramework, frameworkKeyByVersion.get(competency.frameworkVersionId));
  }

  const observedCompetenciesByFramework = new Map<string, Set<string>>();
  const maturity = maturityDistribution();
  for (const row of evaluationRows) {
    const frameworkKey = row.framework?.key;
    const competencyId = row.evaluation.competencyId;
    if (frameworkKey && competencyId) {
      const set = observedCompetenciesByFramework.get(frameworkKey) ?? new Set<string>();
      set.add(competencyId);
      observedCompetenciesByFramework.set(frameworkKey, set);
    }
    const observedLevel = row.evaluation.observedLevel as keyof ReturnType<typeof maturityDistribution>;
    if (observedLevel in maturity) maturity[observedLevel] += 1;
  }

  const frameworkCoverage = Object.fromEntries(frameworkKeys.map((key) => {
    const totalCompetencies = totalCompetenciesByFramework.get(key) ?? 0;
    const observedCompetencies = observedCompetenciesByFramework.get(key)?.size ?? 0;
    return [key, {
      totalCompetencies,
      observedCompetencies,
      coveragePercent: totalCompetencies > 0 ? Math.round((observedCompetencies / totalCompetencies) * 100) : 0,
    }];
  }));

  const latestReviews = [...latestReviewByClaim.values()];
  const dataQuality = {
    missingModuleCodes: moduleIds.filter((moduleId) => !moduleById.get(moduleId)?.moduleCode).length + items.filter((item) => !item.moduleId && !item.sourceModuleId).length,
    missingCredits: items.filter((item) => item.credits == null && (!item.moduleId || moduleById.get(item.moduleId)?.defaultCredits == null)).length,
    missingStageSemester: items.filter((item) => !item.stage || !item.semester).length,
    duplicatePlacementWarnings: 0,
    modulesWithNoLearningOutcomes: moduleIds.filter((moduleId) => (outcomesByModule.get(moduleId) ?? 0) === 0).length,
    modulesWithNoAssessments: moduleIds.filter((moduleId) => (assessmentsByModule.get(moduleId) ?? 0) === 0).length,
  };

  const placementsByKey = new Map<string, CuratedStructureItemRow[]>();
  for (const item of items) {
    const key = itemPlacementSemanticKey(item);
    placementsByKey.set(key, [...(placementsByKey.get(key) ?? []), item]);
  }
  for (const duplicateGroup of placementsByKey.values()) {
    if (duplicateGroup.length > 1) dataQuality.duplicatePlacementWarnings += duplicateGroup.length - 1;
  }

  const itemQualityByModule = new Map<string, number>();
  for (const item of items) {
    if (!item.moduleId) continue;
    let issueCount = 0;
    if (!item.stage || !item.semester) issueCount += 1;
    if (item.credits == null && moduleById.get(item.moduleId)?.defaultCredits == null) issueCount += 1;
    itemQualityByModule.set(item.moduleId, (itemQualityByModule.get(item.moduleId) ?? 0) + issueCount);
  }
  for (const duplicateGroup of placementsByKey.values()) {
    if (duplicateGroup.length <= 1) continue;
    for (const item of duplicateGroup.slice(1)) {
      if (item.moduleId) itemQualityByModule.set(item.moduleId, (itemQualityByModule.get(item.moduleId) ?? 0) + 1);
    }
  }

  const moduleStatusRows = moduleIds.map((moduleId) => {
    const module = moduleById.get(moduleId);
    const fallbackItem = items.find((item) => item.moduleId === moduleId);
    const display = moduleDisplay(module, fallbackItem);
    const claimCount = claimsByModule.get(moduleId)?.length ?? 0;
    const noOutcomes = (outcomesByModule.get(moduleId) ?? 0) === 0;
    const noAssessments = (assessmentsByModule.get(moduleId) ?? 0) === 0;
    const qualityCount = (itemQualityByModule.get(moduleId) ?? 0)
      + (!display.code ? 1 : 0)
      + (noOutcomes ? 1 : 0)
      + (noAssessments ? 1 : 0);
    return {
      moduleId,
      moduleCode: display.code,
      moduleTitle: display.title,
      evidenceCount: evidenceByModule.get(moduleId) ?? 0,
      claimCount,
      reviewStatus: reviewStatusForClaims(claimsByModule.get(moduleId) ?? [], latestReviewByClaim),
      dataQualityStatus: qualityCount > 0 ? `${qualityCount} issue${qualityCount === 1 ? "" : "s"}` : "No issues",
    };
  });

  return {
    programme: {
      id: structureData.programme.id,
      title: structureData.programme.programmeName,
      code: structureData.programme.programmeCode,
      versionLabel: structureData.programme.versionLabel,
      academicYear: structureData.programme.academicYear,
    },
    summary: {
      moduleCount: moduleIds.length,
      stageCount: uniqueStrings(items.map((item) => item.stage)).length,
      semesterCount: uniqueStrings(items.map((item) => item.semester)).length,
      lastUploadDate: latestDate(importBatches.map((batch) => batch.completedAt ?? batch.createdAt)),
    },
    curriculumCoverage: {
      frameworks: frameworkCoverage,
      evidenceMaturityDistribution: maturity,
    },
    reviewStatus: {
      claimsGenerated: claimRows.length,
      claimsReviewed: latestReviews.length,
      findingsAccepted: latestReviews.filter((review) => review.decision === "accept").length,
      findingsAmended: latestReviews.filter((review) => review.decision === "amend").length,
      findingsRequiringClarification: latestReviews.filter((review) => review.decision === "request_clarification").length,
    },
    dataQuality,
    assessmentIntelligence: buildAssessmentIntelligence({
      items,
      moduleIds,
      moduleById,
      assessments: assessmentRows,
      descriptorToModule,
    }),
    modules: moduleStatusRows.sort((a, b) => `${a.moduleCode ?? ""}${a.moduleTitle ?? ""}`.localeCompare(`${b.moduleCode ?? ""}${b.moduleTitle ?? ""}`)),
  };
}

type ProgrammeComparisonMode = "programme_version" | "snapshot" | "upload";
type ComparisonMetric = { left: number; right: number; delta: number };
type FrameworkCoverageRecord = Record<string, { totalCompetencies: number; observedCompetencies: number; coveragePercent: number }>;
type FrameworkCompetencyMarker = {
  id: string;
  key: string;
  name: string;
  frameworkKey: string;
};
type ComparableModule = {
  key: string;
  moduleId?: string | null;
  moduleCode?: string | null;
  moduleTitle?: string | null;
  stage?: string | null;
  semester?: string | null;
  credits?: number | null;
  evidenceCount?: number;
  claimCount?: number;
  reviewStatus?: string;
  dataQualityStatus?: string;
};
type ComparisonSource = {
  label: string;
  modules: ComparableModule[];
  frameworkCoverage: Partial<FrameworkCoverageRecord>;
  frameworkCompetencies: Record<string, FrameworkCompetencyMarker[]>;
  maturityDistribution: Record<string, number>;
  reviewStatus: Record<string, number>;
  dataQuality: Record<string, number>;
};

const comparisonFrameworkKeys = ["greencomp", "lifecomp", "entrecomp", "digcomp"] as const;

function numericMetric(left: number | undefined, right: number | undefined): ComparisonMetric {
  const safeLeft = Number(left ?? 0);
  const safeRight = Number(right ?? 0);
  return { left: safeLeft, right: safeRight, delta: safeRight - safeLeft };
}

function moduleComparisonKey(module: ComparableModule): string {
  return (module.moduleCode?.trim().toLowerCase() || module.moduleId || module.key).toLowerCase();
}

function comparableModulesFromOverview(overview: Awaited<ReturnType<typeof getProgrammeOverview>>): ComparableModule[] {
  return overview.modules.map((module) => ({
    key: module.moduleId,
    moduleId: module.moduleId,
    moduleCode: module.moduleCode,
    moduleTitle: module.moduleTitle,
    evidenceCount: module.evidenceCount,
    claimCount: module.claimCount,
    reviewStatus: module.reviewStatus,
    dataQualityStatus: module.dataQualityStatus,
  }));
}

function comparableModulesFromProjection(projection: Record<string, unknown>): ComparableModule[] {
  const rows = Array.isArray(projection["rows"]) ? projection["rows"] : [];
  return rows.map((raw, index) => {
    const row = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const module = row["module"] && typeof row["module"] === "object" ? row["module"] as Record<string, unknown> : {};
    const evidence = row["evidence"] && typeof row["evidence"] === "object" ? row["evidence"] as Record<string, unknown> : {};
    return {
      key: String(row["id"] ?? module["id"] ?? index),
      moduleId: typeof module["id"] === "string" ? module["id"] : undefined,
      moduleCode: typeof module["code"] === "string" ? module["code"] : undefined,
      moduleTitle: typeof module["title"] === "string" ? module["title"] : undefined,
      stage: typeof row["stage"] === "string" ? row["stage"] : undefined,
      semester: typeof row["semester"] === "string" ? row["semester"] : undefined,
      credits: typeof row["credits"] === "number" ? row["credits"] : null,
      evidenceCount: typeof evidence["count"] === "number" ? evidence["count"] : 0,
    };
  });
}

function comparableModulesFromSourceRows(modules: Array<typeof sourceModulesTable.$inferSelect>, structures: Array<typeof sourceStructureItemsTable.$inferSelect>): ComparableModule[] {
  const sourceById = new Map(modules.map((module) => [module.id, module]));
  const rows = structures.length > 0
    ? structures.map((structure) => {
        const sourceModule = structure.sourceModuleId ? sourceById.get(structure.sourceModuleId) : undefined;
        return {
          key: structure.externalId ?? structure.id,
          moduleId: sourceModule?.id ?? structure.sourceModuleId,
          moduleCode: sourceModule?.moduleCode,
          moduleTitle: sourceModule?.moduleTitle,
          stage: structure.stage ?? sourceModule?.stage,
          semester: structure.semester ?? sourceModule?.semester,
          credits: Number(structure.credits ?? sourceModule?.credits) || null,
        };
      })
    : modules.map((module) => ({
        key: module.externalId ?? module.id,
        moduleId: module.id,
        moduleCode: module.moduleCode,
        moduleTitle: module.moduleTitle,
        stage: module.stage,
        semester: module.semester,
        credits: Number(module.credits) || null,
      }));
  const byKey = new Map<string, ComparableModule>();
  for (const row of rows) byKey.set(moduleComparisonKey(row), row);
  return [...byKey.values()];
}

function compareModuleSets(leftModules: ComparableModule[], rightModules: ComparableModule[]) {
  const leftByKey = new Map(leftModules.map((module) => [moduleComparisonKey(module), module]));
  const rightByKey = new Map(rightModules.map((module) => [moduleComparisonKey(module), module]));
  const keys = [...new Set([...leftByKey.keys(), ...rightByKey.keys()])].sort();

  const added: ComparableModule[] = [];
  const removed: ComparableModule[] = [];
  const movedStage: Array<{ before: ComparableModule; after: ComparableModule }> = [];
  const movedSemester: Array<{ before: ComparableModule; after: ComparableModule }> = [];
  const creditChanges: Array<{ before: ComparableModule; after: ComparableModule; delta: number }> = [];

  for (const key of keys) {
    const before = leftByKey.get(key);
    const after = rightByKey.get(key);
    if (!before && after) added.push(after);
    if (before && !after) removed.push(before);
    if (!before || !after) continue;
    if ((before.stage ?? "") !== (after.stage ?? "")) movedStage.push({ before, after });
    if ((before.semester ?? "") !== (after.semester ?? "")) movedSemester.push({ before, after });
    if ((before.credits ?? null) !== (after.credits ?? null)) creditChanges.push({ before, after, delta: Number(after.credits ?? 0) - Number(before.credits ?? 0) });
  }

  return {
    modulesAdded: added,
    modulesRemoved: removed,
    modulesMovedStage: movedStage,
    modulesMovedSemester: movedSemester,
    creditChanges,
    structureChanges: movedStage.length + movedSemester.length + creditChanges.length,
  };
}

function emptyFrameworkCompetencies(): Record<string, FrameworkCompetencyMarker[]> {
  return Object.fromEntries(comparisonFrameworkKeys.map((key) => [key, []]));
}

async function frameworkCompetencyMarkersForProgramme(
  context: ActorContext,
  programmeVersionId: string,
  modules: ComparableModule[],
): Promise<Record<string, FrameworkCompetencyMarker[]>> {
  const moduleIds = modules.map((module) => module.moduleId).filter((id): id is string => Boolean(id));
  const rows = await db
    .select({
      competency: competenciesTable,
      framework: frameworksTable,
    })
    .from(competencyEvaluationsTable)
    .leftJoin(competenciesTable, eq(competencyEvaluationsTable.competencyId, competenciesTable.id))
    .leftJoin(frameworkVersionsTable, eq(competenciesTable.frameworkVersionId, frameworkVersionsTable.id))
    .leftJoin(frameworksTable, eq(frameworkVersionsTable.frameworkId, frameworksTable.id))
    .where(and(
      eq(competencyEvaluationsTable.institutionId, context.institutionId),
      moduleIds.length
        ? or(eq(competencyEvaluationsTable.programmeVersionId, programmeVersionId), inArray(competencyEvaluationsTable.moduleId, moduleIds))
        : eq(competencyEvaluationsTable.programmeVersionId, programmeVersionId),
    ));

  const markers = emptyFrameworkCompetencies();
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.competency || !row.framework || !comparisonFrameworkKeys.includes(row.framework.key as typeof comparisonFrameworkKeys[number])) continue;
    const seenKey = `${row.framework.key}:${row.competency.id}`;
    if (seen.has(seenKey)) continue;
    seen.add(seenKey);
    markers[row.framework.key].push({
      id: row.competency.id,
      key: row.competency.key,
      name: row.competency.name,
      frameworkKey: row.framework.key,
    });
  }
  return markers;
}

function compareCompetencyMarkers(left: FrameworkCompetencyMarker[], right: FrameworkCompetencyMarker[]) {
  const leftById = new Map(left.map((competency) => [competency.id, competency]));
  const rightById = new Map(right.map((competency) => [competency.id, competency]));
  return {
    competenciesAdded: right.filter((competency) => !leftById.has(competency.id)),
    competenciesRemoved: left.filter((competency) => !rightById.has(competency.id)),
  };
}

function compareFrameworks(
  left: Partial<FrameworkCoverageRecord>,
  right: Partial<FrameworkCoverageRecord>,
  leftCompetencies: Record<string, FrameworkCompetencyMarker[]>,
  rightCompetencies: Record<string, FrameworkCompetencyMarker[]>,
) {
  return Object.fromEntries(comparisonFrameworkKeys.map((key) => {
    const leftCoverage = left[key] ?? { totalCompetencies: 0, observedCompetencies: 0, coveragePercent: 0 };
    const rightCoverage = right[key] ?? { totalCompetencies: 0, observedCompetencies: 0, coveragePercent: 0 };
    const competencyChanges = compareCompetencyMarkers(leftCompetencies[key] ?? [], rightCompetencies[key] ?? []);
    return [key, {
      observedCompetencies: numericMetric(leftCoverage.observedCompetencies, rightCoverage.observedCompetencies),
      coveragePercent: numericMetric(leftCoverage.coveragePercent, rightCoverage.coveragePercent),
      totalCompetencies: numericMetric(leftCoverage.totalCompetencies, rightCoverage.totalCompetencies),
      ...competencyChanges,
    }];
  }));
}

function compareCountRecords(left: Record<string, number>, right: Record<string, number>) {
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
  return Object.fromEntries(keys.map((key) => [key, numericMetric(left[key], right[key])]));
}

function comparisonToCsv(comparison: Awaited<ReturnType<typeof compareProgrammeStates>>): string {
  const rows = [
    ["Section", "Metric", "Left", "Right", "Delta"],
    ["summary", "modulesAdded", "0", comparison.summary.modulesAdded, comparison.summary.modulesAdded],
    ["summary", "modulesRemoved", "0", comparison.summary.modulesRemoved, comparison.summary.modulesRemoved],
    ["summary", "frameworkChanges", "0", comparison.summary.frameworkChanges, comparison.summary.frameworkChanges],
    ["summary", "maturityChanges", "0", comparison.summary.maturityChanges, comparison.summary.maturityChanges],
    ["summary", "reviewChanges", "0", comparison.summary.reviewChanges, comparison.summary.reviewChanges],
    ["summary", "dataQualityChanges", "0", comparison.summary.dataQualityChanges, comparison.summary.dataQualityChanges],
    ...Object.entries(comparison.frameworkChanges.frameworks).flatMap(([framework, metrics]) => [
      ["framework", `${framework}.observedCompetencies`, metrics.observedCompetencies.left, metrics.observedCompetencies.right, metrics.observedCompetencies.delta],
      ["framework", `${framework}.coveragePercent`, metrics.coveragePercent.left, metrics.coveragePercent.right, metrics.coveragePercent.delta],
      ["framework", `${framework}.competenciesAdded`, "0", metrics.competenciesAdded.length, metrics.competenciesAdded.length],
      ["framework", `${framework}.competenciesRemoved`, "0", metrics.competenciesRemoved.length, metrics.competenciesRemoved.length],
    ]),
    ...Object.entries(comparison.reviewChanges).map(([key, metric]) => ["review", key, metric.left, metric.right, metric.delta]),
    ...Object.entries(comparison.dataQualityChanges).map(([key, metric]) => ["data_quality", key, metric.left, metric.right, metric.delta]),
  ];
  return rows.map((row) => row.map((value) => {
    const text = String(value ?? "");
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }).join(",")).join("\n");
}

async function programmeVersionComparisonSource(context: ActorContext, id: string) {
  const overview = await getProgrammeOverview(context, id);
  const modules = comparableModulesFromOverview(overview);
  return {
    label: `${overview.programme.code ?? "No code"} - ${overview.programme.title ?? "Untitled"} (${overview.programme.versionLabel})`,
    modules,
    frameworkCoverage: overview.curriculumCoverage.frameworks,
    frameworkCompetencies: await frameworkCompetencyMarkersForProgramme(context, id, modules),
    maturityDistribution: overview.curriculumCoverage.evidenceMaturityDistribution,
    reviewStatus: overview.reviewStatus,
    dataQuality: overview.dataQuality,
  } satisfies ComparisonSource;
}

async function snapshotComparisonSource(context: ActorContext, id: string) {
  const [snapshot] = await db
    .select({ version: programmeMapVersionsTable, map: programmeMapsTable })
    .from(programmeMapVersionsTable)
    .innerJoin(programmeMapsTable, eq(programmeMapVersionsTable.programmeMapId, programmeMapsTable.id))
    .where(and(eq(programmeMapVersionsTable.id, id), eq(programmeMapsTable.institutionId, context.institutionId)))
    .limit(1);
  if (!snapshot) throw new Error("Programme map snapshot not found");
  const projection = (snapshot.version.snapshot?.["projection"] ?? {}) as Record<string, unknown>;
  const summary = projection["summary"] && typeof projection["summary"] === "object" ? projection["summary"] as Record<string, unknown> : {};
  return {
    label: snapshot.version.versionLabel,
    modules: comparableModulesFromProjection(projection),
    frameworkCoverage: {},
    frameworkCompetencies: emptyFrameworkCompetencies(),
    maturityDistribution: {},
    reviewStatus: {
      claimsGenerated: 0,
      claimsReviewed: 0,
      findingsAccepted: 0,
      findingsAmended: 0,
      findingsRequiringClarification: 0,
    },
    dataQuality: {
      missingModuleCodes: 0,
      missingCredits: 0,
      missingStageSemester: 0,
      duplicatePlacementWarnings: 0,
      modulesWithNoLearningOutcomes: 0,
      modulesWithNoAssessments: Number(summary["missingDescriptorCount"] ?? 0),
    },
  } satisfies ComparisonSource;
}

async function uploadComparisonSource(context: ActorContext, id: string) {
  const [batch] = await db
    .select()
    .from(importBatchesTable)
    .where(and(eq(importBatchesTable.id, id), eq(importBatchesTable.institutionId, context.institutionId)))
    .limit(1);
  if (!batch) throw new Error("Upload/import batch not found");
  const [modules, structures] = await Promise.all([
    db.select().from(sourceModulesTable).where(and(eq(sourceModulesTable.importBatchId, id), eq(sourceModulesTable.institutionId, context.institutionId))),
    db.select().from(sourceStructureItemsTable).where(and(eq(sourceStructureItemsTable.importBatchId, id), eq(sourceStructureItemsTable.institutionId, context.institutionId))),
  ]);
  const comparableModules = comparableModulesFromSourceRows(modules, structures);
  const missingCodes = comparableModules.filter((module) => !module.moduleCode).length;
  const missingCredits = comparableModules.filter((module) => module.credits == null).length;
  const missingStageSemester = comparableModules.filter((module) => !module.stage || !module.semester).length;
  return {
    label: `${batch.batchType} upload ${batch.createdAt.toISOString().slice(0, 10)}`,
    modules: comparableModules,
    frameworkCoverage: {},
    frameworkCompetencies: emptyFrameworkCompetencies(),
    maturityDistribution: {},
    reviewStatus: {
      claimsGenerated: 0,
      claimsReviewed: 0,
      findingsAccepted: 0,
      findingsAmended: 0,
      findingsRequiringClarification: 0,
    },
    dataQuality: {
      missingModuleCodes: missingCodes,
      missingCredits,
      missingStageSemester,
      duplicatePlacementWarnings: 0,
      modulesWithNoLearningOutcomes: 0,
      modulesWithNoAssessments: 0,
    },
  } satisfies ComparisonSource;
}

export async function listProgrammeComparisonOptions(context: ActorContext) {
  const [programmeVersions, snapshots, importBatches] = await Promise.all([
    listProgrammeVersions(context),
    db
      .select({ version: programmeMapVersionsTable, map: programmeMapsTable })
      .from(programmeMapVersionsTable)
      .innerJoin(programmeMapsTable, eq(programmeMapVersionsTable.programmeMapId, programmeMapsTable.id))
      .where(eq(programmeMapsTable.institutionId, context.institutionId))
      .orderBy(desc(programmeMapVersionsTable.createdAt)),
    db.select().from(importBatchesTable).where(eq(importBatchesTable.institutionId, context.institutionId)).orderBy(desc(importBatchesTable.createdAt)),
  ]);

  return {
    programmeVersions,
    snapshots: snapshots
      .filter((row) => row.version.versionLabel !== "Workspace")
      .map((row) => ({
        id: row.version.id,
        label: row.version.versionLabel,
        programmeMapName: row.map.name,
        createdAt: row.version.createdAt,
      })),
    uploads: importBatches.map((batch) => ({
      id: batch.id,
      label: `${batch.batchType} upload ${batch.createdAt.toISOString().slice(0, 10)}`,
      status: batch.status,
      createdAt: batch.createdAt,
      summary: batch.summary,
    })),
  };
}

export async function compareProgrammeStates(
  context: ActorContext,
  input: { mode?: ProgrammeComparisonMode; leftId?: string; rightId?: string },
) {
  const mode = input.mode ?? "programme_version";
  if (!input.leftId || !input.rightId) throw new Error("Both comparison targets are required");
  const sourceFor = mode === "snapshot" ? snapshotComparisonSource : mode === "upload" ? uploadComparisonSource : programmeVersionComparisonSource;
  const [left, right] = await Promise.all([sourceFor(context, input.leftId), sourceFor(context, input.rightId)]);
  const curriculumChanges = compareModuleSets(left.modules, right.modules);
  const frameworkChanges = {
    frameworks: compareFrameworks(left.frameworkCoverage, right.frameworkCoverage, left.frameworkCompetencies, right.frameworkCompetencies),
    maturityDistribution: compareCountRecords(left.maturityDistribution, right.maturityDistribution),
  };
  const reviewChanges = Object.fromEntries(Object.keys(left.reviewStatus).map((key) => [
    key,
    numericMetric(left.reviewStatus[key as keyof typeof left.reviewStatus], right.reviewStatus[key as keyof typeof right.reviewStatus]),
  ]));
  const dataQualityChanges = Object.fromEntries(Object.keys(left.dataQuality).map((key) => [
    key,
    numericMetric(left.dataQuality[key as keyof typeof left.dataQuality], right.dataQuality[key as keyof typeof right.dataQuality]),
  ]));

  const frameworkChangeCount = Object.values(frameworkChanges.frameworks).reduce((sum, metrics) => (
    sum
    + Math.abs(metrics.coveragePercent.delta)
    + Math.abs(metrics.observedCompetencies.delta)
    + metrics.competenciesAdded.length
    + metrics.competenciesRemoved.length
  ), 0);
  const maturityChangeCount = Object.values(frameworkChanges.maturityDistribution).reduce((sum, metric) => sum + Math.abs(metric.delta), 0);
  const reviewChangeCount = Object.values(reviewChanges).reduce((sum, metric) => sum + Math.abs(metric.delta), 0);
  const qualityChangeCount = Object.values(dataQualityChanges).reduce((sum, metric) => sum + Math.abs(metric.delta), 0);

  return {
    mode,
    left: { id: input.leftId, label: left.label },
    right: { id: input.rightId, label: right.label },
    summary: {
      modulesAdded: curriculumChanges.modulesAdded.length,
      modulesRemoved: curriculumChanges.modulesRemoved.length,
      modulesMovedStage: curriculumChanges.modulesMovedStage.length,
      modulesMovedSemester: curriculumChanges.modulesMovedSemester.length,
      creditChanges: curriculumChanges.creditChanges.length,
      frameworkChanges: frameworkChangeCount,
      maturityChanges: maturityChangeCount,
      reviewChanges: reviewChangeCount,
      dataQualityChanges: qualityChangeCount,
    },
    curriculumChanges,
    frameworkChanges,
    reviewChanges,
    dataQualityChanges,
  };
}

export async function exportProgrammeComparison(
  context: ActorContext,
  input: { mode?: ProgrammeComparisonMode; leftId?: string; rightId?: string; format?: "json" | "csv" },
) {
  const comparison = await compareProgrammeStates(context, input);
  const format = input.format === "csv" ? "csv" : "json";
  const payload = format === "csv" ? comparisonToCsv(comparison) : JSON.stringify(comparison, null, 2);
  return {
    comparison,
    filename: `cast-programme-comparison-${comparison.mode}.${format}`,
    contentType: format === "csv" ? "text/csv" : "application/json",
    payload,
  };
}

export async function mapPreview(context: ActorContext, programmeVersionId: string) {
  const structureData = await getCuratedStructure(context, programmeVersionId);
  const moduleIds = structureData.items.map((item) => item.moduleId).filter((id): id is string => Boolean(id));
  const modules = moduleIds.length > 0 ? await db.select().from(modulesTable).where(inArray(modulesTable.id, moduleIds)) : [];
  const descriptorIds = structureData.items.map((item) => item.moduleDescriptorId).filter((id): id is string => Boolean(id));
  const descriptors = descriptorIds.length > 0 ? await db.select().from(moduleDescriptorsTable).where(inArray(moduleDescriptorsTable.id, descriptorIds)) : [];

  return {
    programmeVersionId,
    structureId: structureData.structure?.id,
    rows: structureData.items.map((item) => {
      const module = modules.find((candidate) => candidate.id === item.moduleId);
      const descriptor = descriptors.find((candidate) => candidate.id === item.moduleDescriptorId);
      return {
        structureItemId: item.id,
        stage: item.stage,
        semester: item.semester,
        pathway: item.pathway,
        coreOption: item.coreOption,
        credits: item.credits,
        moduleId: item.moduleId,
        moduleCode: module?.moduleCode,
        moduleTitle: module?.moduleTitle ?? item.label,
        moduleDescriptorId: item.moduleDescriptorId,
        descriptorStatus: descriptor?.status ?? "missing",
        sourceStructureItemId: item.sourceStructureItemId,
      };
    }),
  };
}
