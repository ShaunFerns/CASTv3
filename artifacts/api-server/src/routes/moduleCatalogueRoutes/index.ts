import { Router, type IRouter } from "express";
import { requireAdmin } from "../../lib/auth.js";
import { logAudit, getClientIp } from "../../lib/auditLogger.js";
import { db, moduleReviewsTable, gaClassificationsTable, programmeModulesTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { classifyModulesGABatch, classifyModulesGreenCompBatch, GREENCOMP_COMPETENCES, classifyModulesDigCompBatch, DIGCOMP_COMPETENCES, classifyModulesEntreCompBatch, ENTRECOMP_COMPETENCES } from "../../lib/aiService.js";

const GA_DOMAINS_SET   = new Set(["People", "Planet", "Partnership"]);
const GC_DOMAINS_SET   = new Set(GREENCOMP_COMPETENCES as unknown as string[]);
const DC_DOMAINS_SET   = new Set(DIGCOMP_COMPETENCES as unknown as string[]);
const EC_DOMAINS_SET   = new Set(ENTRECOMP_COMPETENCES as unknown as string[]);
const GA_LEVELS_SET    = new Set(["None", "Developing", "Consolidating", "Leading"]);
const EC_LEVELS_SET    = new Set(["None", "Foundation", "Intermediate", "Advanced"]);

const router: IRouter = Router();

function firstString(value: unknown): string {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : "";
  return typeof value === "string" ? value : "";
}

function parseRouteInt(value: unknown): number {
  return parseInt(firstString(value), 10);
}

const LEVEL_ORDER: Record<string, number> = {
  None: 0,
  Developing: 1, Consolidating: 2, Leading: 3,
  Foundation: 1, Intermediate: 2, Advanced: 3,
};
const GA_DOMAINS = ["People", "Planet", "Partnership"] as const;

// In-memory state for system-wide batch generation per lens
const sysGenState: Record<string, { total: number; processed: number; generating: boolean; error: string }> = {
  ga:         { total: 0, processed: 0, generating: false, error: "" },
  greencomp:  { total: 0, processed: 0, generating: false, error: "" },
  digcomp:    { total: 0, processed: 0, generating: false, error: "" },
  entrecomp:  { total: 0, processed: 0, generating: false, error: "" },
};

// ── GET /module-catalogue ─────────────────────────────────────────────────────
// ?lens=ga (default) | greencomp | digcomp | entrecomp
router.get("/module-catalogue", async (req, res): Promise<void> => {
  try {
    const lens = firstString(req.query.lens) || "ga";
    const domains = lens === "greencomp"
      ? (GREENCOMP_COMPETENCES as readonly string[])
      : lens === "digcomp"
        ? (DIGCOMP_COMPETENCES as readonly string[])
        : lens === "entrecomp"
          ? (ENTRECOMP_COMPETENCES as readonly string[])
          : (GA_DOMAINS as readonly string[]);

    const modules = await db.select({
      id:              moduleReviewsTable.id,
      moduleCode:      moduleReviewsTable.moduleCode,
      moduleTitle:     moduleReviewsTable.moduleTitle,
      stageInferred:   moduleReviewsTable.stageInferred,
      campus:          moduleReviewsTable.campus,
      disciplineFamily: moduleReviewsTable.disciplineFamily,
    }).from(moduleReviewsTable).orderBy(moduleReviewsTable.moduleCode);

    // All classifications for this lens
    const allCls = await db.select({
      moduleId:  gaClassificationsTable.moduleId,
      domain:    gaClassificationsTable.domain,
      level:     gaClassificationsTable.level,
      source:    gaClassificationsTable.source,
      rationale: gaClassificationsTable.rationale,
      evidence:  gaClassificationsTable.evidence,
    }).from(gaClassificationsTable)
      .where(eq(gaClassificationsTable.lens, lens));

    // Programme counts per module
    const pmRows = await db.select({ moduleId: programmeModulesTable.moduleId }).from(programmeModulesTable);
    const programmeCounts: Record<number, number> = {};
    for (const r of pmRows) programmeCounts[r.moduleId] = (programmeCounts[r.moduleId] ?? 0) + 1;

    // Per module+domain: pick highest level; on tie prefer user over ai
    const clsByModDomain: Record<string, { level: string; source?: string; rationale?: string; evidence?: string }> = {};
    for (const c of allCls) {
      const key = `${c.moduleId}-${c.domain}`;
      const existing = clsByModDomain[key];
      const newOrder  = LEVEL_ORDER[c.level]  ?? 0;
      const prevOrder = LEVEL_ORDER[existing?.level ?? "None"] ?? 0;
      if (!existing || newOrder > prevOrder || (newOrder === prevOrder && c.source === "user" && existing.source !== "user")) {
        clsByModDomain[key] = { level: c.level, source: c.source ?? undefined, rationale: c.rationale ?? undefined, evidence: c.evidence ?? undefined };
      }
    }

    const result = modules.map(m => ({
      ...m,
      programmeCount: programmeCounts[m.id] ?? 0,
      gaClassifications: domains.map(domain => {
        const cls = clsByModDomain[`${m.id}-${domain}`];
        return { domain, level: cls?.level ?? "None", source: cls?.source ?? null, rationale: cls?.rationale ?? null, evidence: cls?.evidence ?? null };
      }),
    }));

    res.json(result);
  } catch (err) {
    console.error("[module-catalogue]", err);
    res.status(500).json({ error: "Failed to fetch module catalogue" });
  }
});

// ── PATCH /module-catalogue/:moduleId/ga ──────────────────────────────────────
// Upsert a module-level (global, programmeId IS NULL) classification
// Body: { domain, level, lens? (default "ga") }
router.patch("/module-catalogue/:moduleId/ga", requireAdmin, async (req, res): Promise<void> => {
  const moduleId = parseRouteInt(req.params.moduleId);
  const { domain, level, lens = "ga" } = req.body as { domain: string; level: string; lens?: string };

  const validDomains = lens === "greencomp" ? GC_DOMAINS_SET
    : lens === "digcomp" ? DC_DOMAINS_SET
    : lens === "entrecomp" ? EC_DOMAINS_SET
    : GA_DOMAINS_SET;
  const validLevels = lens === "entrecomp" ? EC_LEVELS_SET : GA_LEVELS_SET;
  if (!validDomains.has(domain) || !validLevels.has(level)) {
    res.status(400).json({ error: "Invalid domain or level" });
    return;
  }
  if (isNaN(moduleId)) { res.status(400).json({ error: "Invalid moduleId" }); return; }

  try {
    const existing = await db.select({ id: gaClassificationsTable.id })
      .from(gaClassificationsTable)
      .where(and(
        isNull(gaClassificationsTable.programmeId),
        eq(gaClassificationsTable.lens, lens),
        eq(gaClassificationsTable.moduleId, moduleId),
        eq(gaClassificationsTable.domain, domain),
      ));

    if (existing.length) {
      await db.update(gaClassificationsTable)
        .set({ level, source: "user", rationale: null, evidence: null })
        .where(eq(gaClassificationsTable.id, existing[0].id));
    } else {
      await db.insert(gaClassificationsTable).values({
        programmeId: null, moduleId, lens, domain, level, source: "user",
      });
    }
    res.json({ ok: true, domain, level, lens });
  } catch (err) {
    console.error("[module-catalogue/ga]", err);
    res.status(500).json({ error: "Failed to save classification" });
  }
});

// ── GET /module-catalogue/:lens/batch-classify/status ────────────────────────
router.get("/module-catalogue/:lens/batch-classify/status", (req, res): void => {
  const lens = firstString(req.params.lens);
  res.json(sysGenState[lens] ?? { total: 0, processed: 0, generating: false });
});

// ── POST /module-catalogue/:lens/batch-classify ───────────────────────────────
router.post("/module-catalogue/:lens/batch-classify", requireAdmin, async (req, res): Promise<void> => {
  const lens = firstString(req.params.lens);
  const force = Boolean(req.body?.force);

  if (!["ga", "greencomp", "digcomp", "entrecomp"].includes(lens)) {
    res.status(400).json({ error: "Unknown lens" }); return;
  }
  if (!sysGenState[lens]) sysGenState[lens] = { total: 0, processed: 0, generating: false, error: "" };
  if (sysGenState[lens].generating) {
    res.json({ started: false, message: "Already generating" }); return;
  }

  const allModules = await db.select({
    id:                 moduleReviewsTable.id,
    moduleCode:         moduleReviewsTable.moduleCode,
    moduleTitle:        moduleReviewsTable.moduleTitle,
    learningOutcomes:   moduleReviewsTable.learningOutcomes,
    overview:           moduleReviewsTable.overview,
    indicativeSyllabus: moduleReviewsTable.indicativeSyllabus,
    teachingMethods:    moduleReviewsTable.teachingMethods,
    assessmentText:     moduleReviewsTable.assessmentText,
    stageInferred:      moduleReviewsTable.stageInferred,
    disciplineFamily:   moduleReviewsTable.disciplineFamily,
  }).from(moduleReviewsTable);

  let toClassify = allModules;

  if (!force) {
    const existing = await db.select({ moduleId: gaClassificationsTable.moduleId })
      .from(gaClassificationsTable)
      .where(and(isNull(gaClassificationsTable.programmeId), eq(gaClassificationsTable.lens, lens)));
    const alreadyDone = new Set(existing.map(r => r.moduleId));
    toClassify = allModules.filter(m => !alreadyDone.has(m.id));
  }

  if (!toClassify.length) {
    res.json({ started: false, message: "All modules already classified. Use force=true to re-classify." });
    return;
  }

  sysGenState[lens] = { total: toClassify.length, processed: 0, generating: true, error: "" };
  res.json({ started: true, message: `Classifying ${toClassify.length} modules…` });

  const domains = lens === "greencomp"
    ? (GREENCOMP_COMPETENCES as readonly string[])
    : lens === "digcomp"
      ? (DIGCOMP_COMPETENCES as readonly string[])
      : lens === "entrecomp"
        ? (ENTRECOMP_COMPETENCES as readonly string[])
        : (GA_DOMAINS as readonly string[]);

  const CHUNK_SIZE = 2;

  (async () => {
    for (let i = 0; i < toClassify.length; i += CHUNK_SIZE) {
      const chunk = toClassify.slice(i, i + CHUNK_SIZE);
      try {
        const inputs = chunk.map(mod => ({
          moduleCode: mod.moduleCode, moduleTitle: mod.moduleTitle,
          learningOutcomes: mod.learningOutcomes, overview: mod.overview,
          indicativeSyllabus: mod.indicativeSyllabus, teachingMethods: mod.teachingMethods,
          assessmentText: mod.assessmentText, stageInferred: mod.stageInferred,
          disciplineFamily: mod.disciplineFamily,
        }));

        const results = lens === "ga"
          ? await classifyModulesGABatch(inputs)
          : lens === "digcomp"
            ? await classifyModulesDigCompBatch(inputs)
            : lens === "entrecomp"
              ? await classifyModulesEntreCompBatch(inputs)
              : await classifyModulesGreenCompBatch(inputs);

        for (let j = 0; j < chunk.length; j++) {
          const mod = chunk[j];
          const classifyResult = results[j] as Record<string, unknown>;
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
                isNull(gaClassificationsTable.programmeId),
                eq(gaClassificationsTable.lens, lens),
                eq(gaClassificationsTable.moduleId, mod.id),
                eq(gaClassificationsTable.domain, domain),
              ));

            if (existing.length) {
              if (existing[0].source !== "user") {
                await db.update(gaClassificationsTable)
                  .set({ level, source: "ai", rationale: rat, evidence: evidenceJson })
                  .where(eq(gaClassificationsTable.id, existing[0].id));
              }
            } else {
              await db.insert(gaClassificationsTable).values({
                programmeId: null, moduleId: mod.id, lens, domain, level, source: "ai", rationale: rat, evidence: evidenceJson,
              });
            }
          }
        }
      } catch (err) {
        console.error(`[sys-${lens}-classify] chunk at ${i}:`, err);
      }
      sysGenState[lens].processed += chunk.length;
    }
    sysGenState[lens].generating = false;
  })().catch(err => {
    console.error(`[sys-${lens}-classify] background error:`, err);
    sysGenState[lens].generating = false;
  });
});

// Legacy route aliases kept for backward compatibility
router.get("/module-catalogue/ga/batch-classify/status", (_req, res): void => {
  res.json(sysGenState["ga"]);
});
router.post("/module-catalogue/ga/batch-classify", (req, res, next) => {
  (req.params as { lens?: string }).lens = "ga";
  next();
});

export default router;
