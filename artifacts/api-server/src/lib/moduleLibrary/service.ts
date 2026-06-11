import { and, asc, count, eq, inArray, or } from "drizzle-orm";
import {
  assessmentComponentsTable,
  competenciesTable,
  competencyDomainsTable,
  competencyEvaluationEvidenceLinksTable,
  competencyEvaluationsTable,
  curatedStructureItemsTable,
  curatedStructuresTable,
  dataQualityResultLinksTable,
  dataQualityResultsTable,
  db,
  descriptorSectionsTable,
  evidenceItemsTable,
  frameworksTable,
  frameworkVersionsTable,
  importBatchesTable,
  learningOutcomesTable,
  lensesTable,
  lensVersionsTable,
  moduleDescriptorsTable,
  modulesTable,
  programmeCompetencyExpectationsTable,
  programmeVersionsTable,
  sourceModulesTable,
  sourceProgrammesTable,
  sourceStructureItemsTable,
} from "@workspace/db";

type ActorContext = {
  institutionId: string;
};

type ImportBatchRow = typeof importBatchesTable.$inferSelect;

export type ModuleLibraryFilters = {
  q?: string;
  programme?: string;
  stage?: string;
  semester?: string;
  upload?: string;
};

export type ModuleLibraryItem = {
  id: string;
  recordKind: "canonical" | "source_only";
  moduleId?: string;
  sourceModuleId?: string;
  moduleCode?: string | null;
  moduleTitle?: string | null;
  credits?: number | null;
  stage?: string | null;
  semester?: string | null;
  programmes: Array<{ id?: string; code?: string | null; name?: string | null; source: "source" | "curated" }>;
  uploads: Array<{ id: string; label: string; status?: string | null; createdAt?: string | null }>;
  descriptorStatus: "active" | "draft" | "archived" | "superseded" | "missing" | "source_only";
  descriptorCount: number;
  evidenceCount: number;
  assessmentComponentCount: number;
  modalitySummary?: string | null;
  dataQualityFlags: Array<{ id: string; title: string; severity: string; status: string }>;
  sourceLabel: "Curated module" | "Imported source only";
  updatedAt?: string | null;
};

export type ModuleBuilderDetail = {
  module: ModuleLibraryItem;
  descriptors: Array<{
    id: string;
    versionLabel: string;
    status: string;
    sourceType?: string | null;
    createdAt?: string | null;
  }>;
  descriptorSections: Array<{
    id: string;
    descriptorId: string;
    sectionType: string;
    title?: string | null;
    content?: string | null;
    orderIndex: number;
  }>;
  learningOutcomes: Array<{
    id: string;
    outcomeCode?: string | null;
    outcomeText?: string | null;
    status: string;
  }>;
  evidenceItems: Array<{
    id: string;
    sourceKind: string;
    evidenceText?: string | null;
    status: string;
    confidence?: number | null;
  }>;
  assessmentComponents: Array<{
    id: string;
    componentName?: string | null;
    componentType?: string | null;
    assessmentMode?: string | null;
    weighting?: number | null;
    description?: string | null;
    status: string;
  }>;
  frameworkEvidenceSummary: Array<{
    key: string;
    name: string;
    evaluationCount: number;
    evidenceLinkCount: number;
    maturityDistribution: Record<string, number>;
    reviewStatusCounts: Record<string, number>;
    competencies: Array<{
      id?: string | null;
      name: string;
      domain?: string | null;
      observedLevel: string;
      status: string;
      source: string;
      evidenceLinkCount: number;
      rationale?: string | null;
      expectedLevel?: string | null;
      expectedHigherThanObserved?: boolean;
    }>;
    expectedGapCount: number;
  }>;
  assessmentDesignSummary: {
    evaluationCount: number;
    evidenceLinkCount: number;
    maturityDistribution: Record<string, number>;
    reviewStatusCounts: Record<string, number>;
  };
  modalityDesignSummary: {
    evaluationCount: number;
    evidenceLinkCount: number;
    maturityDistribution: Record<string, number>;
    reviewStatusCounts: Record<string, number>;
  };
  udlFoundation: Array<{
    key: string;
    name: string;
    description: string;
    evidenceCount: number;
    status: "placeholder";
  }>;
  dataQualityIndicators: ModuleLibraryItem["dataQualityFlags"];
  improvementPrompts: Array<{
    title: string;
    explanation: string;
    relatedSection: string;
    priority: "low" | "medium" | "high";
    evidenceCount: number;
  }>;
  nextSteps: string[];
};

function asNumber(value: string | number | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (!value) return null;
  const parsed = Number(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function metadataString(metadata: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function uniqueBy<T>(values: T[], key: (value: T) => string | undefined): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const value of values) {
    const resolved = key(value);
    if (!resolved || seen.has(resolved)) continue;
    seen.add(resolved);
    unique.push(value);
  }
  return unique;
}

function isImportBatch(value: ImportBatchRow | null | undefined): value is ImportBatchRow {
  return Boolean(value);
}

function matches(value: string | null | undefined, expected: string | undefined): boolean {
  return !expected || (value ?? "").toLowerCase() === expected.toLowerCase();
}

function textMatches(item: ModuleLibraryItem, q: string | undefined): boolean {
  if (!q?.trim()) return true;
  const query = q.trim().toLowerCase();
  return [
    item.moduleCode,
    item.moduleTitle,
    ...item.programmes.map((programme) => programme.code),
    ...item.programmes.map((programme) => programme.name),
    ...item.uploads.map((upload) => upload.label),
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(query));
}

function increment(map: Record<string, number>, key: string | null | undefined) {
  const resolved = key?.trim() || "unknown";
  map[resolved] = (map[resolved] ?? 0) + 1;
}

function metadataRecord(value: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return value && typeof value === "object" ? value : {};
}

function designLayerKey(value: Record<string, unknown> | null | undefined): string | undefined {
  const metadata = metadataRecord(value);
  const layer = metadata["designLayer"];
  return typeof layer === "string" ? layer : undefined;
}

function maturityRank(level: string | null | undefined): number {
  const normalized = level?.toLowerCase();
  if (!normalized || normalized === "none" || normalized === "not_applicable") return 0;
  if (normalized === "developing" || normalized === "introduce") return 1;
  if (normalized === "consolidating" || normalized === "develop") return 2;
  if (normalized === "leading" || normalized === "integrate" || normalized === "demonstrate") return 3;
  return 0;
}

function hasWeakMaturity(distribution: Record<string, number>): boolean {
  return (distribution.none ?? 0) > 0 || (distribution.developing ?? 0) > 0;
}

async function countByModule(context: ActorContext, moduleIds: string[]) {
  if (moduleIds.length === 0) return new Map<string, number>();
  const rows = await db
    .select({ moduleId: evidenceItemsTable.moduleId, total: count(evidenceItemsTable.id) })
    .from(evidenceItemsTable)
    .where(and(eq(evidenceItemsTable.institutionId, context.institutionId), inArray(evidenceItemsTable.moduleId, moduleIds)))
    .groupBy(evidenceItemsTable.moduleId);

  return new Map(rows.map((row) => [row.moduleId as string, Number(row.total)]));
}

export async function listModuleLibrary(context: ActorContext, filters: ModuleLibraryFilters = {}) {
  const [moduleRows, sourceRows] = await Promise.all([
    db
      .select({
        module: modulesTable,
        sourceModule: sourceModulesTable,
        importBatch: importBatchesTable,
      })
      .from(modulesTable)
      .leftJoin(sourceModulesTable, eq(modulesTable.sourceModuleId, sourceModulesTable.id))
      .leftJoin(importBatchesTable, eq(sourceModulesTable.importBatchId, importBatchesTable.id))
      .where(eq(modulesTable.institutionId, context.institutionId))
      .orderBy(asc(modulesTable.moduleCode), asc(modulesTable.moduleTitle)),
    db
      .select({
        sourceModule: sourceModulesTable,
        importBatch: importBatchesTable,
      })
      .from(sourceModulesTable)
      .leftJoin(importBatchesTable, eq(sourceModulesTable.importBatchId, importBatchesTable.id))
      .where(eq(sourceModulesTable.institutionId, context.institutionId))
      .orderBy(asc(sourceModulesTable.moduleCode), asc(sourceModulesTable.moduleTitle)),
  ]);

  const moduleIds = moduleRows.map((row) => row.module.id);
  const sourceModuleIds = sourceRows.map((row) => row.sourceModule.id);

  const descriptors = moduleIds.length
    ? await db
        .select()
        .from(moduleDescriptorsTable)
        .where(and(eq(moduleDescriptorsTable.institutionId, context.institutionId), inArray(moduleDescriptorsTable.moduleId, moduleIds)))
        .orderBy(asc(moduleDescriptorsTable.createdAt))
    : [];

  const descriptorIds = descriptors.map((descriptor) => descriptor.id);
  const descriptorByModule = new Map<string, typeof descriptors>();
  const descriptorToModule = new Map(descriptors.map((descriptor) => [descriptor.id, descriptor.moduleId]));
  for (const descriptor of descriptors) {
    descriptorByModule.set(descriptor.moduleId, [...(descriptorByModule.get(descriptor.moduleId) ?? []), descriptor]);
  }

  const evidenceCounts = await countByModule(context, moduleIds);

  const assessmentCounts = new Map<string, number>();
  if (descriptorIds.length > 0) {
    const assessmentRows = await db
      .select({ descriptorId: assessmentComponentsTable.moduleDescriptorId, total: count(assessmentComponentsTable.id) })
      .from(assessmentComponentsTable)
      .where(and(eq(assessmentComponentsTable.institutionId, context.institutionId), inArray(assessmentComponentsTable.moduleDescriptorId, descriptorIds)))
      .groupBy(assessmentComponentsTable.moduleDescriptorId);
    for (const row of assessmentRows) {
      const moduleId = descriptorToModule.get(row.descriptorId);
      if (!moduleId) continue;
      assessmentCounts.set(moduleId, (assessmentCounts.get(moduleId) ?? 0) + Number(row.total));
    }
  }

  const modalityByModule = new Map<string, string>();
  if (descriptorIds.length > 0) {
    const modalityRows = await db
      .select()
      .from(descriptorSectionsTable)
      .where(and(eq(descriptorSectionsTable.institutionId, context.institutionId), inArray(descriptorSectionsTable.moduleDescriptorId, descriptorIds), eq(descriptorSectionsTable.sectionType, "modality")));
    for (const section of modalityRows) {
      const moduleId = descriptorToModule.get(section.moduleDescriptorId);
      if (!moduleId || !section.content?.trim()) continue;
      modalityByModule.set(moduleId, section.content.replace(/\s+/g, " ").trim().slice(0, 140));
    }
  }

  const sourceStructureRows = sourceModuleIds.length
    ? await db
        .select({
          sourceStructureItem: sourceStructureItemsTable,
          sourceProgramme: sourceProgrammesTable,
          importBatch: importBatchesTable,
        })
        .from(sourceStructureItemsTable)
        .leftJoin(sourceProgrammesTable, eq(sourceStructureItemsTable.sourceProgrammeId, sourceProgrammesTable.id))
        .leftJoin(importBatchesTable, eq(sourceStructureItemsTable.importBatchId, importBatchesTable.id))
        .where(and(eq(sourceStructureItemsTable.institutionId, context.institutionId), inArray(sourceStructureItemsTable.sourceModuleId, sourceModuleIds)))
    : [];

  const sourceStructuresByModule = new Map<string, typeof sourceStructureRows>();
  for (const row of sourceStructureRows) {
    const sourceModuleId = row.sourceStructureItem.sourceModuleId;
    if (!sourceModuleId) continue;
    sourceStructuresByModule.set(sourceModuleId, [...(sourceStructuresByModule.get(sourceModuleId) ?? []), row]);
  }

  const curatedRows = moduleIds.length
    ? await db
        .select({
          item: curatedStructureItemsTable,
          structure: curatedStructuresTable,
          programme: programmeVersionsTable,
        })
        .from(curatedStructureItemsTable)
        .leftJoin(curatedStructuresTable, eq(curatedStructureItemsTable.curatedStructureId, curatedStructuresTable.id))
        .leftJoin(programmeVersionsTable, eq(curatedStructuresTable.programmeVersionId, programmeVersionsTable.id))
        .where(and(eq(curatedStructureItemsTable.institutionId, context.institutionId), inArray(curatedStructureItemsTable.moduleId, moduleIds)))
    : [];

  const curatedByModule = new Map<string, typeof curatedRows>();
  for (const row of curatedRows) {
    const moduleId = row.item.moduleId;
    if (!moduleId) continue;
    curatedByModule.set(moduleId, [...(curatedByModule.get(moduleId) ?? []), row]);
  }

  const qualityByModule = new Map<string, ModuleLibraryItem["dataQualityFlags"]>();
  const qualityBySourceModule = new Map<string, ModuleLibraryItem["dataQualityFlags"]>();
  if (moduleIds.length > 0 || sourceModuleIds.length > 0 || descriptorIds.length > 0) {
    const conditions = [
      moduleIds.length ? inArray(dataQualityResultLinksTable.moduleId, moduleIds) : undefined,
      sourceModuleIds.length ? inArray(dataQualityResultLinksTable.sourceModuleId, sourceModuleIds) : undefined,
      descriptorIds.length ? inArray(dataQualityResultLinksTable.moduleDescriptorId, descriptorIds) : undefined,
    ].filter(Boolean);

    if (conditions.length > 0) {
      const qualityRows = await db
        .select({
          link: dataQualityResultLinksTable,
          result: dataQualityResultsTable,
        })
        .from(dataQualityResultLinksTable)
        .innerJoin(dataQualityResultsTable, eq(dataQualityResultLinksTable.dataQualityResultId, dataQualityResultsTable.id))
        .where(and(eq(dataQualityResultsTable.institutionId, context.institutionId), or(...conditions)));

      const descriptorToModule = new Map(descriptors.map((descriptor) => [descriptor.id, descriptor.moduleId]));
      for (const row of qualityRows) {
        const flag = {
          id: row.result.id,
          title: row.result.title,
          severity: row.result.severity,
          status: row.result.status,
        };
        const moduleId = row.link.moduleId ?? (row.link.moduleDescriptorId ? descriptorToModule.get(row.link.moduleDescriptorId) : undefined);
        if (moduleId) qualityByModule.set(moduleId, [...(qualityByModule.get(moduleId) ?? []), flag]);
        if (row.link.sourceModuleId) {
          qualityBySourceModule.set(row.link.sourceModuleId, [...(qualityBySourceModule.get(row.link.sourceModuleId) ?? []), flag]);
        }
      }
    }
  }

  const sourceById = new Map(sourceRows.map((row) => [row.sourceModule.id, row]));
  const matchedSourceIds = new Set<string>();
  const matchedSourceCodes = new Set<string>();
  const items: ModuleLibraryItem[] = [];

  for (const row of moduleRows) {
    const module = row.module;
    const sourceModule = row.sourceModule ?? (module.moduleCode ? sourceRows.find((source) => source.sourceModule.moduleCode === module.moduleCode)?.sourceModule : undefined);
    if (sourceModule?.id) matchedSourceIds.add(sourceModule.id);
    if (module.moduleCode) matchedSourceCodes.add(module.moduleCode);

    const moduleDescriptors = descriptorByModule.get(module.id) ?? [];
    const latestDescriptor = moduleDescriptors[moduleDescriptors.length - 1];
    const sourceStructures = sourceModule?.id ? sourceStructuresByModule.get(sourceModule.id) ?? [] : [];
    const curatedItems = curatedByModule.get(module.id) ?? [];

    const programmes = uniqueBy(
      [
        ...curatedItems.map((item) => ({
          id: item.programme?.id,
          code: item.programme?.programmeCode,
          name: item.programme?.programmeName,
          source: "curated" as const,
        })),
        ...sourceStructures.map((item) => ({
          id: item.sourceProgramme?.id,
          code: item.sourceProgramme?.code,
          name: item.sourceProgramme?.name,
          source: "source" as const,
        })),
      ],
      (programme) => programme.id ?? programme.code ?? programme.name ?? undefined,
    );

    const uploads = uniqueBy(
      [
        row.importBatch,
        ...sourceStructures.map((item) => item.importBatch),
        sourceModule?.id ? sourceById.get(sourceModule.id)?.importBatch : undefined,
      ]
        .filter(isImportBatch)
        .map((batch) => ({
          id: batch.id,
          label: String(batch.summary?.fileName ?? batch.externalBatchId ?? "Programme data upload"),
          status: batch.status,
          createdAt: batch.createdAt?.toISOString() ?? null,
        })),
      (upload) => upload.id,
    );

    const stage = curatedItems.find((item) => item.item.stage)?.item.stage
      ?? sourceStructures.find((item) => item.sourceStructureItem.stage)?.sourceStructureItem.stage
      ?? sourceModule?.stage
      ?? metadataString(module.metadata, "stage");
    const semester = curatedItems.find((item) => item.item.semester)?.item.semester
      ?? sourceStructures.find((item) => item.sourceStructureItem.semester)?.sourceStructureItem.semester
      ?? sourceModule?.semester
      ?? metadataString(module.metadata, "semester");

    items.push({
      id: module.id,
      recordKind: "canonical",
      moduleId: module.id,
      sourceModuleId: sourceModule?.id,
      moduleCode: module.moduleCode ?? sourceModule?.moduleCode,
      moduleTitle: module.moduleTitle ?? sourceModule?.moduleTitle,
      credits: module.defaultCredits ?? asNumber(sourceModule?.credits),
      stage,
      semester,
      programmes,
      uploads,
      descriptorStatus: latestDescriptor?.status ?? "missing",
      descriptorCount: moduleDescriptors.length,
      evidenceCount: evidenceCounts.get(module.id) ?? 0,
      assessmentComponentCount: assessmentCounts.get(module.id) ?? 0,
      modalitySummary: modalityByModule.get(module.id) ?? null,
      dataQualityFlags: uniqueBy(qualityByModule.get(module.id) ?? [], (flag) => flag.id),
      sourceLabel: "Curated module",
      updatedAt: module.updatedAt?.toISOString() ?? null,
    });
  }

  for (const row of sourceRows) {
    const sourceModule = row.sourceModule;
    const matchedBySourceId = matchedSourceIds.has(sourceModule.id);
    const matchedByCode = sourceModule.moduleCode ? matchedSourceCodes.has(sourceModule.moduleCode) : false;
    if (matchedBySourceId || matchedByCode) continue;

    const sourceStructures = sourceStructuresByModule.get(sourceModule.id) ?? [];
    const programmes = uniqueBy(
      sourceStructures.map((item) => ({
        id: item.sourceProgramme?.id,
        code: item.sourceProgramme?.code,
        name: item.sourceProgramme?.name,
        source: "source" as const,
      })),
      (programme) => programme.id ?? programme.code ?? programme.name ?? undefined,
    );
    const uploads = uniqueBy(
      [row.importBatch, ...sourceStructures.map((item) => item.importBatch)]
        .filter(isImportBatch)
        .map((batch) => ({
          id: batch.id,
          label: String(batch.summary?.fileName ?? batch.externalBatchId ?? "Programme data upload"),
          status: batch.status,
          createdAt: batch.createdAt?.toISOString() ?? null,
        })),
      (upload) => upload.id,
    );

    items.push({
      id: sourceModule.id,
      recordKind: "source_only",
      sourceModuleId: sourceModule.id,
      moduleCode: sourceModule.moduleCode,
      moduleTitle: sourceModule.moduleTitle,
      credits: asNumber(sourceModule.credits),
      stage: sourceStructures.find((item) => item.sourceStructureItem.stage)?.sourceStructureItem.stage ?? sourceModule.stage,
      semester: sourceStructures.find((item) => item.sourceStructureItem.semester)?.sourceStructureItem.semester ?? sourceModule.semester,
      programmes,
      uploads,
      descriptorStatus: "source_only",
      descriptorCount: 0,
      evidenceCount: 0,
      assessmentComponentCount: 0,
      modalitySummary: null,
      dataQualityFlags: uniqueBy(qualityBySourceModule.get(sourceModule.id) ?? [], (flag) => flag.id),
      sourceLabel: "Imported source only",
      updatedAt: sourceModule.updatedAt?.toISOString() ?? null,
    });
  }

  const filtered = items.filter((item) => {
    const programmeMatch = !filters.programme
      || item.programmes.some((programme) => [programme.id, programme.code, programme.name].some((value) => matches(value, filters.programme)));
    const uploadMatch = !filters.upload || item.uploads.some((upload) => matches(upload.id, filters.upload) || matches(upload.label, filters.upload));
    return (
      textMatches(item, filters.q)
      && programmeMatch
      && matches(item.stage, filters.stage)
      && matches(item.semester, filters.semester)
      && uploadMatch
    );
  });

  return {
    modules: filtered.sort((a, b) => `${a.moduleCode ?? ""}${a.moduleTitle ?? ""}`.localeCompare(`${b.moduleCode ?? ""}${b.moduleTitle ?? ""}`)),
    total: filtered.length,
  };
}

export async function getModuleLibraryItem(context: ActorContext, moduleOrSourceId: string) {
  const { modules } = await listModuleLibrary(context);
  return modules.find((item) => item.id === moduleOrSourceId || item.moduleId === moduleOrSourceId || item.sourceModuleId === moduleOrSourceId);
}

function summarizeDesignEvaluations(
  evaluations: Array<{ evaluation: typeof competencyEvaluationsTable.$inferSelect; evidenceLinkCount: number }>,
) {
  const maturityDistribution: Record<string, number> = {};
  const reviewStatusCounts: Record<string, number> = {};
  for (const row of evaluations) {
    increment(maturityDistribution, row.evaluation.observedLevel);
    increment(reviewStatusCounts, row.evaluation.status);
  }

  return {
    evaluationCount: evaluations.length,
    evidenceLinkCount: evaluations.reduce((sum, row) => sum + row.evidenceLinkCount, 0),
    maturityDistribution,
    reviewStatusCounts,
  };
}

function uniqueDescriptorSections(sections: Array<typeof descriptorSectionsTable.$inferSelect>) {
  const seen = new Set<string>();
  return sections.filter((section) => {
    const key = [
      section.moduleDescriptorId,
      section.sectionType,
      section.title?.trim().toLowerCase() ?? "",
      section.content?.trim() ?? "",
    ].join("::");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function udlFoundation(evidenceItems: Array<typeof evidenceItemsTable.$inferSelect>) {
  const text = evidenceItems.map((item) => item.evidenceText ?? "").join("\n").toLowerCase();
  return [
    {
      key: "engagement",
      name: "Engagement",
      description: "Evidence container for motivation, relevance, choice, persistence and learner engagement signals.",
      evidenceCount: ["engage", "choice", "motivation", "participation", "reflection"].filter((term) => text.includes(term)).length,
      status: "placeholder" as const,
    },
    {
      key: "representation",
      name: "Representation",
      description: "Evidence container for multiple ways information, concepts and resources are represented.",
      evidenceCount: ["resource", "reading", "video", "visual", "example", "accessible"].filter((term) => text.includes(term)).length,
      status: "placeholder" as const,
    },
    {
      key: "action-expression",
      name: "Action & Expression",
      description: "Evidence container for how learners practise, demonstrate, communicate and evidence their learning.",
      evidenceCount: ["assessment", "portfolio", "presentation", "project", "demonstrate", "submit"].filter((term) => text.includes(term)).length,
      status: "placeholder" as const,
    },
  ];
}

function nextStepsForDetail(input: {
  module: ModuleLibraryItem;
  descriptorCount: number;
  evidenceCount: number;
  frameworkEvaluationCount: number;
  assessmentComponentCount: number;
}) {
  const steps: string[] = [];
  if (input.module.recordKind === "source_only") steps.push("Create or reconcile a curated module record for this imported module.");
  if (input.descriptorCount === 0) steps.push("Add or upload a module descriptor so CAST can inspect descriptor evidence.");
  if (input.evidenceCount === 0) steps.push("Review descriptor sections and evidence extraction for this module.");
  if (input.frameworkEvaluationCount === 0) steps.push("Run or review framework layer evidence for this module in a programme context.");
  if (input.assessmentComponentCount === 0) steps.push("Add assessment component detail or strengthen the assessment descriptor section.");
  if (input.module.dataQualityFlags.length > 0) steps.push("Resolve data quality indicators before using this module in formal review outputs.");
  if (steps.length === 0) steps.push("Review evidence maturity and prepare human-reviewed findings before making descriptor changes.");
  return steps;
}

function improvementPromptsForDetail(input: {
  descriptorSectionCount: number;
  evidenceCount: number;
  learningOutcomeCount: number;
  assessmentComponents: Array<typeof assessmentComponentsTable.$inferSelect>;
  frameworkEvidenceSummary: ModuleBuilderDetail["frameworkEvidenceSummary"];
  assessmentDesignSummary: ModuleBuilderDetail["assessmentDesignSummary"];
  modalityDesignSummary: ModuleBuilderDetail["modalityDesignSummary"];
  udlFoundation: ModuleBuilderDetail["udlFoundation"];
}) {
  const prompts: ModuleBuilderDetail["improvementPrompts"] = [];
  const assessmentWeightTotal = input.assessmentComponents.reduce((sum, component) => sum + (Number(component.weighting) || 0), 0);

  if (input.descriptorSectionCount === 0 && input.evidenceCount === 0) {
    prompts.push({
      title: "Add or upload descriptor evidence so CAST can analyse the module.",
      explanation: "CAST needs descriptor text or evidence sections before it can support module-level review.",
      relatedSection: "Descriptor Evidence",
      priority: "high",
      evidenceCount: 0,
    });
  }

  if (input.learningOutcomeCount === 0) {
    prompts.push({
      title: "Add clear module learning outcomes.",
      explanation: "Clear outcomes make it easier to review alignment between teaching, assessment and framework evidence.",
      relatedSection: "Module Overview",
      priority: "high",
      evidenceCount: 0,
    });
  }

  if (input.assessmentComponents.length === 0) {
    prompts.push({
      title: "Add assessment components, weighting and type information.",
      explanation: "Structured assessment details help CAST show assessment design evidence more clearly.",
      relatedSection: "Assessment Components",
      priority: "high",
      evidenceCount: 0,
    });
  } else if (Math.abs(assessmentWeightTotal - 100) > 1) {
    prompts.push({
      title: "Review assessment weighting completeness.",
      explanation: `The recorded assessment weighting currently totals ${assessmentWeightTotal}%.`,
      relatedSection: "Assessment Components",
      priority: "medium",
      evidenceCount: input.assessmentComponents.length,
    });
  }

  for (const framework of input.frameworkEvidenceSummary) {
    if (hasWeakMaturity(framework.maturityDistribution)) {
      prompts.push({
        title: "Consider strengthening descriptor, assessment or learning activity evidence for this framework.",
        explanation: `${framework.name} includes observations at None or Developing evidence maturity.`,
        relatedSection: "Framework Evidence Summary",
        priority: "medium",
        evidenceCount: framework.evidenceLinkCount,
      });
    }

    if (framework.expectedGapCount > 0) {
      prompts.push({
        title: "Review the evidence gap between expected and observed maturity.",
        explanation: `${framework.name} has ${framework.expectedGapCount} expectation${framework.expectedGapCount === 1 ? "" : "s"} where expected maturity is higher than observed maturity.`,
        relatedSection: "Framework Evidence Summary",
        priority: "high",
        evidenceCount: framework.evidenceLinkCount,
      });
    }
  }

  if (input.frameworkEvidenceSummary.length === 0) {
    prompts.push({
      title: "Consider strengthening descriptor, assessment or learning activity evidence for this framework.",
      explanation: "No framework evidence observations are currently available for this module.",
      relatedSection: "Framework Evidence Summary",
      priority: "medium",
      evidenceCount: 0,
    });
  }

  if (input.modalityDesignSummary.evaluationCount === 0 || hasWeakMaturity(input.modalityDesignSummary.maturityDistribution)) {
    prompts.push({
      title: "Clarify the module delivery mode and rationale.",
      explanation: "Delivery mode evidence helps reviewers understand the fit between learning activities, assessment and learner access.",
      relatedSection: "Modality Design Summary",
      priority: "medium",
      evidenceCount: input.modalityDesignSummary.evidenceLinkCount,
    });
  }

  if (input.udlFoundation.every((area) => area.evidenceCount === 0)) {
    prompts.push({
      title: "Review engagement, representation, and action/expression evidence.",
      explanation: "UDL evidence containers are available, but no UDL-related signals are visible yet.",
      relatedSection: "UDL Foundation",
      priority: "low",
      evidenceCount: 0,
    });
  }

  return prompts;
}

export async function getModuleBuilderDetail(context: ActorContext, moduleOrSourceId: string): Promise<ModuleBuilderDetail | undefined> {
  const module = await getModuleLibraryItem(context, moduleOrSourceId);
  if (!module) return undefined;

  if (!module.moduleId) {
    const emptySummary = summarizeDesignEvaluations([]);
    const emptyUdl = udlFoundation([]);
    const improvementPrompts = improvementPromptsForDetail({
      descriptorSectionCount: 0,
      evidenceCount: 0,
      learningOutcomeCount: 0,
      assessmentComponents: [],
      frameworkEvidenceSummary: [],
      assessmentDesignSummary: emptySummary,
      modalityDesignSummary: emptySummary,
      udlFoundation: emptyUdl,
    });
    return {
      module,
      descriptors: [],
      descriptorSections: [],
      learningOutcomes: [],
      evidenceItems: [],
      assessmentComponents: [],
      frameworkEvidenceSummary: [],
      assessmentDesignSummary: emptySummary,
      modalityDesignSummary: emptySummary,
      udlFoundation: emptyUdl,
      dataQualityIndicators: module.dataQualityFlags,
      improvementPrompts,
      nextSteps: nextStepsForDetail({
        module,
        descriptorCount: 0,
        evidenceCount: 0,
        frameworkEvaluationCount: 0,
        assessmentComponentCount: 0,
      }),
    };
  }

  const descriptors = await db
    .select()
    .from(moduleDescriptorsTable)
    .where(and(eq(moduleDescriptorsTable.institutionId, context.institutionId), eq(moduleDescriptorsTable.moduleId, module.moduleId)))
    .orderBy(asc(moduleDescriptorsTable.createdAt));
  const descriptorIds = descriptors.map((descriptor) => descriptor.id);

  const [sections, outcomes, assessments, evidence] = await Promise.all([
    descriptorIds.length
      ? db
          .select()
          .from(descriptorSectionsTable)
          .where(and(eq(descriptorSectionsTable.institutionId, context.institutionId), inArray(descriptorSectionsTable.moduleDescriptorId, descriptorIds)))
          .orderBy(asc(descriptorSectionsTable.orderIndex), asc(descriptorSectionsTable.createdAt))
      : [],
    descriptorIds.length
      ? db
          .select()
          .from(learningOutcomesTable)
          .where(and(eq(learningOutcomesTable.institutionId, context.institutionId), inArray(learningOutcomesTable.moduleDescriptorId, descriptorIds)))
          .orderBy(asc(learningOutcomesTable.orderIndex), asc(learningOutcomesTable.createdAt))
      : [],
    descriptorIds.length
      ? db
          .select()
          .from(assessmentComponentsTable)
          .where(and(eq(assessmentComponentsTable.institutionId, context.institutionId), inArray(assessmentComponentsTable.moduleDescriptorId, descriptorIds)))
          .orderBy(asc(assessmentComponentsTable.orderIndex), asc(assessmentComponentsTable.createdAt))
      : [],
    db
      .select()
      .from(evidenceItemsTable)
      .where(and(eq(evidenceItemsTable.institutionId, context.institutionId), eq(evidenceItemsTable.moduleId, module.moduleId)))
      .orderBy(asc(evidenceItemsTable.createdAt)),
  ]);

  const evaluations = await db
    .select({
      evaluation: competencyEvaluationsTable,
      competency: competenciesTable,
      domain: competencyDomainsTable,
      frameworkVersion: frameworkVersionsTable,
      framework: frameworksTable,
      lensVersion: lensVersionsTable,
      lens: lensesTable,
    })
    .from(competencyEvaluationsTable)
    .leftJoin(competenciesTable, eq(competencyEvaluationsTable.competencyId, competenciesTable.id))
    .leftJoin(competencyDomainsTable, eq(competenciesTable.competencyDomainId, competencyDomainsTable.id))
    .leftJoin(frameworkVersionsTable, eq(competenciesTable.frameworkVersionId, frameworkVersionsTable.id))
    .leftJoin(frameworksTable, eq(frameworkVersionsTable.frameworkId, frameworksTable.id))
    .leftJoin(lensVersionsTable, eq(competencyEvaluationsTable.lensVersionId, lensVersionsTable.id))
    .leftJoin(lensesTable, eq(lensVersionsTable.lensId, lensesTable.id))
    .where(
      and(
        eq(competencyEvaluationsTable.institutionId, context.institutionId),
        descriptorIds.length
          ? or(eq(competencyEvaluationsTable.moduleId, module.moduleId), inArray(competencyEvaluationsTable.moduleDescriptorId, descriptorIds))
          : eq(competencyEvaluationsTable.moduleId, module.moduleId),
      ),
    );

  const evaluationIds = evaluations.map((row) => row.evaluation.id);
  const evidenceLinkCounts = new Map<string, number>();
  if (evaluationIds.length > 0) {
    const linkRows = await db
      .select({ evaluationId: competencyEvaluationEvidenceLinksTable.competencyEvaluationId, total: count(competencyEvaluationEvidenceLinksTable.id) })
      .from(competencyEvaluationEvidenceLinksTable)
      .where(inArray(competencyEvaluationEvidenceLinksTable.competencyEvaluationId, evaluationIds))
      .groupBy(competencyEvaluationEvidenceLinksTable.competencyEvaluationId);
    for (const row of linkRows) evidenceLinkCounts.set(row.evaluationId, Number(row.total));
  }

  const evaluationsWithCounts = evaluations.map((row) => ({
    ...row,
    evidenceLinkCount: evidenceLinkCounts.get(row.evaluation.id) ?? 0,
  }));
  const assessmentDesignEvaluations = evaluationsWithCounts.filter((row) => designLayerKey(row.evaluation.metadata) === "assessment-design");
  const modalityDesignEvaluations = evaluationsWithCounts.filter((row) => designLayerKey(row.evaluation.metadata) === "modality-design");
  const frameworkEvaluations = evaluationsWithCounts.filter((row) => !designLayerKey(row.evaluation.metadata));
  const competencyIds = frameworkEvaluations.map((row) => row.evaluation.competencyId).filter((id): id is string => Boolean(id));
  const programmeVersionIds = frameworkEvaluations.map((row) => row.evaluation.programmeVersionId).filter((id): id is string => Boolean(id));
  const expectationRows =
    competencyIds.length > 0 && programmeVersionIds.length > 0
      ? await db
          .select()
          .from(programmeCompetencyExpectationsTable)
          .where(
            and(
              eq(programmeCompetencyExpectationsTable.institutionId, context.institutionId),
              eq(programmeCompetencyExpectationsTable.moduleId, module.moduleId),
              inArray(programmeCompetencyExpectationsTable.competencyId, competencyIds),
              inArray(programmeCompetencyExpectationsTable.programmeVersionId, programmeVersionIds),
            ),
          )
      : [];
  const expectationByProgrammeCompetency = new Map(
    expectationRows.map((expectation) => [`${expectation.programmeVersionId}:${expectation.competencyId}`, expectation]),
  );

  const frameworkGroups = new Map<string, typeof frameworkEvaluations>();
  for (const row of frameworkEvaluations) {
    const key = row.framework?.key ?? row.lens?.key ?? "unassigned-framework";
    frameworkGroups.set(key, [...(frameworkGroups.get(key) ?? []), row]);
  }

  const frameworkEvidenceSummary = [...frameworkGroups.entries()].map(([key, rows]) => {
    const maturityDistribution: Record<string, number> = {};
    const reviewStatusCounts: Record<string, number> = {};
    let expectedGapCount = 0;
    for (const row of rows) {
      increment(maturityDistribution, row.evaluation.observedLevel);
      increment(reviewStatusCounts, row.evaluation.status);
      const expectation = row.evaluation.programmeVersionId && row.evaluation.competencyId
        ? expectationByProgrammeCompetency.get(`${row.evaluation.programmeVersionId}:${row.evaluation.competencyId}`)
        : undefined;
      if (expectation && maturityRank(expectation.expectedLevel) > maturityRank(row.evaluation.observedLevel)) {
        expectedGapCount += 1;
      }
    }

    return {
      key,
      name: rows[0]?.framework?.name ?? rows[0]?.lens?.name ?? "Unassigned framework evidence",
      evaluationCount: rows.length,
      evidenceLinkCount: rows.reduce((sum, row) => sum + row.evidenceLinkCount, 0),
      maturityDistribution,
      reviewStatusCounts,
      competencies: rows.map((row) => ({
        ...(() => {
          const expectation = row.evaluation.programmeVersionId && row.evaluation.competencyId
            ? expectationByProgrammeCompetency.get(`${row.evaluation.programmeVersionId}:${row.evaluation.competencyId}`)
            : undefined;
          return {
            expectedLevel: expectation?.expectedLevel,
            expectedHigherThanObserved: expectation ? maturityRank(expectation.expectedLevel) > maturityRank(row.evaluation.observedLevel) : false,
          };
        })(),
        id: row.competency?.id,
        name: row.competency?.name ?? "Framework observation",
        domain: row.domain?.name,
        observedLevel: row.evaluation.observedLevel,
        status: row.evaluation.status,
        source: row.evaluation.source,
        evidenceLinkCount: row.evidenceLinkCount,
        rationale: row.evaluation.rationale,
      })),
      expectedGapCount,
    };
  });

  const assessmentDesignSummary = summarizeDesignEvaluations(assessmentDesignEvaluations);
  const modalityDesignSummary = summarizeDesignEvaluations(modalityDesignEvaluations);
  const displaySections = uniqueDescriptorSections(sections);
  const udl = udlFoundation(evidence);
  const improvementPrompts = improvementPromptsForDetail({
    descriptorSectionCount: sections.length,
    evidenceCount: evidence.length,
    learningOutcomeCount: outcomes.length,
    assessmentComponents: assessments,
    frameworkEvidenceSummary,
    assessmentDesignSummary,
    modalityDesignSummary,
    udlFoundation: udl,
  });

  return {
    module,
    descriptors: descriptors.map((descriptor) => ({
      id: descriptor.id,
      versionLabel: descriptor.versionLabel,
      status: descriptor.status,
      sourceType: descriptor.sourceType,
      createdAt: descriptor.createdAt?.toISOString() ?? null,
    })),
    descriptorSections: displaySections.map((section) => ({
      id: section.id,
      descriptorId: section.moduleDescriptorId,
      sectionType: section.sectionType,
      title: section.title,
      content: section.content,
      orderIndex: section.orderIndex,
    })),
    learningOutcomes: outcomes.map((outcome) => ({
      id: outcome.id,
      outcomeCode: outcome.outcomeCode,
      outcomeText: outcome.outcomeText,
      status: outcome.status,
    })),
    evidenceItems: evidence.slice(0, 50).map((item) => ({
      id: item.id,
      sourceKind: item.sourceKind,
      evidenceText: item.evidenceText,
      status: item.status,
      confidence: item.confidence,
    })),
    assessmentComponents: assessments.map((component) => ({
      id: component.id,
      componentName: component.componentName,
      componentType: component.componentType,
      assessmentMode: component.assessmentMode,
      weighting: component.weighting,
      description: component.description,
      status: component.status,
    })),
    frameworkEvidenceSummary,
    assessmentDesignSummary,
    modalityDesignSummary,
    udlFoundation: udl,
    dataQualityIndicators: module.dataQualityFlags,
    improvementPrompts,
    nextSteps: nextStepsForDetail({
      module,
      descriptorCount: descriptors.length,
      evidenceCount: evidence.length,
      frameworkEvaluationCount: frameworkEvaluations.length,
      assessmentComponentCount: assessments.length,
    }),
  };
}
