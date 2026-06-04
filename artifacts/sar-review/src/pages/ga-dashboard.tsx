import { useState, useMemo } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Users, Leaf, Handshake, BookOpen, Info, Sparkles, Layers } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// ── API ───────────────────────────────────────────────────────────────────────
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
async function apiFetch<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}/api${path}`, { headers: { "Content-Type": "application/json" } });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<T>;
}

// ── Config ────────────────────────────────────────────────────────────────────
const DOMAINS = [
  { key: "People",      label: "People",      icon: Users,     color: "#c2185b", bg: "#fce4ec", desc: "Digital capability, reflective practice, lifelong learning" },
  { key: "Planet",      label: "Planet",      icon: Leaf,      color: "#388e3c", bg: "#e8f5e9", desc: "Sustainability, ethics, SDGs, futures thinking" },
  { key: "Partnership", label: "Partnership", icon: Handshake, color: "#1565c0", bg: "#e3f2fd", desc: "Collaboration, co-creation, real-world engagement" },
] as const;

const LEVELS = ["None", "Developing", "Consolidating", "Leading"] as const;
type Level = typeof LEVELS[number];

// ── Types ─────────────────────────────────────────────────────────────────────
interface Programme {
  id: number;
  name: string;
  code: string | null;
  moduleCount?: number;
}
interface PoolModule {
  id: number;
  moduleCode: string;
  moduleTitle: string;
  stageInferred: string | null;
}
interface PmRow {
  id: number;
  moduleId: number;
  stage: string | null;
  orderIndex: number;
  module: PoolModule;
}
interface GaEvidenceItem {
  field: string;
  snippet: string;
  weight: "primary" | "secondary";
}
function parseEvidence(raw?: string): GaEvidenceItem[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as GaEvidenceItem[]; } catch { return []; }
}
interface GaRow {
  moduleId: number;
  domain: string;
  level: string;
  source?: string;
  rationale?: string;
  evidence?: string;
}
interface FullProgramme extends Programme {
  modules: PmRow[];
  classifications: GaRow[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getClassification(classifications: GaRow[], moduleId: number, domain: string): GaRow {
  return classifications.find(c => c.moduleId === moduleId && c.domain === domain) ?? { moduleId, domain, level: "None" };
}
function getLevel(classifications: GaRow[], moduleId: number, domain: string): Level {
  return (getClassification(classifications, moduleId, domain).level ?? "None") as Level;
}
function levelCounts(classifications: GaRow[], modules: PmRow[], domain: string): Record<Level, number> {
  const counts: Record<Level, number> = { None: 0, Developing: 0, Consolidating: 0, Leading: 0 };
  for (const pm of modules) counts[getLevel(classifications, pm.moduleId, domain)]++;
  return counts;
}

const STAGE_ORDER = ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Other"];
const LEVEL_ORDER_MAP: Record<string, number> = { None: 0, Developing: 1, Consolidating: 2, Leading: 3 };

// Level badge — outline-variant style matching SAR dashboard badges
function LevelBadge({ level, domainColor, domainBg }: { level: Level; domainColor: string; domainBg: string }) {
  if (level === "None") {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium bg-slate-50 text-slate-400 border-slate-200">
        None
      </Badge>
    );
  }
  const bg =
    level === "Developing"    ? domainBg :
    level === "Consolidating" ? `${domainColor}22` :
    domainColor;
  const text  = level === "Leading" ? "#fff" : domainColor;
  const border = level === "Leading" ? domainColor : `${domainColor}66`;

  return (
    <span
      className="inline-flex items-center px-1.5 py-0 rounded border text-[10px] font-semibold whitespace-nowrap h-5"
      style={{ backgroundColor: bg, color: text, borderColor: border }}
    >
      {level}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function GaDashboard() {
  const [selectedId, setSelectedId] = useState<number | "all" | null>(null);

  const { data: programmes = [], isLoading: loadingProgs } = useQuery<Programme[]>({
    queryKey: ["pm-programmes"],
    queryFn: () => apiFetch("/programme-mapping/programmes"),
  });

  const activeId: number | "all" | null = selectedId ?? (
    programmes.length > 1 ? "all" : programmes[0]?.id ?? null
  );

  const { data: singleProg, isLoading: loadingSingle } = useQuery<FullProgramme>({
    queryKey: ["pm-programme", activeId],
    queryFn: () => apiFetch(`/programme-mapping/programmes/${activeId}`),
    enabled: activeId !== null && activeId !== "all",
  });

  const allProgQueries = useQueries({
    queries: activeId === "all"
      ? programmes.map(p => ({
          queryKey: ["pm-programme", p.id],
          queryFn: () => apiFetch<FullProgramme>(`/programme-mapping/programmes/${p.id}`),
        }))
      : [],
  });

  const { modules, classifications } = useMemo(() => {
    if (activeId !== "all") {
      const mods = [...(singleProg?.modules ?? [])].sort((a, b) => {
        const ai = STAGE_ORDER.indexOf(a.stage ?? "");
        const bi = STAGE_ORDER.indexOf(b.stage ?? "");
        if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        return a.orderIndex - b.orderIndex;
      });
      return { modules: mods, classifications: singleProg?.classifications ?? [] };
    }
    const seenModIds = new Set<number>();
    const mergedMods: PmRow[] = [];
    const clsByKey: Record<string, GaRow> = {};
    for (const q of allProgQueries) {
      const p = q.data as FullProgramme | undefined;
      if (!p) continue;
      for (const m of (p.modules ?? [])) {
        if (!seenModIds.has(m.moduleId)) { seenModIds.add(m.moduleId); mergedMods.push(m); }
      }
      for (const c of (p.classifications ?? [])) {
        const key = `${c.moduleId}-${c.domain}`;
        const prev = clsByKey[key];
        if (!prev || (LEVEL_ORDER_MAP[c.level] ?? 0) > (LEVEL_ORDER_MAP[prev.level ?? "None"] ?? 0)) clsByKey[key] = c;
      }
    }
    mergedMods.sort((a, b) => {
      const ai = STAGE_ORDER.indexOf(a.stage ?? "");
      const bi = STAGE_ORDER.indexOf(b.stage ?? "");
      if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      return a.orderIndex - b.orderIndex;
    });
    return { modules: mergedMods, classifications: Object.values(clsByKey) };
  }, [activeId, singleProg, allProgQueries]);

  const allLoaded = activeId === "all" ? allProgQueries.every(q => !q.isLoading) : true;
  const isLoading = loadingProgs || (activeId !== null && activeId !== "all" && loadingSingle) || (activeId === "all" && !allLoaded);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Header — matches SAR dashboard heading style */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#003865" }}>Graduate Attributes Dashboard</h1>
          <p className="text-slate-500 mt-1">Module-level mapping across People, Planet, and Partnership.</p>
        </div>

        {/* Programme selector — shadcn Select matching SAR filter bar selects */}
        {programmes.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-medium text-slate-500 whitespace-nowrap">Programme:</span>
            <Select
              value={String(activeId ?? "")}
              onValueChange={v => setSelectedId(v === "all" ? "all" : Number(v))}
            >
              <SelectTrigger className="w-[200px] bg-white border-slate-200 shadow-sm">
                <SelectValue placeholder="Select programme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All programmes</SelectItem>
                {programmes.map(p => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}{p.code ? ` (${p.code})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeId === "all" && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                <Layers className="h-3 w-3" />
                {programmes.length} prog{programmes.length !== 1 ? "s" : ""} · highest GA
              </span>
            )}
          </div>
        )}
      </div>

      {/* Empty states */}
      {!isLoading && programmes.length === 0 && (
        <div className="border border-slate-200 rounded-lg bg-white shadow-sm p-10 text-center space-y-3">
          <BookOpen className="h-10 w-10 text-slate-300 mx-auto" />
          <p className="text-slate-600 font-semibold">No programmes yet</p>
          <p className="text-slate-400 text-sm">Go to Programme Mapping to build your first programme, then classify modules against Graduate Attributes.</p>
          <a href={`${BASE}/programme`} className="inline-flex items-center gap-1 text-sm font-semibold mt-2" style={{ color: "#003865" }}>
            Open Programme Mapping →
          </a>
        </div>
      )}
      {!isLoading && programmes.length > 0 && modules.length === 0 && (
        <div className="border border-slate-200 rounded-lg bg-white shadow-sm p-10 text-center space-y-2">
          <BookOpen className="h-8 w-8 text-slate-300 mx-auto" />
          <p className="text-slate-600 font-semibold">No modules in this programme</p>
          <p className="text-slate-400 text-sm">Add modules in the Programme Builder, then classify them.</p>
        </div>
      )}
      {isLoading && <div className="py-12 text-center text-slate-400 text-sm">Loading…</div>}

      {!isLoading && modules.length > 0 && (
        <>
          {/* Domain summary — compact Cards matching SAR stat-row style with level breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {DOMAINS.map(d => {
              const DIcon = d.icon;
              const counts = levelCounts(classifications, modules, d.key);
              const active = modules.length - counts.None;
              const pct = modules.length > 0 ? Math.round((active / modules.length) * 100) : 0;

              return (
                <Card key={d.key} className="shadow-sm border-slate-200">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <DIcon className="h-3 w-3" style={{ color: d.color }} />
                      {d.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    <div className="flex items-end gap-2">
                      <span className="text-3xl font-bold" style={{ color: d.color }}>{active}</span>
                      <span className="text-xs text-slate-400 pb-0.5">of {modules.length} active ({pct}%)</span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                      {(["Leading", "Consolidating", "Developing"] as Level[]).map(l => {
                        const w = modules.length > 0 ? (counts[l] / modules.length) * 100 : 0;
                        if (w === 0) return null;
                        return (
                          <div key={l} style={{
                            width: `${w}%`,
                            backgroundColor: l === "Leading" ? d.color : l === "Consolidating" ? d.color + "99" : d.color + "44",
                          }} />
                        );
                      })}
                    </div>
                    {/* Level breakdown grid */}
                    <div className="grid grid-cols-2 gap-1">
                      {LEVELS.map(l => {
                        const isBold = l !== "None";
                        return (
                          <div key={l} className="flex items-center justify-between px-2 py-0.5 rounded text-[11px] border"
                            style={{
                              backgroundColor: l === "None" ? "#f8fafc" : l === "Developing" ? d.bg : l === "Consolidating" ? `${d.color}14` : `${d.color}18`,
                              borderColor:     l === "None" ? "#e2e8f0" : `${d.color}44`,
                              color:           l === "None" ? "#94a3b8" : d.color,
                            }}>
                            <span className={isBold ? "font-medium" : ""}>{l}</span>
                            <span className="font-bold">{counts[l]}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Info note */}
          <div className="flex gap-2 items-start text-xs text-slate-500 bg-slate-50 rounded-lg px-4 py-2.5 border border-slate-100">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-slate-400" />
            <span>None is a valid classification — it means the module does not make a meaningful contribution to that Graduate Attribute. All values can be edited in Programme Mapping → Classify.</span>
          </div>

          {/* Module table count line */}
          <p className="text-sm text-slate-500">
            Showing <span className="font-medium text-slate-700">{modules.length}</span> module{modules.length !== 1 ? "s" : ""}
          </p>

          {/* Module Classifications table — SAR table wrapper + shadcn Table */}
          <div className="border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm">
            {/* Section header */}
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">
                Module Classifications{" "}
                <span className="text-slate-400 font-normal">({modules.length} modules)</span>
              </span>
              <div className="flex gap-3">
                {DOMAINS.map(d => {
                  const DIcon = d.icon;
                  return (
                    <div key={d.key} className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: d.color }}>
                      <DIcon className="h-3 w-3" />{d.label[0]}
                    </div>
                  );
                })}
              </div>
            </div>

            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="font-semibold text-slate-700 w-8 text-center">#</TableHead>
                  <TableHead className="font-semibold text-slate-700">Code</TableHead>
                  <TableHead className="font-semibold text-slate-700">Title</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-center w-20">Stage</TableHead>
                  {DOMAINS.map(d => {
                    const DIcon = d.icon;
                    return (
                      <TableHead key={d.key} className="font-semibold text-center" style={{ color: d.color }}>
                        <div className="flex items-center justify-center gap-1">
                          <DIcon className="h-3.5 w-3.5" />
                          {d.label}
                        </div>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const rows: React.ReactNode[] = [];
                  let lastStage: string | null = null;
                  let globalIdx = 0;
                  modules.forEach(pm => {
                    const stage = pm.stage ?? "Unassigned";
                    if (stage !== lastStage) {
                      lastStage = stage;
                      rows.push(
                        <TableRow key={`stage-${stage}`} className="bg-slate-50 hover:bg-slate-50 border-y border-slate-100">
                          <TableCell colSpan={4 + DOMAINS.length} className="py-1.5 px-4">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{stage}</span>
                          </TableCell>
                        </TableRow>
                      );
                    }
                    globalIdx++;
                    const idx = globalIdx;
                    rows.push(
                      <TableRow key={pm.id} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell className="text-center text-xs text-slate-300">{idx}</TableCell>
                        <TableCell className="font-medium text-slate-900">
                          <span className="font-mono text-xs">{pm.module?.moduleCode}</span>
                        </TableCell>
                        <TableCell className="text-slate-600 max-w-[220px]">
                          <span className="block truncate text-xs">{pm.module?.moduleTitle}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-[10px] text-slate-400">{pm.stage ?? "—"}</span>
                        </TableCell>
                        {DOMAINS.map(d => {
                          const cls = getClassification(classifications, pm.moduleId, d.key);
                          const level = (cls.level ?? "None") as Level;
                          const isAi = cls.source === "ai";
                          const badge = (
                            <div className="inline-flex items-center gap-1">
                              <LevelBadge level={level} domainColor={d.color} domainBg={d.bg} />
                              {isAi && <Sparkles className="h-2.5 w-2.5 text-amber-400" />}
                            </div>
                          );
                          return (
                            <TableCell key={d.key} className="text-center">
                              {isAi && cls.rationale ? (() => {
                                const evidenceItems = parseEvidence(cls.evidence);
                                return (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="cursor-default">{badge}</span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-[300px] bg-white border border-slate-200 shadow-md p-0 overflow-hidden" style={{ minWidth: 220 }}>
                                      <div className="px-3 py-2 border-b border-slate-100" style={{ backgroundColor: `${d.color}10` }}>
                                        <p className="text-xs font-semibold" style={{ color: d.color }}>
                                          AI suggestion · {d.label} · {level}
                                        </p>
                                      </div>
                                      <div className="px-3 py-2">
                                        <p className="text-xs text-slate-600 leading-snug">{cls.rationale}</p>
                                      </div>
                                      {evidenceItems.length > 0 && (
                                        <div className="px-3 pb-2.5 space-y-1.5 border-t border-slate-50 pt-2">
                                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Evidence</p>
                                          {evidenceItems.map((ev, i) => (
                                            <div key={i} className="flex items-start gap-1.5">
                                              <span
                                                className="shrink-0 mt-0.5 inline-flex items-center px-1 rounded text-[9px] font-bold uppercase"
                                                style={{
                                                  backgroundColor: ev.weight === "primary" ? `${d.color}18` : "#f1f5f9",
                                                  color: ev.weight === "primary" ? d.color : "#94a3b8",
                                                }}
                                              >
                                                {ev.weight === "primary" ? "●" : "○"} {ev.field}
                                              </span>
                                              <p className="text-[11px] text-slate-500 leading-tight italic">"{ev.snippet}"</p>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              })() : badge}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  });
                  return rows;
                })()}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
