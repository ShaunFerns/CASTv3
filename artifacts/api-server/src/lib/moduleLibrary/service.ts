import { and, asc, count, eq, inArray, or } from "drizzle-orm";
import {
  assessmentComponentsTable,
  curatedStructureItemsTable,
  curatedStructuresTable,
  dataQualityResultLinksTable,
  dataQualityResultsTable,
  db,
  evidenceItemsTable,
  importBatchesTable,
  moduleDescriptorsTable,
  modulesTable,
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
  dataQualityFlags: Array<{ id: string; title: string; severity: string; status: string }>;
  sourceLabel: "Curated module" | "Imported source only";
  updatedAt?: string | null;
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
    const descriptorToModule = new Map(descriptors.map((descriptor) => [descriptor.id, descriptor.moduleId]));
    for (const row of assessmentRows) {
      const moduleId = descriptorToModule.get(row.descriptorId);
      if (!moduleId) continue;
      assessmentCounts.set(moduleId, (assessmentCounts.get(moduleId) ?? 0) + Number(row.total));
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
