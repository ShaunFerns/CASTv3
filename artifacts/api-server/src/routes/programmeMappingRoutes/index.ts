import { Router, type IRouter } from "express";
import { requireAdmin } from "../../lib/auth.js";
import { logAudit, getClientIp } from "../../lib/auditLogger.js";
import { db, moduleReviewsTable, programmesTable, programmeModulesTable, gaClassificationsTable } from "@workspace/db";
import { eq, and, inArray, isNull } from "drizzle-orm";
import { classifyModuleGA, classifyModuleGreenComp, GREENCOMP_COMPETENCES, classifyModulesDigCompBatch, DIGCOMP_COMPETENCES, classifyModulesEntreCompBatch, ENTRECOMP_COMPETENCES } from "../../lib/aiService.js";
import { importStructureRouter } from "./importStructure.js";

const GA_DOMAINS = ["People", "Planet", "Partnership"] as const;

// In-memory generation state per programme per lens
const genState: Record<string, { total: number; processed: number; generating: boolean; error?: string }> = {};
function genKey(programmeId: number, lens: string) { return `${programmeId}-${lens}`; }

const router: IRouter = Router();

function firstString(value: unknown): string {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : "";
  return typeof value === "string" ? value : "";
}

function parseRouteInt(value: unknown): number {
  return parseInt(firstString(value), 10);
}

// ── List programmes ──────────────────────────────────────────────────────────
router.get("/programme-mapping/programmes", async (_req, res): Promise<void> => {
  try {
    const progs = await db.select().from(programmesTable).orderBy(programmesTable.createdAt);
    const counts = await db.select({ programmeId: programmeModulesTable.programmeId }).from(programmeModulesTable);
    const countMap: Record<number, number> = {};
    for (const r of counts) countMap[r.programmeId] = (countMap[r.programmeId] ?? 0) + 1;
    res.json(progs.map(p => ({ ...p, moduleCount: countMap[p.id] ?? 0 })));
  } catch (err) {
    console.error("[pm/programmes]", err);
    res.status(500).json({ error: "Failed to list programmes" });
  }
});

// ── Create programme ─────────────────────────────────────────────────────────
router.post("/programme-mapping/programmes", requireAdmin, async (req, res): Promise<void> => {
  const { name, code, description } = req.body as { name: string; code?: string; description?: string };
  if (!name?.trim()) { res.status(400).json({ error: "name required" }); return; }
  try {
    const [prog] = await db.insert(programmesTable).values({ name: name.trim(), code: code?.trim() || null, description: description?.trim() || null }).returning();
    res.status(201).json(prog);
  } catch (err) {
    console.error("[pm/create]", err);
    res.status(500).json({ error: "Failed to create programme" });
  }
});

// ── Get programme (with modules + classifications) ────────────────────────────
// ?lens=ga (default) | greencomp
router.get("/programme-mapping/programmes/:id", async (req, res): Promise<void> => {
  const id = parseRouteInt(req.params.id);
  const lens = firstString(req.query.lens) || "ga";

  try {
    const [prog] = await db.select().from(programmesTable).where(eq(programmesTable.id, id));
    if (!prog) { res.status(404).json({ error: "Not found" }); return; }

    const pmRows = await db.select().from(programmeModulesTable)
      .where(eq(programmeModulesTable.programmeId, id))
      .orderBy(programmeModulesTable.orderIndex);

    const moduleIds = pmRows.map(r => r.moduleId);
    const moduleDetails = moduleIds.length
      ? await db.select({
          id: moduleReviewsTable.id,
          moduleCode: moduleReviewsTable.moduleCode,
          moduleTitle: moduleReviewsTable.moduleTitle,
          stageInferred: moduleReviewsTable.stageInferred,
          learningOutcomes: moduleReviewsTable.learningOutcomes,
          overview: moduleReviewsTable.overview,
          indicativeSyllabus: moduleReviewsTable.indicativeSyllabus,
          teachingMethods: moduleReviewsTable.teachingMethods,
        }).from(moduleReviewsTable).where(inArray(moduleReviewsTable.id, moduleIds))
      : [];

    const modMap = Object.fromEntries(moduleDetails.map(m => [m.id, m]));
    const modules = pmRows.map(pm => ({ ...pm, module: modMap[pm.moduleId] }));

    // Programme-specific classifications for this lens
    const progCls = moduleIds.length
      ? await db.select().from(gaClassificationsTable)
          .where(and(
            eq(gaClassificationsTable.programmeId, id),
            eq(gaClassificationsTable.lens, lens),
            inArray(gaClassificationsTable.moduleId, moduleIds),
          ))
      : [];

    // Module-level (global) fallback for this lens
    const globalCls = moduleIds.length
      ? await db.select().from(gaClassificationsTable)
          .where(and(
            isNull(gaClassificationsTable.programmeId),
            eq(gaClassificationsTable.lens, lens),
            inArray(gaClassificationsTable.moduleId, moduleIds),
          ))
      : [];

    // Merge: programme-specific wins; global fills gaps and is flagged as inherited
    type ClsRow = typeof progCls[0] & { inherited: boolean };
    const clsMap: Record<string, ClsRow> = {};
    for (const c of globalCls) clsMap[`${c.moduleId}-${c.domain}`] = { ...c, inherited: true };
    for (const c of progCls)   clsMap[`${c.moduleId}-${c.domain}`] = { ...c, inherited: false };
    const classifications = Object.values(clsMap);

    res.json({ ...prog, modules, classifications });
  } catch (err) {
    console.error("[pm/get]", err);
    res.status(500).json({ error: "Failed to get programme" });
  }
});

// ── Update programme metadata ─────────────────────────────────────────────────
router.patch("/programme-mapping/programmes/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseRouteInt(req.params.id);
  const { name, code, description } = req.body as { name?: string; code?: string; description?: string };
  try {
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (code !== undefined) updates.code = code?.trim() || null;
    if (description !== undefined) updates.description = description?.trim() || null;
    if (Object.keys(updates).length) await db.update(programmesTable).set(updates).where(eq(programmesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error("[pm/update]", err);
    res.status(500).json({ error: "Failed to update programme" });
  }
});

// ── Delete programme ──────────────────────────────────────────────────────────
router.delete("/programme-mapping/programmes/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseRouteInt(req.params.id);
  try {
    await db.delete(programmeModulesTable).where(eq(programmeModulesTable.programmeId, id));
    await db.delete(gaClassificationsTable).where(eq(gaClassificationsTable.programmeId, id));
    await db.delete(programmesTable).where(eq(programmesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error("[pm/delete]", err);
    res.status(500).json({ error: "Failed to delete programme" });
  }
});

// ── Module pool ───────────────────────────────────────────────────────────────
router.get("/programme-mapping/module-pool", async (_req, res): Promise<void> => {
  try {
    const modules = await db.select({
      id:            moduleReviewsTable.id,
      moduleCode:    moduleReviewsTable.moduleCode,
      moduleTitle:   moduleReviewsTable.moduleTitle,
      stageInferred: moduleReviewsTable.stageInferred,
      overview:      moduleReviewsTable.overview,
      learningOutcomes: moduleReviewsTable.learningOutcomes,
    }).from(moduleReviewsTable).orderBy(moduleReviewsTable.moduleCode);
    res.json(modules);
  } catch (err) {
    console.error("[pm/pool]", err);
    res.status(500).json({ error: "Failed to list module pool" });
  }
});

// ── Add module to programme ────────────────────────────────────────────────────
router.post("/programme-mapping/programmes/:id/modules", requireAdmin, async (req, res): Promise<void> => {
  const programmeId = parseRouteInt(req.params.id);
  const { moduleId, stage, semester, coreOption, orderIndex } = req.body as {
    moduleId: number; stage?: string; semester?: string; coreOption?: string; orderIndex?: number;
  };
  try {
    const [row] = await db.insert(programmeModulesTable).values({
      programmeId, moduleId, stage: stage || null, semester: semester || null,
      coreOption: coreOption || null, orderIndex: orderIndex ?? 0,
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    console.error("[pm/add-module]", err);
    res.status(500).json({ error: "Failed to add module" });
  }
});

// ── Remove module from programme ──────────────────────────────────────────────
router.delete("/programme-mapping/programmes/:id/modules/:moduleId", requireAdmin, async (req, res): Promise<void> => {
  const programmeId = parseRouteInt(req.params.id);
  const moduleId    = parseRouteInt(req.params.moduleId);
  try {
    await db.delete(programmeModulesTable).where(
      and(eq(programmeModulesTable.programmeId, programmeId), eq(programmeModulesTable.moduleId, moduleId))
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("[pm/remove-module]", err);
    res.status(500).json({ error: "Failed to remove module" });
  }
});

// ── Update module metadata in programme ───────────────────────────────────────
router.patch("/programme-mapping/programmes/:id/modules/:moduleId", requireAdmin, async (req, res): Promise<void> => {
  const programmeId = parseRouteInt(req.params.id);
  const moduleId    = parseRouteInt(req.params.moduleId);
  const { stage, semester, coreOption } = req.body as { stage?: string; semester?: string; coreOption?: string };
  try {
    const updates: Record<string, unknown> = {};
    if (stage      !== undefined) updates.stage      = stage      || null;
    if (semester   !== undefined) updates.semester   = semester   || null;
    if (coreOption !== undefined) updates.coreOption = coreOption || null;
    await db.update(programmeModulesTable).set(updates).where(
      and(eq(programmeModulesTable.programmeId, programmeId), eq(programmeModulesTable.moduleId, moduleId))
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("[pm/update-module]", err);
    res.status(500).json({ error: "Failed to update module" });
  }
});

// ── Bulk reorder programme modules ────────────────────────────────────────────
router.put("/programme-mapping/programmes/:id/modules/reorder", requireAdmin, async (req, res): Promise<void> => {
  const programmeId = parseRouteInt(req.params.id);
  const { order } = req.body as { order: { moduleId: number; orderIndex: number }[] };
  try {
    await Promise.all(order.map(({ moduleId, orderIndex }) =>
      db.update(programmeModulesTable).set({ orderIndex }).where(
        and(eq(programmeModulesTable.programmeId, programmeId), eq(programmeModulesTable.moduleId, moduleId))
      )
    ));
    res.json({ ok: true });
  } catch (err) {
    console.error("[pm/reorder]", err);
    res.status(500).json({ error: "Failed to reorder" });
  }
});

// ── Save classifications (upsert) — lens-aware ────────────────────────────────
// Body: { classifications, lens? (default "ga") }
router.put("/programme-mapping/programmes/:id/ga", requireAdmin, async (req, res): Promise<void> => {
  const programmeId = parseRouteInt(req.params.id);
  const { classifications, lens = "ga" } = req.body as {
    classifications: { moduleId: number; domain: string; level: string; source?: string }[];
    lens?: string;
  };
  try {
    for (const { moduleId, domain, level, source } of classifications) {
      const src = source ?? "user";
      const existing = await db.select({ id: gaClassificationsTable.id })
        .from(gaClassificationsTable)
        .where(and(
          eq(gaClassificationsTable.programmeId, programmeId),
          eq(gaClassificationsTable.lens, lens),
          eq(gaClassificationsTable.moduleId, moduleId),
          eq(gaClassificationsTable.domain, domain),
        ));
      if (existing.length) {
        await db.update(gaClassificationsTable).set({ level, source: src }).where(eq(gaClassificationsTable.id, existing[0].id));
      } else {
        await db.insert(gaClassificationsTable).values({ programmeId, moduleId, lens, domain, level, source: src });
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[pm/ga]", err);
    res.status(500).json({ error: "Failed to save classifications" });
  }
});

// ── Auto-classify status — lens-aware ─────────────────────────────────────────
router.get("/programme-mapping/programmes/:id/ga/auto-classify/status", (req, res): void => {
  const id   = parseRouteInt(req.params.id);
  const lens = firstString(req.query.lens) || "ga";
  const state = genState[genKey(id, lens)] ?? { total: 0, processed: 0, generating: false };
  res.json(state);
});

// ── Auto-classify (AI first pass) — lens-aware ────────────────────────────────
router.post("/programme-mapping/programmes/:id/ga/auto-classify", requireAdmin, async (req, res): Promise<void> => {
  const programmeId = parseRouteInt(req.params.id);
  const force = Boolean(req.body?.force);
  const lens  = (req.body?.lens as string) || "ga";
  const key   = genKey(programmeId, lens);

  if (genState[key]?.generating) {
    res.json({ started: false, message: "Already generating" }); return;
  }

  const pmRows = await db.select().from(programmeModulesTable)
    .where(eq(programmeModulesTable.programmeId, programmeId));
  const moduleIds = pmRows.map(r => r.moduleId);

  if (!moduleIds.length) {
    res.json({ started: false, message: "No modules in programme" }); return;
  }

  const moduleDetails = await db.select({
    id: moduleReviewsTable.id,
    moduleCode: moduleReviewsTable.moduleCode,
    moduleTitle: moduleReviewsTable.moduleTitle,
    learningOutcomes: moduleReviewsTable.learningOutcomes,
    overview: moduleReviewsTable.overview,
    indicativeSyllabus: moduleReviewsTable.indicativeSyllabus,
    teachingMethods: moduleReviewsTable.teachingMethods,
    assessmentText: moduleReviewsTable.assessmentText,
    stageInferred: moduleReviewsTable.stageInferred,
    disciplineFamily: moduleReviewsTable.disciplineFamily,
  }).from(moduleReviewsTable).where(inArray(moduleReviewsTable.id, moduleIds));

  let toClassify = moduleDetails;
  if (!force) {
    const existing = await db.select({ moduleId: gaClassificationsTable.moduleId })
      .from(gaClassificationsTable)
      .where(and(eq(gaClassificationsTable.programmeId, programmeId), eq(gaClassificationsTable.lens, lens)));
    const alreadyDone = new Set(existing.map(r => r.moduleId));
    toClassify = moduleDetails.filter(m => !alreadyDone.has(m.id));
  }

  if (!toClassify.length && !force) {
    res.json({ started: false, message: "All modules already classified. Use force=true to re-classify." });
    return;
  }

  genState[key] = { total: toClassify.length, processed: 0, generating: true };
  res.json({ started: true, message: `Classifying ${toClassify.length} modules…` });

  const domains: readonly string[] = lens === "greencomp"
    ? (GREENCOMP_COMPETENCES as readonly string[])
    : lens === "digcomp"
      ? (DIGCOMP_COMPETENCES as readonly string[])
      : lens === "entrecomp"
        ? (ENTRECOMP_COMPETENCES as readonly string[])
        : (GA_DOMAINS as readonly string[]);

  (async () => {
    for (const mod of toClassify) {
      try {
        let classifyResult: Record<string, unknown>;
        const input = [{
          moduleCode: mod.moduleCode, moduleTitle: mod.moduleTitle,
          learningOutcomes: mod.learningOutcomes, overview: mod.overview,
          indicativeSyllabus: mod.indicativeSyllabus, teachingMethods: mod.teachingMethods,
          assessmentText: mod.assessmentText, stageInferred: mod.stageInferred, disciplineFamily: mod.disciplineFamily,
        }];
        if (lens === "ga") {
          classifyResult = await classifyModuleGA(
            mod.moduleCode, mod.moduleTitle, mod.learningOutcomes, mod.overview,
            mod.indicativeSyllabus, mod.teachingMethods, mod.assessmentText, mod.stageInferred, mod.disciplineFamily,
          ) as unknown as Record<string, unknown>;
        } else if (lens === "greencomp") {
          classifyResult = await classifyModuleGreenComp(
            mod.moduleCode, mod.moduleTitle, mod.learningOutcomes, mod.overview,
            mod.indicativeSyllabus, mod.teachingMethods, mod.assessmentText, mod.stageInferred, mod.disciplineFamily,
          ) as unknown as Record<string, unknown>;
        } else if (lens === "digcomp") {
          classifyResult = (await classifyModulesDigCompBatch(input))[0] as Record<string, unknown>;
        } else {
          classifyResult = (await classifyModulesEntreCompBatch(input))[0] as Record<string, unknown>;
        }

        const rationale = (classifyResult.rationale ?? {}) as Record<string, string>;
        const evidence  = (classifyResult.evidence  ?? {}) as Record<string, unknown>;

        for (const domain of domains) {
          const level = (classifyResult[domain] as string) ?? "None";
          const rat   = rationale[domain] ?? null;
          const evArr = Array.isArray(evidence[domain]) ? (evidence[domain] as unknown[]) : [];
          const evidenceJson = evArr.length ? JSON.stringify(evArr) : null;

          const existing = await db.select({ id: gaClassificationsTable.id, source: gaClassificationsTable.source })
            .from(gaClassificationsTable)
            .where(and(
              eq(gaClassificationsTable.programmeId, programmeId),
              eq(gaClassificationsTable.lens, lens),
              eq(gaClassificationsTable.moduleId, mod.id),
              eq(gaClassificationsTable.domain, domain),
            ));

          if (existing.length) {
            if (force || existing[0].source !== "user") {
              await db.update(gaClassificationsTable)
                .set({ level, source: "ai", rationale: rat, evidence: evidenceJson })
                .where(eq(gaClassificationsTable.id, existing[0].id));
            }
          } else {
            await db.insert(gaClassificationsTable).values({
              programmeId, moduleId: mod.id, lens, domain, level, source: "ai", rationale: rat, evidence: evidenceJson,
            });
          }
        }
      } catch (err) {
        console.error(`[pm/${lens}-classify] module ${mod.id}:`, err);
      }
      genState[key].processed++;
    }
    genState[key].generating = false;
  })().catch(err => {
    console.error(`[pm/${lens}-classify] background error:`, err);
    if (genState[key]) genState[key].generating = false;
  });
});

// Register import structure routes
router.use(importStructureRouter);

export default router;
