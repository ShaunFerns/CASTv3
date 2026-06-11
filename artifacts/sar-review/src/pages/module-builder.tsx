import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  Layers,
  Lightbulb,
  Puzzle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ModuleSummary = {
  id: string;
  recordKind: "canonical" | "source_only";
  moduleId?: string;
  sourceModuleId?: string;
  moduleCode?: string | null;
  moduleTitle?: string | null;
  credits?: number | null;
  stage?: string | null;
  semester?: string | null;
  programmes: Array<{ code?: string | null; name?: string | null }>;
  descriptorStatus: string;
  evidenceCount: number;
  assessmentComponentCount: number;
  modalitySummary?: string | null;
  dataQualityFlags: Array<{ id: string; title: string; severity: string; status: string }>;
  sourceLabel: string;
};

type ModuleBuilderDetail = {
  module: ModuleSummary;
  descriptors: Array<{ id: string; versionLabel: string; status: string; sourceType?: string | null }>;
  descriptorSections: Array<{ id: string; sectionType: string; title?: string | null; content?: string | null; orderIndex: number }>;
  learningOutcomes: Array<{ id: string; outcomeCode?: string | null; outcomeText?: string | null; status: string }>;
  evidenceItems: Array<{ id: string; sourceKind: string; evidenceText?: string | null; status: string; confidence?: number | null }>;
  assessmentComponents: Array<{
    id: string;
    componentName?: string | null;
    componentType?: string | null;
    assessmentMode?: string | null;
    weighting?: number | null;
    description?: string | null;
    status: string;
  }>;
  frameworkEvidenceSummary: Array<{
    key: string;
    name: string;
    evaluationCount: number;
    evidenceLinkCount: number;
    maturityDistribution: Record<string, number>;
    reviewStatusCounts: Record<string, number>;
    competencies: Array<{
      id?: string | null;
      name: string;
      domain?: string | null;
      observedLevel: string;
      status: string;
      source: string;
      evidenceLinkCount: number;
      rationale?: string | null;
    }>;
  }>;
  assessmentDesignSummary: DesignSummary;
  modalityDesignSummary: DesignSummary;
  udlFoundation: Array<{ key: string; name: string; description: string; evidenceCount: number; status: "placeholder" }>;
  dataQualityIndicators: ModuleSummary["dataQualityFlags"];
  improvementPrompts: Array<{
    title: string;
    explanation: string;
    relatedSection: string;
    priority: "low" | "medium" | "high";
    evidenceCount: number;
  }>;
  nextSteps: string[];
};

type EvidenceClaim = {
  id: string;
  title?: string | null;
  claimText: string;
  rationale?: string | null;
  confidence?: number | null;
  claimType: string;
  status: string;
  framework?: { key?: string | null; name?: string | null; versionLabel?: string | null };
  lens?: { key?: string | null; name?: string | null; versionLabel?: string | null };
  competency?: { id?: string | null; key?: string | null; name?: string | null; domain?: string | null };
  analysisRun: {
    id: string;
    status: string;
    startedAt?: string | null;
    completedAt?: string | null;
    model?: string | null;
    provider?: string | null;
    promptVersion?: string | null;
  };
  evidence: Array<{
    id: string;
    sourceKind: string;
    evidenceText?: string | null;
    descriptorSectionId?: string | null;
    learningOutcomeId?: string | null;
    assessmentComponentId?: string | null;
    documentSectionId?: string | null;
    relevance?: number | null;
    relationship: string;
  }>;
  review: {
    status: ClaimReviewStatus;
    isInstitutionalFinding: boolean;
    findingText?: string | null;
    latestReview?: ClaimReview | null;
  };
  reviewHistory: ClaimReview[];
  createdAt?: string | null;
};

type ClaimReviewStatus = "not_reviewed" | "accepted" | "rejected" | "amended" | "clarification_required" | "not_applicable";
type ClaimReviewDecision = "accept" | "reject" | "amend" | "request_clarification" | "not_applicable";

type ClaimReview = {
  id: string;
  decision: ClaimReviewDecision;
  status: ClaimReviewStatus;
  rationale?: string | null;
  amendedText?: string | null;
  reviewer?: { id?: string | null; name?: string | null; email?: string | null };
  createdAt?: string | null;
};

type ClaimReviewResponse = {
  claim: EvidenceClaim;
  review: ClaimReview;
  message: string;
};

type ModuleClaimsResponse = {
  claims: EvidenceClaim[];
  total: number;
};

type ClaimGenerationResponse = {
  analysisRunId?: string;
  claimsCreated: number;
  claimsSkipped: number;
  evidenceConsidered: number;
  message: string;
  claims: EvidenceClaim[];
};

type DesignSummary = {
  evaluationCount: number;
  evidenceLinkCount: number;
  maturityDistribution: Record<string, number>;
  reviewStatusCounts: Record<string, number>;
};

const builderLayers = [
  {
    title: "Modality",
    description: "Module-level decision support for delivery options, feasibility, risk and human approval.",
    status: "Foundation",
    icon: Layers,
  },
  {
    title: "UDL",
    description: "Evidence containers for Engagement, Representation, and Action & Expression.",
    status: "Foundation",
    icon: ShieldCheck,
  },
  {
    title: "Assessment Design",
    description: "Module-level support for assessment clarity, alignment, balance and feedback evidence.",
    status: "Foundation",
    icon: ClipboardCheck,
  },
  {
    title: "Framework Alignment",
    description: "Design guidance for strengthening evidence against selected programme and framework layers.",
    status: "Future",
    icon: Puzzle,
  },
];

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { credentials: "include", ...init });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message ?? `Request failed with ${response.status}`);
  return payload as T;
}

function selectedModuleId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("moduleId") ?? params.get("sourceModuleId");
}

function programmeLabel(module: ModuleSummary) {
  return module.programmes.map((programme) => programme.name ?? programme.code).filter(Boolean).join(", ") || "No programme link";
}

function maturityText(distribution: Record<string, number>) {
  const order = ["none", "developing", "consolidating", "leading"];
  const parts = order.map((key) => [key, distribution[key] ?? 0] as const).filter(([, value]) => value > 0);
  return parts.length ? parts.map(([key, value]) => `${key}: ${value}`).join(", ") : "No maturity observations";
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base text-slate-950">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">{text}</div>;
}

function DesignSummaryPanel({ title, summary }: { title: string; summary: DesignSummary }) {
  return (
    <div className="rounded border border-slate-200 bg-white p-4">
      <div className="font-semibold text-slate-950">{title}</div>
      <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
        <span>{summary.evaluationCount} observations</span>
        <span>{summary.evidenceLinkCount} evidence links</span>
        <span>{maturityText(summary.maturityDistribution)}</span>
      </div>
    </div>
  );
}

function AssessmentVisualSummary({ components }: { components: ModuleBuilderDetail["assessmentComponents"] }) {
  const totalWeight = components.reduce((sum, component) => sum + (Number(component.weighting) || 0), 0);
  const byType = components.reduce<Record<string, number>>((acc, component) => {
    const key = component.componentType || component.assessmentMode || "Unspecified";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const largestWeight = Math.max(1, ...components.map((component) => Number(component.weighting) || 0));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded border border-slate-200 bg-white p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Total weighting</div>
          <div className={`mt-1 text-2xl font-semibold ${totalWeight === 100 ? "text-emerald-700" : "text-amber-700"}`}>{totalWeight}%</div>
        </div>
        <div className="rounded border border-slate-200 bg-white p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Components</div>
          <div className="mt-1 text-2xl font-semibold text-slate-950">{components.length}</div>
        </div>
        <div className="rounded border border-slate-200 bg-white p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Assessment types</div>
          <div className="mt-1 text-2xl font-semibold text-slate-950">{Object.keys(byType).length}</div>
        </div>
      </div>
      <div>
        <div className="mb-2 text-sm font-semibold text-slate-950">Weighting distribution</div>
        <div className="space-y-2">
          {components.length === 0 && <EmptyState text="No assessment components are available for visualisation." />}
          {components.map((component) => {
            const weighting = Number(component.weighting) || 0;
            return (
              <div key={component.id} className="grid gap-2 text-sm sm:grid-cols-[160px_1fr_56px] sm:items-center">
                <span className="truncate text-slate-700">{component.componentName ?? component.componentType ?? "Assessment component"}</span>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(4, (weighting / largestWeight) * 100)}%` }} />
                </div>
                <span className="text-right text-slate-600">{weighting || "-"}%</span>
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <div className="mb-2 text-sm font-semibold text-slate-950">Type distribution</div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(byType).map(([type, count]) => (
            <Badge key={type} variant="outline" className="bg-slate-50">{type}: {count}</Badge>
          ))}
          {Object.keys(byType).length === 0 && <Badge variant="outline">No assessment type evidence</Badge>}
        </div>
      </div>
    </div>
  );
}

function priorityClass(priority: "low" | "medium" | "high") {
  if (priority === "high") return "border-rose-200 bg-rose-50 text-rose-800";
  if (priority === "medium") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function confidenceLabel(value: number | null | undefined) {
  return typeof value === "number" ? `${Math.round(value * 100)}% confidence` : "Confidence not recorded";
}

function reviewStatusLabel(status: ClaimReviewStatus) {
  const labels: Record<ClaimReviewStatus, string> = {
    not_reviewed: "Not Reviewed",
    accepted: "Accepted",
    rejected: "Rejected",
    amended: "Amended",
    clarification_required: "Clarification Required",
    not_applicable: "Not Applicable",
  };
  return labels[status];
}

function reviewStatusClass(status: ClaimReviewStatus) {
  if (status === "accepted" || status === "amended") return "bg-emerald-100 text-emerald-800 hover:bg-emerald-100";
  if (status === "rejected" || status === "not_applicable") return "bg-slate-100 text-slate-700 hover:bg-slate-100";
  if (status === "clarification_required") return "bg-amber-100 text-amber-800 hover:bg-amber-100";
  return "bg-violet-100 text-violet-800 hover:bg-violet-100";
}

function shortRunId(id: string) {
  return id.slice(0, 8);
}

function FoundationOnly() {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Design Workflow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-5">
            {["Module Descriptor", "Evidence Review", "Design Guidance", "Improvement Suggestions", "Human Decision"].map((step, index) => (
              <div key={step} className="rounded border border-slate-200 bg-white p-4">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-cyan-100 text-sm font-bold text-cyan-800">{index + 1}</div>
                <div className="text-sm font-semibold text-slate-900">{step}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {builderLayers.map((layer) => {
          const Icon = layer.icon;
          return (
            <Card key={layer.title}>
              <CardContent className="flex gap-4 p-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-cyan-100 text-cyan-800">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-slate-900">{layer.title}</h2>
                    <Badge variant="outline">{layer.status}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{layer.description}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}

export default function ModuleBuilder() {
  const [detail, setDetail] = useState<ModuleBuilderDetail | null>(null);
  const [claims, setClaims] = useState<EvidenceClaim[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [claimsMessage, setClaimsMessage] = useState<string | null>(null);
  const [claimsError, setClaimsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [generatingClaims, setGeneratingClaims] = useState(false);
  const [reviewingClaimId, setReviewingClaimId] = useState<string | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, { rationale: string; amendedText: string }>>({});

  async function loadClaims(moduleId: string) {
    setClaimsLoading(true);
    setClaimsError(null);
    try {
      const result = await api<ModuleClaimsResponse>(`/api/claims/modules/${encodeURIComponent(moduleId)}`);
      setClaims(result.claims);
    } catch (err) {
      setClaimsError(err instanceof Error ? err.message : "Evidence claims could not be loaded.");
    } finally {
      setClaimsLoading(false);
    }
  }

  useEffect(() => {
    const id = selectedModuleId();
    if (!id) return;
    const selectedId = id;

    let cancelled = false;
    async function loadDetail() {
      setLoading(true);
      setError(null);
      try {
        const result = await api<ModuleBuilderDetail>(`/api/curriculum/modules/${encodeURIComponent(selectedId)}/builder-detail`);
        if (!cancelled) {
          setDetail(result);
          if (result.module.moduleId) void loadClaims(result.module.moduleId);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Selected module could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, []);

  async function generateClaims() {
    if (!module?.moduleId) return;
    setGeneratingClaims(true);
    setClaimsError(null);
    setClaimsMessage(null);
    try {
      const result = await api<ClaimGenerationResponse>(`/api/claims/modules/${encodeURIComponent(module.moduleId)}/generate`, { method: "POST" });
      setClaims(result.claims);
      setClaimsMessage(result.message);
    } catch (err) {
      setClaimsError(err instanceof Error ? err.message : "GreenComp claims could not be generated.");
    } finally {
      setGeneratingClaims(false);
    }
  }

  async function submitClaimReview(claim: EvidenceClaim, decision: ClaimReviewDecision) {
    const draft = reviewDrafts[claim.id] ?? { rationale: "", amendedText: "" };
    setReviewingClaimId(claim.id);
    setClaimsError(null);
    setClaimsMessage(null);
    try {
      const result = await api<ClaimReviewResponse>(`/api/claims/${encodeURIComponent(claim.id)}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          rationale: draft.rationale,
          amendedText: draft.amendedText,
        }),
      });
      setClaims((current) => current.map((candidate) => candidate.id === result.claim.id ? result.claim : candidate));
      setClaimsMessage(result.message);
    } catch (err) {
      setClaimsError(err instanceof Error ? err.message : "Claim review could not be recorded.");
    } finally {
      setReviewingClaimId(null);
    }
  }

  const module = detail?.module;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge className="bg-cyan-100 text-cyan-800 hover:bg-cyan-100">Module-level design support</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight" style={{ color: "#003865" }}>Module Builder</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Inspect module evidence, assessment and design signals before any human-reviewed improvement work.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/module-library">Module Library</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/ingestion">
              Upload Curriculum
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {loading && <EmptyState text="Loading module evidence..." />}
      {error && <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}

      {module ? (
        <>
          <Card className="border-blue-100 bg-blue-50/50">
            <CardContent className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Selected module</Badge>
                    <Badge variant="outline">{module.sourceLabel}</Badge>
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold text-slate-950">
                    {module.moduleCode ?? "No code"}: {module.moduleTitle ?? "Untitled module"}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {programmeLabel(module)} | Stage {module.stage ?? "-"} | Semester {module.semester ?? "-"} | {module.credits ?? "-"} credits
                  </p>
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-2 lg:min-w-[360px]">
                  <Badge variant="outline">Descriptor: {module.descriptorStatus.replace(/_/g, " ")}</Badge>
                  <Badge variant="outline">{module.evidenceCount} evidence items</Badge>
                  <Badge variant="outline">{module.assessmentComponentCount} assessment components</Badge>
                  {module.modalitySummary && <Badge variant="outline">Modality evidence</Badge>}
                  <Badge variant="outline">{module.dataQualityFlags.length} quality flags</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
            <div className="space-y-6">
              <SectionCard title="Module Overview">
                <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <span><strong>Code:</strong> {module.moduleCode ?? "-"}</span>
                  <span><strong>Title:</strong> {module.moduleTitle ?? "-"}</span>
                  <span><strong>Credits:</strong> {module.credits ?? "-"}</span>
                  <span><strong>Status:</strong> {module.recordKind === "source_only" ? "Imported source only" : "Curated module"}</span>
                </div>
              </SectionCard>

              <SectionCard title="Descriptor Evidence">
                {detail.descriptorSections.length > 0 ? (
                  <div className="space-y-3">
                    {detail.descriptorSections.map((section) => (
                      <div key={section.id} className="rounded border border-slate-200 bg-white p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{section.sectionType.replace(/_/g, " ")}</Badge>
                          <span className="font-semibold text-slate-950">{section.title ?? "Descriptor section"}</span>
                        </div>
                        <p className="mt-2 line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-slate-600">{section.content || "No section text."}</p>
                      </div>
                    ))}
                  </div>
                ) : <EmptyState text="No descriptor sections are available for this module yet." />}
              </SectionCard>

              <SectionCard title="Learning Outcomes">
                {detail.learningOutcomes.length > 0 ? (
                  <div className="space-y-3">
                    {detail.learningOutcomes.map((outcome, index) => (
                      <div key={outcome.id} className="rounded border border-slate-200 bg-white p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{outcome.outcomeCode || `LO${index + 1}`}</Badge>
                          <Badge variant="secondary">{outcome.status}</Badge>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                          {outcome.outcomeText || "No learning outcome text is available."}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : <EmptyState text="No structured learning outcomes are available yet." />}
              </SectionCard>

              <SectionCard title="Assessment Components">
                {detail.assessmentComponents.length > 0 ? (
                  <div className="space-y-3">
                    {detail.assessmentComponents.map((component) => (
                      <div key={component.id} className="rounded border border-slate-200 bg-white p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{component.status}</Badge>
                          <span className="font-semibold text-slate-950">{component.componentName ?? "Assessment component"}</span>
                        </div>
                        <div className="mt-2 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                          <span>Type: {component.componentType ?? "-"}</span>
                          <span>Mode: {component.assessmentMode ?? "-"}</span>
                          <span>Weighting: {component.weighting ?? "-"}%</span>
                        </div>
                        {component.description && <p className="mt-2 text-sm leading-6 text-slate-600">{component.description}</p>}
                      </div>
                    ))}
                  </div>
                ) : <EmptyState text="No structured assessment components are available yet." />}
              </SectionCard>

              <SectionCard title="Assessment Visual Summary">
                <AssessmentVisualSummary components={detail.assessmentComponents} />
              </SectionCard>

              <SectionCard title="Framework Evidence Summary">
                <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Framework observations are evidence summaries for review. GreenComp claim generation is available below; DigComp and EntreComp are currently surfaced as evidence summaries until claim generation is extended.
                </div>
                <div className="space-y-4">
                  {["greencomp", "digcomp", "entrecomp"].map((key) => detail.frameworkEvidenceSummary.find((framework) => framework.key === key) ?? {
                      key,
                      name: key === "greencomp" ? "GreenComp" : key === "digcomp" ? "DigComp" : "EntreComp",
                      evaluationCount: 0,
                      evidenceLinkCount: 0,
                      maturityDistribution: {},
                      reviewStatusCounts: {},
                      competencies: [],
                    }).map((framework) => (
                    <div key={framework.key} className="rounded border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-semibold text-slate-950">{framework.name}</h3>
                        <Badge variant="outline">{framework.evaluationCount} observations</Badge>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{framework.evidenceLinkCount} linked evidence references | {maturityText(framework.maturityDistribution)}</p>
                      <div className="mt-3 space-y-2">
                        {framework.competencies.length === 0 && (
                          <div className="rounded bg-slate-50 px-3 py-2 text-sm text-slate-500">
                            No {framework.name} evidence observations are available for this module yet.
                          </div>
                        )}
                        {framework.competencies.slice(0, 6).map((competency, index) => (
                          <div key={`${competency.id ?? competency.name}-${index}`} className="rounded bg-slate-50 px-3 py-2 text-sm">
                            <div className="font-medium text-slate-800">{competency.name}</div>
                            <div className="text-xs text-slate-500">{competency.domain ?? "No domain"} | {competency.observedLevel} | {competency.status}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Evidence Claims">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="text-sm leading-6 text-slate-600">
                    Provisional GreenComp claims link module evidence to a traceable analysis run. They are not institutional findings.
                  </div>
                  <Button
                    type="button"
                    className="bg-blue-950 hover:bg-blue-900"
                    disabled={!module.moduleId || generatingClaims}
                    onClick={() => void generateClaims()}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    {generatingClaims ? "Generating..." : "Generate GreenComp Claims"}
                  </Button>
                </div>
                {claimsMessage && <div className="mb-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{claimsMessage}</div>}
                {claimsError && <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{claimsError}</div>}
                {claimsLoading ? (
                  <EmptyState text="Loading evidence claims..." />
                ) : claims.length > 0 ? (
                  <div className="space-y-4">
                    {claims.map((claim) => (
                      <div key={claim.id} className="rounded border border-slate-200 bg-white p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={claim.review.isInstitutionalFinding ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : "bg-violet-100 text-violet-800 hover:bg-violet-100"}>
                            {claim.review.isInstitutionalFinding ? "Reviewed finding" : "AI-supported claim"}
                          </Badge>
                          <Badge className={reviewStatusClass(claim.review.status)}>Review: {reviewStatusLabel(claim.review.status)}</Badge>
                          <Badge variant="outline">{claim.framework?.name ?? "Framework"} {claim.framework?.versionLabel ?? ""}</Badge>
                          <Badge variant="outline">{confidenceLabel(claim.confidence)}</Badge>
                        </div>
                        <h3 className="mt-3 font-semibold text-slate-950">{claim.title ?? "Evidence claim"}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-700">{claim.claimText}</p>
                        {claim.review.isInstitutionalFinding && claim.review.findingText && (
                          <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                            <div className="font-semibold">Reviewed Finding</div>
                            <p className="mt-1 leading-6">{claim.review.findingText}</p>
                          </div>
                        )}
                        {claim.rationale && <p className="mt-2 text-sm leading-6 text-slate-600">{claim.rationale}</p>}
                        <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-3">
                          <span>Analysis run: {shortRunId(claim.analysisRun.id)}</span>
                          <span>Model: {claim.analysisRun.model ?? "not recorded"}</span>
                          <span>Prompt: {claim.analysisRun.promptVersion ?? "not recorded"}</span>
                        </div>
                        <div className="mt-4 space-y-2">
                          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <FileSearch className="h-4 w-4" />
                            Supporting evidence ({claim.evidence.length})
                          </div>
                          {claim.evidence.map((item) => (
                            <div key={item.id} className="rounded bg-slate-50 px-3 py-2 text-sm text-slate-600">
                              <div className="mb-1 flex flex-wrap gap-2">
                                <Badge variant="outline" className="bg-white">{item.sourceKind.replace(/_/g, " ")}</Badge>
                                {item.descriptorSectionId && <Badge variant="outline" className="bg-white">descriptor section</Badge>}
                                {item.learningOutcomeId && <Badge variant="outline" className="bg-white">learning outcome</Badge>}
                                {item.assessmentComponentId && <Badge variant="outline" className="bg-white">assessment component</Badge>}
                              </div>
                              <p className="leading-5">{item.evidenceText ?? "Evidence text is not available for preview."}</p>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-950">Human Review</div>
                              <p className="mt-1 text-sm text-slate-600">Review the claim with its evidence visible. The original claim text is preserved.</p>
                            </div>
                            <Badge variant="outline" className="bg-white">{claim.reviewHistory.length} review{claim.reviewHistory.length === 1 ? "" : "s"}</Badge>
                          </div>
                          <div className="mt-3 grid gap-3">
                            <textarea
                              className="min-h-20 rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
                              placeholder="Review rationale or clarification question..."
                              value={reviewDrafts[claim.id]?.rationale ?? ""}
                              onChange={(event) => setReviewDrafts((current) => ({
                                ...current,
                                [claim.id]: { rationale: event.target.value, amendedText: current[claim.id]?.amendedText ?? "" },
                              }))}
                            />
                            <textarea
                              className="min-h-20 rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
                              placeholder="Amended finding text, used only when choosing Amend..."
                              value={reviewDrafts[claim.id]?.amendedText ?? ""}
                              onChange={(event) => setReviewDrafts((current) => ({
                                ...current,
                                [claim.id]: { rationale: current[claim.id]?.rationale ?? "", amendedText: event.target.value },
                              }))}
                            />
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" type="button" disabled={reviewingClaimId === claim.id} onClick={() => void submitClaimReview(claim, "accept")}>Accept</Button>
                              <Button size="sm" type="button" variant="outline" disabled={reviewingClaimId === claim.id} onClick={() => void submitClaimReview(claim, "reject")}>Reject</Button>
                              <Button size="sm" type="button" variant="outline" disabled={reviewingClaimId === claim.id} onClick={() => void submitClaimReview(claim, "amend")}>Amend</Button>
                              <Button size="sm" type="button" variant="outline" disabled={reviewingClaimId === claim.id} onClick={() => void submitClaimReview(claim, "request_clarification")}>Request Clarification</Button>
                              <Button size="sm" type="button" variant="outline" disabled={reviewingClaimId === claim.id} onClick={() => void submitClaimReview(claim, "not_applicable")}>Not Applicable</Button>
                            </div>
                          </div>
                          {claim.reviewHistory.length > 0 && (
                            <div className="mt-4 space-y-2">
                              <div className="text-sm font-semibold text-slate-900">Review History</div>
                              {claim.reviewHistory.map((review) => (
                                <div key={review.id} className="rounded bg-white px-3 py-2 text-sm text-slate-600">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge className={reviewStatusClass(review.status)}>{reviewStatusLabel(review.status)}</Badge>
                                    <span>{review.reviewer?.name ?? review.reviewer?.email ?? "Reviewer"}</span>
                                    <span>{review.createdAt ? new Date(review.createdAt).toLocaleString() : ""}</span>
                                  </div>
                                  {review.rationale && <p className="mt-2 leading-5">{review.rationale}</p>}
                                  {review.amendedText && <p className="mt-2 leading-5"><strong>Amended text:</strong> {review.amendedText}</p>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState text={module.moduleId ? "No evidence claims have been generated for this module yet." : "Create or reconcile a curated module before generating evidence claims."} />
                )}
              </SectionCard>
            </div>

            <aside className="space-y-6">
              <SectionCard title="Assessment Design Summary">
                <DesignSummaryPanel title="Assessment design" summary={detail.assessmentDesignSummary} />
              </SectionCard>

              <SectionCard title="Modality Design Summary">
                <DesignSummaryPanel title="Modality design" summary={detail.modalityDesignSummary} />
              </SectionCard>

              <SectionCard title="UDL Foundation">
                <div className="space-y-3">
                  {detail.udlFoundation.map((area) => (
                    <div key={area.key} className="rounded border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold text-slate-950">{area.name}</div>
                        <Badge variant="outline">{area.evidenceCount} signals</Badge>
                      </div>
                      <p className="mt-2 text-sm leading-5 text-slate-600">{area.description}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Data Quality Indicators">
                {detail.dataQualityIndicators.length > 0 ? (
                  <div className="space-y-2">
                    {detail.dataQualityIndicators.map((flag) => (
                      <div key={flag.id} className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        <div className="font-semibold">{flag.title}</div>
                        <div className="text-xs">{flag.severity} | {flag.status}</div>
                      </div>
                    ))}
                  </div>
                ) : <EmptyState text="No data quality indicators are currently linked to this module." />}
              </SectionCard>

              <SectionCard title="Improvement Prompts">
                {detail.improvementPrompts.length > 0 ? (
                  <div className="space-y-3">
                    {detail.improvementPrompts.map((prompt) => (
                      <div key={`${prompt.relatedSection}-${prompt.title}`} className={`rounded border p-3 ${priorityClass(prompt.priority)}`}>
                        <div className="flex items-start gap-3">
                          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
                          <div>
                            <div className="font-semibold">{prompt.title}</div>
                            <p className="mt-1 text-sm leading-5 opacity-90">{prompt.explanation}</p>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs">
                              <Badge variant="outline" className="bg-white/70">{prompt.relatedSection}</Badge>
                              <Badge variant="outline" className="bg-white/70">{prompt.priority} priority</Badge>
                              <Badge variant="outline" className="bg-white/70">{prompt.evidenceCount} source{prompt.evidenceCount === 1 ? "" : "s"}</Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <EmptyState text="No deterministic improvement prompts are currently suggested for this module." />}
              </SectionCard>

              <SectionCard title="Next Steps">
                <div className="space-y-3">
                  {detail.nextSteps.map((step) => (
                    <div key={step} className="flex gap-3 text-sm text-slate-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </aside>
          </div>
        </>
      ) : (
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
              <div className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-cyan-100 text-cyan-800">
                  <BookOpen className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-950">Open a module from the Module Library</h2>
                  <p className="mt-1 text-sm text-slate-600">Select an uploaded module to inspect descriptor evidence, assessments, framework observations and UDL containers.</p>
                </div>
              </div>
              <Button asChild className="bg-blue-950 hover:bg-blue-900">
                <Link href="/module-library">
                  Browse Module Library
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
          <FoundationOnly />
        </div>
      )}
    </div>
  );
}
