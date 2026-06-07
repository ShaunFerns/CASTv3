import { Link } from "wouter";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Database,
  FileSearch,
  Layers3,
  Lightbulb,
  Map,
  ShieldCheck,
  Target,
  Upload,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const workflow = [
  {
    label: "Evidence",
    description: "Bring module descriptors, programme data and supporting documents into one evidence base.",
    icon: Upload,
    color: "bg-blue-100 text-blue-800",
  },
  {
    label: "Analyse",
    description: "Apply framework, design, attribute and quality layers without overwriting source evidence.",
    icon: Layers3,
    color: "bg-emerald-100 text-emerald-800",
  },
  {
    label: "Insights",
    description: "Surface coverage, strengths, gaps, maturity patterns and evidence quality across a programme.",
    icon: Lightbulb,
    color: "bg-violet-100 text-violet-800",
  },
  {
    label: "Review",
    description: "Support programme teams, reviewers and enhancement leads with evidence-linked findings.",
    icon: FileSearch,
    color: "bg-amber-100 text-amber-800",
  },
  {
    label: "Act",
    description: "Turn review-ready insight into action plans, descriptor improvements and monitored change.",
    icon: Target,
    color: "bg-cyan-100 text-cyan-800",
  },
];

const audiences = [
  {
    title: "Programme Teams",
    description: "Explore how modules work together across stages, semesters, pathways and options.",
    icon: Users,
  },
  {
    title: "Quality And Enhancement",
    description: "Prepare evidence for programme review, validation, revalidation and accreditation.",
    icon: ShieldCheck,
  },
  {
    title: "Academic Leaders",
    description: "Understand curriculum priorities, data quality and action planning across portfolios.",
    icon: BarChart3,
  },
];

const helpsWith = [
  "Programme review",
  "Validation and revalidation",
  "Accreditation evidence",
  "Curriculum enhancement",
  "Programme mapping",
  "Framework alignment",
  "Descriptor improvement",
  "Action planning",
];

const mapRows = [
  { label: "GreenComp", color: "bg-emerald-500", cells: [5, 4, 2, 5] },
  { label: "LifeComp", color: "bg-blue-500", cells: [2, 4, 5, 4] },
  { label: "Assessment", color: "bg-pink-500", cells: [3, 5, 2, 2] },
  { label: "Data Quality", color: "bg-amber-500", cells: [1, 2, 1, 3] },
];

function ProductPreview() {
  return (
    <div className="overflow-hidden rounded border border-blue-100 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
        <div>
          <div className="text-sm font-semibold text-slate-950">Programme intelligence overview</div>
          <div className="text-xs text-slate-500">Evidence-informed, review-ready and programme-led</div>
        </div>
        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Preview</Badge>
      </div>

      <div className="grid gap-3 p-5 sm:grid-cols-3">
        {[
          ["187", "Modules"],
          ["1,842", "Evidence items"],
          ["86%", "Coverage"],
        ].map(([value, label]) => (
          <div key={label} className="rounded border border-slate-100 bg-white p-4 shadow-sm">
            <div className="text-2xl font-bold text-blue-800">{value}</div>
            <div className="text-xs text-slate-500">{label}</div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-100 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-950">Layered programme map</div>
            <div className="text-xs text-slate-500">Base structure with switchable evidence overlays</div>
          </div>
          <Map className="h-5 w-5 text-blue-700" />
        </div>
        <div className="space-y-3">
          {mapRows.map((row) => (
            <div key={row.label} className="grid grid-cols-[100px_1fr] items-center gap-3">
              <div className="text-xs font-medium text-slate-600">{row.label}</div>
              <div className="grid grid-cols-4 gap-3">
                {row.cells.map((count, index) => (
                  <div key={`${row.label}-${index}`} className="flex h-10 items-center gap-1 rounded bg-slate-50 px-2">
                    {Array.from({ length: count }).map((_, dotIndex) => (
                      <span key={dotIndex} className={`h-2.5 w-2.5 rounded-sm ${row.color}`} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6">
      <section className="overflow-hidden rounded border border-blue-100 bg-white shadow-sm">
        <div className="grid gap-8 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(420px,560px)] lg:p-10">
          <div className="flex min-h-[520px] flex-col justify-center">
            <Badge className="w-fit bg-blue-100 text-blue-800 hover:bg-blue-100">Curriculum intelligence for higher education</Badge>
            <div className="mt-6 text-sm font-semibold uppercase text-blue-700">CAST</div>
            <h1 className="mt-2 max-w-3xl text-4xl font-bold leading-tight text-slate-950 sm:text-6xl">
              Curriculum Analysis and Strategy Tool
            </h1>
            <p className="mt-5 max-w-2xl text-xl leading-8 text-slate-600">
              Evidence-informed curriculum intelligence for higher education.
            </p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              CAST helps programme teams upload curriculum evidence, analyse it through configurable layers,
              generate review-ready insights and plan improvement with confidence.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild className="bg-blue-950 hover:bg-blue-900">
                <Link href="/admin/login">
                  Log in to CAST
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/ingestion">Upload Curriculum</Link>
              </Button>
            </div>
          </div>

          <div className="flex items-center">
            <ProductPreview />
          </div>
        </div>
      </section>

      <section className="rounded border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">From Evidence To Action</h2>
            <p className="mt-1 text-sm text-slate-600">A clear workflow for evidence-led curriculum enhancement.</p>
          </div>
          <Link href="/programme/map" className="inline-flex items-center text-sm font-semibold text-blue-800">
            Open Programme Map
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-5">
          {workflow.map((step, index) => {
            const Icon = step.icon;
            return (
              <Card key={step.label} className="border-slate-200">
                <CardContent className="p-5">
                  <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded ${step.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="text-sm font-semibold text-slate-500">{index + 1}. {step.label}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-slate-950">Who CAST Is For</h2>
            <div className="mt-5 space-y-4">
              {audiences.map((audience) => {
                const Icon = audience.icon;
                return (
                  <div key={audience.title} className="flex gap-4 rounded border border-slate-100 bg-slate-50 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-white text-blue-800">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-950">{audience.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{audience.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-slate-950">What CAST Helps With</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              CAST brings together curriculum data, descriptor evidence, programme structures and review workflows so
              teams can make improvements from a shared evidence base.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {helpsWith.map((item) => (
                <div key={item} className="flex items-center gap-3 rounded border border-slate-100 bg-slate-50 px-4 py-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="text-sm font-medium text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="rounded border border-blue-100 bg-blue-950 px-6 py-5 text-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-lg font-semibold">Evidence. Insight. Strategy. Transformation.</h2>
            <p className="mt-1 text-sm text-blue-100">
              Start with curriculum evidence, then build programme-led analysis and action from there.
            </p>
          </div>
          <Button asChild className="w-fit bg-white text-blue-950 hover:bg-blue-50">
            <Link href="/admin/login">Log in</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
