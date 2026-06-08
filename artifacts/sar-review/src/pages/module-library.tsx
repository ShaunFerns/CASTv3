import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Archive, ArrowRight, BookOpen, Database, Filter, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ModuleLibraryItem = {
  id: string;
  recordKind: "canonical" | "source_only";
  moduleId?: string;
  sourceModuleId?: string;
  moduleCode?: string | null;
  moduleTitle?: string | null;
  credits?: number | null;
  stage?: string | null;
  semester?: string | null;
  programmes: Array<{ id?: string; code?: string | null; name?: string | null; source: "source" | "curated" }>;
  uploads: Array<{ id: string; label: string; status?: string | null; createdAt?: string | null }>;
  descriptorStatus: string;
  descriptorCount: number;
  evidenceCount: number;
  assessmentComponentCount: number;
  modalitySummary?: string | null;
  dataQualityFlags: Array<{ id: string; title: string; severity: string; status: string }>;
  sourceLabel: string;
  updatedAt?: string | null;
};

type ModuleLibraryResponse = {
  modules: ModuleLibraryItem[];
  total: number;
};

type ImportBatchSummary = {
  id: string;
  label: string;
  type: string;
  status: string;
  createdAt?: string | null;
  completedAt?: string | null;
  counts: {
    sourceModules: number;
    modules: number;
    sourceProgrammes: number;
    programmeVersions: number;
    structureItems: number;
  };
};

type CleanupConfirmation = {
  title: string;
  message: string;
  confirmLabel: string;
  action: () => Promise<void>;
};

const allValue = "__all__";

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "include", ...(options ?? {}) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message ?? `Request failed with ${response.status}`);
  return payload as T;
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))]
    .sort((a, b) => a.localeCompare(b));
}

function programmeLabel(module: ModuleLibraryItem) {
  if (module.programmes.length === 0) return "No programme link";
  return module.programmes
    .map((programme) => programme.name ?? programme.code ?? "Unnamed programme")
    .filter(Boolean)
    .join(", ");
}

function uploadLabel(module: ModuleLibraryItem) {
  if (module.uploads.length === 0) return "No upload link";
  return module.uploads.map((upload) => upload.label).join(", ");
}

function builderHref(module: ModuleLibraryItem) {
  if (module.moduleId) return `/module-builder?moduleId=${encodeURIComponent(module.moduleId)}`;
  if (module.sourceModuleId) return `/module-builder?sourceModuleId=${encodeURIComponent(module.sourceModuleId)}`;
  return "/module-builder";
}

function statusBadgeClass(status: string) {
  if (status === "active") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "missing" || status === "source_only") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

export default function ModuleLibrary() {
  const [modules, setModules] = useState<ModuleLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [programme, setProgramme] = useState(allValue);
  const [stage, setStage] = useState(allValue);
  const [semester, setSemester] = useState(allValue);
  const [upload, setUpload] = useState(allValue);
  const [importBatches, setImportBatches] = useState<ImportBatchSummary[]>([]);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);
  const [cleanupError, setCleanupError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<CleanupConfirmation | null>(null);

  async function loadImportBatches(cancelled = false) {
    try {
      const result = await api<{ importBatches: ImportBatchSummary[] }>("/api/cleanup/import-batches");
      if (!cancelled) setImportBatches(result.importBatches ?? []);
    } catch {
      if (!cancelled) setImportBatches([]);
    }
  }

  async function loadModules(cancelled = false) {
    setLoading(true);
    setError(null);
    try {
      const result = await api<ModuleLibraryResponse>("/api/curriculum/modules");
      if (!cancelled) setModules(result.modules ?? []);
    } catch (err) {
      if (!cancelled) setError(err instanceof Error ? err.message : "Module Library could not be loaded.");
    } finally {
      if (!cancelled) setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void loadModules(cancelled);
    void loadImportBatches(cancelled);
    return () => {
      cancelled = true;
    };
  }, []);

  async function cleanupRequest(path: string, options: RequestInit, success: string) {
    setCleanupError(null);
    setCleanupMessage(null);
    await api(path, options);
    setCleanupMessage(success);
    await loadModules();
    await loadImportBatches();
  }

  const filterOptions = useMemo(() => {
    return {
      programmes: unique(modules.flatMap((module) => module.programmes.map((item) => item.name ?? item.code))),
      stages: unique(modules.map((module) => module.stage)),
      semesters: unique(modules.map((module) => module.semester)),
      uploads: unique(modules.flatMap((module) => module.uploads.map((item) => item.label))),
    };
  }, [modules]);

  const filteredModules = useMemo(() => {
    const q = search.trim().toLowerCase();
    return modules.filter((module) => {
      const textMatches = !q || [
        module.moduleCode,
        module.moduleTitle,
        programmeLabel(module),
        uploadLabel(module),
      ].some((value) => (value ?? "").toLowerCase().includes(q));
      const programmeMatches = programme === allValue || programmeLabel(module).includes(programme);
      const stageMatches = stage === allValue || module.stage === stage;
      const semesterMatches = semester === allValue || module.semester === semester;
      const uploadMatches = upload === allValue || uploadLabel(module).includes(upload);
      return textMatches && programmeMatches && stageMatches && semesterMatches && uploadMatches;
    });
  }, [modules, programme, search, semester, stage, upload]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Curriculum records</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Module Library</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Browse modules created from uploaded descriptors, manual entry and programme spreadsheets. This view shows
            uploaded curriculum records before a programme workspace is required.
          </p>
        </div>
        <Button asChild className="w-fit bg-blue-950 hover:bg-blue-900">
          <Link href="/ingestion">
            Upload Curriculum
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          ["Modules", modules.length],
          ["With descriptors", modules.filter((module) => module.descriptorStatus !== "missing" && module.descriptorStatus !== "source_only").length],
          ["Evidence items", modules.reduce((total, module) => total + module.evidenceCount, 0)],
          ["Quality flags", modules.reduce((total, module) => total + module.dataQualityFlags.length, 0)],
        ].map(([label, value]) => (
          <Card key={label} className="border-slate-200 shadow-sm">
            <CardContent className="p-5">
              <div className="text-2xl font-bold text-slate-950">{loading ? "-" : Number(value).toLocaleString()}</div>
              <div className="mt-1 text-sm text-slate-500">{label}</div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <SlidersHorizontal className="h-4 w-4" />
            Search and filter modules
          </div>
          <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr_0.7fr_0.7fr_1fr]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search code, title, programme or upload..."
                className="pl-9"
              />
            </div>
            <Select value={programme} onValueChange={setProgramme}>
              <SelectTrigger><SelectValue placeholder="Programme" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={allValue}>All programmes</SelectItem>
                {filterOptions.programmes.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger><SelectValue placeholder="Stage" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={allValue}>All stages</SelectItem>
                {filterOptions.stages.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={semester} onValueChange={setSemester}>
              <SelectTrigger><SelectValue placeholder="Semester" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={allValue}>All semesters</SelectItem>
                {filterOptions.semesters.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={upload} onValueChange={setUpload}>
              <SelectTrigger><SelectValue placeholder="Upload" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={allValue}>All uploads</SelectItem>
                {filterOptions.uploads.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {cleanupError && (
        <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{cleanupError}</div>
      )}
      {cleanupMessage && (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{cleanupMessage}</div>
      )}

      {importBatches.length > 0 && (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-semibold text-slate-950">Upload History</h2>
                <p className="mt-1 text-sm text-slate-500">Archive or remove test uploads when no reviewed findings or action-plan links exist.</p>
              </div>
            </div>
            <div className="space-y-2">
              {importBatches.slice(0, 6).map((batch) => (
                <div key={batch.id} className="grid gap-3 rounded border border-slate-200 p-3 lg:grid-cols-[1fr_1fr_auto] lg:items-center">
                  <div>
                    <div className="font-medium text-slate-900">{batch.label}</div>
                    <div className="mt-1 text-xs text-slate-500">{batch.type.replace(/_/g, " ")} | {batch.status.replace(/_/g, " ")} | {batch.createdAt ? new Date(batch.createdAt).toLocaleString() : "date not recorded"}</div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">{batch.counts.modules} modules</Badge>
                    <Badge variant="outline">{batch.counts.programmeVersions} draft programmes</Badge>
                    <Badge variant="outline">{batch.counts.structureItems} structure items</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmation({
                        title: "Archive upload records?",
                        message: "This will archive uploaded modules and draft programmes created from this upload. Source evidence remains preserved and no framework seeds are affected.",
                        confirmLabel: "Archive upload",
                        action: () => cleanupRequest(`/api/cleanup/import-batches/${batch.id}/archive`, { method: "POST" }, "Upload records archived."),
                      })}
                    >
                      <Archive className="mr-2 h-4 w-4" />Archive
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-rose-200 text-rose-700 hover:bg-rose-50"
                      onClick={() => setConfirmation({
                        title: "Delete test upload?",
                        message: "This permanently removes uploaded test modules, draft programme structures, descriptor evidence and source rows for this upload only. It will be blocked if reviewed findings, human reviews or action-plan links exist.",
                        confirmLabel: "Delete test upload",
                        action: () => cleanupRequest(`/api/cleanup/import-batches/${batch.id}`, { method: "DELETE" }, "Test upload deleted."),
                      })}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="rounded border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-950">Uploaded Modules</h2>
            <p className="mt-1 text-sm text-slate-500">
              Showing {filteredModules.length.toLocaleString()} of {modules.length.toLocaleString()} modules.
            </p>
          </div>
          <Filter className="h-5 w-5 text-slate-400" />
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading modules...</div>
        ) : filteredModules.length === 0 ? (
          <div className="p-8 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-slate-300" />
            <h3 className="mt-3 font-semibold text-slate-950">No modules found</h3>
            <p className="mt-1 text-sm text-slate-500">Upload curriculum data or adjust your filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredModules.map((module) => (
              <div key={`${module.recordKind}-${module.id}`} className="grid gap-4 p-5 xl:grid-cols-[1.2fr_1fr_0.7fr_0.8fr_0.8fr_0.8fr_auto] xl:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-950">{module.moduleCode ?? "No code"}</span>
                    <Badge variant="outline" className={module.recordKind === "source_only" ? "border-amber-200 bg-amber-50 text-amber-700" : ""}>
                      {module.sourceLabel}
                    </Badge>
                  </div>
                  <div className="mt-1 text-sm text-slate-700">{module.moduleTitle ?? "Untitled module"}</div>
                  <div className="mt-1 text-xs text-slate-500">{uploadLabel(module)}</div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase text-slate-400">Programme</div>
                  <div className="mt-1 text-sm text-slate-700">{programmeLabel(module)}</div>
                </div>

                <div className="text-sm text-slate-700">
                  <div className="text-xs font-semibold uppercase text-slate-400">Structure</div>
                  <div className="mt-1">Stage {module.stage ?? "-"}</div>
                  <div className="text-xs text-slate-500">Semester {module.semester ?? "-"}</div>
                </div>

                <div className="text-sm text-slate-700">
                  <div className="text-xs font-semibold uppercase text-slate-400">Credits</div>
                  <div className="mt-1">{module.credits ?? "-"}</div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase text-slate-400">Descriptor</div>
                  <Badge variant="outline" className={`mt-1 ${statusBadgeClass(module.descriptorStatus)}`}>
                    {module.descriptorStatus.replace(/_/g, " ")}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline" className="gap-1">
                    <Database className="h-3 w-3" />
                    {module.evidenceCount} evidence
                  </Badge>
                  <Badge variant="outline">{module.assessmentComponentCount} assessment</Badge>
                  {module.modalitySummary && <Badge variant="outline">Modality</Badge>}
                  {module.dataQualityFlags.length > 0 && (
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                      {module.dataQualityFlags.length} quality flag{module.dataQualityFlags.length === 1 ? "" : "s"}
                    </Badge>
                  )}
                </div>

                <Button asChild variant="outline" size="sm" className="justify-self-start xl:justify-self-end">
                  <Link href={builderHref(module)}>
                    Open
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                {module.moduleId && (
                  <div className="flex flex-wrap gap-2 xl:col-start-7 xl:justify-self-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmation({
                        title: "Archive module?",
                        message: "This marks the curated module and descriptors as archived. It does not remove framework seeds, users, institutions or audit events.",
                        confirmLabel: "Archive module",
                        action: () => cleanupRequest(`/api/curriculum/modules/${module.moduleId}/archive`, { method: "POST" }, "Module archived."),
                      })}
                    >
                      <Archive className="mr-2 h-4 w-4" />Archive
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-rose-200 text-rose-700 hover:bg-rose-50"
                      onClick={() => setConfirmation({
                        title: "Delete uploaded test module?",
                        message: "This permanently removes this uploaded test module and linked descriptor/evidence records only when no human reviews, reviewed findings or action-plan links exist.",
                        confirmLabel: "Delete module",
                        action: () => cleanupRequest(`/api/curriculum/modules/${module.moduleId}`, { method: "DELETE" }, "Module deleted."),
                      })}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />Delete
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {confirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-950">{confirmation.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{confirmation.message}</p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmation(null)}>Cancel</Button>
              <Button
                className="bg-rose-700 hover:bg-rose-800"
                onClick={() => {
                  const action = confirmation.action;
                  setConfirmation(null);
                  void action().catch((error) => setCleanupError(error instanceof Error ? error.message : "Cleanup action failed."));
                }}
              >
                {confirmation.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
