import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  useGetModule, 
  useUpdateModule,
  useExtractFields,
  getGetModuleQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowRight, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const REQUISITES_OPTIONS = ["None", "Pre-requisite", "Co-requisite", "Pre- and Co-requisite", "Unknown"];

const extractFormSchema = z.object({
  moduleCode: z.string().min(1, "Module Code is required"),
  moduleTitle: z.string().min(1, "Module Title is required"),
  overview: z.string().optional(),
  learningOutcomes: z.string().optional(),
  indicativeSyllabus: z.string().optional(),
  teachingMethods: z.string().optional(),
  assessmentText: z.string().optional(),
  requisitesStatus: z.string().optional(),
  requisitesRaw: z.string().optional(),
  rawText: z.string().optional(),
});

export default function Extract() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isExtracting, setIsExtracting] = useState(false);
  const hasAutoExtracted = useRef(false);

  const { data: moduleData, isLoading } = useGetModule(id, {
    query: {
      enabled: !!id,
      queryKey: getGetModuleQueryKey(id)
    }
  });

  const updateModuleMutation = useUpdateModule();
  const extractFieldsMutation = useExtractFields();

  const form = useForm<z.infer<typeof extractFormSchema>>({
    resolver: zodResolver(extractFormSchema as any),
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
      rawText: "",
    }
  });

  // Populate form when data loads, then auto-extract if fields are empty
  useEffect(() => {
    if (!moduleData || hasAutoExtracted.current) return;

    const hasRawText = !!moduleData.rawText?.trim();
    const fieldsAreEmpty =
      (!moduleData.moduleCode || moduleData.moduleCode === "TBD") &&
      (!moduleData.moduleTitle || moduleData.moduleTitle === "TBD") &&
      !moduleData.overview &&
      !moduleData.learningOutcomes;

    // Always set rawText in the form
    form.setValue("rawText", moduleData.rawText || "");

    if (hasRawText && fieldsAreEmpty) {
      // Auto-extract fields from raw text using AI
      hasAutoExtracted.current = true;
      setIsExtracting(true);
      extractFieldsMutation.mutateAsync({ id }).then((extracted) => {
        form.reset({
          moduleCode: extracted.moduleCode || "",
          moduleTitle: extracted.moduleTitle || "",
          overview: extracted.overview || "",
          learningOutcomes: extracted.learningOutcomes || "",
          indicativeSyllabus: extracted.indicativeSyllabus || "",
          teachingMethods: extracted.teachingMethods || "",
          assessmentText: extracted.assessmentText || "",
          requisitesStatus: extracted.requisitesStatus || "",
          requisitesRaw: extracted.requisitesRaw || "",
          rawText: moduleData.rawText || "",
        });
        setIsExtracting(false);
      }).catch(() => {
        // If extraction fails, populate with what we have
        form.reset({
          moduleCode: moduleData.moduleCode !== "TBD" ? moduleData.moduleCode : "",
          moduleTitle: moduleData.moduleTitle !== "TBD" ? moduleData.moduleTitle : "",
          overview: moduleData.overview || "",
          learningOutcomes: moduleData.learningOutcomes || "",
          indicativeSyllabus: moduleData.indicativeSyllabus || "",
          teachingMethods: moduleData.teachingMethods || "",
          assessmentText: moduleData.assessmentText || "",
          requisitesStatus: moduleData.requisitesStatus || "",
          requisitesRaw: moduleData.requisitesRaw || "",
          rawText: moduleData.rawText || "",
        });
        setIsExtracting(false);
        toast({ variant: "destructive", title: "Auto-fill failed", description: "Could not extract fields automatically. Please fill them in manually." });
      });
    } else {
      // Fields already have data — just populate as normal
      form.reset({
        moduleCode: moduleData.moduleCode !== "TBD" ? moduleData.moduleCode : "",
        moduleTitle: moduleData.moduleTitle !== "TBD" ? moduleData.moduleTitle : "",
        overview: moduleData.overview || "",
        learningOutcomes: moduleData.learningOutcomes || "",
        indicativeSyllabus: moduleData.indicativeSyllabus || "",
        teachingMethods: moduleData.teachingMethods || "",
        assessmentText: moduleData.assessmentText || "",
        requisitesStatus: moduleData.requisitesStatus || "",
        requisitesRaw: moduleData.requisitesRaw || "",
        rawText: moduleData.rawText || "",
      });
    }
  }, [moduleData]);

  const checkDuplicate = async (code: string) => {
    if (!code || code === "TBD") return;
    try {
      const resp = await fetch(`/api/modules/check-code?code=${encodeURIComponent(code)}&excludeId=${id}`);
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

  const onSubmit = async (values: z.infer<typeof extractFormSchema>) => {
    await checkDuplicate(values.moduleCode);
    try {
      await updateModuleMutation.mutateAsync({
        id,
        data: values
      });
      queryClient.invalidateQueries({ queryKey: getGetModuleQueryKey(id) });
      toast({
        title: "Extraction saved",
        description: "Moving to review and classification.",
      });
      setLocation(`/modules/${id}`);
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Error saving extraction",
        description: "There was a problem saving your changes.",
      });
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  }

  if (!moduleData) {
    return <div className="text-center p-12 text-slate-500">Module not found</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Extract Content</h1>
        <p className="text-slate-500 mt-1">Review and refine the text extracted from the PDF before AI processing.</p>
      </div>

      {isExtracting && (
        <div
          className="flex items-center gap-3 px-5 py-4 rounded-xl border text-sm font-medium"
          style={{ backgroundColor: "rgba(0,56,101,0.06)", borderColor: "rgba(0,56,101,0.2)", color: "#003865" }}
        >
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" style={{ color: "#F5A800" }} />
          <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: "#F5A800" }} />
          <span>AI is reading the PDF and filling in the fields — this will take a few seconds…</span>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Form Fields */}
            <div className="space-y-6">
              <Card className="shadow-sm border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg">Module Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="moduleCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Module Code</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="extract-input-code" />
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
                          <FormLabel>Module Title</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="extract-input-title" />
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
                          <Textarea className="min-h-[100px]" {...field} data-testid="extract-input-overview" />
                        </FormControl>
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
                          <Textarea className="min-h-[100px]" {...field} data-testid="extract-input-outcomes" />
                        </FormControl>
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
                          <Textarea className="min-h-[100px]" {...field} data-testid="extract-input-syllabus" />
                        </FormControl>
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
                          <Textarea className="min-h-[100px]" {...field} data-testid="extract-input-methods" />
                        </FormControl>
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
                            <Textarea className="min-h-[100px]" placeholder="Assessment breakdown, types, weighting, etc." {...field} data-testid="extract-input-assessment" />
                          </FormControl>
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
                              <SelectTrigger data-testid="extract-input-requisites-status">
                                <SelectValue placeholder="Select requisites status..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {REQUISITES_OPTIONS.map(opt => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="requisitesRaw"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-500 text-xs">Requisites Detail <span className="font-normal">(optional — verbatim text from PDF)</span></FormLabel>
                          <FormControl>
                            <Textarea className="min-h-[60px] text-xs" placeholder="e.g. LANG1001 must be completed before enrolment" {...field} data-testid="extract-input-requisites-raw" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Raw Text */}
            <div className="space-y-6">
              <Card className="shadow-sm border-slate-200 h-full flex flex-col">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center justify-between">
                    Raw Extracted Text
                    <span className="text-xs font-normal text-slate-500">Copy from here to paste into fields</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 p-0 px-6 pb-6">
                  <FormField
                    control={form.control}
                    name="rawText"
                    render={({ field }) => (
                      <FormItem className="h-full flex flex-col">
                        <FormControl className="flex-1">
                          <Textarea 
                            className="h-[600px] font-mono text-xs bg-slate-50 border-slate-200" 
                            {...field} 
                            data-testid="extract-input-raw" 
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <Button 
              type="submit" 
              size="lg" 
              className="px-8 shadow-sm"
              disabled={updateModuleMutation.isPending}
              data-testid="extract-button-save"
            >
              {updateModuleMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save and Proceed to Review
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
