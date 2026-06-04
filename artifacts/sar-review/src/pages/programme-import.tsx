import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  FileSpreadsheet, Upload, CheckCircle2, AlertCircle, Loader2,
  ArrowRight, X, LayoutGrid, ChevronRight, BookOpen,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}/api${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!r.ok) {
    const msg = await r.text().catch(() => r.statusText);
    throw new Error(msg);
  }
  return r.json() as Promise<T>;
}

async function apiMultipartFetch<T>(path: string, formData: FormData): Promise<T> {
  const r = await fetch(`${BASE}/api${path}`, { method: "POST", body: formData });
  if (!r.ok) throw new Error(await r.text().catch(() => r.statusText));
  return r.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface ParsedRow {
  moduleCode: string;
  stage: string | null;
  semester: string | null;
  coreOption: string | null;
  matched: boolean;
  moduleId: number | null;
  moduleTitle: string | null;
}

interface ParseResult {
  programmeCode: string | null;
  programmeName: string | null;
  rows: ParsedRow[];
}

interface ModulePoolItem {
  id: number;
  moduleCode: string;
  moduleTitle: string;
}

type Step = "upload" | "parsing" | "reviewing" | "importing" | "done";

// ── Core/Elective badge ───────────────────────────────────────────────────────
function CoreOptionBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-slate-300 text-xs">—</span>;
  const v = value.toLowerCase();
  const isCore = v.includes("core");
  const isFreeElective = v.includes("free");
  const isElective = !isFreeElective && v.includes("elective");
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide"
      style={{
        backgroundColor: isCore ? "#e0f2fe" : isFreeElective ? "#f0fdf4" : isElective ? "#fef3c7" : "#f1f5f9",
        color: isCore ? "#0369a1" : isFreeElective ? "#166534" : isElective ? "#92400e" : "#64748b",
      }}
    >
      {value}
    </span>
  );
}

// ── File Drop Zone ────────────────────────────────────────────────────────────
function DropZone({
  onFile,
  loading,
}: {
  onFile: (file: File) => void;
  loading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handle = (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      alert("Please upload an Excel (.xlsx, .xls) or CSV file.");
      return;
    }
    onFile(file);
  };

  return (
    <div
      onClick={() => !loading && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handle(f); }}
      className={cn(
        "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all select-none",
        dragging ? "border-[#003865] bg-blue-50/60" : "border-slate-200 hover:border-slate-400 hover:bg-slate-50",
        loading && "pointer-events-none opacity-60",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handle(f); }}
      />
      {loading ? (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-slate-400" />
          <p className="text-sm text-slate-500">Parsing your file…</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: "#003865" }}
          >
            <FileSpreadsheet className="h-7 w-7 text-white" />
          </div>
          <div>
            <p className="font-semibold text-slate-700">Drop your programme structure file here</p>
            <p className="text-sm text-slate-400 mt-1">or click to browse — Excel (.xlsx, .xls) or CSV</p>
          </div>
          <div className="mt-2 p-3 bg-slate-50 border border-slate-100 rounded-lg text-left text-xs text-slate-500 max-w-sm">
            <p className="font-semibold text-slate-600 mb-1">Expected columns (any order, case-insensitive):</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>Programme Code <span className="text-slate-400">(optional)</span></li>
              <li>Programme Title / Name <span className="text-slate-400">(optional)</span></li>
              <li><strong>Module Code</strong> <span className="text-slate-400">(required)</span></li>
              <li>Stage / Year <span className="text-slate-400">(optional)</span></li>
              <li>Semester <span className="text-slate-400">(optional)</span></li>
              <li>Core / Elective / Status <span className="text-slate-400">(optional)</span></li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProgrammeImport() {
  const [, setLocation] = useLocation();
  const { isAdmin } = useAuth();
  const [step, setStep] = useState<Step>("upload");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [progName, setProgName]   = useState("");
  const [progCode, setProgCode]   = useState("");
  const [overrides, setOverrides] = useState<Record<number, number | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [importedId, setImportedId] = useState<number | null>(null);

  const { data: modulePool = [] } = useQuery<ModulePoolItem[]>({
    queryKey: ["module-pool"],
    queryFn: () => apiFetch("/programme-mapping/module-pool"),
    staleTime: 60_000,
  });

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const r = (e.target?.result as string).split(",")[1];
        if (r) resolve(r); else reject(new Error("Read failed"));
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFile = async (file: File) => {
    if (!isAdmin) {
      setError("Admin access required. Sign in as admin to import programmes.");
      return;
    }
    setStep("parsing");
    setError(null);
    try {
      const base64Data = await readFileAsBase64(file);
      const parsed = await apiFetch<ParseResult>("/programme-mapping/parse-structure", {
        method: "POST",
        body: JSON.stringify({ fileName: file.name, base64Data }),
      });
      setResult(parsed);
      setProgName(parsed.programmeName ?? "");
      setProgCode(parsed.programmeCode ?? "");
      setStep("reviewing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
      setStep("upload");
    }
  };

  const handleImport = async () => {
    if (!isAdmin) {
      setError("Admin access required. Sign in as admin to import programmes.");
      return;
    }
    if (!result) return;
    setStep("importing");
    setError(null);
    try {
      const rows = result.rows
        .map((r, idx) => {
          const moduleId = r.matched ? r.moduleId : (overrides[idx] ?? null);
          if (!moduleId) return null;
          return { moduleId, stage: r.stage, semester: r.semester, coreOption: r.coreOption, orderIndex: idx };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      if (!rows.length) {
        setError("No matched modules to import. Please link at least one module.");
        setStep("reviewing");
        return;
      }

      const { programmeId } = await apiFetch<{ programmeId: number }>("/programme-mapping/import-structure", {
        method: "POST",
        body: JSON.stringify({
          programmeName: progName.trim() || "Imported Programme",
          programmeCode: progCode.trim() || undefined,
          rows,
        }),
      });
      setImportedId(programmeId);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setStep("reviewing");
    }
  };

  const matchedCount   = result?.rows.filter(r => r.matched || overrides[result.rows.indexOf(r)]).length ?? 0;
  const unmatchedCount = result?.rows.filter((r, i) => !r.matched && !overrides[i]).length ?? 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <button onClick={() => setLocation("/programme")} className="flex items-center gap-1 hover:text-[#003865] transition-colors font-medium">
          <LayoutGrid className="h-3.5 w-3.5" /> Programme Mapping
        </button>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-semibold" style={{ color: "#003865" }}>Import Programme Structure</span>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#003865" }}>
              <Upload className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl" style={{ color: "#003865" }}>Import Programme Structure</CardTitle>
              <CardDescription className="mt-1">
                Upload a spreadsheet with your programme structure. CAST will match module codes to descriptors
                already in the system and pre-populate the programme builder with year, semester, and core/option data.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* ── Step: Upload ─────────────────────────────────────── */}
          {(step === "upload" || step === "parsing") && (
            <DropZone onFile={handleFile} loading={step === "parsing"} />
          )}

          {/* ── Step: Reviewing ──────────────────────────────────── */}
          {step === "reviewing" && result && (
            <div className="space-y-5">
              {/* Programme details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Programme Title</label>
                  <Input
                    value={progName}
                    onChange={e => setProgName(e.target.value)}
                    placeholder="e.g. BA Arts — Year 1"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Programme Code <span className="font-normal text-slate-400">(optional)</span></label>
                  <Input
                    value={progCode}
                    onChange={e => setProgCode(e.target.value)}
                    placeholder="e.g. BA_ARTS"
                    className="text-sm"
                  />
                </div>
              </div>

              {/* Summary chips */}
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {result.rows.filter(r => r.matched).length} matched
                </span>
                {unmatchedCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {unmatchedCount} unmatched — link manually below or skip
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200">
                  <BookOpen className="h-3.5 w-3.5" />
                  {result.rows.length} rows total
                </span>
              </div>

              {/* Module table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold">
                      <th className="text-left px-4 py-2.5 w-7">  </th>
                      <th className="text-left px-3 py-2.5">Module Code <span className="font-normal">(from file)</span></th>
                      <th className="text-left px-3 py-2.5">Matched Module in CAST</th>
                      <th className="text-center px-3 py-2.5">Stage</th>
                      <th className="text-center px-3 py-2.5">Semester</th>
                      <th className="text-center px-3 py-2.5">Core / Elective</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, i) => {
                      const manualId = overrides[i] ?? null;
                      const isResolved = row.matched || manualId !== null;
                      const resolvedModule = row.matched
                        ? { id: row.moduleId!, code: row.moduleCode, title: row.moduleTitle! }
                        : manualId
                        ? (() => { const m = modulePool.find(mp => mp.id === manualId); return m ? { id: m.id, code: m.moduleCode, title: m.moduleTitle } : null; })()
                        : null;

                      return (
                        <tr
                          key={i}
                          className={cn(
                            "border-b border-slate-50 last:border-0",
                            isResolved ? "bg-white" : "bg-amber-50/40",
                          )}
                        >
                          <td className="px-4 py-2.5">
                            {isResolved ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="font-mono font-semibold text-slate-700">{row.moduleCode}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            {row.matched ? (
                              <div>
                                <span className="font-mono text-[10px] text-slate-400">{row.moduleCode}</span>
                                <p className="text-slate-600 leading-tight">{row.moduleTitle}</p>
                              </div>
                            ) : (
                              <select
                                className="w-full text-xs border border-slate-200 rounded px-2 py-1 bg-white text-slate-600"
                                value={manualId ?? ""}
                                onChange={e => {
                                  const v = e.target.value;
                                  setOverrides(prev => ({ ...prev, [i]: v ? Number(v) : null }));
                                }}
                              >
                                <option value="">— skip this row —</option>
                                {modulePool.map(m => (
                                  <option key={m.id} value={m.id}>
                                    {m.moduleCode} — {m.moduleTitle}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center text-slate-500">{row.stage ?? "—"}</td>
                          <td className="px-3 py-2.5 text-center text-slate-500">{row.semester ?? "—"}</td>
                          <td className="px-3 py-2.5 text-center">
                            <CoreOptionBadge value={row.coreOption} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => { setStep("upload"); setResult(null); setOverrides({}); setError(null); }}
                  className="text-sm text-slate-400 hover:text-slate-600 underline"
                >
                  Upload a different file
                </button>
                <Button
                  onClick={handleImport}
                  disabled={result.rows.filter(r => r.matched || overrides[result.rows.indexOf(r)]).length === 0}
                  className="flex items-center gap-2"
                  style={{ backgroundColor: "#003865" }}
                >
                  <ArrowRight className="h-4 w-4" />
                  Import {result.rows.filter((r, i) => r.matched || overrides[i] != null).length} modules into programme
                </Button>
              </div>
            </div>
          )}

          {/* ── Step: Importing ──────────────────────────────────── */}
          {step === "importing" && (
            <div className="py-16 flex flex-col items-center gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-slate-400" />
              <p className="text-slate-500 text-sm">Creating programme and linking modules…</p>
            </div>
          )}

          {/* ── Step: Done ───────────────────────────────────────── */}
          {step === "done" && importedId && (
            <div className="py-12 flex flex-col items-center gap-5 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "#003865" }}>
                <CheckCircle2 className="h-8 w-8 text-white" />
              </div>
              <div>
                <p className="text-lg font-semibold" style={{ color: "#003865" }}>Programme imported successfully</p>
                <p className="text-sm text-slate-500 mt-1">
                  {result?.rows.filter((r, i) => r.matched || overrides[i] != null).length} modules added to <strong>{progName}</strong>.
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => setLocation("/programme")}
                  variant="outline"
                  className="text-sm"
                >
                  Back to Programme Mapping
                </Button>
                <Button
                  onClick={() => setLocation("/programme")}
                  className="flex items-center gap-2 text-sm"
                  style={{ backgroundColor: "#003865" }}
                >
                  Open in Map view <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fallback notice */}
      {(step === "upload" || step === "parsing") && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100 text-sm text-slate-500">
          <LayoutGrid className="h-4 w-4 shrink-0 mt-0.5 text-slate-400" />
          <div>
            <span className="font-medium text-slate-600">Don't have a structure file? </span>
            You can still{" "}
            <button onClick={() => setLocation("/programme")} className="underline hover:text-slate-800">
              build a programme manually
            </button>{" "}
            in Programme Mapping — import is an optional shortcut, not a requirement.
          </div>
        </div>
      )}
    </div>
  );
}
