import OpenAI from "openai";
import { eq, isNull } from "drizzle-orm";
import { db, moduleReviewsTable } from "@workspace/db";
import type { SimilarModule, ClusterGroup, OutlierResult, NetworkData } from "./similarity.js";

export type { SimilarModule, ClusterGroup, OutlierResult, NetworkData };

// ── OpenAI client (same proxy as aiService.ts) ────────────────────────────────
if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || !process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
  throw new Error("Missing AI_INTEGRATIONS_OPENAI_BASE_URL or AI_INTEGRATIONS_OPENAI_API_KEY");
}

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

const MODEL = "gpt-4o-mini";

// ── Academic concept dimensions (30 interpretable axes) ───────────────────────
// Each dimension captures a distinct academic domain or competency.
// Modules are scored 0.0–1.0 per dimension by the LLM.
export const CONCEPT_DIMS = [
  "quantitative_analysis",   // mathematics, statistics, numerical reasoning
  "critical_thinking",       // argumentation, logic, evaluative reasoning
  "written_communication",   // academic writing, essays, reports
  "oral_communication",      // presentations, debate, spoken discourse
  "research_methods",        // methodology, literature review, data collection
  "ethics_values",           // moral philosophy, professional ethics, integrity
  "digital_technology",      // computing, software, digital tools and systems
  "data_analysis",           // data science, analytics, interpretation of datasets
  "natural_sciences",        // biology, chemistry, physics, ecology
  "social_sciences",         // sociology, psychology, anthropology, political science
  "history_heritage",        // historical analysis, cultural heritage, archive study
  "economics_finance",       // economic theory, financial literacy, accounting
  "management_leadership",   // organisational behaviour, strategy, team leadership
  "health_wellbeing",        // healthcare, mental health, physical wellbeing
  "law_governance",          // legal frameworks, policy analysis, regulation
  "sustainability",          // environmental sustainability, SDGs, ecological thinking
  "global_perspectives",     // international relations, cultural competency, globalisation
  "philosophy",              // metaphysics, epistemology, logic, aesthetics
  "language_linguistics",    // linguistics, applied languages, translation
  "education_pedagogy",      // learning theory, curriculum, teaching practice
  "arts_humanities",         // literature, cultural studies, visual/performing arts
  "engineering_design",      // engineering principles, technical design, systems
  "entrepreneurship",        // innovation, start-ups, venture creation
  "professional_practice",   // workplace skills, professional identity, industry norms
  "community_society",       // civic engagement, social justice, community development
  "media_communication",     // journalism, media literacy, public relations
  "sport_performance",       // physical education, sport science, coaching
  "creative_expression",     // creative writing, art-making, design thinking
  "practical_lab_skills",    // laboratory, clinical, studio, field-based practice
  "interdisciplinary",       // cross-disciplinary integration, systems thinking
] as const;

export type ConceptDim = typeof CONCEPT_DIMS[number];
const DIM_COUNT = CONCEPT_DIMS.length; // 30

// ── Vector math ───────────────────────────────────────────────────────────────
function dotSim(a: Float32Array, b: Float32Array): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : Math.min(dot / denom, 1.0);
}

// ── Cache ─────────────────────────────────────────────────────────────────────
interface SemanticVector {
  idx: number; id: number; moduleCode: string; moduleTitle: string; vec: Float32Array;
}

interface SemanticCache { vectors: SemanticVector[]; computedAt: Date; }

let _cache: SemanticCache | null = null;
export function invalidateSemanticCache(): void { _cache = null; }

async function loadVectors(): Promise<SemanticVector[]> {
  const rows = await db.select({
    id: moduleReviewsTable.id,
    moduleCode: moduleReviewsTable.moduleCode,
    moduleTitle: moduleReviewsTable.moduleTitle,
    embedding: moduleReviewsTable.embedding,
  }).from(moduleReviewsTable);

  const vectors: SemanticVector[] = [];
  for (const row of rows) {
    if (!row.embedding) continue;
    try {
      const arr = JSON.parse(row.embedding) as number[];
      if (arr.length !== DIM_COUNT) continue; // skip old-format embeddings
      vectors.push({ idx: vectors.length, id: row.id, moduleCode: row.moduleCode, moduleTitle: row.moduleTitle, vec: new Float32Array(arr) });
    } catch { /* skip malformed */ }
  }
  return vectors;
}

async function ensureCache(): Promise<SemanticCache> {
  if (_cache) return _cache;
  const vectors = await loadVectors();
  _cache = { vectors, computedAt: new Date() };
  return _cache;
}

// ── Generation state ──────────────────────────────────────────────────────────
let _generating = false;
let _genProgress = { processed: 0, total: 0 };

// ── Status ────────────────────────────────────────────────────────────────────
export async function getEmbeddingStatus() {
  const rows = await db.select({
    id: moduleReviewsTable.id,
    embedding: moduleReviewsTable.embedding,
    learningOutcomes: moduleReviewsTable.learningOutcomes,
  }).from(moduleReviewsTable);

  const total = rows.length;
  const withEmbedding = rows.filter((r) => {
    if (!r.embedding) return false;
    try { const arr = JSON.parse(r.embedding) as number[]; return arr.length === DIM_COUNT; } catch { return false; }
  }).length;
  const needsEmbedding = rows.filter(
    (r) => !r.embedding && r.learningOutcomes && r.learningOutcomes.trim().length > 20
  ).length;

  return { total, withEmbedding, needsEmbedding, generating: _generating, progress: _genProgress };
}

// ── LLM concept scoring ───────────────────────────────────────────────────────
const BATCH_SIZE = 5; // modules per LLM call

function buildScoringPrompt(modules: Array<{ id: number; text: string }>): string {
  const dimList = CONCEPT_DIMS.map((d, i) => `${i + 1}. ${d.replace(/_/g, " ")}`).join("\n");

  const moduleBlocks = modules.map((m, i) =>
    `MODULE ${i + 1}:\n${m.text.trim().slice(0, 1500)}`
  ).join("\n\n---\n\n");

  return `You are an academic curriculum analyst. Score each module's learning outcomes against 30 concept dimensions.

For each dimension, assign a score from 0.0 to 1.0:
- 0.0 = Not present
- 0.3 = Peripherally mentioned  
- 0.6 = Moderately present
- 1.0 = Strongly central

DIMENSIONS:
${dimList}

${moduleBlocks}

Return ONLY a JSON array of arrays (one inner array per module, each with exactly 30 numbers in the same order as the dimensions above).
Example for 2 modules: [[0.0, 0.8, 0.2, ...], [0.5, 0.0, 0.9, ...]]
Do not include any explanation, only the JSON array.`;
}

async function scoreBatch(
  modules: Array<{ id: number; text: string }>
): Promise<number[][]> {
  const prompt = buildScoringPrompt(modules);

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_completion_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.choices[0]?.message?.content ?? "";
  const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  const parsed = JSON.parse(jsonStr) as number[][];
  if (!Array.isArray(parsed) || parsed.length !== modules.length) {
    throw new Error(`Expected ${modules.length} score arrays, got ${parsed.length}`);
  }
  for (const row of parsed) {
    if (!Array.isArray(row) || row.length !== DIM_COUNT) {
      throw new Error(`Expected ${DIM_COUNT} scores per module, got ${row.length}`);
    }
  }
  return parsed;
}

// ── Trigger generation (background) ──────────────────────────────────────────
export async function startEmbeddingGeneration(): Promise<{ started: boolean; message: string }> {
  if (_generating) return { started: false, message: "Generation already in progress" };

  const rows = await db.select({
    id: moduleReviewsTable.id,
    moduleCode: moduleReviewsTable.moduleCode,
    learningOutcomes: moduleReviewsTable.learningOutcomes,
  }).from(moduleReviewsTable).where(isNull(moduleReviewsTable.embedding));

  const toProcess = rows.filter(
    (r) => r.learningOutcomes && r.learningOutcomes.trim().length > 20
  );

  if (toProcess.length === 0) return { started: false, message: "All modules already have embeddings" };

  _generating = true;
  _genProgress = { processed: 0, total: toProcess.length };

  runGeneration(toProcess).catch((err) => {
    console.error("[semantic] generation error:", err);
    _generating = false;
  });

  return { started: true, message: `Generating concept vectors for ${toProcess.length} modules` };
}

async function runGeneration(
  modules: Array<{ id: number; moduleCode: string; learningOutcomes: string | null }>
): Promise<void> {
  try {
    for (let i = 0; i < modules.length; i += BATCH_SIZE) {
      const batch = modules.slice(i, i + BATCH_SIZE);
      const batchInput = batch.map((m) => ({
        id: m.id,
        text: `${m.moduleCode}\n${m.learningOutcomes ?? ""}`,
      }));

      let scores: number[][];
      try {
        scores = await scoreBatch(batchInput);
      } catch (err) {
        console.error(`[semantic] batch ${i}–${i + BATCH_SIZE} failed, skipping:`, err);
        _genProgress.processed += batch.length;
        continue;
      }

      for (let j = 0; j < batch.length; j++) {
        const embedding = JSON.stringify(scores[j]);
        await db.update(moduleReviewsTable)
          .set({ embedding })
          .where(eq(moduleReviewsTable.id, batch[j].id));
      }

      _genProgress.processed += batch.length;
    }

    invalidateSemanticCache();
  } finally {
    _generating = false;
  }
}

// ── Pair generator for O(n²) ──────────────────────────────────────────────────
function* allPairs(n: number): Generator<[number, number]> {
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) yield [i, j];
}

// ── Public similarity API ─────────────────────────────────────────────────────

export async function getSemanticOverview() {
  const status = await getEmbeddingStatus();
  const c = await ensureCache();
  return {
    totalModules: status.total,
    analyzableModules: c.vectors.length,
    withEmbedding: status.withEmbedding,
    needsEmbedding: status.needsEmbedding,
    generating: status.generating,
    progress: status.progress,
    computedAt: c.computedAt,
  };
}

export async function getSemanticSimilarModules(
  moduleId: number, threshold: number
): Promise<{ module: SimilarModule | null; similar: SimilarModule[] }> {
  const c = await ensureCache();
  const target = c.vectors.find((v) => v.id === moduleId);
  if (!target) return { module: null, similar: [] };

  const similar: SimilarModule[] = [];
  for (const v of c.vectors) {
    if (v.id === moduleId) continue;
    const sim = dotSim(target.vec, v.vec);
    if (sim >= threshold) {
      similar.push({ id: v.id, moduleCode: v.moduleCode, moduleTitle: v.moduleTitle, similarity: Math.round(sim * 1000) / 1000 });
    }
  }
  similar.sort((a, b) => b.similarity - a.similarity);

  return {
    module: { id: target.id, moduleCode: target.moduleCode, moduleTitle: target.moduleTitle, similarity: 1.0 },
    similar,
  };
}

export async function getSemanticClusters(
  threshold: number
): Promise<{ clusters: ClusterGroup[]; singletonCount: number }> {
  const c = await ensureCache();
  const n = c.vectors.length;
  if (n === 0) return { clusters: [], singletonCount: 0 };

  const adj = new Array<Set<number>>(n).fill(null!).map(() => new Set<number>());
  for (const [i, j] of allPairs(n)) {
    const sim = dotSim(c.vectors[i].vec, c.vectors[j].vec);
    if (sim >= threshold) { adj[i].add(j); adj[j].add(i); }
  }

  const visited = new Uint8Array(n);
  const clusters: ClusterGroup[] = [];
  let singletonCount = 0;

  for (let start = 0; start < n; start++) {
    if (visited[start]) continue;
    visited[start] = 1;
    if (adj[start].size === 0) { singletonCount++; continue; }

    const component: number[] = [start];
    const queue = [start];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const nb of adj[cur]) {
        if (!visited[nb]) { visited[nb] = 1; component.push(nb); queue.push(nb); }
      }
    }

    const sample = component.slice(0, 15);
    let simSum = 0, simCount = 0;
    for (let i = 0; i < sample.length; i++) {
      for (let j = i + 1; j < sample.length; j++) {
        simSum += dotSim(c.vectors[sample[i]].vec, c.vectors[sample[j]].vec);
        simCount++;
      }
    }
    const avgSimilarity = simCount > 0 ? Math.round((simSum / simCount) * 100) / 100 : threshold;

    clusters.push({
      id: `sem_cluster_${clusters.length + 1}`,
      size: component.length, avgSimilarity,
      modules: component.map((idx) => ({
        id: c.vectors[idx].id, moduleCode: c.vectors[idx].moduleCode,
        moduleTitle: c.vectors[idx].moduleTitle, similarity: avgSimilarity,
      })),
    });
  }

  clusters.sort((a, b) => b.size - a.size);
  return { clusters, singletonCount };
}

export async function getSemanticOutliers(limit: number): Promise<OutlierResult[]> {
  const c = await ensureCache();
  const n = c.vectors.length;
  if (n === 0) return [];

  const maxSim = new Float32Array(n);
  for (const [i, j] of allPairs(n)) {
    const sim = dotSim(c.vectors[i].vec, c.vectors[j].vec);
    if (sim > maxSim[i]) maxSim[i] = sim;
    if (sim > maxSim[j]) maxSim[j] = sim;
  }

  const results: OutlierResult[] = c.vectors.map((v, idx) => ({
    id: v.id, moduleCode: v.moduleCode, moduleTitle: v.moduleTitle,
    maxSimilarity: Math.round(maxSim[idx] * 1000) / 1000,
  }));

  results.sort((a, b) => a.maxSimilarity - b.maxSimilarity);
  return results.slice(0, limit);
}

export async function getSemanticNetwork(moduleId: number, threshold: number): Promise<NetworkData> {
  const c = await ensureCache();
  const target = c.vectors.find((v) => v.id === moduleId);
  if (!target) return { nodes: [], edges: [] };

  const neighborIdxs: Array<{ idx: number; sim: number }> = [];
  for (const v of c.vectors) {
    if (v.id === moduleId) continue;
    const sim = dotSim(target.vec, v.vec);
    if (sim >= threshold) neighborIdxs.push({ idx: v.idx, sim: Math.round(sim * 1000) / 1000 });
  }
  neighborIdxs.sort((a, b) => b.sim - a.sim);
  const limited = neighborIdxs.slice(0, 40);

  const edges: NetworkData["edges"] = limited.map(({ idx, sim }) => ({
    source: moduleId, target: c.vectors[idx].id, similarity: sim,
  }));

  const processed = new Set<string>();
  for (const ni of limited) {
    for (const nj of limited) {
      if (ni.idx >= nj.idx) continue;
      const key = `${ni.idx}_${nj.idx}`;
      if (processed.has(key)) continue;
      processed.add(key);
      const sim = dotSim(c.vectors[ni.idx].vec, c.vectors[nj.idx].vec);
      if (sim >= threshold) {
        edges.push({ source: c.vectors[ni.idx].id, target: c.vectors[nj.idx].id, similarity: Math.round(sim * 1000) / 1000 });
      }
    }
  }

  const nodes: NetworkData["nodes"] = [
    { id: target.id, moduleCode: target.moduleCode, moduleTitle: target.moduleTitle, isCenter: true },
    ...limited.map(({ idx }) => ({
      id: c.vectors[idx].id, moduleCode: c.vectors[idx].moduleCode,
      moduleTitle: c.vectors[idx].moduleTitle, isCenter: false,
    })),
  ];

  return { nodes, edges };
}

// ── Compare TF-IDF vs Semantic ────────────────────────────────────────────────
export async function compareSimilarModules(
  moduleId: number, threshold: number, tfidfSimilar: SimilarModule[]
): Promise<{
  tfidf: SimilarModule[]; semantic: SimilarModule[];
  onlyTfidf: SimilarModule[]; onlySemantic: SimilarModule[]; inBoth: SimilarModule[];
}> {
  const { similar: semantic } = await getSemanticSimilarModules(moduleId, threshold);
  const tfidfIds = new Set(tfidfSimilar.map((m) => m.id));
  const semanticIds = new Set(semantic.map((m) => m.id));

  return {
    tfidf: tfidfSimilar, semantic,
    onlyTfidf: tfidfSimilar.filter((m) => !semanticIds.has(m.id)),
    onlySemantic: semantic.filter((m) => !tfidfIds.has(m.id)),
    inBoth: tfidfSimilar.filter((m) => semanticIds.has(m.id)),
  };
}
