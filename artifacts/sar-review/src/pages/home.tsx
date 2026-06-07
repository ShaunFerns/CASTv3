import { Link } from "wouter";
import { ArrowRight, BarChart3, CheckCircle2, ClipboardList, Database, Layers3, Map, Upload, Wrench } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const journey = [
  { label: "Evidence", description: "Upload and organise curriculum records.", icon: Upload, href: "/ingestion" },
  { label: "Analyse", description: "Apply framework and design layers.", icon: Layers3, href: "/frameworks" },
  { label: "Insights", description: "Visualise coverage, balance and gaps.", icon: Map, href: "/programme/map" },
  { label: "Review", description: "Turn findings into team decisions.", icon: ClipboardList, href: "/review-enhancement" },
  { label: "Act", description: "Plan improvements and monitor progress.", icon: CheckCircle2, href: "/review-enhancement" },
];

const workspaces = [
  {
    href: "/ingestion",
    icon: Upload,
    title: "Upload Curriculum",
    description: "Import Akari-compatible data, PDFs or manually entered module descriptors.",
    accent: "blue",
  },
  {
    href: "/programme/workspace",
    icon: Database,
    title: "Programme Workspace",
    description: "Reconcile source data into curated programme structures.",
    accent: "emerald",
  },
  {
    href: "/programme/map",
    icon: Map,
    title: "Programme Map",
    description: "Explore curriculum coverage, alignment and Assessment as switchable overlays.",
    accent: "violet",
  },
  {
    href: "/frameworks",
    icon: Layers3,
    title: "Framework Hub",
    description: "Manage evidence-informed layers such as GreenComp, DigComp, LifeComp and programme attributes.",
    accent: "amber",
  },
  {
    href: "/module-builder",
    icon: Wrench,
    title: "Module Builder",
    description: "Foundation for Modality, UDL, Assessment Design and descriptor improvement support.",
    accent: "cyan",
  },
  {
    href: "/review-enhancement",
    icon: BarChart3,
    title: "Review & Enhancement",
    description: "Foundation for readiness, SWOT and action planning workflows.",
    accent: "rose",
  },
];

const accentStyles: Record<string, string> = {
  blue: "bg-blue-100 text-blue-800",
  emerald: "bg-emerald-100 text-emerald-800",
  violet: "bg-violet-100 text-violet-800",
  amber: "bg-amber-100 text-amber-800",
  cyan: "bg-cyan-100 text-cyan-800",
  rose: "bg-rose-100 text-rose-800",
};

export default function Home() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6">
      <section className="grid gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
        <div>
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Curriculum intelligence and evidence platform</Badge>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl" style={{ color: "#003865" }}>
            Evidence. Analyse. Insights. Review. Act.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
            CAST helps programme teams turn curriculum evidence into structured understanding, human review and
            improvement action.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild style={{ backgroundColor: "#003865" }}>
              <Link href="/ingestion">
                Upload curriculum
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/programme/map">Open Programme Map</Link>
            </Button>
          </div>
        </div>

        <Card className="border-blue-100 bg-white shadow-sm">
          <CardContent className="space-y-3 p-5">
            {journey.map((step, index) => {
              const Icon = step.icon;
              return (
                <Link key={step.label} href={step.href} className="flex items-center gap-3 rounded border border-slate-100 p-3 transition hover:border-blue-200 hover:bg-blue-50">
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-blue-100 text-blue-800">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900">{index + 1}. {step.label}</div>
                    <div className="text-xs text-slate-500">{step.description}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300" />
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {workspaces.map((workspace) => {
          const Icon = workspace.icon;
          return (
            <Link key={workspace.href} href={workspace.href}>
              <Card className="h-full border-slate-200 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
                <CardContent className="flex h-full gap-4 p-5">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded ${accentStyles[workspace.accent]}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-900">{workspace.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{workspace.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
