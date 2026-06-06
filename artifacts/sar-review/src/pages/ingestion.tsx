import { useState } from "react";
import { CheckCircle2, FileText, ListChecks, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type IngestionResult = {
  runId: string;
  status: string;
  created: Record<string, string[]>;
  errors: Array<{ code: string; message: string; severity: string }>;
};

type RequestState = {
  loading: boolean;
  error?: string;
  result?: IngestionResult;
};

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? "");
      resolve(value.includes(",") ? value.split(",")[1] : value);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function createdCount(result: IngestionResult | undefined, key: string): number {
  return result?.created?.[key]?.length ?? 0;
}

function ResultPanel({ state }: { state: RequestState }) {
  if (state.loading) {
    return <div className="rounded border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Ingestion running...</div>;
  }

  if (state.error) {
    return <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>;
  }

  if (!state.result) return null;

  return (
    <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
      <div className="mb-2 flex items-center gap-2 font-semibold">
        <CheckCircle2 className="h-4 w-4" />
        Run {state.result.runId} finished as {state.result.status}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <span>Modules: {createdCount(state.result, "moduleIds")}</span>
        <span>Descriptors: {createdCount(state.result, "moduleDescriptorIds")}</span>
        <span>Evidence: {createdCount(state.result, "evidenceItemIds")}</span>
        <span>Documents: {createdCount(state.result, "documentIds")}</span>
        <span>Source records: {createdCount(state.result, "sourceRecordIds")}</span>
        <span>Quality findings: {createdCount(state.result, "dataQualityResultIds")}</span>
      </div>
    </div>
  );
}

async function postIngestion(path: string, body: Record<string, unknown>): Promise<IngestionResult> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message ?? payload.error ?? `Request failed with ${response.status}`);
  }
  return payload as IngestionResult;
}

export default function Ingestion() {
  const [state, setState] = useState<RequestState>({ loading: false });
  const [akariFile, setAkariFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfText, setPdfText] = useState("");
  const [manual, setManual] = useState({
    moduleCode: "CAST101",
    moduleTitle: "Curriculum Intelligence Foundations",
    credits: "5",
    stage: "1",
    semester: "1",
    aims: "Introduce students to evidence-informed curriculum analysis.",
    outcomes: "Explain core curriculum evidence concepts.\nApply descriptor review principles.",
    assessment: "Portfolio 100%",
  });

  async function runAkari() {
    if (!akariFile) {
      setState({ loading: false, error: "Choose a CSV or Excel file first." });
      return;
    }
    setState({ loading: true });
    try {
      const result = await postIngestion("/api/ingestion/akari", {
        fileName: akariFile.name,
        mimeType: akariFile.type,
        fileBase64: await fileToBase64(akariFile),
      });
      setState({ loading: false, result });
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : "Ingestion failed" });
    }
  }

  async function runPdf() {
    setState({ loading: true });
    try {
      const result = await postIngestion("/api/ingestion/pdf", {
        fileName: pdfFile?.name ?? "module-descriptor.txt",
        mimeType: pdfFile?.type ?? "text/plain",
        fileBase64: pdfFile ? await fileToBase64(pdfFile) : undefined,
        rawText: pdfText,
        moduleCode: manual.moduleCode,
        moduleTitle: manual.moduleTitle,
      });
      setState({ loading: false, result });
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : "Ingestion failed" });
    }
  }

  async function runManual() {
    setState({ loading: true });
    try {
      const result = await postIngestion("/api/ingestion/manual-module", {
        moduleCode: manual.moduleCode,
        moduleTitle: manual.moduleTitle,
        credits: Number(manual.credits),
        stage: manual.stage,
        semester: manual.semester,
        sections: [
          { sectionType: "aims", title: "Aims", content: manual.aims },
          { sectionType: "learning_outcomes", title: "Learning outcomes", content: manual.outcomes },
          { sectionType: "assessment", title: "Assessment", content: manual.assessment },
        ],
      });
      setState({ loading: false, result });
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : "Ingestion failed" });
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#003865" }}>CAST v3 Ingestion</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Bring curriculum data into the Phase 4A canonical model for documents, descriptors, sections and evidence.
        </p>
      </div>

      <Tabs defaultValue="akari" className="space-y-5">
        <TabsList>
          <TabsTrigger value="akari"><UploadCloud className="mr-2 h-4 w-4" />Akari export</TabsTrigger>
          <TabsTrigger value="pdf"><FileText className="mr-2 h-4 w-4" />Single PDF</TabsTrigger>
          <TabsTrigger value="manual"><ListChecks className="mr-2 h-4 w-4" />Manual module</TabsTrigger>
        </TabsList>

        <TabsContent value="akari">
          <Card>
            <CardHeader><CardTitle>Akari-compatible CSV/XLSX</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input type="file" accept=".csv,.xlsx,.xls" onChange={(event) => setAkariFile(event.target.files?.[0] ?? null)} />
              <Button onClick={runAkari} disabled={state.loading}><UploadCloud className="mr-2 h-4 w-4" />Run ingestion</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pdf">
          <Card>
            <CardHeader><CardTitle>Single module descriptor</CardTitle></CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-4">
                <Input type="file" accept=".pdf,.txt" onChange={(event) => setPdfFile(event.target.files?.[0] ?? null)} />
                <Textarea rows={10} value={pdfText} onChange={(event) => setPdfText(event.target.value)} placeholder="Paste descriptor text when PDF extraction is not available." />
                <Button onClick={runPdf} disabled={state.loading}><FileText className="mr-2 h-4 w-4" />Create descriptor evidence</Button>
              </div>
              <div className="space-y-3">
                <Label>Module code</Label>
                <Input value={manual.moduleCode} onChange={(event) => setManual({ ...manual, moduleCode: event.target.value })} />
                <Label>Module title</Label>
                <Input value={manual.moduleTitle} onChange={(event) => setManual({ ...manual, moduleTitle: event.target.value })} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manual">
          <Card>
            <CardHeader><CardTitle>Manual module entry</CardTitle></CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <Label>Module code</Label>
                <Input value={manual.moduleCode} onChange={(event) => setManual({ ...manual, moduleCode: event.target.value })} />
                <Label>Module title</Label>
                <Input value={manual.moduleTitle} onChange={(event) => setManual({ ...manual, moduleTitle: event.target.value })} />
                <div className="grid grid-cols-3 gap-3">
                  <Input value={manual.credits} onChange={(event) => setManual({ ...manual, credits: event.target.value })} aria-label="Credits" />
                  <Input value={manual.stage} onChange={(event) => setManual({ ...manual, stage: event.target.value })} aria-label="Stage" />
                  <Input value={manual.semester} onChange={(event) => setManual({ ...manual, semester: event.target.value })} aria-label="Semester" />
                </div>
              </div>
              <div className="space-y-3">
                <Label>Aims</Label>
                <Textarea value={manual.aims} onChange={(event) => setManual({ ...manual, aims: event.target.value })} />
                <Label>Learning outcomes</Label>
                <Textarea value={manual.outcomes} onChange={(event) => setManual({ ...manual, outcomes: event.target.value })} />
                <Label>Assessment</Label>
                <Textarea value={manual.assessment} onChange={(event) => setManual({ ...manual, assessment: event.target.value })} />
                <Button onClick={runManual} disabled={state.loading}><ListChecks className="mr-2 h-4 w-4" />Create module</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ResultPanel state={state} />
    </div>
  );
}
