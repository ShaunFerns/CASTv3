import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import {
  competenciesTable,
  competencyDomainsTable,
  competencyEvaluationsTable,
  competencyEvaluationEvidenceLinksTable,
  curatedStructureGroupsTable,
  curatedStructureItemsTable,
  curatedStructuresTable,
  dataQualityResultLinksTable,
  dataQualityResultsTable,
  db,
  evidenceItemsTable,
  frameworkVersionsTable,
  frameworksTable,
  moduleDescriptorsTable,
  modulesTable,
  programmeAttributeExpectationsTable,
  programmeCompetencyExpectationsTable,
  programmeGraduateAttributesTable,
  programmeMapAnnotationsTable,
  programmeMapExportsTable,
  programmeMapVersionsTable,
  programmeMapsTable,
  programmeVersionsTable,
  reconciliationLinksTable,
} from "@workspace/db";
import {
  frameworkFamilies,
  frameworkFamilyFromMetadata,
  defaultVersionForFramework,
  registryFrameworks,
  type FrameworkFamilyKey,
  type RegisteredFramework,
} from "./registry.js";

type ActorContext = {
  institutionId: string;
  userId?: string;
};

type EvidenceMaturityLevel = "none" | "developing" | "consolidating" | "leading";

type ActiveLayer = {
  key: string;
  name: string;
  family?: FrameworkFamilyKey;
  layerType: "framework" | "programme_framework" | "source_curated" | "data_quality" | "evidence" | "evidence_maturity";
  source: "registry" | "database" | "programme" | "system";
  active: boolean;
  placeholder: boolean;
  versionLabel?: string;
  sourceUrl?: string;
  frameworkId?: string;
  frameworkVersionId?: string;
};

type StructureItemRow = typeof curatedStructureItemsTable.$inferSelect;
type StructureGroupRow = typeof curatedStructureGroupsTable.$inferSelect;
type FrameworkEvaluation = typeof competencyEvaluationsTable.$inferSelect & {
  competency?: typeof competenciesTable.$inferSelect;
  domain?: typeof competencyDomainsTable.$inferSelect;
  evidenceCount: number;
};
type FrameworkExpectation = typeof programmeCompetencyExpectationsTable.$inferSelect & {
  competency?: typeof competenciesTable.$inferSelect;
  domain?: typeof competencyDomainsTable.$inferSelect;
};
type ProgrammeAttributeExpectation = typeof programmeAttributeExpectationsTable.$inferSelect & {
  attribute?: typeof programmeGraduateAttributesTable.$inferSelect;
};
type ProgrammeAttributeEvaluation = typeof competencyEvaluationsTable.$inferSelect & {
  attribute?: typeof programmeGraduateAttributesTable.$inferSelect;
  evidenceCount: number;
};

const evidenceMaturityRank: Record<EvidenceMaturityLevel, number> = {
  none: 0,
  developing: 1,
  consolidating: 2,
  leading: 3,
};

function evidenceMaturityLevel(value: string | null | undefined): EvidenceMaturityLevel {
  if (value === "developing" || value === "consolidating" || value === "leading") return value;
  return "none";
}

function highestEvidenceMaturity(values: Array<string | null | undefined>): EvidenceMaturityLevel {
  return values.reduce<EvidenceMaturityLevel>((highest, value) => {
    const level = evidenceMaturityLevel(value);
    return evidenceMaturityRank[level] > evidenceMaturityRank[highest] ? level : highest;
  }, "none");
}

function compareEvidenceMaturity(expected: EvidenceMaturityLevel, observed: EvidenceMaturityLevel, evidenceCount: number) {
  if (expected === "none" && observed === "none") return "not_expected";
  if (expected === "none" && observed !== "none") return "emergent_strength";
  if (observed === "none" || evidenceCount === 0) return "evidence_gap";
  if (evidenceMaturityRank[observed] < evidenceMaturityRank[expected]) return "below_expected";
  if (evidenceMaturityRank[observed] === evidenceMaturityRank[expected]) return "aligned";
  return "above_expected";
}

function isGapComparison(comparison: string) {
  return comparison === "evidence_gap" || comparison === "below_expected";
}

function isStrengthComparison(comparison: string) {
  return comparison === "aligned" || comparison === "above_expected" || comparison === "emergent_strength";
}

const systemLayers: ActiveLayer[] = [
  {
    key: "source-curated",
    name: "Source versus curated",
    layerType: "source_curated",
    source: "system",
    active: true,
    placeholder: false,
  },
  {
    key: "data-quality",
    name: "Data quality",
    layerType: "data_quality",
    source: "system",
    active: true,
    placeholder: false,
  },
  {
    key: "evidence",
    name: "Evidence presence",
    layerType: "evidence",
    source: "system",
    active: true,
    placeholder: false,
  },
  {
    key: "evidence-maturity",
    name: "Evidence maturity",
    layerType: "evidence_maturity",
    source: "system",
    active: false,
    placeholder: false,
  },
];

function metadataFamily(metadata: Record<string, unknown> | null | undefined, ownerType?: string | null): FrameworkFamilyKey {
  return frameworkFamilyFromMetadata(metadata) ?? (ownerType === "professional" ? "professional_accreditation" : ownerType === "disciplinary" ? "disciplinary" : "institutional");
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function isMeaningful(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function keyPart(value: string | null | undefined, fallback: string): string {
  return value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || fallback;
}

function dateChanged(row: { createdAt: Date; updatedAt: Date }): boolean {
  return row.updatedAt.getTime() - row.createdAt.getTime() > 1000;
}

function csvEscape(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportRowsCsv(rows: Awaited<ReturnType<typeof getProgrammeMapProjection>>["rows"]): string {
  const headers = ["Stage", "Semester", "Pathway", "Module Code", "Module Title", "Credits", "Evidence Count", "Data Quality Indicators", "Layer Indicators"];
  const dataRows = rows.map((row) => [
    row.stage,
    row.semester,
    row.pathway,
    row.module.code,
    row.module.title,
    row.credits,
    row.evidence.count,
    row.quality.indicators.length,
    row.layers.flatMap((layer) => (layer.indicators ?? []).map((indicator) => `${layer.name}: ${indicator.competencyName ?? indicator.domainName ?? "indicator"} ${indicator.observedLevel}`)).join("; "),
  ]);
  return [headers, ...dataRows].map((row) => row.map(csvEscape).join(",")).join("\n");
}

async function ensureProgrammeMapWorkspace(
  context: ActorContext,
  programmeVersionId: string,
) {
  const programmeVersion = await programme(context, programmeVersionId);
  const key = `programme-version:${programmeVersionId}`;
  const mapName = `${programmeVersion.programmeCode ?? "Programme"} ${programmeVersion.versionLabel} Map`;
  const [map] = await db
    .insert(programmeMapsTable)
    .values({
      institutionId: context.institutionId,
      programmeVersionId,
      key,
      name: mapName,
      description: "Programme map workspace generated from the curated programme structure.",
      status: "active",
      createdByUserId: context.userId,
      metadata: { phase: "7A.2", programmeVersionId },
    })
    .onConflictDoUpdate({
      target: [programmeMapsTable.institutionId, programmeMapsTable.key],
      set: {
        programmeVersionId,
        name: mapName,
        status: "active",
        metadata: { phase: "7A.2", programmeVersionId },
      },
    })
    .returning();

  const [version] = await db
    .insert(programmeMapVersionsTable)
    .values({
      programmeMapId: map.id,
      versionLabel: "Workspace",
      status: "active",
      snapshot: { kind: "live_workspace", programmeVersionId },
      createdByUserId: context.userId,
    })
    .onConflictDoUpdate({
      target: [programmeMapVersionsTable.programmeMapId, programmeMapVersionsTable.versionLabel],
      set: {
        status: "active",
        snapshot: { kind: "live_workspace", programmeVersionId },
      },
    })
    .returning();

  return { map, version };
}

async function programme(context: ActorContext, programmeVersionId: string) {
  const [row] = await db
    .select()
    .from(programmeVersionsTable)
    .where(and(eq(programmeVersionsTable.id, programmeVersionId), eq(programmeVersionsTable.institutionId, context.institutionId)))
    .limit(1);
  if (!row) throw new Error("Programme version not found");
  return row;
}

async function structureForProgramme(context: ActorContext, programmeVersionId: string) {
  const programmeVersion = await programme(context, programmeVersionId);
  const [structure] = await db
    .select()
    .from(curatedStructuresTable)
    .where(and(eq(curatedStructuresTable.programmeVersionId, programmeVersion.id), eq(curatedStructuresTable.institutionId, context.institutionId)))
    .orderBy(asc(curatedStructuresTable.key))
    .limit(1);
  const groups = structure
    ? await db
        .select()
        .from(curatedStructureGroupsTable)
        .where(eq(curatedStructureGroupsTable.curatedStructureId, structure.id))
        .orderBy(asc(curatedStructureGroupsTable.orderIndex), asc(curatedStructureGroupsTable.key))
    : [];
  const items = structure
    ? await db
        .select()
        .from(curatedStructureItemsTable)
        .where(eq(curatedStructureItemsTable.curatedStructureId, structure.id))
        .orderBy(asc(curatedStructureItemsTable.orderIndex), asc(curatedStructureItemsTable.label))
    : [];
  return { programmeVersion, structure, groups, items };
}

async function databaseFrameworks(context: ActorContext): Promise<RegisteredFramework[]> {
  const frameworkRows = await db
    .select()
    .from(frameworksTable)
    .where(or(isNull(frameworksTable.institutionId), eq(frameworksTable.institutionId, context.institutionId)))
    .orderBy(asc(frameworksTable.name));

  const frameworkIds = frameworkRows.map((row) => row.id);
  const versionRows =
    frameworkIds.length > 0
      ? await db
          .select()
          .from(frameworkVersionsTable)
          .where(inArray(frameworkVersionsTable.frameworkId, frameworkIds))
          .orderBy(asc(frameworkVersionsTable.createdAt))
      : [];

  return frameworkRows.map((framework) => {
    const latestVersion = [...versionRows].reverse().find((version) => version.frameworkId === framework.id);
    return {
      key: framework.key,
      name: framework.name,
      family: metadataFamily(framework.metadata, framework.ownerType),
      ownerScope: framework.institutionId ? "institution" : "system",
      description: framework.description ?? "Framework registered in CAST.",
      source: "database",
      versionLabel: latestVersion?.versionLabel,
      sourceUrl: latestVersion?.sourceUrl ?? undefined,
      frameworkId: framework.id,
      frameworkVersionId: latestVersion?.id,
      metadata: framework.metadata,
    };
  });
}

function dedupeFrameworks(frameworks: RegisteredFramework[]): RegisteredFramework[] {
  const byKey = new Map<string, RegisteredFramework>();
  for (const framework of frameworks) {
    const existing = byKey.get(framework.key);
    if (!existing || (existing.source === "registry" && framework.source !== "registry")) {
      byKey.set(framework.key, framework);
    }
  }
  return [...byKey.values()];
}

async function programmeFrameworks(context: ActorContext, programmeVersionId: string): Promise<RegisteredFramework[]> {
  const attributes = await db
    .select()
    .from(programmeGraduateAttributesTable)
    .where(and(eq(programmeGraduateAttributesTable.institutionId, context.institutionId), eq(programmeGraduateAttributesTable.programmeVersionId, programmeVersionId)))
    .orderBy(asc(programmeGraduateAttributesTable.orderIndex), asc(programmeGraduateAttributesTable.name));

  if (attributes.length === 0) {
    return [
      {
        key: `programme-attributes:${programmeVersionId}`,
        name: "Programme Graduate Attributes",
        family: "programme",
        ownerScope: "programme",
        description: "Programme-owned graduate attributes can be managed as a map layer when defined.",
        source: "programme",
        programmeVersionId,
        metadata: { attributeCount: 0, placeholder: true },
      },
    ];
  }

  return [
    {
      key: `programme-attributes:${programmeVersionId}`,
      name: "Programme Graduate Attributes",
      family: "programme",
      ownerScope: "programme",
      description: "Programme-owned graduate attributes displayed as a programme map layer.",
      source: "programme",
      programmeVersionId,
      metadata: { attributeCount: attributes.length },
    },
  ];
}

export async function getFrameworkFamilies() {
  return { families: frameworkFamilies };
}

export async function getFrameworkRegistry(context: ActorContext, programmeVersionId?: string) {
  const frameworks = dedupeFrameworks([
    ...registryFrameworks,
    ...(await databaseFrameworks(context)),
    ...(programmeVersionId ? await programmeFrameworks(context, programmeVersionId) : []),
  ]);
  return { families: frameworkFamilies, frameworks };
}

export async function getAvailableLayers(context: ActorContext, programmeVersionId: string) {
  const registry = await getFrameworkRegistry(context, programmeVersionId);
  const frameworkLayers: ActiveLayer[] = registry.frameworks
    .filter((framework) => metadataRecord(framework.metadata)["programmeMapLayer"] !== false)
    .map((framework) => ({
      key: `framework:${framework.key}`,
      name: framework.name,
      family: framework.family,
      layerType: framework.source === "programme" ? "programme_framework" : "framework",
      source: framework.source,
      active: false,
      placeholder: !framework.frameworkVersionId,
      versionLabel: framework.versionLabel,
      sourceUrl: framework.sourceUrl,
      frameworkId: framework.frameworkId,
      frameworkVersionId: framework.frameworkVersionId,
    }));
  return { layers: [...systemLayers, ...frameworkLayers] };
}

export async function getProgrammeMapMetadata(context: ActorContext, programmeVersionId: string) {
  const data = await structureForProgramme(context, programmeVersionId);
  const stages = new Set(data.items.map((item) => item.stage).filter(isMeaningful));
  const semesters = new Set(data.items.map((item) => item.semester).filter(isMeaningful));
  const pathways = new Set(data.items.map((item) => item.pathway).filter(isMeaningful));
  const totalCredits = data.items.reduce((sum, item) => sum + (Number(item.credits) || 0), 0);
  return {
    programmeVersion: data.programmeVersion,
    curatedStructure: data.structure,
    summary: {
      stageCount: stages.size,
      semesterCount: semesters.size,
      pathwayCount: pathways.size,
      modulePlacementCount: data.items.length,
      totalCredits,
      hasCuratedStructure: Boolean(data.structure),
    },
  };
}

async function supportingRows(context: ActorContext, items: StructureItemRow[]) {
  const itemIds = items.map((item) => item.id);
  const moduleIds = items.map((item) => item.moduleId).filter((id): id is string => Boolean(id));
  const descriptorIds = items.map((item) => item.moduleDescriptorId).filter((id): id is string => Boolean(id));

  const modules = moduleIds.length > 0 ? await db.select().from(modulesTable).where(inArray(modulesTable.id, moduleIds)) : [];
  const descriptors = descriptorIds.length > 0 ? await db.select().from(moduleDescriptorsTable).where(inArray(moduleDescriptorsTable.id, descriptorIds)) : [];
  const evidence =
    itemIds.length > 0 || moduleIds.length > 0
      ? await db
          .select()
          .from(evidenceItemsTable)
          .where(
            and(
              eq(evidenceItemsTable.institutionId, context.institutionId),
              or(
                itemIds.length > 0 ? inArray(evidenceItemsTable.curatedStructureItemId, itemIds) : undefined,
                moduleIds.length > 0 ? inArray(evidenceItemsTable.moduleId, moduleIds) : undefined,
              ),
            ),
          )
      : [];
  const links =
    itemIds.length > 0
      ? await db
          .select({ link: dataQualityResultLinksTable, result: dataQualityResultsTable })
          .from(dataQualityResultLinksTable)
          .innerJoin(dataQualityResultsTable, eq(dataQualityResultLinksTable.dataQualityResultId, dataQualityResultsTable.id))
          .where(inArray(dataQualityResultLinksTable.curatedStructureItemId, itemIds))
      : [];
  const reconciliation =
    itemIds.length > 0
      ? await db
          .select()
          .from(reconciliationLinksTable)
          .where(
            and(
              eq(reconciliationLinksTable.institutionId, context.institutionId),
              eq(reconciliationLinksTable.targetType, "curated_structure_item"),
              inArray(reconciliationLinksTable.targetId, itemIds),
            ),
          )
      : [];

  return { modules, descriptors, evidence, qualityLinks: links, reconciliation };
}

async function frameworkVersion(frameworkKey: string, versionLabel: string) {
  const [row] = await db
    .select({ framework: frameworksTable, version: frameworkVersionsTable })
    .from(frameworksTable)
    .innerJoin(frameworkVersionsTable, eq(frameworkVersionsTable.frameworkId, frameworksTable.id))
    .where(and(isNull(frameworksTable.institutionId), eq(frameworksTable.key, frameworkKey), eq(frameworkVersionsTable.versionLabel, versionLabel)))
    .limit(1);
  return row;
}

async function frameworkVersionById(frameworkVersionId: string) {
  const [row] = await db
    .select({ framework: frameworksTable, version: frameworkVersionsTable })
    .from(frameworkVersionsTable)
    .innerJoin(frameworksTable, eq(frameworkVersionsTable.frameworkId, frameworksTable.id))
    .where(eq(frameworkVersionsTable.id, frameworkVersionId))
    .limit(1);
  return row;
}

async function frameworkEvaluations(
  context: ActorContext,
  programmeVersionId: string,
  items: StructureItemRow[],
  frameworkKey: string,
  versionLabel = "2022",
  frameworkVersionId?: string,
) {
  const framework = frameworkVersionId ? await frameworkVersionById(frameworkVersionId) : await frameworkVersion(frameworkKey, versionLabel);
  if (!framework) return { framework, evaluations: [] as FrameworkEvaluation[] };
  const moduleIds = items.map((item) => item.moduleId).filter((id): id is string => Boolean(id));
  const itemIds = items.map((item) => item.id);
  const evaluations =
    moduleIds.length > 0 || itemIds.length > 0
      ? await db
          .select({ evaluation: competencyEvaluationsTable, competency: competenciesTable, domain: competencyDomainsTable })
          .from(competencyEvaluationsTable)
          .innerJoin(competenciesTable, eq(competencyEvaluationsTable.competencyId, competenciesTable.id))
          .leftJoin(competencyDomainsTable, eq(competenciesTable.competencyDomainId, competencyDomainsTable.id))
          .where(
            and(
              eq(competencyEvaluationsTable.institutionId, context.institutionId),
              eq(competencyEvaluationsTable.programmeVersionId, programmeVersionId),
              eq(competenciesTable.frameworkVersionId, framework.version.id),
              or(
                moduleIds.length > 0 ? inArray(competencyEvaluationsTable.moduleId, moduleIds) : undefined,
                itemIds.length > 0 ? inArray(competencyEvaluationsTable.curatedStructureItemId, itemIds) : undefined,
              ),
            ),
          )
      : [];
  const evaluationIds = evaluations.map((row) => row.evaluation.id);
  const evidenceLinks =
    evaluationIds.length > 0
      ? await db
          .select()
          .from(competencyEvaluationEvidenceLinksTable)
          .where(inArray(competencyEvaluationEvidenceLinksTable.competencyEvaluationId, evaluationIds))
      : [];

  return {
    framework,
    evaluations: evaluations.map((row) => ({
      ...row.evaluation,
      competency: row.competency,
      domain: row.domain ?? undefined,
      evidenceCount: evidenceLinks.filter((link) => link.competencyEvaluationId === row.evaluation.id).length,
    })),
  };
}

async function frameworkExpectations(
  context: ActorContext,
  programmeVersionId: string,
  frameworkKey: string,
  versionLabel = defaultVersionForFramework(frameworkKey),
  frameworkVersionId?: string,
) {
  const framework = frameworkVersionId ? await frameworkVersionById(frameworkVersionId) : await frameworkVersion(frameworkKey, versionLabel);
  if (!framework) return { framework, expectations: [] as FrameworkExpectation[], competencies: [] as Array<typeof competenciesTable.$inferSelect & { domain?: typeof competencyDomainsTable.$inferSelect }> };

  const competencyRows = await db
    .select({ competency: competenciesTable, domain: competencyDomainsTable })
    .from(competenciesTable)
    .leftJoin(competencyDomainsTable, eq(competenciesTable.competencyDomainId, competencyDomainsTable.id))
    .where(eq(competenciesTable.frameworkVersionId, framework.version.id))
    .orderBy(asc(competencyDomainsTable.orderIndex), asc(competenciesTable.orderIndex), asc(competenciesTable.name));

  const competencyIds = competencyRows.map((row) => row.competency.id);
  const expectations =
    competencyIds.length > 0
      ? await db
          .select({ expectation: programmeCompetencyExpectationsTable, competency: competenciesTable, domain: competencyDomainsTable })
          .from(programmeCompetencyExpectationsTable)
          .innerJoin(competenciesTable, eq(programmeCompetencyExpectationsTable.competencyId, competenciesTable.id))
          .leftJoin(competencyDomainsTable, eq(competenciesTable.competencyDomainId, competencyDomainsTable.id))
          .where(
            and(
              eq(programmeCompetencyExpectationsTable.institutionId, context.institutionId),
              eq(programmeCompetencyExpectationsTable.programmeVersionId, programmeVersionId),
              inArray(programmeCompetencyExpectationsTable.competencyId, competencyIds),
            ),
          )
      : [];

  return {
    framework,
    competencies: competencyRows.map((row) => ({ ...row.competency, domain: row.domain ?? undefined })),
    expectations: expectations.map((row) => ({ ...row.expectation, competency: row.competency, domain: row.domain ?? undefined })),
  };
}

function expectationAppliesToItem(expectation: FrameworkExpectation, item: StructureItemRow, group?: StructureGroupRow) {
  const stage = item.stage ?? group?.stage ?? null;
  const semester = item.semester ?? group?.semester ?? null;
  const pathway = item.pathway ?? group?.pathway ?? null;
  if (expectation.scope === "module") return Boolean(expectation.moduleId && expectation.moduleId === item.moduleId);
  if (expectation.scope === "module_group") return Boolean(expectation.curatedStructureGroupId && expectation.curatedStructureGroupId === item.curatedStructureGroupId);
  if (expectation.scope === "pathway") return Boolean(expectation.pathway && expectation.pathway === pathway);
  if (expectation.scope === "semester") {
    return Boolean(expectation.semester && expectation.semester === semester && (!expectation.stage || expectation.stage === stage));
  }
  if (expectation.scope === "stage") return Boolean(expectation.stage && expectation.stage === stage);
  return expectation.scope === "programme";
}

function expectationSpecificity(expectation: FrameworkExpectation) {
  if (expectation.scope === "module") return 60;
  if (expectation.scope === "module_group") return 50;
  if (expectation.scope === "pathway") return 40;
  if (expectation.scope === "semester") return 30;
  if (expectation.scope === "stage") return 20;
  return 10;
}

function bestExpectationForItem(expectations: FrameworkExpectation[], item: StructureItemRow, group?: StructureGroupRow) {
  return expectations
    .filter((expectation) => expectationAppliesToItem(expectation, item, group))
    .sort((a, b) => expectationSpecificity(b) - expectationSpecificity(a) || evidenceMaturityRank[evidenceMaturityLevel(b.expectedLevel)] - evidenceMaturityRank[evidenceMaturityLevel(a.expectedLevel)])[0];
}

async function programmeAttributeLayer(context: ActorContext, programmeVersionId: string) {
  const attributes = await db
    .select()
    .from(programmeGraduateAttributesTable)
    .where(and(eq(programmeGraduateAttributesTable.institutionId, context.institutionId), eq(programmeGraduateAttributesTable.programmeVersionId, programmeVersionId)))
    .orderBy(asc(programmeGraduateAttributesTable.orderIndex), asc(programmeGraduateAttributesTable.name));
  const attributeIds = attributes.map((attribute) => attribute.id);
  const expectations =
    attributeIds.length > 0
      ? await db
          .select({ expectation: programmeAttributeExpectationsTable, attribute: programmeGraduateAttributesTable })
          .from(programmeAttributeExpectationsTable)
          .innerJoin(programmeGraduateAttributesTable, eq(programmeAttributeExpectationsTable.programmeGraduateAttributeId, programmeGraduateAttributesTable.id))
          .where(
            and(
              eq(programmeAttributeExpectationsTable.institutionId, context.institutionId),
              eq(programmeAttributeExpectationsTable.programmeVersionId, programmeVersionId),
              inArray(programmeAttributeExpectationsTable.programmeGraduateAttributeId, attributeIds),
            ),
          )
      : [];
  const evaluations =
    attributeIds.length > 0
      ? await db
          .select({ evaluation: competencyEvaluationsTable, attribute: programmeGraduateAttributesTable })
          .from(competencyEvaluationsTable)
          .innerJoin(programmeGraduateAttributesTable, eq(competencyEvaluationsTable.programmeGraduateAttributeId, programmeGraduateAttributesTable.id))
          .where(
            and(
              eq(competencyEvaluationsTable.institutionId, context.institutionId),
              eq(competencyEvaluationsTable.programmeVersionId, programmeVersionId),
              inArray(competencyEvaluationsTable.programmeGraduateAttributeId, attributeIds),
            ),
          )
      : [];
  const evaluationIds = evaluations.map((row) => row.evaluation.id);
  const evidenceLinks =
    evaluationIds.length > 0
      ? await db
          .select()
          .from(competencyEvaluationEvidenceLinksTable)
          .where(inArray(competencyEvaluationEvidenceLinksTable.competencyEvaluationId, evaluationIds))
      : [];
  return {
    attributes,
    expectations: expectations.map((row) => ({ ...row.expectation, attribute: row.attribute })) as ProgrammeAttributeExpectation[],
    evaluations: evaluations.map((row) => ({
      ...row.evaluation,
      attribute: row.attribute,
      evidenceCount: evidenceLinks.filter((link) => link.competencyEvaluationId === row.evaluation.id).length,
    })) as ProgrammeAttributeEvaluation[],
  };
}

function attributeExpectationAppliesToItem(expectation: ProgrammeAttributeExpectation, item: StructureItemRow, group?: StructureGroupRow) {
  const stage = item.stage ?? group?.stage ?? null;
  const semester = item.semester ?? group?.semester ?? null;
  const pathway = item.pathway ?? group?.pathway ?? null;
  if (expectation.scope === "module") return Boolean(expectation.moduleId && expectation.moduleId === item.moduleId);
  if (expectation.scope === "module_group") return Boolean(expectation.curatedStructureGroupId && expectation.curatedStructureGroupId === item.curatedStructureGroupId);
  if (expectation.scope === "pathway") return Boolean(expectation.pathway && expectation.pathway === pathway);
  if (expectation.scope === "semester") return Boolean(expectation.semester && expectation.semester === semester && (!expectation.stage || expectation.stage === stage));
  if (expectation.scope === "stage") return Boolean(expectation.stage && expectation.stage === stage);
  return expectation.scope === "programme";
}

function bestAttributeExpectationForItem(expectations: ProgrammeAttributeExpectation[], item: StructureItemRow, group?: StructureGroupRow) {
  return expectations
    .filter((expectation) => attributeExpectationAppliesToItem(expectation, item, group))
    .sort((a, b) => expectationSpecificity(b as unknown as FrameworkExpectation) - expectationSpecificity(a as unknown as FrameworkExpectation) || evidenceMaturityRank[evidenceMaturityLevel(b.expectedLevel)] - evidenceMaturityRank[evidenceMaturityLevel(a.expectedLevel)])[0];
}

function qualityIndicators(input: {
  item: StructureItemRow;
  evidenceCount: number;
  descriptorStatus: string;
  qualityResults: Array<typeof dataQualityResultsTable.$inferSelect>;
}) {
  const indicators = [];
  if (!input.item.stage) indicators.push({ key: "missing-stage", label: "Missing stage", severity: "warning" });
  if (!input.item.semester) indicators.push({ key: "missing-semester", label: "Missing semester", severity: "warning" });
  if (!input.item.moduleId) indicators.push({ key: "orphaned-module", label: "No module link", severity: "error" });
  if (!input.item.moduleDescriptorId || input.descriptorStatus === "missing") indicators.push({ key: "missing-descriptor", label: "Missing descriptor", severity: "warning" });
  if (input.evidenceCount === 0) indicators.push({ key: "missing-evidence", label: "No evidence yet", severity: "info" });
  for (const result of input.qualityResults) {
    indicators.push({ key: result.id, label: result.title, severity: result.severity });
  }
  return indicators;
}

function resolveGroup(groupsById: Map<string, StructureGroupRow>, item: StructureItemRow): StructureGroupRow | undefined {
  return item.curatedStructureGroupId ? groupsById.get(item.curatedStructureGroupId) : undefined;
}

export async function getProgrammeMapProjection(
  context: ActorContext,
  programmeVersionId: string,
  requestedLayerKeys: string[] = [],
) {
  const data = await structureForProgramme(context, programmeVersionId);
  const layerCatalog = await getAvailableLayers(context, programmeVersionId);
  const activeLayerSet = new Set(requestedLayerKeys.length > 0 ? requestedLayerKeys : systemLayers.map((layer) => layer.key));
  const activeLayers = layerCatalog.layers.map((layer) => ({ ...layer, active: activeLayerSet.has(layer.key) }));
  const groupsById = new Map(data.groups.map((group) => [group.id, group]));
  const support = await supportingRows(context, data.items);
  const activeFrameworkLayers = activeLayers.filter((layer) => layer.active && layer.key.startsWith("framework:"));
  const hasEvidenceMaturityLayer = activeLayers.some((layer) => layer.active && layer.layerType === "evidence_maturity");
  const hasProgrammeAttributeLayer = activeLayers.some((layer) => layer.active && layer.layerType === "programme_framework");
  const programmeAttributeBundle = hasProgrammeAttributeLayer ? await programmeAttributeLayer(context, programmeVersionId) : undefined;
  const frameworkEvaluationBundles = new Map<string, Awaited<ReturnType<typeof frameworkEvaluations>>>();
  const frameworkExpectationBundles = new Map<string, Awaited<ReturnType<typeof frameworkExpectations>>>();
  for (const layer of activeFrameworkLayers) {
    const frameworkKey = layer.key.replace("framework:", "");
    frameworkEvaluationBundles.set(
      frameworkKey,
      await frameworkEvaluations(context, programmeVersionId, data.items, frameworkKey, layer.versionLabel ?? defaultVersionForFramework(frameworkKey), layer.frameworkVersionId),
    );
    frameworkExpectationBundles.set(
      frameworkKey,
      await frameworkExpectations(context, programmeVersionId, frameworkKey, layer.versionLabel ?? defaultVersionForFramework(frameworkKey), layer.frameworkVersionId),
    );
  }
  const itemIdsForMaturity = data.items.map((item) => item.id);
  const moduleIdsForMaturity = data.items.map((item) => item.moduleId).filter((id): id is string => Boolean(id));
  const maturityEvaluations = hasEvidenceMaturityLayer && (itemIdsForMaturity.length > 0 || moduleIdsForMaturity.length > 0)
    ? await db
        .select()
        .from(competencyEvaluationsTable)
        .where(
          and(
            eq(competencyEvaluationsTable.institutionId, context.institutionId),
            eq(competencyEvaluationsTable.programmeVersionId, programmeVersionId),
            or(
              itemIdsForMaturity.length > 0 ? inArray(competencyEvaluationsTable.curatedStructureItemId, itemIdsForMaturity) : undefined,
              moduleIdsForMaturity.length > 0 ? inArray(competencyEvaluationsTable.moduleId, moduleIdsForMaturity) : undefined,
            ),
          ),
        )
    : [];

  const rows = data.items.map((item) => {
    const group = resolveGroup(groupsById, item);
    const module = support.modules.find((candidate) => candidate.id === item.moduleId);
    const descriptor = support.descriptors.find((candidate) => candidate.id === item.moduleDescriptorId);
    const itemEvidence = support.evidence.filter((candidate) => candidate.curatedStructureItemId === item.id || candidate.moduleId === item.moduleId);
    const itemQuality = support.qualityLinks
      .filter((candidate) => candidate.link.curatedStructureItemId === item.id)
      .map((candidate) => candidate.result);
    const reconciliation = support.reconciliation.find((candidate) => candidate.targetId === item.id);
    const evidenceCount = itemEvidence.length;
    const descriptorStatus = descriptor?.status ?? "missing";
    const stage = item.stage ?? group?.stage ?? "Unspecified";
    const semester = item.semester ?? group?.semester ?? "Unspecified";
    const pathway = item.pathway ?? group?.pathway ?? "Core";
    const optionGroup =
      group?.groupType === "option_group" || group?.groupType === "elective_group" ? group.name ?? group.key : undefined;
    const sourceDerived = Boolean(item.sourceStructureItemId || item.sourceModuleId);
    const curatedModified = dateChanged(item) || metadataRecord(item.metadata)["curatedEdit"] === true;

    return {
      id: item.id,
      stage,
      semester,
      pathway,
      optionGroup,
      coreOption: item.coreOption,
      credits: item.credits,
      orderIndex: item.orderIndex,
      module: {
        id: module?.id ?? item.moduleId,
        code: module?.moduleCode,
        title: module?.moduleTitle ?? item.label,
        status: module?.status ?? "missing",
      },
      descriptor: {
        id: descriptor?.id ?? item.moduleDescriptorId,
        status: descriptorStatus,
      },
      provenance: {
        sourceDerived,
        curatedModified,
        sourceStructureItemId: item.sourceStructureItemId,
        sourceModuleId: item.sourceModuleId,
        reconciliationStatus: reconciliation?.status ?? (sourceDerived ? "candidate" : "curated_only"),
        confidence: reconciliation?.confidence ?? (sourceDerived ? 0.5 : null),
      },
      evidence: {
        count: evidenceCount,
        status: evidenceCount > 0 ? "present" : "missing",
      },
      quality: {
        status: itemQuality.some((result) => result.severity === "error" || result.severity === "critical")
          ? "issue"
          : itemQuality.length > 0
            ? "warning"
            : "not_checked",
        indicators: qualityIndicators({ item, evidenceCount, descriptorStatus, qualityResults: itemQuality }),
      },
      layers: activeLayers
        .filter((layer) => layer.active)
        .map((layer) => {
          if (layer.layerType === "evidence_maturity") {
            const itemMaturityEvaluations = maturityEvaluations.filter((evaluation) => evaluation.curatedStructureItemId === item.id || evaluation.moduleId === item.moduleId);
            const observedLevel = highestEvidenceMaturity(itemMaturityEvaluations.map((evaluation) => evaluation.observedLevel));
            return {
              key: layer.key,
              name: layer.name,
              family: layer.family,
              layerType: layer.layerType,
              status: itemMaturityEvaluations.length > 0 ? "observed" : "no_evidence",
              coverage: "evidence_informed",
              indicators: [
                {
                  evaluationId: `evidence-maturity:${item.id}`,
                  competencyId: null,
                  competencyName: "Overall evidence maturity",
                  domainKey: "evidence-maturity",
                  domainName: "Evidence maturity",
                  expectedLevel: "none" as EvidenceMaturityLevel,
                  observedLevel,
                  comparison: observedLevel === "none" ? "evidence_gap" : "emergent_strength",
                  status: itemMaturityEvaluations.length > 0 ? "observed" : "no_evidence",
                  evidenceCount: itemMaturityEvaluations.length,
                  rationale: "Aggregated from existing evidence-linked evaluations across active CAST layers.",
                },
              ],
            };
          }
          if (layer.layerType === "programme_framework") {
            const itemAttributeEvaluations = (programmeAttributeBundle?.evaluations ?? []).filter(
              (evaluation) => evaluation.curatedStructureItemId === item.id || evaluation.moduleId === item.moduleId,
            );
            const itemAttributeExpectations = (programmeAttributeBundle?.expectations ?? []).filter((expectation) => attributeExpectationAppliesToItem(expectation, item, group));
            const evaluationAttributeIds = new Set(itemAttributeEvaluations.map((evaluation) => evaluation.programmeGraduateAttributeId).filter(Boolean));
            const expectationOnlyIndicators = itemAttributeExpectations
              .filter((expectation) => expectation.expectedLevel !== "none" && !evaluationAttributeIds.has(expectation.programmeGraduateAttributeId))
              .map((expectation) => {
                const expectedLevel = evidenceMaturityLevel(expectation.expectedLevel);
                return {
                  expectationId: expectation.id,
                  competencyId: expectation.programmeGraduateAttributeId,
                  competencyKey: expectation.attribute?.key,
                  competencyName: expectation.attribute?.name,
                  domainKey: "programme-owned",
                  domainName: "Programme-owned",
                  expectedLevel,
                  observedLevel: "none" as EvidenceMaturityLevel,
                  comparison: compareEvidenceMaturity(expectedLevel, "none", 0),
                  status: "expected",
                  evidenceCount: 0,
                  rationale: expectation.rationale,
                };
              });
            return {
              key: layer.key,
              name: layer.name,
              family: layer.family,
              layerType: layer.layerType,
              status: itemAttributeEvaluations.length > 0 ? "observed" : expectationOnlyIndicators.length > 0 ? "expected" : "no_evidence",
              coverage: "evidence_informed",
              indicators: [
                ...itemAttributeEvaluations.map((evaluation) => {
                  const expectation = bestAttributeExpectationForItem(
                    (programmeAttributeBundle?.expectations ?? []).filter((candidate) => candidate.programmeGraduateAttributeId === evaluation.programmeGraduateAttributeId),
                    item,
                    group,
                  );
                  const expectedLevel = evidenceMaturityLevel(expectation?.expectedLevel);
                  const observedLevel = evidenceMaturityLevel(evaluation.observedLevel);
                  return {
                    evaluationId: evaluation.id,
                    expectationId: expectation?.id,
                    competencyId: evaluation.programmeGraduateAttributeId,
                    competencyKey: evaluation.attribute?.key,
                    competencyName: evaluation.attribute?.name,
                    domainKey: "programme-owned",
                    domainName: "Programme-owned",
                    expectedLevel,
                    observedLevel,
                    comparison: compareEvidenceMaturity(expectedLevel, observedLevel, evaluation.evidenceCount),
                    status: evaluation.status,
                    evidenceCount: evaluation.evidenceCount,
                    rationale: evaluation.rationale,
                  };
                }),
                ...expectationOnlyIndicators,
              ],
            };
          }
          const frameworkKey = layer.key.startsWith("framework:") ? layer.key.replace("framework:", "") : undefined;
          const itemFrameworkEvaluations = frameworkKey
            ? (frameworkEvaluationBundles.get(frameworkKey)?.evaluations ?? []).filter(
                (evaluation) => evaluation.curatedStructureItemId === item.id || evaluation.moduleId === item.moduleId,
              )
            : [];
          const itemFrameworkExpectations = frameworkKey
            ? (frameworkExpectationBundles.get(frameworkKey)?.expectations ?? []).filter((expectation) => expectationAppliesToItem(expectation, item, group))
            : [];
          const evaluationCompetencyIds = new Set(itemFrameworkEvaluations.map((evaluation) => evaluation.competencyId).filter(Boolean));
          const expectationOnlyIndicators = itemFrameworkExpectations
            .filter((expectation) => expectation.expectedLevel !== "none" && !evaluationCompetencyIds.has(expectation.competencyId))
            .map((expectation) => {
              const expectedLevel = evidenceMaturityLevel(expectation.expectedLevel);
              return {
                expectationId: expectation.id,
                competencyId: expectation.competencyId,
                competencyKey: expectation.competency?.key,
                competencyName: expectation.competency?.name,
                domainKey: expectation.domain?.key,
                domainName: expectation.domain?.name,
                expectedLevel,
                observedLevel: "none" as EvidenceMaturityLevel,
                comparison: compareEvidenceMaturity(expectedLevel, "none", 0),
                status: "expected",
                evidenceCount: 0,
                rationale: expectation.rationale,
              };
            });
          return {
            key: layer.key,
            name: layer.name,
            family: layer.family,
            layerType: layer.layerType,
            status: itemFrameworkEvaluations.length > 0 ? "observed" : expectationOnlyIndicators.length > 0 ? "expected" : layer.placeholder ? "not_scored" : "no_evidence",
            coverage: frameworkKey ? "evidence_informed" : "placeholder",
            indicators: [
              ...itemFrameworkEvaluations.map((evaluation) => {
                const expectation = frameworkKey ? bestExpectationForItem(
                  (frameworkExpectationBundles.get(frameworkKey)?.expectations ?? []).filter((candidate) => candidate.competencyId === evaluation.competencyId),
                  item,
                  group,
                ) : undefined;
                const expectedLevel = evidenceMaturityLevel(expectation?.expectedLevel);
                const observedLevel = evidenceMaturityLevel(evaluation.observedLevel);
                return {
                  evaluationId: evaluation.id,
                  expectationId: expectation?.id,
                  competencyId: evaluation.competencyId,
                  competencyKey: evaluation.competency?.key,
                  competencyName: evaluation.competency?.name,
                  domainKey: evaluation.domain?.key,
                  domainName: evaluation.domain?.name,
                  expectedLevel,
                  observedLevel,
                  comparison: compareEvidenceMaturity(expectedLevel, observedLevel, evaluation.evidenceCount),
                  status: evaluation.status,
                  evidenceCount: evaluation.evidenceCount,
                  rationale: evaluation.rationale,
                };
              }),
              ...expectationOnlyIndicators,
            ],
          };
        }),
    };
  });

  const stageOrder = [...new Set(rows.map((row) => row.stage))].sort();
  const columns = stageOrder.map((stage) => ({
    key: `stage-${keyPart(stage, "unspecified")}`,
    stage,
    semesters: [...new Set(rows.filter((row) => row.stage === stage).map((row) => row.semester))].sort(),
  }));

  return {
    programmeVersion: data.programmeVersion,
    curatedStructure: data.structure,
    activeLayers,
    columns,
    rows,
    summary: {
      modulePlacementCount: rows.length,
      sourceDerivedCount: rows.filter((row) => row.provenance.sourceDerived).length,
      curatedModifiedCount: rows.filter((row) => row.provenance.curatedModified).length,
      missingDescriptorCount: rows.filter((row) => row.descriptor.status === "missing").length,
      missingEvidenceCount: rows.filter((row) => row.evidence.count === 0).length,
      dataQualityIssueCount: rows.reduce((sum, row) => sum + row.quality.indicators.length, 0),
      greenCompEvaluationCount: frameworkEvaluationBundles.get("greencomp")?.evaluations.length ?? 0,
      greenCompModulesWithEvidenceCount: new Set((frameworkEvaluationBundles.get("greencomp")?.evaluations ?? []).map((evaluation) => evaluation.moduleId).filter(Boolean)).size,
      lifeCompEvaluationCount: frameworkEvaluationBundles.get("lifecomp")?.evaluations.length ?? 0,
      lifeCompModulesWithEvidenceCount: new Set((frameworkEvaluationBundles.get("lifecomp")?.evaluations ?? []).map((evaluation) => evaluation.moduleId).filter(Boolean)).size,
      entreCompEvaluationCount: frameworkEvaluationBundles.get("entrecomp")?.evaluations.length ?? 0,
      entreCompModulesWithEvidenceCount: new Set((frameworkEvaluationBundles.get("entrecomp")?.evaluations ?? []).map((evaluation) => evaluation.moduleId).filter(Boolean)).size,
      digCompEvaluationCount: frameworkEvaluationBundles.get("digcomp")?.evaluations.length ?? 0,
      digCompModulesWithEvidenceCount: new Set((frameworkEvaluationBundles.get("digcomp")?.evaluations ?? []).map((evaluation) => evaluation.moduleId).filter(Boolean)).size,
      assessmentDesignEvaluationCount: frameworkEvaluationBundles.get("assessment-design")?.evaluations.length ?? 0,
      assessmentDesignModulesWithEvidenceCount: new Set((frameworkEvaluationBundles.get("assessment-design")?.evaluations ?? []).map((evaluation) => evaluation.moduleId).filter(Boolean)).size,
      programmeAttributeCount: programmeAttributeBundle?.attributes.length ?? 0,
      programmeAttributeExpectationCount: programmeAttributeBundle?.expectations.length ?? 0,
      programmeAttributeEvaluationCount: programmeAttributeBundle?.evaluations.length ?? 0,
    },
  };
}

export async function getCoverageSummary(context: ActorContext, programmeVersionId: string) {
  const attributes = await db
    .select()
    .from(programmeGraduateAttributesTable)
    .where(and(eq(programmeGraduateAttributesTable.institutionId, context.institutionId), eq(programmeGraduateAttributesTable.programmeVersionId, programmeVersionId)));
  const attributeExpectations = await db
    .select()
    .from(programmeAttributeExpectationsTable)
    .where(and(eq(programmeAttributeExpectationsTable.institutionId, context.institutionId), eq(programmeAttributeExpectationsTable.programmeVersionId, programmeVersionId)));
  const competencyExpectations = await db
    .select()
    .from(programmeCompetencyExpectationsTable)
    .where(and(eq(programmeCompetencyExpectationsTable.institutionId, context.institutionId), eq(programmeCompetencyExpectationsTable.programmeVersionId, programmeVersionId)));
  const evaluations = await db
    .select()
    .from(competencyEvaluationsTable)
    .where(and(eq(competencyEvaluationsTable.institutionId, context.institutionId), eq(competencyEvaluationsTable.programmeVersionId, programmeVersionId)));
  const competencyIds = competencyExpectations.map((expectation) => expectation.competencyId);
  const competencies = competencyIds.length > 0 ? await db.select().from(competenciesTable).where(inArray(competenciesTable.id, competencyIds)) : [];

  return {
    status: "placeholder",
    message: "Coverage architecture is present. Framework scoring and classification are intentionally out of scope for Phase 5A.",
    counts: {
      programmeGraduateAttributes: attributes.length,
      programmeAttributeExpectations: attributeExpectations.length,
      programmeCompetencyExpectations: competencyExpectations.length,
      competenciesReferenced: competencies.length,
      competencyEvaluations: evaluations.length,
    },
    dimensions: [
      { key: "competencies", label: "Competencies", count: competencyExpectations.length },
      { key: "attributes", label: "Attributes", count: attributes.length },
      { key: "outcomes", label: "Outcomes", count: 0 },
      { key: "expectations", label: "Expectations", count: attributeExpectations.length + competencyExpectations.length },
    ],
  };
}

export async function listProgrammeMapAnnotations(context: ActorContext, programmeVersionId: string) {
  const workspace = await ensureProgrammeMapWorkspace(context, programmeVersionId);
  const annotations = await db
    .select()
    .from(programmeMapAnnotationsTable)
    .where(eq(programmeMapAnnotationsTable.programmeMapVersionId, workspace.version.id))
    .orderBy(desc(programmeMapAnnotationsTable.createdAt));
  return { map: workspace.map, mapVersion: workspace.version, annotations };
}

export async function createProgrammeMapAnnotation(
  context: ActorContext,
  programmeVersionId: string,
  input: { body?: string; annotationType?: "comment" | "note" | "risk" | "decision"; metadata?: Record<string, unknown> },
) {
  const body = input.body?.trim();
  if (!body) throw new Error("Comment text is required");
  const workspace = await ensureProgrammeMapWorkspace(context, programmeVersionId);
  const [annotation] = await db
    .insert(programmeMapAnnotationsTable)
    .values({
      programmeMapVersionId: workspace.version.id,
      authorUserId: context.userId,
      annotationType: input.annotationType ?? "comment",
      body,
      metadata: {
        ...(input.metadata ?? {}),
        programmeVersionId,
        phase: "7A.2",
      },
    })
    .returning();
  return { map: workspace.map, mapVersion: workspace.version, annotation };
}

export async function listProgrammeMapSnapshots(context: ActorContext, programmeVersionId: string) {
  const workspace = await ensureProgrammeMapWorkspace(context, programmeVersionId);
  const snapshots = await db
    .select()
    .from(programmeMapVersionsTable)
    .where(eq(programmeMapVersionsTable.programmeMapId, workspace.map.id))
    .orderBy(desc(programmeMapVersionsTable.createdAt));
  return {
    map: workspace.map,
    workspaceVersionId: workspace.version.id,
    snapshots: snapshots.filter((snapshot) => snapshot.id !== workspace.version.id),
  };
}

export async function createProgrammeMapSnapshot(
  context: ActorContext,
  programmeVersionId: string,
  input: { label?: string; activeLayerKeys?: string[] },
) {
  const workspace = await ensureProgrammeMapWorkspace(context, programmeVersionId);
  const activeLayerKeys = input.activeLayerKeys?.filter((key) => typeof key === "string" && key.trim().length > 0) ?? [];
  const projection = await getProgrammeMapProjection(context, programmeVersionId, activeLayerKeys);
  const versionLabel = input.label?.trim() || `Snapshot ${new Date().toISOString()}`;
  const [snapshot] = await db
    .insert(programmeMapVersionsTable)
    .values({
      programmeMapId: workspace.map.id,
      versionLabel,
      status: "active",
      snapshot: {
        kind: "programme_map_snapshot",
        programmeVersionId,
        activeLayerKeys,
        createdAt: new Date().toISOString(),
        projection,
      },
      createdByUserId: context.userId,
    })
    .returning();
  return { map: workspace.map, snapshot };
}

export async function listProgrammeMapExports(context: ActorContext, programmeVersionId: string) {
  const workspace = await ensureProgrammeMapWorkspace(context, programmeVersionId);
  const exports = await db
    .select()
    .from(programmeMapExportsTable)
    .where(eq(programmeMapExportsTable.programmeMapVersionId, workspace.version.id))
    .orderBy(desc(programmeMapExportsTable.createdAt));
  return { map: workspace.map, mapVersion: workspace.version, exports };
}

export async function createProgrammeMapExport(
  context: ActorContext,
  programmeVersionId: string,
  input: { format?: "json" | "csv"; activeLayerKeys?: string[] },
) {
  const format = input.format === "csv" ? "csv" : "json";
  const workspace = await ensureProgrammeMapWorkspace(context, programmeVersionId);
  const activeLayerKeys = input.activeLayerKeys?.filter((key) => typeof key === "string" && key.trim().length > 0) ?? [];
  const projection = await getProgrammeMapProjection(context, programmeVersionId, activeLayerKeys);
  const payload = format === "csv" ? exportRowsCsv(projection.rows) : JSON.stringify(projection, null, 2);
  const filename = `cast-programme-map-${programmeVersionId}.${format}`;
  const [exportRecord] = await db
    .insert(programmeMapExportsTable)
    .values({
      programmeMapVersionId: workspace.version.id,
      requestedByUserId: context.userId,
      format,
      status: "completed",
      completedAt: new Date(),
      metadata: {
        phase: "7A.2",
        programmeVersionId,
        activeLayerKeys,
        inlineExport: true,
        rowCount: projection.rows.length,
        filename,
      },
    })
    .returning();
  return {
    map: workspace.map,
    mapVersion: workspace.version,
    export: exportRecord,
    filename,
    contentType: format === "csv" ? "text/csv" : "application/json",
    payload,
  };
}

async function getFrameworkCoverageSummary(context: ActorContext, programmeVersionId: string, frameworkKey: string, versionLabel = "2022") {
  const data = await structureForProgramme(context, programmeVersionId);
  const framework = await frameworkEvaluations(context, programmeVersionId, data.items, frameworkKey, versionLabel);
  const expectationBundle = await frameworkExpectations(context, programmeVersionId, frameworkKey, versionLabel, framework.framework?.version.id);
  const totalCompetencies = framework.framework
    ? (
        await db
          .select()
          .from(competenciesTable)
          .where(eq(competenciesTable.frameworkVersionId, framework.framework.version.id))
      ).length
    : 0;
  const observedCompetencyIds = new Set(framework.evaluations.map((evaluation) => evaluation.competencyId).filter(Boolean));
  const expectedCompetencyIds = new Set(expectationBundle.expectations.filter((expectation) => expectation.expectedLevel !== "none").map((expectation) => expectation.competencyId));
  const moduleIds = data.items.map((item) => item.moduleId).filter((id): id is string => Boolean(id));
  const modulesWithFramework = new Set(framework.evaluations.map((evaluation) => evaluation.moduleId).filter(Boolean));
  const evidenceMaturityDistribution: Record<string, number> = {};
  for (const evaluation of framework.evaluations) {
    evidenceMaturityDistribution[evaluation.observedLevel] = (evidenceMaturityDistribution[evaluation.observedLevel] ?? 0) + 1;
  }
  const reviewStatusCounts: Record<string, number> = {};
  for (const evaluation of framework.evaluations) {
    reviewStatusCounts[evaluation.status] = (reviewStatusCounts[evaluation.status] ?? 0) + 1;
  }
  const matrix = expectationMatrix(data.items, data.groups, expectationBundle.expectations, framework.evaluations);
  const gapRows = matrix.rows.filter((row) => row.isGap);
  const strengthRows = matrix.rows.filter((row) => row.isStrength);

  return {
    status: "evidence_informed",
    frameworkKey,
    totalCompetences: totalCompetencies,
    competencesExpectedInProgramme: expectedCompetencyIds.size,
    competencesObservedInProgramme: observedCompetencyIds.size,
    modulesWithFrameworkEvidence: modulesWithFramework.size,
    modulesWithNoFrameworkEvidence: moduleIds.filter((moduleId) => !modulesWithFramework.has(moduleId)).length,
    evidenceLinkedEvaluations: framework.evaluations.filter((evaluation) => evaluation.evidenceCount > 0).length,
    unevidencedEvaluations: framework.evaluations.filter((evaluation) => evaluation.evidenceCount === 0).length,
    evidenceMaturityDistribution,
    scaffoldingDistribution: evidenceMaturityDistribution,
    reviewStatusCounts,
    expectedVersusObservedMatrix: matrix.matrix,
    gapSummary: {
      count: gapRows.length,
      evidenceGaps: gapRows.filter((row) => row.comparison === "evidence_gap").length,
      belowExpected: gapRows.filter((row) => row.comparison === "below_expected").length,
    },
    strengthSummary: {
      count: strengthRows.length,
      aligned: strengthRows.filter((row) => row.comparison === "aligned").length,
      aboveExpected: strengthRows.filter((row) => row.comparison === "above_expected").length,
      emergentStrengths: strengthRows.filter((row) => row.comparison === "emergent_strength").length,
    },
  };
}

function expectationMatrix(
  items: StructureItemRow[],
  groups: StructureGroupRow[],
  expectations: FrameworkExpectation[],
  evaluations: FrameworkEvaluation[],
) {
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const maturityLevels: EvidenceMaturityLevel[] = ["none", "developing", "consolidating", "leading"];
  const matrix = Object.fromEntries(maturityLevels.map((expected) => [expected, Object.fromEntries(maturityLevels.map((observed) => [observed, 0]))])) as Record<EvidenceMaturityLevel, Record<EvidenceMaturityLevel, number>>;
  const rows = [];

  for (const item of items) {
    const group = resolveGroup(groupsById, item);
    const relevantCompetencyIds = new Set([
      ...expectations.filter((expectation) => expectationAppliesToItem(expectation, item, group)).map((expectation) => expectation.competencyId),
      ...(evaluations.filter((evaluation) => evaluation.curatedStructureItemId === item.id || evaluation.moduleId === item.moduleId).map((evaluation) => evaluation.competencyId).filter(Boolean) as string[]),
    ]);

    for (const competencyId of relevantCompetencyIds) {
      const matchingExpectations = expectations.filter((expectation) => expectation.competencyId === competencyId);
      const expectation = bestExpectationForItem(matchingExpectations, item, group);
      const matchingEvaluations = evaluations.filter((evaluation) => evaluation.competencyId === competencyId && (evaluation.curatedStructureItemId === item.id || evaluation.moduleId === item.moduleId));
      const expectedLevel = evidenceMaturityLevel(expectation?.expectedLevel);
      const observedLevel = highestEvidenceMaturity(matchingEvaluations.map((evaluation) => evaluation.observedLevel));
      const evidenceCount = matchingEvaluations.reduce((sum, evaluation) => sum + evaluation.evidenceCount, 0);
      const comparison = compareEvidenceMaturity(expectedLevel, observedLevel, evidenceCount);
      matrix[expectedLevel][observedLevel] += 1;
      rows.push({
        curatedStructureItemId: item.id,
        moduleId: item.moduleId,
        competencyId,
        competencyName: expectation?.competency?.name ?? matchingEvaluations[0]?.competency?.name,
        domainName: expectation?.domain?.name ?? matchingEvaluations[0]?.domain?.name,
        expectedLevel,
        observedLevel,
        evidenceCount,
        reviewStatuses: [...new Set(matchingEvaluations.map((evaluation) => evaluation.status))],
        comparison,
        isGap: isGapComparison(comparison),
        isStrength: isStrengthComparison(comparison),
      });
    }
  }

  return { matrix, rows };
}

export async function getGreenCompCoverageSummary(context: ActorContext, programmeVersionId: string) {
  const summary = await getFrameworkCoverageSummary(context, programmeVersionId, "greencomp", "2022");
  return {
    ...summary,
    totalGreenCompCompetences: summary.totalCompetences,
    modulesWithGreenCompEvidence: summary.modulesWithFrameworkEvidence,
    modulesWithNoGreenCompEvidence: summary.modulesWithNoFrameworkEvidence,
  };
}

export async function getLifeCompCoverageSummary(context: ActorContext, programmeVersionId: string) {
  const summary = await getFrameworkCoverageSummary(context, programmeVersionId, "lifecomp", "2020");
  return {
    ...summary,
    totalLifeCompCompetences: summary.totalCompetences,
    modulesWithLifeCompEvidence: summary.modulesWithFrameworkEvidence,
    modulesWithNoLifeCompEvidence: summary.modulesWithNoFrameworkEvidence,
  };
}

export async function getEntreCompCoverageSummary(context: ActorContext, programmeVersionId: string) {
  const summary = await getFrameworkCoverageSummary(context, programmeVersionId, "entrecomp", "2016");
  return {
    ...summary,
    totalEntreCompCompetences: summary.totalCompetences,
    modulesWithEntreCompEvidence: summary.modulesWithFrameworkEvidence,
    modulesWithNoEntreCompEvidence: summary.modulesWithNoFrameworkEvidence,
  };
}

export async function getDigCompCoverageSummary(context: ActorContext, programmeVersionId: string) {
  const summary = await getFrameworkCoverageSummary(context, programmeVersionId, "digcomp", "3.0");
  return {
    ...summary,
    totalDigCompCompetences: summary.totalCompetences,
    modulesWithDigCompEvidence: summary.modulesWithFrameworkEvidence,
    modulesWithNoDigCompEvidence: summary.modulesWithNoFrameworkEvidence,
  };
}

export async function getFrameworkExpectationAnalysis(context: ActorContext, programmeVersionId: string, frameworkKey: string) {
  const versionLabel = defaultVersionForFramework(frameworkKey);
  const data = await structureForProgramme(context, programmeVersionId);
  const evaluations = await frameworkEvaluations(context, programmeVersionId, data.items, frameworkKey, versionLabel);
  const expectations = await frameworkExpectations(context, programmeVersionId, frameworkKey, versionLabel, evaluations.framework?.version.id);
  const matrix = expectationMatrix(data.items, data.groups, expectations.expectations, evaluations.evaluations);
  const byCompetency = expectations.competencies.map((competency) => {
    const competencyExpectations = expectations.expectations.filter((expectation) => expectation.competencyId === competency.id);
    const competencyEvaluations = evaluations.evaluations.filter((evaluation) => evaluation.competencyId === competency.id);
    const expectedLevel = highestEvidenceMaturity(competencyExpectations.map((expectation) => expectation.expectedLevel));
    const observedLevel = highestEvidenceMaturity(competencyEvaluations.map((evaluation) => evaluation.observedLevel));
    const evidenceCount = competencyEvaluations.reduce((sum, evaluation) => sum + evaluation.evidenceCount, 0);
    const comparison = compareEvidenceMaturity(expectedLevel, observedLevel, evidenceCount);
    return {
      competencyId: competency.id,
      competencyKey: competency.key,
      competencyName: competency.name,
      domainName: competency.domain?.name,
      expectedLevel,
      observedLevel,
      evidenceCount,
      reviewStatuses: [...new Set(competencyEvaluations.map((evaluation) => evaluation.status))],
      expectationCount: competencyExpectations.length,
      evaluationCount: competencyEvaluations.length,
      comparison,
    };
  });
  return {
    frameworkKey,
    versionLabel,
    programmeVersion: data.programmeVersion,
    summary: {
      totalCompetences: expectations.competencies.length,
      competencesWithExpectations: byCompetency.filter((row) => row.expectedLevel !== "none").length,
      competencesWithObservedEvidence: byCompetency.filter((row) => row.observedLevel !== "none" && row.evidenceCount > 0).length,
      gapCount: byCompetency.filter((row) => isGapComparison(row.comparison)).length,
      strengthCount: byCompetency.filter((row) => isStrengthComparison(row.comparison)).length,
      reviewReadyCount: evaluations.evaluations.filter((evaluation) => evaluation.status === "draft" || evaluation.status === "needs_review").length,
    },
    coverageSummary: await getFrameworkCoverageSummary(context, programmeVersionId, frameworkKey, versionLabel),
    expectedVersusObservedMatrix: matrix.matrix,
    moduleMatrix: matrix.rows,
    byCompetency,
  };
}

export async function createFrameworkCompetencyExpectation(
  context: ActorContext,
  programmeVersionId: string,
  frameworkKey: string,
  input: {
    competencyId?: string;
    competencyKey?: string;
    scope?: "programme" | "stage" | "semester" | "pathway" | "module_group" | "group" | "module";
    stage?: string;
    semester?: string;
    pathway?: string;
    curatedStructureGroupId?: string;
    moduleId?: string;
    expectedLevel?: EvidenceMaturityLevel;
    rationale?: string;
  },
) {
  const versionLabel = defaultVersionForFramework(frameworkKey);
  const framework = await frameworkVersion(frameworkKey, versionLabel);
  if (!framework) throw new Error(`${frameworkKey} framework seed has not been applied`);
  await programme(context, programmeVersionId);
  const [competency] = input.competencyId
    ? await db
        .select()
        .from(competenciesTable)
        .where(and(eq(competenciesTable.id, input.competencyId), eq(competenciesTable.frameworkVersionId, framework.version.id)))
        .limit(1)
    : await db
        .select()
        .from(competenciesTable)
        .where(and(eq(competenciesTable.key, input.competencyKey ?? ""), eq(competenciesTable.frameworkVersionId, framework.version.id)))
        .limit(1);
  if (!competency) throw new Error(`${frameworkKey} competency not found`);
  const scope = input.scope === "group" ? "module_group" : (input.scope ?? "programme");

  const [expectation] = await db
    .insert(programmeCompetencyExpectationsTable)
    .values({
      institutionId: context.institutionId,
      programmeVersionId,
      competencyId: competency.id,
      scope,
      stage: input.stage,
      semester: input.semester,
      pathway: input.pathway,
      curatedStructureGroupId: input.curatedStructureGroupId,
      moduleId: input.moduleId,
      expectedLevel: input.expectedLevel ?? "none",
      rationale: input.rationale,
      createdByUserId: context.userId,
      metadata: { framework: frameworkKey, evidenceMaturity: true },
    })
    .returning();

  return { expectation, competency, frameworkKey, versionLabel };
}

function keyFromName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function getProgrammeOwnedFramework(context: ActorContext, programmeVersionId: string) {
  await programme(context, programmeVersionId);
  const bundle = await programmeAttributeLayer(context, programmeVersionId);
  return {
    programmeVersionId,
    attributes: bundle.attributes,
    expectations: bundle.expectations,
    evaluations: bundle.evaluations,
    summary: {
      attributes: bundle.attributes.length,
      expectations: bundle.expectations.length,
      evaluations: bundle.evaluations.length,
      evidenceLinkedEvaluations: bundle.evaluations.filter((evaluation) => evaluation.evidenceCount > 0).length,
    },
  };
}

export async function createProgrammeGraduateAttribute(
  context: ActorContext,
  programmeVersionId: string,
  input: {
    key?: string;
    name: string;
    description?: string;
    kind?: "graduate_attribute" | "theme" | "learning_thread" | "signature_experience" | "programme_outcome";
    orderIndex?: number;
  },
) {
  await programme(context, programmeVersionId);
  const key = keyFromName(input.key ?? input.name);
  if (!key) throw new Error("Programme-owned framework item key could not be derived");
  const [attribute] = await db
    .insert(programmeGraduateAttributesTable)
    .values({
      institutionId: context.institutionId,
      programmeVersionId,
      key,
      name: input.name,
      description: input.description,
      status: "draft",
      orderIndex: input.orderIndex ?? 0,
      metadata: { kind: input.kind ?? "graduate_attribute", programmeOwnedFramework: true },
      createdByUserId: context.userId,
    })
    .returning();
  return { attribute };
}

export async function createProgrammeAttributeExpectation(
  context: ActorContext,
  programmeVersionId: string,
  attributeId: string,
  input: {
    scope?: "programme" | "stage" | "semester" | "pathway" | "module_group" | "group" | "module";
    stage?: string;
    semester?: string;
    pathway?: string;
    curatedStructureGroupId?: string;
    moduleId?: string;
    expectedLevel?: EvidenceMaturityLevel;
    rationale?: string;
  },
) {
  await programme(context, programmeVersionId);
  const [attribute] = await db
    .select()
    .from(programmeGraduateAttributesTable)
    .where(and(eq(programmeGraduateAttributesTable.id, attributeId), eq(programmeGraduateAttributesTable.institutionId, context.institutionId), eq(programmeGraduateAttributesTable.programmeVersionId, programmeVersionId)))
    .limit(1);
  if (!attribute) throw new Error("Programme-owned framework item not found");
  const scope = input.scope === "group" ? "module_group" : (input.scope ?? "programme");
  const [expectation] = await db
    .insert(programmeAttributeExpectationsTable)
    .values({
      institutionId: context.institutionId,
      programmeVersionId,
      programmeGraduateAttributeId: attribute.id,
      scope,
      stage: input.stage,
      semester: input.semester,
      pathway: input.pathway,
      curatedStructureGroupId: input.curatedStructureGroupId,
      moduleId: input.moduleId,
      expectedLevel: input.expectedLevel ?? "none",
      rationale: input.rationale,
      createdByUserId: context.userId,
      metadata: { programmeOwnedFramework: true },
    })
    .returning();
  return { attribute, expectation };
}

async function createFrameworkEvaluation(
  context: ActorContext,
  programmeVersionId: string,
  frameworkKey: string,
  versionLabel: string,
  phase: string,
  input: {
    competencyId?: string;
    competencyKey?: string;
    evidenceItemId?: string;
    curatedStructureItemId?: string;
    moduleId?: string;
    moduleDescriptorId?: string;
    observedLevel?: EvidenceMaturityLevel;
    status?: "draft" | "needs_review";
    confidence?: number;
    rationale?: string;
  },
) {
  const data = await structureForProgramme(context, programmeVersionId);
  const framework = await frameworkVersion(frameworkKey, versionLabel);
  if (!framework) throw new Error(`${frameworkKey} framework seed has not been applied`);
  const [competency] = input.competencyId
    ? await db
        .select()
        .from(competenciesTable)
        .where(and(eq(competenciesTable.id, input.competencyId), eq(competenciesTable.frameworkVersionId, framework.version.id)))
        .limit(1)
    : await db
        .select()
        .from(competenciesTable)
        .where(and(eq(competenciesTable.key, input.competencyKey ?? ""), eq(competenciesTable.frameworkVersionId, framework.version.id)))
        .limit(1);
  if (!competency) throw new Error(`${frameworkKey} competency not found`);

  const item = input.curatedStructureItemId
    ? data.items.find((candidate) => candidate.id === input.curatedStructureItemId)
    : input.moduleId
      ? data.items.find((candidate) => candidate.moduleId === input.moduleId)
      : data.items[0];
  const evidence = input.evidenceItemId
    ? (
        await db
          .select()
          .from(evidenceItemsTable)
          .where(and(eq(evidenceItemsTable.id, input.evidenceItemId), eq(evidenceItemsTable.institutionId, context.institutionId)))
          .limit(1)
      )[0]
    : undefined;

  const [evaluation] = await db
    .insert(competencyEvaluationsTable)
    .values({
      institutionId: context.institutionId,
      programmeVersionId,
      competencyId: competency.id,
      curatedStructureItemId: item?.id ?? input.curatedStructureItemId,
      moduleId: item?.moduleId ?? input.moduleId ?? evidence?.moduleId,
      moduleDescriptorId: item?.moduleDescriptorId ?? input.moduleDescriptorId,
      observedLevel: input.observedLevel ?? "developing",
      source: "human",
      status: input.status ?? "needs_review",
      confidence: input.confidence,
      rationale: input.rationale,
      createdByUserId: context.userId,
      metadata: { framework: frameworkKey, phase, aiClassification: false },
    })
    .returning();

  if (evidence) {
    await db.insert(competencyEvaluationEvidenceLinksTable).values({
      competencyEvaluationId: evaluation.id,
      evidenceItemId: evidence.id,
      relevance: input.confidence,
      notes: `Linked during non-AI ${frameworkKey} evaluation creation.`,
    });
  }

  return { evaluation, competency, evidenceLinked: Boolean(evidence) };
}

export async function createGreenCompEvaluation(
  context: ActorContext,
  programmeVersionId: string,
  input: Parameters<typeof createFrameworkEvaluation>[5],
) {
  return createFrameworkEvaluation(context, programmeVersionId, "greencomp", "2022", "5B", input);
}

export async function createLifeCompEvaluation(
  context: ActorContext,
  programmeVersionId: string,
  input: Parameters<typeof createFrameworkEvaluation>[5],
) {
  return createFrameworkEvaluation(context, programmeVersionId, "lifecomp", "2020", "5C", input);
}

export async function createEntreCompEvaluation(
  context: ActorContext,
  programmeVersionId: string,
  input: Parameters<typeof createFrameworkEvaluation>[5],
) {
  return createFrameworkEvaluation(context, programmeVersionId, "entrecomp", "2016", "5F", input);
}

export async function createDigCompEvaluation(
  context: ActorContext,
  programmeVersionId: string,
  input: Parameters<typeof createFrameworkEvaluation>[5],
) {
  return createFrameworkEvaluation(context, programmeVersionId, "digcomp", "3.0", "5G", input);
}
