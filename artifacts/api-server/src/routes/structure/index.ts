import { Router, type IRouter } from "express";
import { requireAdmin } from "../../lib/auth.js";
import { logAudit, getClientIp } from "../../lib/auditLogger.js";
import { db, moduleReviewsTable } from "@workspace/db";
import {
  getOverview,
  getSimilarModules,
  getClusters,
  getOutliers,
  getNetwork,
  invalidateCache,
} from "../../lib/similarity.js";
import {
  getSemanticOverview,
  getSemanticSimilarModules,
  getSemanticClusters,
  getSemanticOutliers,
  getSemanticNetwork,
  getEmbeddingStatus,
  startEmbeddingGeneration,
  compareSimilarModules,
  invalidateSemanticCache,
} from "../../lib/semantic.js";

const router: IRouter = Router();

// ── Module list (lightweight) ─────────────────────────────────────────────────
router.get("/structure/modules", async (_req, res): Promise<void> => {
  const modules = await db
    .select({
      id: moduleReviewsTable.id,
      moduleCode: moduleReviewsTable.moduleCode,
      moduleTitle: moduleReviewsTable.moduleTitle,
    })
    .from(moduleReviewsTable)
    .orderBy(moduleReviewsTable.moduleCode);
  res.json(modules);
});

// ── Overview ──────────────────────────────────────────────────────────────────
router.get("/structure/overview", async (req, res): Promise<void> => {
  const method = (req.query.method as string) ?? "tfidf";
  try {
    if (method === "semantic") {
      res.json(await getSemanticOverview());
    } else {
      const [tfidf, embStatus] = await Promise.all([getOverview(), getEmbeddingStatus()]);
      res.json({ ...tfidf, ...embStatus });
    }
  } catch (err) {
    console.error("[structure/overview]", err);
    res.status(500).json({ error: "Computation failed" });
  }
});

// ── Invalidate caches ─────────────────────────────────────────────────────────
router.delete("/structure/cache", requireAdmin, (_req, res): void => {
  invalidateCache();
  invalidateSemanticCache();
  res.json({ ok: true });
});

// ── Embedding status ──────────────────────────────────────────────────────────
router.get("/structure/embeddings/status", async (_req, res): Promise<void> => {
  try {
    const status = await getEmbeddingStatus();
    res.json(status);
  } catch (err) {
    console.error("[structure/embeddings/status]", err);
    res.status(500).json({ error: "Failed to get status" });
  }
});

// ── Trigger embedding generation ──────────────────────────────────────────────
router.post("/structure/embeddings/generate", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const result = await startEmbeddingGeneration();
    res.json(result);
  } catch (err) {
    console.error("[structure/embeddings/generate]", err);
    res.status(500).json({ error: "Failed to start generation" });
  }
});

// ── Clusters ──────────────────────────────────────────────────────────────────
router.get("/structure/clusters", async (req, res): Promise<void> => {
  const threshold = Math.min(0.99, Math.max(0.5, parseFloat((req.query.threshold as string) ?? "0.85")));
  const method = (req.query.method as string) ?? "tfidf";
  try {
    const result = method === "semantic"
      ? await getSemanticClusters(threshold)
      : await getClusters(threshold);
    res.json({ threshold, method, ...result });
  } catch (err) {
    console.error("[structure/clusters]", err);
    res.status(500).json({ error: "Computation failed" });
  }
});

// ── Similar modules ───────────────────────────────────────────────────────────
router.get("/structure/similar/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const threshold = Math.min(0.99, Math.max(0.3, parseFloat((req.query.threshold as string) ?? "0.70")));
  const method = (req.query.method as string) ?? "tfidf";
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  try {
    if (method === "compare") {
      const { similar: tfidfSimilar } = await getSimilarModules(id, threshold);
      const comparison = await compareSimilarModules(id, threshold, tfidfSimilar);
      res.json({ threshold, method, ...comparison });
    } else if (method === "semantic") {
      res.json({ threshold, method, ...(await getSemanticSimilarModules(id, threshold)) });
    } else {
      res.json({ threshold, method, ...(await getSimilarModules(id, threshold)) });
    }
  } catch (err) {
    console.error("[structure/similar]", err);
    res.status(500).json({ error: "Computation failed" });
  }
});

// ── Outliers ──────────────────────────────────────────────────────────────────
router.get("/structure/outliers", async (req, res): Promise<void> => {
  const limit = Math.min(200, parseInt((req.query.limit as string) ?? "100", 10));
  const method = (req.query.method as string) ?? "tfidf";
  try {
    const outliers = method === "semantic"
      ? await getSemanticOutliers(limit)
      : await getOutliers(limit);
    res.json({ method, outliers });
  } catch (err) {
    console.error("[structure/outliers]", err);
    res.status(500).json({ error: "Computation failed" });
  }
});

// ── Network ───────────────────────────────────────────────────────────────────
router.get("/structure/network/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const threshold = Math.min(0.99, Math.max(0.3, parseFloat((req.query.threshold as string) ?? "0.65")));
  const method = (req.query.method as string) ?? "tfidf";
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  try {
    const result = method === "semantic"
      ? await getSemanticNetwork(id, threshold)
      : await getNetwork(id, threshold);
    res.json({ threshold, method, ...result });
  } catch (err) {
    console.error("[structure/network]", err);
    res.status(500).json({ error: "Computation failed" });
  }
});

export default router;
