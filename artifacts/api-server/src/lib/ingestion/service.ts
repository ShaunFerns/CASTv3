import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import * as XLSX from "xlsx";
import {
  assessmentComponentsTable,
  dataQualityResultLinksTable,
  dataQualityResultsTable,
  dataQualityRulesTable,
  dataQualityRunsTable,
  db,
  descriptorSectionsTable,
  documentSectionsTable,
  documentVersionsTable,
  documentsTable,
  evidenceItemsTable,
  importBatchesTable,
  ingestionErrorsTable,
  ingestionItemsTable,
  ingestionRecordLinksTable,
  ingestionRunsTable,
  learningOutcomesTable,
  moduleDescriptorsTable,
  modulesTable,
  sourceModulesTable,
  sourceProgrammesTable,
  sourceRecordsTable,
  sourceStructureItemsTable,
  sourceSystemsTable,
} from "@workspace/db";
import { normalizeAkariRow, normalizeDescriptorSection, normalizeManualInput, sectionsFromText } from "./normalize.js";
import type {
  AkariIngestionInput,
  IngestionContext,
  IngestionPathway,
  IngestionResult,
  ManualModuleIngestionInput,
  NormalizedModuleInput,
  PdfDescriptorIngestionInput,
} from "./types.js";

type CreatedAccumulator = IngestionResult["created"];

const emptyCreated = (): CreatedAccumulator => ({
  importBatchIds: [],
  sourceRecordIds: [],
  sourceProgrammeIds: [],
  sourceModuleIds: [],
  sourceStructureItemIds: [],
  documentIds: [],
  documentVersionIds: [],
  documentSectionIds: [],
  moduleIds: [],
  moduleDescriptorIds: [],
  descriptorSectionIds: [],
  evidenceItemIds: [],
  dataQualityResultIds: [],
});

const missingRules = {
  moduleCode: "ingestion.missing_module_code",
  moduleTitle: "ingestion.missing_module_title",
  credits: "ingestion.missing_credits",
  stage: "ingestion.missing_stage",
  semester: "ingestion.missing_semester",
} as const;

function checksum(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function decodeBase64(base64: string | undefined): Buffer | undefined {
  return base64 ? Buffer.from(base64, "base64") : undefined;
}

function decodeText(base64: string | undefined): string | undefined {
  const buffer = decodeBase64(base64);
  return buffer?.toString("utf8");
}

function csvRows(csvText: string): Record<string, unknown>[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function spreadsheetRows(input: AkariIngestionInput): Record<string, unknown>[] {
  if (input.rows) return input.rows;
  if (input.csvText) return csvRows(input.csvText);

  const buffer = decodeBase64(input.fileBase64);
  if (!buffer) return [];

  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheet], { defval: "" });
}

async function extractPdfText(input: PdfDescriptorIngestionInput): Promise<string> {
  if (input.rawText?.trim()) return input.rawText.trim();
  const buffer = decodeBase64(input.fileBase64);
  if (!buffer) return "";

  try {
    const pdfParse = (await import("pdf-parse")) as unknown as {
      default?: (data: Buffer) => Promise<{ text?: string }>;
    };
    const parsed = pdfParse.default ? await pdfParse.default(buffer) : { text: "" };
    return parsed.text?.trim() ?? "";
  } catch {
    return "";
  }
}

async function createRun(context: IngestionContext, pathway: IngestionPathway, metadata: Record<string, unknown>) {
  const [run] = await db
    .insert(ingestionRunsTable)
    .values({
      institutionId: context.institutionId,
      pathway,
      status: "running",
      requestedByUserId: context.actor.userId,
      metadata,
    })
    .returning();
  return run;
}

async function updateRunComplete(runId: string, status: string, summary: Record<string, unknown>, errorSummary: Record<string, unknown> = {}) {
  await db
    .update(ingestionRunsTable)
    .set({ status, completedAt: new Date(), summary, errorSummary })
    .where(eq(ingestionRunsTable.id, runId));
}

async function linkRecord(runId: string, itemId: string | undefined, relationship: string, target: Record<string, string | undefined>) {
  await db.insert(ingestionRecordLinksTable).values({
    ingestionRunId: runId,
    ingestionItemId: itemId,
    relationship,
    ...target,
  });
}

async function ensureAkariSourceSystem(context: IngestionContext) {
  const [existing] = await db
    .select()
    .from(sourceSystemsTable)
    .where(and(eq(sourceSystemsTable.institutionId, context.institutionId), eq(sourceSystemsTable.key, "akari")))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(sourceSystemsTable)
    .values({
      institutionId: context.institutionId,
      key: "akari",
      name: "Akari",
      systemType: "akari",
      createdByUserId: context.actor.userId,
      metadata: { createdBy: "phase4a_ingestion" },
    })
    .returning();
  return created;
}

async function findOrCreateSourceProgramme(
  context: IngestionContext,
  importBatchId: string,
  sourceSystemId: string,
  input: NormalizedModuleInput,
  sourceRecordId: string,
) {
  const externalId = input.programmeCode ?? input.programmeName;
  if (!externalId) return undefined;

  const [existing] = await db
    .select()
    .from(sourceProgrammesTable)
    .where(and(eq(sourceProgrammesTable.sourceSystemId, sourceSystemId), eq(sourceProgrammesTable.externalId, externalId)))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(sourceProgrammesTable)
    .values({
      institutionId: context.institutionId,
      importBatchId,
      sourceSystemId,
      sourceRecordId,
      externalId,
      code: input.programmeCode,
      name: input.programmeName,
      school: input.school,
      department: input.department,
      campus: input.campus,
      rawPayload: input.raw ?? {},
      normalizedPayload: input,
    })
    .returning();
  return created;
}

async function findOrCreateModule(context: IngestionContext, input: NormalizedModuleInput, sourceModuleId?: string) {
  if (input.moduleCode) {
    const [existing] = await db
      .select()
      .from(modulesTable)
      .where(and(eq(modulesTable.institutionId, context.institutionId), eq(modulesTable.moduleCode, input.moduleCode)))
      .limit(1);
    if (existing) return existing;
  }

  const [created] = await db
    .insert(modulesTable)
    .values({
      institutionId: context.institutionId,
      sourceModuleId,
      moduleCode: input.moduleCode,
      moduleTitle: input.moduleTitle,
      defaultCredits: input.credits,
      school: input.school,
      department: input.department,
      campus: input.campus,
      status: input.moduleCode && input.moduleTitle ? "active" : "draft",
      createdByUserId: context.actor.userId,
      metadata: {
        ingestion: true,
        stage: input.stage,
        semester: input.semester,
      },
    })
    .returning();
  return created;
}

async function createDescriptor(
  context: IngestionContext,
  runId: string,
  itemIndex: number,
  moduleId: string,
  input: NormalizedModuleInput,
  sourceModuleId?: string,
) {
  const [descriptor] = await db
    .insert(moduleDescriptorsTable)
    .values({
      institutionId: context.institutionId,
      moduleId,
      sourceModuleId,
      versionLabel: `ingestion-${runId.slice(0, 8)}-${itemIndex + 1}`,
      status: input.descriptorText || input.sections?.some((section) => section.content) ? "active" : "draft",
      descriptorText: input.descriptorText,
      sourceType: "ingestion",
      createdByUserId: context.actor.userId,
      metadata: {
        pathway: "phase4a_ingestion",
        sourceIdentifier: input.sourceIdentifier,
      },
    })
    .returning();
  return descriptor;
}

async function createDocumentSnapshot(
  context: IngestionContext,
  runId: string,
  title: string,
  rawText: string,
  moduleId?: string,
  moduleDescriptorId?: string,
  fileName?: string,
  mimeType?: string,
) {
  const [document] = await db
    .insert(documentsTable)
    .values({
      institutionId: context.institutionId,
      moduleId,
      moduleDescriptorId,
      documentType: "module_descriptor",
      title,
      status: "active",
      createdByUserId: context.actor.userId,
      metadata: { generatedBy: "phase4a_ingestion", runId },
    })
    .returning();

  const [version] = await db
    .insert(documentVersionsTable)
    .values({
      institutionId: context.institutionId,
      documentId: document.id,
      versionLabel: `ingestion-${runId.slice(0, 8)}`,
      fileName,
      mimeType,
      checksum: checksum(rawText),
      rawText,
      status: "active",
      createdByUserId: context.actor.userId,
      metadata: { generatedBy: "phase4a_ingestion" },
    })
    .returning();

  return { document, version };
}

async function createSectionsAndEvidence(
  context: IngestionContext,
  runId: string,
  itemId: string,
  moduleId: string,
  moduleDescriptorId: string,
  input: NormalizedModuleInput,
  created: CreatedAccumulator,
  documentVersionId?: string,
) {
  const sectionInputs = input.sections?.length ? input.sections : sectionsFromText(input.descriptorText);
  for (const [index, rawSection] of sectionInputs.entries()) {
    const section = normalizeDescriptorSection(rawSection, index);
    if (!section.content.trim()) continue;

    const [descriptorSection] = await db
      .insert(descriptorSectionsTable)
      .values({
        institutionId: context.institutionId,
        moduleDescriptorId,
        sectionType: section.sectionType as typeof descriptorSectionsTable.$inferInsert.sectionType,
        title: section.title,
        content: section.content,
        orderIndex: section.orderIndex,
        sourceLocation: { ingestionRunId: runId, ingestionItemId: itemId },
      })
      .returning();
    created.descriptorSectionIds.push(descriptorSection.id);
    await linkRecord(runId, itemId, "created", { descriptorSectionId: descriptorSection.id });

    const [evidence] = await db
      .insert(evidenceItemsTable)
      .values({
        institutionId: context.institutionId,
        documentVersionId,
        descriptorSectionId: descriptorSection.id,
        moduleId,
        sourceKind: "descriptor_section",
        evidenceText: section.content,
        confidence: 1,
        status: "extracted",
        sourceLocation: { ingestionRunId: runId, ingestionItemId: itemId, descriptorSectionId: descriptorSection.id },
        metadata: { pathway: "phase4a_ingestion", sectionType: section.sectionType },
        createdByUserId: context.actor.userId,
      })
      .returning();
    created.evidenceItemIds.push(evidence.id);
    await linkRecord(runId, itemId, "created", { evidenceItemId: evidence.id });
  }
}

async function createLearningAndAssessmentFromSections(
  context: IngestionContext,
  moduleDescriptorId: string,
  input: NormalizedModuleInput,
) {
  const sections = input.sections ?? [];
  const learningSection = sections.find((section) => section.sectionType === "learning_outcomes" && section.content);
  if (learningSection?.content) {
    const outcomes = learningSection.content
      .split(/\r?\n|(?:^|\s)(?:\d+\.|\-)\s+/)
      .map((outcome) => outcome.trim())
      .filter((outcome) => outcome.length > 10);
    for (const [index, outcome] of outcomes.entries()) {
      await db.insert(learningOutcomesTable).values({
        institutionId: context.institutionId,
        moduleDescriptorId,
        outcomeCode: `LO${index + 1}`,
        outcomeText: outcome,
        orderIndex: index,
        status: "draft",
      });
    }
  }

  const assessmentSection = sections.find((section) => section.sectionType === "assessment" && section.content);
  if (assessmentSection?.content) {
    await db.insert(assessmentComponentsTable).values({
      institutionId: context.institutionId,
      moduleDescriptorId,
      componentName: "Assessment",
      description: assessmentSection.content,
      orderIndex: 0,
      status: "draft",
    });
  }
}

async function createQualityFindings(
  context: IngestionContext,
  runId: string,
  input: NormalizedModuleInput,
  created: CreatedAccumulator,
  target: { itemId?: string; importBatchId?: string; sourceRecordId?: string; moduleId?: string; moduleDescriptorId?: string },
) {
  const missing = [
    ["moduleCode", input.moduleCode],
    ["moduleTitle", input.moduleTitle],
    ["credits", input.credits],
    ["stage", input.stage],
    ["semester", input.semester],
  ] as const;

  const issues = missing.filter(([, value]) => value === undefined || value === null || value === "");
  if (issues.length === 0) return [];

  const [qualityRun] = await db
    .insert(dataQualityRunsTable)
    .values({
      institutionId: context.institutionId,
      importBatchId: target.importBatchId,
      status: "running",
      trigger: target.importBatchId ? "import" : "api",
      scope: { ingestionRunId: runId, ingestionItemId: target.itemId },
      requestedByUserId: context.actor.userId,
      startedAt: new Date(),
    })
    .returning();

  const qualityIds: string[] = [];
  for (const [field] of issues) {
    const key = missingRules[field];
    const [rule] = await db.select().from(dataQualityRulesTable).where(eq(dataQualityRulesTable.key, key)).limit(1);
    if (!rule) continue;

    const [result] = await db
      .insert(dataQualityResultsTable)
      .values({
        institutionId: context.institutionId,
        dataQualityRunId: qualityRun.id,
        dataQualityRuleId: rule.id,
        severity: rule.defaultSeverity,
        fingerprint: `${runId}:${target.itemId ?? "run"}:${field}`,
        title: rule.name,
        message: rule.description,
        details: { ingestionRunId: runId, ingestionItemId: target.itemId, field },
        observedValue: {},
        expectedValue: { present: true },
      })
      .returning();
    qualityIds.push(result.id);
    created.dataQualityResultIds.push(result.id);
    await linkRecord(runId, target.itemId, "quality_finding", { dataQualityResultId: result.id });

    if (target.sourceRecordId) {
      await db.insert(dataQualityResultLinksTable).values({
        dataQualityResultId: result.id,
        sourceRecordId: target.sourceRecordId,
        relationship: "affected_source",
      });
    } else if (target.moduleDescriptorId) {
      await db.insert(dataQualityResultLinksTable).values({
        dataQualityResultId: result.id,
        moduleDescriptorId: target.moduleDescriptorId,
        relationship: "affected_descriptor",
      });
    } else if (target.moduleId) {
      await db.insert(dataQualityResultLinksTable).values({
        dataQualityResultId: result.id,
        moduleId: target.moduleId,
        relationship: "affected_module",
      });
    }

    await db.insert(ingestionErrorsTable).values({
      ingestionRunId: runId,
      ingestionItemId: target.itemId,
      institutionId: context.institutionId,
      severity: rule.defaultSeverity,
      code: key,
      message: rule.description ?? rule.name,
      fieldPath: field,
    });
  }

  await db
    .update(dataQualityRunsTable)
    .set({
      status: "completed_with_issues",
      completedAt: new Date(),
      summary: { resultCount: qualityIds.length },
    })
    .where(eq(dataQualityRunsTable.id, qualityRun.id));

  return qualityIds;
}

async function materializeModule(
  context: IngestionContext,
  runId: string,
  itemIndex: number,
  input: NormalizedModuleInput,
  created: CreatedAccumulator,
  options: { itemType: string; sourceRecordId?: string; sourceModuleId?: string; importBatchId?: string; documentVersionId?: string },
) {
  const [item] = await db
    .insert(ingestionItemsTable)
    .values({
      ingestionRunId: runId,
      institutionId: context.institutionId,
      itemType: options.itemType,
      status: "running",
      sourceIdentifier: input.sourceIdentifier,
      rowNumber: input.rowNumber != null ? String(input.rowNumber) : undefined,
      inputPayload: input.raw ?? {},
      normalizedPayload: input,
    })
    .returning();

  const module = await findOrCreateModule(context, input, options.sourceModuleId);
  created.moduleIds.push(module.id);
  await linkRecord(runId, item.id, "created_or_matched", { moduleId: module.id });

  const descriptor = await createDescriptor(context, runId, itemIndex, module.id, input, options.sourceModuleId);
  created.moduleDescriptorIds.push(descriptor.id);
  await linkRecord(runId, item.id, "created", { moduleDescriptorId: descriptor.id });

  await createSectionsAndEvidence(context, runId, item.id, module.id, descriptor.id, input, created, options.documentVersionId);
  await createLearningAndAssessmentFromSections(context, descriptor.id, input);

  const qualityIds = await createQualityFindings(context, runId, input, created, {
    itemId: item.id,
    importBatchId: options.importBatchId,
    sourceRecordId: options.sourceRecordId,
    moduleId: module.id,
    moduleDescriptorId: descriptor.id,
  });

  await db
    .update(ingestionItemsTable)
    .set({
      status: qualityIds.length > 0 ? "completed_with_issues" : "completed",
      summary: {
        moduleId: module.id,
        moduleDescriptorId: descriptor.id,
        evidenceCount: created.evidenceItemIds.length,
        qualityIssueCount: qualityIds.length,
      },
    })
    .where(eq(ingestionItemsTable.id, item.id));

  return { item, module, descriptor, qualityIds };
}

export async function ingestAkariExport(context: IngestionContext, input: AkariIngestionInput): Promise<IngestionResult> {
  const run = await createRun(context, "akari", { fileName: input.fileName, mimeType: input.mimeType });
  const created = emptyCreated();
  const errors: IngestionResult["errors"] = [];

  try {
    const rows = spreadsheetRows(input);
    const sourceSystem = await ensureAkariSourceSystem(context);
    const [batch] = await db
      .insert(importBatchesTable)
      .values({
        institutionId: context.institutionId,
        sourceSystemId: sourceSystem.id,
        batchType: "module_catalogue",
        status: "running",
        externalBatchId: `ingestion-${run.id}`,
        createdByUserId: context.actor.userId,
        summary: { fileName: input.fileName, rowCount: rows.length },
      })
      .returning();
    created.importBatchIds.push(batch.id);
    await linkRecord(run.id, undefined, "created", { importBatchId: batch.id });

    for (const [index, row] of rows.entries()) {
      const normalized = normalizeAkariRow(row, index);
      const [sourceRecord] = await db
        .insert(sourceRecordsTable)
        .values({
          institutionId: context.institutionId,
          importBatchId: batch.id,
          sourceSystemId: sourceSystem.id,
          recordType: "module",
          status: "parsed",
          sourceIdentifier: normalized.sourceIdentifier,
          sourceHash: checksum(JSON.stringify(row)),
          rowNumber: Number(normalized.rowNumber),
          payload: row,
          rawText: normalized.descriptorText,
        })
        .returning();
      created.sourceRecordIds.push(sourceRecord.id);
      await linkRecord(run.id, undefined, "created", { sourceRecordId: sourceRecord.id });

      const [sourceModule] = await db
        .insert(sourceModulesTable)
        .values({
          institutionId: context.institutionId,
          importBatchId: batch.id,
          sourceSystemId: sourceSystem.id,
          sourceRecordId: sourceRecord.id,
          externalId: normalized.sourceIdentifier,
          moduleCode: normalized.moduleCode,
          moduleTitle: normalized.moduleTitle,
          credits: normalized.credits != null ? String(normalized.credits) : undefined,
          stage: normalized.stage,
          semester: normalized.semester,
          school: normalized.school,
          department: normalized.department,
          campus: normalized.campus,
          descriptorText: normalized.descriptorText,
          rawPayload: row,
          normalizedPayload: normalized,
        })
        .returning();
      created.sourceModuleIds.push(sourceModule.id);
      await linkRecord(run.id, undefined, "created", { sourceModuleId: sourceModule.id });

      const sourceProgramme = await findOrCreateSourceProgramme(context, batch.id, sourceSystem.id, normalized, sourceRecord.id);
      if (sourceProgramme) {
        created.sourceProgrammeIds.push(sourceProgramme.id);
        await linkRecord(run.id, undefined, "created_or_matched", { sourceProgrammeId: sourceProgramme.id });
      }

      if (normalized.stage || normalized.semester || normalized.credits) {
        const [sourceStructureItem] = await db
          .insert(sourceStructureItemsTable)
          .values({
            institutionId: context.institutionId,
            importBatchId: batch.id,
            sourceSystemId: sourceSystem.id,
            sourceRecordId: sourceRecord.id,
            sourceProgrammeId: sourceProgramme?.id,
            sourceModuleId: sourceModule.id,
            externalId: `${normalized.sourceIdentifier ?? sourceModule.id}:structure`,
            stage: normalized.stage,
            semester: normalized.semester,
            credits: normalized.credits != null ? String(normalized.credits) : undefined,
            rawPayload: row,
            normalizedPayload: normalized,
          })
          .returning();
        created.sourceStructureItemIds.push(sourceStructureItem.id);
        await linkRecord(run.id, undefined, "created", { sourceStructureItemId: sourceStructureItem.id });
      }

      await materializeModule(context, run.id, index, normalized, created, {
        itemType: "akari_module",
        sourceRecordId: sourceRecord.id,
        sourceModuleId: sourceModule.id,
        importBatchId: batch.id,
      });
    }

    await db
      .update(importBatchesTable)
      .set({
        status: created.dataQualityResultIds.length > 0 ? "completed_with_errors" : "completed",
        completedAt: new Date(),
        summary: {
          rowCount: rows.length,
          moduleCount: created.moduleIds.length,
          descriptorCount: created.moduleDescriptorIds.length,
          evidenceCount: created.evidenceItemIds.length,
          qualityIssueCount: created.dataQualityResultIds.length,
        },
      })
      .where(eq(importBatchesTable.id, batch.id));

    const status = created.dataQualityResultIds.length > 0 ? "completed_with_issues" : "completed";
    await updateRunComplete(run.id, status, { rowCount: rows.length, created });
    return { runId: run.id, status, created, errors };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown ingestion failure";
    errors.push({ code: "ingestion.failed", message, severity: "error" });
    await updateRunComplete(run.id, "failed", { created }, { message });
    return { runId: run.id, status: "failed", created, errors };
  }
}

export async function ingestManualModule(context: IngestionContext, input: ManualModuleIngestionInput): Promise<IngestionResult> {
  const run = await createRun(context, "manual_module", { source: "manual_form" });
  const created = emptyCreated();
  const normalized = normalizeManualInput({ ...input, sourceIdentifier: input.moduleCode ?? input.moduleTitle ?? "manual-module", raw: input });
  const rawText = normalized.descriptorText ?? normalized.sections?.map((section) => `${section.title ?? section.sectionType}\n${section.content}`).join("\n\n") ?? "";

  try {
    const { document, version } = await createDocumentSnapshot(
      context,
      run.id,
      normalized.moduleTitle ?? normalized.moduleCode ?? "Manual module descriptor",
      rawText,
      undefined,
      undefined,
      "manual-module-descriptor.txt",
      "text/plain",
    );
    created.documentIds.push(document.id);
    created.documentVersionIds.push(version.id);
    await linkRecord(run.id, undefined, "created", { documentId: document.id });
    await linkRecord(run.id, undefined, "created", { documentVersionId: version.id });

    const result = await materializeModule(context, run.id, 0, normalized, created, {
      itemType: "manual_module",
      documentVersionId: version.id,
    });

    await db.update(documentsTable).set({ moduleId: result.module.id, moduleDescriptorId: result.descriptor.id }).where(eq(documentsTable.id, document.id));
    const status = created.dataQualityResultIds.length > 0 ? "completed_with_issues" : "completed";
    await updateRunComplete(run.id, status, { created });
    return { runId: run.id, status, created, errors: [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown ingestion failure";
    await updateRunComplete(run.id, "failed", { created }, { message });
    return { runId: run.id, status: "failed", created, errors: [{ code: "ingestion.failed", message, severity: "error" }] };
  }
}

export async function ingestSinglePdfDescriptor(context: IngestionContext, input: PdfDescriptorIngestionInput): Promise<IngestionResult> {
  const rawText = await extractPdfText(input);
  const run = await createRun(context, "single_pdf", { fileName: input.fileName, mimeType: input.mimeType, extractedText: rawText.length > 0 });
  const created = emptyCreated();

  try {
    const normalized = normalizeManualInput({
      moduleCode: input.moduleCode,
      moduleTitle: input.moduleTitle,
      credits: input.credits,
      stage: input.stage,
      semester: input.semester,
      descriptorText: rawText,
      sections: input.sections?.length ? input.sections : sectionsFromText(rawText),
      sourceIdentifier: input.fileName,
      raw: { fileName: input.fileName, mimeType: input.mimeType },
    });

    const { document, version } = await createDocumentSnapshot(
      context,
      run.id,
      input.moduleTitle ?? input.moduleCode ?? input.fileName,
      rawText,
      undefined,
      undefined,
      input.fileName,
      input.mimeType ?? "application/pdf",
    );
    created.documentIds.push(document.id);
    created.documentVersionIds.push(version.id);
    await linkRecord(run.id, undefined, "created", { documentId: document.id });
    await linkRecord(run.id, undefined, "created", { documentVersionId: version.id });

    if (rawText) {
      const [documentSection] = await db
        .insert(documentSectionsTable)
        .values({
          institutionId: context.institutionId,
          documentVersionId: version.id,
          sectionType: "paragraph",
          heading: "Extracted descriptor text",
          content: rawText,
          orderIndex: 0,
          sourceLocation: { ingestionRunId: run.id },
        })
        .returning();
      created.documentSectionIds.push(documentSection.id);
      await linkRecord(run.id, undefined, "created", { documentSectionId: documentSection.id });
    }

    const result = await materializeModule(context, run.id, 0, normalized, created, {
      itemType: "pdf_module_descriptor",
      documentVersionId: version.id,
    });

    await db.update(documentsTable).set({ moduleId: result.module.id, moduleDescriptorId: result.descriptor.id }).where(eq(documentsTable.id, document.id));
    const status = created.dataQualityResultIds.length > 0 ? "completed_with_issues" : "completed";
    await updateRunComplete(run.id, status, { created });
    return { runId: run.id, status, created, errors: [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown ingestion failure";
    await updateRunComplete(run.id, "failed", { created }, { message });
    return { runId: run.id, status: "failed", created, errors: [{ code: "ingestion.failed", message, severity: "error" }] };
  }
}
