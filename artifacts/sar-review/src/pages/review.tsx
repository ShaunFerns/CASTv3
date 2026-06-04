import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { 
  useGetModule, 
  useUpdateModule,
  useClassifyModule,
  useScoreModule,
  useAnalyzeFreeElective,
  getGetModuleQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Save, Bot, CheckCircle2, Sparkles, Lock } from "lucide-react";
import { SAR_OPTIONS, STATUS_OPTIONS, TU_DUBLIN_SCHOOLS } from "@/lib/constants";
import { useCalibration } from "@/lib/calibration";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { ConfirmAnalysisDialog } from "@/components/confirm-analysis-dialog";

const BAND_COLORS: Record<string, string> = {
  Recommended: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Acceptable: "bg-blue-100 text-blue-800 border-blue-200",
  "Use With Caution": "bg-amber-100 text-amber-800 border-amber-200",
  "Not Suitable": "bg-red-100 text-red-800 border-red-200",
};

function FreeElectiveScoreBadge({ label, score }: { label: string; score: number | null | undefined }) {
  if (score == null) return null;
  const colors =
    score >= 4
      ? "bg-emerald-500 text-white"
      : score >= 3
        ? "bg-blue-500 text-white"
        : score >= 2
          ? "bg-amber-500 text-white"
          : "bg-red-500 text-white";
  return (
    <div className="flex items-center gap-2">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${colors}`}>{score}</div>
      <span className="text-sm text-slate-600">{label}</span>
    </div>
  );
}

const ScoreIndicator = ({ score }: { score: number | null | undefined }) => {
  if (!score) return <span className="text-slate-300">-</span>;
  
  const getColors = (s: number) => {
    if (s >= 4) return "bg-emerald-500 text-white";
    if (s >= 3) return "bg-blue-500 text-white";
    if (s >= 2) return "bg-amber-500 text-white";
    return "bg-red-500 text-white";
  };

  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${getColors(score)} shadow-sm`}>
      {score}
    </div>
  );
};

export default function Review() {
  const { uplift } = useCalibration();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: moduleData, isLoading } = useGetModule(id, {
    query: {
      enabled: !!id,
      queryKey: getGetModuleQueryKey(id)
    }
  });

  const updateModuleMutation = useUpdateModule();
  const classifyModuleMutation = useClassifyModule();
  const scoreModuleMutation = useScoreModule();
  const analyzeFreeElectiveMutation = useAnalyzeFreeElective();
  const { isAdmin } = useAuth();
  const [confirmAction, setConfirmAction] = useState<"classify" | "score" | "free-elective" | null>(null);

  // Local state for reviewer edits to prevent typing lag
  const [localState, setLocalState] = useState<any>({
    school: "",
    credits: "",
    semester: "",
    overview: "",
    learningOutcomes: "",
    indicativeSyllabus: "",
    teachingMethods: "",
    selectedSarFinal: "",
    criterion1ScoreFinal: "",
    criterion2ScoreFinal: "",
    criterion3ScoreFinal: "",
    criterion4ScoreFinal: "",
    criterion5ScoreFinal: "",
    overallCommentFinal: "",
    suitabilityNoteFinal: "",
    reviewerNote: "",
    constraints: "",
    reviewStatus: "pending",
  });
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (moduleData && !isDirty) {
      setLocalState({
        school: moduleData.school || "",
        credits: (moduleData as any).credits || "",
        semester: (moduleData as any).semester || "",
        overview: moduleData.overview || "",
        learningOutcomes: moduleData.learningOutcomes || "",
        indicativeSyllabus: moduleData.indicativeSyllabus || "",
        teachingMethods: moduleData.teachingMethods || "",
        selectedSarFinal: moduleData.selectedSarFinal || "",
        criterion1ScoreFinal: moduleData.criterion1ScoreFinal || "",
        criterion2ScoreFinal: moduleData.criterion2ScoreFinal || "",
        criterion3ScoreFinal: moduleData.criterion3ScoreFinal || "",
        criterion4ScoreFinal: moduleData.criterion4ScoreFinal || "",
        criterion5ScoreFinal: moduleData.criterion5ScoreFinal || "",
        overallCommentFinal: moduleData.overallCommentFinal || "",
        suitabilityNoteFinal: moduleData.suitabilityNoteFinal || "",
        reviewerNote: moduleData.reviewerNote || "",
        constraints: (moduleData as any).constraints || "",
        reviewStatus: moduleData.reviewStatus || "pending",
      });
    }
  }, [moduleData, isDirty]);

  const handleChange = (field: string, value: any) => {
    setLocalState((prev: any) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    try {
      const payload: any = { ...localState };
      // Normalise school — empty string → null
      if (!payload.school) payload.school = null;
      // Convert scores to numbers if present
      [1, 2, 3, 4, 5].forEach(i => {
        const key = `criterion${i}ScoreFinal`;
        if (payload[key]) {
          payload[key] = Number(payload[key]);
        } else {
          payload[key] = null;
        }
      });

      await updateModuleMutation.mutateAsync({
        id,
        data: payload
      });
      
      queryClient.invalidateQueries({ queryKey: getGetModuleQueryKey(id) });
      setIsDirty(false);
      toast({
        title: "Changes saved",
        description: "Module review updated successfully.",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Error saving",
        description: "Failed to save module review.",
      });
    }
  };

  const handleClassify = async () => {
    try {
      await classifyModuleMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetModuleQueryKey(id) });
      toast({
        title: "Classification Complete",
        description: "AI classification has been applied.",
      });
      // Optionally update status to classified if it was pending
      if (moduleData?.reviewStatus === "pending") {
         await updateModuleMutation.mutateAsync({ id, data: { reviewStatus: "classified" }});
         queryClient.invalidateQueries({ queryKey: getGetModuleQueryKey(id) });
      }
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Error running classification",
        description: "Failed to classify module.",
      });
    }
  };

  const handleScore = async () => {
    const sarToScore = localState.selectedSarFinal || moduleData?.primarySarAi;
    if (!sarToScore) {
      toast({
        variant: "destructive",
        title: "Cannot score",
        description: "Please classify the module or select a Final SAR before scoring.",
      });
      return;
    }

    try {
      await scoreModuleMutation.mutateAsync({ 
        id, 
        data: { sarName: sarToScore } 
      });
      queryClient.invalidateQueries({ queryKey: getGetModuleQueryKey(id) });
      toast({
        title: "Scoring Complete",
        description: "AI scoring has been applied.",
      });
      if (moduleData?.reviewStatus === "classified" || moduleData?.reviewStatus === "pending") {
        await updateModuleMutation.mutateAsync({ id, data: { reviewStatus: "scored" }});
        queryClient.invalidateQueries({ queryKey: getGetModuleQueryKey(id) });
      }
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Error running scoring",
        description: "Failed to score module.",
      });
    }
  };

  const handleFreeElective = async () => {
    try {
      await analyzeFreeElectiveMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetModuleQueryKey(id) });
      toast({
        title: "Free Elective Analysis Complete",
        description: "Discipline classification and suitability scores have been applied.",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Analysis failed",
        description: "Could not run free elective analysis. Please try again.",
      });
    }
  };

  const showAdminToast = () => {
    toast({
      variant: "destructive",
      title: "Admin access required",
      description: "Sign in as admin to run AI analysis.",
    });
  };

  const handleClassifyClick = () => {
    if (!isAdmin) { showAdminToast(); return; }
    setConfirmAction("classify");
  };

  const handleScoreClick = () => {
    if (!isAdmin) { showAdminToast(); return; }
    if (!localState.selectedSarFinal && !moduleData?.primarySarAi) {
      toast({
        variant: "destructive",
        title: "Cannot score",
        description: "Please classify the module or select a Final SAR before scoring.",
      });
      return;
    }
    setConfirmAction("score");
  };

  const handleFreeElectiveClick = () => {
    if (!isAdmin) { showAdminToast(); return; }
    setConfirmAction("free-elective");
  };

  const handleConfirmAnalysis = async () => {
    const action = confirmAction;
    setConfirmAction(null);
    if (action === "classify") await handleClassify();
    else if (action === "score") await handleScore();
    else if (action === "free-elective") await handleFreeElective();
  };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  if (!moduleData) return <div className="text-center p-12 text-slate-500">Module not found</div>;

  const isScored = moduleData.criterion1ScoreAi != null;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="flex items-center justify-between sticky top-16 bg-slate-50 z-20 py-4 -mt-4 mb-4 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="text-slate-500 hover:text-slate-900">
            <Link href="/"><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{moduleData.moduleCode}: {moduleData.moduleTitle}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className="bg-white capitalize text-slate-600">{moduleData.reviewStatus}</Badge>
              {moduleData.scoreBand && (
                <Badge variant="outline" className={`
                  ${moduleData.scoreBand === 'Strong Fit' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''}
                  ${moduleData.scoreBand === 'Moderate Fit' ? 'bg-amber-50 text-amber-700 border-amber-200' : ''}
                  ${moduleData.scoreBand === 'Weak Fit' ? 'bg-red-50 text-red-700 border-red-200' : ''}
                `}>
                  {moduleData.scoreBand}
                </Badge>
              )}
              {moduleData.requisitesStatus && (
                <Badge variant="outline" className={`
                  ${moduleData.requisitesStatus === 'None' ? 'bg-slate-50 text-slate-500 border-slate-200' : ''}
                  ${moduleData.requisitesStatus === 'Pre-requisite' ? 'bg-orange-50 text-orange-700 border-orange-200' : ''}
                  ${moduleData.requisitesStatus === 'Co-requisite' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : ''}
                  ${moduleData.requisitesStatus === 'Pre- and Co-requisite' ? 'bg-red-50 text-red-700 border-red-200' : ''}
                  ${moduleData.requisitesStatus === 'Unknown' ? 'bg-slate-50 text-slate-400 border-slate-200' : ''}
                `}>
                  Requisites: {moduleData.requisitesStatus}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label>Status:</Label>
            <Select value={localState.reviewStatus} onValueChange={(v) => handleChange("reviewStatus", v)}>
              <SelectTrigger className="w-[140px] bg-white capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSave} disabled={!isDirty || updateModuleMutation.isPending} className="min-w-[100px] shadow-sm">
            {updateModuleMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* LEFT COLUMN - Module Content */}
        <div className="space-y-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-100/50 border-b border-slate-200 pb-4">
              <CardTitle className="text-lg">Module Content</CardTitle>
              <CardDescription>Source data for review.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-2">
                <Label className="text-slate-700 font-semibold">
                  School
                  {!localState.school && (
                    <span className="ml-2 text-xs font-normal text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">Missing</span>
                  )}
                </Label>
                <Select value={localState.school || "__none__"} onValueChange={(v) => handleChange("school", v === "__none__" ? "" : v)}>
                  <SelectTrigger className={`bg-slate-50 focus:bg-white ${!localState.school ? "border-amber-300" : ""}`}>
                    <SelectValue placeholder="Select school…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Not assigned —</SelectItem>
                    {TU_DUBLIN_SCHOOLS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-700 font-semibold">Credits</Label>
                  <Input
                    placeholder="e.g. 5"
                    value={localState.credits}
                    onChange={e => handleChange("credits", e.target.value)}
                    className="bg-slate-50 focus:bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 font-semibold">Semester</Label>
                  <Input
                    placeholder="e.g. 1 or 1 & 2"
                    value={localState.semester}
                    onChange={e => handleChange("semester", e.target.value)}
                    className="bg-slate-50 focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-700 font-semibold">Overview</Label>
                <Textarea 
                  value={localState.overview} 
                  onChange={e => handleChange("overview", e.target.value)} 
                  className="min-h-[120px] bg-slate-50 focus:bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-semibold">Learning Outcomes</Label>
                <Textarea 
                  value={localState.learningOutcomes} 
                  onChange={e => handleChange("learningOutcomes", e.target.value)} 
                  className="min-h-[120px] bg-slate-50 focus:bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-semibold">Indicative Syllabus</Label>
                <Textarea 
                  value={localState.indicativeSyllabus} 
                  onChange={e => handleChange("indicativeSyllabus", e.target.value)} 
                  className="min-h-[120px] bg-slate-50 focus:bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-semibold">Teaching Methods</Label>
                <Textarea 
                  value={localState.teachingMethods} 
                  onChange={e => handleChange("teachingMethods", e.target.value)} 
                  className="min-h-[120px] bg-slate-50 focus:bg-white"
                />
              </div>
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <Label className="text-slate-700 font-semibold">Assessments</Label>
                {moduleData.assessmentText ? (
                  <div className="min-h-[80px] rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {moduleData.assessmentText}
                  </div>
                ) : (
                  <div className="min-h-[48px] rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400 italic">
                    Not available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN - Classification & Scoring */}
        <div className="space-y-6">
          
          {/* Classification Panel */}
          <Card className="shadow-sm border-slate-200 overflow-hidden">
            <CardHeader className="text-white pb-4" style={{ backgroundColor: "#003865" }}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bot className="w-5 h-5 text-blue-300" />
                  AI Classification
                </CardTitle>
                <Button 
                  size="sm" 
                  variant="secondary" 
                  onClick={handleClassifyClick}
                  disabled={classifyModuleMutation.isPending}
                  className="bg-white/10 hover:bg-white/20 text-white border-0"
                >
                  {classifyModuleMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : !isAdmin ? <Lock className="w-3 h-3 mr-1.5 opacity-70" /> : null}
                  Run Classification
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2 p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <Label className="text-slate-500 uppercase text-xs font-bold tracking-wider">AI Primary SAR</Label>
                  <div className="font-semibold text-lg text-slate-900">{moduleData.primarySarAi || <span className="text-slate-300 italic">Not classified</span>}</div>
                  {moduleData.sarConfidence && (
                    <Badge variant="outline" className={`mt-2 ${
                      moduleData.sarConfidence === 'high' ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 
                      moduleData.sarConfidence === 'medium' ? 'text-amber-700 border-amber-200 bg-amber-50' : 
                      'text-red-700 border-red-200 bg-red-50'
                    }`}>
                      {moduleData.sarConfidence} confidence
                    </Badge>
                  )}
                </div>
                <div className="space-y-2 p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <Label className="text-slate-500 uppercase text-xs font-bold tracking-wider">AI Secondary SAR</Label>
                  <div className="font-semibold text-lg text-slate-900">{moduleData.secondarySarAi || <span className="text-slate-300 italic">None</span>}</div>
                </div>
                <div className="space-y-2 p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <Label className="text-blue-700 uppercase text-xs font-bold tracking-wider flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Reviewer Final SAR
                  </Label>
                  <Select value={localState.selectedSarFinal} onValueChange={(v) => handleChange("selectedSarFinal", v)}>
                    <SelectTrigger className="bg-white border-blue-200 focus:ring-blue-500">
                      <SelectValue placeholder="Confirm SAR..." />
                    </SelectTrigger>
                    <SelectContent>
                      {SAR_OPTIONS.map(sar => <SelectItem key={sar} value={sar}>{sar}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {moduleData.sarRationale && (
                <div className="space-y-2">
                  <Label className="text-slate-500 uppercase text-xs font-bold tracking-wider">AI Rationale</Label>
                  <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-md border border-slate-100 leading-relaxed">
                    {moduleData.sarRationale}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scoring Panel */}
          <Card className="shadow-sm border-slate-200 overflow-hidden">
            <CardHeader className="text-white pb-4" style={{ backgroundColor: "#003865" }}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bot className="w-5 h-5 text-amber-300" />
                  AI Scoring
                </CardTitle>
                <Button 
                  size="sm" 
                  variant="secondary"
                  onClick={handleScoreClick}
                  disabled={scoreModuleMutation.isPending}
                  className="bg-white/10 hover:bg-white/20 text-white border-0"
                >
                  {scoreModuleMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : !isAdmin ? <Lock className="w-3 h-3 mr-1.5 opacity-70" /> : null}
                  Run Scoring
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              
              {!isScored && !scoreModuleMutation.isPending && (
                <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                  <p>Module has not been scored yet.</p>
                  <p className="text-sm mt-1">Run classification, verify the SAR, then run scoring.</p>
                </div>
              )}

              {isScored && (
                <>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Average Score</div>
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-xs text-slate-500 mb-1">AI</div>
                        <ScoreIndicator score={moduleData.averageScoreAi ? Number(moduleData.averageScoreAi.toFixed(1)) : null} />
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-blue-700 font-bold mb-1">Final</div>
                        <ScoreIndicator score={moduleData.averageScoreFinal != null ? Number(Math.min(moduleData.averageScoreFinal + uplift, 4).toFixed(1)) : null} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {[1, 2, 3, 4, 5].map((i) => {
                      const cName = moduleData[`criterion${i}Name` as keyof typeof moduleData] as string;
                      const aiScore = moduleData[`criterion${i}ScoreAi` as keyof typeof moduleData] as number;
                      const aiRationale = moduleData[`criterion${i}RationaleAi` as keyof typeof moduleData] as string;
                      const stateKey = `criterion${i}ScoreFinal`;

                      if (!cName) return null;

                      return (
                        <div key={i} className="border border-slate-200 rounded-lg p-4 space-y-3 relative overflow-hidden bg-white">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-200"></div>
                          <div className="flex justify-between items-start pl-2">
                            <h4 className="font-semibold text-slate-900 text-sm pr-4">{cName}</h4>
                            <div className="flex items-center gap-4 shrink-0">
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-[10px] uppercase font-bold text-slate-400">AI</span>
                                <ScoreIndicator score={aiScore} />
                              </div>
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-[10px] uppercase font-bold text-blue-600">Final</span>
                                <Select 
                                  value={localState[stateKey]?.toString() || ""} 
                                  onValueChange={v => handleChange(stateKey, v)}
                                >
                                  <SelectTrigger className="w-[60px] h-8 bg-blue-50 border-blue-200 text-blue-900 font-bold">
                                    <SelectValue placeholder="-" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="1">1</SelectItem>
                                    <SelectItem value="2">2</SelectItem>
                                    <SelectItem value="3">3</SelectItem>
                                    <SelectItem value="4">4</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                          <p className="text-sm text-slate-600 pl-2 leading-relaxed bg-slate-50 p-2 rounded">
                            {aiRationale}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-slate-700 font-semibold flex items-center justify-between">
                        Overall Comment
                        <Badge variant="secondary" className="font-normal">AI provided</Badge>
                      </Label>
                      <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-md border border-slate-100 mb-2">
                        {moduleData.overallCommentAi || "No comment."}
                      </div>
                      <Textarea 
                        placeholder="Final reviewer comment..."
                        value={localState.overallCommentFinal} 
                        onChange={e => handleChange("overallCommentFinal", e.target.value)} 
                        className="bg-white border-blue-200 focus:border-blue-400"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-700 font-semibold flex items-center justify-between">
                        Suitability Note
                        <Badge variant="secondary" className="font-normal">AI provided</Badge>
                      </Label>
                      <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-md border border-slate-100 mb-2">
                        {moduleData.suitabilityNoteAi || "No note."}
                      </div>
                      <Textarea 
                        placeholder="Final reviewer suitability note..."
                        value={localState.suitabilityNoteFinal} 
                        onChange={e => handleChange("suitabilityNoteFinal", e.target.value)} 
                        className="bg-white border-blue-200 focus:border-blue-400"
                      />
                    </div>
                  </div>
                </>
              )}

              <Separator />
              
              <div className="space-y-2">
                <Label className="text-slate-700 font-semibold">Reviewer Internal Notes</Label>
                <Textarea 
                  placeholder="Private notes (not included in final output)..."
                  value={localState.reviewerNote} 
                  onChange={e => handleChange("reviewerNote", e.target.value)} 
                  className="bg-yellow-50 focus:bg-yellow-100/50 border-yellow-200"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-700 font-semibold">Constraints</Label>
                <Textarea
                  placeholder="Prerequisites, scheduling constraints, capacity limits, etc."
                  value={localState.constraints}
                  onChange={e => handleChange("constraints", e.target.value)}
                  className="bg-slate-50 focus:bg-white"
                />
              </div>

            </CardContent>
          </Card>
          {/* Free Elective Analysis Panel */}
          <Card className="shadow-sm overflow-hidden" style={{ borderColor: "#F5A800", borderWidth: 2 }}>
            <CardHeader className="pb-4" style={{ backgroundColor: "#F5A800" }}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2" style={{ color: "#003865" }}>
                  <Sparkles className="w-5 h-5" />
                  Free Elective Analysis
                </CardTitle>
                <Button
                  size="sm"
                  onClick={handleFreeElectiveClick}
                  disabled={analyzeFreeElectiveMutation.isPending}
                  style={{ backgroundColor: "#003865", color: "white" }}
                  className="hover:opacity-90 border-0"
                >
                  {analyzeFreeElectiveMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : !isAdmin ? (
                    <Lock className="w-3 h-3 mr-1.5 opacity-70" />
                  ) : null}
                  {moduleData.freeElectiveBandAi ? "Re-run Analysis" : "Run Free Elective Analysis"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              {!moduleData.freeElectiveBandAi && !analyzeFreeElectiveMutation.isPending && (
                <div className="text-center py-8 text-slate-500 bg-amber-50 rounded-lg border border-dashed border-amber-200">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 text-amber-400" />
                  <p className="text-sm font-medium">No free elective analysis yet.</p>
                  <p className="text-xs mt-1 text-slate-400">Click the button above to classify this module for free elective advising.</p>
                </div>
              )}

              {moduleData.freeElectiveBandAi && (
                <>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Discipline Family</p>
                      <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-[#003865]/10 text-[#003865]">
                        {moduleData.disciplineFamily ?? "—"}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Suitability</p>
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold border ${BAND_COLORS[moduleData.freeElectiveBandAi] ?? "bg-slate-100 text-slate-700"}`}>
                        {moduleData.freeElectiveBandAi}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Scores</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-100">
                        <FreeElectiveScoreBadge label="Accessibility" score={moduleData.accessibilityScoreAi} />
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-100">
                        <FreeElectiveScoreBadge label="Stage Fit" score={moduleData.stageAppropriatenessScoreAi} />
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-100">
                        <FreeElectiveScoreBadge label="Breadth" score={moduleData.breadthTransferabilityScoreAi} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-xs text-slate-500">Average:</span>
                      <span className="font-bold text-[#003865]">{moduleData.freeElectiveAverageAi?.toFixed(2) ?? "—"}</span>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Advising Tags</p>
                    <div className="flex flex-wrap gap-2">
                      {moduleData.tagExplore && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#003865]/10 text-[#003865] border border-[#003865]/20">Explore</span>
                      )}
                      {moduleData.tagUsefulSkills && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#003865]/10 text-[#003865] border border-[#003865]/20">Useful Skills</span>
                      )}
                      {moduleData.tagPathwaySupport && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#003865]/10 text-[#003865] border border-[#003865]/20">Pathway Support</span>
                      )}
                      {!moduleData.tagExplore && !moduleData.tagUsefulSkills && !moduleData.tagPathwaySupport && (
                        <span className="text-xs text-slate-400">No tags assigned</span>
                      )}
                    </div>
                  </div>

                  {moduleData.freeElectiveRationaleAi && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Rationale</p>
                      <p className="text-sm text-slate-700 bg-amber-50 p-3 rounded-md border border-amber-100 leading-relaxed">
                        {moduleData.freeElectiveRationaleAi}
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmAnalysisDialog
        open={confirmAction !== null}
        title={
          confirmAction === "classify" ? "Run AI Classification" :
          confirmAction === "score" ? "Run AI Scoring" :
          "Run Free Elective Analysis"
        }
        description={
          confirmAction === "classify"
            ? "This will classify the module against 8 Subject Area Requirements using AI."
            : confirmAction === "score"
            ? "This will score the module against the selected SAR criteria using AI."
            : "This will classify this module for free elective advising and generate suitability scores."
        }
        onConfirm={handleConfirmAnalysis}
        onCancel={() => setConfirmAction(null)}
        isLoading={
          (confirmAction === "classify" && classifyModuleMutation.isPending) ||
          (confirmAction === "score" && scoreModuleMutation.isPending) ||
          (confirmAction === "free-elective" && analyzeFreeElectiveMutation.isPending)
        }
      />
    </div>
  );
}
