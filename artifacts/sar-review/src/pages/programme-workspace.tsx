import { useEffect, useMemo, useState } from "react";
import { Archive, ArrowRight, BookOpenCheck, FileSearch, GitCompareArrows, Layers3, Library, ListChecks, Map, RefreshCw, Save, ShieldCheck } from "lucide-react";
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
  const [confirmArchive, setConfirmArchive] = useState(false);

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
  }, []);

  useEffect(() => {
    if (!selectedProgrammeId) {
      setOverview(null);
      return;
    }
    void loadOverview();
  }, [selectedProgrammeId]);

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
          <p className="mt-2 max-w-3xl text-sm text-slate-600">Create curated programme versions from ingested source data and prepare structures for maps.</p>
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
          <TabsTrigger value="quality"><ListChecks className="mr-2 h-4 w-4" />Quality</TabsTrigger>
          <TabsTrigger value="map"><Map className="mr-2 h-4 w-4" />Map preview</TabsTrigger>
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
          <Card>
            <CardHeader><CardTitle>Source Versus Curated</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" onClick={loadComparison} disabled={!selectedProgrammeId}><GitCompareArrows className="mr-2 h-4 w-4" />Load comparison</Button>
              <pre className="max-h-96 overflow-auto rounded bg-slate-950 p-4 text-xs text-slate-100">{comparison ? JSON.stringify(comparison, null, 2) : "No comparison loaded."}</pre>
            </CardContent>
          </Card>
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
              <Button variant="outline" onClick={loadMapPreview} disabled={!selectedProgrammeId}><Map className="mr-2 h-4 w-4" />Load preview</Button>
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
