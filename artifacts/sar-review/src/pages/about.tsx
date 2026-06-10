import { Link } from "wouter";
import {
  ArrowRight,
  BookOpenCheck,
  ClipboardCheck,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";

const workflow = [
  {
    label: "Evidence",
    icon: Upload,
    description: "Upload curriculum records, module descriptors, assessments and supporting documents.",
  },
  {
    label: "Analyse",
    icon: Layers3,
    description: "Apply framework, design and data-quality layers over a shared evidence base.",
  },
  {
    label: "Insights",
    icon: Lightbulb,
    description: "Surface strengths, gaps, maturity signals and review-ready evidence claims.",
  },
  {
    label: "Review",
    icon: FileSearch,
    description: "Keep human judgement central through claim review, readiness and evidence packs.",
  },
  {
    label: "Act",
    icon: Target,
    description: "Turn reviewed findings into SWOT items, enhancement actions and monitoring.",
  },
];

const components = [
  {
    title: "Upload Curriculum",
    icon: Database,
    description: "Bring Akari-compatible programme data, module descriptors and manual entries into CAST.",
  },
  {
    title: "Programme Workspace",
    icon: BookOpenCheck,
    description: "View programme summaries, evidence coverage, readiness, SWOT and enhancement activity.",
  },
  {
    title: "Programme Map",
    icon: Map,
    description: "Navigate the curriculum base map with switchable framework and design overlays.",
  },
  {
    title: "Module Builder",
    icon: ClipboardCheck,
    description: "Inspect module evidence, claims, reviews and practical improvement prompts.",
  },
  {
    title: "Review & Enhancement",
    icon: Users,
    description: "Support programme review, validation, accreditation and quality enhancement conversations.",
  },
  {
    title: "Data Quality",
    icon: ShieldCheck,
    description: "Preserve source data while identifying gaps, duplicates and weak curriculum records.",
  },
];

const principles = [
  "Evidence first: CAST preserves source data and links insights back to evidence.",
  "Programme led: analysis is organised around programme versions, teams and review needs.",
  "Layered: frameworks, graduate attributes, assessment, modality and priorities act as overlays.",
  "Review ready: AI-supported claims remain provisional until reviewed by people.",
  "Maturity aware: CAST describes curriculum evidence maturity, not learner attainment.",
];

const audiences = [
  "Programme chairs and programme teams",
  "Module leaders and curriculum designers",
  "Review, validation and accreditation panels",
  "Quality enhancement and teaching teams",
  "Institutional leaders preparing evidence-informed curriculum reviews",
];

export default function About() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <section className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-white via-blue-50 to-emerald-50 shadow-sm">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] p-8 lg:p-12">
          <div className="space-y-6">
            <div className="space-y-3">
              <Badge className="bg-blue-100 text-blue-800 border-blue-200">CAST v1 readiness</Badge>
              <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-slate-950">
                Curriculum Analysis and Strategy Tool
              </h1>
              <p className="text-xl text-slate-700 max-w-3xl">
                Evidence-informed curriculum intelligence for higher education.
              </p>
            </div>
            <p className="text-base leading-7 text-slate-600 max-w-3xl">
              CAST helps programme teams bring curriculum evidence together, understand it through
              configurable layers, review claims with human judgement, and turn findings into focused
              enhancement activity.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href={isAuthenticated ? "/dashboard" : "/login"}>
                  {isAuthenticated ? "Open Dashboard" : "Log in to CAST"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href={isAuthenticated ? "/programme/workspace" : "/"}>
                  {isAuthenticated ? "Programme Workspace" : "Return Home"}
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {workflow.map((step, index) => {
              const Icon = step.icon;
              return (
                <Card key={step.label} className="border-white/70 bg-white/85 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-bold">
                        {index + 1}
                      </span>
                      <Icon className="h-5 w-5 text-blue-700" />
                    </div>
                    <h2 className="font-semibold text-slate-950">{step.label}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {components.map((component) => {
          const Icon = component.icon;
          return (
            <Card key={component.title} className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100">
                  <Icon className="h-5 w-5 text-blue-700" />
                </div>
                <CardTitle className="text-lg text-slate-950">{component.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-slate-600">{component.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl text-slate-950">Who CAST Is For</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {audiences.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-slate-600">
                  <Users className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl text-slate-950">How CAST Thinks About Evidence</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {principles.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-slate-600">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-950 p-8 text-white shadow-sm">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h2 className="text-2xl font-bold">Current Status</h2>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
              CAST is entering hardening and acceptance testing for its first production release. The
              current focus is stability, data integrity, usability, performance and deployment readiness.
              Legacy prototype workflows may still exist temporarily, but all new development is CAST
              first and evidence first.
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link href={isAuthenticated ? "/dashboard" : "/login"}>Continue</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
