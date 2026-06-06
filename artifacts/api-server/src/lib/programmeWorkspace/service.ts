import { and, asc, eq, inArray } from "drizzle-orm";
import {
  curatedStructureGroupsTable,
  curatedStructureItemsTable,
  curatedStructuresTable,
  dataQualityResultLinksTable,
  dataQualityResultsTable,
  dataQualityRulesTable,
  dataQualityRunsTable,
  db,
  moduleDescriptorsTable,
  modulesTable,
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
        coreOption: coreOption(sourceItem.coreOption),
        stage: sourceItem.stage,
        semester: sourceItem.semester,
        pathway: sourceItem.pathway,
        credits: Number.isFinite(credits) ? credits : undefined,
        orderIndex: sourceItem.orderIndex ?? index,
        label: module?.moduleTitle ?? sourceItem.externalId,
        metadata: {
          sourceCoreOption: sourceItem.coreOption,
          sourceGroupName: sourceItem.groupName,
          generatedBy: "phase4b_structure_builder",
        },
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

  return { structure, groupsCreated, itemsCreated };
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
    missingFromCurated: sourceItems.filter((sourceItem) => !curatedItems.some((item) => item.sourceStructureItemId === sourceItem.id)),
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
