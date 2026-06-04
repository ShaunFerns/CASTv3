import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Scale, Network, Eye, Zap, BarChart2, Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Leaf } from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip as RechartTooltip,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ── API ───────────────────────────────────────────────────────────────────────
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
async function apiFetch<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}/api${path}`, { headers: { "Content-Type": "application/json" } });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<T>;
}

// ── GreenComp config ──────────────────────────────────────────────────────────
const LEVELS = ["None", "Developing", "Consolidating", "Leading"] as const;
type Level = typeof LEVELS[number];
const LEVEL_ORDER: Record<string, number> = { None: 0, Developing: 1, Consolidating: 2, Leading: 3 };

interface AreaConfig { key: string; label: string; shortLabel: string; icon: LucideIcon; color: string; bg: string; competenceKeys: string[] }
interface CompConfig  { key: string; label: string; shortLabel: string; color: string; bg: string; area: string }

const GC_AREAS: AreaConfig[] = [
  { key: "values",     label: "Embodying Sustainability Values", shortLabel: "Values",     icon: Scale,   color: "#0f766e", bg: "#f0fdfa", competenceKeys: ["ValuingSustainability","SupportingFairness","PromotingNature"] },
  { key: "complexity", label: "Embracing Complexity",            shortLabel: "Complexity", icon: Network, color: "#7c3aed", bg: "#faf5ff", competenceKeys: ["SystemsThinking","CriticalThinking","ProblemFraming"] },
  { key: "futures",    label: "Envisioning Sustainable Futures", shortLabel: "Futures",    icon: Eye,     color: "#1d4ed8", bg: "#eff6ff", competenceKeys: ["FuturesLiteracy","Adaptability","ExploratoryThinking"] },
  { key: "action",     label: "Acting for Sustainability",       shortLabel: "Action",     icon: Zap,     color: "#b45309", bg: "#fffbeb", competenceKeys: ["PoliticalAgency","CollectiveAction","IndividualInitiative"] },
];

const GC_COMPETENCES: CompConfig[] = [
  { key: "ValuingSustainability", label: "Valuing Sustainability", shortLabel: "Valuing",    color: "#0f766e", bg: "#f0fdfa", area: "values" },
  { key: "SupportingFairness",    label: "Supporting Fairness",    shortLabel: "Fairness",   color: "#0f766e", bg: "#f0fdfa", area: "values" },
  { key: "PromotingNature",       label: "Promoting Nature",       shortLabel: "Nature",     color: "#0f766e", bg: "#f0fdfa", area: "values" },
  { key: "SystemsThinking",       label: "Systems Thinking",       shortLabel: "Systems",    color: "#7c3aed", bg: "#faf5ff", area: "complexity" },
  { key: "CriticalThinking",      label: "Critical Thinking",      shortLabel: "Critical",   color: "#7c3aed", bg: "#faf5ff", area: "complexity" },
  { key: "ProblemFraming",        label: "Problem Framing",        shortLabel: "Framing",    color: "#7c3aed", bg: "#faf5ff", area: "complexity" },
  { key: "FuturesLiteracy",       label: "Futures Literacy",       shortLabel: "Futures",    color: "#1d4ed8", bg: "#eff6ff", area: "futures" },
  { key: "Adaptability",          label: "Adaptability",           shortLabel: "Adapt",      color: "#1d4ed8", bg: "#eff6ff", area: "futures" },
  { key: "ExploratoryThinking",   label: "Exploratory Thinking",   shortLabel: "Explore",    color: "#1d4ed8", bg: "#eff6ff", area: "futures" },
  { key: "PoliticalAgency",       label: "Political Agency",       shortLabel: "Agency",     color: "#b45309", bg: "#fffbeb", area: "action" },
  { key: "CollectiveAction",      label: "Collective Action",      shortLabel: "Collective", color: "#b45309", bg: "#fffbeb", area: "action" },
  { key: "IndividualInitiative",  label: "Individual Initiative",  shortLabel: "Initiative", color: "#b45309", bg: "#fffbeb", area: "action" },
];

// ── Types ─────────────────────────────────────────────────────────────────────
interface Programme { id: number; name: string; code: string | null; moduleCount?: number }
interface PmRow     { id: number; moduleId: number; stage: string | null; orderIndex: number; module: { moduleCode: string; moduleTitle: string } }
interface GaRow     { moduleId: number; domain: string; level: string }
interface ProgData  { id: number; name: string; code: string | null; modules: PmRow[]; classifications: GaRow[] }

const STAGES = ["Year 1","Year 2","Year 3","Year 4","Year 5","Other"];

function levelBadge(level: string, color: string, bg: string) {
  if (level === "None")          return { bg: "#f8fafc", text: "#64748b", border: "#e2e8f0" };
  if (level === "Developing")    return { bg,            text: color,     border: `${color}55` };
  if (level === "Consolidating") return { bg: `${color}22`, text: color,  border: `${color}99` };
  return { bg: color, text: "#fff", border: color };
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function GreenCompDashboard() {
  const [selectedProg, setSelectedProg] = useState<string>("__all__");

  const { data: programmes = [] } = useQuery<Programme[]>({
    queryKey: ["pm-programmes"],
    queryFn: () => apiFetch("/programme-mapping/programmes"),
  });

  const selectedProgId = selectedProg !== "__all__" ? parseInt(selectedProg) : null;

  const { data: progData } = useQuery<ProgData>({
    queryKey: ["pm-programme", selectedProgId, "greencomp"],
    queryFn: () => apiFetch(`/programme-mapping/programmes/${selectedProgId}?lens=greencomp`),
    enabled: selectedProgId !== null,
  });

  // For "All programmes" view, use the module catalogue endpoint
  const { data: catalogueModules = [] } = useQuery<Array<{
    id: number; moduleCode: string; moduleTitle: string; stageInferred: string | null;
    gaClassifications: Array<{ domain: string; level: string }>;
    programmeCount: number;
  }>>({
    queryKey: ["module-catalogue", "greencomp"],
    queryFn: () => apiFetch("/module-catalogue?lens=greencomp"),
    enabled: selectedProgId === null,
  });

  // Derive classification map for selected context
  const clsMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (selectedProgId && progData) {
      for (const c of progData.classifications ?? []) map[`${c.moduleId}-${c.domain}`] = c.level;
    } else {
      for (const m of catalogueModules) {
        for (const gc of m.gaClassifications) map[`${m.id}-${gc.domain}`] = gc.level;
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

  // ── Radar chart data (4 areas, % of modules with ≥1 active competence in area)
  const radarData = useMemo(() => {
    return GC_AREAS.map(area => {
      const active = total > 0
        ? allModuleIds.filter(id => area.competenceKeys.some(k => getLevel(id, k) !== "None")).length
        : 0;
      const pct = total > 0 ? Math.round((active / total) * 100) : 0;
      return { area: area.shortLabel, value: pct, fullMark: 100 };
    });
  }, [allModuleIds, clsMap, total]);

  // ── Competence coverage counts ─────────────────────────────────────────────
  const compStats = useMemo(() => {
    return GC_COMPETENCES.map(comp => {
      const counts: Record<Level, number> = { None: 0, Developing: 0, Consolidating: 0, Leading: 0 };
      for (const id of allModuleIds) {
        const l = getLevel(id, comp.key);
        counts[l] = (counts[l] ?? 0) + 1;
      }
      const active = total - counts.None;
      return { comp, counts, active };
    });
  }, [allModuleIds, clsMap, total]);

  // ── Stage map (for programme view) ────────────────────────────────────────
  const stageMap = useMemo(() => {
    if (!selectedProgId || !progData) return null;
    const mods = [...(progData.modules ?? [])].sort((a, b) => a.orderIndex - b.orderIndex);
    const presentStages = STAGES.filter(s => mods.some(m => m.stage === s));
    const unstaged = mods.filter(m => !m.stage);
    if (unstaged.length) presentStages.push("Unassigned");
    return { mods, presentStages, unstaged };
  }, [progData, selectedProgId]);

  // ── Narrative ─────────────────────────────────────────────────────────────
  const narrative = useMemo(() => {
    if (!total) return "No modules to analyse yet.";
    const lines: string[] = [];

    for (const area of GC_AREAS) {
      const areaActive = allModuleIds.filter(id => area.competenceKeys.some(k => getLevel(id, k) !== "None")).length;
      const pct = Math.round((areaActive / total) * 100);

      const maxComp = area.competenceKeys.reduce((best, k) => {
        const active = allModuleIds.filter(id => getLevel(id, k) !== "None").length;
        return active > best.count ? { key: k, count: active } : best;
      }, { key: "", count: -1 });

      const compLabel = GC_COMPETENCES.find(c => c.key === maxComp.key)?.label ?? "";
      let line = `**${area.shortLabel} — ${area.label}**: ${areaActive} of ${total} modules (${pct}%) engage with at least one competence in this area.`;
      if (maxComp.count > 0) line += ` Strongest presence: ${compLabel} (${maxComp.count} modules).`;
      if (areaActive === 0) line += ` No modules are currently classified against this area.`;
      lines.push(line);
    }

    const noGC = allModuleIds.filter(id => GC_COMPETENCES.every(c => getLevel(id, c.key) === "None")).length;
    if (noGC > 0) {
      lines.push(`**Gap**: ${noGC} module${noGC > 1 ? "s" : ""} (${Math.round((noGC / total) * 100)}%) have no GreenComp classification across any competence. Consider reviewing these for sustainability integration opportunities.`);
    }

    return lines.join("\n\n");
  }, [allModuleIds, clsMap, total]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg" style={{ backgroundColor: "#0f766e" }}>
            <Leaf className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#003865" }}>GreenComp Dashboard</h1>
            <p className="text-slate-500 mt-0.5">EU Sustainability Competence Framework — programme analysis</p>
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

      {/* Info banner when no classifications yet */}
      {total > 0 && radarData.every(d => d.value === 0) && (
        <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 flex gap-3 text-sm text-teal-800">
          <Info className="h-4 w-4 text-teal-500 mt-0.5 shrink-0" />
          <p>No GreenComp classifications yet. Go to the <strong>Module Catalogue → GreenComp tab</strong> or use the <strong>Classify tab</strong> in Programme Mapping to classify modules with AI or manually.</p>
        </div>
      )}

      {/* ── Stat cards: 4 areas ──────────────────────────────────────────────── */}
      {total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {GC_AREAS.map(area => {
            const active = allModuleIds.filter(id => area.competenceKeys.some(k => getLevel(id, k) !== "None")).length;
            const pct = total > 0 ? Math.round((active / total) * 100) : 0;
            const AreaIcon = area.icon;
            return (
              <Card key={area.key} className="shadow-sm border-slate-200">
                <CardHeader className="pb-1.5 pt-4 px-4">
                  <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <AreaIcon className="h-3 w-3" style={{ color: area.color }} />
                    {area.shortLabel}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-bold" style={{ color: area.color }}>{active}</span>
                    <span className="text-xs text-slate-400 pb-0.5">of {total} ({pct}%)</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: area.color }} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Radar chart + Coverage table side by side ────────────────────────── */}
      {total > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Radar chart */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold mb-4" style={{ color: "#003865" }}>GreenComp Area Profile</h2>
            <p className="text-xs text-slate-400 mb-3">% of modules engaging with each area (at any level)</p>
            <div className="relative">
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart
                  data={radarData.map(d => ({ ...d, display: d.value, value: d.value < 2 ? 2 : d.value }))}
                  margin={{ top: 10, right: 30, bottom: 10, left: 30 }}
                >
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="area" tick={{ fontSize: 12, fill: "#475569", fontWeight: 600 }} />
                  <PolarRadiusAxis domain={[0, 50]} tick={{ fontSize: 10, fill: "#94a3b8" }} tickCount={5} tickFormatter={(v: number) => `${v}%`} />
                  <Radar
                    name="Coverage"
                    dataKey="value"
                    stroke="#0f766e"
                    fill="#0f766e"
                    fillOpacity={radarData.every(d => d.value === 0) ? 0 : 0.25}
                    strokeWidth={2}
                    dot={{ r: 4, fill: "#0f766e", strokeWidth: 0 }}
                  />
                  <RechartTooltip
                    formatter={(_value: number, _name: string, entry: { payload?: { display?: number } }) =>
                      [`${entry?.payload?.display ?? 0}%`, "Coverage"]
                    }
                    contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }}
                  />
                </RadarChart>
              </ResponsiveContainer>
              {radarData.every(d => d.value === 0) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <Leaf className="w-7 h-7 text-slate-200 mb-2" />
                  <p className="text-xs text-slate-400 font-medium">No classifications yet</p>
                  <p className="text-[10px] text-slate-300 mt-0.5">Classify modules to populate the chart</p>
                </div>
              )}
            </div>
          </div>

          {/* Area-level summary table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold mb-4" style={{ color: "#003865" }}>Area Coverage</h2>
            <div className="space-y-4">
              {GC_AREAS.map(area => {
                const areaComps = GC_COMPETENCES.filter(c => c.area === area.key);
                const AreaIcon = area.icon;
                return (
                  <div key={area.key}>
                    <div className="flex items-center gap-2 mb-2">
                      <AreaIcon className="h-3.5 w-3.5 shrink-0" style={{ color: area.color }} />
                      <span className="text-xs font-semibold" style={{ color: area.color }}>{area.label}</span>
                    </div>
                    <div className="space-y-1.5 pl-5">
                      {areaComps.map(comp => {
                        const active = allModuleIds.filter(id => getLevel(id, comp.key) !== "None").length;
                        const pct = total > 0 ? (active / total) * 100 : 0;
                        return (
                          <div key={comp.key} className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 w-24 shrink-0">{comp.shortLabel}</span>
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: area.color, opacity: 0.7 }} />
                            </div>
                            <span className="text-xs font-medium w-12 text-right" style={{ color: active > 0 ? area.color : "#94a3b8" }}>
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

      {/* ── Programme Map (when a specific programme is selected) ────────────── */}
      {selectedProgId && stageMap && stageMap.presentStages.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold" style={{ color: "#003865" }}>Programme Map — GreenComp</h2>
            <p className="text-xs text-slate-500 mt-0.5">Modules by year/stage. Dots show area-level max engagement (V=Values, X=Complexity, F=Futures, A=Action).</p>
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
                      const areaDots = GC_AREAS.map(area => {
                        const levels = area.competenceKeys.map(k => LEVEL_ORDER[getLevel(pm.moduleId, k)] ?? 0);
                        const maxIdx = Math.max(...levels);
                        return { ...area, level: LEVELS[maxIdx] as Level };
                      });
                      const activeDots = areaDots.filter(d => d.level !== "None");
                      const topLevelOrder = Math.max(...areaDots.map(d => LEVEL_ORDER[d.level] ?? 0), 0);
                      const topLevel = LEVELS[topLevelOrder] as Level;
                      const borderColor = activeDots.length === 0 ? "#e2e8f0" : activeDots.length === 1 ? activeDots[0].color : "#0f766e";
                      const borderStyle = topLevel === "Leading" ? `3px solid ${borderColor}`
                        : topLevel === "Consolidating" ? `2px solid ${borderColor}`
                        : topLevel === "Developing" ? `2px dashed ${borderColor}`
                        : `1px solid ${borderColor}`;
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
                                {d.shortLabel[0]}{d.level[0]}
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

      {/* ── 12-competence breakdown table ─────────────────────────────────────── */}
      {total > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold" style={{ color: "#003865" }}>Competence-Level Breakdown</h2>
            <p className="text-xs text-slate-500 mt-0.5">Number of modules at each engagement level per GreenComp competence.</p>
          </div>
          <div className="p-5 overflow-x-auto">
            <div className="space-y-5">
              {GC_AREAS.map(area => (
                <div key={area.key}>
                  <div className="flex items-center gap-2 mb-2">
                    {(() => { const AI = area.icon; return <AI className="h-3.5 w-3.5" style={{ color: area.color }} />; })()}
                    <span className="text-xs font-bold" style={{ color: area.color }}>{area.label}</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-2 pr-6 text-xs font-semibold text-slate-500">Competence</th>
                        {LEVELS.map(l => (
                          <th key={l} className="text-center py-2 px-3 text-xs font-semibold text-slate-500">{l}</th>
                        ))}
                        <th className="text-center py-2 px-3 text-xs font-semibold text-slate-500">Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compStats.filter(s => s.comp.area === area.key).map(({ comp, counts, active }) => (
                        <tr key={comp.key} className="border-b border-slate-50">
                          <td className="py-2 pr-6 text-xs font-medium text-slate-700">{comp.label}</td>
                          {LEVELS.map(l => {
                            const { bg, text, border } = levelBadge(l, area.color, area.bg);
                            return (
                              <td key={l} className="text-center py-2 px-3">
                                <span className="inline-flex items-center justify-center w-8 h-6 rounded text-xs font-bold border" style={{ backgroundColor: bg, color: text, borderColor: border }}>
                                  {counts[l as Level] ?? 0}
                                </span>
                              </td>
                            );
                          })}
                          <td className="text-center py-2 px-3">
                            <span className="text-xs font-semibold" style={{ color: active > 0 ? area.color : "#94a3b8" }}>
                              {active}/{total}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Narrative ──────────────────────────────────────────────────────────── */}
      {total > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold" style={{ color: "#003865" }}>Narrative Summary</h2>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 font-medium">Draft — for team discussion</span>
          </div>
          <div className="space-y-2.5 text-sm text-slate-700 leading-relaxed">
            {narrative.split("\n\n").map((para, i) => (
              <p key={i} dangerouslySetInnerHTML={{
                __html: para
                  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                  .replace(/\*(.+?)\*/g, '<em>$1</em>')
              }} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {total === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-teal-50">
            <BarChart2 className="h-7 w-7" style={{ color: "#0f766e" }} />
          </div>
          <p className="font-semibold text-slate-700">No data yet</p>
          <p className="text-sm text-slate-400 max-w-sm mx-auto">
            {selectedProg !== "__all__" ? "This programme has no modules yet. Add modules in the Build tab." : "No modules in the catalogue yet. Upload modules to get started."}
          </p>
        </div>
      )}
    </div>
  );
}
