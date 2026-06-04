import { Router, type IRouter } from "express";
import * as XLSX from "xlsx";
import { db, moduleReviewsTable, programmesTable, programmeModulesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAdmin } from "../../lib/auth.js";

export const importStructureRouter: IRouter = Router();

// ── Fuzzy column header match ─────────────────────────────────────────────────
function matchHeader(header: string, patterns: RegExp[]): boolean {
  const h = header.trim().toLowerCase();
  return patterns.some(p => p.test(h));
}

const COL_PROG_CODE   = [/prog.*code|program.*code/];
const COL_PROG_TITLE  = [/prog.*title|prog.*name|program.*name|programme.*title/];
const COL_MODULE_CODE = [/module.*code|mod.*code|^code$/];
const COL_STAGE       = [/^stage$/, /^year$/, /stage.*year|year.*stage|^stage\/year$|^year\/stage$/];
const COL_SEMESTER    = [/^semester$/, /^sem$/, /semester/];
const COL_CORE_OPTION = [/core.*option|option.*core|^core$|^option$|^status$|^type$|^delivery.*type$/];

function findColIndex(headers: string[], patterns: RegExp[]): number {
  return headers.findIndex(h => matchHeader(h, patterns));
}

// ── POST /programme-mapping/parse-structure ───────────────────────────────────
importStructureRouter.post("/programme-mapping/parse-structure", requireAdmin, async (req, res): Promise<void> => {
  const { fileName, base64Data } = req.body as { fileName?: string; base64Data?: string };
  if (!base64Data) { res.status(400).json({ error: "base64Data required" }); return; }

  try {
    const buffer = Buffer.from(base64Data, "base64");
    const wb = XLSX.read(buffer, { type: "buffer" });
    const wsName = wb.SheetNames[0];
    const ws = wb.Sheets[wsName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

    if (!rawRows.length) {
      res.json({ programmeCode: null, programmeName: null, rows: [] });
      return;
    }

    const headers = Object.keys(rawRows[0]);

    const iProgCode   = findColIndex(headers, COL_PROG_CODE);
    const iProgTitle  = findColIndex(headers, COL_PROG_TITLE);
    const iModCode    = findColIndex(headers, COL_MODULE_CODE);
    const iStage      = findColIndex(headers, COL_STAGE);
    const iSemester   = findColIndex(headers, COL_SEMESTER);
    const iCoreOption = findColIndex(headers, COL_CORE_OPTION);

    const getCell = (row: Record<string, unknown>, idx: number): string | null => {
      if (idx === -1) return null;
      const val = row[headers[idx]];
      return val != null && String(val).trim() !== "" ? String(val).trim() : null;
    };

    // Derive programme-level info from first non-empty row
    let programmeCode: string | null = null;
    let programmeName: string | null = null;
    for (const row of rawRows) {
      if (!programmeCode && iProgCode !== -1) programmeCode = getCell(row, iProgCode);
      if (!programmeName && iProgTitle !== -1) programmeName = getCell(row, iProgTitle);
      if (programmeCode && programmeName) break;
    }

    // Collect all module codes from spreadsheet
    const allModuleCodes = rawRows
      .map(row => getCell(row, iModCode))
      .filter((c): c is string => !!c);

    // Lookup existing modules by code (case-insensitive)
    const allModules = await db.select({
      id: moduleReviewsTable.id,
      moduleCode: moduleReviewsTable.moduleCode,
      moduleTitle: moduleReviewsTable.moduleTitle,
    }).from(moduleReviewsTable);

    const moduleByCode = new Map<string, { id: number; moduleCode: string; moduleTitle: string }>();
    for (const m of allModules) {
      moduleByCode.set(m.moduleCode.trim().toLowerCase(), m);
    }

    const rows = rawRows
      .map(row => {
        const moduleCode = getCell(row, iModCode);
        if (!moduleCode) return null;
        const found = moduleByCode.get(moduleCode.toLowerCase());
        return {
          moduleCode,
          stage:      getCell(row, iStage),
          semester:   getCell(row, iSemester),
          coreOption: getCell(row, iCoreOption),
          matched:    !!found,
          moduleId:   found?.id ?? null,
          moduleTitle: found?.moduleTitle ?? null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    res.json({ programmeCode, programmeName, rows });
  } catch (err) {
    console.error("[parse-structure]", err);
    res.status(500).json({ error: "Failed to parse structure file" });
  }
});

// ── POST /programme-mapping/import-structure ──────────────────────────────────
importStructureRouter.post("/programme-mapping/import-structure", requireAdmin, async (req, res): Promise<void> => {
  const {
    programmeName,
    programmeCode,
    rows,
  } = req.body as {
    programmeName: string;
    programmeCode?: string;
    rows: Array<{ moduleId: number; stage: string | null; semester: string | null; coreOption: string | null; orderIndex: number }>;
  };

  if (!programmeName?.trim()) { res.status(400).json({ error: "programmeName required" }); return; }
  if (!rows?.length) { res.status(400).json({ error: "No rows to import" }); return; }

  try {
    // Create the programme
    const [prog] = await db.insert(programmesTable).values({
      name: programmeName.trim(),
      code: programmeCode?.trim() || null,
    }).returning();

    // Insert modules
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.moduleId) continue;

      // Skip duplicates (if same module appears twice in the sheet)
      const existing = await db.select({ id: programmeModulesTable.id })
        .from(programmeModulesTable)
        .where(and(
          eq(programmeModulesTable.programmeId, prog.id),
          eq(programmeModulesTable.moduleId, r.moduleId),
        ));
      if (existing.length) continue;

      await db.insert(programmeModulesTable).values({
        programmeId: prog.id,
        moduleId: r.moduleId,
        stage: r.stage,
        semester: r.semester,
        coreOption: r.coreOption,
        orderIndex: r.orderIndex ?? i,
      });
    }

    res.status(201).json({ programmeId: prog.id });
  } catch (err) {
    console.error("[import-structure]", err);
    res.status(500).json({ error: "Failed to import structure" });
  }
});
