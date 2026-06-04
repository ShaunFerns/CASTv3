import { Router, type IRouter } from "express";
import { requireAdmin } from "../../lib/auth.js";
import { logAudit, getClientIp } from "../../lib/auditLogger.js";
import { db, moduleReviewsTable, programmeModulesTable, programmesTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { inferStage } from "../../lib/sarFramework.js";
import * as XLSX from "xlsx";

const router: IRouter = Router();

function escapeCsv(value: string | number | null | undefined, replaceNewlines = false): string {
  if (value == null) return "";
  let str = String(value);
  if (replaceNewlines) {
    str = str.replace(/\r\n/g, " | ").replace(/[\r\n]+/g, " | ");
  }
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function parseCsv(content: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const text = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n") {
        row.push(field);
        field = "";
        if (row.length > 1 || row[0] !== "") records.push(row);
        row = [];
      } else {
        field += ch;
      }
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") records.push(row);
  }
  return records;
}

router.get("/export/csv", async (_req, res): Promise<void> => {
  const modules = await db.select().from(moduleReviewsTable).orderBy(moduleReviewsTable.createdAt);

  // Build a map of moduleId → programme names (a module can belong to many programmes)
  const moduleIds = modules.map((m) => m.id);
  const programmesByModule = new Map<number, string[]>();
  if (moduleIds.length > 0) {
    const links = await db
      .select({ moduleId: programmeModulesTable.moduleId, name: programmesTable.name })
      .from(programmeModulesTable)
      .innerJoin(programmesTable, eq(programmeModulesTable.programmeId, programmesTable.id))
      .where(inArray(programmeModulesTable.moduleId, moduleIds));
    for (const { moduleId, name } of links) {
      if (!programmesByModule.has(moduleId)) programmesByModule.set(moduleId, []);
      programmesByModule.get(moduleId)!.push(name);
    }
  }

  const headers = [
    "module_code",
    "module_title",
    "school",
    "programme",
    "overview",
    "learning_outcomes",
    "indicative_syllabus",
    "teaching_methods",
    "raw_text",
    "stage_inferred",
    "source_type",
    "primary_sar_ai",
    "secondary_sar_ai",
    "sar_confidence",
    "selected_sar_final",
    "criterion_1_score_final",
    "criterion_2_score_final",
    "criterion_3_score_final",
    "criterion_4_score_final",
    "criterion_5_score_final",
    "average_score_final",
    "score_band",
    "overall_comment_final",
    "suitability_note_final",
    "reviewer_note",
    "review_status",
    "discipline_family",
    "accessibility_score_ai",
    "stage_appropriateness_score_ai",
    "breadth_transferability_score_ai",
    "free_elective_average_ai",
    "free_elective_band_ai",
    "tag_explore",
    "tag_useful_skills",
    "tag_pathway_support",
    "free_elective_rationale_ai",
    "created_at",
    "updated_at",
  ];

  const rows = modules.map((m) => [
    escapeCsv(m.moduleCode),
    escapeCsv(m.moduleTitle),
    escapeCsv(m.school),
    escapeCsv((programmesByModule.get(m.id) ?? []).join(" | ")),
    escapeCsv(m.overview, true),
    escapeCsv(m.learningOutcomes, true),
    escapeCsv(m.indicativeSyllabus, true),
    escapeCsv(m.teachingMethods, true),
    escapeCsv(m.rawText, true),
    escapeCsv(m.stageInferred),
    escapeCsv(m.sourceType),
    escapeCsv(m.primarySarAi),
    escapeCsv(m.secondarySarAi),
    escapeCsv(m.sarConfidence),
    escapeCsv(m.selectedSarFinal),
    escapeCsv(m.criterion1ScoreFinal),
    escapeCsv(m.criterion2ScoreFinal),
    escapeCsv(m.criterion3ScoreFinal),
    escapeCsv(m.criterion4ScoreFinal),
    escapeCsv(m.criterion5ScoreFinal),
    escapeCsv(m.averageScoreFinal),
    escapeCsv(m.scoreBand),
    escapeCsv(m.overallCommentFinal, true),
    escapeCsv(m.suitabilityNoteFinal, true),
    escapeCsv(m.reviewerNote, true),
    escapeCsv(m.reviewStatus),
    escapeCsv(m.disciplineFamily),
    escapeCsv(m.accessibilityScoreAi),
    escapeCsv(m.stageAppropriatenessScoreAi),
    escapeCsv(m.breadthTransferabilityScoreAi),
    escapeCsv(m.freeElectiveAverageAi),
    escapeCsv(m.freeElectiveBandAi),
    escapeCsv(m.tagExplore),
    escapeCsv(m.tagUsefulSkills),
    escapeCsv(m.tagPathwaySupport),
    escapeCsv(m.freeElectiveRationaleAi),
    escapeCsv(m.createdAt?.toISOString()),
    escapeCsv(m.updatedAt?.toISOString()),
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=sar-module-reviews.csv");
  res.send(csv);
});

router.post("/import/csv", requireAdmin, async (req, res): Promise<void> => {
  const { csvContent } = req.body;
  if (!csvContent || typeof csvContent !== "string") {
    res.status(400).json({ error: "csvContent is required" });
    return;
  }

  const records = parseCsv(csvContent);
  if (records.length < 2) {
    res.status(400).json({ error: "CSV has no data rows" });
    return;
  }

  const headers = records[0].map((h) => h.trim().toLowerCase());
  const dataRows = records.slice(1);

  const col = (row: string[], name: string): string | null => {
    const idx = headers.indexOf(name);
    const val = idx !== -1 ? row[idx] ?? "" : "";
    return val.trim() !== "" ? val.trim() : null;
  };

  const colNum = (row: string[], name: string): number | null => {
    const val = col(row, name);
    if (val === null) return null;
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
  };

  const colBool = (row: string[], name: string): boolean | null => {
    const val = col(row, name);
    if (val === null) return null;
    if (val.toLowerCase() === "true") return true;
    if (val.toLowerCase() === "false") return false;
    return null;
  };

  let imported = 0;
  const warnings: string[] = [];

  for (const row of dataRows) {
    const moduleCode = col(row, "module_code") ?? "TBD";
    const moduleTitle = col(row, "module_title") ?? "Untitled";

    const existing = await db
      .select({ id: moduleReviewsTable.id })
      .from(moduleReviewsTable)
      .where(eq(moduleReviewsTable.moduleCode, moduleCode));

    if (existing.length > 0) {
      const msg = `Module code "${moduleCode}" already exists in the system (id: ${existing[0].id}). Imported as a new entry.`;
      warnings.push(msg);
      console.warn(`[import] ${msg}`);
    }

    const stageInferred = col(row, "stage_inferred") ?? inferStage(moduleCode);

    await db.insert(moduleReviewsTable).values({
      moduleCode,
      moduleTitle,
      sourceType: col(row, "source_type") ?? "csv_import",
      overview: col(row, "overview"),
      learningOutcomes: col(row, "learning_outcomes"),
      indicativeSyllabus: col(row, "indicative_syllabus"),
      teachingMethods: col(row, "teaching_methods"),
      rawText: col(row, "raw_text"),
      stageInferred,

      primarySarAi: col(row, "primary_sar_ai"),
      secondarySarAi: col(row, "secondary_sar_ai"),
      sarConfidence: col(row, "sar_confidence"),
      selectedSarFinal: col(row, "selected_sar_final"),

      criterion1ScoreFinal: colNum(row, "criterion_1_score_final"),
      criterion2ScoreFinal: colNum(row, "criterion_2_score_final"),
      criterion3ScoreFinal: colNum(row, "criterion_3_score_final"),
      criterion4ScoreFinal: colNum(row, "criterion_4_score_final"),
      criterion5ScoreFinal: colNum(row, "criterion_5_score_final"),
      averageScoreFinal: colNum(row, "average_score_final"),
      scoreBand: col(row, "score_band"),

      overallCommentFinal: col(row, "overall_comment_final"),
      suitabilityNoteFinal: col(row, "suitability_note_final"),
      reviewerNote: col(row, "reviewer_note"),
      reviewStatus: col(row, "review_status") ?? "pending",

      disciplineFamily: col(row, "discipline_family"),
      accessibilityScoreAi: colNum(row, "accessibility_score_ai"),
      stageAppropriatenessScoreAi: colNum(row, "stage_appropriateness_score_ai"),
      breadthTransferabilityScoreAi: colNum(row, "breadth_transferability_score_ai"),
      freeElectiveAverageAi: colNum(row, "free_elective_average_ai"),
      freeElectiveBandAi: col(row, "free_elective_band_ai"),
      tagExplore: colBool(row, "tag_explore"),
      tagUsefulSkills: colBool(row, "tag_useful_skills"),
      tagPathwaySupport: colBool(row, "tag_pathway_support"),
      freeElectiveRationaleAi: col(row, "free_elective_rationale_ai"),
    });

    imported++;
  }

  res.json({ imported, warnings });
});

// ── Decision Workbook Export ──────────────────────────────────────────────────
// Returns an XLSX with ONE row per qualifying module (deduplicated).
// A module qualifies if it is Strong Fit for a SAR, OR Recommended as a Free
// Elective (or both). Dual-qualifying modules appear once with both lenses
// merged into the same row.
router.get("/export/decision-workbook", async (_req, res): Promise<void> => {
  const modules = await db.select().from(moduleReviewsTable).orderBy(moduleReviewsTable.school, moduleReviewsTable.moduleCode);

  const headers = [
    "School",
    "Module Code",
    "Module Title",
    "Credits",
    "Stage",
    "Semester",
    "SAR",
    "Free Elective",
    "SAR Score",
    "SAR Classification",
    "Free Elective Score",
    "Free Elective Suitability",
    "Evidence Summary",
    "Rationale",
    "Advising Notes",
    "Constraints",
    "Upload Batch",
    "Upload Date",
    "Export Date",
  ];

  const exportDate = new Date().toISOString().slice(0, 10);

  // Group qualifying rows by school — one tab per school in the workbook.
  const rowsBySchool = new Map<string, (string | number | null)[][]>();

  const colWidths = [
    { wch: 36 }, // School
    { wch: 14 }, // Module Code
    { wch: 42 }, // Module Title
    { wch: 8  }, // Credits
    { wch: 10 }, // Stage
    { wch: 10 }, // Semester
    { wch: 28 }, // SAR
    { wch: 16 }, // Free Elective
    { wch: 12 }, // SAR Score
    { wch: 16 }, // SAR Classification
    { wch: 20 }, // Free Elective Score
    { wch: 28 }, // Free Elective Suitability
    { wch: 50 }, // Evidence Summary
    { wch: 60 }, // Rationale
    { wch: 40 }, // Advising Notes
    { wch: 24 }, // Constraints
    { wch: 28 }, // Upload Batch
    { wch: 14 }, // Upload Date
    { wch: 14 }, // Export Date
  ];

  for (const m of modules) {
    const isSar = m.scoreBand === "Strong Fit" && !!m.selectedSarFinal;
    const isFe  = m.freeElectiveBandAi === "Recommended" && !!m.freeElectiveProcessedAt;
    if (!isSar && !isFe) continue;

    // ── Evidence Summary ─────────────────────────────────────────────────
    const sarCriteria = isSar ? [
      m.criterion1ScoreFinal != null ? `C1: ${m.criterion1ScoreFinal}` : null,
      m.criterion2ScoreFinal != null ? `C2: ${m.criterion2ScoreFinal}` : null,
      m.criterion3ScoreFinal != null ? `C3: ${m.criterion3ScoreFinal}` : null,
      m.criterion4ScoreFinal != null ? `C4: ${m.criterion4ScoreFinal}` : null,
      m.criterion5ScoreFinal != null ? `C5: ${m.criterion5ScoreFinal}` : null,
    ].filter(Boolean).join(" | ") : "";

    const feSubScores = isFe ? [
      m.accessibilityScoreAi != null        ? `Accessibility: ${m.accessibilityScoreAi}/4`       : null,
      m.stageAppropriatenessScoreAi != null  ? `Stage-Fit: ${m.stageAppropriatenessScoreAi}/4`   : null,
      m.breadthTransferabilityScoreAi != null? `Breadth: ${m.breadthTransferabilityScoreAi}/4`   : null,
    ].filter(Boolean).join(" | ") : "";

    const evidenceParts = [sarCriteria, feSubScores].filter(Boolean);
    const evidenceSummary = evidenceParts.length
      ? (evidenceParts.length === 2
          ? `SAR — ${sarCriteria} || FE — ${feSubScores}`
          : evidenceParts[0])
      : (m.overallCommentFinal ?? m.overallCommentAi ?? "");

    // ── Rationale ────────────────────────────────────────────────────────
    const sarRationale  = isSar ? (m.suitabilityNoteFinal ?? m.suitabilityNoteAi ?? "") : "";
    const feRationale   = isFe  ? (m.freeElectiveRationaleAi ?? "") : "";
    const rationaleStr  = [sarRationale, feRationale].filter(Boolean).join("\n\n");

    // ── Advising Notes ───────────────────────────────────────────────────
    const tags = [
      m.tagExplore        ? "Explore"         : null,
      m.tagUsefulSkills   ? "Useful Skills"   : null,
      m.tagPathwaySupport ? "Pathway Support" : null,
    ].filter(Boolean).join(", ");
    const advisingNotes = [m.reviewerNote ?? "", tags].filter(Boolean).join(" | ");

    // ── Upload Date ──────────────────────────────────────────────────────
    const uploadDate = m.createdAt ? new Date(m.createdAt).toISOString().slice(0, 10) : "";

    const row: (string | number | null)[] = [
      m.school ?? "",
      m.moduleCode ?? "",
      m.moduleTitle ?? "",
      m.credits ?? "",
      m.stageInferred ?? "",
      m.semester ?? "",
      isSar ? (m.selectedSarFinal ?? "") : "",      // SAR
      isFe  ? "Recommended" : "",                   // Free Elective
      isSar ? (m.averageScoreFinal ?? "") : "",     // SAR Score
      isSar ? (m.scoreBand ?? "") : "",             // SAR Classification
      isFe  ? (m.freeElectiveAverageAi ?? "") : "", // Free Elective Score
      isFe  ? (m.disciplineFamily ?? "") : "",      // Free Elective Suitability
      evidenceSummary,
      rationaleStr,
      advisingNotes,
      m.constraints ?? "",
      m.sourceFileName ?? "",
      uploadDate,
      exportDate,
    ];

    // Group by school; modules without a school go to "Other"
    const schoolKey = (m.school ?? "").trim() || "Other";
    if (!rowsBySchool.has(schoolKey)) rowsBySchool.set(schoolKey, []);
    rowsBySchool.get(schoolKey)!.push(row);
  }

  const wb = XLSX.utils.book_new();

  if (rowsBySchool.size === 0) {
    // No qualifying modules — emit a single empty sheet so the file still opens
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    ws["!cols"] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws, "Decision Workbook");
  } else {
    // One sheet per school, sorted alphabetically (Other always last)
    const schoolNames = [...rowsBySchool.keys()].sort((a, b) => {
      if (a === "Other") return 1;
      if (b === "Other") return -1;
      return a.localeCompare(b);
    });

    for (const school of schoolNames) {
      const sheetRows = rowsBySchool.get(school)!;
      const ws = XLSX.utils.aoa_to_sheet([headers, ...sheetRows]);
      ws["!cols"] = colWidths;
      // Excel sheet names are limited to 31 characters; strip invalid chars
      const safeName = school.replace(/[:\\/?*[\]]/g, "").slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, safeName);
    }
  }
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=CAST-Decision-Workbook-${exportDate}.xlsx`);
  res.send(buf);
});

export default router;
