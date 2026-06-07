import { AlertTriangle, CheckCircle2, Database, FileWarning, Link2, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const checks = [
  "Missing programme links",
  "Orphaned modules",
  "Missing stages or semesters",
  "Missing descriptors",
  "Weak assessment data",
  "Unmapped evidence",
];

export default function DataQuality() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Curriculum data confidence</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight" style={{ color: "#003865" }}>Data Quality</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            CAST preserves source data as supplied and surfaces quality issues for review instead of silently cleaning
            or overwriting curriculum evidence.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/programme/workspace">
            Open Programme Workspace
            <Link2 className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <Database className="mb-4 h-7 w-7 text-blue-700" />
            <div className="text-2xl font-bold">Source</div>
            <p className="mt-2 text-sm text-slate-600">Imported records remain available for source-versus-curated comparison.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <FileWarning className="mb-4 h-7 w-7 text-amber-700" />
            <div className="text-2xl font-bold">Issues</div>
            <p className="mt-2 text-sm text-slate-600">Quality results identify gaps, inconsistencies and records needing human attention.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <CheckCircle2 className="mb-4 h-7 w-7 text-emerald-700" />
            <div className="text-2xl font-bold">Confidence</div>
            <p className="mt-2 text-sm text-slate-600">Programme teams can decide what to accept, clarify or curate.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quality Checks Positioned For Phase 6</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {checks.map((check) => (
            <div key={check} className="flex items-center gap-3 rounded border border-slate-200 bg-white p-3">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-slate-700">{check}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-start gap-3 p-5">
          <RefreshCw className="mt-1 h-5 w-5 text-slate-500" />
          <p className="text-sm leading-6 text-slate-600">
            This page establishes the navigation and operating-model position for data quality dashboards. It does not
            add new quality rules or run new checks.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
