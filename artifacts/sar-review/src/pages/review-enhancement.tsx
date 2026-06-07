import { BarChart3, CheckCircle2, ClipboardList, Flag, Lightbulb, Target } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const reviewAreas = [
  {
    title: "Readiness",
    description: "Evidence-informed readiness checks for review, validation, accreditation and institutional priorities.",
    icon: CheckCircle2,
  },
  {
    title: "SWOT",
    description: "A future workspace for programme teams to convert evidence and insights into structured strengths, weaknesses, opportunities and threats.",
    icon: BarChart3,
  },
  {
    title: "Action Planning",
    description: "Human-owned plans with owners, milestones, indicators of success and evidence links.",
    icon: Target,
  },
];

const flow = ["Evidence", "Programme Map", "Insights", "Review", "Action"];

export default function ReviewEnhancement() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Review and action workspace</Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight" style={{ color: "#003865" }}>Review & Enhancement</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          This future workspace will help programme teams review findings, conduct readiness checks, record SWOT
          analysis, create action plans and monitor progress.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evidence to Action</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            {flow.map((step, index) => (
              <div key={step} className="flex flex-1 items-center gap-3">
                <div className="flex min-h-16 flex-1 items-center rounded border border-slate-200 bg-white px-4 py-3">
                  <div>
                    <div className="text-xs font-semibold uppercase text-slate-400">Step {index + 1}</div>
                    <div className="font-semibold text-slate-900">{step}</div>
                  </div>
                </div>
                {index < flow.length - 1 && <Flag className="hidden h-4 w-4 text-slate-300 md:block" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {reviewAreas.map((area) => {
          const Icon = area.icon;
          return (
            <Card key={area.title}>
              <CardContent className="p-5">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded bg-emerald-100 text-emerald-800">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="font-semibold text-slate-900">{area.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{area.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Lightbulb className="mt-1 h-5 w-5 text-amber-600" />
            <div>
              <div className="font-semibold text-slate-900">Insights remain evidence-informed</div>
              <p className="text-sm text-slate-600">Findings should be reviewed by programme teams before becoming actions.</p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link href="/programme/map">
              Open Programme Map
              <ClipboardList className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
