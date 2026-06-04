import { useState, useEffect } from "react";
import { Loader2, PlayCircle, CheckCircle2, Sparkles } from "lucide-react";
import { useCalibration, CALIBRATION_OPTIONS, type CalibrationMode } from "@/lib/calibration";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}/api${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<T>;
}

// ── GA Batch Component ────────────────────────────────────────────────────────
function GaBatchSection() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone]       = useState(false);
  const [progress, setProgress]   = useState<{ total: number; processed: number } | null>(null);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(async () => {
      try {
        const s = await apiFetch<{ total: number; processed: number; generating: boolean }>(
          "/module-catalogue/ga/batch-classify/status"
        );
        setProgress({ total: s.total, processed: s.processed });
        if (!s.generating) {
          setIsRunning(false);
          setIsDone(true);
          setProgress(null);
          clearInterval(interval);
        }
      } catch { /* ignore */ }
    }, 2500);
    return () => clearInterval(interval);
  }, [isRunning]);

  const run = async (force = false) => {
    if (!isAdmin) {
      toast({ variant: "destructive", title: "Admin access required", description: "Sign in as admin to run AI classification." });
      return;
    }
    setIsRunning(true);
    setIsDone(false);
    setProgress({ total: 0, processed: 0 });
    try {
      const r = await apiFetch<{ started: boolean; message: string }>(
        "/module-catalogue/ga/batch-classify",
        { method: "POST", body: JSON.stringify({ force }) }
      );
      if (!r.started) {
        // If a job is already running, join it by continuing to poll
        if (r.message?.includes("Already generating")) {
          // Just keep polling — the useEffect interval will pick it up
          return;
        }
        // Otherwise genuinely nothing to do
        setIsRunning(false);
        setIsDone(true);
        setProgress(null);
      }
    } catch (err) {
      setIsRunning(false);
      setProgress(null);
      toast({ variant: "destructive", title: "Classification failed", description: err instanceof Error ? err.message : "Unknown error" });
    }
  };

  const pct = progress && progress.total > 0
    ? Math.round((progress.processed / progress.total) * 100)
    : 0;

  return (
    <section className="border border-dashed rounded-xl p-6 space-y-4" style={{ borderColor: "#F5A800" }}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-3.5 w-3.5" style={{ color: "#F5A800" }} />
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Batch GA Classification — All Modules
            </h2>
          </div>
          <p className="text-sm text-slate-500 leading-relaxed">
            Run AI Graduate Attribute classification across <strong className="text-slate-600">every module in the system</strong>,
            regardless of whether it is in a programme. Results appear in the Module Catalogue.
            Existing user-set classifications are preserved.
          </p>

          {isRunning && progress && (
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
                <span>Classifying {progress.processed} / {progress.total || "…"} modules ({pct}%)</span>
              </div>
              {progress.total > 0 && (
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: "#F5A800" }}
                  />
                </div>
              )}
            </div>
          )}

          {isDone && !isRunning && (
            <p className="mt-2 text-xs text-emerald-600 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Classification complete — refresh the Module Catalogue to see results.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          <button
            onClick={() => run(false)}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ borderColor: "#F5A800", color: "#003865", backgroundColor: "#FFF9EC" }}
          >
            {isRunning
              ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#F5A800" }} />
              : isDone
              ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              : <Sparkles className="w-4 h-4" style={{ color: "#F5A800" }} />}
            {isRunning ? "Running…" : isDone ? "Done" : "Classify missing"}
          </button>
          <button
            onClick={() => run(true)}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 text-sm font-medium hover:text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <PlayCircle className="w-4 h-4" />
            Re-run all
          </button>
        </div>
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function About() {
  const { mode, setMode } = useCalibration();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [isDone, setIsDone] = useState(false);

  const addLog = (msg: string) => setLog((prev) => [...prev, msg]);

  const runBatchAnalysis = async () => {
    if (!isAdmin) {
      toast({ variant: "destructive", title: "Admin access required", description: "Sign in as admin to run batch analysis." });
      return;
    }
    setIsRunning(true);
    setIsDone(false);
    setLog([]);

    try {
      const resp = await fetch("/api/modules");
      if (!resp.ok) throw new Error("Failed to fetch modules");
      const modules: Record<string, unknown>[] = await resp.json();

      const toProcess = modules.filter(
        (m) => !m.averageScoreFinal || !m.freeElectiveAverageAi
      );

      if (toProcess.length === 0) {
        addLog("All modules already have analysis results — nothing to do.");
        setIsDone(true);
        setIsRunning(false);
        return;
      }

      addLog(`Found ${toProcess.length} module(s) to process.`);

      for (const mod of toProcess) {
        const id = mod.id as number;
        const label = String(mod.moduleCode ?? id);

        if (!mod.averageScoreFinal) {
          let sarName = mod.selectedSarFinal as string | null;

          if (!sarName) {
            addLog(`[${label}] Classifying SAR...`);
            try {
              const cResp = await fetch(`/api/modules/${id}/classify`, { method: "POST" });
              if (cResp.ok) {
                const cData = await cResp.json();
                sarName = cData.primarySar as string;
                addLog(`[${label}] SAR classified → ${sarName}`);
              } else {
                addLog(`[${label}] Classification failed — skipping SAR scoring.`);
              }
            } catch {
              addLog(`[${label}] Classification error — skipping SAR scoring.`);
            }
          }

          if (sarName) {
            addLog(`[${label}] Scoring against ${sarName}...`);
            try {
              const sResp = await fetch(`/api/modules/${id}/score`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sarName }),
              });
              if (sResp.ok) {
                const sData = await sResp.json();
                const avg = typeof sData.averageScore === "number"
                  ? sData.averageScore.toFixed(2)
                  : "—";
                addLog(`[${label}] Scored → avg ${avg}`);
              } else {
                addLog(`[${label}] Scoring failed.`);
              }
            } catch {
              addLog(`[${label}] Scoring error.`);
            }
          }
        }

        if (!mod.freeElectiveAverageAi) {
          addLog(`[${label}] Analysing free elective suitability...`);
          try {
            const feResp = await fetch(`/api/modules/${id}/analyze-free-elective`, {
              method: "POST",
            });
            if (feResp.ok) {
              const feData = await feResp.json();
              const band = feData.freeElectiveBand ?? "—";
              const avg = typeof feData.freeElectiveAverage === "number"
                ? feData.freeElectiveAverage.toFixed(2)
                : "—";
              addLog(`[${label}] Free elective → ${band} (${avg})`);
            } else {
              addLog(`[${label}] Free elective analysis failed.`);
            }
          } catch {
            addLog(`[${label}] Free elective analysis error.`);
          }
        }
      }

      addLog("Batch analysis complete.");
      setIsDone(true);
    } catch {
      addLog("Error: could not fetch modules from the server.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-10 animate-in fade-in duration-500 pb-16 pt-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#003865" }}>
          About This Tool
        </h1>
        <p className="text-slate-500 mt-2 text-base leading-relaxed">
          A structured starting point for curriculum review and elective provision.
        </p>
      </div>

      {/* Overview */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
        <h2 className="text-lg font-bold mb-3" style={{ color: "#003865" }}>Overview</h2>
        <p className="text-slate-600 leading-relaxed">
          This tool supports programme teams in understanding how individual modules contribute to curriculum
          structure and how they may be used within Subject Area Requirements (SARs) and free elective provision.
        </p>
        <p className="text-slate-600 leading-relaxed mt-3">
          It has been developed to improve visibility, consistency, and decision-making when working with module
          descriptors. The tool does not replace academic judgement or formal approval processes. Instead, it
          provides a structured starting point to support discussion, review, and programme design.
        </p>
      </section>

      {/* What the tool does */}
      <section className="space-y-6">
        <h2 className="text-lg font-bold" style={{ color: "#003865" }}>What the Tool Does</h2>
        <p className="text-slate-600 leading-relaxed -mt-2">
          The tool analyses module descriptors (e.g. overview, learning outcomes, syllabus) and produces two
          types of outputs.
        </p>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-7">
          <div className="flex items-center gap-2 mb-4">
            <span
              className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
              style={{ backgroundColor: "#003865", color: "white" }}
            >
              1
            </span>
            <h3 className="font-bold text-base" style={{ color: "#003865" }}>
              Subject Area Requirement (SAR) Analysis
            </h3>
          </div>
          <p className="text-slate-600 leading-relaxed mb-4">
            This identifies how a module aligns with defined Subject Area Requirements.
          </p>
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">It supports</p>
          <ul className="space-y-1.5">
            {[
              "Programme design and validation",
              "Alignment with curriculum structures",
              "Consistency in how SARs are interpreted",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-slate-600 text-sm">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: "#003865" }} />
                {item}
              </li>
            ))}
          </ul>
          <p className="text-slate-500 text-sm mt-4 italic">
            SAR analysis is reviewer-informed and is intended to support, not replace, academic decision-making.
          </p>
        </div>

        <div className="bg-white rounded-xl border-2 shadow-sm p-7" style={{ borderColor: "#F5A800" }}>
          <div className="flex items-center gap-2 mb-4">
            <span
              className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
              style={{ backgroundColor: "#F5A800", color: "#003865" }}
            >
              2
            </span>
            <h3 className="font-bold text-base" style={{ color: "#003865" }}>
              Free Elective Analysis
            </h3>
          </div>
          <p className="text-slate-600 leading-relaxed mb-5">
            This identifies whether a module is suitable for inclusion as a free elective, particularly for
            learners outside the discipline.
          </p>
          <div className="space-y-4 mb-5">
            {[
              {
                label: "Accessibility",
                desc: "Whether the module can reasonably be taken by a non-specialist learner",
              },
              {
                label: "Stage Appropriateness",
                desc: "Whether the module is suitable for learners at different stages, taking into account both module level and likely entry requirements",
              },
              {
                label: "Breadth and Transferability",
                desc: "Whether the module provides broadly useful knowledge or skills beyond a narrow disciplinary context",
              },
            ].map((criterion) => (
              <div key={criterion.label} className="flex gap-3">
                <span
                  className="mt-0.5 w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: "#F5A800" }}
                />
                <div>
                  <span className="font-semibold text-sm" style={{ color: "#003865" }}>
                    {criterion.label}
                  </span>
                  <p className="text-slate-600 text-sm mt-0.5">{criterion.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">The tool also</p>
          <ul className="space-y-1.5">
            {[
              "Groups modules into broad discipline areas",
              "Highlights transferable skill development",
              "Provides short explanations to support advising conversations",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-slate-600 text-sm">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: "#F5A800" }} />
                {item}
              </li>
            ))}
          </ul>
          <p className="text-slate-500 text-sm mt-4 italic">
            This analysis is AI-assisted and designed to support initial filtering and structuring. Final
            decisions remain with programme teams.
          </p>
        </div>
      </section>

      {/* How the tool should be used */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
        <h2 className="text-lg font-bold mb-4" style={{ color: "#003865" }}>How the Tool Should Be Used</h2>
        <p className="text-slate-600 leading-relaxed mb-4">The outputs of this tool are intended to:</p>
        <ul className="space-y-2">
          {[
            "Support programme teams in identifying suitable modules",
            "Assist Academic Affairs and Banner configuration through structured module sets",
            "Provide a consistent basis for advising discussions",
            "Surface potential issues such as hidden prerequisites or overly specialised content",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-slate-600 text-sm">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: "#003865" }} />
              {item}
            </li>
          ))}
        </ul>
        <p className="text-slate-500 text-sm mt-5 italic">
          The tool should be used as a guide, not as a definitive authority.
        </p>
      </section>

      {/* What the tool does not do */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
        <h2 className="text-lg font-bold mb-4" style={{ color: "#003865" }}>What the Tool Does Not Do</h2>
        <p className="text-slate-600 leading-relaxed mb-4">This tool does not:</p>
        <ul className="space-y-2">
          {[
            "Approve or validate modules",
            "Replace programme boards or academic governance processes",
            "Determine final curriculum structures",
            "Guarantee student suitability in all cases",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-slate-600 text-sm">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-red-400" />
              {item}
            </li>
          ))}
        </ul>
        <p className="text-slate-500 text-sm mt-5 italic">
          All outputs should be considered alongside professional judgement and programme-specific context.
        </p>
      </section>

      {/* Why this tool matters */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
        <h2 className="text-lg font-bold mb-3" style={{ color: "#003865" }}>Why This Tool Matters</h2>
        <p className="text-slate-600 leading-relaxed mb-4">
          In many cases, knowledge about module suitability is implicit and unevenly distributed across
          programme teams.
        </p>
        <p className="text-slate-600 leading-relaxed mb-4">This tool helps to make that knowledge more visible and consistent by:</p>
        <ul className="space-y-2">
          {[
            "Translating module descriptors into structured insights",
            "Supporting more transparent curriculum design decisions",
            "Improving the clarity and usability of elective provision",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-slate-600 text-sm">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: "#003865" }} />
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* Summary */}
      <section className="rounded-xl p-8" style={{ backgroundColor: "#003865" }}>
        <h2 className="text-lg font-bold mb-5 text-white">Summary</h2>
        <p className="text-white/80 text-sm mb-5">This tool supports:</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white/10 rounded-lg p-5">
            <p className="font-semibold text-white text-sm">Curriculum Alignment</p>
            <p className="text-white/70 text-sm mt-1">through SAR analysis</p>
          </div>
          <div className="rounded-lg p-5" style={{ backgroundColor: "#F5A800" }}>
            <p className="font-semibold text-sm" style={{ color: "#003865" }}>Curriculum Navigation</p>
            <p className="text-sm mt-1" style={{ color: "#003865", opacity: 0.75 }}>through free elective analysis</p>
          </div>
        </div>
        <p className="text-white/60 text-sm mt-6 italic">
          It is designed to enhance, not replace, academic decision-making.
        </p>
      </section>

      {/* Batch analysis */}
      <section className="border border-dashed border-slate-200 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Batch Processing
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Run AI classification, scoring, and free elective analysis for any uploaded modules that
              have not yet been processed. Already-analysed modules are skipped.
            </p>
          </div>
          <button
            onClick={runBatchAnalysis}
            disabled={isRunning}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-500 text-sm font-medium hover:text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isRunning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isDone ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            ) : (
              <PlayCircle className="w-4 h-4" />
            )}
            {isRunning ? "Running…" : isDone ? "Done" : "Run Analysis"}
          </button>
        </div>

        {log.length > 0 && (
          <div className="mt-4 border border-slate-100 rounded-lg bg-slate-50 p-3 max-h-52 overflow-y-auto space-y-0.5">
            {log.map((entry, i) => (
              <p
                key={i}
                className={`text-xs font-mono leading-relaxed ${
                  entry.startsWith("Batch analysis complete") || entry.startsWith("All modules already")
                    ? "text-emerald-600 font-semibold"
                    : entry.includes("failed") || entry.includes("error") || entry.includes("Error")
                    ? "text-red-500"
                    : "text-slate-500"
                }`}
              >
                {entry}
              </p>
            ))}
          </div>
        )}
      </section>

      {/* GA Batch Classification */}
      <GaBatchSection />

      {/* SAR Score Calibration */}
      <section className="border border-dashed border-slate-200 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            SAR Score Calibration
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Apply a consistent uplift to raw SAR average scores across the tool. This affects the displayed
            score only — stored data is unchanged. Use this to adjust how strictly or generously modules
            are assessed during review.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {CALIBRATION_OPTIONS.map(({ value, label, uplift, desc }) => (
            <button
              key={value}
              onClick={() => setMode(value as CalibrationMode)}
              className={`text-left rounded-xl border p-4 transition-all ${
                mode === value
                  ? "border-[#003865] bg-[#003865]/5 ring-1 ring-[#003865]"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-sm font-semibold ${mode === value ? "text-[#003865]" : "text-slate-700"}`}>
                  {label}
                </span>
                <span
                  className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                    mode === value ? "text-white" : "bg-slate-100 text-slate-500"
                  }`}
                  style={mode === value ? { backgroundColor: "#003865" } : {}}
                >
                  {uplift === 0 ? "+0.0" : `+${uplift.toFixed(1)}`}
                </span>
              </div>
              <p className="text-xs text-slate-400">{desc}</p>
            </button>
          ))}
        </div>
        {mode !== "conservative" && (
          <p className="text-xs text-slate-400 italic">
            A <strong className="text-slate-500">{CALIBRATION_OPTIONS.find(o => o.value === mode)?.uplift.toFixed(1)}</strong> point
            uplift is currently being added to all SAR average scores across the tool.
          </p>
        )}
      </section>
    </div>
  );
}
