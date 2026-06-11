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
import { generateDraftProgrammesFromSourceProgrammes } from "../programmeWorkspace/service.js";
import { materialiseAssessmentDesignLayer, materialiseModalityDesignLayer } from "../curriculumDesignLayers/service.js";
import type {
  AkariIngestionInput,
  IngestionContext,
  IngestionPathway,
  IngestionResult,
  ManualModuleIngestionInput,
  NormalizedAssessmentComponentInput,
  NormalizedLearningOutcomeInput,
  NormalizedModuleInput,
  NormalizedProgrammeLinkInput,
  PdfDescriptorIngestionInput,
} from "./types.js";
import { logger } from "../logger.js";

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

async function generateProvisionalProgrammeAnalysis(context: IngestionContext, programmeVersionIds: string[]) {
  const summaries = [];
  const analysisContext = { institutionId: context.institutionId, userId: context.actor.userId };
  for (const programmeVersionId of [...new Set(programmeVersionIds)].filter(Boolean)) {
    try {
      const [assessment, modality] = await Promise.all([
        materialiseAssessmentDesignLayer(analysisContext, programmeVersionId),
        materialiseModalityDesignLayer(analysisContext, programmeVersionId),
      ]);
      summaries.push({
        programmeVersionId,
        status: "completed",
        notice: "Provisional analysis. Review required before formal use.",
        layers: {
          assessmentDesign: {
            indicatorCount: assessment.indicatorCount,
            highestObservedMaturity: assessment.highestObservedMaturity,
          },
          modalityDesign: {
            indicatorCount: modality.indicatorCount,
            highestObservedMaturity: modality.highestObservedMaturity,
          },
        },
      });
    } catch (error) {
      logger.warn(
        { err: error, institutionId: context.institutionId, programmeVersionId },
        "Provisional programme analysis could not be generated after upload",
      );
      summaries.push({
        programmeVersionId,
        status: "skipped",
        notice: "Provisional analysis could not be generated for this programme.",
        error: error instanceof Error ? error.message : "Unknown provisional analysis error",
      });
    }
  }
  return summaries;
}

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

class AkariIngestionValidationError extends Error {
  constructor(
    message: string,
    readonly code = "akari.validation",
  ) {
    super(message);
    this.name = "AkariIngestionValidationError";
  }
}

function isAkariValidationError(error: unknown): error is AkariIngestionValidationError {
  return error instanceof AkariIngestionValidationError;
}

function fileExtension(fileName: string | undefined): string | undefined {
  const match = fileName?.toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match?.[1];
}

function validateAkariFileInput(input: AkariIngestionInput) {
  if (input.rows || input.csvText) return;
  if (!input.fileBase64) {
    throw new AkariIngestionValidationError("Choose a CSV, XLSX or XLS file before uploading.", "akari.file_missing");
  }

  const extension = fileExtension(input.fileName);
  const allowed = new Set([".csv", ".xlsx", ".xls"]);
  if (extension && !allowed.has(extension)) {
    throw new AkariIngestionValidationError("Programme data uploads support CSV, XLSX and XLS files.", "akari.unsupported_file_type");
  }
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

type AkariParsedInput = {
  modules: NormalizedModuleInput[];
  rowCount: number;
  sheetNames: string[];
  summary: Record<string, unknown>;
  skippedRows: Array<{ sheet: string; rowNumber: number; reason: string }>;
};

const akariKnownSheets = new Set([
  "affiliated programmes",
  "module overview",
  "learning outcomes",
  "module assessments",
  "module modalities",
  "indicative syllabus",
  "indicative syllabus new table",
  "learning teaching methods",
  "requisites",
  "reassessment requirement",
  "change description",
]);

function cleanKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function cell(row: Record<string, unknown>, ...names: string[]): string | undefined {
  const entries = Object.entries(row);
  for (const name of names) {
    const found = entries.find(([key]) => cleanKey(key) === cleanKey(name));
    if (!found) continue;
    const value = found[1];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return undefined;
}

function numberCell(row: Record<string, unknown>, ...names: string[]): number | undefined {
  const value = cell(row, ...names);
  if (!value) return undefined;
  const parsed = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function moduleJoinKey(row: Record<string, unknown>): string | undefined {
  const moduleId = cell(row, "Module Id", "Module ID");
  const deliveryPeriodId = cell(row, "Delivery Period Id", "Delivery Period ID");
  const moduleCode = cell(row, "Module Code");
  const version = cell(row, "Version");
  const parts = [moduleId, deliveryPeriodId, moduleCode, version].map((part) => part?.toLowerCase() ?? "");
  if (!parts.some(Boolean)) return undefined;
  return parts.join("::");
}

function moduleSourceIdentifier(row: Record<string, unknown>, fallback: string): string {
  const moduleId = cell(row, "Module Id", "Module ID");
  const deliveryPeriodId = cell(row, "Delivery Period Id", "Delivery Period ID");
  const moduleCode = cell(row, "Module Code");
  const version = cell(row, "Version");
  return [moduleId, deliveryPeriodId, moduleCode, version].filter(Boolean).join(":") || fallback;
}

function preferredModuleTitle(row: Record<string, unknown>): string | undefined {
  return cell(row, "Module Short Title", "Module Long Title", "Module Title", "Title");
}

function mergeModuleCore(target: NormalizedModuleInput, row: Record<string, unknown>, fallbackIdentifier: string) {
  target.moduleCode ??= cell(row, "Module Code");
  target.moduleTitle ??= preferredModuleTitle(row);
  target.credits ??= numberCell(row, "ECTS Credits", "Credits", "ECTS");
  target.stage ??= cell(row, "Level", "Stage");
  target.semester ??= cell(row, "Semester", "Teaching Period");
  target.school ??= cell(row, "School");
  target.department ??= cell(row, "Faculty", "Department");
  target.campus ??= cell(row, "Campus");
  target.sourceIdentifier ??= moduleSourceIdentifier(row, fallbackIdentifier);
}

function addSection(input: NormalizedModuleInput, sectionType: string, title: string, content: string | undefined, raw?: Record<string, unknown>) {
  if (!content?.trim()) return;
  input.sections ??= [];
  input.sections.push({
    sectionType,
    title,
    content: content.trim(),
  });
  input.raw ??= {};
  if (raw) input.raw[`section:${title}`] = raw;
}

function addProgramme(input: NormalizedModuleInput, programme: NormalizedProgrammeLinkInput) {
  if (!programme.programmeCode && !programme.programmeName) return;
  input.programmes ??= [];
  const key = `${programme.programmeCode ?? ""}:${programme.programmeName ?? ""}:${programme.programmeVersion ?? ""}`;
  const exists = input.programmes.some((existing) => `${existing.programmeCode ?? ""}:${existing.programmeName ?? ""}:${existing.programmeVersion ?? ""}` === key);
  if (!exists) input.programmes.push(programme);
}

function modalityContent(row: Record<string, unknown>): string | undefined {
  const fields = [
    ["Module Modalities", cell(row, "Module Modalities")],
    ["Full time / part time", cell(row, "Full Time / Part Time Module Modalities")],
    ["Module category", cell(row, "Module Category Module Modalities")],
    ["Delivery mode", cell(row, "Modality Delivery Mode Module Modalities")],
    ["Location", cell(row, "Location Module Modalities")],
  ].filter(([, value]) => value);
  if (fields.length === 0) return undefined;
  return fields.map(([label, value]) => `${label}: ${value}`).join("\n");
}

function createSingleSheetParsed(rows: Record<string, unknown>[]): AkariParsedInput {
  const modules = rows.map((row, index) => normalizeAkariRow(row, index));
  return {
    modules,
    rowCount: rows.length,
    sheetNames: [],
    summary: {
      rowCount: rows.length,
      moduleCount: modules.length,
      parser: "single_sheet",
    },
    skippedRows: [],
  };
}

function parseAkariWorkbook(workbook: XLSX.WorkBook): AkariParsedInput | undefined {
  const matchedSheetNames = workbook.SheetNames.filter((name) => akariKnownSheets.has(cleanKey(name)));
  if (matchedSheetNames.length <= 1) return undefined;

  const modules = new Map<string, NormalizedModuleInput>();
  const skippedRows: Array<{ sheet: string; rowNumber: number; reason: string }> = [];
  let rowCount = 0;

  function moduleFor(row: Record<string, unknown>, sheet: string, index: number): NormalizedModuleInput | undefined {
    const key = moduleJoinKey(row);
    if (!key) {
      skippedRows.push({ sheet, rowNumber: index + 2, reason: "Missing shared module identifiers" });
      return undefined;
    }
    const existing = modules.get(key);
    if (existing) {
      mergeModuleCore(existing, row, key);
      return existing;
    }

    const created: NormalizedModuleInput = {
      raw: { joinKey: key },
      sections: [],
      programmes: [],
      learningOutcomes: [],
      assessmentComponents: [],
      importStats: { rowsSkipped: skippedRows },
    };
    mergeModuleCore(created, row, key);
    modules.set(key, created);
    return created;
  }

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
    const normalizedSheetName = cleanKey(sheetName);
    if (!akariKnownSheets.has(normalizedSheetName)) continue;
    rowCount += rows.length;

    for (const [index, row] of rows.entries()) {
      const input = moduleFor(row, sheetName, index);
      if (!input) continue;

      if (normalizedSheetName === "affiliated programmes") {
        addProgramme(input, {
          programmeCode: cell(row, "Programme Code"),
          programmeName: cell(row, "Programme Title", "Programme Name"),
          programmeVersion: cell(row, "Programme Version"),
        });
      } else if (normalizedSheetName === "module overview") {
        addSection(input, "aims", "Module Overview", cell(row, "Module Overview"), row);
      } else if (normalizedSheetName === "learning outcomes") {
        const description = cell(row, "Learning Outcome Description");
        if (description) {
          input.learningOutcomes ??= [];
          input.learningOutcomes.push({
            code: cell(row, "Learning Outcome Code"),
            description,
            raw: row,
          });
        }
      } else if (normalizedSheetName === "module assessments") {
        input.assessmentComponents ??= [];
        input.assessmentComponents.push({
          category: cell(row, "Assessment Category"),
          type: cell(row, "Assessment Type"),
          percentage: numberCell(row, "Percentage of Total"),
          indicativeWeek: cell(row, "Indicative Week"),
          semester: cell(row, "Semester"),
          passFail: cell(row, "Pass/Fail"),
          threshold: cell(row, "Assessment Threshold"),
          authenticity: cell(row, "Assessment Authenticity"),
          learningOutcomesAddressed: cell(row, "Learning Outcomes Addressed"),
          description: cell(row, "Assessment Description"),
          raw: row,
        });
      } else if (normalizedSheetName === "indicative syllabus") {
        addSection(input, "indicative_content", "Indicative Syllabus", cell(row, "Indicative Syllabus"), row);
      } else if (normalizedSheetName === "indicative syllabus new table") {
        addSection(input, "indicative_content", "Indicative Syllabus", cell(row, "Indicative Syllabus New Table"), row);
      } else if (normalizedSheetName === "learning teaching methods") {
        addSection(input, "teaching_and_learning_strategy", "Learning and Teaching Methods", cell(row, "Learning and Teaching Methods"), row);
      } else if (normalizedSheetName === "requisites") {
        const requisite = [
          cell(row, "Requisite Type") ? `Requisite type: ${cell(row, "Requisite Type")}` : undefined,
          cell(row, "Module Title") ? `Module title: ${cell(row, "Module Title")}` : undefined,
          cell(row, "Type") ? `Type: ${cell(row, "Type")}` : undefined,
          cell(row, "Requisites Note"),
        ].filter(Boolean).join("\n");
        addSection(input, "requisites", "Requisites", requisite, row);
      } else if (normalizedSheetName === "reassessment requirement") {
        const reassessment = [
          cell(row, "Reassessment Requirement"),
          cell(row, "Special Repeat Arrangements"),
        ].filter(Boolean).join("\n\n");
        addSection(input, "assessment", "Reassessment Requirement", reassessment, row);
      } else if (normalizedSheetName === "change description") {
        addSection(input, "other", "Change Description", cell(row, "Change Description"), row);
      } else if (normalizedSheetName === "module modalities") {
        addSection(input, "modality", "Module Modalities", modalityContent(row), row);
      }
    }
  }

  for (const input of modules.values()) {
    const sectionText = input.sections?.map((section) => `${section.title}\n${section.content}`).join("\n\n");
    input.descriptorText = sectionText || undefined;
    input.programmeCode = input.programmes?.[0]?.programmeCode;
    input.programmeName = input.programmes?.[0]?.programmeName;
    input.importStats = {
      ...input.importStats,
      hasOverview: input.sections?.some((section) => section.title === "Module Overview") ?? false,
      hasLearningOutcomes: Boolean(input.learningOutcomes?.length),
      hasAssessments: Boolean(input.assessmentComponents?.length),
      hasModalityEvidence: input.sections?.some((section) => section.sectionType === "modality") ?? false,
      hasProgrammeLinks: Boolean(input.programmes?.length),
      rowsSkipped: skippedRows,
    };
  }

  const moduleList = [...modules.values()];
  return {
    modules: moduleList,
    rowCount,
    sheetNames: matchedSheetNames,
    skippedRows,
    summary: {
      parser: "akari_multi_sheet",
      sheetCount: matchedSheetNames.length,
      rowCount,
      moduleCount: moduleList.length,
      modulesWithOverview: moduleList.filter((module) => module.importStats?.hasOverview).length,
      modulesWithLearningOutcomes: moduleList.filter((module) => module.importStats?.hasLearningOutcomes).length,
      modulesWithAssessments: moduleList.filter((module) => module.importStats?.hasAssessments).length,
      modulesWithModalityEvidence: moduleList.filter((module) => module.importStats?.hasModalityEvidence).length,
      modulesWithProgrammeLinks: moduleList.filter((module) => module.importStats?.hasProgrammeLinks).length,
      rowsSkipped: skippedRows.length,
      skippedRows,
    },
  };
}

function spreadsheetRows(input: AkariIngestionInput): AkariParsedInput {
  validateAkariFileInput(input);
  if (input.rows) return createSingleSheetParsed(input.rows);
  if (input.csvText) return createSingleSheetParsed(csvRows(input.csvText));

  const buffer = decodeBase64(input.fileBase64);
  if (!buffer) return createSingleSheetParsed([]);

  const extension = fileExtension(input.fileName);
  const mimeType = input.mimeType?.toLowerCase() ?? "";
  if (extension === ".csv" || mimeType.includes("csv")) {
    return createSingleSheetParsed(csvRows(buffer.toString("utf8")));
  }

  const workbook = XLSX.read(buffer, { type: "buffer" });
  const multiSheet = parseAkariWorkbook(workbook);
  if (multiSheet) return multiSheet;
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return createSingleSheetParsed([]);
  return createSingleSheetParsed(XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheet], { defval: "" }));
}

function validateAkariRows(parsed: AkariParsedInput) {
  if (parsed.modules.length === 0) {
    throw new AkariIngestionValidationError("The spreadsheet did not contain any readable rows.", "akari.no_rows");
  }

  const hasRecognisedModuleData = parsed.modules.some((normalized) => (
    normalized.moduleCode
    || normalized.moduleTitle
    || normalized.descriptorText
    || normalized.programmeCode
    || normalized.programmeName
    || normalized.learningOutcomes?.length
    || normalized.assessmentComponents?.length
  ));

  if (!hasRecognisedModuleData) {
    throw new AkariIngestionValidationError(
      "No recognised programme or module rows were found. Check headings such as module code, module title, programme code or programme name.",
      "akari.unrecognised_columns",
    );
  }
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
  programme?: NormalizedProgrammeLinkInput,
) {
  const programmeCode = programme?.programmeCode ?? input.programmeCode;
  const programmeName = programme?.programmeName ?? input.programmeName;
  const programmeVersion = programme?.programmeVersion;
  const externalId = [programmeCode, programmeVersion].filter(Boolean).join(":") || programmeName;
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
      code: programmeCode,
      name: programmeName,
      school: input.school,
      department: input.department,
      campus: input.campus,
      rawPayload: programme ? { programme, moduleSourceIdentifier: input.sourceIdentifier } : input.raw ?? {},
      normalizedPayload: programme ? { ...programme, moduleSourceIdentifier: input.sourceIdentifier } : input,
    })
    .returning();
  return created;
}

async function findOrCreateSourceModule(
  context: IngestionContext,
  importBatchId: string,
  sourceSystemId: string,
  sourceRecordId: string,
  externalId: string,
  input: NormalizedModuleInput,
  row: Record<string, unknown>,
) {
  const [existing] = await db
    .select()
    .from(sourceModulesTable)
    .where(and(eq(sourceModulesTable.sourceSystemId, sourceSystemId), eq(sourceModulesTable.externalId, externalId)))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(sourceModulesTable)
      .set({
        sourceRecordId,
        importBatchId,
        moduleCode: input.moduleCode ?? existing.moduleCode,
        moduleTitle: input.moduleTitle ?? existing.moduleTitle,
        credits: input.credits != null ? String(input.credits) : existing.credits,
        level: input.stage ?? existing.level,
        stage: input.stage ?? existing.stage,
        semester: input.semester ?? existing.semester,
        school: input.school ?? existing.school,
        department: input.department ?? existing.department,
        campus: input.campus ?? existing.campus,
        descriptorText: input.descriptorText ?? existing.descriptorText,
        rawPayload: row,
        normalizedPayload: input,
      })
      .where(eq(sourceModulesTable.id, existing.id))
      .returning();
    return { sourceModule: updated, created: false };
  }

  const [created] = await db
    .insert(sourceModulesTable)
    .values({
      institutionId: context.institutionId,
      importBatchId,
      sourceSystemId,
      sourceRecordId,
      externalId,
      moduleCode: input.moduleCode,
      moduleTitle: input.moduleTitle,
      credits: input.credits != null ? String(input.credits) : undefined,
      level: input.stage,
      stage: input.stage,
      semester: input.semester,
      school: input.school,
      department: input.department,
      campus: input.campus,
      descriptorText: input.descriptorText,
      rawPayload: row,
      normalizedPayload: input,
    })
    .returning();

  return { sourceModule: created, created: true };
}

function sourceRecordIdentifier(input: NormalizedModuleInput, index: number): string {
  const base = input.sourceIdentifier ?? input.moduleCode ?? input.moduleTitle ?? "row";
  return `${base}:row-${input.rowNumber ?? index + 2}`;
}

function sourceModuleExternalId(input: NormalizedModuleInput, importBatchId: string): string {
  if (input.sourceIdentifier) return input.sourceIdentifier;
  if (input.moduleCode) return input.moduleCode;
  return `${importBatchId}:${input.sourceIdentifier ?? input.rowNumber ?? "module"}`;
}

async function findOrCreateModule(context: IngestionContext, input: NormalizedModuleInput, sourceModuleId?: string) {
  if (input.moduleCode) {
    const [existing] = await db
      .select()
      .from(modulesTable)
      .where(and(eq(modulesTable.institutionId, context.institutionId), eq(modulesTable.moduleCode, input.moduleCode)))
      .limit(1);
    if (existing) {
      const [updated] = await db
        .update(modulesTable)
        .set({
          sourceModuleId: existing.sourceModuleId ?? sourceModuleId,
          moduleTitle: input.moduleTitle ?? existing.moduleTitle,
          defaultCredits: input.credits ?? existing.defaultCredits,
          school: input.school ?? existing.school,
          department: input.department ?? existing.department,
          campus: input.campus ?? existing.campus,
          status: input.moduleCode && (input.moduleTitle ?? existing.moduleTitle) ? "active" : existing.status,
          metadata: {
            ...(existing.metadata ?? {}),
            ingestion: true,
            stage: input.stage ?? existing.metadata?.["stage"],
            semester: input.semester ?? existing.metadata?.["semester"],
          },
        })
        .where(eq(modulesTable.id, existing.id))
        .returning();
      return updated;
    }
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
  runId: string,
  itemId: string,
  moduleId: string,
  moduleDescriptorId: string,
  input: NormalizedModuleInput,
  created: CreatedAccumulator,
) {
  if (input.learningOutcomes?.length) {
    for (const [index, outcome] of input.learningOutcomes.entries()) {
      const [createdOutcome] = await db
        .insert(learningOutcomesTable)
        .values({
          institutionId: context.institutionId,
          moduleDescriptorId,
          outcomeCode: outcome.code ?? `LO${index + 1}`,
          outcomeText: outcome.description,
          orderIndex: index,
          status: "draft",
          metadata: {
            pathway: "akari_multi_sheet",
            raw: outcome.raw ?? {},
          },
        })
        .returning();

      const [evidence] = await db
        .insert(evidenceItemsTable)
        .values({
          institutionId: context.institutionId,
          learningOutcomeId: createdOutcome.id,
          moduleId,
          sourceKind: "learning_outcome",
          evidenceText: outcome.description,
          confidence: 1,
          status: "extracted",
          sourceLocation: { ingestionRunId: runId, ingestionItemId: itemId, learningOutcomeId: createdOutcome.id },
          metadata: { pathway: "akari_multi_sheet", outcomeCode: outcome.code },
          createdByUserId: context.actor.userId,
        })
        .returning();
      created.evidenceItemIds.push(evidence.id);
      await linkRecord(runId, itemId, "created", { evidenceItemId: evidence.id });
    }
  }

  if (input.assessmentComponents?.length) {
    for (const [index, component] of input.assessmentComponents.entries()) {
      const [createdComponent] = await db
        .insert(assessmentComponentsTable)
        .values({
          institutionId: context.institutionId,
          moduleDescriptorId,
          componentName: component.type ?? component.category ?? `Assessment ${index + 1}`,
          componentType: component.category,
          assessmentMode: component.type,
          weighting: component.percentage,
          description: component.description,
          orderIndex: index,
          status: "draft",
          metadata: {
            pathway: "akari_multi_sheet",
            assessmentCategory: component.category,
            assessmentType: component.type,
            indicativeWeek: component.indicativeWeek,
            semester: component.semester,
            passFail: component.passFail,
            threshold: component.threshold,
            authenticity: component.authenticity,
            learningOutcomesAddressed: component.learningOutcomesAddressed,
            raw: component.raw ?? {},
          },
        })
        .returning();

      const assessmentEvidence = [
        component.description,
        component.learningOutcomesAddressed ? `Learning outcomes addressed: ${component.learningOutcomesAddressed}` : undefined,
        component.indicativeWeek ? `Indicative week: ${component.indicativeWeek}` : undefined,
        component.semester ? `Semester: ${component.semester}` : undefined,
        component.passFail ? `Pass/Fail: ${component.passFail}` : undefined,
        component.threshold ? `Assessment threshold: ${component.threshold}` : undefined,
        component.authenticity ? `Assessment authenticity: ${component.authenticity}` : undefined,
      ].filter(Boolean).join("\n");

      if (assessmentEvidence.trim()) {
        const [evidence] = await db
          .insert(evidenceItemsTable)
          .values({
            institutionId: context.institutionId,
            assessmentComponentId: createdComponent.id,
            moduleId,
            sourceKind: "assessment_component",
            evidenceText: assessmentEvidence,
            confidence: 1,
            status: "extracted",
            sourceLocation: { ingestionRunId: runId, ingestionItemId: itemId, assessmentComponentId: createdComponent.id },
            metadata: { pathway: "akari_multi_sheet", assessmentType: component.type, assessmentCategory: component.category },
            createdByUserId: context.actor.userId,
          })
          .returning();
        created.evidenceItemIds.push(evidence.id);
        await linkRecord(runId, itemId, "created", { evidenceItemId: evidence.id });
      }
    }
  }

  const sections = input.sections ?? [];
  const learningSection = !input.learningOutcomes?.length
    ? sections.find((section) => section.sectionType === "learning_outcomes" && section.content)
    : undefined;
  if (learningSection?.content) {
    const outcomes = learningSection.content
      .split(/\r?\n|(?:^|\s)(?:\d+\.|\-)\s+/)
      .map((outcome) => outcome.trim())
      .filter((outcome) => outcome.length > 10);
    for (const [index, outcome] of outcomes.entries()) {
      const [createdOutcome] = await db.insert(learningOutcomesTable).values({
        institutionId: context.institutionId,
        moduleDescriptorId,
        outcomeCode: `LO${index + 1}`,
        outcomeText: outcome,
        orderIndex: index,
        status: "draft",
      }).returning();

      const [evidence] = await db
        .insert(evidenceItemsTable)
        .values({
          institutionId: context.institutionId,
          learningOutcomeId: createdOutcome.id,
          moduleId,
          sourceKind: "learning_outcome",
          evidenceText: outcome,
          confidence: 1,
          status: "extracted",
          sourceLocation: { ingestionRunId: runId, ingestionItemId: itemId, learningOutcomeId: createdOutcome.id },
          metadata: { pathway: "phase4a_ingestion" },
          createdByUserId: context.actor.userId,
        })
        .returning();
      created.evidenceItemIds.push(evidence.id);
      await linkRecord(runId, itemId, "created", { evidenceItemId: evidence.id });
    }
  }

  const assessmentSection = !input.assessmentComponents?.length
    ? sections.find((section) => section.sectionType === "assessment" && section.content)
    : undefined;
  if (assessmentSection?.content) {
    const [component] = await db.insert(assessmentComponentsTable).values({
      institutionId: context.institutionId,
      moduleDescriptorId,
      componentName: "Assessment",
      description: assessmentSection.content,
      orderIndex: 0,
      status: "draft",
    }).returning();

    const [evidence] = await db
      .insert(evidenceItemsTable)
      .values({
        institutionId: context.institutionId,
        assessmentComponentId: component.id,
        moduleId,
        sourceKind: "assessment_component",
        evidenceText: assessmentSection.content,
        confidence: 1,
        status: "extracted",
        sourceLocation: { ingestionRunId: runId, ingestionItemId: itemId, assessmentComponentId: component.id },
        metadata: { pathway: "phase4a_ingestion" },
        createdByUserId: context.actor.userId,
      })
      .returning();
    created.evidenceItemIds.push(evidence.id);
    await linkRecord(runId, itemId, "created", { evidenceItemId: evidence.id });
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
  await createLearningAndAssessmentFromSections(context, runId, item.id, module.id, descriptor.id, input, created);

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
    const parsed = spreadsheetRows(input);
    validateAkariRows(parsed);
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
        summary: { fileName: input.fileName, ...parsed.summary },
      })
      .returning();
    created.importBatchIds.push(batch.id);
    await linkRecord(run.id, undefined, "created", { importBatchId: batch.id });

    const sourceProgrammeIdsForDrafts = new Set<string>();

    for (const [index, normalized] of parsed.modules.entries()) {
      const row = normalized.raw ?? {};
      const recordIdentifier = sourceRecordIdentifier(normalized, index);
      const moduleExternalId = sourceModuleExternalId(normalized, batch.id);
      const [sourceRecord] = await db
        .insert(sourceRecordsTable)
        .values({
          institutionId: context.institutionId,
          importBatchId: batch.id,
          sourceSystemId: sourceSystem.id,
          recordType: "module",
          status: "parsed",
          sourceIdentifier: recordIdentifier,
          sourceHash: checksum(JSON.stringify(row)),
          rowNumber: normalized.rowNumber != null ? Number(normalized.rowNumber) : index + 1,
          payload: row,
          rawText: normalized.descriptorText,
        })
        .returning();
      created.sourceRecordIds.push(sourceRecord.id);
      await linkRecord(run.id, undefined, "created", { sourceRecordId: sourceRecord.id });

      const { sourceModule, created: sourceModuleWasCreated } = await findOrCreateSourceModule(
        context,
        batch.id,
        sourceSystem.id,
        sourceRecord.id,
        moduleExternalId,
        normalized,
        row,
      );
      if (sourceModuleWasCreated) created.sourceModuleIds.push(sourceModule.id);
      await linkRecord(run.id, undefined, sourceModuleWasCreated ? "created" : "created_or_matched", { sourceModuleId: sourceModule.id });

      const programmeLinks = normalized.programmes?.length ? normalized.programmes : [{ programmeCode: normalized.programmeCode, programmeName: normalized.programmeName }];
      const sourceProgrammes = [];
      for (const programme of programmeLinks) {
        const sourceProgramme = await findOrCreateSourceProgramme(context, batch.id, sourceSystem.id, normalized, sourceRecord.id, programme);
        if (sourceProgramme) {
          sourceProgrammes.push(sourceProgramme);
          sourceProgrammeIdsForDrafts.add(sourceProgramme.id);
          created.sourceProgrammeIds.push(sourceProgramme.id);
          await linkRecord(run.id, undefined, "created_or_matched", { sourceProgrammeId: sourceProgramme.id });
        }
      }

      if (normalized.stage || normalized.semester || normalized.credits || sourceProgrammes.length > 0) {
        const programmeTargets = sourceProgrammes.length ? sourceProgrammes : [undefined];
        for (const sourceProgramme of programmeTargets) {
        const [sourceStructureItem] = await db
          .insert(sourceStructureItemsTable)
          .values({
            institutionId: context.institutionId,
            importBatchId: batch.id,
            sourceSystemId: sourceSystem.id,
            sourceRecordId: sourceRecord.id,
            sourceProgrammeId: sourceProgramme?.id,
            sourceModuleId: sourceModule.id,
            externalId: `${sourceRecord.id}:structure:${sourceProgramme?.id ?? "module"}`,
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
      }

      await materializeModule(context, run.id, index, normalized, created, {
        itemType: "akari_module",
        sourceRecordId: sourceRecord.id,
        sourceModuleId: sourceModule.id,
        importBatchId: batch.id,
      });
    }

    const draftProgrammeGeneration = created.sourceProgrammeIds.length > 0
      ? await generateDraftProgrammesFromSourceProgrammes({ institutionId: context.institutionId, userId: context.actor.userId }, {
          importBatchId: batch.id,
          sourceProgrammeIds: [...sourceProgrammeIdsForDrafts],
          versionLabel: "Draft",
        })
      : { programmeVersionsCreatedOrReused: 0, generated: [] };
    const provisionalAnalysis = await generateProvisionalProgrammeAnalysis(
      context,
      draftProgrammeGeneration.generated.map((item) => item.programmeVersionId),
    );

    await db
      .update(importBatchesTable)
      .set({
        status: created.dataQualityResultIds.length > 0 ? "completed_with_errors" : "completed",
        completedAt: new Date(),
        summary: {
          ...parsed.summary,
          moduleCount: created.moduleIds.length,
          descriptorCount: created.moduleDescriptorIds.length,
          evidenceCount: created.evidenceItemIds.length,
          qualityIssueCount: created.dataQualityResultIds.length,
          modulesWithOverview: parsed.modules.filter((module) => module.importStats?.hasOverview).length,
          modulesWithLearningOutcomes: parsed.modules.filter((module) => module.importStats?.hasLearningOutcomes).length,
          modulesWithAssessments: parsed.modules.filter((module) => module.importStats?.hasAssessments).length,
          modulesWithModalityEvidence: parsed.modules.filter((module) => module.importStats?.hasModalityEvidence).length,
          modulesWithProgrammeLinks: parsed.modules.filter((module) => module.importStats?.hasProgrammeLinks).length,
          draftProgrammes: draftProgrammeGeneration.programmeVersionsCreatedOrReused,
          draftProgrammeGeneration,
          provisionalAnalysis,
          provisionalNotice: "Provisional analysis. Review required before formal use.",
          rowsSkipped: parsed.skippedRows.length,
          skippedRows: parsed.skippedRows,
        },
      })
      .where(eq(importBatchesTable.id, batch.id));

    const status = created.dataQualityResultIds.length > 0 ? "completed_with_issues" : "completed";
    await updateRunComplete(run.id, status, {
      ...parsed.summary,
      created,
      modulesWithOverview: parsed.modules.filter((module) => module.importStats?.hasOverview).length,
      modulesWithLearningOutcomes: parsed.modules.filter((module) => module.importStats?.hasLearningOutcomes).length,
      modulesWithAssessments: parsed.modules.filter((module) => module.importStats?.hasAssessments).length,
      modulesWithModalityEvidence: parsed.modules.filter((module) => module.importStats?.hasModalityEvidence).length,
      modulesWithProgrammeLinks: parsed.modules.filter((module) => module.importStats?.hasProgrammeLinks).length,
      draftProgrammes: draftProgrammeGeneration.programmeVersionsCreatedOrReused,
      draftProgrammeGeneration,
      provisionalAnalysis,
      provisionalNotice: "Provisional analysis. Review required before formal use.",
      rowsSkipped: parsed.skippedRows.length,
      skippedRows: parsed.skippedRows,
    });
    return { runId: run.id, status, created, errors };
  } catch (error) {
    const validationError = isAkariValidationError(error);
    const message = validationError
      ? error.message
      : "Programme data upload failed while CAST was processing the spreadsheet. The issue has been logged.";
    const code = validationError ? error.code : "akari.processing_failed";

    logger.error(
      {
        err: error,
        runId: run.id,
        institutionId: context.institutionId,
        actorUserId: context.actor.userId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        validationError,
        created,
      },
      "Akari curriculum upload failed",
    );

    errors.push({ code, message, severity: "error" });
    await updateRunComplete(run.id, "failed", { created }, { code, message, validationError });
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
