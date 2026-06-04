import { db, moduleReviewsTable } from "@workspace/db";

// ── Stop words ───────────────────────────────────────────────────────────────
const STOP_WORDS = new Set([
  "the","a","an","and","or","but","in","on","at","to","for","of","with","by",
  "from","is","are","was","were","be","been","being","have","has","had","do",
  "does","did","will","would","could","should","may","might","shall","can",
  "that","this","these","those","it","its","they","them","their","we","our",
  "you","your","he","she","his","her","as","if","when","where","which","who",
  "how","what","not","no","nor","so","yet","both","either","neither","also",
  // domain stop words
  "module","student","students","learning","outcome","outcomes","demonstrate",
  "ability","able","knowledge","skill","skills","apply","use","develop","work",
  "identify","analyse","analyze","evaluate","create","describe","explain",
  "understand","understanding","including","based","range","various","specific",
  "different","upon","within","between","through","using","basic","key","main",
  "core","relevant","appropriate","effectively","critically","upon","context",
  "range","include","includes","such","each","other","own","well","new","how",
  "will","when","given","make","take","need","discuss","present","provide",
  "examine","review","consider","illustrate","show","demonstrate","write",
  "research","study","complete","design","problem","approach","solution","data",
  "information","material","area","process","method","activity","practice",
  "performance","professional","programme","course","semester","year","level",
  "subject","field","topic","content","unit","section","part","focus","aim",
]);

// ── Tokenise ──────────────────────────────────────────────────────────────────
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

// ── Types ─────────────────────────────────────────────────────────────────────
type SparseVec = Map<string, number>;

interface ModuleVector {
  idx: number;
  id: number;
  moduleCode: string;
  moduleTitle: string;
  vec: SparseVec;
}

export interface SimilarModule {
  id: number;
  moduleCode: string;
  moduleTitle: string;
  similarity: number;
}

export interface ClusterGroup {
  id: string;
  size: number;
  avgSimilarity: number;
  modules: SimilarModule[];
}

export interface OutlierResult {
  id: number;
  moduleCode: string;
  moduleTitle: string;
  maxSimilarity: number;
}

export interface NetworkData {
  nodes: Array<{ id: number; moduleCode: string; moduleTitle: string; isCenter: boolean }>;
  edges: Array<{ source: number; target: number; similarity: number }>;
}

// ── Cache ─────────────────────────────────────────────────────────────────────
interface CacheState {
  vectors: ModuleVector[];
  invertedIndex: Map<string, number[]>;
  totalModules: number;
  computedAt: Date;
}

let _cache: CacheState | null = null;

export function invalidateCache(): void {
  _cache = null;
}

// ── Build TF-IDF vectors ──────────────────────────────────────────────────────
function buildVectors(
  modules: Array<{ id: number; moduleCode: string; moduleTitle: string; learningOutcomes: string | null }>
): { vectors: ModuleVector[]; invertedIndex: Map<string, number[]> } {
  const docs = modules
    .filter((m) => m.learningOutcomes && m.learningOutcomes.trim().length > 20)
    .map((m) => ({ ...m, tokens: tokenize(m.learningOutcomes!) }))
    .filter((m) => m.tokens.length > 0);

  const N = docs.length;

  // Document frequency
  const df = new Map<string, number>();
  for (const doc of docs) {
    for (const term of new Set(doc.tokens)) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }

  // Max DF threshold: skip terms appearing in > 40% of docs (they're noise)
  const maxDf = Math.max(3, Math.floor(N * 0.4));

  // IDF (smoothed)
  const idf = new Map<string, number>();
  for (const [term, freq] of df) {
    if (freq <= maxDf) {
      idf.set(term, Math.log((N + 1) / (freq + 1)) + 1);
    }
  }

  const vectors: ModuleVector[] = [];
  const invertedIndex = new Map<string, number[]>();

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];

    // TF count
    const tf = new Map<string, number>();
    for (const t of doc.tokens) {
      if (idf.has(t)) tf.set(t, (tf.get(t) ?? 0) + 1);
    }
    if (tf.size === 0) continue;

    // TF-IDF raw
    const raw = new Map<string, number>();
    let norm = 0;
    for (const [term, count] of tf) {
      const val = (count / doc.tokens.length) * idf.get(term)!;
      raw.set(term, val);
      norm += val * val;
    }
    norm = Math.sqrt(norm);
    if (norm === 0) continue;

    // Normalise → unit vector
    const vec: SparseVec = new Map();
    for (const [term, val] of raw) {
      vec.set(term, val / norm);
    }

    const idx = vectors.length;
    vectors.push({ idx, id: doc.id, moduleCode: doc.moduleCode, moduleTitle: doc.moduleTitle, vec });

    for (const term of vec.keys()) {
      const list = invertedIndex.get(term);
      if (list) list.push(idx);
      else invertedIndex.set(term, [idx]);
    }
  }

  return { vectors, invertedIndex };
}

// ── Cosine similarity (unit vectors) ─────────────────────────────────────────
function cosineSim(a: SparseVec, b: SparseVec): number {
  let dot = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const [term, val] of small) {
    const bv = large.get(term);
    if (bv !== undefined) dot += val * bv;
  }
  return Math.min(dot, 1.0);
}

// ── Candidate pairs via inverted index ────────────────────────────────────────
function* candidatePairs(
  vectors: ModuleVector[],
  invertedIndex: Map<string, number[]>,
  targetIdx?: number
): Generator<[number, number]> {
  const seen = new Set<string>();

  if (targetIdx !== undefined) {
    // Pairs involving a specific vector
    for (const term of vectors[targetIdx].vec.keys()) {
      for (const other of invertedIndex.get(term) ?? []) {
        if (other === targetIdx) continue;
        const key = `${Math.min(targetIdx, other)}_${Math.max(targetIdx, other)}`;
        if (!seen.has(key)) {
          seen.add(key);
          yield [targetIdx, other];
        }
      }
    }
  } else {
    // All candidate pairs
    for (const docs of invertedIndex.values()) {
      if (docs.length < 2 || docs.length > 1500) continue; // skip very frequent terms
      for (let i = 0; i < docs.length; i++) {
        for (let j = i + 1; j < docs.length; j++) {
          const key = `${docs[i]}_${docs[j]}`;
          if (!seen.has(key)) {
            seen.add(key);
            yield [docs[i], docs[j]];
          }
        }
      }
    }
  }
}

// ── Ensure cache ──────────────────────────────────────────────────────────────
async function ensureCache(): Promise<CacheState> {
  if (_cache) return _cache;

  const all = await db
    .select({
      id: moduleReviewsTable.id,
      moduleCode: moduleReviewsTable.moduleCode,
      moduleTitle: moduleReviewsTable.moduleTitle,
      learningOutcomes: moduleReviewsTable.learningOutcomes,
    })
    .from(moduleReviewsTable);

  const { vectors, invertedIndex } = buildVectors(all);

  _cache = {
    vectors,
    invertedIndex,
    totalModules: all.length,
    computedAt: new Date(),
  };

  return _cache;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getOverview() {
  const c = await ensureCache();
  return {
    totalModules: c.totalModules,
    analyzableModules: c.vectors.length,
    computedAt: c.computedAt,
  };
}

export async function getSimilarModules(
  moduleId: number,
  threshold: number
): Promise<{ module: SimilarModule | null; similar: SimilarModule[] }> {
  const c = await ensureCache();
  const target = c.vectors.find((v) => v.id === moduleId);
  if (!target) return { module: null, similar: [] };

  const similar: SimilarModule[] = [];
  for (const [a, b] of candidatePairs(c.vectors, c.invertedIndex, target.idx)) {
    const other = a === target.idx ? b : a;
    const sim = cosineSim(target.vec, c.vectors[other].vec);
    if (sim >= threshold) {
      const v = c.vectors[other];
      similar.push({ id: v.id, moduleCode: v.moduleCode, moduleTitle: v.moduleTitle, similarity: Math.round(sim * 1000) / 1000 });
    }
  }
  similar.sort((a, b) => b.similarity - a.similarity);

  return {
    module: { id: target.id, moduleCode: target.moduleCode, moduleTitle: target.moduleTitle, similarity: 1.0 },
    similar,
  };
}

export async function getClusters(
  threshold: number
): Promise<{ clusters: ClusterGroup[]; singletonCount: number }> {
  const c = await ensureCache();
  const n = c.vectors.length;

  // Build adjacency list
  const adj = new Array<Set<number>>(n).fill(null!).map(() => new Set<number>());

  for (const [i, j] of candidatePairs(c.vectors, c.invertedIndex)) {
    const sim = cosineSim(c.vectors[i].vec, c.vectors[j].vec);
    if (sim >= threshold) {
      adj[i].add(j);
      adj[j].add(i);
    }
  }

  // Connected components via BFS
  const visited = new Uint8Array(n);
  const clusters: ClusterGroup[] = [];
  let singletonCount = 0;

  for (let start = 0; start < n; start++) {
    if (visited[start]) continue;
    visited[start] = 1;

    if (adj[start].size === 0) {
      singletonCount++;
      continue;
    }

    const component: number[] = [start];
    const queue = [start];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const nb of adj[cur]) {
        if (!visited[nb]) {
          visited[nb] = 1;
          component.push(nb);
          queue.push(nb);
        }
      }
    }

    // Avg similarity (sample up to 15 pairs)
    const sample = component.slice(0, 15);
    let simSum = 0, simCount = 0;
    for (let i = 0; i < sample.length; i++) {
      for (let j = i + 1; j < sample.length; j++) {
        simSum += cosineSim(c.vectors[sample[i]].vec, c.vectors[sample[j]].vec);
        simCount++;
      }
    }
    const avgSimilarity = simCount > 0 ? Math.round((simSum / simCount) * 100) / 100 : threshold;

    clusters.push({
      id: `cluster_${clusters.length + 1}`,
      size: component.length,
      avgSimilarity,
      modules: component.map((idx) => ({
        id: c.vectors[idx].id,
        moduleCode: c.vectors[idx].moduleCode,
        moduleTitle: c.vectors[idx].moduleTitle,
        similarity: avgSimilarity,
      })),
    });
  }

  clusters.sort((a, b) => b.size - a.size);
  return { clusters, singletonCount };
}

export async function getOutliers(
  limit: number
): Promise<OutlierResult[]> {
  const c = await ensureCache();
  const n = c.vectors.length;

  const maxSim = new Float32Array(n);

  for (const [i, j] of candidatePairs(c.vectors, c.invertedIndex)) {
    const sim = cosineSim(c.vectors[i].vec, c.vectors[j].vec);
    if (sim > maxSim[i]) maxSim[i] = sim;
    if (sim > maxSim[j]) maxSim[j] = sim;
  }

  const results: OutlierResult[] = c.vectors.map((v, idx) => ({
    id: v.id,
    moduleCode: v.moduleCode,
    moduleTitle: v.moduleTitle,
    maxSimilarity: Math.round(maxSim[idx] * 1000) / 1000,
  }));

  results.sort((a, b) => a.maxSimilarity - b.maxSimilarity);
  return results.slice(0, limit);
}

export async function getNetwork(moduleId: number, threshold: number): Promise<NetworkData> {
  const c = await ensureCache();
  const target = c.vectors.find((v) => v.id === moduleId);
  if (!target) return { nodes: [], edges: [] };

  const neighborIdxs: Array<{ idx: number; sim: number }> = [];
  for (const [a, b] of candidatePairs(c.vectors, c.invertedIndex, target.idx)) {
    const other = a === target.idx ? b : a;
    const sim = cosineSim(target.vec, c.vectors[other].vec);
    if (sim >= threshold) {
      neighborIdxs.push({ idx: other, sim: Math.round(sim * 1000) / 1000 });
    }
  }
  neighborIdxs.sort((a, b) => b.sim - a.sim);
  const limited = neighborIdxs.slice(0, 40);

  const edges: NetworkData["edges"] = limited.map(({ idx, sim }) => ({
    source: moduleId,
    target: c.vectors[idx].id,
    similarity: sim,
  }));

  // Edges between neighbors
  const neighborSet = new Set(limited.map((n) => n.idx));
  const processed = new Set<string>();
  for (const ni of limited) {
    for (const term of c.vectors[ni.idx].vec.keys()) {
      for (const other of c.invertedIndex.get(term) ?? []) {
        if (!neighborSet.has(other) || other === ni.idx) continue;
        const key = `${Math.min(ni.idx, other)}_${Math.max(ni.idx, other)}`;
        if (processed.has(key)) continue;
        processed.add(key);
        const sim = cosineSim(c.vectors[ni.idx].vec, c.vectors[other].vec);
        if (sim >= threshold) {
          edges.push({ source: c.vectors[ni.idx].id, target: c.vectors[other].id, similarity: Math.round(sim * 1000) / 1000 });
        }
      }
    }
  }

  const nodes: NetworkData["nodes"] = [
    { id: target.id, moduleCode: target.moduleCode, moduleTitle: target.moduleTitle, isCenter: true },
    ...limited.map(({ idx }) => ({
      id: c.vectors[idx].id,
      moduleCode: c.vectors[idx].moduleCode,
      moduleTitle: c.vectors[idx].moduleTitle,
      isCenter: false,
    })),
  ];

  return { nodes, edges };
}
