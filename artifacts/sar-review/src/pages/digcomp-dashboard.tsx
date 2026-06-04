import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Monitor, Search, Share2, FileText, Shield, Lightbulb, BarChart2, Info } from "lucide-react";
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

const LEVELS = ["None", "Developing", "Consolidating", "Leading"] as const;
type Level = typeof LEVELS[number];
const LEVEL_ORDER: Record<string, number> = { None: 0, Developing: 1, Consolidating: 2, Leading: 3 };

interface AreaConfig { key: string; label: string; shortLabel: string; icon: LucideIcon; color: string; bg: string; competenceKeys: string[] }
interface CompConfig  { key: string; label: string; shortLabel: string; id: string; color: string; bg: string; area: string }

const DC_AREAS: AreaConfig[] = [
  { key: "info",    label: "Information search, evaluation and management", shortLabel: "Information",    icon: Search,    color: "#1e40af", bg: "#eff6ff", competenceKeys: ["BrowsingInfo","EvaluatingInfo","ManagingInfo"] },
  { key: "comm",    label: "Communication and collaboration",               shortLabel: "Communication",  icon: Share2,    color: "#7c3aed", bg: "#faf5ff", competenceKeys: ["Interacting","Sharing","Citizenship","Collaborating","DigitalBehaviour","ManagingIdentity"] },
  { key: "content", label: "Content creation",                              shortLabel: "Content",        icon: FileText,  color: "#0d9488", bg: "#f0fdfa", competenceKeys: ["DevelopingContent","IntegratingContent","CopyrightLicences","ComputationalThinking"] },
  { key: "safety",  label: "Safety, wellbeing and responsible use",         shortLabel: "Safety",         icon: Shield,    color: "#be123c", bg: "#fff1f2", competenceKeys: ["ProtectingDevices","ProtectingData","SupportingWellbeing","EnvironmentalImpact"] },
  { key: "problem", label: "Problem identification and solving",            shortLabel: "Problem-solving", icon: Lightbulb, color: "#b45309", bg: "#fffbeb", competenceKeys: ["SolvingTechnical","IdentifyingNeeds","CreativeSolutions","AddressingCompetenceGaps"] },
];

const DC_COMPETENCES: CompConfig[] = [
  { key: "BrowsingInfo",             id: "1.1", label: "Browsing & searching",          shortLabel: "Browsing",      color: "#1e40af", bg: "#eff6ff", area: "info" },
  { key: "EvaluatingInfo",           id: "1.2", label: "Evaluating information",        shortLabel: "Evaluating",    color: "#1e40af", bg: "#eff6ff", area: "info" },
  { key: "ManagingInfo",             id: "1.3", label: "Managing information",          shortLabel: "Managing",      color: "#1e40af", bg: "#eff6ff", area: "info" },
  { key: "Interacting",              id: "2.1", label: "Interacting digitally",         shortLabel: "Interacting",   color: "#7c3aed", bg: "#faf5ff", area: "comm" },
  { key: "Sharing",                  id: "2.2", label: "Sharing digitally",             shortLabel: "Sharing",       color: "#7c3aed", bg: "#faf5ff", area: "comm" },
  { key: "Citizenship",              id: "2.3", label: "Digital citizenship",           shortLabel: "Citizenship",   color: "#7c3aed", bg: "#faf5ff", area: "comm" },
  { key: "Collaborating",            id: "2.4", label: "Collaborating digitally",       shortLabel: "Collaborating", color: "#7c3aed", bg: "#faf5ff", area: "comm" },
  { key: "DigitalBehaviour",         id: "2.5", label: "Digital behaviour",             shortLabel: "Behaviour",     color: "#7c3aed", bg: "#faf5ff", area: "comm" },
  { key: "ManagingIdentity",         id: "2.6", label: "Managing digital identity",     shortLabel: "Identity",      color: "#7c3aed", bg: "#faf5ff", area: "comm" },
  { key: "DevelopingContent",        id: "3.1", label: "Developing digital content",    shortLabel: "Developing",    color: "#0d9488", bg: "#f0fdfa", area: "content" },
  { key: "IntegratingContent",       id: "3.2", label: "Integrating content",           shortLabel: "Integrating",   color: "#0d9488", bg: "#f0fdfa", area: "content" },
  { key: "CopyrightLicences",        id: "3.3", label: "Copyright & licences",          shortLabel: "Copyright",     color: "#0d9488", bg: "#f0fdfa", area: "content" },
  { key: "ComputationalThinking",    id: "3.4", label: "Computational thinking",        shortLabel: "Computational", color: "#0d9488", bg: "#f0fdfa", area: "content" },
  { key: "ProtectingDevices",        id: "4.1", label: "Protecting devices",            shortLabel: "Devices",       color: "#be123c", bg: "#fff1f2", area: "safety" },
  { key: "ProtectingData",           id: "4.2", label: "Protecting personal data",      shortLabel: "Privacy",       color: "#be123c", bg: "#fff1f2", area: "safety" },
  { key: "SupportingWellbeing",      id: "4.3", label: "Supporting wellbeing",          shortLabel: "Wellbeing",     color: "#be123c", bg: "#fff1f2", area: "safety" },
  { key: "EnvironmentalImpact",      id: "4.4", label: "Environmental impact",          shortLabel: "Environment",   color: "#be123c", bg: "#fff1f2", area: "safety" },
  { key: "SolvingTechnical",         id: "5.1", label: "Solving technical problems",    shortLabel: "Technical",     color: "#b45309", bg: "#fffbeb", area: "problem" },
  { key: "IdentifyingNeeds",         id: "5.2", label: "Identifying digital needs",     shortLabel: "Needs",         color: "#b45309", bg: "#fffbeb", area: "problem" },
  { key: "CreativeSolutions",        id: "5.3", label: "Creative digital solutions",    shortLabel: "Creative",      color: "#b45309", bg: "#fffbeb", area: "problem" },
  { key: "AddressingCompetenceGaps", id: "5.4", label: "Addressing competence gaps",    shortLabel: "Self-dev",      color: "#b45309", bg: "#fffbeb", area: "problem" },
];

interface Programme { id: number; name: string; code: string | null }
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

export default function DigCompDashboard() {
  const [selectedProg, setSelectedProg] = useState<string>("__all__");

  const { data: programmes = [] } = useQuery<Programme[]>({
    queryKey: ["pm-programmes"],
    queryFn: () => apiFetch("/programme-mapping/programmes"),
  });

  const selectedProgId = selectedProg !== "__all__" ? parseInt(selectedProg) : null;

  const { data: progData } = useQuery<ProgData>({
    queryKey: ["pm-programme", selectedProgId, "digcomp"],
    queryFn: () => apiFetch(`/programme-mapping/programmes/${selectedProgId}?lens=digcomp`),
    enabled: selectedProgId !== null,
  });

  const { data: catalogueModules = [] } = useQuery<Array<{
    id: number; moduleCode: string; moduleTitle: string; stageInferred: string | null;
    gaClassifications: Array<{ domain: string; level: string }>;
    programmeCount: number;
  }>>({
    queryKey: ["module-catalogue", "digcomp"],
    queryFn: () => apiFetch("/module-catalogue?lens=digcomp"),
    enabled: selectedProgId === null,
  });

  const clsMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (selectedProgId && progData) {
      for (const c of progData.classifications ?? []) map[`${c.moduleId}-${c.domain}`] = c.level;
    } else {
      for (const m of catalogueModules) {
        for (const dc of m.gaClassifications) map[`${m.id}-${dc.domain}`] = dc.level;
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
    return DC_AREAS.map(area => {
      const active = total > 0
        ? allModuleIds.filter(id => area.competenceKeys.some(k => getLevel(id, k) !== "None")).length
        : 0;
      const pct = total > 0 ? Math.round((active / total) * 100) : 0;
      return { area: area.shortLabel, value: pct, fullMark: 100 };
    });
  }, [allModuleIds, clsMap, total]);

  const compStats = useMemo(() => {
    return DC_COMPETENCES.map(comp => {
      const counts: Record<Level, number> = { None: 0, Developing: 0, Consolidating: 0, Leading: 0 };
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

    for (const area of DC_AREAS) {
      const areaActive = allModuleIds.filter(id => area.competenceKeys.some(k => getLevel(id, k) !== "None")).length;
      const pct = Math.round((areaActive / total) * 100);
      const maxComp = area.competenceKeys.reduce((best, k) => {
        const active = allModuleIds.filter(id => getLevel(id, k) !== "None").length;
        return active > best.count ? { key: k, count: active } : best;
      }, { key: "", count: -1 });
      const compLabel = DC_COMPETENCES.find(c => c.key === maxComp.key)?.label ?? "";
      let line = `**${area.shortLabel} — ${area.label}**: ${areaActive} of ${total} modules (${pct}%) show evidence in at least one competence in this area.`;
      if (maxComp.count > 0) line += ` Strongest: ${compLabel} (${maxComp.count} modules).`;
      if (areaActive === 0) line += ` No modules are currently classified against this area.`;
      lines.push(line);
    }

    const noDC = allModuleIds.filter(id => DC_COMPETENCES.every(c => getLevel(id, c.key) === "None")).length;
    if (noDC > 0) {
      const pct = Math.round((noDC / total) * 100);
      lines.push(`**Gap**: ${noDC} module${noDC > 1 ? "s" : ""} (${pct}%) show no DigComp evidence across any competence. These may use digital delivery without developing digital competence — or may not yet have been analysed.`);
    }

    const concentrated = selectedProgId && stageMap ? (() => {
      const stagesWithDC = stageMap.presentStages.filter(stage => {
        const stageMods = stage === "Unassigned" ? stageMap.unstaged : stageMap.mods.filter(m => m.stage === stage);
        return stageMods.some(pm => DC_COMPETENCES.some(c => getLevel(pm.moduleId, c.key) !== "None"));
      });
      return stagesWithDC.length <= 1 && stageMap.presentStages.length > 1;
    })() : false;

    if (concentrated) {
      lines.push(`**Note**: Digital competence evidence appears concentrated in one stage. Consider whether digital capabilities are scaffolded progressively across the programme.`);
    }

    return lines.join("\n\n");
  }, [allModuleIds, clsMap, total, stageMap, selectedProgId]);

  const hasAnyClassifications = total > 0 && radarData.some(d => d.value > 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg" style={{ backgroundColor: "#1e40af" }}>
            <Monitor className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#003865" }}>DigComp 3.0 Dashboard</h1>
            <p className="text-slate-500 mt-0.5">EU Digital Competence Framework (Fifth Edition, 2025) — programme analysis</p>
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
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-sm text-blue-800">
          <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
          <p>No DigComp classifications yet. Go to <strong>Module Catalogue → DigComp tab</strong> to run AI batch analysis or manually classify modules.</p>
        </div>
      )}

      {/* Area stat cards */}
      {total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {DC_AREAS.map(area => {
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
            <h2 className="text-sm font-semibold mb-1" style={{ color: "#003865" }}>DigComp 3.0 Area Profile</h2>
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
                    stroke="#1e40af"
                    fill="#1e40af"
                    fillOpacity={hasAnyClassifications ? 0.2 : 0}
                    strokeWidth={2}
                    dot={{ r: 4, fill: "#1e40af", strokeWidth: 0 }}
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
                  <Monitor className="w-7 h-7 text-slate-200 mb-2" />
                  <p className="text-xs text-slate-400 font-medium">No classifications yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Area coverage bars */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold mb-4" style={{ color: "#003865" }}>Competence Coverage by Area</h2>
            <div className="space-y-4">
              {DC_AREAS.map(area => {
                const areaComps = DC_COMPETENCES.filter(c => c.area === area.key);
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
            <h2 className="text-sm font-semibold" style={{ color: "#003865" }}>Programme Map — DigComp 3.0</h2>
            <p className="text-xs text-slate-500 mt-0.5">Modules by year/stage. Dots show area-level max engagement (I=Information, C=Communication, X=Content, S=Safety, P=Problem-solving).</p>
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
                      const areaDots = DC_AREAS.map(area => {
                        const levels = area.competenceKeys.map(k => LEVEL_ORDER[getLevel(pm.moduleId, k)] ?? 0);
                        const maxIdx = Math.max(...levels);
                        return { ...area, level: LEVELS[maxIdx] as Level };
                      });
                      const activeDots = areaDots.filter(d => d.level !== "None");
                      const topLevelOrder = Math.max(...areaDots.map(d => LEVEL_ORDER[d.level] ?? 0), 0);
                      const topLevel = LEVELS[topLevelOrder] as Level;
                      const borderColor = activeDots.length === 0 ? "#e2e8f0" : activeDots.length === 1 ? activeDots[0].color : "#1e40af";
                      const borderStyle = topLevel === "Leading" ? `3px solid ${borderColor}`
                        : topLevel === "Consolidating" ? `2px solid ${borderColor}`
                        : topLevel === "Developing" ? `2px dashed ${borderColor}`
                        : `1px solid ${borderColor}`;
                      const areaLabels: Record<string, string> = { info: "I", comm: "C", content: "X", safety: "S", problem: "P" };
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

      {/* 21-competence breakdown */}
      {total > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold" style={{ color: "#003865" }}>Competence-Level Breakdown</h2>
            <p className="text-xs text-slate-500 mt-0.5">Number of modules at each engagement level per DigComp 3.0 competence.</p>
          </div>
          <div className="p-5">
            <div className="space-y-6">
              {DC_AREAS.map(area => {
                const AreaIcon = area.icon;
                const areaComps = compStats.filter(s => s.comp.area === area.key);
                return (
                  <div key={area.key}>
                    <div className="flex items-center gap-2 mb-3">
                      <AreaIcon className="h-3.5 w-3.5" style={{ color: area.color }} />
                      <span className="text-xs font-bold" style={{ color: area.color }}>{area.label}</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-left py-2 pr-4 text-xs font-semibold text-slate-500 w-6">#</th>
                          <th className="text-left py-2 pr-6 text-xs font-semibold text-slate-500">Competence</th>
                          {LEVELS.map(l => (
                            <th key={l} className="text-center py-2 text-xs font-semibold px-2" style={{ color: l === "None" ? "#94a3b8" : area.color }}>{l}</th>
                          ))}
                          <th className="text-center py-2 text-xs font-semibold text-slate-500 px-2">Active</th>
                        </tr>
                      </thead>
                      <tbody>
                        {areaComps.map(({ comp, counts, active }) => {
                          const { bg, text, border } = levelBadge(active > 0 ? "Developing" : "None", area.color, area.bg);
                          return (
                            <tr key={comp.key} className="border-b border-slate-50 hover:bg-slate-50/50">
                              <td className="py-2 pr-2 text-[10px] text-slate-400 font-mono">{comp.id}</td>
                              <td className="py-2 pr-4">
                                <span className="text-xs text-slate-700">{comp.label}</span>
                              </td>
                              {LEVELS.map(l => (
                                <td key={l} className="text-center py-2 px-2">
                                  {counts[l] > 0 ? (
                                    <span className="inline-flex items-center justify-center min-w-[20px] px-1.5 py-0.5 rounded text-[11px] font-semibold"
                                      style={l === "None"
                                        ? { backgroundColor: "#f1f5f9", color: "#94a3b8" }
                                        : levelBadge(l, area.color, area.bg)
                                      }>
                                      {counts[l]}
                                    </span>
                                  ) : (
                                    <span className="text-slate-200 text-xs">—</span>
                                  )}
                                </td>
                              ))}
                              <td className="text-center py-2 px-2">
                                <span className="text-xs font-semibold" style={{ color: active > 0 ? area.color : "#cbd5e1" }}>
                                  {active > 0 ? active : "—"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Narrative */}
      {total > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 className="h-4 w-4" style={{ color: "#1e40af" }} />
            <h2 className="text-sm font-semibold" style={{ color: "#003865" }}>Interpretation</h2>
          </div>
          <div className="space-y-3">
            {narrative.split("\n\n").map((para, i) => {
              const parts = para.split(/\*\*(.*?)\*\*/g);
              return (
                <p key={i} className="text-sm text-slate-600 leading-relaxed">
                  {parts.map((part, j) => j % 2 === 1 ? <strong key={j} className="text-slate-800">{part}</strong> : part)}
                </p>
              );
            })}
          </div>
          <p className="text-xs text-slate-400 mt-4 pt-3 border-t border-slate-100">
            Source: Cosgrove, J. and Cachia, R. (2025). DigComp 3.0: European Digital Competence Framework — Fifth Edition. Publications Office of the European Union. JRC144121.
          </p>
        </div>
      )}

      {total === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <Monitor className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No modules loaded yet.</p>
          <p className="text-xs text-slate-400 mt-1">Upload modules first, then run DigComp classification from the Module Catalogue.</p>
        </div>
      )}
    </div>
  );
}
