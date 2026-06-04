import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Eye, Scale, Zap, Info, BarChart2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip as RechartTooltip,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
async function apiFetch<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}/api${path}`, { headers: { "Content-Type": "application/json" } });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<T>;
}

const LEVELS = ["None", "Foundation", "Intermediate", "Advanced"] as const;
type Level = typeof LEVELS[number];
const LEVEL_ORDER: Record<string, number> = { None: 0, Foundation: 1, Intermediate: 2, Advanced: 3 };

interface AreaConfig { key: string; label: string; shortLabel: string; icon: LucideIcon; color: string; bg: string; competenceKeys: string[] }
interface CompConfig  { key: string; label: string; shortLabel: string; id: string; color: string; bg: string; area: string }

const EC_AREAS: AreaConfig[] = [
  { key: "ideas",     label: "Ideas & Opportunities", shortLabel: "Ideas",     icon: Eye,       color: "#d97706", bg: "#fffbeb", competenceKeys: ["SpottingOpportunities","Creativity","Vision","ValuingIdeas","EthicalSustainableThinking"] },
  { key: "resources", label: "Resources",              shortLabel: "Resources", icon: Scale,     color: "#7c3aed", bg: "#faf5ff", competenceKeys: ["SelfAwareness","Motivation","MobilisingResources","FinancialLiteracy","MobilisingOthers"] },
  { key: "action",    label: "Into Action",            shortLabel: "Action",    icon: TrendingUp, color: "#059669", bg: "#ecfdf5", competenceKeys: ["TakingInitiative","PlanningManagement","CopingWithUncertainty","WorkingWithOthers","LearningThroughExperience"] },
];

const EC_COMPETENCES: CompConfig[] = [
  { key: "SpottingOpportunities",     id: "1.1", label: "Spotting Opportunities",        shortLabel: "Spotting",    color: "#d97706", bg: "#fffbeb", area: "ideas" },
  { key: "Creativity",                id: "1.2", label: "Creativity",                    shortLabel: "Creativity",  color: "#d97706", bg: "#fffbeb", area: "ideas" },
  { key: "Vision",                    id: "1.3", label: "Vision",                        shortLabel: "Vision",      color: "#d97706", bg: "#fffbeb", area: "ideas" },
  { key: "ValuingIdeas",              id: "1.4", label: "Valuing Ideas",                 shortLabel: "Valuing",     color: "#d97706", bg: "#fffbeb", area: "ideas" },
  { key: "EthicalSustainableThinking",id: "1.5", label: "Ethical & Sustainable Thinking",shortLabel: "Ethical",    color: "#d97706", bg: "#fffbeb", area: "ideas" },
  { key: "SelfAwareness",             id: "2.1", label: "Self-Awareness",                shortLabel: "Self-Aware",  color: "#7c3aed", bg: "#faf5ff", area: "resources" },
  { key: "Motivation",                id: "2.2", label: "Motivation & Perseverance",     shortLabel: "Motivation",  color: "#7c3aed", bg: "#faf5ff", area: "resources" },
  { key: "MobilisingResources",       id: "2.3", label: "Mobilising Resources",          shortLabel: "Resources",   color: "#7c3aed", bg: "#faf5ff", area: "resources" },
  { key: "FinancialLiteracy",         id: "2.4", label: "Financial & Economic Literacy", shortLabel: "Financial",   color: "#7c3aed", bg: "#faf5ff", area: "resources" },
  { key: "MobilisingOthers",          id: "2.5", label: "Mobilising Others",             shortLabel: "Mobilising",  color: "#7c3aed", bg: "#faf5ff", area: "resources" },
  { key: "TakingInitiative",          id: "3.1", label: "Taking the Initiative",         shortLabel: "Initiative",  color: "#059669", bg: "#ecfdf5", area: "action" },
  { key: "PlanningManagement",        id: "3.2", label: "Planning & Management",         shortLabel: "Planning",    color: "#059669", bg: "#ecfdf5", area: "action" },
  { key: "CopingWithUncertainty",     id: "3.3", label: "Coping with Uncertainty",       shortLabel: "Uncertainty", color: "#059669", bg: "#ecfdf5", area: "action" },
  { key: "WorkingWithOthers",         id: "3.4", label: "Working with Others",           shortLabel: "Teamwork",    color: "#059669", bg: "#ecfdf5", area: "action" },
  { key: "LearningThroughExperience", id: "3.5", label: "Learning Through Experience",   shortLabel: "Learning",    color: "#059669", bg: "#ecfdf5", area: "action" },
];

interface Programme { id: number; name: string; code: string | null }
interface PmRow     { id: number; moduleId: number; stage: string | null; orderIndex: number; module: { moduleCode: string; moduleTitle: string } }
interface GaRow     { moduleId: number; domain: string; level: string }
interface ProgData  { id: number; name: string; code: string | null; modules: PmRow[]; classifications: GaRow[] }

const STAGES = ["Year 1","Year 2","Year 3","Year 4","Year 5","Other"];

function levelBadge(level: string, color: string, bg: string) {
  if (level === "None")          return { bg: "#f8fafc", text: "#64748b", border: "#e2e8f0" };
  if (level === "Foundation")    return { bg,            text: color,     border: `${color}55` };
  if (level === "Intermediate")  return { bg: `${color}22`, text: color,  border: `${color}99` };
  return { bg: color, text: "#fff", border: color };
}

export default function EntreCompDashboard() {
  const [selectedProg, setSelectedProg] = useState<string>("__all__");

  const { data: programmes = [] } = useQuery<Programme[]>({
    queryKey: ["pm-programmes"],
    queryFn: () => apiFetch("/programme-mapping/programmes"),
  });

  const selectedProgId = selectedProg !== "__all__" ? parseInt(selectedProg) : null;

  const { data: progData } = useQuery<ProgData>({
    queryKey: ["pm-programme", selectedProgId, "entrecomp"],
    queryFn: () => apiFetch(`/programme-mapping/programmes/${selectedProgId}?lens=entrecomp`),
    enabled: selectedProgId !== null,
  });

  const { data: catalogueModules = [] } = useQuery<Array<{
    id: number; moduleCode: string; moduleTitle: string; stageInferred: string | null;
    gaClassifications: Array<{ domain: string; level: string }>;
    programmeCount: number;
  }>>({
    queryKey: ["module-catalogue", "entrecomp"],
    queryFn: () => apiFetch("/module-catalogue?lens=entrecomp"),
    enabled: selectedProgId === null,
  });

  const clsMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (selectedProgId && progData) {
      for (const c of progData.classifications ?? []) map[`${c.moduleId}-${c.domain}`] = c.level;
    } else {
      for (const m of catalogueModules) {
        for (const ec of m.gaClassifications) map[`${m.id}-${ec.domain}`] = ec.level;
      }
    }
    return map;
  }, [selectedProgId, progData, catalogueModules]);

  const getLevel = (moduleId: number, domain: string): Level =>
    (clsMap[`${moduleId}-${domain}`] ?? "None") as Level;

  const allModuleIds = useMemo(() => {
    if (selectedProgId && progData) return (progData.modules ?? []).map(pm => pm.moduleId);
    return catalogueModules.map(m => m.id);
  }, [selectedProgId, progData, catalogueModules]);

  const total = allModuleIds.length;

  const radarData = useMemo(() => {
    return EC_AREAS.map(area => {
      const active = total > 0
        ? allModuleIds.filter(id => area.competenceKeys.some(k => getLevel(id, k) !== "None")).length
        : 0;
      const pct = total > 0 ? Math.round((active / total) * 100) : 0;
      return { area: area.shortLabel, value: pct, fullMark: 100 };
    });
  }, [allModuleIds, clsMap, total]);

  const compStats = useMemo(() => {
    return EC_COMPETENCES.map(comp => {
      const counts: Record<string, number> = { None: 0, Foundation: 0, Intermediate: 0, Advanced: 0 };
      for (const id of allModuleIds) {
        const l = getLevel(id, comp.key);
        counts[l] = (counts[l] ?? 0) + 1;
      }
      const active = total - counts.None;
      return { comp, counts, active };
    });
  }, [allModuleIds, clsMap, total]);

  const stageMap = useMemo(() => {
    if (!selectedProgId || !progData) return null;
    const mods = [...(progData.modules ?? [])].sort((a, b) => a.orderIndex - b.orderIndex);
    const presentStages = STAGES.filter(s => mods.some(m => m.stage === s));
    const unstaged = mods.filter(m => !m.stage);
    if (unstaged.length) presentStages.push("Unassigned");
    return { mods, presentStages, unstaged };
  }, [progData, selectedProgId]);

  const narrative = useMemo(() => {
    if (!total) return "No modules have been analysed yet.";
    const lines: string[] = [];

    for (const area of EC_AREAS) {
      const areaActive = allModuleIds.filter(id => area.competenceKeys.some(k => getLevel(id, k) !== "None")).length;
      const pct = Math.round((areaActive / total) * 100);
      const maxComp = area.competenceKeys.reduce((best, k) => {
        const active = allModuleIds.filter(id => getLevel(id, k) !== "None").length;
        return active > best.count ? { key: k, count: active } : best;
      }, { key: "", count: -1 });
      const compLabel = EC_COMPETENCES.find(c => c.key === maxComp.key)?.label ?? "";
      let line = `**${area.shortLabel} — ${area.label}**: ${areaActive} of ${total} modules (${pct}%) show evidence in at least one competence in this area.`;
      if (maxComp.count > 0) line += ` Strongest: ${compLabel} (${maxComp.count} modules).`;
      if (areaActive === 0) line += ` No modules are currently classified against this area.`;
      lines.push(line);
    }

    const noEC = allModuleIds.filter(id => EC_COMPETENCES.every(c => getLevel(id, c.key) === "None")).length;
    if (noEC > 0) {
      const pct = Math.round((noEC / total) * 100);
      lines.push(`**Gap**: ${noEC} module${noEC > 1 ? "s" : ""} (${pct}%) show no EntreComp evidence across any competence. These may not yet have been analysed.`);
    }

    return lines.join("\n\n");
  }, [allModuleIds, clsMap, total, stageMap, selectedProgId]);

  const hasAnyClassifications = total > 0 && radarData.some(d => d.value > 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg" style={{ backgroundColor: "#d97706" }}>
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#003865" }}>EntreComp Dashboard</h1>
            <p className="text-slate-500 mt-0.5">EU Entrepreneurship Competence Framework — programme analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-slate-500 font-medium">View:</span>
          <Select value={selectedProg} onValueChange={setSelectedProg}>
            <SelectTrigger className="w-[220px] bg-white border-slate-200">
              <SelectValue placeholder="All modules" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All modules (Catalogue)</SelectItem>
              {programmes.map(p => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}{p.code ? ` (${p.code})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Info banner when no classifications */}
      {total > 0 && !hasAnyClassifications && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3 text-sm text-amber-800">
          <Info className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <p>No EntreComp classifications yet. Go to <strong>Module Catalogue → EntreComp tab</strong> to run AI batch analysis or manually classify modules.</p>
        </div>
      )}

      {/* Area stat cards */}
      {total > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {EC_AREAS.map(area => {
            const active = allModuleIds.filter(id => area.competenceKeys.some(k => getLevel(id, k) !== "None")).length;
            const pct = total > 0 ? Math.round((active / total) * 100) : 0;
            const AreaIcon = area.icon;
            return (
              <Card key={area.key} className="shadow-sm border-slate-200">
                <CardHeader className="pb-1 pt-3 px-3">
                  <CardTitle className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <AreaIcon className="h-3 w-3" style={{ color: area.color }} />
                    {area.shortLabel}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="flex items-end gap-1.5">
                    <span className="text-2xl font-bold" style={{ color: area.color }}>{active}</span>
                    <span className="text-[10px] text-slate-400 pb-0.5">/{total} ({pct}%)</span>
                  </div>
                  <div className="mt-1.5 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: area.color }} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Radar + Area coverage */}
      {total > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Radar */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold mb-1" style={{ color: "#003865" }}>EntreComp Area Profile</h2>
            <p className="text-xs text-slate-400 mb-3">% of modules showing evidence in each area (at any level)</p>
            <div className="relative">
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart
                  data={radarData.map(d => ({ ...d, display: d.value, value: d.value < 2 ? 2 : d.value }))}
                  margin={{ top: 10, right: 30, bottom: 10, left: 30 }}
                >
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="area" tick={{ fontSize: 11, fill: "#475569", fontWeight: 600 }} />
                  <PolarRadiusAxis domain={[0, 50]} tick={{ fontSize: 10, fill: "#94a3b8" }} tickCount={5} tickFormatter={(v: number) => `${v}%`} />
                  <Radar
                    name="Coverage"
                    dataKey="value"
                    stroke="#d97706"
                    fill="#d97706"
                    fillOpacity={hasAnyClassifications ? 0.2 : 0}
                    strokeWidth={2}
                    dot={{ r: 4, fill: "#d97706", strokeWidth: 0 }}
                  />
                  <RechartTooltip
                    formatter={(_value: number, _name: string, entry: { payload?: { display?: number } }) =>
                      [`${entry?.payload?.display ?? 0}%`, "Coverage"]
                    }
                    contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }}
                  />
                </RadarChart>
              </ResponsiveContainer>
              {!hasAnyClassifications && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <TrendingUp className="w-7 h-7 text-slate-200 mb-2" />
                  <p className="text-xs text-slate-400 font-medium">No classifications yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Area coverage bars */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold mb-4" style={{ color: "#003865" }}>Competence Coverage by Area</h2>
            <div className="space-y-4">
              {EC_AREAS.map(area => {
                const areaComps = EC_COMPETENCES.filter(c => c.area === area.key);
                const AreaIcon = area.icon;
                return (
                  <div key={area.key}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <AreaIcon className="h-3.5 w-3.5 shrink-0" style={{ color: area.color }} />
                      <span className="text-xs font-semibold" style={{ color: area.color }}>{area.label}</span>
                    </div>
                    <div className="space-y-1 pl-5">
                      {areaComps.map(comp => {
                        const active = allModuleIds.filter(id => getLevel(id, comp.key) !== "None").length;
                        const pct = total > 0 ? (active / total) * 100 : 0;
                        return (
                          <div key={comp.key} className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 w-5 shrink-0 font-mono">{comp.id}</span>
                            <span className="text-[10px] text-slate-500 w-20 shrink-0 truncate">{comp.shortLabel}</span>
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: area.color, opacity: 0.7 }} />
                            </div>
                            <span className="text-[10px] font-medium w-12 text-right" style={{ color: active > 0 ? area.color : "#94a3b8" }}>
                              {active}/{total}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Programme Map */}
      {selectedProgId && stageMap && stageMap.presentStages.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold" style={{ color: "#003865" }}>Programme Map — EntreComp</h2>
            <p className="text-xs text-slate-500 mt-0.5">Modules by year/stage. Dots show area-level max engagement (I=Ideas, R=Resources, A=Into Action).</p>
          </div>
          <div className="p-5 space-y-5">
            {stageMap.presentStages.map(stage => {
              const stageMods = stage === "Unassigned" ? stageMap.unstaged : stageMap.mods.filter(m => m.stage === stage);
              return (
                <div key={stage}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded" style={{ backgroundColor: "#003865", color: "#fff" }}>{stage}</span>
                    <span className="text-xs text-slate-400">{stageMods.length} module{stageMods.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {stageMods.map(pm => {
                      const areaDots = EC_AREAS.map(area => {
                        const levels = area.competenceKeys.map(k => LEVEL_ORDER[getLevel(pm.moduleId, k)] ?? 0);
                        const maxIdx = Math.max(...levels);
                        return { ...area, level: LEVELS[maxIdx] as Level };
                      });
                      const activeDots = areaDots.filter(d => d.level !== "None");
                      const topLevelOrder = Math.max(...areaDots.map(d => LEVEL_ORDER[d.level] ?? 0), 0);
                      const topLevel = LEVELS[topLevelOrder] as Level;
                      const borderColor = activeDots.length === 0 ? "#e2e8f0" : activeDots.length === 1 ? activeDots[0].color : "#d97706";
                      const borderStyle = topLevel === "Advanced" ? `3px solid ${borderColor}`
                        : topLevel === "Intermediate" ? `2px solid ${borderColor}`
                        : topLevel === "Foundation" ? `2px dashed ${borderColor}`
                        : `1px solid ${borderColor}`;
                      const areaLabels: Record<string, string> = { ideas: "I", resources: "R", action: "A" };
                      return (
                        <div
                          key={pm.id}
                          className="rounded-lg p-2.5 bg-white flex flex-col gap-2"
                          style={{ border: borderStyle, width: "120px", minHeight: "80px" }}
                        >
                          <div>
                            <p className="text-[10px] font-mono font-bold text-slate-700 leading-tight">{pm.module?.moduleCode}</p>
                            <p className="text-[10px] text-slate-500 leading-tight mt-0.5 line-clamp-2">{pm.module?.moduleTitle}</p>
                          </div>
                          <div className="flex gap-1 flex-wrap mt-auto">
                            {areaDots.map(d => d.level === "None" ? null : (
                              <span key={d.key} title={`${d.label}: ${d.level}`} className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ backgroundColor: d.color, color: "#fff" }}>
                                {areaLabels[d.key]}{d.level[0]}
                              </span>
                            ))}
                            {activeDots.length === 0 && <span className="text-[9px] text-slate-300 italic">none</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 15-competence breakdown */}
      {total > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold" style={{ color: "#003865" }}>EntreComp — All 15 Competences</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 min-w-[200px]">Competence</th>
                  {LEVELS.map(l => {
                    const { bg, text, border } = levelBadge(l, "#d97706", "#fffbeb");
                    return (
                      <th key={l} className="text-center px-3 py-2.5 text-xs font-semibold">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded border text-[11px]" style={{ backgroundColor: bg, color: text, borderColor: border }}>
                          {l}
                        </span>
                      </th>
                    );
                  })}
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500">Active</th>
                </tr>
              </thead>
              <tbody>
                {EC_AREAS.map(area => (
                  <>
                    <tr key={`area-${area.key}`} style={{ backgroundColor: `${area.color}08` }}>
                      <td colSpan={LEVELS.length + 2} className="px-5 py-1.5">
                        <div className="flex items-center gap-2">
                          {(() => { const AreaIcon = area.icon; return <AreaIcon className="h-3.5 w-3.5" style={{ color: area.color }} />; })()}
                          <span className="text-xs font-bold" style={{ color: area.color }}>{area.label}</span>
                        </div>
                      </td>
                    </tr>
                    {compStats.filter(s => s.comp.area === area.key).map(({ comp, counts, active }) => (
                      <tr key={comp.key} className="border-b border-slate-50 hover:bg-slate-50/40">
                        <td className="px-5 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 font-mono w-5 shrink-0">{comp.id}</span>
                            <span className="text-xs font-medium text-slate-700">{comp.label}</span>
                          </div>
                        </td>
                        {LEVELS.map(l => {
                          const { bg, text, border } = levelBadge(l, comp.color, comp.bg);
                          const count = counts[l] ?? 0;
                          return (
                            <td key={l} className="text-center px-3 py-2.5">
                              <span
                                className="inline-flex items-center justify-center w-9 h-6 rounded text-xs font-bold border"
                                style={{ backgroundColor: count > 0 ? bg : "#f8fafc", color: count > 0 ? text : "#d1d5db", borderColor: count > 0 ? border : "#e5e7eb" }}
                              >
                                {count}
                              </span>
                            </td>
                          );
                        })}
                        <td className="text-center px-3 py-2.5">
                          <span className="text-xs font-semibold" style={{ color: active > 0 ? comp.color : "#94a3b8" }}>
                            {active}/{total}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Narrative */}
      {total > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold mb-3" style={{ color: "#003865" }}>EntreComp Analysis</h2>
          <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
            {narrative.split("\n\n").map((para, i) => (
              <p key={i} dangerouslySetInnerHTML={{
                __html: para.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
              }} />
            ))}
          </div>
        </div>
      )}

      {total === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <TrendingUp className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-500 text-sm">No modules found. Import modules to begin EntreComp analysis.</p>
        </div>
      )}
    </div>
  );
}
