import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileSearch,
  Layers3,
  Library,
  Lightbulb,
  Map,
  Target,
  Upload,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type IngestionRun = {
  id: string;
  pathway: string;
  status: string;
  createdAt?: string;
  completedAt?: string;
  summary?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

type ProgrammeVersion = {
  id: string;
  title?: string;
  programmeName?: string;
  versionLabel?: string;
  status?: string;
};

type FrameworkFamily = {
  key?: string;
  label?: string;
  frameworks?: unknown[];
};

type DashboardData = {
  runs: IngestionRun[];
  programmeVersions: ProgrammeVersion[];
  families: FrameworkFamily[];
};

const workflow = [
  { label: "Evidence", icon: Upload, description: "Bring curriculum records, descriptors and documents together." },
  { label: "Analyse", icon: Layers3, description: "Apply evidence-informed framework and design layers." },
  { label: "Insights", icon: Lightbulb, description: "Find coverage, strengths, gaps and quality signals." },
  { label: "Review", icon: FileSearch, description: "Support human review, clarification and readiness work." },
  { label: "Act", icon: Target, description: "Move from findings into enhancement and action planning." },
];

const quickActions = [
  { href: "/ingestion", label: "Upload Curriculum", description: "Add module descriptors or programme spreadsheets.", icon: Upload, color: "text-blue-700 bg-blue-50" },
  { href: "/programme/workspace", label: "Programme Workspace", description: "Curate programme versions and structures.", icon: Library, color: "text-emerald-700 bg-emerald-50" },
  { href: "/programme/map", label: "Programme Map", description: "Explore the base map with switchable overlays.", icon: Map, color: "text-violet-700 bg-violet-50" },
  { href: "/frameworks", label: "Framework Hub", description: "Manage framework and lens layers.", icon: Layers3, color: "text-amber-700 bg-amber-50" },
  { href: "/module-builder", label: "Module Builder", description: "Prepare descriptor improvement workflows.", icon: Wrench, color: "text-cyan-700 bg-cyan-50" },
  { href: "/review-enhancement", label: "Review & Enhancement", description: "Connect evidence to review and action.", icon: ClipboardCheck, color: "text-rose-700 bg-rose-50" },
];

async function api<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: "include" });
  if (!response.ok) throw new Error(`Request failed with ${response.status}`);
  return response.json() as Promise<T>;
}

function numberFromSummary(summary: Record<string, unknown> | undefined, key: string): number {
  const value = summary?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function createdCount(summary: Record<string, unknown> | undefined, key: string): number {
  const created = summary?.created;
  if (!created || typeof created !== "object") return 0;
  const value = (created as Record<string, unknown>)[key];
  return Array.isArray(value) ? value.length : 0;
}

function formatDate(value: string | undefined) {
  if (!value) return "Recently";
  try {
    return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "Recently";
  }
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData>({ runs: [], programmeVersions: [], families: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError(null);
      try {
        const [programmeResult, runResult, familyResult] = await Promise.all([
          api<{ programmeVersions: ProgrammeVersion[] }>("/api/programme-workspace/programme-versions"),
          api<{ runs: IngestionRun[] }>("/api/ingestion/runs"),
          api<{ families: FrameworkFamily[] }>("/api/programme-map/framework-families"),
        ]);

        if (!cancelled) {
          setData({
            programmeVersions: programmeResult.programmeVersions ?? [],
            runs: runResult.runs ?? [],
            families: familyResult.families ?? [],
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Dashboard data could not be loaded.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDashboard();
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => {
    const modules = data.runs.reduce(
      (total, run) => total + numberFromSummary(run.summary, "moduleCount") + createdCount(run.summary, "moduleIds"),
      0,
    );
    const evidenceItems = data.runs.reduce(
      (total, run) => total + numberFromSummary(run.summary, "evidenceCount") + createdCount(run.summary, "evidenceItemIds"),
      0,
    );
    const frameworkLayers = data.families.reduce((total, family) => {
      if (Array.isArray(family.frameworks)) return total + family.frameworks.length;
      return total + 1;
    }, 0);

    return {
      programmes: data.programmeVersions.length,
      modules,
      evidenceItems,
      frameworkLayers,
    };
  }, [data]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <section className="rounded border border-blue-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">CAST v3 Dashboard</Badge>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Welcome to CAST</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Your curriculum intelligence and evidence workspace. Upload evidence, curate programme structures,
              explore layers, review findings and plan enhancement from one authenticated platform.
            </p>
            {error && (
              <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Live dashboard counts are unavailable right now: {error}
              </p>
            )}
          </div>
          <Button asChild className="w-fit bg-blue-950 hover:bg-blue-900">
            <Link href="/ingestion">
              Upload Curriculum
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Programmes", value: summary.programmes, icon: Library, color: "text-violet-700 bg-violet-50" },
          { label: "Modules", value: summary.modules, icon: ClipboardCheck, color: "text-blue-700 bg-blue-50" },
          { label: "Evidence Items", value: summary.evidenceItems, icon: Database, color: "text-emerald-700 bg-emerald-50" },
          { label: "Framework Layers", value: summary.frameworkLayers, icon: Layers3, color: "text-amber-700 bg-amber-50" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="border-slate-200 shadow-sm">
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`flex h-12 w-12 items-center justify-center rounded ${item.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-950">{loading ? "-" : item.value.toLocaleString()}</div>
                  <div className="text-sm text-slate-500">{item.label}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="rounded border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-950">CAST Workflow</h2>
          <p className="mt-1 text-sm text-slate-600">A working path from evidence to review-ready action.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-5">
          {workflow.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.label} className="rounded border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded bg-white text-blue-800">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold text-slate-400">{index + 1}</span>
                </div>
                <div className="font-semibold text-slate-950">{step.label}</div>
                <p className="mt-2 text-sm leading-5 text-slate-600">{step.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Quick Actions</h2>
              <p className="mt-1 text-sm text-slate-600">Start from the task your programme team needs today.</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group rounded border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md"
                >
                  <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded ${action.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-slate-950">{action.label}</h3>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-blue-700" />
                  </div>
                  <p className="mt-2 text-sm leading-5 text-slate-600">{action.description}</p>
                </Link>
              );
            })}
          </div>
        </div>

        <aside className="rounded border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Recent Activity</h2>
              <p className="mt-1 text-sm text-slate-600">Latest curriculum uploads and platform events.</p>
            </div>
            <BarChart3 className="h-5 w-5 text-blue-700" />
          </div>
          <div className="space-y-3">
            {data.runs.length > 0 ? (
              data.runs.slice(0, 6).map((run) => (
                <div key={run.id} className="flex gap-3 rounded border border-slate-100 bg-slate-50 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold capitalize text-slate-800">
                      {run.pathway.replace(/_/g, " ")} {run.status.replace(/_/g, " ")}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {String(run.metadata?.fileName ?? "Curriculum record")} - {formatDate(run.completedAt ?? run.createdAt)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                Recent activity will appear here once curriculum uploads, programme workspace changes or review actions
                are recorded.
              </div>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
