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

export default function ModuleBuilder() {
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
