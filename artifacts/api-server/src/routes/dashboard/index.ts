import { Router, type IRouter } from "express";
import { db, moduleReviewsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const modules = await db.select().from(moduleReviewsTable);

  const total = modules.length;

  const byStatus: Record<string, number> = {};
  const bySar: Record<string, number> = {};
  const byStage: Record<string, number> = {};
  const byScoreBand: Record<string, number> = {};
  const byConfidence: Record<string, number> = {};

  let scoreSum = 0;
  let scoreCount = 0;

  for (const mod of modules) {
    const status = mod.reviewStatus ?? "pending";
    byStatus[status] = (byStatus[status] ?? 0) + 1;

    const sar = mod.selectedSarFinal ?? mod.primarySarAi ?? "Unclassified";
    bySar[sar] = (bySar[sar] ?? 0) + 1;

    const stage = mod.stageInferred ?? "Unknown";
    byStage[stage] = (byStage[stage] ?? 0) + 1;

    if (mod.scoreBand) {
      byScoreBand[mod.scoreBand] = (byScoreBand[mod.scoreBand] ?? 0) + 1;
    }

    if (mod.sarConfidence) {
      byConfidence[mod.sarConfidence] = (byConfidence[mod.sarConfidence] ?? 0) + 1;
    }

    if (mod.averageScoreFinal != null) {
      scoreSum += mod.averageScoreFinal;
      scoreCount++;
    }
  }

  const latestUploadAt = modules.reduce<string | null>((latest, m) => {
    if (!m.createdAt) return latest;
    const ts = m.createdAt instanceof Date ? m.createdAt.toISOString() : String(m.createdAt);
    return latest === null || ts > latest ? ts : latest;
  }, null);

  res.json({
    total,
    latestUploadAt,
    byStatus,
    bySar,
    byStage,
    byScoreBand,
    byConfidence,
    averageScore: scoreCount > 0 ? Math.round((scoreSum / scoreCount) * 100) / 100 : null,
  });
});

export default router;
