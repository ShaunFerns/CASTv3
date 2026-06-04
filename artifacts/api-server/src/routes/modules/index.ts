import { Router, type IRouter } from "express";
import { requireAdmin } from "../../lib/auth.js";
import { logAudit, getClientIp } from "../../lib/auditLogger.js";
import { eq, and, inArray, SQL } from "drizzle-orm";
import { db, moduleReviewsTable, programmesTable, programmeModulesTable } from "@workspace/db";
import {
  ListModulesQueryParams,
  CreateModuleBody,
  GetModuleParams,
  UpdateModuleParams,
  UpdateModuleBody,
  DeleteModuleParams,
  ClassifyModuleParams,
  ScoreModuleParams,
  ScoreModuleBody,
  ParsePdfBody,
  ParseExcelBody,
} from "@workspace/api-zod";
import { classifyModule, scoreModule, extractFields, analyzeFreeElective } from "../../lib/aiService.js";
import { getSarByName, inferStage, calcScoreBand, buildModuleText } from "../../lib/sarFramework.js";
import * as XLSX from "xlsx";

// Use pdfjs-dist legacy build which works in Node.js without browser globals
const pdfParse = async (buf: Buffer): Promise<{ text: string }> => {
  const { createRequire } = await import("node:module");
  const { pathToFileURL } = await import("node:url");
  const req = createRequire(import.meta.url);
  const workerPath = req.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buf) });
  const doc = await loadingTask.promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ");
    text += pageText + "\n";
  }
  return { text };
};

const router: IRouter = Router();

router.get("/modules", async (req, res): Promise<void> => {
  const query = ListModulesQueryParams.parse(req.query);
  const conditions: SQL[] = [];

  if (query.sar) conditions.push(eq(moduleReviewsTable.selectedSarFinal, query.sar));
  if (query.stage) conditions.push(eq(moduleReviewsTable.stageInferred, query.stage));
  if (query.campus) conditions.push(eq(moduleReviewsTable.campus, query.campus));
  if (query.scoreBand) conditions.push(eq(moduleReviewsTable.scoreBand, query.scoreBand));
  if (query.confidence) conditions.push(eq(moduleReviewsTable.sarConfidence, query.confidence));
  if (query.status) conditions.push(eq(moduleReviewsTable.reviewStatus, query.status));

  const modules = await db
    .select({
      id: moduleReviewsTable.id,
      moduleCode: moduleReviewsTable.moduleCode,
      moduleTitle: moduleReviewsTable.moduleTitle,
      sourceType: moduleReviewsTable.sourceType,
      sourceFileName: moduleReviewsTable.sourceFileName,
      sarConfidence: moduleReviewsTable.sarConfidence,
      selectedSarFinal: moduleReviewsTable.selectedSarFinal,
      averageScoreAi: moduleReviewsTable.averageScoreAi,
      averageScoreFinal: moduleReviewsTable.averageScoreFinal,
      stageInferred: moduleReviewsTable.stageInferred,
      campus: moduleReviewsTable.campus,
      school: moduleReviewsTable.school,
      scoreBand: moduleReviewsTable.scoreBand,
      reviewStatus: moduleReviewsTable.reviewStatus,
      disciplineFamily: moduleReviewsTable.disciplineFamily,
      accessibilityScoreAi: moduleReviewsTable.accessibilityScoreAi,
      stageAppropriatenessScoreAi: moduleReviewsTable.stageAppropriatenessScoreAi,
      breadthTransferabilityScoreAi: moduleReviewsTable.breadthTransferabilityScoreAi,
      freeElectiveAverageAi: moduleReviewsTable.freeElectiveAverageAi,
      freeElectiveBandAi: moduleReviewsTable.freeElectiveBandAi,
      tagExplore: moduleReviewsTable.tagExplore,
      tagUsefulSkills: moduleReviewsTable.tagUsefulSkills,
      tagPathwaySupport: moduleReviewsTable.tagPathwaySupport,
      freeElectiveRationaleAi: moduleReviewsTable.freeElectiveRationaleAi,
      freeElectiveProcessedAt: moduleReviewsTable.freeElectiveProcessedAt,
      requisitesStatus: moduleReviewsTable.requisitesStatus,
      createdAt: moduleReviewsTable.createdAt,
      updatedAt: moduleReviewsTable.updatedAt,
    })
    .from(moduleReviewsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(moduleReviewsTable.createdAt);

  res.json(modules);
});

router.post("/modules", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateModuleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const stageInferred = inferStage(parsed.data.moduleCode);

  const [mod] = await db
    .insert(moduleReviewsTable)
    .values({ ...parsed.data, stageInferred })
    .returning();

  res.status(201).json(mod);
});

router.post("/modules/batch", requireAdmin, async (req, res): Promise<void> => {
  const { modules } = req.body;
  if (!Array.isArray(modules) || modules.length === 0) {
    res.status(400).json({ error: "modules must be a non-empty array" });
    return;
  }

  // Capture affiliated programmes from raw rows before schema validation strips extra fields
  const rawProgrammesByCode = new Map<string, string[]>();
  for (const row of modules) {
    if (row.moduleCode && Array.isArray(row.affiliatedProgrammes) && row.affiliatedProgrammes.length > 0) {
      rawProgrammesByCode.set(row.moduleCode, row.affiliatedProgrammes as string[]);
    }
  }

  const valid: typeof modules = [];
  const skipped: string[] = [];

  for (const row of modules) {
    const parsed = CreateModuleBody.safeParse(row);
    if (parsed.success) {
      valid.push(parsed.data);
    } else {
      skipped.push(row.moduleCode ?? "(unknown)");
    }
  }

  if (valid.length === 0) {
    res.status(400).json({ error: "No valid module rows found", skipped });
    return;
  }

  try {
    const rows = valid.map((m) => ({ ...m, stageInferred: inferStage(m.moduleCode) }));

    // Find which module codes already exist so we can update rather than duplicate
    const allCodes = rows.map((r) => r.moduleCode);
    const CHUNK = 500;
    const existingRows: { id: number; moduleCode: string }[] = [];
    for (let i = 0; i < allCodes.length; i += CHUNK) {
      const chunk = allCodes.slice(i, i + CHUNK);
      const found = await db
        .select({ id: moduleReviewsTable.id, moduleCode: moduleReviewsTable.moduleCode })
        .from(moduleReviewsTable)
        .where(inArray(moduleReviewsTable.moduleCode, chunk));
      existingRows.push(...found);
    }
    // Use the first match per code (in case of legacy duplicates)
    const existingByCode = new Map<string, number>();
    for (const r of existingRows) {
      if (!existingByCode.has(r.moduleCode)) existingByCode.set(r.moduleCode, r.id);
    }

    const toInsert = rows.filter((r) => !existingByCode.has(r.moduleCode));
    const toUpdate = rows.filter((r) => existingByCode.has(r.moduleCode));

    // Insert new modules
    let imported = 0;
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const chunk = toInsert.slice(i, i + CHUNK);
      await db.insert(moduleReviewsTable).values(chunk);
      imported += chunk.length;
    }

    // Update structural metadata only for existing modules — scores/classifications untouched
    let updated = 0;
    for (const row of toUpdate) {
      const id = existingByCode.get(row.moduleCode)!;
      await db
        .update(moduleReviewsTable)
        .set({
          moduleTitle: row.moduleTitle,
          school: row.school ?? undefined,
          campus: row.campus ?? undefined,
          overview: row.overview ?? undefined,
          learningOutcomes: row.learningOutcomes ?? undefined,
          indicativeSyllabus: row.indicativeSyllabus ?? undefined,
          teachingMethods: row.teachingMethods ?? undefined,
          assessmentText: row.assessmentText ?? undefined,
          requisitesStatus: row.requisitesStatus ?? undefined,
          requisitesRaw: row.requisitesRaw ?? undefined,
          stageInferred: row.stageInferred ?? undefined,
        })
        .where(eq(moduleReviewsTable.id, id));
      updated++;
    }

    // ── Wire affiliated programmes ────────────────────────────────────────
    // After modules are upserted, fetch their IDs (includes newly inserted ones)
    const processedCodes = allCodes;
    if (rawProgrammesByCode.size > 0 && processedCodes.length > 0) {
      const allModuleRows: { id: number; moduleCode: string }[] = [];
      for (let i = 0; i < processedCodes.length; i += CHUNK) {
        const chunk = processedCodes.slice(i, i + CHUNK);
        const found = await db
          .select({ id: moduleReviewsTable.id, moduleCode: moduleReviewsTable.moduleCode })
          .from(moduleReviewsTable)
          .where(inArray(moduleReviewsTable.moduleCode, chunk));
        allModuleRows.push(...found);
      }
      const idByCode = new Map<string, number>();
      for (const r of allModuleRows) {
        if (!idByCode.has(r.moduleCode)) idByCode.set(r.moduleCode, r.id);
      }

      // Collect all unique programme names, find or create them
      const allProgNames = [...new Set([...rawProgrammesByCode.values()].flat())];
      const progIdByName = new Map<string, number>();
      for (const name of allProgNames) {
        const existing = await db
          .select({ id: programmesTable.id })
          .from(programmesTable)
          .where(eq(programmesTable.name, name))
          .limit(1);
        if (existing.length > 0) {
          progIdByName.set(name, existing[0].id);
        } else {
          const [created] = await db
            .insert(programmesTable)
            .values({ name })
            .returning({ id: programmesTable.id });
          progIdByName.set(name, created.id);
        }
      }

      // Upsert programme_modules links (skip if the exact pair already exists)
      for (const [moduleCode, progNames] of rawProgrammesByCode) {
        const moduleId = idByCode.get(moduleCode);
        if (!moduleId) continue;
        for (const progName of progNames) {
          const programmeId = progIdByName.get(progName);
          if (!programmeId) continue;
          const existing = await db
            .select({ id: programmeModulesTable.id })
            .from(programmeModulesTable)
            .where(
              and(
                eq(programmeModulesTable.moduleId, moduleId),
                eq(programmeModulesTable.programmeId, programmeId),
              )
            )
            .limit(1);
          if (existing.length === 0) {
            await db.insert(programmeModulesTable).values({ moduleId, programmeId, orderIndex: 0 });
          }
        }
      }
    }

    res.status(201).json({ imported, updated, skipped: skipped.length, skippedCodes: skipped });
  } catch (err) {
    console.error("Batch insert error:", err);
    res.status(500).json({ error: "Batch insert failed" });
  }
});

router.get("/modules/check-code", async (req, res): Promise<void> => {
  const code = String(req.query.code ?? "").trim();
  const excludeId = req.query.excludeId ? Number(req.query.excludeId) : null;

  if (!code || code === "TBD") {
    res.json({ exists: false });
    return;
  }

  const rows = await db
    .select({ id: moduleReviewsTable.id })
    .from(moduleReviewsTable)
    .where(eq(moduleReviewsTable.moduleCode, code));

  const matches = excludeId ? rows.filter((r) => r.id !== excludeId) : rows;

  if (matches.length > 0) {
    console.warn(`[duplicate] Module code "${code}" already exists (ids: ${matches.map((r) => r.id).join(", ")})`);
  }

  res.json({ exists: matches.length > 0 });
});

router.get("/modules/:id", async (req, res): Promise<void> => {
  const params = GetModuleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [mod] = await db
    .select()
    .from(moduleReviewsTable)
    .where(eq(moduleReviewsTable.id, params.data.id));

  if (!mod) {
    res.status(404).json({ error: "Module not found" });
    return;
  }

  res.json(mod);
});

router.patch("/modules/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateModuleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateModuleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData = { ...parsed.data } as Record<string, unknown>;

  if (parsed.data.moduleCode) {
    updateData.stageInferred = inferStage(parsed.data.moduleCode);
  }

  const finalScores = [
    parsed.data.criterion1ScoreFinal,
    parsed.data.criterion2ScoreFinal,
    parsed.data.criterion3ScoreFinal,
    parsed.data.criterion4ScoreFinal,
    parsed.data.criterion5ScoreFinal,
  ].filter((s): s is number => s != null);

  if (finalScores.length === 5) {
    const avg = finalScores.reduce((a, b) => a + b, 0) / finalScores.length;
    updateData.averageScoreFinal = Math.round(avg * 100) / 100;
    updateData.scoreBand = calcScoreBand(avg);
  }

  const [mod] = await db
    .update(moduleReviewsTable)
    .set(updateData)
    .where(eq(moduleReviewsTable.id, params.data.id))
    .returning();

  if (!mod) {
    res.status(404).json({ error: "Module not found" });
    return;
  }

  res.json(mod);
});

router.delete("/modules/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteModuleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [mod] = await db
    .delete(moduleReviewsTable)
    .where(eq(moduleReviewsTable.id, params.data.id))
    .returning();

  if (!mod) {
    res.status(404).json({ error: "Module not found" });
    return;
  }

  res.sendStatus(204);
});

router.post("/modules/:id/extract-fields", requireAdmin, async (req, res): Promise<void> => {
  const params = GetModuleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [mod] = await db
    .select()
    .from(moduleReviewsTable)
    .where(eq(moduleReviewsTable.id, params.data.id));

  if (!mod) {
    res.status(404).json({ error: "Module not found" });
    return;
  }

  const rawText = mod.rawText || "";
  if (!rawText.trim()) {
    res.status(400).json({ error: "Module has no raw text to extract from" });
    return;
  }

  const result = await extractFields(rawText);

  // Save the new structured fields directly — no user interaction needed for these
  await db
    .update(moduleReviewsTable)
    .set({
      assessmentText: result.assessmentText,
      requisitesStatus: result.requisitesStatus,
      requisitesRaw: result.requisitesRaw,
    })
    .where(eq(moduleReviewsTable.id, params.data.id));

  res.json(result);
});

router.post("/modules/:id/classify", requireAdmin, async (req, res): Promise<void> => {
  const params = ClassifyModuleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [mod] = await db
    .select()
    .from(moduleReviewsTable)
    .where(eq(moduleReviewsTable.id, params.data.id));

  if (!mod) {
    res.status(404).json({ error: "Module not found" });
    return;
  }

  const text = buildModuleText(mod);
  if (!text.trim()) {
    res.status(400).json({ error: "Module has no text content to classify" });
    return;
  }

  const result = await classifyModule(text);

  await db
    .update(moduleReviewsTable)
    .set({
      primarySarAi: result.primarySar,
      secondarySarAi: result.secondarySar,
      sarConfidence: result.confidence,
      sarRationale: result.rationale,
      selectedSarFinal: result.primarySar,
      reviewStatus: "classified",
    })
    .where(eq(moduleReviewsTable.id, params.data.id));

  res.json({
    primarySar: result.primarySar,
    secondarySar: result.secondarySar,
    confidence: result.confidence,
    rationale: result.rationale,
  });
});

router.post("/modules/:id/score", requireAdmin, async (req, res): Promise<void> => {
  const params = ScoreModuleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = ScoreModuleBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [mod] = await db
    .select()
    .from(moduleReviewsTable)
    .where(eq(moduleReviewsTable.id, params.data.id));

  if (!mod) {
    res.status(404).json({ error: "Module not found" });
    return;
  }

  const sarDef = getSarByName(body.data.sarName);
  if (!sarDef) {
    res.status(400).json({ error: `Unknown SAR: ${body.data.sarName}` });
    return;
  }

  const text = buildModuleText(mod);
  if (!text.trim()) {
    res.status(400).json({ error: "Module has no text content to score" });
    return;
  }

  const result = await scoreModule(text, sarDef);

  const scoreBand = calcScoreBand(result.averageScore);

  await db
    .update(moduleReviewsTable)
    .set({
      criterion1Name: result.criteria[0]?.name,
      criterion1ScoreAi: result.criteria[0]?.score,
      criterion1RationaleAi: result.criteria[0]?.rationale,
      criterion1ScoreFinal: result.criteria[0]?.score,
      criterion2Name: result.criteria[1]?.name,
      criterion2ScoreAi: result.criteria[1]?.score,
      criterion2RationaleAi: result.criteria[1]?.rationale,
      criterion2ScoreFinal: result.criteria[1]?.score,
      criterion3Name: result.criteria[2]?.name,
      criterion3ScoreAi: result.criteria[2]?.score,
      criterion3RationaleAi: result.criteria[2]?.rationale,
      criterion3ScoreFinal: result.criteria[2]?.score,
      criterion4Name: result.criteria[3]?.name,
      criterion4ScoreAi: result.criteria[3]?.score,
      criterion4RationaleAi: result.criteria[3]?.rationale,
      criterion4ScoreFinal: result.criteria[3]?.score,
      criterion5Name: result.criteria[4]?.name,
      criterion5ScoreAi: result.criteria[4]?.score,
      criterion5RationaleAi: result.criteria[4]?.rationale,
      criterion5ScoreFinal: result.criteria[4]?.score,
      averageScoreAi: result.averageScore,
      averageScoreFinal: result.averageScore,
      overallCommentAi: result.overallComment,
      overallCommentFinal: result.overallComment,
      suitabilityNoteAi: result.suitabilityNote,
      suitabilityNoteFinal: result.suitabilityNote,
      scoreBand,
      reviewStatus: "scored",
    })
    .where(eq(moduleReviewsTable.id, params.data.id));

  res.json({
    criterion1Score: result.criteria[0]?.score ?? 0,
    criterion1Rationale: result.criteria[0]?.rationale ?? "",
    criterion2Score: result.criteria[1]?.score ?? 0,
    criterion2Rationale: result.criteria[1]?.rationale ?? "",
    criterion3Score: result.criteria[2]?.score ?? 0,
    criterion3Rationale: result.criteria[2]?.rationale ?? "",
    criterion4Score: result.criteria[3]?.score ?? 0,
    criterion4Rationale: result.criteria[3]?.rationale ?? "",
    criterion5Score: result.criteria[4]?.score ?? 0,
    criterion5Rationale: result.criteria[4]?.rationale ?? "",
    averageScore: result.averageScore,
    overallComment: result.overallComment,
    suitabilityNote: result.suitabilityNote,
  });
});

router.post("/modules/:id/analyze-free-elective", requireAdmin, async (req, res): Promise<void> => {
  const params = GetModuleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [mod] = await db
    .select()
    .from(moduleReviewsTable)
    .where(eq(moduleReviewsTable.id, params.data.id));

  if (!mod) {
    res.status(404).json({ error: "Module not found" });
    return;
  }

  const text = buildModuleText(mod);
  if (!text.trim()) {
    res.status(400).json({ error: "Module has no text content to analyze" });
    return;
  }

  const result = await analyzeFreeElective(text, mod.moduleCode, mod.moduleTitle);

  await db
    .update(moduleReviewsTable)
    .set({
      disciplineFamily: result.discipline_family,
      accessibilityScoreAi: result.accessibility_score,
      stageAppropriatenessScoreAi: result.stage_appropriateness_score,
      breadthTransferabilityScoreAi: result.breadth_transferability_score,
      freeElectiveAverageAi: result.free_elective_average,
      freeElectiveBandAi: result.free_elective_band,
      tagExplore: result.tag_explore,
      tagUsefulSkills: result.tag_useful_skills,
      tagPathwaySupport: result.tag_pathway_support,
      freeElectiveRationaleAi: result.free_elective_rationale,
      freeElectiveProcessedAt: new Date(),
    })
    .where(eq(moduleReviewsTable.id, params.data.id));

  res.json({
    disciplineFamily: result.discipline_family,
    accessibilityScore: result.accessibility_score,
    stageAppropriatenessScore: result.stage_appropriateness_score,
    breadthTransferabilityScore: result.breadth_transferability_score,
    freeElectiveAverage: result.free_elective_average,
    freeElectiveBand: result.free_elective_band,
    tagExplore: result.tag_explore,
    tagUsefulSkills: result.tag_useful_skills,
    tagPathwaySupport: result.tag_pathway_support,
    freeElectiveRationale: result.free_elective_rationale,
  });
});

router.post("/modules/parse-pdf", requireAdmin, async (req, res): Promise<void> => {
  const parsed = ParsePdfBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let text = "";
  try {
    const buffer = Buffer.from(parsed.data.base64Data, "base64");
    const result = await pdfParse(buffer);
    text = result.text;
  } catch (err) {
    res.status(400).json({ error: "Failed to parse PDF. Please check the file and try again." });
    return;
  }

  res.json({ text, fileName: parsed.data.fileName });
});

// ─── Akari multi-sheet workbook detection ────────────────────────────────────
const AKARI_ANCHOR_SHEET = "Module Overview";
const AKARI_SHEETS = {
  overview: "Module Overview",
  learningOutcomes: "Learning Outcomes",
  syllabus: "Indicative Syllabus",
  teachingMethods: "Learning Teaching Methods",
  assessments: "Module Assessments",
  requisites: "Requisites",
  modalities: "Module Modalities",
  programmes: "Affiliated Programmes",
} as const;

function deriveRequisitesStatus(rows: Record<string, string>[]): { status: string; raw: string } {
  if (!rows.length) return { status: "Unknown", raw: "" };

  const notes = rows.map((r) => String(r["Requisites Note"] || "").trim()).filter(Boolean);
  const types = rows.map((r) => String(r["Requisite Type"] || "").trim()).filter(Boolean);

  if (notes.some((n) => n.toLowerCase().includes("no requisites"))) {
    return { status: "None", raw: notes[0] || "" };
  }

  const hasPre = types.some((t) => t.toLowerCase().includes("pre-requisite") || t.toLowerCase().includes("prerequisite"));
  const hasCo = types.some((t) => t.toLowerCase().includes("co-requisite") || t.toLowerCase().includes("corequisite"));

  let status = "Unknown";
  if (hasPre && hasCo) status = "Pre- and Co-requisite";
  else if (hasPre) status = "Pre-requisite";
  else if (hasCo) status = "Co-requisite";
  else if (types.length > 0) status = "Unknown";
  else if (notes.length > 0) status = "Unknown";

  const rawParts: string[] = [];
  rows.forEach((r) => {
    const type = String(r["Requisite Type"] || "").trim();
    const moduleTitle = String(r["Module Title"] || "").trim();
    const note = String(r["Requisites Note"] || "").trim();
    if (type || moduleTitle) rawParts.push([type, moduleTitle].filter(Boolean).join(": "));
    else if (note) rawParts.push(note);
  });

  return { status, raw: rawParts.filter(Boolean).join("; ") };
}

function parseAkariWorkbook(workbook: ReturnType<typeof XLSX.read>): Array<{
  moduleCode: string | null;
  moduleTitle: string | null;
  school: string | null;
  overview: string | null;
  learningOutcomes: string | null;
  indicativeSyllabus: string | null;
  teachingMethods: string | null;
  assessmentText: string | null;
  requisitesStatus: string | null;
  requisitesRaw: string | null;
  affiliatedProgrammes: string[];
  warnings: string[];
}> {
  const getSheetRows = (name: string): Record<string, string>[] => {
    const sheet = workbook.Sheets[name];
    if (!sheet) return [];
    try {
      return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
    } catch {
      return [];
    }
  };

  // Build base module map from Module Overview sheet (one row per module)
  const overviewRows = getSheetRows(AKARI_SHEETS.overview);
  if (!overviewRows.length) return [];

  // Collect unique modules by Module Id
  const moduleIds: string[] = [];
  const moduleMap: Map<string, {
    moduleCode: string;
    moduleTitle: string;
    school: string;
    overview: string;
  }> = new Map();

  for (const row of overviewRows) {
    const id = String(row["Module Id"] || "").trim();
    if (!id || moduleMap.has(id)) continue;
    moduleIds.push(id);
    moduleMap.set(id, {
      moduleCode: String(row["Module Code"] || "").trim(),
      moduleTitle: String(row["Module Long Title"] || row["Module Short Title"] || "").trim(),
      school: String(row["School"] || "").trim(),
      overview: String(row["Module Overview"] || "").trim(),
    });
  }

  // Index multi-row sheets by Module Id
  const indexByModuleId = (sheetName: string): Map<string, Record<string, string>[]> => {
    const result = new Map<string, Record<string, string>[]>();
    for (const row of getSheetRows(sheetName)) {
      const id = String(row["Module Id"] || "").trim();
      if (!id) continue;
      if (!result.has(id)) result.set(id, []);
      result.get(id)!.push(row);
    }
    return result;
  };

  const loIndex = indexByModuleId(AKARI_SHEETS.learningOutcomes);
  const syllabusIndex = indexByModuleId(AKARI_SHEETS.syllabus);
  const tmIndex = indexByModuleId(AKARI_SHEETS.teachingMethods);
  const assessIndex = indexByModuleId(AKARI_SHEETS.assessments);
  const reqIndex = indexByModuleId(AKARI_SHEETS.requisites);
  const progIndex = indexByModuleId(AKARI_SHEETS.programmes);

  return moduleIds.map((id) => {
    const base = moduleMap.get(id)!;
    const warnings: string[] = [];

    if (!base.moduleCode) warnings.push("Missing module code");
    if (!base.moduleTitle) warnings.push("Missing module title");

    // Learning Outcomes: concatenate numbered descriptions
    let learningOutcomes: string | null = null;
    const loRows = loIndex.get(id) || [];
    if (loRows.length) {
      const parts = loRows
        .map((r) => {
          const code = String(r["Learning Outcome Code"] || "").trim();
          const desc = String(r["Learning Outcome Description"] || "").trim();
          return code && desc ? `${code}: ${desc}` : desc || code;
        })
        .filter(Boolean);
      if (parts.length) learningOutcomes = parts.join("\n");
    }

    // Indicative Syllabus
    let indicativeSyllabus: string | null = null;
    const syllRows = syllabusIndex.get(id) || [];
    if (syllRows.length) {
      const text = String(syllRows[0]["Indicative Syllabus"] || "").trim();
      if (text) indicativeSyllabus = text;
    }

    // Teaching Methods
    let teachingMethods: string | null = null;
    const tmRows = tmIndex.get(id) || [];
    if (tmRows.length) {
      const text = String(tmRows[0]["Learning and Teaching Methods"] || "").trim();
      if (text) teachingMethods = text;
    }

    // Assessments: format each row
    let assessmentText: string | null = null;
    const assessRows = assessIndex.get(id) || [];
    if (assessRows.length) {
      const parts = assessRows
        .map((r) => {
          const type = String(r["Assessment Type"] || "").trim();
          const pct = String(r["Percentage of Total"] || "").trim();
          const desc = String(r["Assessment Description"] || "").trim();
          const category = String(r["Assessment Category"] || "").trim();
          let line = type || category;
          if (pct) line += ` (${pct}%)`;
          if (desc) line += `\n${desc}`;
          return line.trim();
        })
        .filter(Boolean);
      if (parts.length) assessmentText = parts.join("\n\n");
    }

    // Requisites
    let requisitesStatus: string | null = null;
    let requisitesRaw: string | null = null;
    const reqRows = reqIndex.get(id) || [];
    if (reqRows.length) {
      const derived = deriveRequisitesStatus(reqRows);
      requisitesStatus = derived.status;
      requisitesRaw = derived.raw || null;
    }

    // Affiliated Programmes — try common Akari column name variants
    const progRows = progIndex.get(id) || [];
    const affiliatedProgrammes = [
      ...new Set(
        progRows
          .map((r) =>
            String(
              r["Programme Title"] ||
              r["Programme Name"] ||
              r["Affiliated Programme"] ||
              r["Affiliated Programme Title"] ||
              r["Programme Code"] ||
              ""
            ).trim()
          )
          .filter(Boolean)
      ),
    ];

    return {
      moduleCode: base.moduleCode || null,
      moduleTitle: base.moduleTitle || null,
      school: base.school || null,
      overview: base.overview || null,
      learningOutcomes,
      indicativeSyllabus,
      teachingMethods,
      assessmentText,
      requisitesStatus,
      requisitesRaw,
      affiliatedProgrammes,
      warnings,
    };
  });
}
// ─────────────────────────────────────────────────────────────────────────────

router.post("/modules/parse-excel", requireAdmin, async (req, res): Promise<void> => {
  const parsed = ParseExcelBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let workbook: ReturnType<typeof XLSX.read>;
  try {
    const buffer = Buffer.from(parsed.data.base64Data, "base64");
    workbook = XLSX.read(buffer, { type: "buffer" });
    if (!workbook.SheetNames.length) throw new Error("No sheets found");
  } catch (err) {
    res.status(400).json({ error: "Failed to parse Excel file. Please check the file and try again." });
    return;
  }

  // Detect Akari multi-sheet format
  if (workbook.SheetNames.includes(AKARI_ANCHOR_SHEET)) {
    try {
      const result = parseAkariWorkbook(workbook);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: "Failed to parse Akari workbook. Please check the file format." });
    }
    return;
  }

  // ── Fallback: original single-sheet logic (backward compatible) ─────────────
  let rows: Record<string, string>[] = [];
  try {
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
  } catch (err) {
    res.status(400).json({ error: "Failed to parse Excel file. Please check the file and try again." });
    return;
  }

  const COLUMN_MAP: Record<string, string> = {
    module_code: "moduleCode",
    "module code": "moduleCode",
    modulecode: "moduleCode",
    code: "moduleCode",
    module_title: "moduleTitle",
    "module title": "moduleTitle",
    moduletitle: "moduleTitle",
    title: "moduleTitle",
    overview: "overview",
    learning_outcomes: "learningOutcomes",
    "learning outcomes": "learningOutcomes",
    learningoutcomes: "learningOutcomes",
    outcomes: "learningOutcomes",
    syllabus: "indicativeSyllabus",
    indicative_syllabus: "indicativeSyllabus",
    "indicative syllabus": "indicativeSyllabus",
    indicativesyllabus: "indicativeSyllabus",
    teaching_methods: "teachingMethods",
    "teaching methods": "teachingMethods",
    teachingmethods: "teachingMethods",
    campus: "campus",
    location: "campus",
    site: "campus",
    "campus location": "campus",
    "delivery location": "campus",
    "delivery site": "campus",
    school: "school",
    "school name": "school",
    schoolname: "school",
  };

  const result = rows.map((row) => {
    const mapped: Record<string, string | null> = {
      moduleCode: null,
      moduleTitle: null,
      school: null,
      overview: null,
      learningOutcomes: null,
      indicativeSyllabus: null,
      teachingMethods: null,
      assessmentText: null,
      requisitesStatus: null,
      requisitesRaw: null,
      campus: null,
    };
    const warnings: string[] = [];

    for (const [key, value] of Object.entries(row)) {
      const normalizedKey = key.toLowerCase().trim();
      const field = COLUMN_MAP[normalizedKey];
      if (field) {
        mapped[field] = String(value).trim() || null;
      }
    }

    if (!mapped.moduleCode) warnings.push("Missing module code");
    if (!mapped.moduleTitle) warnings.push("Missing module title");

    return { ...mapped, warnings };
  });

  res.json(result);
});

export default router;
