import { and, count, eq, inArray, or, sql } from "drizzle-orm";
import {
  actionPlanItemsTable,
  actionPlanEvidenceLinksTable,
  actionPlansTable,
  aiClaimsTable,
  analysisRunsTable,
  claimEvidenceLinksTable,
  clarificationRequestsTable,
  curatedStructureItemsTable,
  curatedStructuresTable,
  dataQualityResultLinksTable,
  dataQualityResultsTable,
  dataQualityRunsTable,
  descriptorSectionsTable,
  db,
  evidenceItemsTable,
  humanReviewsTable,
  importBatchesTable,
  ingestionRecordLinksTable,
  ingestionRunsTable,
  moduleDescriptorsTable,
  modulesTable,
  programmeVersionsTable,
  readinessAssessmentItemsTable,
  readinessAssessmentsTable,
  reviewCyclesTable,
  swotItemsTable,
  sourceModulesTable,
  sourceProgrammesTable,
  sourceRecordsTable,
  sourceStructureItemsTable,
} from "@workspace/db";

type ActorContext = {
  institutionId: string;
  userId?: string;
};

export type CleanupResult = {
  action: "archive" | "delete";
  subject: "module" | "programme_version" | "import_batch";
  subjectId: string;
  archived?: boolean;
  deleted?: boolean;
  counts?: Record<string, number>;
  blockedReasons?: string[];
  diagnostics?: CleanupDiagnostics;
  bootstrapOverride?: boolean;
};

export type CleanupDiagnostics = {
  claims: number;
  humanReviews: number;
  acceptedFindings: number;
  amendedFindings: number;
  findings: number;
  clarificationRequests: number;
  analysisRuns: number;
  reviewCycles: number;
  readinessAssessments: number;
  readinessItems: number;
  swotItems: number;
  actionPlans: number;
  actionPlanItems: number;
  actionPlanReferences: number;
  blockedReasons: string[];
  canHardDelete: boolean;
};

function ids<T extends { id: string }>(rows: T[]): string[] {
  return rows.map((row) => row.id);
}

function uniqueById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

async function countHumanReviews(context: ActorContext, input: { moduleIds?: string[]; programmeVersionIds?: string[] }) {
  const conditions = [];
  if (input.moduleIds?.length) conditions.push(inArray(aiClaimsTable.moduleId, input.moduleIds));
  if (input.programmeVersionIds?.length) conditions.push(inArray(aiClaimsTable.programmeVersionId, input.programmeVersionIds));
  if (conditions.length === 0) return 0;

  const [row] = await db
    .select({ total: count(humanReviewsTable.id) })
    .from(humanReviewsTable)
    .innerJoin(aiClaimsTable, eq(humanReviewsTable.aiClaimId, aiClaimsTable.id))
    .where(and(eq(humanReviewsTable.institutionId, context.institutionId), or(...conditions)));
  return Number(row?.total ?? 0);
}

async function countActionPlanUsage(context: ActorContext, input: { moduleIds?: string[]; programmeVersionIds?: string[]; evidenceIds?: string[] }) {
  let total = 0;

  if (input.programmeVersionIds?.length) {
    const [row] = await db
      .select({ total: count(actionPlansTable.id) })
      .from(actionPlansTable)
      .where(and(eq(actionPlansTable.institutionId, context.institutionId), inArray(actionPlansTable.programmeVersionId, input.programmeVersionIds)));
    total += Number(row?.total ?? 0);
  }

  if (input.evidenceIds?.length) {
    const [row] = await db
      .select({ total: count(actionPlanEvidenceLinksTable.id) })
      .from(actionPlanEvidenceLinksTable)
      .where(inArray(actionPlanEvidenceLinksTable.evidenceItemId, input.evidenceIds));
    total += Number(row?.total ?? 0);
  }

  if (input.moduleIds?.length) {
    const evidence = await db
      .select({ id: evidenceItemsTable.id })
      .from(evidenceItemsTable)
      .where(and(eq(evidenceItemsTable.institutionId, context.institutionId), inArray(evidenceItemsTable.moduleId, input.moduleIds)));
    if (evidence.length) {
      const [row] = await db
        .select({ total: count(actionPlanEvidenceLinksTable.id) })
        .from(actionPlanEvidenceLinksTable)
        .where(inArray(actionPlanEvidenceLinksTable.evidenceItemId, ids(evidence)));
      total += Number(row?.total ?? 0);
    }
  }

  return total;
}

async function cleanupDiagnosticsForScope(
  context: ActorContext,
  input: { moduleIds?: string[]; programmeVersionIds?: string[]; evidenceIds?: string[] },
): Promise<CleanupDiagnostics> {
  const claimConditions = [];
  if (input.moduleIds?.length) claimConditions.push(inArray(aiClaimsTable.moduleId, input.moduleIds));
  if (input.programmeVersionIds?.length) claimConditions.push(inArray(aiClaimsTable.programmeVersionId, input.programmeVersionIds));

  const claimRows = claimConditions.length
    ? await db
        .select({ id: aiClaimsTable.id, analysisRunId: aiClaimsTable.analysisRunId })
        .from(aiClaimsTable)
        .where(and(eq(aiClaimsTable.institutionId, context.institutionId), or(...claimConditions)))
    : [];
  const claimIds = ids(claimRows);
  const analysisRunIds = [...new Set(claimRows.map((claim) => claim.analysisRunId).filter((id): id is string => Boolean(id)))];

  const humanReviewRows = claimIds.length
    ? await db
        .select({ id: humanReviewsTable.id, aiClaimId: humanReviewsTable.aiClaimId, decision: humanReviewsTable.decision })
        .from(humanReviewsTable)
        .where(and(eq(humanReviewsTable.institutionId, context.institutionId), inArray(humanReviewsTable.aiClaimId, claimIds)))
    : [];

  const acceptedFindingClaimIds = new Set(
    humanReviewRows
      .filter((review) => review.decision === "accept" && review.aiClaimId)
      .map((review) => review.aiClaimId as string),
  );
  const amendedFindingClaimIds = new Set(
    humanReviewRows
      .filter((review) => review.decision === "amend" && review.aiClaimId)
      .map((review) => review.aiClaimId as string),
  );
  const findingClaimIds = new Set([...acceptedFindingClaimIds, ...amendedFindingClaimIds]);

  const clarificationRows = claimIds.length
    ? await db
        .select({ id: clarificationRequestsTable.id })
        .from(clarificationRequestsTable)
        .where(and(eq(clarificationRequestsTable.institutionId, context.institutionId), inArray(clarificationRequestsTable.aiClaimId, claimIds)))
    : [];

  const reviewCycles = input.programmeVersionIds?.length
    ? await db
        .select({ id: reviewCyclesTable.id })
        .from(reviewCyclesTable)
        .where(and(eq(reviewCyclesTable.institutionId, context.institutionId), inArray(reviewCyclesTable.programmeVersionId, input.programmeVersionIds)))
    : [];
  const reviewCycleIds = ids(reviewCycles);

  const readinessConditions = [];
  if (input.programmeVersionIds?.length) readinessConditions.push(inArray(readinessAssessmentsTable.programmeVersionId, input.programmeVersionIds));
  if (reviewCycleIds.length) readinessConditions.push(inArray(readinessAssessmentsTable.reviewCycleId, reviewCycleIds));
  const readinessAssessments = readinessConditions.length
    ? await db
        .select({ id: readinessAssessmentsTable.id })
        .from(readinessAssessmentsTable)
        .where(and(eq(readinessAssessmentsTable.institutionId, context.institutionId), or(...readinessConditions)))
    : [];
  const readinessAssessmentIds = ids(readinessAssessments);
  const readinessItems = readinessAssessmentIds.length
    ? await db
        .select({ id: readinessAssessmentItemsTable.id })
        .from(readinessAssessmentItemsTable)
        .where(inArray(readinessAssessmentItemsTable.readinessAssessmentId, readinessAssessmentIds))
    : [];

  const swotConditions = [];
  if (input.programmeVersionIds?.length) swotConditions.push(inArray(swotItemsTable.programmeVersionId, input.programmeVersionIds));
  if (reviewCycleIds.length) swotConditions.push(inArray(swotItemsTable.reviewCycleId, reviewCycleIds));
  const swotItems = swotConditions.length
    ? await db
        .select({ id: swotItemsTable.id })
        .from(swotItemsTable)
        .where(and(eq(swotItemsTable.institutionId, context.institutionId), or(...swotConditions)))
    : [];

  const actionPlanConditions = [];
  if (input.programmeVersionIds?.length) actionPlanConditions.push(inArray(actionPlansTable.programmeVersionId, input.programmeVersionIds));
  if (reviewCycleIds.length) actionPlanConditions.push(inArray(actionPlansTable.reviewCycleId, reviewCycleIds));
  const actionPlans = actionPlanConditions.length
    ? await db
        .select({ id: actionPlansTable.id })
        .from(actionPlansTable)
        .where(and(eq(actionPlansTable.institutionId, context.institutionId), or(...actionPlanConditions)))
    : [];
  const actionPlanIds = ids(actionPlans);
  const actionPlanItems = actionPlanIds.length
    ? await db
        .select({ id: actionPlanItemsTable.id })
        .from(actionPlanItemsTable)
        .where(inArray(actionPlanItemsTable.actionPlanId, actionPlanIds))
    : [];

  const actionPlanReferences = await countActionPlanUsage(context, input);
  const blockedReasons: string[] = [];
  if (humanReviewRows.length > 0) {
    blockedReasons.push(`${humanReviewRows.length} human review record${humanReviewRows.length === 1 ? "" : "s"} exist`);
  }
  if (actionPlanReferences > 0) {
    blockedReasons.push(`${actionPlanReferences} action plan reference${actionPlanReferences === 1 ? "" : "s"} exist`);
  }

  return {
    claims: claimRows.length,
    humanReviews: humanReviewRows.length,
    acceptedFindings: acceptedFindingClaimIds.size,
    amendedFindings: amendedFindingClaimIds.size,
    findings: findingClaimIds.size,
    clarificationRequests: clarificationRows.length,
    analysisRuns: analysisRunIds.length,
    reviewCycles: reviewCycles.length,
    readinessAssessments: readinessAssessments.length,
    readinessItems: readinessItems.length,
    swotItems: swotItems.length,
    actionPlans: actionPlans.length,
    actionPlanItems: actionPlanItems.length,
    actionPlanReferences,
    blockedReasons,
    canHardDelete: blockedReasons.length === 0,
  };
}

async function moduleScope(context: ActorContext, moduleId: string) {
  const [module] = await db
    .select()
    .from(modulesTable)
    .where(and(eq(modulesTable.id, moduleId), eq(modulesTable.institutionId, context.institutionId)))
    .limit(1);
  if (!module) throw new Error("Module not found");

  const descriptors = await db
    .select()
    .from(moduleDescriptorsTable)
    .where(and(eq(moduleDescriptorsTable.institutionId, context.institutionId), eq(moduleDescriptorsTable.moduleId, module.id)));
  const descriptorSections = descriptors.length
    ? await db
        .select()
        .from(descriptorSectionsTable)
        .where(and(eq(descriptorSectionsTable.institutionId, context.institutionId), inArray(descriptorSectionsTable.moduleDescriptorId, ids(descriptors))))
    : [];
  const evidence = await db
    .select()
    .from(evidenceItemsTable)
    .where(and(eq(evidenceItemsTable.institutionId, context.institutionId), eq(evidenceItemsTable.moduleId, module.id)));

  return { module, descriptors, descriptorSections, evidence };
}

async function importBatchScope(context: ActorContext, importBatchId: string) {
  const [batch] = await db
    .select()
    .from(importBatchesTable)
    .where(and(eq(importBatchesTable.id, importBatchId), eq(importBatchesTable.institutionId, context.institutionId)))
    .limit(1);
  if (!batch) throw new Error("Upload not found");

  const [sourceModules, sourceProgrammes, sourceRecords, sourceStructureItems] = await Promise.all([
    db.select().from(sourceModulesTable).where(and(eq(sourceModulesTable.institutionId, context.institutionId), eq(sourceModulesTable.importBatchId, importBatchId))),
    db.select().from(sourceProgrammesTable).where(and(eq(sourceProgrammesTable.institutionId, context.institutionId), eq(sourceProgrammesTable.importBatchId, importBatchId))),
    db.select().from(sourceRecordsTable).where(and(eq(sourceRecordsTable.institutionId, context.institutionId), eq(sourceRecordsTable.importBatchId, importBatchId))),
    db.select().from(sourceStructureItemsTable).where(and(eq(sourceStructureItemsTable.institutionId, context.institutionId), eq(sourceStructureItemsTable.importBatchId, importBatchId))),
  ]);

  const sourceModuleIds = ids(sourceModules);
  const sourceProgrammeIds = ids(sourceProgrammes);
  const sourceStructureItemIds = ids(sourceStructureItems);
  const sourceRecordIds = ids(sourceRecords);

  const modules = sourceModuleIds.length
    ? await db.select().from(modulesTable).where(and(eq(modulesTable.institutionId, context.institutionId), inArray(modulesTable.sourceModuleId, sourceModuleIds)))
    : [];
  const descriptors = sourceModuleIds.length
    ? await db.select().from(moduleDescriptorsTable).where(and(eq(moduleDescriptorsTable.institutionId, context.institutionId), inArray(moduleDescriptorsTable.sourceModuleId, sourceModuleIds)))
    : [];
  const programmeVersionsFromSource = sourceProgrammeIds.length
    ? await db.select().from(programmeVersionsTable).where(and(eq(programmeVersionsTable.institutionId, context.institutionId), inArray(programmeVersionsTable.sourceProgrammeId, sourceProgrammeIds)))
    : [];
  const structureItems = sourceStructureItemIds.length
    ? await db.select().from(curatedStructureItemsTable).where(and(eq(curatedStructureItemsTable.institutionId, context.institutionId), inArray(curatedStructureItemsTable.sourceStructureItemId, sourceStructureItemIds)))
    : [];
  const structuresFromProgrammes = programmeVersionsFromSource.length
    ? await db.select().from(curatedStructuresTable).where(and(eq(curatedStructuresTable.institutionId, context.institutionId), inArray(curatedStructuresTable.programmeVersionId, ids(programmeVersionsFromSource))))
    : [];
  const structureIdsFromItems = [...new Set(structureItems.map((item) => item.curatedStructureId).filter((id): id is string => Boolean(id)))];
  const structuresFromItems = structureIdsFromItems.length
    ? await db.select().from(curatedStructuresTable).where(and(eq(curatedStructuresTable.institutionId, context.institutionId), inArray(curatedStructuresTable.id, structureIdsFromItems)))
    : [];
  const structures = uniqueById([...structuresFromProgrammes, ...structuresFromItems]);
  const programmeVersions = programmeVersionsFromSource;
  const moduleIds = ids(modules);
  const descriptorIds = ids(descriptors);
  const descriptorSections = descriptorIds.length
    ? await db
        .select()
        .from(descriptorSectionsTable)
        .where(and(eq(descriptorSectionsTable.institutionId, context.institutionId), inArray(descriptorSectionsTable.moduleDescriptorId, descriptorIds)))
    : [];
  const descriptorSectionIds = ids(descriptorSections);
  const evidence = moduleIds.length
    ? await db
        .select()
        .from(evidenceItemsTable)
        .where(and(eq(evidenceItemsTable.institutionId, context.institutionId), inArray(evidenceItemsTable.moduleId, moduleIds)))
    : [];

  return {
    batch,
    sourceModuleIds,
    sourceProgrammeIds,
    sourceRecordIds,
    sourceStructureItemIds,
    moduleIds,
    descriptorIds,
    descriptorSectionIds,
    programmeVersionIds: ids(programmeVersions),
    curatedStructureIds: ids(structures),
    curatedStructureItemIds: ids(structureItems),
    evidenceIds: ids(evidence),
  };
}

async function assertCanHardDelete(context: ActorContext, input: { moduleIds?: string[]; programmeVersionIds?: string[]; evidenceIds?: string[] }) {
  const diagnostics = await cleanupDiagnosticsForScope(context, input);
  const blockedReasons = diagnostics.blockedReasons;

  if (blockedReasons.length > 0) {
    const error = new Error(`Cannot delete because ${blockedReasons.join(" and ")}.`);
    (error as Error & { blockedReasons?: string[]; diagnostics?: CleanupDiagnostics }).blockedReasons = blockedReasons;
    (error as Error & { blockedReasons?: string[]; diagnostics?: CleanupDiagnostics }).diagnostics = diagnostics;
    throw error;
  }
}

export async function listCleanupImportBatches(context: ActorContext) {
  const batches = await db
    .select()
    .from(importBatchesTable)
    .where(eq(importBatchesTable.institutionId, context.institutionId))
    .orderBy(sql`${importBatchesTable.createdAt} desc`);

  return {
    importBatches: await Promise.all(batches.map(async (batch) => {
      const scope = await importBatchScope(context, batch.id);
      return {
        id: batch.id,
        label: batch.externalBatchId ?? `Upload ${batch.id.slice(0, 8)}`,
        type: batch.batchType,
        status: batch.status,
        createdAt: batch.createdAt?.toISOString() ?? null,
        completedAt: batch.completedAt?.toISOString() ?? null,
        summary: batch.summary,
        counts: {
          sourceModules: scope.sourceModuleIds.length,
          modules: scope.moduleIds.length,
          sourceProgrammes: scope.sourceProgrammeIds.length,
          programmeVersions: scope.programmeVersionIds.length,
          structureItems: scope.curatedStructureItemIds.length,
        },
        cleanupDiagnostics: await cleanupDiagnosticsForScope(context, {
          moduleIds: scope.moduleIds,
          programmeVersionIds: scope.programmeVersionIds,
          evidenceIds: scope.evidenceIds,
        }),
      };
    })),
  };
}

export async function archiveModule(context: ActorContext, moduleId: string): Promise<CleanupResult> {
  const scope = await moduleScope(context, moduleId);
  await db.update(modulesTable).set({ status: "archived", updatedAt: new Date() }).where(eq(modulesTable.id, moduleId));
  if (scope.descriptors.length) {
    await db.update(moduleDescriptorsTable).set({ status: "archived", updatedAt: new Date() }).where(inArray(moduleDescriptorsTable.id, ids(scope.descriptors)));
  }
  return { action: "archive", subject: "module", subjectId: moduleId, archived: true, counts: { descriptors: scope.descriptors.length } };
}

export async function hardDeleteModule(context: ActorContext, moduleId: string): Promise<CleanupResult> {
  const scope = await moduleScope(context, moduleId);
  if (!scope.module.sourceModuleId && scope.module.metadata?.["ingestion"] !== true) {
    throw new Error("Only uploaded test modules can be hard deleted. Archive curated modules instead.");
  }
  await assertCanHardDelete(context, { moduleIds: [moduleId], evidenceIds: ids(scope.evidence) });

  const descriptorIds = ids(scope.descriptors);
  const descriptorSectionIds = ids(scope.descriptorSections);
  const evidenceIds = ids(scope.evidence);
  if (evidenceIds.length) {
    await db.delete(dataQualityResultLinksTable).where(inArray(dataQualityResultLinksTable.evidenceItemId, evidenceIds));
    await db.delete(claimEvidenceLinksTable).where(inArray(claimEvidenceLinksTable.evidenceItemId, evidenceIds));
  }
  await db.delete(dataQualityResultLinksTable).where(eq(dataQualityResultLinksTable.moduleId, moduleId));
  if (descriptorIds.length) await db.delete(dataQualityResultLinksTable).where(inArray(dataQualityResultLinksTable.moduleDescriptorId, descriptorIds));
  await db.delete(ingestionRecordLinksTable).where(eq(ingestionRecordLinksTable.moduleId, moduleId));
  if (descriptorIds.length) await db.delete(ingestionRecordLinksTable).where(inArray(ingestionRecordLinksTable.moduleDescriptorId, descriptorIds));
  if (descriptorSectionIds.length) await db.delete(ingestionRecordLinksTable).where(inArray(ingestionRecordLinksTable.descriptorSectionId, descriptorSectionIds));
  if (evidenceIds.length) await db.delete(ingestionRecordLinksTable).where(inArray(ingestionRecordLinksTable.evidenceItemId, evidenceIds));
  await db.delete(aiClaimsTable).where(and(eq(aiClaimsTable.institutionId, context.institutionId), eq(aiClaimsTable.moduleId, moduleId)));
  if (evidenceIds.length) await db.delete(evidenceItemsTable).where(inArray(evidenceItemsTable.id, evidenceIds));
  await db.delete(modulesTable).where(eq(modulesTable.id, moduleId));

  return { action: "delete", subject: "module", subjectId: moduleId, deleted: true, counts: { descriptors: descriptorIds.length, evidenceItems: evidenceIds.length } };
}

export async function archiveProgrammeVersion(context: ActorContext, programmeVersionId: string): Promise<CleanupResult> {
  const [programme] = await db
    .select()
    .from(programmeVersionsTable)
    .where(and(eq(programmeVersionsTable.id, programmeVersionId), eq(programmeVersionsTable.institutionId, context.institutionId)))
    .limit(1);
  if (!programme) throw new Error("Programme version not found");

  await db.update(programmeVersionsTable).set({ status: "archived", updatedAt: new Date() }).where(eq(programmeVersionsTable.id, programmeVersionId));
  const structures = await db.select().from(curatedStructuresTable).where(eq(curatedStructuresTable.programmeVersionId, programmeVersionId));
  if (structures.length) await db.update(curatedStructuresTable).set({ status: "archived", updatedAt: new Date() }).where(inArray(curatedStructuresTable.id, ids(structures)));
  return { action: "archive", subject: "programme_version", subjectId: programmeVersionId, archived: true, counts: { curatedStructures: structures.length } };
}

export async function hardDeleteImportBatch(
  context: ActorContext,
  importBatchId: string,
  options: { bootstrapOverride?: boolean } = {},
): Promise<CleanupResult> {
  const scope = await importBatchScope(context, importBatchId);
  const diagnosticScope = {
    moduleIds: scope.moduleIds,
    programmeVersionIds: scope.programmeVersionIds,
    evidenceIds: scope.evidenceIds,
  };
  const diagnostics = await cleanupDiagnosticsForScope(context, diagnosticScope);

  if (!options.bootstrapOverride) {
    await assertCanHardDelete(context, diagnosticScope);
  }

  await db.transaction(async (tx) => {
    const allSourceIds = [...scope.sourceRecordIds, ...scope.sourceModuleIds, ...scope.sourceProgrammeIds, ...scope.sourceStructureItemIds];
    if (options.bootstrapOverride) {
      const claimConditions = [];
      if (scope.moduleIds.length) claimConditions.push(inArray(aiClaimsTable.moduleId, scope.moduleIds));
      if (scope.programmeVersionIds.length) claimConditions.push(inArray(aiClaimsTable.programmeVersionId, scope.programmeVersionIds));

      const scopedClaims = claimConditions.length
        ? await tx
            .select({ id: aiClaimsTable.id, analysisRunId: aiClaimsTable.analysisRunId })
            .from(aiClaimsTable)
            .where(and(eq(aiClaimsTable.institutionId, context.institutionId), or(...claimConditions)))
        : [];
      const scopedClaimIds = ids(scopedClaims);
      const scopedAnalysisRunIds = [...new Set(scopedClaims.map((claim) => claim.analysisRunId).filter((id): id is string => Boolean(id)))];
      const reviewCycles = scope.programmeVersionIds.length
        ? await tx
            .select({ id: reviewCyclesTable.id })
            .from(reviewCyclesTable)
            .where(and(eq(reviewCyclesTable.institutionId, context.institutionId), inArray(reviewCyclesTable.programmeVersionId, scope.programmeVersionIds)))
        : [];
      const reviewCycleIds = ids(reviewCycles);
      const actionPlanConditions = [];
      if (scope.programmeVersionIds.length) actionPlanConditions.push(inArray(actionPlansTable.programmeVersionId, scope.programmeVersionIds));
      if (reviewCycleIds.length) actionPlanConditions.push(inArray(actionPlansTable.reviewCycleId, reviewCycleIds));
      const swotConditions = [];
      if (scope.programmeVersionIds.length) swotConditions.push(inArray(swotItemsTable.programmeVersionId, scope.programmeVersionIds));
      if (reviewCycleIds.length) swotConditions.push(inArray(swotItemsTable.reviewCycleId, reviewCycleIds));
      const readinessConditions = [];
      if (scope.programmeVersionIds.length) readinessConditions.push(inArray(readinessAssessmentsTable.programmeVersionId, scope.programmeVersionIds));
      if (reviewCycleIds.length) readinessConditions.push(inArray(readinessAssessmentsTable.reviewCycleId, reviewCycleIds));

      if (actionPlanConditions.length) {
        await tx.delete(actionPlansTable).where(and(eq(actionPlansTable.institutionId, context.institutionId), or(...actionPlanConditions)));
      }
      if (swotConditions.length) {
        await tx.delete(swotItemsTable).where(and(eq(swotItemsTable.institutionId, context.institutionId), or(...swotConditions)));
      }
      if (readinessConditions.length) {
        await tx.delete(readinessAssessmentsTable).where(and(eq(readinessAssessmentsTable.institutionId, context.institutionId), or(...readinessConditions)));
      }
      if (reviewCycleIds.length) await tx.delete(reviewCyclesTable).where(inArray(reviewCyclesTable.id, reviewCycleIds));
      if (scopedClaimIds.length) await tx.delete(aiClaimsTable).where(inArray(aiClaimsTable.id, scopedClaimIds));
      if (scopedAnalysisRunIds.length) await tx.delete(analysisRunsTable).where(inArray(analysisRunsTable.id, scopedAnalysisRunIds));
    }

    if (scope.evidenceIds.length) await tx.delete(dataQualityResultLinksTable).where(inArray(dataQualityResultLinksTable.evidenceItemId, scope.evidenceIds));
    if (scope.moduleIds.length) await tx.delete(dataQualityResultLinksTable).where(inArray(dataQualityResultLinksTable.moduleId, scope.moduleIds));
    if (scope.descriptorIds.length) await tx.delete(dataQualityResultLinksTable).where(inArray(dataQualityResultLinksTable.moduleDescriptorId, scope.descriptorIds));
    if (scope.programmeVersionIds.length) await tx.delete(dataQualityResultLinksTable).where(inArray(dataQualityResultLinksTable.programmeVersionId, scope.programmeVersionIds));
    if (scope.curatedStructureIds.length) await tx.delete(dataQualityResultLinksTable).where(inArray(dataQualityResultLinksTable.curatedStructureId, scope.curatedStructureIds));
    if (scope.curatedStructureItemIds.length) await tx.delete(dataQualityResultLinksTable).where(inArray(dataQualityResultLinksTable.curatedStructureItemId, scope.curatedStructureItemIds));
    if (scope.sourceRecordIds.length) await tx.delete(dataQualityResultLinksTable).where(inArray(dataQualityResultLinksTable.sourceRecordId, scope.sourceRecordIds));
    if (scope.sourceModuleIds.length) await tx.delete(dataQualityResultLinksTable).where(inArray(dataQualityResultLinksTable.sourceModuleId, scope.sourceModuleIds));
    if (scope.sourceProgrammeIds.length) await tx.delete(dataQualityResultLinksTable).where(inArray(dataQualityResultLinksTable.sourceProgrammeId, scope.sourceProgrammeIds));
    if (scope.sourceStructureItemIds.length) await tx.delete(dataQualityResultLinksTable).where(inArray(dataQualityResultLinksTable.sourceStructureItemId, scope.sourceStructureItemIds));

    await tx.delete(dataQualityResultLinksTable).where(eq(dataQualityResultLinksTable.importBatchId, importBatchId));
    const qualityRuns = await tx.select({ id: dataQualityRunsTable.id }).from(dataQualityRunsTable).where(eq(dataQualityRunsTable.importBatchId, importBatchId));
    const qualityResults = qualityRuns.length
      ? await tx.select({ id: dataQualityResultsTable.id }).from(dataQualityResultsTable).where(inArray(dataQualityResultsTable.dataQualityRunId, ids(qualityRuns)))
      : [];
    if (qualityResults.length) await tx.delete(dataQualityResultLinksTable).where(inArray(dataQualityResultLinksTable.dataQualityResultId, ids(qualityResults)));
    if (qualityResults.length) await tx.delete(ingestionRecordLinksTable).where(inArray(ingestionRecordLinksTable.dataQualityResultId, ids(qualityResults)));

    await tx.delete(ingestionRecordLinksTable).where(eq(ingestionRecordLinksTable.importBatchId, importBatchId));
    if (scope.moduleIds.length) await tx.delete(ingestionRecordLinksTable).where(inArray(ingestionRecordLinksTable.moduleId, scope.moduleIds));
    if (scope.descriptorIds.length) await tx.delete(ingestionRecordLinksTable).where(inArray(ingestionRecordLinksTable.moduleDescriptorId, scope.descriptorIds));
    if (scope.descriptorSectionIds.length) await tx.delete(ingestionRecordLinksTable).where(inArray(ingestionRecordLinksTable.descriptorSectionId, scope.descriptorSectionIds));
    if (scope.evidenceIds.length) await tx.delete(ingestionRecordLinksTable).where(inArray(ingestionRecordLinksTable.evidenceItemId, scope.evidenceIds));
    for (const sourceId of allSourceIds) {
      await tx.delete(ingestionRecordLinksTable).where(
        or(
          eq(ingestionRecordLinksTable.sourceRecordId, sourceId),
          eq(ingestionRecordLinksTable.sourceModuleId, sourceId),
          eq(ingestionRecordLinksTable.sourceProgrammeId, sourceId),
          eq(ingestionRecordLinksTable.sourceStructureItemId, sourceId),
        ),
      );
    }

    if (qualityRuns.length) await tx.delete(dataQualityResultsTable).where(inArray(dataQualityResultsTable.dataQualityRunId, ids(qualityRuns)));
    if (qualityRuns.length) await tx.delete(dataQualityRunsTable).where(inArray(dataQualityRunsTable.id, ids(qualityRuns)));

    if (scope.evidenceIds.length) await tx.delete(claimEvidenceLinksTable).where(inArray(claimEvidenceLinksTable.evidenceItemId, scope.evidenceIds));
    if (scope.moduleIds.length) await tx.delete(aiClaimsTable).where(and(eq(aiClaimsTable.institutionId, context.institutionId), inArray(aiClaimsTable.moduleId, scope.moduleIds)));
    if (scope.evidenceIds.length) await tx.delete(evidenceItemsTable).where(inArray(evidenceItemsTable.id, scope.evidenceIds));

    if (scope.curatedStructureItemIds.length) await tx.delete(curatedStructureItemsTable).where(inArray(curatedStructureItemsTable.id, scope.curatedStructureItemIds));
    if (scope.programmeVersionIds.length) await tx.delete(programmeVersionsTable).where(inArray(programmeVersionsTable.id, scope.programmeVersionIds));
    if (scope.moduleIds.length) await tx.delete(modulesTable).where(inArray(modulesTable.id, scope.moduleIds));

    const ingestionRuns = await tx.select({ id: ingestionRunsTable.id }).from(ingestionRunsTable).where(eq(ingestionRunsTable.importBatchId, importBatchId));
    if (ingestionRuns.length) await tx.delete(ingestionRunsTable).where(inArray(ingestionRunsTable.id, ids(ingestionRuns)));
    await tx.delete(importBatchesTable).where(eq(importBatchesTable.id, importBatchId));
  });

  return {
    action: "delete",
    subject: "import_batch",
    subjectId: importBatchId,
    deleted: true,
    counts: {
      modules: scope.moduleIds.length,
      programmeVersions: scope.programmeVersionIds.length,
      sourceModules: scope.sourceModuleIds.length,
      sourceProgrammes: scope.sourceProgrammeIds.length,
      evidenceItems: scope.evidenceIds.length,
      claims: diagnostics.claims,
      humanReviews: diagnostics.humanReviews,
      findings: diagnostics.findings,
      readinessAssessments: diagnostics.readinessAssessments,
      swotItems: diagnostics.swotItems,
      actionPlans: diagnostics.actionPlans,
    },
    diagnostics,
    bootstrapOverride: options.bootstrapOverride === true,
  };
}

export async function archiveImportBatch(context: ActorContext, importBatchId: string): Promise<CleanupResult> {
  const scope = await importBatchScope(context, importBatchId);
  if (scope.moduleIds.length) await db.update(modulesTable).set({ status: "archived", updatedAt: new Date() }).where(inArray(modulesTable.id, scope.moduleIds));
  if (scope.programmeVersionIds.length) await db.update(programmeVersionsTable).set({ status: "archived", updatedAt: new Date() }).where(inArray(programmeVersionsTable.id, scope.programmeVersionIds));
  if (scope.curatedStructureIds.length) await db.update(curatedStructuresTable).set({ status: "archived", updatedAt: new Date() }).where(inArray(curatedStructuresTable.id, scope.curatedStructureIds));
  if (scope.sourceRecordIds.length) await db.update(sourceRecordsTable).set({ status: "ignored", updatedAt: new Date() }).where(inArray(sourceRecordsTable.id, scope.sourceRecordIds));
  await db
    .update(importBatchesTable)
    .set({
      summary: {
        ...scope.batch.summary,
        archivedAt: new Date().toISOString(),
        archivedByUserId: context.userId,
      },
      updatedAt: new Date(),
    })
    .where(eq(importBatchesTable.id, importBatchId));

  return { action: "archive", subject: "import_batch", subjectId: importBatchId, archived: true, counts: { modules: scope.moduleIds.length, programmeVersions: scope.programmeVersionIds.length } };
}
