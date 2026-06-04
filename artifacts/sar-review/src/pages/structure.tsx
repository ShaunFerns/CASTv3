import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  GitBranch, Search, Loader2, RefreshCw, Info, ChevronDown, ChevronRight,
  Network, AlertTriangle, Layers, BarChart3, Sparkles, Zap, ArrowLeftRight,
  CheckCircle2,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

// ── API helpers ───────────────────────────────────────────────────────────────
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`/api${path}`, init);
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  return r.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Method = "tfidf" | "semantic" | "compare";

interface ModuleItem { id: number; moduleCode: string; moduleTitle: string; }

interface Overview {
  totalModules: number; analyzableModules: number; computedAt: string | null;
  withEmbedding?: number; needsEmbedding?: number; generating?: boolean;
  progress?: { processed: number; total: number };
}

interface EmbeddingStatus {
  total: number; withEmbedding: number; needsEmbedding: number;
  generating: boolean; progress: { processed: number; total: number };
}

interface SimilarModule { id: number; moduleCode: string; moduleTitle: string; similarity: number; }
interface ClusterGroup { id: string; size: number; avgSimilarity: number; modules: SimilarModule[]; }
interface ClustersResult { threshold: number; clusters: ClusterGroup[]; singletonCount: number; }
interface SimilarResult { module: SimilarModule | null; similar: SimilarModule[]; }

interface CompareResult {
  module: SimilarModule | null;
  tfidf: SimilarModule[];
  semantic: SimilarModule[];
  onlyTfidf: SimilarModule[];
  onlySemantic: SimilarModule[];
  inBoth: SimilarModule[];
}

interface OutlierResult { id: number; moduleCode: string; moduleTitle: string; maxSimilarity: number; }

interface NetworkData {
  nodes: Array<{ id: number; moduleCode: string; moduleTitle: string; isCenter: boolean }>;
  edges: Array<{ source: number; target: number; similarity: number }>;
}

// ── Method selector ───────────────────────────────────────────────────────────
const METHOD_OPTIONS: { value: Method; label: string; icon: React.ReactNode; desc: string }[] = [
  {
    value: "tfidf",
    label: "TF-IDF",
    icon: <Zap className="h-3.5 w-3.5" />,
    desc: "Keyword-based similarity — finds modules that share the same language in their learning outcomes.",
  },
  {
    value: "semantic",
    label: "Semantic",
    icon: <Sparkles className="h-3.5 w-3.5" />,
    desc: "Concept-based similarity — scores each module across 30 academic dimensions using AI, then compares those concept profiles.",
  },
  {
    value: "compare",
    label: "Compare Both",
    icon: <ArrowLeftRight className="h-3.5 w-3.5" />,
    desc: "Side-by-side comparison — surfaces hidden conceptual overlap and modules linked only by shared language.",
  },
];

function MethodSelector({ value, onChange }: { value: Method; onChange: (m: Method) => void }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm font-medium text-slate-600 shrink-0">Similarity method:</span>
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
        {METHOD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={[
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
              value === opt.value
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700",
            ].join(" ")}
          >
            {opt.icon}
            {opt.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-400 hidden sm:block">
        {METHOD_OPTIONS.find((o) => o.value === value)?.desc}
      </p>
    </div>
  );
}

// ── Embedding readiness banner ────────────────────────────────────────────────
function EmbeddingBanner({
  status, onGenerate, generating,
}: {
  status: EmbeddingStatus | undefined;
  onGenerate: () => void;
  generating: boolean;
}) {
  if (!status) return null;

  if (status.withEmbedding === 0 && status.needsEmbedding === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">No modules with learning outcomes found</p>
          <p className="text-amber-600 mt-0.5">Upload modules with learning outcomes to enable semantic analysis.</p>
        </div>
      </div>
    );
  }

  if (status.generating || generating) {
    const pct = status.progress.total > 0
      ? Math.round((status.progress.processed / status.progress.total) * 100)
      : 0;
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-4">
        <Loader2 className="h-5 w-5 text-blue-500 animate-spin shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-blue-800">Generating embeddings…</p>
          <div className="mt-1.5 h-1.5 bg-blue-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-blue-600 mt-1">
            {status.progress.processed} of {status.progress.total} modules processed
          </p>
        </div>
      </div>
    );
  }

  if (status.needsEmbedding > 0) {
    const hasSome = status.withEmbedding > 0;
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-4">
        <Sparkles className="h-5 w-5 text-blue-500 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-blue-800">
            {hasSome ? `${status.needsEmbedding} modules need embeddings` : "Generate semantic embeddings"}
          </p>
          <p className="text-xs text-blue-600 mt-0.5">
            {hasSome
              ? `${status.withEmbedding} already done. Click to score the remaining ${status.needsEmbedding}.`
              : `Semantic analysis scores each module across 30 academic concept dimensions using AI. Takes 3–5 minutes for ${status.needsEmbedding} modules — done once, then instant.`}
          </p>
        </div>
        <Button size="sm" onClick={onGenerate} className="shrink-0 text-white" style={{ backgroundColor: "#003865" }}>
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          Generate
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-3 text-sm">
      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
      <span className="text-emerald-700 font-medium">
        Embeddings ready for all {status.withEmbedding} modules
      </span>
    </div>
  );
}

// ── Shared controls ───────────────────────────────────────────────────────────
function ThresholdSlider({ value, onChange, label, min = 50, max = 99 }: {
  value: number; onChange: (v: number) => void; label: string; min?: number; max?: number;
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-slate-500 shrink-0">{label}</span>
      <Slider min={min} max={max} step={1} value={[value]} onValueChange={([v]) => onChange(v)} className="w-48" />
      <span className="text-sm font-semibold tabular-nums" style={{ color: "#003865" }}>{value}%</span>
    </div>
  );
}

function SimilarityBar({ value, color }: { value: number; color?: string }) {
  const pct = Math.round(value * 100);
  const c = color ?? (pct >= 85 ? "#003865" : pct >= 70 ? "#1d4ed8" : "#60a5fa");
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: c }} />
      </div>
      <span className="text-xs font-semibold tabular-nums" style={{ color: c }}>{pct}%</span>
    </div>
  );
}

function ModuleSearch({ modules, value, onChange, placeholder }: {
  modules: ModuleItem[]; value: ModuleItem | null;
  onChange: (m: ModuleItem | null) => void; placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = q.length >= 2
    ? modules.filter((m) =>
        m.moduleCode.toLowerCase().includes(q.toLowerCase()) ||
        m.moduleTitle.toLowerCase().includes(q.toLowerCase())
      ).slice(0, 30)
    : [];

  const display = value ? `${value.moduleCode} – ${value.moduleTitle}` : "";

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          className="pl-9"
          placeholder={placeholder ?? "Search by code or title…"}
          value={open ? q : display}
          onFocus={() => { setOpen(true); setQ(""); }}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {filtered.map((m) => (
            <button key={m.id} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0"
              onClick={() => { onChange(m); setOpen(false); setQ(""); }}
            >
              <span className="font-mono text-xs font-semibold text-slate-500 mr-2">{m.moduleCode}</span>
              <span className="text-sm text-slate-800">{m.moduleTitle}</span>
            </button>
          ))}
        </div>
      )}
      {open && q.length >= 2 && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-md px-4 py-3 text-sm text-slate-400">
          No modules match "{q}"
        </div>
      )}
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────
function OverviewTab({
  method, embStatus, onRefresh, isRefreshing,
}: {
  method: Method;
  embStatus: EmbeddingStatus | undefined;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  const { data, isLoading } = useQuery<Overview>({
    queryKey: ["structure-overview", method],
    queryFn: () => apiFetch(`/structure/overview?method=${method === "compare" ? "tfidf" : method}`),
  });

  const showEmbStats = method === "semantic" || method === "compare";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold" style={{ color: "#003865" }}>Analysis Overview</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {method === "tfidf" && "Similarity computed using TF-IDF cosine similarity on module learning outcomes."}
            {method === "semantic" && "Similarity computed using AI-generated semantic embeddings of learning outcomes."}
            {method === "compare" && "Combining TF-IDF keyword matching and semantic embeddings for richer insight."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={isRefreshing}>
          {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-slate-400 py-12 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" /> Building analysis…
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatCard label="Total modules" value={data.totalModules.toLocaleString()} sub="In the database" color="#003865" />
            <StatCard label="Analysed (TF-IDF)" value={data.analyzableModules.toLocaleString()} sub="Have learning outcomes" color="#1d4ed8" />
            {showEmbStats && embStatus ? (
              <StatCard label="Analysed (Semantic)" value={embStatus.withEmbedding.toLocaleString()} sub="Have embeddings" color="#047857" />
            ) : (
              <StatCard
                label="Coverage"
                value={data.totalModules > 0 ? `${Math.round((data.analyzableModules / data.totalModules) * 100)}%` : "—"}
                sub="Of portfolio analysed" color="#047857"
              />
            )}
          </div>
          {data.computedAt && (
            <p className="text-xs text-slate-400">Last computed: {new Date(data.computedAt).toLocaleString()}</p>
          )}
        </>
      ) : null}

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 space-y-3">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
          <div className="space-y-2 text-sm text-blue-800">
            <p className="font-semibold">How similarity methods differ</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-blue-700 text-xs">
              <div className="space-y-1">
                <p className="font-semibold flex items-center gap-1"><Zap className="h-3 w-3" /> TF-IDF</p>
                <p>Matches modules that use the <em>same words</em>. Fast, transparent, and easy to verify. May miss cross-disciplinary links where different vocabulary describes the same concept.</p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold flex items-center gap-1"><Sparkles className="h-3 w-3" /> Semantic</p>
                <p>Scores each module across 30 interpretable academic dimensions (e.g. critical thinking, data analysis, ethics) using AI. Modules are then compared by the <em>similarity of their concept profiles</em> — surfaces cross-disciplinary links that shared vocabulary cannot detect. One-time generation per module, then instant.</p>
              </div>
            </div>
            <p className="text-blue-600 text-xs mt-2">
              All outputs are intended to support academic discussion. Results should be interpreted with professional judgement.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</div>
      <div className="text-sm font-semibold text-slate-700 mt-1">{label}</div>
      <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
    </div>
  );
}

// ── Clusters ──────────────────────────────────────────────────────────────────
function ClustersTab({ method }: { method: Method }) {
  const [threshold, setThreshold] = useState(85);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [minSize, setMinSize] = useState(2);

  const effectiveMethod = method === "compare" ? "tfidf" : method;

  const qkeyA = ["structure-clusters", effectiveMethod, threshold];
  const qkeyB = ["structure-clusters", "semantic", threshold];

  const { data: dataA, isLoading: loadA, isFetching: fetchA } = useQuery<ClustersResult>({
    queryKey: qkeyA,
    queryFn: () => apiFetch(`/structure/clusters?threshold=${threshold / 100}&method=${effectiveMethod}`),
    staleTime: 5 * 60 * 1000,
  });

  const { data: dataB, isLoading: loadB, isFetching: fetchB } = useQuery<ClustersResult>({
    queryKey: qkeyB,
    queryFn: () => apiFetch(`/structure/clusters?threshold=${threshold / 100}&method=semantic`),
    staleTime: 5 * 60 * 1000,
    enabled: method === "compare",
  });

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const isLoading = loadA || (method === "compare" && loadB);
  const isFetching = fetchA || (method === "compare" && fetchB);

  const visibleA = dataA?.clusters.filter((c) => c.size >= minSize) ?? [];
  const visibleB = dataB?.clusters.filter((c) => c.size >= minSize) ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-6">
        <ThresholdSlider label="Similarity threshold" value={threshold} onChange={setThreshold} min={60} />
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500 shrink-0">Min. cluster size</span>
          <Slider min={2} max={10} step={1} value={[minSize]} onValueChange={([v]) => setMinSize(v)} className="w-32" />
          <span className="text-sm font-semibold tabular-nums" style={{ color: "#003865" }}>{minSize}+</span>
        </div>
      </div>

      {(isLoading || isFetching) && (
        <div className="flex items-center gap-2 text-slate-400 py-8 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" /> Computing clusters…
        </div>
      )}

      {method === "compare" && dataA && dataB && !isFetching ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-sm font-semibold text-slate-700">TF-IDF clusters</span>
              <span className="text-xs text-slate-400">{visibleA.length} found</span>
            </div>
            <ClusterList clusters={visibleA} expanded={expanded} toggle={toggle} prefix="A" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-3.5 w-3.5 text-violet-400" />
              <span className="text-sm font-semibold text-slate-700">Semantic clusters</span>
              <span className="text-xs text-slate-400">{visibleB.length} found</span>
            </div>
            <ClusterList clusters={visibleB} expanded={expanded} toggle={toggle} prefix="B" />
          </div>
        </div>
      ) : dataA && !isFetching ? (
        <>
          <div className="flex items-center gap-4 text-sm">
            <span className="font-semibold" style={{ color: "#003865" }}>
              {visibleA.length} cluster{visibleA.length !== 1 ? "s" : ""} found
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-500">{dataA.singletonCount.toLocaleString()} distinct modules</span>
          </div>
          {visibleA.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400">
              <p className="font-semibold">No clusters at this threshold</p>
              <p className="text-sm mt-1">Try lowering the similarity threshold to surface broader groupings.</p>
            </div>
          ) : (
            <ClusterList clusters={visibleA} expanded={expanded} toggle={toggle} prefix="C" />
          )}
        </>
      ) : null}
    </div>
  );
}

function ClusterList({ clusters, expanded, toggle, prefix }: {
  clusters: ClusterGroup[]; expanded: Set<string>; toggle: (id: string) => void; prefix: string;
}) {
  if (clusters.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
        <p className="font-semibold text-sm">No clusters found</p>
        <p className="text-xs mt-1">Adjust the threshold to reveal groupings.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {clusters.map((cluster) => {
        const key = `${prefix}_${cluster.id}`;
        return <ClusterCard key={key} cluster={cluster} expanded={expanded.has(key)} onToggle={() => toggle(key)} />;
      })}
    </div>
  );
}

function ClusterCard({ cluster, expanded, onToggle }: { cluster: ClusterGroup; expanded: boolean; onToggle: () => void }) {
  const avg = Math.round(cluster.avgSimilarity * 100);
  const preview = cluster.modules.slice(0, 3);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-50 transition-colors" onClick={onToggle}>
        <div className="flex items-center justify-center w-9 h-9 rounded-lg text-white text-sm font-bold shrink-0" style={{ backgroundColor: "#003865" }}>
          {cluster.size}
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-slate-800">
            {preview.map((m) => m.moduleCode).join(", ")}
            {cluster.size > 3 ? ` + ${cluster.size - 3} more` : ""}
          </span>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-slate-500">{cluster.size} modules</span>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-slate-500">Avg. similarity {avg}%</span>
          </div>
        </div>
        <SimilarityBar value={cluster.avgSimilarity} />
        {expanded ? <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />}
      </button>
      {expanded && (
        <div className="border-t border-slate-100 divide-y divide-slate-50">
          {cluster.modules.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-5 py-3">
              <span className="font-mono text-xs font-semibold text-slate-400 w-24 shrink-0">{m.moduleCode}</span>
              <span className="text-sm text-slate-700 flex-1">{m.moduleTitle}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Similar Modules ───────────────────────────────────────────────────────────
function SimilarTab({ modules, method }: { modules: ModuleItem[]; method: Method }) {
  const [threshold, setThreshold] = useState(70);
  const [selected, setSelected] = useState<ModuleItem | null>(null);

  const { data: tfidfData, isLoading: tfidfLoading } = useQuery<SimilarResult>({
    queryKey: ["structure-similar", selected?.id, threshold, "tfidf"],
    queryFn: () => apiFetch(`/structure/similar/${selected!.id}?threshold=${threshold / 100}&method=tfidf`),
    enabled: selected !== null && method !== "semantic",
    staleTime: 5 * 60 * 1000,
  });

  const { data: semData, isLoading: semLoading } = useQuery<SimilarResult>({
    queryKey: ["structure-similar", selected?.id, threshold, "semantic"],
    queryFn: () => apiFetch(`/structure/similar/${selected!.id}?threshold=${threshold / 100}&method=semantic`),
    enabled: selected !== null && method !== "tfidf",
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = tfidfLoading || semLoading;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-5">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Select a module</label>
          <ModuleSearch modules={modules} value={selected} onChange={setSelected} />
        </div>
        <ThresholdSlider label="Threshold" value={threshold} onChange={setThreshold} min={40} />
      </div>

      {!selected && (
        <div className="bg-white rounded-xl border border-slate-100 p-10 text-center text-slate-400">
          <Search className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">Search for a module above</p>
          <p className="text-sm mt-1">Type at least 2 characters to search by code or title.</p>
        </div>
      )}

      {selected && isLoading && (
        <div className="flex items-center gap-2 text-slate-400 py-8 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" /> Finding similar modules…
        </div>
      )}

      {selected && !isLoading && (
        <>
          <div className="bg-slate-50 rounded-xl border border-slate-200 px-5 py-4">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Selected module</div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-bold" style={{ color: "#003865" }}>{selected.moduleCode}</span>
              <span className="text-slate-700">{selected.moduleTitle}</span>
            </div>
          </div>

          {method === "compare" ? (
            <CompareSimilarView
              tfidf={tfidfData?.similar ?? []}
              semantic={semData?.similar ?? []}
              threshold={threshold}
            />
          ) : method === "semantic" ? (
            <SimilarList results={semData} threshold={threshold} label="Semantic" icon={<Sparkles className="h-3.5 w-3.5 text-violet-400" />} />
          ) : (
            <SimilarList results={tfidfData} threshold={threshold} label="TF-IDF" icon={<Zap className="h-3.5 w-3.5 text-slate-400" />} />
          )}
        </>
      )}
    </div>
  );
}

function SimilarList({ results, threshold, label, icon }: {
  results: SimilarResult | undefined; threshold: number; label: string; icon: React.ReactNode;
}) {
  if (!results) return null;
  if (results.module === null) {
    return (
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-5 text-sm text-amber-700">
        This module has no learning outcomes available for analysis.
      </div>
    );
  }
  if (results.similar.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-100 p-8 text-center text-slate-400">
        <p className="font-semibold">No related modules found</p>
        <p className="text-sm mt-1">No modules share ≥{threshold}% {label.toLowerCase()} similarity. Try lowering the threshold.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        {icon}
        <span className="font-semibold text-slate-700">{results.similar.length}</span>
        <span className="text-slate-500">module{results.similar.length !== 1 ? "s" : ""} with ≥{threshold}% similarity</span>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {results.similar.map((m) => (
          <div key={m.id} className="flex items-center gap-4 px-5 py-3.5">
            <span className="font-mono text-xs font-semibold text-slate-400 w-24 shrink-0">{m.moduleCode}</span>
            <span className="text-sm text-slate-700 flex-1">{m.moduleTitle}</span>
            <SimilarityBar value={m.similarity} />
          </div>
        ))}
      </div>
    </div>
  );
}

function CompareSimilarView({ tfidf, semantic, threshold }: {
  tfidf: SimilarModule[]; semantic: SimilarModule[]; threshold: number;
}) {
  const tfidfIds = new Set(tfidf.map((m) => m.id));
  const semanticIds = new Set(semantic.map((m) => m.id));
  const inBoth = tfidf.filter((m) => semanticIds.has(m.id));
  const onlyTfidf = tfidf.filter((m) => !semanticIds.has(m.id));
  const onlySemantic = semantic.filter((m) => !tfidfIds.has(m.id));

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold" style={{ color: "#003865" }}>{inBoth.length}</div>
          <div className="text-xs font-semibold text-slate-600 mt-1">Strong similarity</div>
          <div className="text-xs text-slate-400 mt-0.5">Matched by both methods</div>
        </div>
        <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-violet-700">{onlySemantic.length}</div>
          <div className="text-xs font-semibold text-violet-700 mt-1">Hidden overlap</div>
          <div className="text-xs text-violet-500 mt-0.5">Semantic only — different words, same concepts</div>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-amber-700">{onlyTfidf.length}</div>
          <div className="text-xs font-semibold text-amber-700 mt-1">Shared language</div>
          <div className="text-xs text-amber-500 mt-0.5">TF-IDF only — same words, different concepts</div>
        </div>
      </div>

      {/* Two-column list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-sm font-semibold text-slate-700">TF-IDF results</span>
            <span className="text-xs text-slate-400">({tfidf.length})</span>
          </div>
          <CompareModuleList modules={tfidf} otherIds={semanticIds} />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-violet-400" />
            <span className="text-sm font-semibold text-slate-700">Semantic results</span>
            <span className="text-xs text-slate-400">({semantic.length})</span>
          </div>
          <CompareModuleList modules={semantic} otherIds={tfidfIds} isSecondary />
        </div>
      </div>

      <div className="text-xs text-slate-400 flex flex-wrap gap-4">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-slate-200 border border-slate-300" />
          In both methods (strong match)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-violet-100 border border-violet-200" />
          Semantic only — hidden conceptual overlap
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-200" />
          TF-IDF only — shared vocabulary, possibly different concepts
        </span>
      </div>
    </div>
  );
}

function CompareModuleList({ modules, otherIds, isSecondary }: {
  modules: SimilarModule[]; otherIds: Set<number>; isSecondary?: boolean;
}) {
  if (modules.length === 0) {
    return <div className="bg-white rounded-xl border border-slate-100 p-6 text-center text-xs text-slate-400">No results</div>;
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
      {modules.map((m) => {
        const inBoth = otherIds.has(m.id);
        const unique = !inBoth;
        const bgClass = inBoth ? "" : isSecondary ? "bg-violet-50" : "bg-amber-50";
        const barColor = inBoth ? undefined : isSecondary ? "#7c3aed" : "#d97706";
        return (
          <div key={m.id} className={`flex items-center gap-3 px-4 py-3 ${bgClass}`}>
            <span className="font-mono text-xs font-semibold text-slate-400 w-20 shrink-0">{m.moduleCode}</span>
            <span className="text-xs text-slate-700 flex-1 leading-snug">{m.moduleTitle}</span>
            <SimilarityBar value={m.similarity} color={barColor} />
          </div>
        );
      })}
    </div>
  );
}

// ── Outliers ──────────────────────────────────────────────────────────────────
function OutliersTab({ method }: { method: Method }) {
  const [showCount, setShowCount] = useState(50);

  const effectiveMethod = method === "compare" ? "tfidf" : method;

  const { data: dataA, isLoading: loadA, isFetching: fetchA } = useQuery<{ outliers: OutlierResult[] }>({
    queryKey: ["structure-outliers", effectiveMethod],
    queryFn: () => apiFetch(`/structure/outliers?limit=200&method=${effectiveMethod}`),
    staleTime: 10 * 60 * 1000,
  });

  const { data: dataB, isLoading: loadB, isFetching: fetchB } = useQuery<{ outliers: OutlierResult[] }>({
    queryKey: ["structure-outliers", "semantic"],
    queryFn: () => apiFetch("/structure/outliers?limit=200&method=semantic"),
    staleTime: 10 * 60 * 1000,
    enabled: method === "compare",
  });

  const isLoading = loadA || (method === "compare" && loadB);
  const isFetching = fetchA || (method === "compare" && fetchB);

  const visibleA = dataA?.outliers.slice(0, showCount) ?? [];
  const visibleB = dataB?.outliers.slice(0, showCount) ?? [];

  function outlierLabel(sim: number) {
    if (sim < 0.25) return { label: "Isolated", bg: "bg-red-50", text: "text-red-600", border: "border-red-100" };
    if (sim < 0.50) return { label: "Distinct", bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-100" };
    return { label: "Low connectivity", bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-100" };
  }

  return (
    <div className="space-y-5">
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-sm text-slate-600 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
        <div>
          Modules below show the lowest maximum similarity to any other module in the portfolio. They may represent niche offerings, poorly described modules, or genuine gaps in provision. This is not a recommendation to remove them.
          {method === "compare" && (
            <span className="block mt-1 text-slate-500">
              <strong>Compare mode:</strong> a module appearing in both lists is a stronger outlier signal. A module only in Semantic but not TF-IDF may use unusual terminology for otherwise common concepts.
            </span>
          )}
        </div>
      </div>

      {(isLoading || isFetching) && (
        <div className="flex items-center gap-2 text-slate-400 py-8 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" /> Identifying outliers…
        </div>
      )}

      {method === "compare" && dataA && dataB && !isFetching ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-sm font-semibold text-slate-700">TF-IDF outliers</span>
            </div>
            <OutlierList outliers={visibleA} outlierLabel={outlierLabel} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-3.5 w-3.5 text-violet-400" />
              <span className="text-sm font-semibold text-slate-700">Semantic outliers</span>
            </div>
            <OutlierList outliers={visibleB} outlierLabel={outlierLabel} />
          </div>
        </div>
      ) : dataA && !isFetching ? (
        <>
          <OutlierTable outliers={visibleA} outlierLabel={outlierLabel} />
          {dataA.outliers.length > showCount && (
            <div className="text-center">
              <Button variant="outline" size="sm" onClick={() => setShowCount((n) => n + 50)}>
                Show more ({dataA.outliers.length - showCount} remaining)
              </Button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function OutlierTable({ outliers, outlierLabel }: {
  outliers: OutlierResult[];
  outlierLabel: (sim: number) => { label: string; bg: string; text: string; border: string };
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">
        <span className="w-24 shrink-0">Code</span>
        <span className="flex-1">Module title</span>
        <span className="w-32 text-right">Max. similarity</span>
        <span className="w-28 text-right">Classification</span>
      </div>
      {outliers.length === 0 ? (
        <div className="p-10 text-center text-slate-400">No data available</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {outliers.map((m) => {
            const badge = outlierLabel(m.maxSimilarity);
            return (
              <div key={m.id} className="flex items-center gap-4 px-5 py-3.5">
                <span className="font-mono text-xs font-semibold text-slate-400 w-24 shrink-0">{m.moduleCode}</span>
                <span className="text-sm text-slate-700 flex-1">{m.moduleTitle}</span>
                <div className="w-32 flex justify-end"><SimilarityBar value={m.maxSimilarity} /></div>
                <div className="w-28 flex justify-end">
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}>
                    {badge.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OutlierList({ outliers, outlierLabel }: {
  outliers: OutlierResult[];
  outlierLabel: (sim: number) => { label: string; bg: string; text: string; border: string };
}) {
  if (outliers.length === 0) {
    return <div className="bg-white rounded-xl border border-slate-100 p-6 text-center text-xs text-slate-400">No outliers found</div>;
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
      {outliers.map((m) => {
        const badge = outlierLabel(m.maxSimilarity);
        return (
          <div key={m.id} className="flex items-center gap-3 px-4 py-3">
            <span className="font-mono text-xs font-semibold text-slate-400 w-20 shrink-0">{m.moduleCode}</span>
            <span className="text-xs text-slate-700 flex-1 leading-snug">{m.moduleTitle}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${badge.bg} ${badge.text} ${badge.border} shrink-0`}>
              {badge.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Network ───────────────────────────────────────────────────────────────────
function NetworkTab({ modules, method }: { modules: ModuleItem[]; method: Method }) {
  const [threshold, setThreshold] = useState(65);
  const [selected, setSelected] = useState<ModuleItem | null>(null);
  const [center, setCenter] = useState<{ id: number; moduleCode: string; moduleTitle: string } | null>(null);

  const effectiveMethod = method === "compare" ? "tfidf" : method;

  useEffect(() => {
    if (selected) setCenter(selected);
  }, [selected]);

  const { data: dataA, isLoading: loadA } = useQuery<NetworkData>({
    queryKey: ["structure-network", center?.id, threshold, effectiveMethod],
    queryFn: () => apiFetch(`/structure/network/${center!.id}?threshold=${threshold / 100}&method=${effectiveMethod}`),
    enabled: center !== null,
    staleTime: 5 * 60 * 1000,
  });

  const { data: dataB, isLoading: loadB } = useQuery<NetworkData>({
    queryKey: ["structure-network", center?.id, threshold, "semantic"],
    queryFn: () => apiFetch(`/structure/network/${center!.id}?threshold=${threshold / 100}&method=semantic`),
    enabled: center !== null && method === "compare",
    staleTime: 5 * 60 * 1000,
  });

  const posA = useNetworkLayout(dataA, 580, 440);
  const posB = useNetworkLayout(dataB, 580, 440);

  const isLoading = loadA || (method === "compare" && loadB);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-5">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Select a module to explore</label>
          <ModuleSearch modules={modules} value={selected} onChange={setSelected} />
        </div>
        <ThresholdSlider label="Threshold" value={threshold} onChange={setThreshold} min={40} max={90} />
      </div>

      {!center && (
        <div className="bg-white rounded-xl border border-slate-100 p-10 text-center text-slate-400">
          <Network className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">Choose a module to explore its connections</p>
          <p className="text-sm mt-1">The network shows modules related to the selected one above the threshold.</p>
        </div>
      )}

      {center && isLoading && (
        <div className="flex items-center gap-2 text-slate-400 py-8 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" /> Building network…
        </div>
      )}

      {center && !isLoading && method === "compare" && dataA && dataB ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-sm font-semibold text-slate-700">TF-IDF network</span>
              <span className="text-xs text-slate-400">{dataA.nodes.length - 1} related</span>
            </div>
            <NetworkGraph data={dataA} positions={posA} onClickNode={setCenter} W={580} H={440} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-violet-400" />
              <span className="text-sm font-semibold text-slate-700">Semantic network</span>
              <span className="text-xs text-slate-400">{dataB.nodes.length - 1} related</span>
            </div>
            <NetworkGraph data={dataB} positions={posB} onClickNode={setCenter} W={580} H={440} nodeColor="#7c3aed" />
          </div>
        </div>
      ) : center && dataA && !isLoading ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            <span className="font-semibold text-slate-700">{dataA.nodes.length - 1}</span> related module{dataA.nodes.length !== 2 ? "s" : ""} · {dataA.edges.length} connection{dataA.edges.length !== 1 ? "s" : ""}.{" "}
            <span className="text-slate-400">Click any node to explore from there.</span>
          </p>
          {dataA.nodes.length <= 1 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400">
              <p className="font-semibold">No connections found</p>
              <p className="text-sm mt-1">Try lowering the threshold to reveal more connections.</p>
            </div>
          ) : (
            <NetworkGraph data={dataA} positions={posA} onClickNode={setCenter} W={640} H={480} />
          )}
        </div>
      ) : null}
    </div>
  );
}

function NetworkGraph({ data, positions, onClickNode, W, H, nodeColor }: {
  data: NetworkData;
  positions: Map<number, { x: number; y: number }>;
  onClickNode: (node: { id: number; moduleCode: string; moduleTitle: string }) => void;
  W: number; H: number;
  nodeColor?: string;
}) {
  const neighborColor = nodeColor ?? "#1d4ed8";
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: H, background: "#f8fafc" }}>
        {data.edges.map((e, i) => {
          const s = positions.get(e.source);
          const t = positions.get(e.target);
          if (!s || !t) return null;
          const alpha = 0.2 + e.similarity * 0.5;
          return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="#94a3b8" strokeWidth={1 + e.similarity} strokeOpacity={alpha} />;
        })}
        {data.nodes.map((node) => {
          const pos = positions.get(node.id);
          if (!pos) return null;
          const isC = node.isCenter;
          return (
            <g key={node.id} transform={`translate(${pos.x},${pos.y})`} className="cursor-pointer" onClick={() => !isC && onClickNode(node)}>
              <circle r={isC ? 22 : 14} fill={isC ? "#003865" : neighborColor} stroke="white" strokeWidth={isC ? 3 : 2} opacity={isC ? 1 : 0.85} />
              <text textAnchor="middle" dy="0.35em" fill="white" fontSize={isC ? 9 : 7} fontWeight="bold" fontFamily="monospace">
                {node.moduleCode.slice(0, 8)}
              </text>
              <title>{node.moduleCode} – {node.moduleTitle}</title>
            </g>
          );
        })}
      </svg>
      <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-6 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ background: "#003865" }} />
          <span>Selected</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ background: neighborColor }} />
          <span>Related (click to explore)</span>
        </div>
      </div>
    </div>
  );
}

function useNetworkLayout(data: NetworkData | undefined, W: number, H: number) {
  const [positions, setPositions] = useState<Map<number, { x: number; y: number }>>(new Map());

  useEffect(() => {
    if (!data || data.nodes.length === 0) { setPositions(new Map()); return; }

    const cx = W / 2, cy = H / 2;
    const n = data.nodes.length;
    const pos = new Map<number, { x: number; y: number; vx: number; vy: number }>();

    data.nodes.forEach((node, i) => {
      if (node.isCenter) {
        pos.set(node.id, { x: cx, y: cy, vx: 0, vy: 0 });
      } else {
        const angle = ((i - 1) / (n - 1)) * 2 * Math.PI;
        const radius = Math.min(W, H) * 0.35;
        pos.set(node.id, { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle), vx: 0, vy: 0 });
      }
    });

    const ITER = 80, K = 80, REPULSE = 3000, DAMP = 0.8;
    for (let iter = 0; iter < ITER; iter++) {
      const alpha = 1 - iter / ITER;
      const ids = Array.from(pos.keys());
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const a = pos.get(ids[i])!, b = pos.get(ids[j])!;
          const dx = a.x - b.x, dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          const f = (REPULSE / (d * d)) * alpha;
          a.vx += (dx / d) * f; a.vy += (dy / d) * f;
          b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
        }
      }
      for (const e of data.edges) {
        const a = pos.get(e.source), b = pos.get(e.target);
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = ((d - K) / d) * 0.3 * alpha * (0.5 + e.similarity * 0.5);
        a.vx += dx * f; a.vy += dy * f;
        b.vx -= dx * f; b.vy -= dy * f;
      }
      for (const [id, p] of pos) {
        const node = data.nodes.find((n) => n.id === id);
        const g = node?.isCenter ? 0.02 : 0.04;
        p.vx += (cx - p.x) * g * alpha;
        p.vy += (cy - p.y) * g * alpha;
      }
      const PAD = 30;
      for (const p of pos.values()) {
        p.vx *= DAMP; p.vy *= DAMP;
        p.x = Math.max(PAD, Math.min(W - PAD, p.x + p.vx));
        p.y = Math.max(PAD, Math.min(H - PAD, p.y + p.vy));
      }
      const centerNode = data.nodes.find((n) => n.isCenter);
      if (centerNode) {
        const cp = pos.get(centerNode.id)!;
        cp.x = cx; cp.y = cy; cp.vx = 0; cp.vy = 0;
      }
    }

    setPositions(new Map(Array.from(pos.entries()).map(([id, { x, y }]) => [id, { x, y }])));
  }, [data, W, H]);

  return positions;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Structure() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [method, setMethod] = useState<Method>("tfidf");
  const [manualGenerating, setManualGenerating] = useState(false);

  const { data: modules = [] } = useQuery<ModuleItem[]>({
    queryKey: ["structure-modules"],
    queryFn: () => apiFetch("/structure/modules"),
    staleTime: 10 * 60 * 1000,
  });

  const { data: embStatus, refetch: refetchStatus } = useQuery<EmbeddingStatus>({
    queryKey: ["embedding-status"],
    queryFn: () => apiFetch("/structure/embeddings/status"),
    refetchInterval: (query) => {
      const data = query.state.data as EmbeddingStatus | undefined;
      return data?.generating || manualGenerating ? 2000 : false;
    },
  });

  const { mutate: refreshCacheMutate, isPending: isRefreshing } = useMutation({
    mutationFn: () => fetch("/api/structure/cache", { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["structure-overview"] });
      queryClient.invalidateQueries({ queryKey: ["structure-clusters"] });
      queryClient.invalidateQueries({ queryKey: ["structure-outliers"] });
      queryClient.invalidateQueries({ queryKey: ["embedding-status"] });
    },
    onError: (err) => {
      toast({ variant: "destructive", title: "Failed to clear cache", description: err instanceof Error ? err.message : "Unknown error" });
    },
  });

  const refreshCache = () => {
    if (!isAdmin) {
      toast({ variant: "destructive", title: "Admin access required", description: "Sign in as admin to clear the cache." });
      return;
    }
    refreshCacheMutate();
  };

  const handleGenerate = useCallback(async () => {
    if (!isAdmin) {
      toast({ variant: "destructive", title: "Admin access required", description: "Sign in as admin to generate embeddings." });
      return;
    }
    setManualGenerating(true);
    try {
      const r = await fetch("/api/structure/embeddings/generate", { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      refetchStatus();
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to generate embeddings", description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setTimeout(() => setManualGenerating(false), 3000);
    }
  }, [refetchStatus, isAdmin, toast]);

  // When generation completes, invalidate semantic queries
  useEffect(() => {
    if (embStatus && !embStatus.generating && !manualGenerating) {
      queryClient.invalidateQueries({ queryKey: ["structure-clusters", "semantic"] });
      queryClient.invalidateQueries({ queryKey: ["structure-outliers", "semantic"] });
      queryClient.invalidateQueries({ queryKey: ["structure-similar"] });
    }
  }, [embStatus?.generating, manualGenerating]);

  const needsEmbeddings = (method === "semantic" || method === "compare") && embStatus && embStatus.withEmbedding === 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg shrink-0" style={{ backgroundColor: "#003865" }}>
          <GitBranch className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#003865" }}>Structure Explorer</h1>
          <p className="text-slate-500 mt-0.5">Explore similarity, clustering, and structural patterns across the curriculum</p>
        </div>
      </div>

      {/* Method selector */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
        <MethodSelector value={method} onChange={setMethod} />
      </div>

      {/* Embedding banner (when semantic and outside tabs) */}
      {(method === "semantic" || method === "compare") && (
        <EmbeddingBanner
          status={embStatus}
          onGenerate={handleGenerate}
          generating={manualGenerating || (embStatus?.generating ?? false)}
        />
      )}

      {/* Tabs — disabled when semantic has no embeddings yet */}
      <Tabs defaultValue="overview">
        <TabsList className="mb-2">
          <TabsTrigger value="overview" className="flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="clusters" className="flex items-center gap-1.5" disabled={needsEmbeddings ?? false}>
            <Layers className="h-3.5 w-3.5" /> Clusters
          </TabsTrigger>
          <TabsTrigger value="similar" className="flex items-center gap-1.5" disabled={needsEmbeddings ?? false}>
            <Search className="h-3.5 w-3.5" /> Similar Modules
          </TabsTrigger>
          <TabsTrigger value="outliers" className="flex items-center gap-1.5" disabled={needsEmbeddings ?? false}>
            <AlertTriangle className="h-3.5 w-3.5" /> Outliers
          </TabsTrigger>
          <TabsTrigger value="network" className="flex items-center gap-1.5" disabled={needsEmbeddings ?? false}>
            <Network className="h-3.5 w-3.5" /> Network
          </TabsTrigger>
        </TabsList>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <TabsContent value="overview" className="mt-0">
            <OverviewTab
              method={method}
              embStatus={embStatus}
              onRefresh={() => refreshCache()}
              isRefreshing={isRefreshing}
            />
          </TabsContent>
          <TabsContent value="clusters" className="mt-0">
            <ClustersTab method={method} />
          </TabsContent>
          <TabsContent value="similar" className="mt-0">
            <SimilarTab modules={modules} method={method} />
          </TabsContent>
          <TabsContent value="outliers" className="mt-0">
            <OutliersTab method={method} />
          </TabsContent>
          <TabsContent value="network" className="mt-0">
            <NetworkTab modules={modules} method={method} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
