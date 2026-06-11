import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Camera, CheckCircle2, Download, Layers3, Map, MessageSquare, RefreshCw, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type ProgrammeVersion = {
  id: string;
  programmeCode?: string | null;
  programmeName?: string | null;
  versionLabel: string;
  academicYear?: string | null;
};

type FrameworkFamily = {
  key: string;
  name: string;
  examples: string[];
  color: string;
};

type MapLayer = {
  key: string;
  name: string;
  family?: string;
  layerType: string;
  source: string;
  active: boolean;
  placeholder: boolean;
  versionLabel?: string;
  sourceUrl?: string;
};

type MapRow = {
  id: string;
  stage: string;
  semester: string;
  pathway: string;
  optionGroup?: string;
  coreOption: string;
  credits?: number | null;
  module: {
    code?: string | null;
    title?: string | null;
    status: string;
  };
  descriptor: {
    status: string;
  };
  provenance: {
    sourceDerived: boolean;
    curatedModified: boolean;
    reconciliationStatus: string;
    confidence?: number | null;
  };
  evidence: {
    count: number;
    status: string;
  };
  quality: {
    status: string;
    indicators: Array<{ key: string; label: string; severity: string }>;
  };
  layers: Array<{
    key: string;
    name: string;
    family?: string;
    status: string;
    layerType: string;
    indicators?: Array<{
      evaluationId: string;
      competencyName?: string;
      domainName?: string;
      expectedLevel?: string;
      observedLevel: string;
      comparison?: string;
      status: string;
      evidenceCount: number;
      analysisScope?: "provisional" | "reviewed" | "excluded";
    }>;
  }>;
};

type ProgrammeMapProjection = {
  programmeVersion: ProgrammeVersion;
  analysisStatus?: "all" | "provisional" | "reviewed";
  provisionalNotice?: string;
  activeLayers: MapLayer[];
  rows: MapRow[];
  summary: {
    modulePlacementCount: number;
    sourceDerivedCount: number;
    curatedModifiedCount: number;
    missingDescriptorCount: number;
    missingEvidenceCount: number;
    dataQualityIssueCount: number;
    greenCompEvaluationCount?: number;
    lifeCompEvaluationCount?: number;
    entreCompEvaluationCount?: number;
    digCompEvaluationCount?: number;
    assessmentDesignEvaluationCount?: number;
  };
};

type CoverageSummary = {
  status: string;
  counts: Record<string, number>;
  dimensions: Array<{ key: string; label: string; count: number }>;
};

type GreenCompCoverageSummary = {
  status: string;
  totalGreenCompCompetences?: number;
  totalLifeCompCompetences?: number;
  totalEntreCompCompetences?: number;
  totalDigCompCompetences?: number;
  totalCompetences: number;
  competencesExpectedInProgramme: number;
  competencesObservedInProgramme: number;
  modulesWithGreenCompEvidence?: number;
  modulesWithNoGreenCompEvidence?: number;
  modulesWithLifeCompEvidence?: number;
  modulesWithNoLifeCompEvidence?: number;
  modulesWithEntreCompEvidence?: number;
  modulesWithNoEntreCompEvidence?: number;
  modulesWithDigCompEvidence?: number;
  modulesWithNoDigCompEvidence?: number;
  modulesWithFrameworkEvidence: number;
  modulesWithNoFrameworkEvidence: number;
  evidenceLinkedEvaluations: number;
  unevidencedEvaluations: number;
  evidenceMaturityDistribution: Record<string, number>;
  scaffoldingDistribution: Record<string, number>;
  reviewStatusCounts: Record<string, number>;
  expectedVersusObservedMatrix: Record<string, Record<string, number>>;
  gapSummary: { count: number; evidenceGaps: number; belowExpected: number };
  strengthSummary: { count: number; aligned: number; aboveExpected: number; emergentStrengths: number };
};

type FrameworkExpectationAnalysis = {
  frameworkKey: string;
  versionLabel: string;
  summary: {
    totalCompetences: number;
    competencesWithExpectations: number;
    competencesWithObservedEvidence: number;
    gapCount: number;
    strengthCount: number;
    reviewReadyCount: number;
  };
  expectedVersusObservedMatrix: Record<string, Record<string, number>>;
  byCompetency: Array<{
    competencyName: string;
    domainName?: string;
    expectedLevel: string;
    observedLevel: string;
    evidenceCount: number;
    comparison: string;
  }>;
};

type DesignLayerSummary = {
  status: string;
  layerKey: string;
  message: string;
  modulePlacementCount: number;
  modulesWithAssessmentComponents?: number;
  modulesWithNoAssessmentComponents?: number;
  modulesWithAssessmentEvidence?: number;
  modulesWithNoAssessmentEvidence?: number;
  modulesWithCompleteWeighting?: number;
  assessmentComponentCount?: number;
  assessmentTypeMix?: Record<string, number>;
  groupIndividualBalance?: Record<string, number>;
  teachingStrategySectionCount?: number;
  modalitySectionCount?: number;
  modulesWithModalityEvidence?: number;
  modulesWithNoModalityEvidence?: number;
  currentPlannedModality?: Record<string, number>;
  riskFlags?: Record<string, number>;
  evidenceMaturityDistribution: Record<string, number>;
  reviewStatusCounts: Record<string, number>;
  indicatorCount: number;
  highestObservedMaturity: string;
};

type ProgrammeMapAnnotation = {
  id: string;
  annotationType: string;
  body: string;
  createdAt: string;
};

type ProgrammeMapSnapshot = {
  id: string;
  versionLabel: string;
  status: string;
  createdAt: string;
};

type ProgrammeMapExport = {
  id: string;
  format: string;
  status: string;
  createdAt: string;
  completedAt?: string | null;
  metadata?: Record<string, unknown>;
};

type ProgrammeMapExportResponse = {
  export: ProgrammeMapExport;
  filename: string;
  contentType: string;
  payload: string;
};

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message ?? payload.error ?? `Request failed with ${response.status}`);
  return payload as T;
}

const familyStyles: Record<string, { border: string; background: string; text: string; dot: string }> = {
  european: { border: "#bfdbfe", background: "#eff6ff", text: "#1d4ed8", dot: "#2563eb" },
  institutional: { border: "#bbf7d0", background: "#f0fdf4", text: "#047857", dot: "#10b981" },
  curriculum_design: { border: "#a5f3fc", background: "#ecfeff", text: "#0e7490", dot: "#06b6d4" },
  programme: { border: "#ddd6fe", background: "#f5f3ff", text: "#6d28d9", dot: "#8b5cf6" },
  disciplinary: { border: "#fde68a", background: "#fffbeb", text: "#b45309", dot: "#f59e0b" },
  professional_accreditation: { border: "#fecdd3", background: "#fff1f2", text: "#be123c", dot: "#f43f5e" },
  system: { border: "#cbd5e1", background: "#f8fafc", text: "#334155", dot: "#64748b" },
};

function styleForFamily(family?: string) {
  return familyStyles[family ?? "system"] ?? familyStyles.system;
}

function evidenceMaturityLabel(level: string) {
  const labels: Record<string, string> = {
    none: "None",
    developing: "Developing",
    consolidating: "Consolidating",
    leading: "Leading",
    not_applicable: "None",
    introduce: "Developing",
    develop: "Consolidating",
    integrate: "Leading",
    demonstrate: "Leading",
  };
  return labels[level] ?? level;
}

function formatDate(value?: string | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

const maturityLevels = ["none", "developing", "consolidating", "leading"] as const;

function comparisonLabel(comparison?: string) {
  const labels: Record<string, string> = {
    not_expected: "Not expected",
    emergent_strength: "Emergent strength",
    evidence_gap: "Evidence gap",
    below_expected: "Below expected",
    aligned: "Aligned",
    above_expected: "Above expected",
  };
  return comparison ? labels[comparison] ?? comparison : "Observed";
}

function statusBadge(row: MapRow) {
  if (row.quality.indicators.some((indicator) => indicator.severity === "error" || indicator.severity === "critical")) {
    return <Badge variant="destructive">Quality issue</Badge>;
  }
  if (row.descriptor.status === "missing") return <Badge variant="outline">Descriptor missing</Badge>;
  if (row.evidence.count === 0) return <Badge variant="secondary">No evidence</Badge>;
  return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Evidence</Badge>;
}

function layerChip(layer: MapLayer) {
  const style = styleForFamily(layer.family ?? (layer.layerType === "data_quality" || layer.layerType === "evidence" || layer.layerType === "source_curated" ? "system" : undefined));
  return (
    <span
      key={layer.key}
      className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium"
      style={{ borderColor: style.border, backgroundColor: style.background, color: style.text }}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: style.dot }} />
      {layer.name}
    </span>
  );
}

function groupRows(rows: MapRow[]) {
  const stages = [...new Set(rows.map((row) => row.stage))].sort();
  return stages.map((stage) => ({
    stage,
    semesters: [...new Set(rows.filter((row) => row.stage === stage).map((row) => row.semester))].sort().map((semester) => ({
      semester,
      pathways: [...new Set(rows.filter((row) => row.stage === stage && row.semester === semester).map((row) => row.pathway))].sort().map((pathway) => ({
        pathway,
        rows: rows.filter((row) => row.stage === stage && row.semester === semester && row.pathway === pathway),
      })),
    })),
  }));
}

function FrameworkCoveragePanel({ title, summary }: { title: string; summary?: GreenCompCoverageSummary }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        <div className="rounded border border-slate-200 p-4"><div className="text-2xl font-bold">{summary?.totalCompetences ?? 0}</div><div className="text-xs text-slate-500">Competencies</div></div>
        <div className="rounded border border-slate-200 p-4"><div className="text-2xl font-bold">{summary?.competencesExpectedInProgramme ?? 0}</div><div className="text-xs text-slate-500">Expected</div></div>
        <div className="rounded border border-slate-200 p-4"><div className="text-2xl font-bold">{summary?.competencesObservedInProgramme ?? 0}</div><div className="text-xs text-slate-500">Observed with evidence</div></div>
        <div className="rounded border border-slate-200 p-4"><div className="text-2xl font-bold">{summary?.modulesWithFrameworkEvidence ?? 0}</div><div className="text-xs text-slate-500">Modules with evidence</div></div>
        <div className="rounded border border-amber-200 bg-amber-50 p-4"><div className="text-2xl font-bold text-amber-700">{summary?.gapSummary?.count ?? 0}</div><div className="text-xs text-amber-700">Evidence gaps</div></div>
        <div className="rounded border border-emerald-200 bg-emerald-50 p-4"><div className="text-2xl font-bold text-emerald-700">{summary?.strengthSummary?.count ?? 0}</div><div className="text-xs text-emerald-700">Strength signals</div></div>
      </CardContent>
    </Card>
  );
}

function DesignLayerPanel({ title, summary }: { title: string; summary?: DesignLayerSummary }) {
  const maturity = summary?.evidenceMaturityDistribution ?? {};
  const primaryMetrics =
    summary?.layerKey === "assessment-design"
      ? [
          ["Assessment components", summary.assessmentComponentCount ?? 0],
          ["Complete weighting", summary.modulesWithCompleteWeighting ?? 0],
          ["Modules with evidence", summary.modulesWithAssessmentEvidence ?? 0],
          ["Review-ready signals", summary.indicatorCount ?? 0],
        ]
      : [
          ["Teaching sections", summary?.teachingStrategySectionCount ?? 0],
          ["Modality sections", summary?.modalitySectionCount ?? 0],
          ["Modules with evidence", summary?.modulesWithModalityEvidence ?? 0],
          ["Review-ready signals", summary?.indicatorCount ?? 0],
        ];
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          {primaryMetrics.map(([label, value]) => (
            <div key={label} className="rounded border border-slate-200 p-4">
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-xs text-slate-500">{label}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          {maturityLevels.map((level) => (
            <div key={level} className="rounded border border-cyan-100 bg-cyan-50 p-2">
              <div className="font-semibold text-cyan-800">{maturity[level] ?? 0}</div>
              <div className="text-cyan-700">{evidenceMaturityLabel(level)}</div>
            </div>
          ))}
        </div>
        <div className="text-xs text-slate-500">{summary?.message ?? "Seed and materialise this design layer to see evidence-informed signals."}</div>
      </CardContent>
    </Card>
  );
}

function MatrixTable({ matrix }: { matrix?: Record<string, Record<string, number>> }) {
  return (
    <div className="overflow-x-auto rounded border border-slate-200">
      <table className="w-full min-w-[520px] text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2 text-left">Expected \\ Observed</th>
            {maturityLevels.map((level) => <th key={level} className="px-3 py-2 text-right">{evidenceMaturityLabel(level)}</th>)}
          </tr>
        </thead>
        <tbody>
          {maturityLevels.map((expected) => (
            <tr key={expected} className="border-t border-slate-100">
              <th className="px-3 py-2 text-left font-medium text-slate-700">{evidenceMaturityLabel(expected)}</th>
              {maturityLevels.map((observed) => (
                <td key={observed} className="px-3 py-2 text-right text-slate-600">{matrix?.[expected]?.[observed] ?? 0}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ProgrammeMapPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [programmes, setProgrammes] = useState<ProgrammeVersion[]>([]);
  const [selectedProgrammeId, setSelectedProgrammeId] = useState("");
  const [families, setFamilies] = useState<FrameworkFamily[]>([]);
  const [layers, setLayers] = useState<MapLayer[]>([]);
  const [activeLayerKeys, setActiveLayerKeys] = useState<string[]>([
    "source-curated",
    "data-quality",
    "evidence",
    "evidence-maturity",
    "framework:greencomp",
    "framework:digcomp",
    "framework:entrecomp",
    "framework:assessment-design",
    "framework:modality-design",
  ]);
  const [analysisStatus, setAnalysisStatus] = useState<"all" | "provisional" | "reviewed">("all");
  const [projection, setProjection] = useState<ProgrammeMapProjection>();
  const [coverage, setCoverage] = useState<CoverageSummary>();
  const [greenCompCoverage, setGreenCompCoverage] = useState<GreenCompCoverageSummary>();
  const [lifeCompCoverage, setLifeCompCoverage] = useState<GreenCompCoverageSummary>();
  const [entreCompCoverage, setEntreCompCoverage] = useState<GreenCompCoverageSummary>();
  const [digCompCoverage, setDigCompCoverage] = useState<GreenCompCoverageSummary>();
  const [greenCompAnalysis, setGreenCompAnalysis] = useState<FrameworkExpectationAnalysis>();
  const [assessmentDesignSummary, setAssessmentDesignSummary] = useState<DesignLayerSummary>();
  const [annotations, setAnnotations] = useState<ProgrammeMapAnnotation[]>([]);
  const [snapshots, setSnapshots] = useState<ProgrammeMapSnapshot[]>([]);
  const [exports, setExports] = useState<ProgrammeMapExport[]>([]);
  const [commentText, setCommentText] = useState("");
  const [snapshotLabel, setSnapshotLabel] = useState("");

  const groupedRows = useMemo(() => groupRows(projection?.rows ?? []), [projection]);
  const activeLayers = useMemo(() => layers.filter((layer) => activeLayerKeys.includes(layer.key)), [layers, activeLayerKeys]);

  async function loadProgrammes() {
    setLoading(true);
    setError(undefined);
    try {
      const [programmeResult, familyResult] = await Promise.all([
        api<{ programmeVersions: ProgrammeVersion[] }>("/api/programme-workspace/programme-versions"),
        api<{ families: FrameworkFamily[] }>("/api/programme-map/framework-families"),
      ]);
      setProgrammes(programmeResult.programmeVersions);
      setFamilies(familyResult.families);
      setSelectedProgrammeId((current) => current || programmeResult.programmeVersions[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load programme map");
    } finally {
      setLoading(false);
    }
  }

  async function loadMap(programmeVersionId = selectedProgrammeId, nextActiveLayers = activeLayerKeys, nextAnalysisStatus = analysisStatus) {
    if (!programmeVersionId) return;
    setLoading(true);
    setError(undefined);
    try {
      const layerQuery = encodeURIComponent(nextActiveLayers.join(","));
      const statusQuery = encodeURIComponent(nextAnalysisStatus);
      const [
        layerResult,
        mapResult,
        coverageResult,
        greenCompCoverageResult,
        lifeCompCoverageResult,
        entreCompCoverageResult,
        digCompCoverageResult,
        greenCompAnalysisResult,
        assessmentDesignResult,
        annotationResult,
        snapshotResult,
        exportResult,
      ] = await Promise.all([
        api<{ layers: MapLayer[] }>(`/api/programme-map/programme-versions/${programmeVersionId}/layers`),
        api<ProgrammeMapProjection>(`/api/programme-map/programme-versions/${programmeVersionId}?layers=${layerQuery}&analysisStatus=${statusQuery}`),
        api<CoverageSummary>(`/api/programme-map/programme-versions/${programmeVersionId}/coverage-summary`),
        api<GreenCompCoverageSummary>(`/api/programme-map/programme-versions/${programmeVersionId}/greencomp/coverage-summary?analysisStatus=${statusQuery}`),
        api<GreenCompCoverageSummary>(`/api/programme-map/programme-versions/${programmeVersionId}/lifecomp/coverage-summary?analysisStatus=${statusQuery}`),
        api<GreenCompCoverageSummary>(`/api/programme-map/programme-versions/${programmeVersionId}/entrecomp/coverage-summary?analysisStatus=${statusQuery}`),
        api<GreenCompCoverageSummary>(`/api/programme-map/programme-versions/${programmeVersionId}/digcomp/coverage-summary?analysisStatus=${statusQuery}`),
        api<FrameworkExpectationAnalysis>(`/api/programme-map/programme-versions/${programmeVersionId}/frameworks/greencomp/expectation-analysis?analysisStatus=${statusQuery}`),
        api<DesignLayerSummary>(`/api/programme-map/programme-versions/${programmeVersionId}/assessment-design/summary`),
        api<{ annotations: ProgrammeMapAnnotation[] }>(`/api/programme-map/programme-versions/${programmeVersionId}/annotations`),
        api<{ snapshots: ProgrammeMapSnapshot[] }>(`/api/programme-map/programme-versions/${programmeVersionId}/snapshots`),
        api<{ exports: ProgrammeMapExport[] }>(`/api/programme-map/programme-versions/${programmeVersionId}/exports`),
      ]);
      setLayers(layerResult.layers);
      setProjection(mapResult);
      setCoverage(coverageResult);
      setGreenCompCoverage(greenCompCoverageResult);
      setLifeCompCoverage(lifeCompCoverageResult);
      setEntreCompCoverage(entreCompCoverageResult);
      setDigCompCoverage(digCompCoverageResult);
      setGreenCompAnalysis(greenCompAnalysisResult);
      setAssessmentDesignSummary(assessmentDesignResult);
      setAnnotations(annotationResult.annotations);
      setSnapshots(snapshotResult.snapshots);
      setExports(exportResult.exports);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load programme map");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProgrammes();
  }, []);

  useEffect(() => {
    if (selectedProgrammeId) void loadMap(selectedProgrammeId);
  }, [selectedProgrammeId]);

  function toggleLayer(layerKey: string, enabled: boolean) {
    const next = enabled ? [...new Set([...activeLayerKeys, layerKey])] : activeLayerKeys.filter((key) => key !== layerKey);
    setActiveLayerKeys(next);
    void loadMap(selectedProgrammeId, next, analysisStatus);
  }

  function changeAnalysisStatus(value: "all" | "provisional" | "reviewed") {
    setAnalysisStatus(value);
    void loadMap(selectedProgrammeId, activeLayerKeys, value);
  }

  async function createComment() {
    if (!selectedProgrammeId || !commentText.trim()) return;
    await api(`/api/programme-map/programme-versions/${selectedProgrammeId}/annotations`, {
      method: "POST",
      body: JSON.stringify({ annotationType: "comment", body: commentText }),
    });
    setCommentText("");
    await loadMap();
  }

  async function createSnapshot() {
    if (!selectedProgrammeId) return;
    await api(`/api/programme-map/programme-versions/${selectedProgrammeId}/snapshots`, {
      method: "POST",
      body: JSON.stringify({ label: snapshotLabel || undefined, activeLayerKeys }),
    });
    setSnapshotLabel("");
    await loadMap();
  }

  async function createExport(format: "json" | "csv") {
    if (!selectedProgrammeId) return;
    const result = await api<ProgrammeMapExportResponse>(`/api/programme-map/programme-versions/${selectedProgrammeId}/exports`, {
      method: "POST",
      body: JSON.stringify({ format, activeLayerKeys }),
    });
    const blob = new Blob([result.payload], { type: result.contentType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.filename;
    anchor.click();
    URL.revokeObjectURL(url);
    await loadMap();
  }

  const selectedProgramme = programmes.find((programme) => programme.id === selectedProgrammeId);

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 p-4 sm:p-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#003865" }}>Programme Map</h1>
          <p className="mt-2 max-w-3xl text-sm text-amber-700">
            Provisional analysis. Review required before formal use.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {activeLayers.length === 0 ? (
              <Badge variant="outline">Base map only</Badge>
            ) : (
              activeLayers.map((layer) => layerChip(layer))
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={analysisStatus} onValueChange={(value) => changeAnalysisStatus(value as "all" | "provisional" | "reviewed")}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Analysis status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All analysis</SelectItem>
              <SelectItem value="provisional">Provisional</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedProgrammeId} onValueChange={setSelectedProgrammeId}>
            <SelectTrigger className="w-full sm:w-[420px]">
              <SelectValue placeholder="Select programme version" />
            </SelectTrigger>
            <SelectContent>
              {programmes.map((programme) => (
                <SelectItem key={programme.id} value={programme.id}>
                  {programme.programmeCode ?? "No code"} - {programme.programmeName ?? "Untitled"} ({programme.versionLabel})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => loadMap()} disabled={loading || !selectedProgrammeId}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>{analysisStatus === "reviewed" ? "Reviewed filter active." : "Provisional analysis visible."}</strong>{" "}
        {analysisStatus === "reviewed"
          ? "Only human-reviewed or confirmed map signals are shown."
          : "Review required before using these outputs in formal reporting."}
      </div>

      <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
        <aside className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <SlidersHorizontal className="h-4 w-4" />
                Layers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {layers.map((layer) => {
                const style = styleForFamily(layer.family ?? "system");
                return (
                  <div key={layer.key} className="flex items-center justify-between gap-3 rounded border px-3 py-2" style={{ borderColor: style.border, backgroundColor: style.background }}>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium" style={{ color: style.text }}>{layer.name}</div>
                      <div className="truncate text-xs text-slate-500">{layer.family ?? layer.layerType}</div>
                    </div>
                    <Switch checked={activeLayerKeys.includes(layer.key)} onCheckedChange={(checked) => toggleLayer(layer.key, checked)} aria-label={`Toggle ${layer.name}`} />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Framework Families</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {families.map((family) => {
                const style = styleForFamily(family.key);
                return (
                  <div key={family.key} className="rounded border p-3" style={{ borderColor: style.border }}>
                    <div className="font-medium" style={{ color: style.text }}>{family.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{family.examples.slice(0, 4).join(", ")}</div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </aside>

        <main className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Card><CardContent className="p-4"><div className="text-2xl font-bold">{projection?.summary.modulePlacementCount ?? 0}</div><div className="text-xs text-slate-500">Modules</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-2xl font-bold">{projection?.summary.sourceDerivedCount ?? 0}</div><div className="text-xs text-slate-500">Source-derived</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-2xl font-bold">{projection?.summary.missingDescriptorCount ?? 0}</div><div className="text-xs text-slate-500">Missing descriptors</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-2xl font-bold">{projection?.summary.dataQualityIssueCount ?? 0}</div><div className="text-xs text-slate-500">Quality indicators</div></CardContent></Card>
          </div>

          <Tabs defaultValue="map" className="space-y-4">
            <TabsList>
              <TabsTrigger value="map"><Map className="mr-2 h-4 w-4" />Map</TabsTrigger>
              <TabsTrigger value="coverage"><Layers3 className="mr-2 h-4 w-4" />Coverage</TabsTrigger>
              <TabsTrigger value="workspace"><MessageSquare className="mr-2 h-4 w-4" />Workspace</TabsTrigger>
            </TabsList>

            <TabsContent value="map" className="space-y-4">
              {!selectedProgramme && <Card><CardContent className="p-6 text-sm text-slate-500">No programme version selected.</CardContent></Card>}
              {groupedRows.length === 0 && selectedProgramme && (
                <Card><CardContent className="p-6 text-sm text-slate-500">No curated programme structure is available for this programme version.</CardContent></Card>
              )}
              <div className="flex gap-4 overflow-x-auto pb-4">
                {groupedRows.map((stage) => (
                  <section key={stage.stage} className="min-w-[320px] flex-1 rounded border border-slate-200 bg-white shadow-sm">
                    <div className="sticky top-16 z-10 border-b border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-sm font-semibold text-slate-900">Stage {stage.stage}</div>
                    </div>
                    <div className="space-y-3 p-3">
                      {stage.semesters.map((semester) => (
                        <div key={`${stage.stage}-${semester.semester}`} className="rounded border border-slate-200 bg-slate-50/60 p-3">
                          <div className="mb-3 flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Semester {semester.semester}</span>
                            <Badge variant="outline">{semester.pathways.reduce((sum, pathway) => sum + pathway.rows.length, 0)}</Badge>
                          </div>
                          <div className="space-y-3">
                            {semester.pathways.map((pathway) => (
                              <div key={`${stage.stage}-${semester.semester}-${pathway.pathway}`} className="space-y-2">
                                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                                  <span>{pathway.pathway}</span>
                                  <span className="h-px flex-1 bg-slate-200" />
                                </div>
                                {pathway.rows.map((row) => (
                                  <article key={row.id} className="rounded border border-slate-200 bg-white p-3 shadow-sm">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="text-xs font-semibold text-slate-500">{row.module.code ?? "No code"}</div>
                                        <div className="mt-1 text-sm font-semibold text-slate-900">{row.module.title ?? "Untitled module"}</div>
                                      </div>
                                      {statusBadge(row)}
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                      <Badge variant="outline">{row.coreOption}</Badge>
                                      {row.credits != null && <Badge variant="outline">{row.credits} credits</Badge>}
                                      {row.provenance.sourceDerived && <Badge variant="secondary">Source</Badge>}
                                      {row.provenance.curatedModified && <Badge variant="secondary">Curated</Badge>}
                                    </div>
                                    {row.layers.length > 0 && (
                                      <div className="mt-3 flex flex-wrap gap-1.5">
                                        {row.layers.map((layer) => {
                                          const style = styleForFamily(layer.family ?? "system");
                                          if (layer.key.startsWith("framework:") && layer.indicators && layer.indicators.length > 0) {
                                            return layer.indicators.map((indicator) => (
                                              <span key={indicator.evaluationId} className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium" style={{ backgroundColor: style.background, color: style.text }}>
                                                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.dot }} />
                                                {indicator.competencyName ?? layer.name}: {evidenceMaturityLabel(indicator.expectedLevel ?? "none")} to {evidenceMaturityLabel(indicator.observedLevel)}
                                                <span className="text-slate-500">({comparisonLabel(indicator.comparison)}, {indicator.evidenceCount} ev., {indicator.analysisScope ?? "provisional"})</span>
                                              </span>
                                            ));
                                          }
                                          return (
                                            <span key={layer.key} className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium" style={{ backgroundColor: style.background, color: style.text }}>
                                              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.dot }} />
                                              {layer.name}{layer.status === "no_evidence" ? ": no evidence" : ""}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    )}
                                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                                      <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" />{row.provenance.reconciliationStatus}</span>
                                      <span className="inline-flex items-center gap-1">
                                        {row.evidence.count > 0 ? <CheckCircle2 className="h-3 w-3 text-emerald-600" /> : <AlertTriangle className="h-3 w-3 text-amber-600" />}
                                        {row.evidence.count} evidence
                                      </span>
                                    </div>
                                  </article>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="coverage">
              <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle>Coverage Architecture</CardTitle></CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2">
                    {(coverage?.dimensions ?? []).map((dimension) => (
                      <div key={dimension.key} className="rounded border border-slate-200 p-4">
                        <div className="text-2xl font-bold">{dimension.count}</div>
                        <div className="text-xs text-slate-500">{dimension.label}</div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>GreenComp Expected vs Observed</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded border border-slate-200 p-4"><div className="text-2xl font-bold">{greenCompAnalysis?.summary.competencesWithExpectations ?? 0}</div><div className="text-xs text-slate-500">Expected competencies</div></div>
                      <div className="rounded border border-slate-200 p-4"><div className="text-2xl font-bold">{greenCompAnalysis?.summary.competencesWithObservedEvidence ?? 0}</div><div className="text-xs text-slate-500">Observed with evidence</div></div>
                      <div className="rounded border border-slate-200 p-4"><div className="text-2xl font-bold">{greenCompAnalysis?.summary.reviewReadyCount ?? 0}</div><div className="text-xs text-slate-500">Review-ready observations</div></div>
                    </div>
                    <MatrixTable matrix={greenCompAnalysis?.expectedVersusObservedMatrix} />
                  </CardContent>
                </Card>
                <FrameworkCoveragePanel title="GreenComp Summary" summary={greenCompCoverage} />
                <FrameworkCoveragePanel title="LifeComp Summary" summary={lifeCompCoverage} />
                <FrameworkCoveragePanel title="EntreComp Summary" summary={entreCompCoverage} />
                <FrameworkCoveragePanel title="DigComp Summary" summary={digCompCoverage} />
                <DesignLayerPanel title="Assessment Summary" summary={assessmentDesignSummary} />
              </div>
            </TabsContent>

            <TabsContent value="workspace">
              <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
                <Card>
                  <CardHeader><CardTitle>Comments and Annotations</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Textarea
                        value={commentText}
                        onChange={(event) => setCommentText(event.target.value)}
                        placeholder="Add a programme map comment for reviewers or enhancement planning..."
                        rows={4}
                      />
                      <Button onClick={createComment} disabled={!selectedProgrammeId || !commentText.trim() || loading}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Add comment
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {annotations.length === 0 && <p className="text-sm text-slate-500">No comments yet.</p>}
                      {annotations.map((annotation) => (
                        <div key={annotation.id} className="rounded border border-slate-200 bg-white p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <Badge variant="outline">{annotation.annotationType}</Badge>
                            <span className="text-xs text-slate-500">{formatDate(annotation.createdAt)}</span>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{annotation.body}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <Card>
                    <CardHeader><CardTitle>Snapshots</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                          value={snapshotLabel}
                          onChange={(event) => setSnapshotLabel(event.target.value)}
                          placeholder="Snapshot label"
                        />
                        <Button onClick={createSnapshot} disabled={!selectedProgrammeId || loading}>
                          <Camera className="mr-2 h-4 w-4" />
                          Save
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {snapshots.length === 0 && <p className="text-sm text-slate-500">No snapshots saved.</p>}
                        {snapshots.slice(0, 8).map((snapshot) => (
                          <div key={snapshot.id} className="flex items-center justify-between gap-3 rounded border border-slate-200 px-3 py-2">
                            <div>
                              <div className="text-sm font-medium text-slate-900">{snapshot.versionLabel}</div>
                              <div className="text-xs text-slate-500">{formatDate(snapshot.createdAt)}</div>
                            </div>
                            <Badge variant="outline">{snapshot.status}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle>Exports</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => createExport("json")} disabled={!selectedProgrammeId || loading}>
                          <Download className="mr-2 h-4 w-4" />
                          JSON
                        </Button>
                        <Button variant="outline" onClick={() => createExport("csv")} disabled={!selectedProgrammeId || loading}>
                          <Download className="mr-2 h-4 w-4" />
                          CSV
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {exports.length === 0 && <p className="text-sm text-slate-500">No exports recorded.</p>}
                        {exports.slice(0, 8).map((exportRecord) => (
                          <div key={exportRecord.id} className="flex items-center justify-between gap-3 rounded border border-slate-200 px-3 py-2">
                            <div>
                              <div className="text-sm font-medium text-slate-900">{String(exportRecord.metadata?.filename ?? `Programme map ${exportRecord.format}`)}</div>
                              <div className="text-xs text-slate-500">{formatDate(exportRecord.completedAt ?? exportRecord.createdAt)}</div>
                            </div>
                            <Badge variant="outline">{exportRecord.format.toUpperCase()}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
