import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  useParsePdf, 
  useParseExcel, 
  useCreateModule 
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FileUp, FileText, FileSpreadsheet, Loader2, Save, Info } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ParsedModuleRow } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";

const REQUISITES_OPTIONS = ["None", "Pre-requisite", "Co-requisite", "Pre- and Co-requisite", "Unknown"];

const CAMPUS_OPTIONS = ["Grangegorman", "Tallaght", "Blanchardstown", "Multiple", "Unknown"];

const manualFormSchema = z.object({
  moduleCode: z.string().min(1, "Module Code is required"),
  moduleTitle: z.string().min(1, "Module Title is required"),
  overview: z.string().optional(),
  learningOutcomes: z.string().optional(),
  indicativeSyllabus: z.string().optional(),
  teachingMethods: z.string().optional(),
  assessmentText: z.string().optional(),
  requisitesStatus: z.string().optional(),
  requisitesRaw: z.string().optional(),
  campus: z.string().optional(),
});

export default function Upload() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  
  // PDF
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const parsePdfMutation = useParsePdf();
  const createModuleMutation = useCreateModule();
  
  // Excel
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedModuleRow[]>([]);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const parseExcelMutation = useParseExcel();
  const [isUploadingExcel, setIsUploadingExcel] = useState(false);

  // Manual Form
  const form = useForm<z.infer<typeof manualFormSchema>>({
    resolver: zodResolver(manualFormSchema as any),
    defaultValues: {
      moduleCode: "",
      moduleTitle: "",
      overview: "",
      learningOutcomes: "",
      indicativeSyllabus: "",
      teachingMethods: "",
      assessmentText: "",
      requisitesStatus: "",
      requisitesRaw: "",
      campus: "",
    }
  });

  const checkDuplicate = async (code: string) => {
    if (!code || code === "TBD") return;
    try {
      const resp = await fetch(`/api/modules/check-code?code=${encodeURIComponent(code)}`);
      const data = await resp.json();
      if (data.exists) {
        toast({
          title: "Duplicate module code",
          description: `Warning: a module with code "${code}" already exists in the system. You can still save — this is for your information only.`,
        });
      }
    } catch {
      // Non-critical — silently ignore check failures
    }
  };

  const onManualSubmit = async (values: z.infer<typeof manualFormSchema>) => {
    if (!isAdmin) {
      toast({ variant: "destructive", title: "Admin access required", description: "Sign in as admin to create modules." });
      return;
    }
    await checkDuplicate(values.moduleCode);
    try {
      const result = await createModuleMutation.mutateAsync({
        data: {
          ...values,
          sourceType: "manual"
        }
      });
      toast({
        title: "Module created",
        description: "Successfully created module via manual entry.",
      });
      setLocation(`/modules/${result.id}`);
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Error creating module",
        description: "There was an error creating the module.",
      });
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = (e.target?.result as string).split(',')[1];
        if (result) resolve(result);
        else reject(new Error("Failed to read file"));
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handlePdfUpload = async () => {
    if (!isAdmin) {
      toast({ variant: "destructive", title: "Admin access required", description: "Sign in as admin to upload modules." });
      return;
    }
    if (!pdfFile) return;
    try {
      const base64Data = await readFileAsBase64(pdfFile);
      const parsed = await parsePdfMutation.mutateAsync({
        data: { fileName: pdfFile.name, base64Data }
      });
      const module = await createModuleMutation.mutateAsync({
        data: {
          moduleCode: "TBD",
          moduleTitle: "TBD",
          sourceType: "pdf",
          sourceFileName: pdfFile.name,
          rawText: parsed.text
        }
      });
      toast({ title: "PDF Parsed", description: "Continuing to extraction page." });
      setLocation(`/modules/${module.id}/extract`);
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Error parsing PDF",
        description: "There was an error parsing the PDF.",
      });
    }
  };

  const handleExcelPreview = async () => {
    if (!excelFile) return;
    try {
      const base64Data = await readFileAsBase64(excelFile);
      const rows = await parseExcelMutation.mutateAsync({
        data: { fileName: excelFile.name, base64Data }
      });
      setParsedRows(rows as unknown as ParsedModuleRow[]);
      if ((rows as unknown as ParsedModuleRow[]).length === 0) {
        toast({
          variant: "destructive",
          title: "No rows found",
          description: "The file appears to be empty or the column headers don't match the expected format.",
        });
      }
    } catch (e: unknown) {
      const is403 = e instanceof Error && e.message.includes("403");
      toast({
        variant: "destructive",
        title: is403 ? "Admin login required" : "Error parsing Excel",
        description: is403
          ? "You need to be logged in as admin to upload files. Please sign in at /admin/login."
          : "There was an error parsing the Excel file.",
      });
    }
  };

  const handleExcelUpload = async () => {
    if (!isAdmin) {
      toast({ variant: "destructive", title: "Admin access required", description: "Sign in as admin to upload modules." });
      return;
    }
    if (parsedRows.length === 0) return;
    setIsUploadingExcel(true);
    try {
      const modules = parsedRows
        .filter((r) => r.moduleCode && r.moduleTitle)
        .map((row) => ({
          moduleCode: row.moduleCode!,
          moduleTitle: row.moduleTitle!,
          sourceType: "excel",
          sourceFileName: excelFile?.name ?? null,
          school: row.school ?? null,
          campus: row.campus ?? null,
          overview: row.overview ?? null,
          learningOutcomes: row.learningOutcomes ?? null,
          indicativeSyllabus: row.indicativeSyllabus ?? null,
          teachingMethods: row.teachingMethods ?? null,
          assessmentText: row.assessmentText ?? null,
          requisitesStatus: row.requisitesStatus ?? null,
          requisitesRaw: row.requisitesRaw ?? null,
          affiliatedProgrammes: row.affiliatedProgrammes ?? [],
        }));

      if (modules.length === 0) {
        toast({ variant: "destructive", title: "Nothing to import", description: "No valid rows found." });
        return;
      }

      const resp = await fetch("/api/modules/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modules }),
      });
      const result = await resp.json();

      if (!resp.ok) {
        toast({ variant: "destructive", title: "Import failed", description: result.error ?? "Unknown error." });
        return;
      }

      const skippedNote = result.skipped > 0 ? ` (${result.skipped} skipped due to invalid data)` : "";
      const updatedNote = result.updated > 0 ? `, ${result.updated} existing updated (scores preserved)` : "";
      toast({
        title: "Excel Upload Complete",
        description: `Successfully imported ${result.imported} new module${result.imported !== 1 ? "s" : ""}${updatedNote}${skippedNote}.`,
      });
      setLocation(`/dashboard`);
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Error uploading modules",
        description: "There was an error uploading the modules.",
      });
    } finally {
      setIsUploadingExcel(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#003865" }}>Upload Modules</h1>
        <p className="text-slate-500 mt-1">Import module data for review and classification.</p>
      </div>

      <Tabs defaultValue="pdf" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pdf" className="flex items-center gap-2">
            <FileText className="w-4 h-4" /> PDF Document
          </TabsTrigger>
          <TabsTrigger value="manual" className="flex items-center gap-2">
            <Save className="w-4 h-4" /> Manual Entry
          </TabsTrigger>
          <TabsTrigger value="excel" className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" /> Excel Batch
          </TabsTrigger>
        </TabsList>

        {/* PDF TAB */}
        <TabsContent value="pdf">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Upload Module PDF</CardTitle>
              <CardDescription>
                Upload a syllabus or module descriptor. The text will be extracted for review.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-200 rounded-lg p-12 text-center hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2"
                style={{ "--tw-ring-color": "#003865" } as React.CSSProperties}
              >
                <FileUp className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <div className="space-y-2">
                  <p className="text-base font-semibold text-slate-700">Click to select a PDF</p>
                  <p className="text-sm text-slate-500">Maximum file size 10MB</p>
                </div>
                <input
                  ref={pdfInputRef}
                  id="pdf-upload"
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                />
              </button>
              
              {pdfFile && (
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-3">
                    <FileText className="w-6 h-6 text-blue-600" />
                    <div>
                      <p className="font-medium text-slate-900">{pdfFile.name}</p>
                      <p className="text-xs text-slate-500">{(pdfFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <Button 
                    onClick={handlePdfUpload} 
                    disabled={parsePdfMutation.isPending || createModuleMutation.isPending}
                    data-testid="button-upload-pdf"
                    style={{ backgroundColor: "#003865" }}
                    className="text-white hover:opacity-90"
                  >
                    {parsePdfMutation.isPending || createModuleMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                    ) : "Extract Text"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* MANUAL TAB */}
        <TabsContent value="manual">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Manual Entry</CardTitle>
              <CardDescription>
                Manually enter module details for review.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onManualSubmit)} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="moduleCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Module Code *</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., CS101" {...field} data-testid="input-manual-code" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="moduleTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Module Title *</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Intro to Computer Science" {...field} data-testid="input-manual-title" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="overview"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Overview</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Module description..." className="min-h-[100px]" {...field} data-testid="input-manual-overview" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="learningOutcomes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Learning Outcomes</FormLabel>
                        <FormControl>
                          <Textarea placeholder="What students will learn..." className="min-h-[100px]" {...field} data-testid="input-manual-outcomes" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="indicativeSyllabus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Indicative Syllabus</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Topics covered..." className="min-h-[100px]" {...field} data-testid="input-manual-syllabus" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="teachingMethods"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teaching Methods</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Lectures, tutorials, etc..." className="min-h-[100px]" {...field} data-testid="input-manual-methods" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="border-t border-slate-100 pt-4 space-y-4">
                    <FormField
                      control={form.control}
                      name="assessmentText"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assessments</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Assessment types, weighting, breakdown, etc." className="min-h-[100px]" {...field} data-testid="input-manual-assessment" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="requisitesStatus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Requisites Status</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="input-manual-requisites-status">
                                <SelectValue placeholder="Select requisites status..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {REQUISITES_OPTIONS.map(opt => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="requisitesRaw"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-500 text-xs">Requisites Detail <span className="font-normal">(optional)</span></FormLabel>
                          <FormControl>
                            <Textarea placeholder="e.g. LANG1001 must be completed before enrolment" className="min-h-[60px] text-xs" {...field} data-testid="input-manual-requisites-raw" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="campus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Campus</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="input-manual-campus">
                                <SelectValue placeholder="Select campus..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {CAMPUS_OPTIONS.map(opt => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={createModuleMutation.isPending}
                    data-testid="button-manual-submit"
                    style={{ backgroundColor: "#003865" }}
                    className="text-white hover:opacity-90"
                  >
                    {createModuleMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Create Module & Review
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* EXCEL TAB */}
        <TabsContent value="excel">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Batch Upload (Excel)</CardTitle>
              <CardDescription>
                Upload an Excel file (.xlsx or .xls) containing multiple modules.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* Column format hint */}
              <div className="flex gap-3 p-4 rounded-lg border border-blue-100 bg-blue-50">
                <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">Supported formats:</p>
                  <p className="mb-1.5 text-xs text-blue-700"><strong>Akari multi-sheet export</strong> — automatically detected. Upload the workbook as-is; all sections (Learning Outcomes, Assessments, Requisites, Teaching Methods, Syllabus) are joined and imported automatically.</p>
                  <p className="mb-1 text-xs text-blue-700"><strong>Single-sheet format</strong> — one row per module with headers:</p>
                  <div className="flex flex-wrap gap-2">
                    {["Module Code", "Module Title", "Overview", "Learning Outcomes", "Indicative Syllabus", "Teaching Methods"].map(col => (
                      <code key={col} className="px-2 py-0.5 bg-blue-100 rounded text-xs font-mono">{col}</code>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-blue-600">Single-sheet column names are flexible — variations like "module_code", "code", "title" are also accepted.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => excelInputRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-200 rounded-lg p-12 text-center hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer focus:outline-none"
              >
                <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <div className="space-y-2">
                  <p className="text-base font-semibold text-slate-700">
                    {excelFile ? excelFile.name : "Click to select an Excel file"}
                  </p>
                  {excelFile ? (
                    <p className="text-xs text-slate-500">Click to choose a different file</p>
                  ) : (
                    <p className="text-sm text-slate-500">.xlsx or .xls format</p>
                  )}
                </div>
                <input
                  ref={excelInputRef}
                  id="excel-upload"
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    setExcelFile(e.target.files?.[0] || null);
                    setParsedRows([]);
                  }}
                />
              </button>

              {excelFile && parsedRows.length === 0 && (
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-6 h-6 text-green-600" />
                    <div>
                      <p className="font-medium text-slate-900">{excelFile.name}</p>
                      <p className="text-xs text-slate-500">Click "Preview Data" to check rows before importing</p>
                    </div>
                  </div>
                  <Button 
                    onClick={handleExcelPreview} 
                    disabled={parseExcelMutation.isPending}
                    data-testid="button-preview-excel"
                    style={{ backgroundColor: "#003865" }}
                    className="text-white hover:opacity-90"
                  >
                    {parseExcelMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                    ) : "Preview Data"}
                  </Button>
                </div>
              )}

              {parsedRows.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold" style={{ color: "#003865" }}>
                      Preview — {parsedRows.length} row{parsedRows.length !== 1 ? 's' : ''} found
                    </h3>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setParsedRows([]); setExcelFile(null); }}
                      >
                        Clear
                      </Button>
                      <Button 
                        onClick={handleExcelUpload} 
                        disabled={isUploadingExcel}
                        data-testid="button-upload-excel"
                        style={{ backgroundColor: "#003865" }}
                        className="text-white hover:opacity-90"
                      >
                        {isUploadingExcel ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing...</>
                        ) : `Import All (${parsedRows.filter(r => r.moduleCode && r.moduleTitle).length} valid)`}
                      </Button>
                    </div>
                  </div>
                  <div className="border border-slate-200 rounded-md overflow-hidden max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Campus</TableHead>
                          <TableHead>Requisites</TableHead>
                          <TableHead>Assessments</TableHead>
                          <TableHead>Warnings</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedRows.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{r.moduleCode || <span className="text-red-500 text-xs">Missing</span>}</TableCell>
                            <TableCell>{r.moduleTitle || <span className="text-red-500 text-xs">Missing</span>}</TableCell>
                            <TableCell className="text-xs text-slate-600">{r.campus || <span className="text-slate-400">—</span>}</TableCell>
                            <TableCell className="text-xs text-slate-600">{r.requisitesStatus || <span className="text-slate-400">—</span>}</TableCell>
                            <TableCell className="text-xs text-slate-600">{r.assessmentText ? <span className="text-emerald-600">✓</span> : <span className="text-slate-400">—</span>}</TableCell>
                            <TableCell>
                              {r.warnings?.length > 0 ? (
                                <ul className="text-xs text-amber-600 list-disc pl-4">
                                  {r.warnings.map((w: string, j: number) => <li key={j}>{w}</li>)}
                                </ul>
                              ) : <span className="text-emerald-600 text-xs">✓ Ready</span>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
