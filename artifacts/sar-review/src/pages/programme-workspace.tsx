import { useEffect, useMemo, useState } from "react";
import { Archive, ArrowRight, BookOpenCheck, ClipboardCheck, Download, FileSearch, Gauge, GitCompareArrows, Layers3, Library, ListChecks, Map as MapIcon, NotebookPen, RefreshCw, Save, ShieldCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type SourceProgramme = {
  id: string;
  code?: string | null;
  name?: string | null;
  award?: string | null;
};

type ProgrammeVersion = {
  id: string;
  sourceProgrammeId?: string | null;
  programmeCode?: string | null;
  programmeName?: string | null;
  versionLabel: string;
  academicYear?: string | null;
};

type StructureGroup = {
  id: string;
  name?: string | null;
  groupType: string;
  stage?: string | null;
  semester?: string | null;
  pathway?: string | null;
};

type StructureItem = {
  id: string;
  curatedStructureGroupId?: string | null;
  label?: string | null;
  stage?: string | null;
  semester?: string | null;
  pathway?: string | null;
  coreOption: string;
  credits?: number | null;
};

type WorkspaceState = {
  loading: boolean;
  error?: string;
  message?: string;
};

type ProgrammeOverview = {
  programme: {
    id: string;
    title?: string | null;
    code?: string | null;
    versionLabel: string;
    academicYear?: string | null;
  };
  summary: {
    moduleCount: number;
    stageCount: number;
    semesterCount: number;
    lastUploadDate?: string | null;
  };
  curriculumCoverage: {
    frameworks: Record<string, { totalCompetencies: number; observedCompetencies: number; coveragePercent: number }>;
    evidenceMaturityDistribution: Record<"none" | "developing" | "consolidating" | "leading", number>;
  };
  reviewStatus: {
    claimsGenerated: number;
    claimsReviewed: number;
    findingsAccepted: number;
    findingsAmended: number;
    findingsRequiringClarification: number;
  };
  dataQuality: {
    missingModuleCodes: number;
    missingCredits: number;
    missingStageSemester: number;
    duplicatePlacementWarnings: number;
    modulesWithNoLearningOutcomes: number;
    modulesWithNoAssessments: number;
  };
  modules: Array<{
    moduleId: string;
    moduleCode?: string | null;
    moduleTitle?: string | null;
    evidenceCount: number;
    claimCount: number;
    reviewStatus: string;
    dataQualityStatus: string;
  }>;
};

type VisualAnalysisMode = "combined" | "provisional" | "reviewed";

type FrameworkCoverageSummary = {
  frameworkKey: string;
  totalCompetences: number;
  competencesObservedInProgramme: number;
  modulesWithFrameworkEvidence: number;
  modulesWithNoFrameworkEvidence: number;
  evidenceLinkedEvaluations: number;
  unevidencedEvaluations: number;
  reviewStatusCounts: Record<string, number>;
  evidenceMaturityDistribution: Record<string, number>;
};

type ProgrammeMapVisualProjection = {
  rows: Array<{
    id: string;
    module: { id?: string | null; code?: string | null; title?: string | null };
    layers: Array<{
      key: string;
      name: string;
      indicators?: Array<{
        competencyId?: string | null;
        competencyName?: string | null;
        observedLevel: string;
        status: string;
        evidenceCount: number;
        analysisScope?: "provisional" | "reviewed" | "excluded";
      }>;
    }>;
  }>;
};

type ComparisonMode = "programme_version" | "snapshot" | "upload";
type ComparisonMetric = { left: number; right: number; delta: number };
type ComparisonOption = { id: string; label: string; programmeMapName?: string; status?: string; createdAt?: string };
type ComparisonOptions = {
  programmeVersions: ProgrammeVersion[];
  snapshots: ComparisonOption[];
  uploads: ComparisonOption[];
};
type ComparedModule = {
  moduleId?: string | null;
  moduleCode?: string | null;
  moduleTitle?: string | null;
  stage?: string | null;
  semester?: string | null;
  credits?: number | null;
};
type ComparedCompetency = {
  id: string;
  key: string;
  name: string;
  frameworkKey: string;
};
type ProgrammeComparison = {
  mode: ComparisonMode;
  left: { id: string; label: string };
  right: { id: string; label: string };
  summary: {
    modulesAdded: number;
    modulesRemoved: number;
    modulesMovedStage: number;
    modulesMovedSemester: number;
    creditChanges: number;
    frameworkChanges: number;
    maturityChanges: number;
    reviewChanges: number;
    dataQualityChanges: number;
  };
  curriculumChanges: {
    modulesAdded: ComparedModule[];
    modulesRemoved: ComparedModule[];
    modulesMovedStage: Array<{ before: ComparedModule; after: ComparedModule }>;
    modulesMovedSemester: Array<{ before: ComparedModule; after: ComparedModule }>;
    creditChanges: Array<{ before: ComparedModule; after: ComparedModule; delta: number }>;
  };
  frameworkChanges: {
    frameworks: Record<string, {
      observedCompetencies: ComparisonMetric;
      coveragePercent: ComparisonMetric;
      totalCompetencies: ComparisonMetric;
      competenciesAdded: ComparedCompetency[];
      competenciesRemoved: ComparedCompetency[];
    }>;
    maturityDistribution: Record<string, ComparisonMetric>;
  };
  reviewChanges: Record<string, ComparisonMetric>;
  dataQualityChanges: Record<string, ComparisonMetric>;
};

type ReviewCycle = {
  id: string;
  programmeVersionId?: string | null;
  title: string;
  cycleType: string;
  typeLabel?: string;
  status: string;
  description?: string | null;
  plannedStartAt?: string | null;
  plannedEndAt?: string | null;
  participantCount?: number;
  noteCount?: number;
  readinessAssessmentCount?: number;
};

type ReviewParticipant = {
  id: string;
  name: string;
  role: string;
  status: string;
  comments?: string | null;
};

type ReviewNote = {
  id: string;
  noteType: string;
  title?: string | null;
  body: string;
  createdAt?: string | null;
};

type ReadinessArea = {
  key: string;
  title: string;
  rating: string;
  statusLabel: string;
  strengths: string[];
  gaps: string[];
  observations: string[];
  evidenceReferences: Array<{ type: string; label: string; count?: number }>;
  metrics: Record<string, number>;
};

type ReadinessSummary = {
  programme: ProgrammeOverview["programme"];
  generatedAt: string;
  overallRating: string;
  overallStatusLabel: string;
  areas: ReadinessArea[];
  note: string;
};

type ReadinessAssessment = {
  id: string;
  title: string;
  status: string;
  overallRating?: string | null;
  createdAt?: string | null;
};

type ReadinessAssessmentItem = {
  id: string;
  readinessAssessmentId: string;
  criterionKey: string;
  title: string;
  finding?: string | null;
  rating: string;
  status: string;
};

type SwotItem = {
  id: string;
  title: string;
  description?: string | null;
  rationale?: string | null;
  itemType: "strength" | "weakness" | "opportunity" | "threat";
  categoryLabel?: string;
  status: string;
  createdAt?: string | null;
  traceability?: {
    evidenceCount: number;
    claimCount: number;
    findingCount: number;
    readinessCount: number;
    reviewNoteCount: number;
  };
};

type ActionItem = {
  id: string;
  title: string;
  description?: string | null;
  priority: "low" | "medium" | "high" | "critical";
  displayStatus: "proposed" | "approved" | "in_progress" | "completed" | "closed";
  displayStatusLabel: string;
  ownerName?: string;
  dueAt?: string | null;
  progressNotes?: string;
  createdAt?: string | null;
  traceability?: {
    swotCount: number;
    readinessCount: number;
    claimCount: number;
    findingCount: number;
    evidenceCount: number;
    reviewNoteCount: number;
  };
};

type ActionMonitoring = {
  totalActions: number;
  openActions: number;
  overdueActions: number;
  completedActions: number;
  byPriority: Record<string, number>;
  byStatus: Record<string, number>;
  byOwner: Record<string, number>;
  recentActivity: ActionItem[];
};

type ReviewContextOptions = {
  reviewCycles: ReviewCycle[];
  reviewNotes: ReviewNote[];
  readinessItems: Array<{ id: string; title: string; criterionKey: string; rating: string }>;
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

function formatDate(value?: string | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function frameworkLabel(key: string) {
  const labels: Record<string, string> = {
    greencomp: "GreenComp",
    lifecomp: "LifeComp",
    entrecomp: "EntreComp",
    digcomp: "DigComp",
  };
  return labels[key] ?? key;
}

function maturityLabel(key: string) {
  const labels: Record<string, string> = {
    none: "None",
    developing: "Developing",
    consolidating: "Consolidating",
    leading: "Leading",
  };
  return labels[key] ?? key;
}

const frameworkVisualKeys = ["greencomp", "digcomp", "entrecomp"] as const;
const frameworkVisualColours: Record<string, string> = {
  greencomp: "#16a34a",
  digcomp: "#2563eb",
  entrecomp: "#d97706",
};
const maturityScores: Record<string, number> = {
  none: 0,
  developing: 1,
  consolidating: 2,
  leading: 3,
};

function analysisQuery(mode: VisualAnalysisMode) {
  return mode === "combined" ? "all" : mode;
}

function analysisLabel(mode: VisualAnalysisMode) {
  if (mode === "combined") return "Combined";
  return mode === "provisional" ? "Provisional" : "Reviewed";
}

function percent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function scoreForMaturity(value?: string | null) {
  return maturityScores[value ?? "none"] ?? 0;
}

function heatTone(value: number) {
  if (value >= 3) return "bg-emerald-700";
  if (value === 2) return "bg-emerald-400";
  if (value === 1) return "bg-amber-300";
  return "bg-slate-100";
}

function metricTone(delta: number) {
  if (delta < 0) return "text-emerald-700";
  if (delta > 0) return "text-amber-700";
  return "text-slate-600";
}

function formatDelta(delta: number) {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

function moduleName(module: ComparedModule) {
  return `${module.moduleCode ?? "No code"} - ${module.moduleTitle ?? "Untitled module"}`;
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    draft: "Draft",
    active: "Active",
    completed: "Review Complete",
    archived: "Closed",
    cancelled: "Cancelled",
    planned: "Draft",
    not_assessed: "Not Started",
    emerging: "Emerging",
    developing: "Developing",
    established: "Established",
  };
  return labels[value] ?? value.replace(/_/g, " ");
}

function savePayload(filename: string, contentType: string, payload: string) {
  const blob = new Blob([payload], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function FrameworkRadar({ coverage }: { coverage: Record<string, FrameworkCoverageSummary | undefined> }) {
  const size = 220;
  const centre = size / 2;
  const radius = 78;
  const points = frameworkVisualKeys.map((key, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / frameworkVisualKeys.length;
    const summary = coverage[key];
    const value = summary?.totalCompetences ? summary.competencesObservedInProgramme / summary.totalCompetences : 0;
    return {
      key,
      label: frameworkLabel(key),
      value,
      x: centre + Math.cos(angle) * radius * value,
      y: centre + Math.sin(angle) * radius * value,
      axisX: centre + Math.cos(angle) * radius,
      axisY: centre + Math.sin(angle) * radius,
      labelX: centre + Math.cos(angle) * (radius + 28),
      labelY: centre + Math.sin(angle) * (radius + 28),
    };
  });
  const polygon = points.map((point) => `${point.x},${point.y}`).join(" ");
  const grid = [0.33, 0.66, 1].map((scale) =>
    frameworkVisualKeys.map((_, index) => {
      const angle = -Math.PI / 2 + (index * 2 * Math.PI) / frameworkVisualKeys.length;
      return `${centre + Math.cos(angle) * radius * scale},${centre + Math.sin(angle) * radius * scale}`;
    }).join(" "),
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Framework coverage radar" className="mx-auto h-56 w-56">
        {grid.map((ring, index) => <polygon key={index} points={ring} fill="none" stroke="#dbe4ef" strokeWidth="1" />)}
        {points.map((point) => (
          <line key={point.key} x1={centre} y1={centre} x2={point.axisX} y2={point.axisY} stroke="#dbe4ef" strokeWidth="1" />
        ))}
        <polygon points={polygon} fill="#2563eb22" stroke="#2563eb" strokeWidth="2" />
        {points.map((point) => (
          <g key={point.key}>
            <circle cx={point.x} cy={point.y} r="4" fill={frameworkVisualColours[point.key]} />
            <text x={point.labelX} y={point.labelY} textAnchor="middle" dominantBaseline="middle" className="fill-slate-700 text-[11px] font-semibold">
              {point.label}
            </text>
          </g>
        ))}
      </svg>
      <div className="space-y-3">
        {frameworkVisualKeys.map((key) => {
          const summary = coverage[key];
          const total = summary?.totalCompetences ?? 0;
          const observed = summary?.competencesObservedInProgramme ?? 0;
          const pct = percent(observed, total);
          return (
            <div key={key} className="rounded border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-950">{frameworkLabel(key)}</span>
                <span className="text-slate-600">{observed}/{total} competences · {pct}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: frameworkVisualColours[key] }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FrameworkHeatmap({ projection, frameworkKey }: { projection: ProgrammeMapVisualProjection | null; frameworkKey: string }) {
  const rows = projection?.rows ?? [];
  const competencyMap = new Map<string, string>();
  for (const row of rows) {
    const layer = row.layers.find((candidate) => candidate.key === `framework:${frameworkKey}`);
    for (const indicator of layer?.indicators ?? []) {
      const id = indicator.competencyId ?? indicator.competencyName ?? "unknown";
      competencyMap.set(id, indicator.competencyName ?? "Framework observation");
    }
  }
  const competencies = [...competencyMap.entries()].slice(0, 18);

  if (!projection || competencies.length === 0) {
    return (
      <div className="rounded border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        No {frameworkLabel(frameworkKey)} observations are available for the selected analysis view yet.
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded border border-slate-200">
      <table className="w-full min-w-[920px] text-left text-xs">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="sticky left-0 z-10 bg-slate-50 p-2">Module</th>
            {competencies.map(([id, name]) => (
              <th key={id} className="max-w-[110px] p-2 align-bottom">
                <span className="line-clamp-3">{name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 60).map((row) => {
            const layer = row.layers.find((candidate) => candidate.key === `framework:${frameworkKey}`);
            return (
              <tr key={row.id} className="border-t">
                <td className="sticky left-0 z-10 max-w-[240px] bg-white p-2 font-medium text-slate-800">
                  <div className="truncate">{row.module.code ?? "No code"}</div>
                  <div className="truncate text-[11px] font-normal text-slate-500">{row.module.title ?? "Untitled module"}</div>
                </td>
                {competencies.map(([id]) => {
                  const matches = (layer?.indicators ?? []).filter((indicator) => (indicator.competencyId ?? indicator.competencyName ?? "unknown") === id);
                  const score = Math.max(0, ...matches.map((indicator) => scoreForMaturity(indicator.observedLevel)));
                  const evidence = matches.reduce((sum, indicator) => sum + (indicator.evidenceCount ?? 0), 0);
                  return (
                    <td key={id} className="p-2">
                      <div
                        className={`h-7 rounded ${heatTone(score)}`}
                        title={`${maturityLabel(Object.keys(maturityScores).find((key) => maturityScores[key] === score) ?? "none")} · ${evidence} evidence link${evidence === 1 ? "" : "s"}`}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ProgrammeAssessmentSummary({ overview }: { overview: ProgrammeOverview }) {
  const moduleCount = overview.summary.moduleCount;
  const withoutAssessments = overview.dataQuality.modulesWithNoAssessments;
  const withAssessments = Math.max(0, moduleCount - withoutAssessments);
  const assessmentCoverage = percent(withAssessments, moduleCount);
  const outcomeCoverage = percent(Math.max(0, moduleCount - overview.dataQuality.modulesWithNoLearningOutcomes), moduleCount);
  const qualityCoverage = percent(Math.max(0, moduleCount - overview.dataQuality.missingCredits - overview.dataQuality.missingStageSemester), moduleCount);
  const points = [
    { label: "Assessment evidence", value: assessmentCoverage },
    { label: "Outcome evidence", value: outcomeCoverage },
    { label: "Structure quality", value: qualityCoverage },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <svg viewBox="0 0 220 190" role="img" aria-label="Assessment balance triangle" className="mx-auto h-48 w-56">
        <polygon points="110,18 24,166 196,166" fill="#eff6ff" stroke="#bfdbfe" strokeWidth="2" />
        <polygon
          points={`110,${166 - (148 * points[0].value) / 100} ${24 + (86 * (100 - points[1].value)) / 100},166 ${196 - (86 * (100 - points[2].value)) / 100},166`}
          fill="#f59e0b44"
          stroke="#d97706"
          strokeWidth="2"
        />
        <text x="110" y="12" textAnchor="middle" className="fill-slate-700 text-[11px] font-semibold">Assessment</text>
        <text x="24" y="184" textAnchor="middle" className="fill-slate-700 text-[11px] font-semibold">Outcomes</text>
        <text x="196" y="184" textAnchor="middle" className="fill-slate-700 text-[11px] font-semibold">Quality</text>
      </svg>
      <div className="space-y-3">
        {points.map((point) => (
          <div key={point.label} className="rounded border border-slate-200 bg-white p-3">
            <div className="flex justify-between text-sm"><span className="font-semibold text-slate-950">{point.label}</span><span>{point.value}%</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-amber-500" style={{ width: `${point.value}%` }} />
            </div>
          </div>
        ))}
        <p className="text-xs leading-5 text-slate-500">
          This is an evidence-availability view. It highlights where assessment and outcome evidence exists; it is not a judgement of assessment quality.
        </p>
      </div>
    </div>
  );
}

export default function ProgrammeWorkspace() {
  const [state, setState] = useState<WorkspaceState>({ loading: false });
  const [sourceProgrammes, setSourceProgrammes] = useState<SourceProgramme[]>([]);
  const [programmeVersions, setProgrammeVersions] = useState<ProgrammeVersion[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [selectedProgrammeId, setSelectedProgrammeId] = useState("");
  const [versionLabel, setVersionLabel] = useState("Draft");
  const [academicYear, setAcademicYear] = useState("2026/27");
  const [groups, setGroups] = useState<StructureGroup[]>([]);
  const [items, setItems] = useState<StructureItem[]>([]);
  const [comparison, setComparison] = useState<unknown>(null);
  const [quality, setQuality] = useState<unknown>(null);
  const [preview, setPreview] = useState<{ rows?: Array<Record<string, unknown>> } | null>(null);
  const [overview, setOverview] = useState<ProgrammeOverview | null>(null);
  const [visualAnalysisMode, setVisualAnalysisMode] = useState<VisualAnalysisMode>("combined");
  const [visualFramework, setVisualFramework] = useState<(typeof frameworkVisualKeys)[number]>("greencomp");
  const [visualCoverage, setVisualCoverage] = useState<Record<string, FrameworkCoverageSummary | undefined>>({});
  const [visualProjection, setVisualProjection] = useState<ProgrammeMapVisualProjection | null>(null);
  const [comparisonOptions, setComparisonOptions] = useState<ComparisonOptions>({ programmeVersions: [], snapshots: [], uploads: [] });
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>("programme_version");
  const [comparisonLeftId, setComparisonLeftId] = useState("");
  const [comparisonRightId, setComparisonRightId] = useState("");
  const [programmeComparison, setProgrammeComparison] = useState<ProgrammeComparison | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [reviewCycles, setReviewCycles] = useState<ReviewCycle[]>([]);
  const [selectedReviewCycleId, setSelectedReviewCycleId] = useState("");
  const [reviewCycleDetail, setReviewCycleDetail] = useState<{
    reviewCycle: ReviewCycle;
    participants: ReviewParticipant[];
    notes: ReviewNote[];
    readinessAssessments: ReadinessAssessment[];
  } | null>(null);
  const [readinessSummary, setReadinessSummary] = useState<ReadinessSummary | null>(null);
  const [readinessAssessments, setReadinessAssessments] = useState<ReadinessAssessment[]>([]);
  const [readinessItems, setReadinessItems] = useState<ReadinessAssessmentItem[]>([]);
  const [reviewForm, setReviewForm] = useState({
    title: "Annual Programme Review",
    cycleType: "programme_review",
    description: "",
    startDate: "",
    targetCompletionDate: "",
  });
  const [participantForm, setParticipantForm] = useState({ name: "", role: "Programme Chair", comments: "" });
  const [noteForm, setNoteForm] = useState({ title: "", noteType: "observation", body: "" });
  const [swotItems, setSwotItems] = useState<SwotItem[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [actionMonitoring, setActionMonitoring] = useState<ActionMonitoring | null>(null);
  const [reviewContextOptions, setReviewContextOptions] = useState<ReviewContextOptions>({ reviewCycles: [], reviewNotes: [], readinessItems: [] });
  const [swotForm, setSwotForm] = useState({
    title: "",
    description: "",
    category: "strength",
    rationale: "",
    readinessAssessmentItemId: "",
    reviewNoteId: "",
  });
  const [actionForm, setActionForm] = useState({
    title: "",
    description: "",
    owner: "",
    priority: "medium",
    status: "proposed",
    targetDate: "",
    progressNotes: "",
    swotItemId: "",
    readinessAssessmentItemId: "",
    reviewNoteId: "",
  });

  const selectedProgramme = useMemo(
    () => programmeVersions.find((programme) => programme.id === selectedProgrammeId),
    [programmeVersions, selectedProgrammeId],
  );

  async function load() {
    setState({ loading: true });
    try {
      const [sources, programmes] = await Promise.all([
        api<{ sourceProgrammes: SourceProgramme[] }>("/api/programme-workspace/source-programmes"),
        api<{ programmeVersions: ProgrammeVersion[] }>("/api/programme-workspace/programme-versions"),
      ]);
      setSourceProgrammes(sources.sourceProgrammes);
      setProgrammeVersions(programmes.programmeVersions);
      setSelectedSourceId((current) => current || sources.sourceProgrammes[0]?.id || "");
      setSelectedProgrammeId((current) => current || programmes.programmeVersions[0]?.id || "");
      setState({ loading: false });
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : "Failed to load workspace" });
    }
  }

  useEffect(() => {
    void load();
    void loadComparisonOptions();
  }, []);

  useEffect(() => {
    if (!selectedProgrammeId) {
      setOverview(null);
      setReviewCycles([]);
      setSelectedReviewCycleId("");
      setReviewCycleDetail(null);
      setReadinessSummary(null);
      setReadinessAssessments([]);
      setReadinessItems([]);
      setVisualCoverage({});
      setVisualProjection(null);
      setSwotItems([]);
      setActionItems([]);
      setActionMonitoring(null);
      setReviewContextOptions({ reviewCycles: [], reviewNotes: [], readinessItems: [] });
      return;
    }
    void loadOverview();
    void loadReviewCycles();
    void loadReadiness();
    void loadVisualIntelligence();
    void loadSwot();
    void loadActions();
    void loadReviewContextOptions();
  }, [selectedProgrammeId, visualAnalysisMode]);

  async function createProgramme() {
    setState({ loading: true });
    try {
      const result = await api<{ programmeVersion: ProgrammeVersion }>("/api/programme-workspace/programme-versions", {
        method: "POST",
        body: JSON.stringify({ sourceProgrammeId: selectedSourceId, versionLabel, academicYear }),
      });
      setProgrammeVersions((current) => [result.programmeVersion, ...current]);
      setSelectedProgrammeId(result.programmeVersion.id);
      setState({ loading: false, message: "Programme version created." });
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : "Creation failed" });
    }
  }

  async function buildStructure() {
    if (!selectedProgrammeId) return;
    setState({ loading: true });
    try {
      await api(`/api/programme-workspace/programme-versions/${selectedProgrammeId}/structure`, { method: "POST" });
      await loadStructure();
      setState({ loading: false, message: "Curated structure generated." });
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : "Structure generation failed" });
    }
  }

  async function loadStructure() {
    if (!selectedProgrammeId) return;
    const result = await api<{ groups: StructureGroup[]; items: StructureItem[] }>(`/api/programme-workspace/programme-versions/${selectedProgrammeId}/structure`);
    setGroups(result.groups);
    setItems(result.items);
  }

  async function loadOverview() {
    if (!selectedProgrammeId) return;
    setOverview(await api<ProgrammeOverview>(`/api/programme-workspace/programme-versions/${selectedProgrammeId}/overview`));
  }

  async function loadVisualIntelligence() {
    if (!selectedProgrammeId) return;
    const status = analysisQuery(visualAnalysisMode);
    const layerQuery = encodeURIComponent(frameworkVisualKeys.map((key) => `framework:${key}`).join(","));
    const [greencomp, digcomp, entrecomp, projection] = await Promise.all([
      api<FrameworkCoverageSummary>(`/api/programme-map/programme-versions/${selectedProgrammeId}/greencomp/coverage-summary?analysisStatus=${status}`),
      api<FrameworkCoverageSummary>(`/api/programme-map/programme-versions/${selectedProgrammeId}/digcomp/coverage-summary?analysisStatus=${status}`),
      api<FrameworkCoverageSummary>(`/api/programme-map/programme-versions/${selectedProgrammeId}/entrecomp/coverage-summary?analysisStatus=${status}`),
      api<ProgrammeMapVisualProjection>(`/api/programme-map/programme-versions/${selectedProgrammeId}?layers=${layerQuery}&analysisStatus=${status}`),
    ]);
    setVisualCoverage({ greencomp, digcomp, entrecomp });
    setVisualProjection(projection);
  }

  async function loadComparisonOptions() {
    const options = await api<ComparisonOptions>("/api/programme-workspace/comparison-options");
    setComparisonOptions(options);
    setComparisonLeftId((current) => current || options.programmeVersions[1]?.id || options.programmeVersions[0]?.id || "");
    setComparisonRightId((current) => current || options.programmeVersions[0]?.id || "");
  }

  async function updateItem(item: StructureItem, patch: Partial<StructureItem>) {
    const result = await api<{ item: StructureItem }>(`/api/programme-workspace/structure-items/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    setItems((current) => current.map((candidate) => (candidate.id === item.id ? result.item : candidate)));
  }

  async function loadComparison() {
    if (!selectedProgrammeId) return;
    setComparison(await api(`/api/programme-workspace/programme-versions/${selectedProgrammeId}/source-comparison`));
  }

  function optionsForMode(mode = comparisonMode): ComparisonOption[] {
    if (mode === "snapshot") return comparisonOptions.snapshots;
    if (mode === "upload") return comparisonOptions.uploads;
    return comparisonOptions.programmeVersions.map((programme) => ({
      id: programme.id,
      label: `${programme.programmeCode ?? "No code"} - ${programme.programmeName ?? "Untitled"} (${programme.versionLabel})`,
    }));
  }

  function updateComparisonMode(mode: ComparisonMode) {
    const options = optionsForMode(mode);
    setComparisonMode(mode);
    setComparisonLeftId(options[1]?.id || options[0]?.id || "");
    setComparisonRightId(options[0]?.id || "");
    setProgrammeComparison(null);
  }

  async function runProgrammeComparison() {
    if (!comparisonLeftId || !comparisonRightId) return;
    setProgrammeComparison(await api<ProgrammeComparison>("/api/programme-workspace/comparisons", {
      method: "POST",
      body: JSON.stringify({ mode: comparisonMode, leftId: comparisonLeftId, rightId: comparisonRightId }),
    }));
  }

  async function exportProgrammeComparison(format: "json" | "csv") {
    if (!comparisonLeftId || !comparisonRightId) return;
    const result = await api<{ filename: string; contentType: string; payload: string }>("/api/programme-workspace/comparisons/export", {
      method: "POST",
      body: JSON.stringify({ mode: comparisonMode, leftId: comparisonLeftId, rightId: comparisonRightId, format }),
    });
    savePayload(result.filename, result.contentType, result.payload);
  }

  async function loadReviewCycles() {
    if (!selectedProgrammeId) return;
    const result = await api<{ reviewCycles: ReviewCycle[] }>(`/api/programme-workspace/programme-versions/${selectedProgrammeId}/review-cycles`);
    setReviewCycles(result.reviewCycles);
    setSelectedReviewCycleId((current) => current || result.reviewCycles[0]?.id || "");
    if (!result.reviewCycles.some((cycle) => cycle.id === selectedReviewCycleId)) {
      setReviewCycleDetail(null);
    }
  }

  async function loadReviewCycleDetail(reviewCycleId = selectedReviewCycleId) {
    if (!reviewCycleId) return;
    const result = await api<{
      reviewCycle: ReviewCycle;
      participants: ReviewParticipant[];
      notes: ReviewNote[];
      readinessAssessments: ReadinessAssessment[];
    }>(`/api/programme-workspace/review-cycles/${reviewCycleId}`);
    setReviewCycleDetail(result);
    setSelectedReviewCycleId(result.reviewCycle.id);
  }

  async function createReviewCycle() {
    if (!selectedProgrammeId) return;
    setState({ loading: true });
    try {
      const result = await api<{ reviewCycle: ReviewCycle }>("/api/programme-workspace/review-cycles", {
        method: "POST",
        body: JSON.stringify({ ...reviewForm, programmeVersionId: selectedProgrammeId }),
      });
      setReviewCycles((current) => [result.reviewCycle, ...current]);
      setSelectedReviewCycleId(result.reviewCycle.id);
      setReviewCycleDetail({ reviewCycle: result.reviewCycle, participants: [], notes: [], readinessAssessments: [] });
      setState({ loading: false, message: "Review cycle created." });
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : "Review cycle creation failed" });
    }
  }

  async function updateReviewStatus(status: "draft" | "active" | "completed" | "archived") {
    if (!selectedReviewCycleId) return;
    const result = await api<{ reviewCycle: ReviewCycle }>(`/api/programme-workspace/review-cycles/${selectedReviewCycleId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    setReviewCycles((current) => current.map((cycle) => cycle.id === result.reviewCycle.id ? { ...cycle, ...result.reviewCycle } : cycle));
    await loadReviewCycleDetail(result.reviewCycle.id);
  }

  async function addParticipant() {
    if (!selectedReviewCycleId || !participantForm.name.trim()) return;
    const result = await api<{ participant: ReviewParticipant }>(`/api/programme-workspace/review-cycles/${selectedReviewCycleId}/participants`, {
      method: "POST",
      body: JSON.stringify(participantForm),
    });
    setReviewCycleDetail((current) => current ? { ...current, participants: [...current.participants, result.participant] } : current);
    setParticipantForm({ name: "", role: "Programme Chair", comments: "" });
    await loadReviewCycles();
  }

  async function addReviewNote() {
    if (!selectedReviewCycleId || !noteForm.body.trim()) return;
    const result = await api<{ note: ReviewNote }>(`/api/programme-workspace/review-cycles/${selectedReviewCycleId}/notes`, {
      method: "POST",
      body: JSON.stringify({ ...noteForm, programmeVersionId: selectedProgrammeId }),
    });
    setReviewCycleDetail((current) => current ? { ...current, notes: [result.note, ...current.notes] } : current);
    setNoteForm({ title: "", noteType: "observation", body: "" });
    await loadReviewCycles();
  }

  async function loadReadiness() {
    if (!selectedProgrammeId) return;
    const result = await api<{
      summary: ReadinessSummary;
      readinessAssessments: ReadinessAssessment[];
      items: ReadinessAssessmentItem[];
    }>(`/api/programme-workspace/programme-versions/${selectedProgrammeId}/readiness`);
    setReadinessSummary(result.summary);
    setReadinessAssessments(result.readinessAssessments);
    setReadinessItems(result.items);
  }

  async function createReadinessAssessment() {
    if (!selectedReviewCycleId) return;
    const result = await api<{
      readinessAssessment: ReadinessAssessment;
      items: ReadinessAssessmentItem[];
      summary: ReadinessSummary;
    }>(`/api/programme-workspace/review-cycles/${selectedReviewCycleId}/readiness-assessments`, { method: "POST" });
    setReadinessSummary(result.summary);
    await loadReadiness();
    await loadReviewCycleDetail(selectedReviewCycleId);
    setState({ loading: false, message: "Readiness assessment captured for the review cycle." });
  }

  async function exportReviewCycle(format: "json" | "csv") {
    if (!selectedReviewCycleId) return;
    const result = await api<{ filename: string; contentType: string; payload: string }>(`/api/programme-workspace/review-cycles/${selectedReviewCycleId}/export`, {
      method: "POST",
      body: JSON.stringify({ format }),
    });
    savePayload(result.filename, result.contentType, result.payload);
  }

  async function exportReadiness(format: "json" | "csv") {
    if (!selectedReviewCycleId) return;
    const result = await api<{ filename: string; contentType: string; payload: string }>(`/api/programme-workspace/review-cycles/${selectedReviewCycleId}/readiness/export`, {
      method: "POST",
      body: JSON.stringify({ format }),
    });
    savePayload(result.filename, result.contentType, result.payload);
  }

  async function loadReviewContextOptions(reviewCycleId = selectedReviewCycleId) {
    if (!selectedProgrammeId) return;
    const query = reviewCycleId ? `?reviewCycleId=${encodeURIComponent(reviewCycleId)}` : "";
    setReviewContextOptions(await api<ReviewContextOptions>(`/api/programme-workspace/programme-versions/${selectedProgrammeId}/review-context-options${query}`));
  }

  async function loadSwot(reviewCycleId = selectedReviewCycleId) {
    if (!selectedProgrammeId) return;
    const query = reviewCycleId ? `?reviewCycleId=${encodeURIComponent(reviewCycleId)}` : "";
    const result = await api<{ swotItems: SwotItem[] }>(`/api/programme-workspace/programme-versions/${selectedProgrammeId}/swot${query}`);
    setSwotItems(result.swotItems);
  }

  async function createSwot() {
    if (!selectedProgrammeId || !selectedReviewCycleId || !swotForm.title.trim()) return;
    const body = {
      programmeVersionId: selectedProgrammeId,
      reviewCycleId: selectedReviewCycleId,
      title: swotForm.title,
      description: swotForm.description,
      category: swotForm.category,
      rationale: swotForm.rationale,
      readinessAssessmentItemIds: swotForm.readinessAssessmentItemId ? [swotForm.readinessAssessmentItemId] : [],
      reviewNoteIds: swotForm.reviewNoteId ? [swotForm.reviewNoteId] : [],
    };
    await api<{ swotItem: SwotItem }>("/api/programme-workspace/swot", { method: "POST", body: JSON.stringify(body) });
    setSwotForm({ title: "", description: "", category: "strength", rationale: "", readinessAssessmentItemId: "", reviewNoteId: "" });
    await loadSwot();
    await loadActions();
    setState({ loading: false, message: "SWOT item captured." });
  }

  async function updateSwotStatus(swotItemId: string, status: "draft" | "reviewed" | "approved" | "archived") {
    await api(`/api/programme-workspace/swot/${swotItemId}`, { method: "PATCH", body: JSON.stringify({ status }) });
    await loadSwot();
  }

  async function exportSwot(format: "json" | "csv") {
    if (!selectedProgrammeId || !selectedReviewCycleId) return;
    const result = await api<{ filename: string; contentType: string; payload: string }>(`/api/programme-workspace/programme-versions/${selectedProgrammeId}/swot/export`, {
      method: "POST",
      body: JSON.stringify({ reviewCycleId: selectedReviewCycleId, format }),
    });
    savePayload(result.filename, result.contentType, result.payload);
  }

  async function loadActions(reviewCycleId = selectedReviewCycleId) {
    if (!selectedProgrammeId) return;
    const query = reviewCycleId ? `?reviewCycleId=${encodeURIComponent(reviewCycleId)}` : "";
    const result = await api<{ actionItems: ActionItem[]; monitoring: ActionMonitoring }>(`/api/programme-workspace/programme-versions/${selectedProgrammeId}/actions${query}`);
    setActionItems(result.actionItems);
    setActionMonitoring(result.monitoring);
  }

  async function createAction() {
    if (!selectedProgrammeId || !selectedReviewCycleId || !actionForm.title.trim()) return;
    const body = {
      programmeVersionId: selectedProgrammeId,
      reviewCycleId: selectedReviewCycleId,
      title: actionForm.title,
      description: actionForm.description,
      owner: actionForm.owner,
      priority: actionForm.priority,
      status: actionForm.status,
      targetDate: actionForm.targetDate,
      progressNotes: actionForm.progressNotes,
      swotItemIds: actionForm.swotItemId ? [actionForm.swotItemId] : [],
      readinessAssessmentItemIds: actionForm.readinessAssessmentItemId ? [actionForm.readinessAssessmentItemId] : [],
      reviewNoteIds: actionForm.reviewNoteId ? [actionForm.reviewNoteId] : [],
    };
    await api("/api/programme-workspace/actions", { method: "POST", body: JSON.stringify(body) });
    setActionForm({
      title: "",
      description: "",
      owner: "",
      priority: "medium",
      status: "proposed",
      targetDate: "",
      progressNotes: "",
      swotItemId: "",
      readinessAssessmentItemId: "",
      reviewNoteId: "",
    });
    await loadActions();
    setState({ loading: false, message: "Enhancement action created." });
  }

  async function updateActionStatus(actionItemId: string, status: "proposed" | "approved" | "in_progress" | "completed" | "closed") {
    await api(`/api/programme-workspace/actions/${actionItemId}`, { method: "PATCH", body: JSON.stringify({ status }) });
    await loadActions();
  }

  async function exportActions(format: "json" | "csv") {
    if (!selectedProgrammeId || !selectedReviewCycleId) return;
    const result = await api<{ filename: string; contentType: string; payload: string }>(`/api/programme-workspace/programme-versions/${selectedProgrammeId}/actions/export`, {
      method: "POST",
      body: JSON.stringify({ reviewCycleId: selectedReviewCycleId, format }),
    });
    savePayload(result.filename, result.contentType, result.payload);
  }

  async function runQuality() {
    if (!selectedProgrammeId) return;
    setQuality(await api(`/api/programme-workspace/programme-versions/${selectedProgrammeId}/data-quality`, { method: "POST" }));
  }

  async function loadMapPreview() {
    if (!selectedProgrammeId) return;
    setPreview(await api(`/api/programme-workspace/programme-versions/${selectedProgrammeId}/map-preview`));
  }

  async function archiveSelectedProgramme() {
    if (!selectedProgrammeId) return;
    setState({ loading: true });
    try {
      await api(`/api/programme-workspace/programme-versions/${selectedProgrammeId}/archive`, { method: "POST" });
      setConfirmArchive(false);
      await load();
      setState({ loading: false, message: "Programme version archived." });
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : "Programme archive failed" });
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#003865" }}>Programme Workspace</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">Create curated programme versions from uploaded source data and prepare structures for maps and review.</p>
        </div>
        <Button variant="outline" onClick={load} disabled={state.loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
      </div>

      {state.error && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>}
      {state.message && <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{state.message}</div>}

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader><CardTitle>Create From Source</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Label>Source programme</Label>
            <Select value={selectedSourceId} onValueChange={setSelectedSourceId}>
              <SelectTrigger><SelectValue placeholder="Select source programme" /></SelectTrigger>
              <SelectContent>
                {sourceProgrammes.map((source) => (
                  <SelectItem key={source.id} value={source.id}>{source.code ?? "No code"} - {source.name ?? "Untitled"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Label>Version label</Label>
            <Input value={versionLabel} onChange={(event) => setVersionLabel(event.target.value)} />
            <Label>Academic year</Label>
            <Input value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} />
            <Button onClick={createProgramme} disabled={!selectedSourceId || state.loading}><Save className="mr-2 h-4 w-4" />Create programme version</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Curated Programme</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedProgrammeId} onValueChange={setSelectedProgrammeId}>
              <SelectTrigger><SelectValue placeholder="Select programme version" /></SelectTrigger>
              <SelectContent>
                {programmeVersions.map((programme) => (
                  <SelectItem key={programme.id} value={programme.id}>{programme.programmeCode ?? "No code"} - {programme.programmeName ?? "Untitled"} ({programme.versionLabel})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProgramme && (
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <div><span className="text-slate-500">Code</span><div className="font-medium">{selectedProgramme.programmeCode ?? "Missing"}</div></div>
                <div><span className="text-slate-500">Name</span><div className="font-medium">{selectedProgramme.programmeName ?? "Missing"}</div></div>
                <div><span className="text-slate-500">Year</span><div className="font-medium">{selectedProgramme.academicYear ?? "Not set"}</div></div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={buildStructure} disabled={!selectedProgrammeId || state.loading}><Layers3 className="mr-2 h-4 w-4" />Build structure</Button>
              <Button variant="outline" onClick={loadStructure} disabled={!selectedProgrammeId}>Load structure</Button>
              <Button variant="outline" onClick={() => setConfirmArchive(true)} disabled={!selectedProgrammeId || state.loading}><Archive className="mr-2 h-4 w-4" />Archive</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview"><BookOpenCheck className="mr-2 h-4 w-4" />Overview</TabsTrigger>
          <TabsTrigger value="structure"><Layers3 className="mr-2 h-4 w-4" />Structure</TabsTrigger>
          <TabsTrigger value="comparison"><GitCompareArrows className="mr-2 h-4 w-4" />Comparison</TabsTrigger>
          <TabsTrigger value="review-cycles" data-tour="tab-review-cycles"><ClipboardCheck className="mr-2 h-4 w-4" />Review Cycles</TabsTrigger>
          <TabsTrigger value="readiness" data-tour="tab-readiness"><Gauge className="mr-2 h-4 w-4" />Readiness</TabsTrigger>
          <TabsTrigger value="swot" data-tour="tab-swot"><ListChecks className="mr-2 h-4 w-4" />SWOT</TabsTrigger>
          <TabsTrigger value="actions" data-tour="tab-actions"><ShieldCheck className="mr-2 h-4 w-4" />Action Planning</TabsTrigger>
          <TabsTrigger value="quality"><ListChecks className="mr-2 h-4 w-4" />Quality</TabsTrigger>
          <TabsTrigger value="map"><MapIcon className="mr-2 h-4 w-4" />Map preview</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {!overview && (
            <Card>
              <CardContent className="flex flex-col gap-3 py-6 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                <span>Select a programme version to view programme-level metrics.</span>
                <Button variant="outline" onClick={loadOverview} disabled={!selectedProgrammeId}>Load overview</Button>
              </CardContent>
            </Card>
          )}

          {overview && (
            <>
              <Card>
                <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle>Visual Intelligence Dashboard</CardTitle>
                    <p className="mt-1 max-w-3xl text-sm text-slate-600">
                      Immediate programme-level visibility across framework coverage, competency heatmaps, assessment evidence, readiness and data quality.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Select value={visualAnalysisMode} onValueChange={(value) => setVisualAnalysisMode(value as VisualAnalysisMode)}>
                      <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Analysis view" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="combined">Combined</SelectItem>
                        <SelectItem value="provisional">Provisional</SelectItem>
                        <SelectItem value="reviewed">Reviewed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={loadVisualIntelligence} disabled={!selectedProgrammeId}>
                      <RefreshCw className="mr-2 h-4 w-4" />Refresh visuals
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <strong>{analysisLabel(visualAnalysisMode)} view.</strong>{" "}
                    {visualAnalysisMode === "reviewed"
                      ? "Only reviewed or confirmed framework observations are shown."
                      : "Provisional analysis is visible. Review required before formal use."}
                  </div>
                  <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
                    <Card className="border-slate-200 shadow-none">
                      <CardHeader><CardTitle className="text-base">Framework Coverage Radar</CardTitle></CardHeader>
                      <CardContent>
                        <FrameworkRadar coverage={visualCoverage} />
                      </CardContent>
                    </Card>
                    <Card className="border-slate-200 shadow-none">
                      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <CardTitle className="text-base">Framework Heatmap</CardTitle>
                          <p className="mt-1 text-xs text-slate-500">Rows are modules; columns are observed framework competencies.</p>
                        </div>
                        <Select value={visualFramework} onValueChange={(value) => setVisualFramework(value as typeof visualFramework)}>
                          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Framework" /></SelectTrigger>
                          <SelectContent>
                            {frameworkVisualKeys.map((key) => <SelectItem key={key} value={key}>{frameworkLabel(key)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </CardHeader>
                      <CardContent>
                        <FrameworkHeatmap projection={visualProjection} frameworkKey={visualFramework} />
                      </CardContent>
                    </Card>
                  </div>
                  <div className="grid gap-4 xl:grid-cols-3">
                    <Card className="border-slate-200 shadow-none">
                      <CardHeader><CardTitle className="text-base">Assessment Summary</CardTitle></CardHeader>
                      <CardContent><ProgrammeAssessmentSummary overview={overview} /></CardContent>
                    </Card>
                    <Card className="border-slate-200 shadow-none">
                      <CardHeader><CardTitle className="text-base">Readiness Summary</CardTitle></CardHeader>
                      <CardContent className="space-y-3">
                        <div className="text-2xl font-semibold text-slate-950">{readinessSummary?.overallStatusLabel ?? "Not captured"}</div>
                        <p className="text-sm leading-6 text-slate-600">
                          {readinessSummary ? readinessSummary.note : "Open the Readiness tab to refresh or capture a review-team readiness summary."}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="border-slate-200 shadow-none">
                      <CardHeader><CardTitle className="text-base">Data Quality Summary</CardTitle></CardHeader>
                      <CardContent className="space-y-2">
                        {[
                          ["Missing stage/semester", overview.dataQuality.missingStageSemester],
                          ["Duplicate placements", overview.dataQuality.duplicatePlacementWarnings],
                          ["No learning outcomes", overview.dataQuality.modulesWithNoLearningOutcomes],
                          ["No assessments", overview.dataQuality.modulesWithNoAssessments],
                        ].map(([label, value]) => (
                          <div key={label} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-sm">
                            <span>{label}</span>
                            <Badge variant={Number(value) > 0 ? "secondary" : "outline"}>{value}</Badge>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                <Card>
                  <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>{overview.programme.title ?? "Untitled programme"}</CardTitle>
                      <p className="mt-1 text-sm text-slate-600">
                        {overview.programme.code ?? "No programme code"} · {overview.programme.versionLabel}
                        {overview.programme.academicYear ? ` · ${overview.programme.academicYear}` : ""}
                      </p>
                    </div>
                    <Button variant="outline" onClick={loadOverview}><RefreshCw className="mr-2 h-4 w-4" />Refresh overview</Button>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {[
                        ["Modules", overview.summary.moduleCount],
                        ["Stages", overview.summary.stageCount],
                        ["Semesters", overview.summary.semesterCount],
                        ["Last upload", formatDate(overview.summary.lastUploadDate)],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded border border-slate-200 bg-white p-4">
                          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
                          <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Workspace Navigation</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <a className="flex items-center justify-between rounded border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50" href="/module-library">
                      <span className="inline-flex items-center"><Library className="mr-2 h-4 w-4 text-blue-700" />Open Module Library</span>
                      <ArrowRight className="h-4 w-4" />
                    </a>
                    <a className="flex items-center justify-between rounded border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50" href={overview.modules[0] ? `/module-builder?moduleId=${overview.modules[0].moduleId}` : "/module-builder"}>
                      <span className="inline-flex items-center"><FileSearch className="mr-2 h-4 w-4 text-blue-700" />Open Module Builder</span>
                      <ArrowRight className="h-4 w-4" />
                    </a>
                    <p className="text-xs leading-5 text-slate-500">Use the table below to inspect individual modules without leaving the programme context.</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle>Curriculum Coverage</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      Provisional analysis. Review required before formal use.
                    </div>
                    <div className="space-y-3">
                      {["greencomp", "lifecomp", "entrecomp", "digcomp"].map((key) => {
                        const coverage = overview.curriculumCoverage.frameworks[key] ?? { totalCompetencies: 0, observedCompetencies: 0, coveragePercent: 0 };
                        return (
                          <div key={key} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium text-slate-900">{frameworkLabel(key)}</span>
                              <span className="text-slate-600">{coverage.observedCompetencies}/{coverage.totalCompetencies} competences · {coverage.coveragePercent}%</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, Math.max(0, coverage.coveragePercent))}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-950">Evidence maturity distribution</h3>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {Object.entries(overview.curriculumCoverage.evidenceMaturityDistribution).map(([key, value]) => (
                          <Badge key={key} variant="outline" className="bg-slate-50">{maturityLabel(key)}: {value}</Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Review Status</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        ["Claims generated", overview.reviewStatus.claimsGenerated],
                        ["Claims reviewed", overview.reviewStatus.claimsReviewed],
                        ["Accepted findings", overview.reviewStatus.findingsAccepted],
                        ["Amended findings", overview.reviewStatus.findingsAmended],
                        ["Clarification required", overview.reviewStatus.findingsRequiringClarification],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded border border-slate-200 p-3">
                          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
                          <div className="mt-1 text-xl font-semibold text-slate-950">{value}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader><CardTitle>Data Quality</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      ["Missing module codes", overview.dataQuality.missingModuleCodes],
                      ["Missing credits", overview.dataQuality.missingCredits],
                      ["Missing stage or semester", overview.dataQuality.missingStageSemester],
                      ["Duplicate placement warnings", overview.dataQuality.duplicatePlacementWarnings],
                      ["Modules with no learning outcomes", overview.dataQuality.modulesWithNoLearningOutcomes],
                      ["Modules with no assessments", overview.dataQuality.modulesWithNoAssessments],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between rounded border border-slate-200 px-4 py-3">
                        <span className="text-sm text-slate-700">{label}</span>
                        <Badge variant={Number(value) > 0 ? "secondary" : "outline"}>{value}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>Module Status</CardTitle>
                    <p className="mt-1 text-sm text-slate-600">Programme modules with evidence, claims, review status and data-quality indicators.</p>
                  </div>
                  <a className="inline-flex items-center rounded border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50" href="/module-library">
                    Module Library <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </CardHeader>
                <CardContent>
                  <div className="overflow-auto rounded border border-slate-200">
                    <table className="w-full min-w-[860px] text-left text-sm">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="p-2">Code</th>
                          <th className="p-2">Title</th>
                          <th className="p-2">Evidence</th>
                          <th className="p-2">Claims</th>
                          <th className="p-2">Review status</th>
                          <th className="p-2">Data quality</th>
                          <th className="p-2">Open</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview.modules.length === 0 && (
                          <tr><td className="p-3 text-slate-500" colSpan={7}>No modules are currently linked to this programme version.</td></tr>
                        )}
                        {overview.modules.map((module) => (
                          <tr key={module.moduleId} className="border-t">
                            <td className="p-2 font-medium text-slate-950">{module.moduleCode ?? "Missing"}</td>
                            <td className="p-2">{module.moduleTitle ?? "Untitled module"}</td>
                            <td className="p-2">{module.evidenceCount}</td>
                            <td className="p-2">{module.claimCount}</td>
                            <td className="p-2"><Badge variant="outline">{module.reviewStatus}</Badge></td>
                            <td className="p-2">
                              <Badge variant={module.dataQualityStatus === "No issues" ? "outline" : "secondary"}>
                                <ShieldCheck className="mr-1 h-3 w-3" />{module.dataQualityStatus}
                              </Badge>
                            </td>
                            <td className="p-2">
                              <a className="inline-flex items-center text-sm font-medium text-blue-700 hover:text-blue-900" href={`/module-builder?moduleId=${module.moduleId}`}>
                                Builder <ArrowRight className="ml-1 h-3 w-3" />
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="structure">
          <Card>
            <CardHeader><CardTitle>Editable Structure Items</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {items.length === 0 && <p className="text-sm text-slate-500">No curated structure loaded.</p>}
              {items.map((item) => (
                <div key={item.id} className="grid gap-2 rounded border border-slate-200 p-3 lg:grid-cols-[1fr_90px_120px_120px_130px_auto]">
                  <Input value={item.label ?? ""} onChange={(event) => setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, label: event.target.value } : candidate))} />
                  <Input value={item.stage ?? ""} onChange={(event) => setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, stage: event.target.value } : candidate))} aria-label="Stage" />
                  <Input value={item.semester ?? ""} onChange={(event) => setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, semester: event.target.value } : candidate))} aria-label="Semester" />
                  <Input value={item.credits ?? ""} onChange={(event) => setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, credits: Number(event.target.value) } : candidate))} aria-label="Credits" />
                  <Select value={item.coreOption} onValueChange={(coreOption) => setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, coreOption } : candidate))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["core", "required", "option", "optional", "elective", "unknown"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={() => updateItem(item, item)}>Save</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comparison">
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Programme Comparison</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 lg:grid-cols-[180px_1fr_1fr_auto]">
                  <Select value={comparisonMode} onValueChange={(value) => updateComparisonMode(value as ComparisonMode)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="programme_version">Programme versions</SelectItem>
                      <SelectItem value="snapshot">Map snapshots</SelectItem>
                      <SelectItem value="upload">Uploads</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={comparisonLeftId} onValueChange={setComparisonLeftId}>
                    <SelectTrigger><SelectValue placeholder="Compare from" /></SelectTrigger>
                    <SelectContent>
                      {optionsForMode().map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={comparisonRightId} onValueChange={setComparisonRightId}>
                    <SelectTrigger><SelectValue placeholder="Compare to" /></SelectTrigger>
                    <SelectContent>
                      {optionsForMode().map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button onClick={runProgrammeComparison} disabled={!comparisonLeftId || !comparisonRightId || comparisonLeftId === comparisonRightId}>
                    <GitCompareArrows className="mr-2 h-4 w-4" />
                    Compare
                  </Button>
                </div>
                {programmeComparison && (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => exportProgrammeComparison("json")}><Download className="mr-2 h-4 w-4" />JSON</Button>
                    <Button variant="outline" onClick={() => exportProgrammeComparison("csv")}><Download className="mr-2 h-4 w-4" />CSV</Button>
                  </div>
                )}
                {optionsForMode().length < 2 && (
                  <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    At least two {comparisonMode === "programme_version" ? "programme versions" : comparisonMode === "snapshot" ? "snapshots" : "uploads"} are needed for this comparison.
                  </div>
                )}
              </CardContent>
            </Card>

            {programmeComparison && (
              <>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                  {[
                    ["Modules added", programmeComparison.summary.modulesAdded],
                    ["Modules removed", programmeComparison.summary.modulesRemoved],
                    ["Framework changes", programmeComparison.summary.frameworkChanges],
                    ["Maturity changes", programmeComparison.summary.maturityChanges],
                    ["Review changes", programmeComparison.summary.reviewChanges],
                    ["Data quality changes", programmeComparison.summary.dataQualityChanges],
                  ].map(([label, value]) => (
                    <Card key={label}><CardContent className="p-4"><div className="text-2xl font-semibold text-slate-950">{value}</div><div className="text-xs text-slate-500">{label}</div></CardContent></Card>
                  ))}
                </div>

                <Card>
                  <CardHeader><CardTitle>Curriculum Changes</CardTitle></CardHeader>
                  <CardContent className="grid gap-4 lg:grid-cols-2">
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-slate-950">Modules added</h3>
                      <div className="space-y-2">
                        {programmeComparison.curriculumChanges.modulesAdded.length === 0 && <p className="text-sm text-slate-500">No added modules.</p>}
                        {programmeComparison.curriculumChanges.modulesAdded.map((module) => (
                          <div key={module.moduleId ?? module.moduleCode ?? moduleName(module)} className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                            {moduleName(module)}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-slate-950">Modules removed</h3>
                      <div className="space-y-2">
                        {programmeComparison.curriculumChanges.modulesRemoved.length === 0 && <p className="text-sm text-slate-500">No removed modules.</p>}
                        {programmeComparison.curriculumChanges.modulesRemoved.map((module) => (
                          <div key={module.moduleId ?? module.moduleCode ?? moduleName(module)} className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                            {moduleName(module)}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-slate-950">Stage or semester moves</h3>
                      <div className="space-y-2">
                        {[...programmeComparison.curriculumChanges.modulesMovedStage, ...programmeComparison.curriculumChanges.modulesMovedSemester].length === 0 && <p className="text-sm text-slate-500">No placement moves.</p>}
                        {[...programmeComparison.curriculumChanges.modulesMovedStage, ...programmeComparison.curriculumChanges.modulesMovedSemester].map((move, index) => (
                          <div key={`${move.after.moduleId ?? move.after.moduleCode ?? index}-move`} className="rounded border border-slate-200 px-3 py-2 text-sm">
                            <div className="font-medium text-slate-950">{moduleName(move.after)}</div>
                            <div className="text-slate-500">Stage {move.before.stage ?? "-"} / Semester {move.before.semester ?? "-"} to Stage {move.after.stage ?? "-"} / Semester {move.after.semester ?? "-"}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-slate-950">Credit changes</h3>
                      <div className="space-y-2">
                        {programmeComparison.curriculumChanges.creditChanges.length === 0 && <p className="text-sm text-slate-500">No credit changes.</p>}
                        {programmeComparison.curriculumChanges.creditChanges.map((change, index) => (
                          <div key={`${change.after.moduleId ?? change.after.moduleCode ?? index}-credits`} className="rounded border border-slate-200 px-3 py-2 text-sm">
                            <div className="font-medium text-slate-950">{moduleName(change.after)}</div>
                            <div className="text-slate-500">{change.before.credits ?? "-"} to {change.after.credits ?? "-"} credits ({formatDelta(change.delta)})</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-4 xl:grid-cols-3">
                  <Card>
                    <CardHeader><CardTitle>Framework Changes</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {Object.entries(programmeComparison.frameworkChanges.frameworks).map(([key, metrics]) => (
                        <div key={key} className="rounded border border-slate-200 p-3">
                          <div className="font-medium text-slate-950">{frameworkLabel(key)}</div>
                          <div className="mt-1 flex justify-between text-sm"><span>Observed competences</span><span className={metricTone(metrics.observedCompetencies.delta)}>{metrics.observedCompetencies.right} ({formatDelta(metrics.observedCompetencies.delta)})</span></div>
                          <div className="flex justify-between text-sm"><span>Coverage</span><span className={metricTone(metrics.coveragePercent.delta)}>{metrics.coveragePercent.right}% ({formatDelta(metrics.coveragePercent.delta)})</span></div>
                          <div className="mt-2 grid gap-2 text-xs text-slate-600">
                            <div>
                              <span className="font-medium text-emerald-700">Added:</span>{" "}
                              {metrics.competenciesAdded.length === 0
                                ? "None"
                                : metrics.competenciesAdded.slice(0, 3).map((competency) => competency.key).join(", ")}
                              {metrics.competenciesAdded.length > 3 ? ` +${metrics.competenciesAdded.length - 3} more` : ""}
                            </div>
                            <div>
                              <span className="font-medium text-rose-700">Removed:</span>{" "}
                              {metrics.competenciesRemoved.length === 0
                                ? "None"
                                : metrics.competenciesRemoved.slice(0, 3).map((competency) => competency.key).join(", ")}
                              {metrics.competenciesRemoved.length > 3 ? ` +${metrics.competenciesRemoved.length - 3} more` : ""}
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle>Review Changes</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {Object.entries(programmeComparison.reviewChanges).map(([key, metric]) => (
                        <div key={key} className="flex justify-between rounded border border-slate-200 px-3 py-2 text-sm">
                          <span>{key.replace(/([A-Z])/g, " $1")}</span>
                          <span className={metricTone(metric.delta)}>{metric.right} ({formatDelta(metric.delta)})</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle>Data Quality Changes</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {Object.entries(programmeComparison.dataQualityChanges).map(([key, metric]) => (
                        <div key={key} className="flex justify-between rounded border border-slate-200 px-3 py-2 text-sm">
                          <span>{key.replace(/([A-Z])/g, " $1")}</span>
                          <span className={metricTone(metric.delta)}>{metric.right} ({formatDelta(metric.delta)})</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}

            <Card>
              <CardHeader><CardTitle>Source Versus Curated Diagnostic</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" onClick={loadComparison} disabled={!selectedProgrammeId}><GitCompareArrows className="mr-2 h-4 w-4" />Load source diagnostic</Button>
                <pre className="max-h-96 overflow-auto rounded bg-slate-950 p-4 text-xs text-slate-100">{comparison ? JSON.stringify(comparison, null, 2) : "No source diagnostic loaded."}</pre>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="review-cycles">
          <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Create Review Cycle</CardTitle>
                <p className="text-sm text-slate-600">Set up a structured review activity for the selected programme. This records the review context; it does not make a readiness judgement.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>Review title</Label>
                  <Input value={reviewForm.title} onChange={(event) => setReviewForm((current) => ({ ...current, title: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Review type</Label>
                  <Select value={reviewForm.cycleType} onValueChange={(cycleType) => setReviewForm((current) => ({ ...current, cycleType }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="programme_review">Programme Review</SelectItem>
                      <SelectItem value="validation">Validation</SelectItem>
                      <SelectItem value="revalidation">Revalidation</SelectItem>
                      <SelectItem value="accreditation">Accreditation</SelectItem>
                      <SelectItem value="delta_readiness">DELTA Readiness</SelectItem>
                      <SelectItem value="institutional_priority_review">Institutional Priority Review</SelectItem>
                      <SelectItem value="other">Internal Enhancement Review</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Start date</Label>
                    <Input type="date" value={reviewForm.startDate} onChange={(event) => setReviewForm((current) => ({ ...current, startDate: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Target completion</Label>
                    <Input type="date" value={reviewForm.targetCompletionDate} onChange={(event) => setReviewForm((current) => ({ ...current, targetCompletionDate: event.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <textarea
                    className="min-h-24 w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500"
                    value={reviewForm.description}
                    onChange={(event) => setReviewForm((current) => ({ ...current, description: event.target.value }))}
                    placeholder="Purpose, review scope, evidence focus or external context"
                  />
                </div>
                <Button onClick={createReviewCycle} disabled={!selectedProgrammeId || state.loading}>
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                  Create review cycle
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>Review Cycles</CardTitle>
                    <p className="mt-1 text-sm text-slate-600">Programme reviews, validation activities, accreditation reviews and enhancement-focused evidence discussions.</p>
                  </div>
                  <Button variant="outline" onClick={loadReviewCycles} disabled={!selectedProgrammeId}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {reviewCycles.length === 0 && <p className="text-sm text-slate-500">No review cycles have been created for this programme yet.</p>}
                  {reviewCycles.map((cycle) => (
                    <div key={cycle.id} className="grid gap-3 rounded border border-slate-200 p-3 lg:grid-cols-[1fr_auto]">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-950">{cycle.title}</h3>
                          <Badge variant="outline">{cycle.typeLabel ?? cycle.cycleType}</Badge>
                          <Badge variant={cycle.status === "active" ? "secondary" : "outline"}>{statusLabel(cycle.status)}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{cycle.description || "No description recorded."}</p>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                          <span>Start: {formatDate(cycle.plannedStartAt)}</span>
                          <span>Target: {formatDate(cycle.plannedEndAt)}</span>
                          <span>{cycle.participantCount ?? 0} participants</span>
                          <span>{cycle.noteCount ?? 0} notes</span>
                          <span>{cycle.readinessAssessmentCount ?? 0} readiness summaries</span>
                        </div>
                      </div>
                      <Button variant="outline" onClick={() => loadReviewCycleDetail(cycle.id)}>Open</Button>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {reviewCycleDetail && (
                <Card>
                  <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <CardTitle>{reviewCycleDetail.reviewCycle.title}</CardTitle>
                      <p className="mt-1 text-sm text-slate-600">Use this space to capture review-team participation, observations and evidence-informed notes.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => updateReviewStatus("active")}>Mark active</Button>
                      <Button variant="outline" onClick={() => updateReviewStatus("completed")}>Review complete</Button>
                      <Button variant="outline" onClick={() => updateReviewStatus("archived")}>Close</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => exportReviewCycle("json")}><Download className="mr-2 h-4 w-4" />Export JSON</Button>
                      <Button variant="outline" onClick={() => exportReviewCycle("csv")}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
                      <Button onClick={createReadinessAssessment}><Gauge className="mr-2 h-4 w-4" />Capture readiness summary</Button>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded border border-slate-200 p-4">
                        <h3 className="flex items-center font-semibold text-slate-950"><Users className="mr-2 h-4 w-4 text-blue-700" />Participants</h3>
                        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_170px]">
                          <Input value={participantForm.name} onChange={(event) => setParticipantForm((current) => ({ ...current, name: event.target.value }))} placeholder="Name" />
                          <Select value={participantForm.role} onValueChange={(role) => setParticipantForm((current) => ({ ...current, role }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Programme Chair">Programme Chair</SelectItem>
                              <SelectItem value="Reviewer">Reviewer</SelectItem>
                              <SelectItem value="External Reviewer">External Reviewer</SelectItem>
                              <SelectItem value="Quality Representative">Quality Representative</SelectItem>
                              <SelectItem value="DELTA Team Member">DELTA Team Member</SelectItem>
                              <SelectItem value="Contributor">Contributor</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Input className="mt-2" value={participantForm.comments} onChange={(event) => setParticipantForm((current) => ({ ...current, comments: event.target.value }))} placeholder="Comments or contribution focus" />
                        <Button className="mt-3" variant="outline" onClick={addParticipant} disabled={!participantForm.name.trim()}>Add participant</Button>
                        <div className="mt-4 space-y-2">
                          {reviewCycleDetail.participants.length === 0 && <p className="text-sm text-slate-500">No participants recorded.</p>}
                          {reviewCycleDetail.participants.map((participant) => (
                            <div key={participant.id} className="rounded bg-slate-50 px-3 py-2 text-sm">
                              <div className="font-medium text-slate-950">{participant.name}</div>
                              <div className="text-slate-600">{participant.role}{participant.comments ? ` - ${participant.comments}` : ""}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded border border-slate-200 p-4">
                        <h3 className="flex items-center font-semibold text-slate-950"><NotebookPen className="mr-2 h-4 w-4 text-blue-700" />Review Notes</h3>
                        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_160px]">
                          <Input value={noteForm.title} onChange={(event) => setNoteForm((current) => ({ ...current, title: event.target.value }))} placeholder="Optional note title" />
                          <Select value={noteForm.noteType} onValueChange={(noteType) => setNoteForm((current) => ({ ...current, noteType }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="observation">Observation</SelectItem>
                              <SelectItem value="comment">Comment</SelectItem>
                              <SelectItem value="finding_link">Linked finding</SelectItem>
                              <SelectItem value="evidence_note">Evidence note</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <textarea
                          className="mt-2 min-h-24 w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500"
                          value={noteForm.body}
                          onChange={(event) => setNoteForm((current) => ({ ...current, body: event.target.value }))}
                          placeholder="Record review observations, evidence questions or enhancement discussion points"
                        />
                        <Button className="mt-3" variant="outline" onClick={addReviewNote} disabled={!noteForm.body.trim()}>Add note</Button>
                        <div className="mt-4 space-y-2">
                          {reviewCycleDetail.notes.length === 0 && <p className="text-sm text-slate-500">No notes recorded.</p>}
                          {reviewCycleDetail.notes.map((note) => (
                            <div key={note.id} className="rounded bg-slate-50 px-3 py-2 text-sm">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-slate-950">{note.title || "Review note"}</span>
                                <Badge variant="outline">{note.noteType.replace(/_/g, " ")}</Badge>
                              </div>
                              <p className="mt-1 text-slate-600">{note.body}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="readiness">
          <div className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle>Evidence-Informed Readiness</CardTitle>
                  <p className="mt-1 max-w-3xl text-sm text-slate-600">
                    Readiness brings together existing programme structure, framework coverage, assessment evidence, data quality and human-reviewed findings. Live readiness is provisional analysis; captured summaries support review-team judgement and are not institutional decisions.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={loadReadiness} disabled={!selectedProgrammeId}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
                  <Button onClick={createReadinessAssessment} disabled={!selectedReviewCycleId}><Gauge className="mr-2 h-4 w-4" />Capture summary</Button>
                </div>
              </CardHeader>
              <CardContent>
                {!readinessSummary && <p className="text-sm text-slate-500">Select a programme and refresh readiness to view current indicators.</p>}
                {readinessSummary && (
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                      <div className="rounded border border-slate-200 bg-white p-4">
                        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Overall indicator</div>
                        <div className="mt-2 text-xl font-semibold text-slate-950">{readinessSummary.overallStatusLabel}</div>
                      </div>
                      {readinessSummary.areas.map((item) => (
                        <div key={item.key} className="rounded border border-slate-200 bg-white p-4">
                          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.title}</div>
                          <div className="mt-2 text-lg font-semibold text-slate-950">{item.statusLabel}</div>
                        </div>
                      ))}
                    </div>
                    <div className="rounded border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-950">{readinessSummary.note}</div>
                  </div>
                )}
              </CardContent>
            </Card>

            {readinessSummary && (
              <div className="grid gap-4 lg:grid-cols-2">
                {readinessSummary.areas.map((item) => (
                  <Card key={item.key}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between gap-3">
                        <span>{item.title}</span>
                        <Badge variant="outline">{item.statusLabel}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <h3 className="text-sm font-semibold text-emerald-800">Strengths</h3>
                        <ul className="mt-2 space-y-1 text-sm text-slate-700">
                          {(item.strengths.length ? item.strengths : ["No explicit strengths have been surfaced yet."]).map((text) => <li key={text}>{text}</li>)}
                        </ul>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-amber-800">Gaps</h3>
                        <ul className="mt-2 space-y-1 text-sm text-slate-700">
                          {(item.gaps.length ? item.gaps : ["No current gaps are visible for this area."]).map((text) => <li key={text}>{text}</li>)}
                        </ul>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-950">Observations</h3>
                        <ul className="mt-2 space-y-1 text-sm text-slate-700">
                          {item.observations.map((text) => <li key={text}>{text}</li>)}
                        </ul>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {item.evidenceReferences.map((reference) => (
                          <Badge key={`${item.key}-${reference.type}`} variant="secondary">{reference.label}: {reference.count ?? 0}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Captured Readiness Summaries</CardTitle>
                  <p className="mt-1 text-sm text-slate-600">Snapshots captured against review cycles for later review evidence packs.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => exportReadiness("json")} disabled={!selectedReviewCycleId}><Download className="mr-2 h-4 w-4" />JSON</Button>
                  <Button variant="outline" onClick={() => exportReadiness("csv")} disabled={!selectedReviewCycleId}><Download className="mr-2 h-4 w-4" />CSV</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {reviewCycles.length > 0 && (
                  <div className="max-w-xl">
                    <Label>Review cycle for capture/export</Label>
                    <Select value={selectedReviewCycleId} onValueChange={(value) => {
                      setSelectedReviewCycleId(value);
                      void loadReviewCycleDetail(value);
                    }}>
                      <SelectTrigger><SelectValue placeholder="Select review cycle" /></SelectTrigger>
                      <SelectContent>
                        {reviewCycles.map((cycle) => <SelectItem key={cycle.id} value={cycle.id}>{cycle.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {readinessAssessments.length === 0 && <p className="text-sm text-slate-500">No readiness summaries have been captured for this programme yet.</p>}
                {readinessAssessments.map((assessment) => {
                  const itemsForAssessment = readinessItems.filter((item) => item.readinessAssessmentId === assessment.id);
                  return (
                    <div key={assessment.id} className="rounded border border-slate-200 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-semibold text-slate-950">{assessment.title}</div>
                          <div className="text-xs text-slate-500">Captured {formatDate(assessment.createdAt)}</div>
                        </div>
                        <Badge variant="outline">{statusLabel(assessment.overallRating ?? "not_assessed")}</Badge>
                      </div>
                      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                        {itemsForAssessment.map((item) => (
                          <div key={item.id} className="rounded bg-slate-50 px-3 py-2 text-sm">
                            <div className="font-medium text-slate-950">{item.title}</div>
                            <div className="text-slate-600">{statusLabel(item.rating)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="swot">
          <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Capture SWOT Item</CardTitle>
                <p className="text-sm text-slate-600">Record strengths, weaknesses, opportunities or threats arising from review findings, readiness observations and review discussion.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>Review cycle</Label>
                  <Select value={selectedReviewCycleId || "__none"} onValueChange={(value) => {
                    const next = value === "__none" ? "" : value;
                    setSelectedReviewCycleId(next);
                    if (next) void loadReviewCycleDetail(next);
                    void loadReviewContextOptions(next);
                    void loadSwot(next);
                    void loadActions(next);
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select review cycle" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Select review cycle</SelectItem>
                      {reviewCycles.map((cycle) => <SelectItem key={cycle.id} value={cycle.id}>{cycle.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={swotForm.category} onValueChange={(category) => setSwotForm((current) => ({ ...current, category }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="strength">Strength</SelectItem>
                      <SelectItem value="weakness">Weakness</SelectItem>
                      <SelectItem value="opportunity">Opportunity</SelectItem>
                      <SelectItem value="threat">Threat</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={swotForm.title} onChange={(event) => setSwotForm((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Strong evidence of applied sustainability learning" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <textarea
                    className="min-h-24 w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500"
                    value={swotForm.description}
                    onChange={(event) => setSwotForm((current) => ({ ...current, description: event.target.value }))}
                    placeholder="Summarise the programme-level issue or strength"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rationale</Label>
                  <Input value={swotForm.rationale} onChange={(event) => setSwotForm((current) => ({ ...current, rationale: event.target.value }))} placeholder="Why this matters for programme enhancement" />
                </div>
                <div className="space-y-2">
                  <Label>Readiness observation</Label>
                  <Select value={swotForm.readinessAssessmentItemId || "__none"} onValueChange={(value) => setSwotForm((current) => ({ ...current, readinessAssessmentItemId: value === "__none" ? "" : value }))}>
                    <SelectTrigger><SelectValue placeholder="Optional readiness link" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">No readiness link</SelectItem>
                      {reviewContextOptions.readinessItems.map((item) => <SelectItem key={item.id} value={item.id}>{item.title} - {statusLabel(item.rating)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Review note</Label>
                  <Select value={swotForm.reviewNoteId || "__none"} onValueChange={(value) => setSwotForm((current) => ({ ...current, reviewNoteId: value === "__none" ? "" : value }))}>
                    <SelectTrigger><SelectValue placeholder="Optional review note link" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">No review note link</SelectItem>
                      {reviewContextOptions.reviewNotes.map((note) => <SelectItem key={note.id} value={note.id}>{note.title || note.body.slice(0, 50)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={createSwot} disabled={!selectedReviewCycleId || !swotForm.title.trim()}>
                  <ListChecks className="mr-2 h-4 w-4" />
                  Add SWOT item
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>SWOT Summary</CardTitle>
                  <p className="mt-1 text-sm text-slate-600">Traceable enhancement themes arising from findings, readiness and review discussion.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => { void loadReviewContextOptions(); void loadSwot(); }} disabled={!selectedProgrammeId}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
                  <Button variant="outline" onClick={() => exportSwot("json")} disabled={!selectedReviewCycleId}><Download className="mr-2 h-4 w-4" />JSON</Button>
                  <Button variant="outline" onClick={() => exportSwot("csv")} disabled={!selectedReviewCycleId}><Download className="mr-2 h-4 w-4" />CSV</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {swotItems.length === 0 && <p className="text-sm text-slate-500">No SWOT items have been captured for this programme context yet.</p>}
                {(["strength", "weakness", "opportunity", "threat"] as const).map((category) => {
                  const itemsForCategory = swotItems.filter((item) => item.itemType === category);
                  return (
                    <div key={category} className="rounded border border-slate-200 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="font-semibold text-slate-950">{category[0].toUpperCase() + category.slice(1)}</h3>
                        <Badge variant="outline">{itemsForCategory.length}</Badge>
                      </div>
                      <div className="space-y-2">
                        {itemsForCategory.length === 0 && <p className="text-sm text-slate-500">None recorded.</p>}
                        {itemsForCategory.map((item) => (
                          <div key={item.id} className="rounded bg-slate-50 px-3 py-2 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="font-medium text-slate-950">{item.title}</div>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="outline">{statusLabel(item.status)}</Badge>
                                <Button variant="outline" size="sm" onClick={() => updateSwotStatus(item.id, "reviewed")}>Reviewed</Button>
                                <Button variant="outline" size="sm" onClick={() => updateSwotStatus(item.id, "approved")}>Approve</Button>
                              </div>
                            </div>
                            {item.description && <p className="mt-1 text-slate-600">{item.description}</p>}
                            <div className="mt-2 flex flex-wrap gap-2 text-xs">
                              <Badge variant="secondary">Evidence {item.traceability?.evidenceCount ?? 0}</Badge>
                              <Badge variant="secondary">Claims {item.traceability?.claimCount ?? 0}</Badge>
                              <Badge variant="secondary">Findings {item.traceability?.findingCount ?? 0}</Badge>
                              <Badge variant="secondary">Readiness {item.traceability?.readinessCount ?? 0}</Badge>
                              <Badge variant="secondary">Notes {item.traceability?.reviewNoteCount ?? 0}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="actions">
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Create Enhancement Action</CardTitle>
                  <p className="text-sm text-slate-600">Convert findings, SWOT themes and readiness gaps into programme enhancement actions.</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label>Review cycle</Label>
                  <Select value={selectedReviewCycleId || "__none"} onValueChange={(value) => {
                    const next = value === "__none" ? "" : value;
                    setSelectedReviewCycleId(next);
                    if (next) void loadReviewCycleDetail(next);
                    void loadReviewContextOptions(next);
                    void loadSwot(next);
                    void loadActions(next);
                  }}>
                      <SelectTrigger><SelectValue placeholder="Select review cycle" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__none">Select review cycle</SelectItem>
                        {reviewCycles.map((cycle) => <SelectItem key={cycle.id} value={cycle.id}>{cycle.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={actionForm.title} onChange={(event) => setActionForm((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Strengthen assessment evidence in Stage 2" />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <textarea
                      className="min-h-24 w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500"
                      value={actionForm.description}
                      onChange={(event) => setActionForm((current) => ({ ...current, description: event.target.value }))}
                      placeholder="What will the programme team improve or clarify?"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Owner</Label>
                      <Input value={actionForm.owner} onChange={(event) => setActionForm((current) => ({ ...current, owner: event.target.value }))} placeholder="Named owner or team" />
                    </div>
                    <div className="space-y-2">
                      <Label>Target date</Label>
                      <Input type="date" value={actionForm.targetDate} onChange={(event) => setActionForm((current) => ({ ...current, targetDate: event.target.value }))} />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select value={actionForm.priority} onValueChange={(priority) => setActionForm((current) => ({ ...current, priority }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={actionForm.status} onValueChange={(status) => setActionForm((current) => ({ ...current, status }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="proposed">Proposed</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Link to SWOT</Label>
                    <Select value={actionForm.swotItemId || "__none"} onValueChange={(value) => setActionForm((current) => ({ ...current, swotItemId: value === "__none" ? "" : value }))}>
                      <SelectTrigger><SelectValue placeholder="Optional SWOT link" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">No SWOT link</SelectItem>
                        {swotItems.map((item) => <SelectItem key={item.id} value={item.id}>{item.categoryLabel ?? item.itemType}: {item.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Link to readiness observation</Label>
                    <Select value={actionForm.readinessAssessmentItemId || "__none"} onValueChange={(value) => setActionForm((current) => ({ ...current, readinessAssessmentItemId: value === "__none" ? "" : value }))}>
                      <SelectTrigger><SelectValue placeholder="Optional readiness link" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">No readiness link</SelectItem>
                        {reviewContextOptions.readinessItems.map((item) => <SelectItem key={item.id} value={item.id}>{item.title} - {statusLabel(item.rating)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Progress notes</Label>
                    <Input value={actionForm.progressNotes} onChange={(event) => setActionForm((current) => ({ ...current, progressNotes: event.target.value }))} placeholder="Initial note or success indicator" />
                  </div>
                  <Button onClick={createAction} disabled={!selectedReviewCycleId || !actionForm.title.trim()}>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Create action
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>Action Monitoring</CardTitle>
                    <p className="mt-1 text-sm text-slate-600">A programme enhancement view of open, overdue and completed actions.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => loadActions()} disabled={!selectedProgrammeId}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
                    <Button variant="outline" onClick={() => exportActions("json")} disabled={!selectedReviewCycleId}><Download className="mr-2 h-4 w-4" />JSON</Button>
                    <Button variant="outline" onClick={() => exportActions("csv")} disabled={!selectedReviewCycleId}><Download className="mr-2 h-4 w-4" />CSV</Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      ["Total actions", actionMonitoring?.totalActions ?? 0],
                      ["Open actions", actionMonitoring?.openActions ?? 0],
                      ["Overdue actions", actionMonitoring?.overdueActions ?? 0],
                      ["Completed", actionMonitoring?.completedActions ?? 0],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded border border-slate-200 p-3">
                        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
                        <div className="mt-1 text-2xl font-semibold text-slate-950">{value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-4 lg:grid-cols-3">
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-slate-950">By priority</h3>
                      <div className="space-y-2">
                        {Object.entries(actionMonitoring?.byPriority ?? {}).map(([key, value]) => <Badge key={key} variant="secondary" className="mr-2">{statusLabel(key)}: {value}</Badge>)}
                      </div>
                    </div>
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-slate-950">By status</h3>
                      <div className="space-y-2">
                        {Object.entries(actionMonitoring?.byStatus ?? {}).map(([key, value]) => <Badge key={key} variant="secondary" className="mr-2">{statusLabel(key)}: {value}</Badge>)}
                      </div>
                    </div>
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-slate-950">By owner</h3>
                      <div className="space-y-2">
                        {Object.entries(actionMonitoring?.byOwner ?? {}).slice(0, 5).map(([key, value]) => <Badge key={key} variant="secondary" className="mr-2">{key}: {value}</Badge>)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle>Enhancement Actions</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {actionItems.length === 0 && <p className="text-sm text-slate-500">No enhancement actions have been created for this programme context yet.</p>}
                {actionItems.map((item) => (
                  <div key={item.id} className="rounded border border-slate-200 p-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-950">{item.title}</h3>
                          <Badge variant="outline">{statusLabel(item.priority)}</Badge>
                          <Badge variant={item.displayStatus === "completed" ? "outline" : "secondary"}>{item.displayStatusLabel}</Badge>
                        </div>
                        {item.description && <p className="mt-1 text-sm text-slate-600">{item.description}</p>}
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                          <span>Owner: {item.ownerName || "Unassigned"}</span>
                          <span>Target: {formatDate(item.dueAt)}</span>
                          {item.progressNotes && <span>Progress: {item.progressNotes}</span>}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="secondary">SWOT {item.traceability?.swotCount ?? 0}</Badge>
                          <Badge variant="secondary">Findings {item.traceability?.findingCount ?? 0}</Badge>
                          <Badge variant="secondary">Readiness {item.traceability?.readinessCount ?? 0}</Badge>
                          <Badge variant="secondary">Evidence {item.traceability?.evidenceCount ?? 0}</Badge>
                          <Badge variant="secondary">Notes {item.traceability?.reviewNoteCount ?? 0}</Badge>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => updateActionStatus(item.id, "approved")}>Approve</Button>
                        <Button variant="outline" size="sm" onClick={() => updateActionStatus(item.id, "in_progress")}>Start</Button>
                        <Button variant="outline" size="sm" onClick={() => updateActionStatus(item.id, "completed")}>Complete</Button>
                        <Button variant="outline" size="sm" onClick={() => updateActionStatus(item.id, "closed")}>Close</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="quality">
          <Card>
            <CardHeader><CardTitle>Programme Data Quality</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" onClick={runQuality} disabled={!selectedProgrammeId}><ListChecks className="mr-2 h-4 w-4" />Run checks</Button>
              <pre className="max-h-96 overflow-auto rounded bg-slate-950 p-4 text-xs text-slate-100">{quality ? JSON.stringify(quality, null, 2) : "No quality run yet."}</pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="map">
          <Card>
            <CardHeader><CardTitle>Map-Ready Preview</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" onClick={loadMapPreview} disabled={!selectedProgrammeId}><MapIcon className="mr-2 h-4 w-4" />Load preview</Button>
              <div className="overflow-auto rounded border border-slate-200">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500"><tr><th className="p-2">Stage</th><th className="p-2">Semester</th><th className="p-2">Module</th><th className="p-2">Core</th><th className="p-2">Credits</th><th className="p-2">Descriptor</th></tr></thead>
                  <tbody>
                    {(preview?.rows ?? []).map((row, index) => (
                      <tr key={String(row.structureItemId ?? index)} className="border-t">
                        <td className="p-2">{String(row.stage ?? "")}</td>
                        <td className="p-2">{String(row.semester ?? "")}</td>
                        <td className="p-2">{String(row.moduleCode ?? "")} {String(row.moduleTitle ?? "")}</td>
                        <td className="p-2">{String(row.coreOption ?? "")}</td>
                        <td className="p-2">{String(row.credits ?? "")}</td>
                        <td className="p-2">{String(row.descriptorStatus ?? "")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      {confirmArchive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-950">Archive programme version?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This archives the selected draft programme version and its generated structure. It does not delete source uploads, framework seeds, users, institutions or audit events.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmArchive(false)}>Cancel</Button>
              <Button className="bg-blue-950 hover:bg-blue-900" onClick={() => void archiveSelectedProgramme()}>Archive programme</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
