import { useState } from "react";
import { CheckCircle2, FileSpreadsheet, FileText, Info, Keyboard, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type CurriculumUploadResult = {
  runId: string;
  status: string;
  created: Record<string, string[]>;
  errors: Array<{ code: string; message: string; severity: string }>;
};

type RequestState = {
  loading: boolean;
  error?: string;
  result?: CurriculumUploadResult;
};

type DescriptorSection = {
  sectionType: string;
  title: string;
  content: string;
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

function createdCount(result: CurriculumUploadResult | undefined, key: string): number {
  return result?.created?.[key]?.length ?? 0;
}

function ResultPanel({ state }: { state: RequestState }) {
  if (state.loading) {
    return (
      <div className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        Preparing curriculum records...
      </div>
    );
  }

  if (state.error) {
    return <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>;
  }

  if (!state.result) return null;

  return (
    <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
      <div className="mb-3 flex items-center gap-2 font-semibold">
        <CheckCircle2 className="h-4 w-4" />
        Curriculum upload completed with status: {state.result.status}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <span>Modules: {createdCount(state.result, "moduleIds")}</span>
        <span>Descriptors: {createdCount(state.result, "moduleDescriptorIds")}</span>
        <span>Evidence: {createdCount(state.result, "evidenceItemIds")}</span>
        <span>Documents: {createdCount(state.result, "documentIds")}</span>
        <span>Source records: {createdCount(state.result, "sourceRecordIds")}</span>
        <span>Quality findings: {createdCount(state.result, "dataQualityResultIds")}</span>
      </div>
      {state.result.errors.length > 0 && (
        <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-amber-900">
          {state.result.errors.length} issue{state.result.errors.length === 1 ? "" : "s"} recorded for review.
        </div>
      )}
    </div>
  );
}

async function postCurriculumUpload(path: string, body: Record<string, unknown>): Promise<CurriculumUploadResult> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = Array.isArray(payload.errors)
      ? payload.errors
          .slice(0, 3)
          .map((error: { message?: string }) => error.message)
          .filter(Boolean)
          .join(" ")
      : "";
    const message = payload.message ?? payload.error ?? `Request failed with ${response.status}`;
    throw new Error(details && !String(message).includes(details) ? `${message} ${details}` : message);
  }
  return payload as CurriculumUploadResult;
}

function validateProgrammeFile(file: File): string | undefined {
  const lowerName = file.name.toLowerCase();
  const allowed = [".csv", ".xlsx", ".xls"];
  if (!allowed.some((extension) => lowerName.endsWith(extension))) {
    return "Programme data uploads support CSV, XLSX and XLS files.";
  }
  if (file.size === 0) {
    return "The selected file appears to be empty.";
  }
  return undefined;
}

function UploadPanel({
  file,
  onFileChange,
  accept,
  title,
  description,
}: {
  file: File | null;
  onFileChange: (file: File | null) => void;
  accept: string;
  title: string;
  description: string;
}) {
  return (
    <label className="flex min-h-[190px] cursor-pointer flex-col items-center justify-center rounded border border-dashed border-slate-300 bg-white px-6 py-8 text-center transition hover:border-blue-400 hover:bg-blue-50">
      <UploadCloud className="h-10 w-10 text-slate-300" />
      <span className="mt-4 text-sm font-semibold text-slate-950">{file ? file.name : title}</span>
      <span className="mt-2 text-xs text-slate-500">{description}</span>
      <Input
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
      />
    </label>
  );
}

function SectionTextarea({
  label,
  value,
  placeholder,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  );
}

export default function UploadCurriculum() {
  const [state, setState] = useState<RequestState>({ loading: false });
  const [programmeFile, setProgrammeFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfText, setPdfText] = useState("");
  const [pdfMeta, setPdfMeta] = useState({
    moduleCode: "",
    moduleTitle: "",
  });
  const [manual, setManual] = useState({
    moduleCode: "",
    moduleTitle: "",
    credits: "",
    stage: "",
    semester: "",
    overview: "",
    aims: "",
    outcomes: "",
    indicativeContent: "",
    teaching: "",
    assessment: "",
    requisites: "",
    resources: "",
    modality: "",
  });

  async function runProgrammeUpload() {
    if (!programmeFile) {
      setState({ loading: false, error: "Choose a CSV or Excel file first." });
      return;
    }
    const validationMessage = validateProgrammeFile(programmeFile);
    if (validationMessage) {
      setState({ loading: false, error: validationMessage });
      return;
    }
    setState({ loading: true });
    try {
      const result = await postCurriculumUpload("/api/ingestion/akari", {
        fileName: programmeFile.name,
        mimeType: programmeFile.type,
        fileBase64: await fileToBase64(programmeFile),
      });
      setState({ loading: false, result });
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : "Programme data upload failed" });
    }
  }

  async function runPdfUpload() {
    if (!pdfFile && !pdfText.trim()) {
      setState({ loading: false, error: "Choose a descriptor file or paste descriptor text first." });
      return;
    }
    setState({ loading: true });
    try {
      const result = await postCurriculumUpload("/api/ingestion/pdf", {
        fileName: pdfFile?.name ?? "module-descriptor.txt",
        mimeType: pdfFile?.type ?? "text/plain",
        fileBase64: pdfFile ? await fileToBase64(pdfFile) : undefined,
        rawText: pdfText,
        moduleCode: pdfMeta.moduleCode || undefined,
        moduleTitle: pdfMeta.moduleTitle || undefined,
      });
      setState({ loading: false, result });
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : "Module descriptor upload failed" });
    }
  }

  async function runManualUpload() {
    if (!manual.moduleCode.trim() || !manual.moduleTitle.trim()) {
      setState({ loading: false, error: "Module code and module title are required." });
      return;
    }
    setState({ loading: true });
    try {
      const sections: DescriptorSection[] = [
        { sectionType: "other", title: "Overview", content: manual.overview },
        { sectionType: "aims", title: "Aims", content: manual.aims },
        { sectionType: "learning_outcomes", title: "Learning outcomes", content: manual.outcomes },
        { sectionType: "indicative_content", title: "Indicative content", content: manual.indicativeContent },
        { sectionType: "teaching_and_learning_strategy", title: "Teaching and learning strategy", content: manual.teaching },
        { sectionType: "assessment", title: "Assessment", content: manual.assessment },
        { sectionType: "requisites", title: "Requisites", content: manual.requisites },
        { sectionType: "resources", title: "Resources", content: manual.resources },
        { sectionType: "modality", title: "Modality", content: manual.modality },
      ].filter((section) => section.content.trim());

      const credits = Number(manual.credits);
      const result = await postCurriculumUpload("/api/ingestion/manual-module", {
        moduleCode: manual.moduleCode,
        moduleTitle: manual.moduleTitle,
        credits: Number.isFinite(credits) && manual.credits.trim() ? credits : undefined,
        stage: manual.stage || undefined,
        semester: manual.semester || undefined,
        sections,
      });
      setState({ loading: false, result });
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : "Manual module save failed" });
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Curriculum evidence</Badge>
          <h1 className="mt-3 text-3xl font-bold text-slate-950">Upload Curriculum</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Add curriculum evidence through the route that best matches your source. CAST keeps source data and curated
            records separate so weak or incomplete data can be reviewed rather than hidden.
          </p>
        </div>
      </div>

      <Tabs defaultValue="pdf" className="space-y-5">
        <TabsList className="grid h-auto grid-cols-1 gap-2 bg-slate-100 p-1 md:grid-cols-3">
          <TabsTrigger value="pdf" className="justify-start gap-3 rounded px-4 py-3 text-left data-[state=active]:bg-white">
            <FileText className="h-5 w-5 shrink-0" />
            <span>
              <span className="block font-semibold">Upload Module PDF</span>
              <span className="block text-xs font-normal text-slate-500">Single module descriptor</span>
            </span>
          </TabsTrigger>
          <TabsTrigger value="manual" className="justify-start gap-3 rounded px-4 py-3 text-left data-[state=active]:bg-white">
            <Keyboard className="h-5 w-5 shrink-0" />
            <span>
              <span className="block font-semibold">Complete Module Manually</span>
              <span className="block text-xs font-normal text-slate-500">Structured descriptor entry</span>
            </span>
          </TabsTrigger>
          <TabsTrigger value="programme" className="justify-start gap-3 rounded px-4 py-3 text-left data-[state=active]:bg-white">
            <FileSpreadsheet className="h-5 w-5 shrink-0" />
            <span>
              <span className="block font-semibold">Upload Programme Data</span>
              <span className="block text-xs font-normal text-slate-500">Akari-compatible spreadsheet</span>
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pdf">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="space-y-5 p-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Upload Module PDF</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Add a single module descriptor. If text extraction is not available, paste descriptor text for review.
                </p>
              </div>

              <UploadPanel
                file={pdfFile}
                onFileChange={setPdfFile}
                accept=".pdf,.txt"
                title="Click to select a PDF"
                description="PDF or text descriptor file"
              />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Module code (optional)</Label>
                  <Input
                    value={pdfMeta.moduleCode}
                    onChange={(event) => setPdfMeta({ ...pdfMeta, moduleCode: event.target.value })}
                    placeholder="e.g. CS101"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Module title (optional)</Label>
                  <Input
                    value={pdfMeta.moduleTitle}
                    onChange={(event) => setPdfMeta({ ...pdfMeta, moduleTitle: event.target.value })}
                    placeholder="e.g. Introduction to Computing"
                  />
                </div>
              </div>

              <SectionTextarea
                label="Descriptor text (optional)"
                value={pdfText}
                onChange={setPdfText}
                placeholder="Paste descriptor text here when a PDF is scanned, unavailable or not yet extractable."
                rows={6}
              />

              <Button onClick={runPdfUpload} disabled={state.loading} className="bg-blue-950 hover:bg-blue-900">
                <FileText className="mr-2 h-4 w-4" />
                Create Descriptor Evidence
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manual">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="space-y-5 p-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Complete Module Manually</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Enter the module details and descriptor sections you have. Missing fields are kept visible as data
                  quality issues rather than silently filled in.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Module code *</Label>
                  <Input
                    value={manual.moduleCode}
                    onChange={(event) => setManual({ ...manual, moduleCode: event.target.value })}
                    placeholder="e.g. CS101"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Module title *</Label>
                  <Input
                    value={manual.moduleTitle}
                    onChange={(event) => setManual({ ...manual, moduleTitle: event.target.value })}
                    placeholder="e.g. Introduction to Computer Science"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Credits</Label>
                  <Input
                    value={manual.credits}
                    onChange={(event) => setManual({ ...manual, credits: event.target.value })}
                    placeholder="e.g. 5"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Level or stage</Label>
                  <Input
                    value={manual.stage}
                    onChange={(event) => setManual({ ...manual, stage: event.target.value })}
                    placeholder="e.g. Stage 1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Semester</Label>
                  <Input
                    value={manual.semester}
                    onChange={(event) => setManual({ ...manual, semester: event.target.value })}
                    placeholder="e.g. Semester 1"
                  />
                </div>
              </div>

              <SectionTextarea
                label="Overview"
                value={manual.overview}
                onChange={(value) => setManual({ ...manual, overview: value })}
                placeholder="Module description..."
              />
              <SectionTextarea
                label="Aims"
                value={manual.aims}
                onChange={(value) => setManual({ ...manual, aims: value })}
                placeholder="Module aims..."
              />
              <SectionTextarea
                label="Learning outcomes"
                value={manual.outcomes}
                onChange={(value) => setManual({ ...manual, outcomes: value })}
                placeholder="What learners will be able to do..."
              />
              <SectionTextarea
                label="Indicative content"
                value={manual.indicativeContent}
                onChange={(value) => setManual({ ...manual, indicativeContent: value })}
                placeholder="Topics covered..."
              />
              <SectionTextarea
                label="Teaching and learning strategy"
                value={manual.teaching}
                onChange={(value) => setManual({ ...manual, teaching: value })}
                placeholder="Lectures, studios, labs, online activities, tutorials..."
              />
              <SectionTextarea
                label="Assessment details"
                value={manual.assessment}
                onChange={(value) => setManual({ ...manual, assessment: value })}
                placeholder="Assessment types, weighting, timing, formative or summative detail..."
              />
              <SectionTextarea
                label="Requisites"
                value={manual.requisites}
                onChange={(value) => setManual({ ...manual, requisites: value })}
                placeholder="Prerequisites, corequisites or excluded combinations..."
                rows={3}
              />
              <SectionTextarea
                label="Resources"
                value={manual.resources}
                onChange={(value) => setManual({ ...manual, resources: value })}
                placeholder="Core texts, equipment, software, facilities or learning resources..."
                rows={3}
              />
              <SectionTextarea
                label="Delivery or modality evidence"
                value={manual.modality}
                onChange={(value) => setManual({ ...manual, modality: value })}
                placeholder="On-campus, online, blended, placement, studio or other delivery evidence..."
                rows={3}
              />

              <Button onClick={runManualUpload} disabled={state.loading} className="bg-blue-950 hover:bg-blue-900">
                <Keyboard className="mr-2 h-4 w-4" />
                Create Module And Evidence
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="programme">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="space-y-5 p-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Upload Programme Data</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Upload an Akari-compatible spreadsheet containing programme, module and structure data.
                </p>
              </div>

              <div className="rounded border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950">
                <div className="flex gap-3">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <div className="font-semibold">Supported formats</div>
                    <p className="mt-1 leading-6">
                      CSV, XLSX and XLS exports are supported. CAST accepts Akari-style workbooks and single-sheet module lists
                      with headings such as module code, module title, credits, stage, semester, learning outcomes,
                      indicative content, teaching methods and assessments.
                    </p>
                  </div>
                </div>
              </div>

              <UploadPanel
                file={programmeFile}
                onFileChange={setProgrammeFile}
                accept=".csv,.xlsx,.xls"
                title="Click to select a spreadsheet"
                description=".csv, .xlsx or .xls format"
              />

              <Button onClick={runProgrammeUpload} disabled={state.loading} className="bg-blue-950 hover:bg-blue-900">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Upload Programme Data
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ResultPanel state={state} />
    </div>
  );
}
