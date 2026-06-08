import { useEffect, useState } from "react";
import { ArrowRight, ClipboardCheck, Layers, Puzzle, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const builderLayers = [
  {
    title: "Modality",
    description: "Module-level decision support for delivery options, feasibility, risk and human approval.",
    status: "Foundation",
    icon: Layers,
  },
  {
    title: "UDL",
    description: "Future design support for engagement, representation, action and expression evidence.",
    status: "Positioned",
    icon: ShieldCheck,
  },
  {
    title: "Assessment Design",
    description: "Module-level support for improving assessment clarity, alignment, balance and feedback evidence.",
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

const workflow = ["Module Descriptor", "Evidence Review", "Design Guidance", "Improvement Suggestions", "Human Decision"];

type ModuleLibraryItem = {
  id: string;
  recordKind: "canonical" | "source_only";
  moduleCode?: string | null;
  moduleTitle?: string | null;
  credits?: number | null;
  stage?: string | null;
  semester?: string | null;
  programmes: Array<{ code?: string | null; name?: string | null }>;
  descriptorStatus: string;
  evidenceCount: number;
  assessmentComponentCount: number;
  dataQualityFlags: Array<{ id: string; title: string; severity: string; status: string }>;
  sourceLabel: string;
};

async function api<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: "include" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message ?? `Request failed with ${response.status}`);
  return payload as T;
}

function selectedModuleId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("moduleId") ?? params.get("sourceModuleId");
}

export default function ModuleBuilder() {
  const [selectedModule, setSelectedModule] = useState<ModuleLibraryItem | null>(null);
  const [selectedModuleError, setSelectedModuleError] = useState<string | null>(null);

  useEffect(() => {
    const id = selectedModuleId();
    if (!id) return;
    const selectedId = id;

    let cancelled = false;
    async function loadSelectedModule() {
      try {
        const result = await api<{ module: ModuleLibraryItem }>(`/api/curriculum/modules/${encodeURIComponent(selectedId)}`);
        if (!cancelled) setSelectedModule(result.module);
      } catch (err) {
        if (!cancelled) setSelectedModuleError(err instanceof Error ? err.message : "Selected module could not be loaded.");
      }
    }

    void loadSelectedModule();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge className="bg-cyan-100 text-cyan-800 hover:bg-cyan-100">Module-level design support</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight" style={{ color: "#003865" }}>Module Builder</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            A future workspace for evidence-informed module enhancement. This foundation positions Modality, UDL,
            Assessment Design and Framework Alignment as module design supports rather than programme map overlays.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/ingestion">
            Upload curriculum
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      {(selectedModule || selectedModuleError) && (
        <Card className="border-blue-100 bg-blue-50/50">
          <CardContent className="p-5">
            {selectedModule ? (
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Selected module</Badge>
                    <Badge variant="outline">{selectedModule.sourceLabel}</Badge>
                  </div>
                  <h2 className="mt-3 text-xl font-semibold text-slate-950">
                    {selectedModule.moduleCode ?? "No code"}: {selectedModule.moduleTitle ?? "Untitled module"}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {selectedModule.programmes.map((programme) => programme.name ?? programme.code).filter(Boolean).join(", ") || "No programme link"} · Stage {selectedModule.stage ?? "-"} · Semester {selectedModule.semester ?? "-"} · {selectedModule.credits ?? "-"} credits
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  <Badge variant="outline">Descriptor: {selectedModule.descriptorStatus.replace(/_/g, " ")}</Badge>
                  <Badge variant="outline">{selectedModule.evidenceCount} evidence items</Badge>
                  <Badge variant="outline">{selectedModule.assessmentComponentCount} assessment components</Badge>
                  {selectedModule.dataQualityFlags.length > 0 && (
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                      {selectedModule.dataQualityFlags.length} quality flag{selectedModule.dataQualityFlags.length === 1 ? "" : "s"}
                    </Badge>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm text-amber-800">{selectedModuleError}</div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Design Workflow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-5">
            {workflow.map((step, index) => (
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
    </div>
  );
}
