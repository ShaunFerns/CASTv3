import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardCheck, Plus, Trash2, ChevronRight, ArrowLeft, Users, Leaf, Handshake,
  Info, Search, X, ChevronUp, ChevronDown, Check, BookOpen, Sparkles, Loader2,
  RotateCcw, Printer, FileSpreadsheet, Library, Network, Eye, Zap, Scale, Lock, Monitor,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

// ── API ───────────────────────────────────────────────────────────────────────
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}/api${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<T>;
}

// ── Lens Config ───────────────────────────────────────────────────────────────
interface LensDomain {
  key: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  desc: string;
  area?: string;
}
interface LensArea {
  key: string;
  label: string;
  shortLabel: string;
  color: string;
  bg: string;
  icon: LucideIcon;
  competenceKeys: string[];
}
interface LensConfig {
  key: string;
  label: string;
  available: boolean;
  apiLens: string;
  domains: LensDomain[];
  areas?: LensArea[];
}

const GC_AREAS: LensArea[] = [
  { key: "values",     label: "Embodying Values",           shortLabel: "Values",     color: "#0f766e", bg: "#f0fdfa", icon: Scale,   competenceKeys: ["ValuingSustainability","SupportingFairness","PromotingNature"] },
  { key: "complexity", label: "Embracing Complexity",       shortLabel: "Complexity", color: "#7c3aed", bg: "#faf5ff", icon: Network, competenceKeys: ["SystemsThinking","CriticalThinking","ProblemFraming"] },
  { key: "futures",    label: "Envisioning Futures",        shortLabel: "Futures",    color: "#1d4ed8", bg: "#eff6ff", icon: Eye,     competenceKeys: ["FuturesLiteracy","Adaptability","ExploratoryThinking"] },
  { key: "action",     label: "Acting for Sustainability",  shortLabel: "Action",     color: "#b45309", bg: "#fffbeb", icon: Zap,     competenceKeys: ["PoliticalAgency","CollectiveAction","IndividualInitiative"] },
];

const EC_AREAS: LensArea[] = [
  { key: "ideas",     label: "Ideas & Opportunities", shortLabel: "Ideas",     color: "#d97706", bg: "#fffbeb", icon: Eye,     competenceKeys: ["SpottingOpportunities","Creativity","Vision","ValuingIdeas","EthicalSustainableThinking"] },
  { key: "resources", label: "Resources",              shortLabel: "Resources", color: "#7c3aed", bg: "#faf5ff", icon: Scale,   competenceKeys: ["SelfAwareness","Motivation","MobilisingResources","FinancialLiteracy","MobilisingOthers"] },
  { key: "action",    label: "Into Action",            shortLabel: "Action",    color: "#059669", bg: "#ecfdf5", icon: Zap,     competenceKeys: ["TakingInitiative","PlanningManagement","CopingWithUncertainty","WorkingWithOthers","LearningThroughExperience"] },
];

const LENSES: LensConfig[] = [
  {
    key: "graduate_attributes",
    label: "Graduate Attributes",
    available: true,
    apiLens: "ga",
    domains: [
      { key: "People",      label: "People",      shortLabel: "People",      icon: Users,     color: "#c2185b", bg: "#fce4ec", desc: "Digital capability, reflective practice, lifelong learning" },
      { key: "Planet",      label: "Planet",      shortLabel: "Planet",      icon: Leaf,      color: "#388e3c", bg: "#e8f5e9", desc: "Sustainability, ethics, SDGs, futures thinking" },
      { key: "Partnership", label: "Partnership", shortLabel: "Partner",     icon: Handshake, color: "#1565c0", bg: "#e3f2fd", desc: "Collaboration, co-creation, real-world engagement" },
    ],
  },
  {
    key: "greencomp",
    label: "GreenComp",
    available: true,
    apiLens: "greencomp",
    areas: GC_AREAS,
    domains: [
      { key: "ValuingSustainability", label: "Valuing Sustainability", shortLabel: "Valuing",   icon: Scale,   color: "#0f766e", bg: "#f0fdfa", area: "values",     desc: "Sustainability values, ethics, worldviews" },
      { key: "SupportingFairness",    label: "Supporting Fairness",    shortLabel: "Fairness",  icon: Scale,   color: "#0f766e", bg: "#f0fdfa", area: "values",     desc: "Equity, justice, intergenerational responsibility" },
      { key: "PromotingNature",       label: "Promoting Nature",       shortLabel: "Nature",    icon: Leaf,    color: "#0f766e", bg: "#f0fdfa", area: "values",     desc: "Human-nature connection, biodiversity" },
      { key: "SystemsThinking",       label: "Systems Thinking",       shortLabel: "Systems",   icon: Network, color: "#7c3aed", bg: "#faf5ff", area: "complexity", desc: "Holistic, interconnected systems-level thinking" },
      { key: "CriticalThinking",      label: "Critical Thinking",      shortLabel: "Critical",  icon: Network, color: "#7c3aed", bg: "#faf5ff", area: "complexity", desc: "Scrutiny of assumptions, evidence evaluation" },
      { key: "ProblemFraming",        label: "Problem Framing",        shortLabel: "Framing",   icon: Network, color: "#7c3aed", bg: "#faf5ff", area: "complexity", desc: "Define and interpret sustainability challenges" },
      { key: "FuturesLiteracy",       label: "Futures Literacy",       shortLabel: "Futures",   icon: Eye,     color: "#1d4ed8", bg: "#eff6ff", area: "futures",    desc: "Possible/preferred future scenarios" },
      { key: "Adaptability",          label: "Adaptability",           shortLabel: "Adapt",     icon: Eye,     color: "#1d4ed8", bg: "#eff6ff", area: "futures",    desc: "Uncertainty, resilience, adaptive decision-making" },
      { key: "ExploratoryThinking",   label: "Exploratory Thinking",   shortLabel: "Explore",   icon: Eye,     color: "#1d4ed8", bg: "#eff6ff", area: "futures",    desc: "Creative, transdisciplinary, experimental thinking" },
      { key: "PoliticalAgency",       label: "Political Agency",       shortLabel: "Agency",    icon: Zap,     color: "#b45309", bg: "#fffbeb", area: "action",     desc: "Civic, policy, advocacy, accountability" },
      { key: "CollectiveAction",      label: "Collective Action",      shortLabel: "Collective",icon: Zap,     color: "#b45309", bg: "#fffbeb", area: "action",     desc: "Collaboration for shared sustainability goals" },
      { key: "IndividualInitiative",  label: "Individual Initiative",  shortLabel: "Initiative",icon: Zap,     color: "#b45309", bg: "#fffbeb", area: "action",     desc: "Personal responsibility, proactive contribution" },
    ],
  },
  { key: "udl",       label: "UDL",         available: false, apiLens: "udl",       domains: [] },
  {
    key: "entrecomp",
    label: "EntreComp",
    available: true,
    apiLens: "entrecomp",
    areas: EC_AREAS,
    domains: [
      { key: "SpottingOpportunities",     label: "Spotting Opportunities",        shortLabel: "Spotting",    icon: Eye,     color: "#d97706", bg: "#fffbeb", area: "ideas",     desc: "Identifying valuable opportunities in challenging contexts" },
      { key: "Creativity",                label: "Creativity",                    shortLabel: "Creativity",  icon: Eye,     color: "#d97706", bg: "#fffbeb", area: "ideas",     desc: "Developing original, valuable ideas to influence action" },
      { key: "Vision",                    label: "Vision",                        shortLabel: "Vision",      icon: Eye,     color: "#d97706", bg: "#fffbeb", area: "ideas",     desc: "Envisioning the future and imagining ambitious goals" },
      { key: "ValuingIdeas",              label: "Valuing Ideas",                 shortLabel: "Valuing",     icon: Eye,     color: "#d97706", bg: "#fffbeb", area: "ideas",     desc: "Recognising the value and potential of ideas" },
      { key: "EthicalSustainableThinking",label: "Ethical & Sustainable Thinking",shortLabel: "Ethical",    icon: Eye,     color: "#d97706", bg: "#fffbeb", area: "ideas",     desc: "Assessing the consequences of ideas on sustainability and ethics" },
      { key: "SelfAwareness",             label: "Self-Awareness",                shortLabel: "Self-Aware",  icon: Scale,   color: "#7c3aed", bg: "#faf5ff", area: "resources", desc: "Reflecting on personal strengths, weaknesses, values and agency" },
      { key: "Motivation",                label: "Motivation & Perseverance",     shortLabel: "Motivation",  icon: Scale,   color: "#7c3aed", bg: "#faf5ff", area: "resources", desc: "Maintaining focus and drive despite setbacks" },
      { key: "MobilisingResources",       label: "Mobilising Resources",          shortLabel: "Resources",   icon: Scale,   color: "#7c3aed", bg: "#faf5ff", area: "resources", desc: "Gathering and managing the resources needed to create value" },
      { key: "FinancialLiteracy",         label: "Financial & Economic Literacy", shortLabel: "Financial",   icon: Scale,   color: "#7c3aed", bg: "#faf5ff", area: "resources", desc: "Understanding financial concepts and managing finances" },
      { key: "MobilisingOthers",          label: "Mobilising Others",             shortLabel: "Mobilising",  icon: Scale,   color: "#7c3aed", bg: "#faf5ff", area: "resources", desc: "Inspiring and leading others toward a shared purpose" },
      { key: "TakingInitiative",          label: "Taking the Initiative",         shortLabel: "Initiative",  icon: Zap,     color: "#059669", bg: "#ecfdf5", area: "action",    desc: "Proactively initiating processes and making decisions" },
      { key: "PlanningManagement",        label: "Planning & Management",         shortLabel: "Planning",    icon: Zap,     color: "#059669", bg: "#ecfdf5", area: "action",    desc: "Setting goals and planning how to achieve them" },
      { key: "CopingWithUncertainty",     label: "Coping with Uncertainty",       shortLabel: "Uncertainty", icon: Zap,     color: "#059669", bg: "#ecfdf5", area: "action",    desc: "Making decisions and acting in uncertain and ambiguous situations" },
      { key: "WorkingWithOthers",         label: "Working with Others",           shortLabel: "Teamwork",    icon: Zap,     color: "#059669", bg: "#ecfdf5", area: "action",    desc: "Teaming up, collaborating and networking for value creation" },
      { key: "LearningThroughExperience", label: "Learning Through Experience",   shortLabel: "Learning",    icon: Zap,     color: "#059669", bg: "#ecfdf5", area: "action",    desc: "Learning from experience to improve continuously" },
    ],
  },
  {
    key: "digcomp",
    label: "DigComp 3.0",
    available: true,
    apiLens: "digcomp",
    areas: [
      { key: "info",    label: "Information search, evaluation and management", shortLabel: "Information",    color: "#1e40af", bg: "#eff6ff", icon: Eye,     competenceKeys: ["BrowsingInfo","EvaluatingInfo","ManagingInfo"] },
      { key: "comm",    label: "Communication and collaboration",               shortLabel: "Communication",  color: "#7c3aed", bg: "#faf5ff", icon: Network, competenceKeys: ["Interacting","Sharing","Citizenship","Collaborating","DigitalBehaviour","ManagingIdentity"] },
      { key: "content", label: "Content creation",                              shortLabel: "Content",        color: "#0d9488", bg: "#f0fdfa", icon: Zap,     competenceKeys: ["DevelopingContent","IntegratingContent","CopyrightLicences","ComputationalThinking"] },
      { key: "safety",  label: "Safety, wellbeing and responsible use",         shortLabel: "Safety",         color: "#be123c", bg: "#fff1f2", icon: Scale,   competenceKeys: ["ProtectingDevices","ProtectingData","SupportingWellbeing","EnvironmentalImpact"] },
      { key: "problem", label: "Problem identification and solving",            shortLabel: "Problem-solving", color: "#b45309", bg: "#fffbeb", icon: Network, competenceKeys: ["SolvingTechnical","IdentifyingNeeds","CreativeSolutions","AddressingCompetenceGaps"] },
    ],
    domains: [
      { key: "BrowsingInfo",             label: "Browsing & searching",     shortLabel: "Browsing",   icon: Eye,     color: "#1e40af", bg: "#eff6ff", area: "info",    desc: "Search, locate and retrieve digital content; judge relevance." },
      { key: "EvaluatingInfo",           label: "Evaluating information",   shortLabel: "Evaluating", icon: Eye,     color: "#1e40af", bg: "#eff6ff", area: "info",    desc: "Critically evaluate digital sources for credibility." },
      { key: "ManagingInfo",             label: "Managing information",     shortLabel: "Managing",   icon: Eye,     color: "#1e40af", bg: "#eff6ff", area: "info",    desc: "Store, organise and analyse digital data." },
      { key: "Interacting",              label: "Interacting digitally",    shortLabel: "Interact",   icon: Network, color: "#7c3aed", bg: "#faf5ff", area: "comm",    desc: "Interact with others using digital technologies." },
      { key: "Sharing",                  label: "Sharing digitally",        shortLabel: "Sharing",    icon: Network, color: "#7c3aed", bg: "#faf5ff", area: "comm",    desc: "Share data, information and digital content." },
      { key: "Citizenship",              label: "Digital citizenship",      shortLabel: "Citizen",    icon: Network, color: "#7c3aed", bg: "#faf5ff", area: "comm",    desc: "Participate in society through digital technologies." },
      { key: "Collaborating",            label: "Collaborating digitally",  shortLabel: "Collab",     icon: Network, color: "#7c3aed", bg: "#faf5ff", area: "comm",    desc: "Use digital tools for collaborative processes." },
      { key: "DigitalBehaviour",         label: "Digital behaviour",        shortLabel: "Behaviour",  icon: Network, color: "#7c3aed", bg: "#faf5ff", area: "comm",    desc: "Norms of online communities; cultural diversity." },
      { key: "ManagingIdentity",         label: "Digital identity",         shortLabel: "Identity",   icon: Network, color: "#7c3aed", bg: "#faf5ff", area: "comm",    desc: "Create and manage digital identities; data protection." },
      { key: "DevelopingContent",        label: "Developing content",       shortLabel: "Develop",    icon: Zap,     color: "#0d9488", bg: "#f0fdfa", area: "content", desc: "Create and edit digital content in various formats." },
      { key: "IntegratingContent",       label: "Integrating content",      shortLabel: "Integrate",  icon: Zap,     color: "#0d9488", bg: "#f0fdfa", area: "content", desc: "Modify and integrate content; understand copyright." },
      { key: "CopyrightLicences",        label: "Copyright & licences",     shortLabel: "Copyright",  icon: Zap,     color: "#0d9488", bg: "#f0fdfa", area: "content", desc: "Apply copyright and open licences to digital content." },
      { key: "ComputationalThinking",    label: "Computational thinking",   shortLabel: "Compute",    icon: Zap,     color: "#0d9488", bg: "#f0fdfa", area: "content", desc: "Algorithmic and computational thinking; programming." },
      { key: "ProtectingDevices",        label: "Protecting devices",       shortLabel: "Devices",    icon: Scale,   color: "#be123c", bg: "#fff1f2", area: "safety",  desc: "Protect devices and digital content from risks." },
      { key: "ProtectingData",           label: "Protecting data",          shortLabel: "Privacy",    icon: Scale,   color: "#be123c", bg: "#fff1f2", area: "safety",  desc: "Protect personal data and privacy online." },
      { key: "SupportingWellbeing",      label: "Supporting wellbeing",     shortLabel: "Wellbeing",  icon: Scale,   color: "#be123c", bg: "#fff1f2", area: "safety",  desc: "Avoid health risks; balance digital and physical worlds." },
      { key: "EnvironmentalImpact",      label: "Environmental impact",     shortLabel: "Environ",    icon: Scale,   color: "#be123c", bg: "#fff1f2", area: "safety",  desc: "Environmental impact of digital technologies." },
      { key: "SolvingTechnical",         label: "Solving technical issues",  shortLabel: "Technical",  icon: Network, color: "#b45309", bg: "#fffbeb", area: "problem", desc: "Identify and resolve technical problems with devices." },
      { key: "IdentifyingNeeds",         label: "Identifying needs",        shortLabel: "Needs",      icon: Network, color: "#b45309", bg: "#fffbeb", area: "problem", desc: "Assess needs and identify digital technological responses." },
      { key: "CreativeSolutions",        label: "Creative solutions",       shortLabel: "Creative",   icon: Network, color: "#b45309", bg: "#fffbeb", area: "problem", desc: "Innovate processes using digital technologies creatively." },
      { key: "AddressingCompetenceGaps", label: "Competence gaps",          shortLabel: "Self-dev",   icon: Network, color: "#b45309", bg: "#fffbeb", area: "problem", desc: "Identify and address digital competence development needs." },
    ],
  },
  { key: "edit",      label: "EDIT",        available: false, apiLens: "edit",      domains: [] },
  { key: "custom",    label: "Custom Lens", available: false, apiLens: "custom",    domains: [] },
];

const LEVELS = ["None", "Developing", "Consolidating", "Leading"] as const;
const EC_LEVELS = ["None", "Foundation", "Intermediate", "Advanced"] as const;
type Level = "None" | "Developing" | "Consolidating" | "Leading" | "Foundation" | "Intermediate" | "Advanced";

const LEVEL_ORDER: Record<string, number> = { None: 0, Developing: 1, Consolidating: 2, Leading: 3, Foundation: 1, Intermediate: 2, Advanced: 3 };

function nextLevel(l: string, levels: readonly string[] = LEVELS): Level {
  const i = levels.indexOf(l);
  return levels[(i + 1) % levels.length] as Level;
}

function levelStyle(level: string, domainColor: string, domainBg: string) {
  if (level === "None")                                       return { bg: "#f1f5f9", text: "#64748b", border: "#e2e8f0" };
  if (level === "Developing"   || level === "Foundation")    return { bg: domainBg,  text: domainColor, border: `${domainColor}55` };
  if (level === "Consolidating"|| level === "Intermediate")  return { bg: `${domainColor}22`, text: domainColor, border: `${domainColor}99` };
  return { bg: domainColor, text: "#fff", border: domainColor };
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface PoolModule {
  id: number;
  moduleCode: string;
  moduleTitle: string;
  stageInferred: string | null;
  overview: string | null;
  learningOutcomes: string | null;
}
interface PmRow {
  id: number;
  programmeId: number;
  moduleId: number;
  stage: string | null;
  semester: string | null;
  coreOption: string | null;
  orderIndex: number;
  module: PoolModule;
}
interface GaEvidenceItem {
  field: string;
  snippet: string;
  weight: "primary" | "secondary";
}
interface GaRow {
  id: number;
  programmeId: number | null;
  moduleId: number;
  domain: string;
  level: string;
  source?: string;
  rationale?: string;
  evidence?: string;
  inherited?: boolean;
}
interface Programme {
  id: number;
  name: string;
  code: string | null;
  description: string | null;
  moduleCount?: number;
  modules?: PmRow[];
  classifications?: GaRow[];
}

const STAGES = ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Other"];
const SEMESTERS = ["Semester 1", "Semester 2", "Both", "Full Year"];
const CORE_OPTIONS = ["Core", "Elective", "Free Elective"];

function stageFromInferred(s: string | null): string {
  if (!s) return "";
  const m = s.match(/\d/);
  if (m) return `Year ${m[0]}`;
  return "";
}

// ── GA Narrative generator ────────────────────────────────────────────────────
function generateNarrative(modules: PmRow[], classifications: GaRow[], lens: LensConfig): string {
  if (!modules.length) return "No modules in programme yet.";
  const lines: string[] = [];
  const total = modules.length;

  for (const domain of lens.domains) {
    const rows = classifications.filter(c => c.domain === domain.key);
    const counts: Record<string, number> = { None: 0, Developing: 0, Consolidating: 0, Leading: 0, Foundation: 0, Intermediate: 0, Advanced: 0 };
    for (const r of rows) counts[r.level] = (counts[r.level] ?? 0) + 1;
    const unclassified = modules.filter(m => !rows.find(r => r.moduleId === m.moduleId)).length;
    counts.None += unclassified;
    const active = total - counts.None;
    const pct = total > 0 ? Math.round((active / total) * 100) : 0;

    const byYear: Record<string, Level[]> = {};
    for (const pm of modules) {
      const stage = pm.stage ?? "Unassigned";
      const cls = rows.find(r => r.moduleId === pm.moduleId);
      const level = (cls?.level ?? "None") as Level;
      if (!byYear[stage]) byYear[stage] = [];
      byYear[stage].push(level);
    }
    const years = Object.keys(byYear).sort();
    let intro = "";
    for (const yr of years) {
      if (byYear[yr].some(l => l !== "None")) { intro = yr; break; }
    }
    const leadYears = years.filter(yr => byYear[yr].includes("Leading") || byYear[yr].includes("Advanced"));

    let line = `**${domain.label}**: ${active} of ${total} modules (${pct}%) engage with this competence.`;
    if (intro) line += ` First introduced in ${intro}.`;
    if (leadYears.length) line += ` Highest-level engagement in ${leadYears.join(", ")}.`;
    if (counts.Leading === 0 && counts.Advanced === 0 && active > 0) line += ` No module yet reaches the highest level.`;
    if (active === 0) line += ` No modules currently assigned to this competence.`;
    lines.push(line);
  }

  const allActiveModuleIds = new Set(classifications.filter(c => c.level !== "None").map(c => c.moduleId));
  const unclassifiedMods = modules.filter(m => !allActiveModuleIds.has(m.moduleId));
  if (unclassifiedMods.length > 0) {
    lines.push(`**Gap**: ${unclassifiedMods.length} module${unclassifiedMods.length > 1 ? "s" : ""} (${unclassifiedMods.map(m => m.module?.moduleCode).join(", ")}) have no engagement across any domain.`);
  }

  return lines.join("\n\n");
}

// ── Main Page ─────────────────────────────────────────────────────────────────
type View = "list" | "build" | "classify" | "map";

export default function Programme() {
  const [view, setView] = useState<View>("list");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedLens, setSelectedLens] = useState("graduate_attributes");

  function openProgramme(id: number, target: View = "build") {
    setSelectedId(id);
    setView(target);
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      {view === "list" && <ProgrammeList onOpen={openProgramme} />}
      {view !== "list" && selectedId !== null && (
        <ProgrammeDetail
          id={selectedId}
          view={view}
          selectedLens={selectedLens}
          onViewChange={setView}
          onLensChange={setSelectedLens}
          onBack={() => setView("list")}
        />
      )}
    </div>
  );
}

// ── Programme List ────────────────────────────────────────────────────────────
function ProgrammeList({ onOpen }: { onOpen: (id: number, view?: View) => void }) {
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);

  const { data: programmes = [], isLoading } = useQuery<Programme[]>({
    queryKey: ["pm-programmes"],
    queryFn: () => apiFetch("/programme-mapping/programmes"),
  });

  const createMut = useMutation({
    mutationFn: (body: { name: string; code?: string }) =>
      apiFetch<Programme>("/programme-mapping/programmes", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (prog) => {
      qc.invalidateQueries({ queryKey: ["pm-programmes"] });
      setCreating(false);
      setName(""); setCode("");
      onOpen(prog.id, "build");
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/programme-mapping/programmes/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pm-programmes"] }); setDeleting(null); },
  });

  return (
    <div className="max-w-3xl mx-auto pt-8 space-y-6">
      <div className="flex items-center gap-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg" style={{ backgroundColor: "#003865" }}>
          <ClipboardCheck className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#003865" }}>Programme Mapping</h1>
          <p className="text-slate-500 mt-0.5">Build a programme and map it against curriculum lenses.</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-sm text-blue-800">
        <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
        <p>Build a programme manually from the available module pool. Assign modules to years, then classify each one against Graduate Attribute domains (People, Planet, Partnership) or the GreenComp sustainability competence framework. The tool generates a visual map and narrative summary.</p>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: "#003865" }}>
          {isLoading ? "Loading…" : programmes.length ? `${programmes.length} programme${programmes.length > 1 ? "s" : ""}` : "No programmes yet"}
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setLocation("/programme/import")}
            className="text-[#003865] border-[#003865] hover:bg-blue-50"
          >
            <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Import Structure
          </Button>
          <Button onClick={() => setCreating(true)} style={{ backgroundColor: "#003865" }} className="text-white">
            <Plus className="h-4 w-4 mr-1.5" /> New Programme
          </Button>
        </div>
      </div>

      {creating && (
        <div className="bg-white rounded-xl border border-[#003865] shadow-sm p-5 space-y-3">
          <p className="font-semibold" style={{ color: "#003865" }}>Create new programme</p>
          <div className="flex gap-3">
            <Input
              placeholder="Programme name *"
              value={name}
              onChange={e => setName(e.target.value)}
              className="flex-1"
              autoFocus
              onKeyDown={e => e.key === "Enter" && name.trim() && createMut.mutate({ name, code: code || undefined })}
            />
            <Input
              placeholder="Code (optional)"
              value={code}
              onChange={e => setCode(e.target.value)}
              className="w-36"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => { setCreating(false); setName(""); setCode(""); }}>Cancel</Button>
            <Button
              onClick={() => createMut.mutate({ name, code: code || undefined })}
              disabled={!name.trim() || createMut.isPending}
              style={{ backgroundColor: "#003865" }} className="text-white"
            >
              {createMut.isPending ? "Creating…" : "Create & Build"}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {programmes.map(p => (
          <div
            key={p.id}
            className="relative bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center gap-4 group hover:border-[#003865] transition-colors cursor-pointer"
            onClick={() => onOpen(p.id)}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold" style={{ color: "#003865" }}>{p.name}</p>
                {p.code && <Badge variant="outline" className="text-xs">{p.code}</Badge>}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{p.moduleCount ?? 0} module{p.moduleCount !== 1 ? "s" : ""}</p>
            </div>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); onOpen(p.id, "classify"); }} className="text-xs">Classify</Button>
              <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); onOpen(p.id, "map"); }} className="text-xs">Map</Button>
              <Button
                size="sm" variant="ghost"
                onClick={e => { e.stopPropagation(); setDeleting(p.id); }}
                className="text-red-400 hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-[#003865] transition-colors" />

            {deleting === p.id && (
              <div
                className="absolute inset-0 bg-white/95 rounded-xl flex items-center justify-center gap-3 z-10"
                onClick={e => e.stopPropagation()}
              >
                <p className="text-sm font-medium text-slate-700">Delete "{p.name}"?</p>
                <Button size="sm" variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
                <Button
                  size="sm" className="bg-red-600 text-white hover:bg-red-700"
                  onClick={() => deleteMut.mutate(p.id)}
                  disabled={deleteMut.isPending}
                >
                  {deleteMut.isPending ? "Deleting…" : "Delete"}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Programme Detail wrapper ───────────────────────────────────────────────────
function ProgrammeDetail({
  id, view, selectedLens, onViewChange, onLensChange, onBack,
}: {
  id: number; view: View; selectedLens: string;
  onViewChange: (v: View) => void; onLensChange: (l: string) => void; onBack: () => void;
}) {
  const lensConfig = LENSES.find(l => l.key === selectedLens) ?? LENSES[0];
  const apiLens = lensConfig.apiLens;

  // Fetch with lens so classifications are filtered appropriately
  const { data: prog, isLoading } = useQuery<Programme>({
    queryKey: ["pm-programme", id, apiLens],
    queryFn: () => apiFetch(`/programme-mapping/programmes/${id}?lens=${apiLens}`),
    refetchOnMount: true,
  });

  if (isLoading || !prog) {
    return <div className="py-16 text-center text-slate-400">Loading…</div>;
  }

  const tabs: { key: View; label: string }[] = [
    { key: "build",    label: "Build" },
    { key: "classify", label: "Classify" },
    { key: "map",      label: "Map" },
  ];

  return (
    <div className="max-w-6xl mx-auto pt-6 space-y-5">
      <div className="flex items-center gap-2 text-sm text-slate-500 no-print">
        <button onClick={onBack} className="flex items-center gap-1 hover:text-[#003865] transition-colors font-medium">
          <ArrowLeft className="h-3.5 w-3.5" /> Programmes
        </button>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-semibold" style={{ color: "#003865" }}>{prog.name}</span>
        {prog.code && <Badge variant="outline" className="text-xs">{prog.code}</Badge>}
      </div>

      <div className="flex items-center gap-1 border-b border-slate-200 no-print">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => onViewChange(t.key)}
            className={cn(
              "px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2",
              view === t.key
                ? "border-[#003865] text-[#003865] bg-white"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            {t.label}
          </button>
        ))}
        {view === "map" && (
          <button
            onClick={() => window.print()}
            className="ml-auto mb-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-800 hover:bg-slate-50 text-xs font-medium transition-all"
          >
            <Printer className="h-3.5 w-3.5" />
            Print map
          </button>
        )}
      </div>

      {view === "build"    && <BuildView prog={prog} />}
      {view === "classify" && <ClassifyView prog={prog} selectedLens={selectedLens} apiLens={apiLens} onLensChange={onLensChange} />}
      {view === "map"      && <MapView prog={prog} selectedLens={selectedLens} apiLens={apiLens} onLensChange={onLensChange} />}
    </div>
  );
}

// ── Build View ─────────────────────────────────────────────────────────────────
function BuildView({ prog }: { prog: Programme }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");

  const { data: pool = [] } = useQuery<PoolModule[]>({
    queryKey: ["pm-pool"],
    queryFn: () => apiFetch("/programme-mapping/module-pool"),
  });

  const modules: PmRow[] = prog.modules ?? [];
  const inProg = new Set(modules.map(m => m.moduleId));

  const addMut = useMutation({
    mutationFn: (m: PoolModule) => apiFetch(`/programme-mapping/programmes/${prog.id}/modules`, {
      method: "POST",
      body: JSON.stringify({ moduleId: m.id, stage: stageFromInferred(m.stageInferred) || null, orderIndex: modules.length }),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pm-programme", prog.id] }),
  });

  const removeMut = useMutation({
    mutationFn: (moduleId: number) => apiFetch(`/programme-mapping/programmes/${prog.id}/modules/${moduleId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pm-programme", prog.id] }),
  });

  const patchMut = useMutation({
    mutationFn: ({ moduleId, field, value }: { moduleId: number; field: string; value: string }) =>
      apiFetch(`/programme-mapping/programmes/${prog.id}/modules/${moduleId}`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: value }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pm-programme", prog.id] }),
  });

  const moveMut = useMutation({
    mutationFn: async ({ moduleId, dir }: { moduleId: number; dir: 1 | -1 }) => {
      const sorted = [...modules].sort((a, b) => a.orderIndex - b.orderIndex);
      const idx = sorted.findIndex(m => m.moduleId === moduleId);
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= sorted.length) return;
      const order = sorted.map((m, i) => ({ moduleId: m.moduleId, orderIndex: i }));
      const tmp = order[idx].orderIndex;
      order[idx].orderIndex = order[swapIdx].orderIndex;
      order[swapIdx].orderIndex = tmp;
      return apiFetch(`/programme-mapping/programmes/${prog.id}/modules/reorder`, {
        method: "PUT",
        body: JSON.stringify({ order }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pm-programme", prog.id] }),
  });

  const filtered = pool.filter(m => {
    if (inProg.has(m.id)) return false;
    const q = search.toLowerCase();
    if (q && !m.moduleCode.toLowerCase().includes(q) && !m.moduleTitle.toLowerCase().includes(q)) return false;
    if (stageFilter && stageFromInferred(m.stageInferred) !== stageFilter) return false;
    return true;
  });

  const sorted = [...modules].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Available pool */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col" style={{ maxHeight: "72vh" }}>
        <div className="p-4 border-b border-slate-100 space-y-2 shrink-0">
          <p className="font-semibold text-sm" style={{ color: "#003865" }}>
            Module pool <span className="text-slate-400 font-normal">({filtered.length} available)</span>
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search code or title…" className="pl-8 h-8 text-xs" />
              {search && <button onClick={() => setSearch("")} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>}
            </div>
            <select
              value={stageFilter}
              onChange={e => setStageFilter(e.target.value)}
              className="h-8 rounded-md border border-slate-200 bg-white text-xs px-2 text-slate-600"
            >
              <option value="">All stages</option>
              {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 divide-y divide-slate-50">
          {filtered.length === 0 && <p className="text-xs text-slate-400 text-center py-10">No modules match.</p>}
          {filtered.map(m => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/80 group">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono font-semibold text-slate-700">{m.moduleCode}</p>
                <p className="text-xs text-slate-500 truncate">{m.moduleTitle}</p>
                {m.stageInferred && <p className="text-[10px] text-slate-400 mt-0.5">{m.stageInferred}</p>}
              </div>
              <button
                onClick={() => addMut.mutate(m)}
                className="shrink-0 h-7 w-7 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:border-[#003865] hover:text-[#003865] transition-colors opacity-0 group-hover:opacity-100"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* In-programme list */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col" style={{ maxHeight: "72vh" }}>
        <div className="p-4 border-b border-slate-100 shrink-0">
          <p className="font-semibold text-sm" style={{ color: "#003865" }}>
            In programme <span className="text-slate-400 font-normal">({sorted.length} modules)</span>
          </p>
        </div>
        <div className="overflow-y-auto flex-1 divide-y divide-slate-50">
          {sorted.length === 0 && <p className="text-xs text-slate-400 text-center py-10">Add modules from the pool on the left.</p>}
          {sorted.map((pm, i) => (
            <div key={pm.id} className="flex items-center gap-2 px-4 py-3 group">
              <div className="flex flex-col gap-0.5 mr-0.5 shrink-0">
                <button onClick={() => moveMut.mutate({ moduleId: pm.moduleId, dir: -1 })} disabled={i === 0} className="text-slate-300 hover:text-slate-500 disabled:opacity-20"><ChevronUp className="h-3 w-3" /></button>
                <button onClick={() => moveMut.mutate({ moduleId: pm.moduleId, dir: 1 })} disabled={i === sorted.length - 1} className="text-slate-300 hover:text-slate-500 disabled:opacity-20"><ChevronDown className="h-3 w-3" /></button>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono font-semibold text-slate-700">{pm.module?.moduleCode}</p>
                <p className="text-xs text-slate-500 truncate">{pm.module?.moduleTitle}</p>
              </div>
              <div className="shrink-0 flex items-center gap-1.5">
                <select
                  value={pm.stage ?? ""}
                  onChange={e => patchMut.mutate({ moduleId: pm.moduleId, field: "stage", value: e.target.value })}
                  className="h-6 rounded border border-slate-200 text-[10px] px-1 text-slate-600 bg-white"
                >
                  <option value="">No stage</option>
                  {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select
                  value={pm.coreOption ?? ""}
                  onChange={e => patchMut.mutate({ moduleId: pm.moduleId, field: "coreOption", value: e.target.value })}
                  className="h-6 rounded border border-slate-200 text-[10px] px-1 text-slate-600 bg-white"
                >
                  <option value="">Type</option>
                  {CORE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select
                  value={pm.semester ?? ""}
                  onChange={e => patchMut.mutate({ moduleId: pm.moduleId, field: "semester", value: e.target.value })}
                  className="h-6 rounded border border-slate-200 text-[10px] px-1 text-slate-600 bg-white"
                >
                  <option value="">Sem</option>
                  {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <Button
                size="sm" variant="ghost"
                className="text-red-400 hover:text-red-600 hover:bg-red-50 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                onClick={() => removeMut.mutate(pm.moduleId)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Classify View ─────────────────────────────────────────────────────────────
interface ClsCell { level: string; source: "user" | "ai" | "inherited"; rationale?: string; evidence?: GaEvidenceItem[]; inherited?: boolean }

function ClassifyView({
  prog, selectedLens, apiLens, onLensChange,
}: {
  prog: Programme; selectedLens: string; apiLens: string; onLensChange: (l: string) => void;
}) {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const lens = (LENSES.find(l => l.key === selectedLens) ?? LENSES[0]);
  const activeLevels = lens.apiLens === "entrecomp" ? EC_LEVELS : LEVELS;
  const modules: PmRow[] = [...(prog.modules ?? [])].sort((a, b) => a.orderIndex - b.orderIndex);

  function parseEvidence(raw?: string): GaEvidenceItem[] {
    if (!raw) return [];
    try { return JSON.parse(raw) as GaEvidenceItem[]; } catch { return []; }
  }

  const [localCls, setLocalCls] = useState<Record<string, ClsCell>>(() => {
    const map: Record<string, ClsCell> = {};
    for (const c of prog.classifications ?? []) {
      map[`${c.moduleId}-${c.domain}`] = {
        level: c.level as Level,
        source: c.inherited ? "inherited" : ((c.source ?? "user") as "user" | "ai"),
        rationale: c.rationale,
        evidence: parseEvidence(c.evidence),
        inherited: c.inherited,
      };
    }
    return map;
  });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiProgress, setAiProgress] = useState<{ total: number; processed: number } | null>(null);

  useEffect(() => {
    setLocalCls(() => {
      const map: Record<string, ClsCell> = {};
      for (const c of prog.classifications ?? []) {
        map[`${c.moduleId}-${c.domain}`] = {
          level: c.level as Level,
          source: c.inherited ? "inherited" : ((c.source ?? "user") as "user" | "ai"),
          rationale: c.rationale,
          evidence: parseEvidence(c.evidence),
          inherited: c.inherited,
        };
      }
      return map;
    });
    setDirty(false);
  }, [prog.classifications]);

  // Poll generation status
  useEffect(() => {
    if (!aiGenerating) return;
    const interval = setInterval(async () => {
      const s = await apiFetch<{ total: number; processed: number; generating: boolean }>(
        `/programme-mapping/programmes/${prog.id}/ga/auto-classify/status?lens=${apiLens}`
      );
      setAiProgress({ total: s.total, processed: s.processed });
      if (!s.generating) {
        setAiGenerating(false);
        setAiProgress(null);
        await qc.invalidateQueries({ queryKey: ["pm-programme", prog.id, apiLens] });
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [aiGenerating, prog.id, qc, apiLens]);

  function getCell(moduleId: number, domain: string): ClsCell {
    return localCls[`${moduleId}-${domain}`] ?? { level: "None", source: "user" };
  }
  function setLevel(moduleId: number, domain: string, level: string) {
    setLocalCls(prev => ({
      ...prev,
      [`${moduleId}-${domain}`]: { ...prev[`${moduleId}-${domain}`], level, source: "user", inherited: false },
    }));
    setDirty(true);
  }

  async function startAiClassify(force = false) {
    if (!isAdmin) {
      toast({ variant: "destructive", title: "Admin access required", description: "Sign in as admin to run AI classification." });
      return;
    }
    try {
      const r = await apiFetch<{ started: boolean; message: string }>(`/programme-mapping/programmes/${prog.id}/ga/auto-classify`, {
        method: "POST",
        body: JSON.stringify({ force, lens: apiLens }),
      });
      if (r.started) {
        setAiGenerating(true);
        setAiProgress({ total: 0, processed: 0 });
      } else {
        toast({ title: "Info", description: r.message });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Classification failed", description: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  async function save() {
    if (!isAdmin) {
      toast({ variant: "destructive", title: "Admin access required", description: "Sign in as admin to save classifications." });
      return;
    }
    setSaving(true);
    try {
      const classifications = modules.flatMap(pm =>
        lens.domains.flatMap(d => {
          const cell = getCell(pm.moduleId, d.key);
          if (cell.source === "inherited") return [];
          return [{ moduleId: pm.moduleId, domain: d.key, level: cell.level, source: cell.source }];
        })
      );
      await apiFetch(`/programme-mapping/programmes/${prog.id}/ga`, {
        method: "PUT", body: JSON.stringify({ classifications, lens: apiLens }),
      });
      await qc.invalidateQueries({ queryKey: ["pm-programme", prog.id, apiLens] });
      setDirty(false);
    } catch (err) {
      toast({ variant: "destructive", title: "Save failed", description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setSaving(false);
    }
  }

  if (modules.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center space-y-2">
        <BookOpen className="h-8 w-8 text-slate-300 mx-auto" />
        <p className="text-slate-500 font-medium">No modules in programme yet</p>
        <p className="text-xs text-slate-400">Go to the Build tab to add modules first.</p>
      </div>
    );
  }

  // For GreenComp: group domains by area
  const isGrouped = !!lens.areas && lens.areas.length > 0;

  return (
    <div className="space-y-4">
      {/* Lens selector */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
        <p className="text-sm font-semibold" style={{ color: "#003865" }}>Select lens</p>
        <div className="flex flex-wrap gap-2">
          {LENSES.map(l => (
            <button
              key={l.key}
              onClick={() => l.available && onLensChange(l.key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
                l.available
                  ? selectedLens === l.key
                    ? "border-[#003865] bg-[#003865] text-white"
                    : "border-slate-200 hover:border-[#003865] text-slate-700"
                  : "border-slate-100 text-slate-300 cursor-default"
              )}
            >
              {l.label}
              {!l.available && <span className="ml-1.5 text-[10px] bg-slate-100 text-slate-400 px-1 rounded">soon</span>}
            </button>
          ))}
        </div>
      </div>

      {lens.available && (
        <>
          {/* Legend + AI controls */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
            {isGrouped ? (
              <div className="flex flex-wrap gap-4 text-xs">
                {lens.areas!.map(area => {
                  const AIcon = area.icon;
                  return (
                    <div key={area.key} className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-sm flex items-center justify-center" style={{ backgroundColor: area.color }}>
                        <AIcon className="h-2.5 w-2.5 text-white" />
                      </div>
                      <span className="font-semibold" style={{ color: area.color }}>{area.label}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-4 text-xs">
                {lens.domains.map(d => {
                  const DIcon = d.icon;
                  return (
                    <div key={d.key} className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-sm flex items-center justify-center" style={{ backgroundColor: d.color }}>
                        <DIcon className="h-2.5 w-2.5 text-white" />
                      </div>
                      <span className="font-semibold" style={{ color: d.color }}>{d.label}</span>
                      <span className="text-slate-400">— {d.desc}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-slate-400">Click a cell to cycle levels. AI cells can be overridden. Save when done.</p>
              <div className="flex items-center gap-2">
                {aiGenerating ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#F5A800]" />
                    <span className="text-xs text-slate-500">
                      Classifying {aiProgress?.processed ?? 0} / {aiProgress?.total ?? "…"} modules…
                    </span>
                    {aiProgress && aiProgress.total > 0 && (
                      <div className="w-32 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${Math.round((aiProgress.processed / aiProgress.total) * 100)}%`, backgroundColor: "#F5A800" }}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1.5 border-[#F5A800] text-[#F5A800] hover:bg-[#F5A800]/10"
                      onClick={() => startAiClassify(false)}
                    >
                      {isAdmin ? <Sparkles className="h-3 w-3" /> : <Lock className="h-3 w-3 opacity-70" />}
                      Auto-classify with AI
                    </Button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600"
                          onClick={() => startAiClassify(true)}
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-white border border-slate-200 shadow-md text-slate-700">
                        <p className="text-xs">Re-classify all modules with AI (overwrites existing AI classifications)</p>
                      </TooltipContent>
                    </Tooltip>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Classification table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              {isGrouped ? (
                /* GreenComp grouped table */
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50">
                      <th className="text-left px-4 py-2.5 font-semibold text-slate-600 text-xs sticky left-0 bg-slate-50/95" rowSpan={2}>Module</th>
                      <th className="text-center px-2 py-2.5 font-semibold text-slate-500 text-xs w-14 sticky" rowSpan={2}>Stage</th>
                      {lens.areas!.map(area => (
                        <th
                          key={area.key}
                          colSpan={3}
                          className="text-center px-2 py-2 text-xs font-bold border-b border-slate-200"
                          style={{ color: area.color, borderLeft: `2px solid ${area.color}33` }}
                        >
                          <div className="flex items-center justify-center gap-1">
                            {(() => { const AI = area.icon; return <AI className="h-3 w-3" />; })()}
                            {area.label}
                          </div>
                        </th>
                      ))}
                    </tr>
                    <tr className="border-b border-slate-100 bg-slate-50/30">
                      {lens.domains.map(d => {
                        const area = lens.areas!.find(a => a.key === d.area);
                        return (
                          <th
                            key={d.key}
                            className="text-center px-2 py-2 font-medium text-[10px] uppercase tracking-wide whitespace-nowrap"
                            style={{ color: d.color, borderLeft: d.area !== lens.domains[lens.domains.indexOf(d) - 1]?.area ? `2px solid ${d.color}33` : undefined }}
                            title={d.desc}
                          >
                            {d.shortLabel}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {modules.map(pm => (
                      <tr key={pm.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 sticky left-0 bg-white">
                          <p className="text-xs font-mono font-semibold text-slate-700 whitespace-nowrap">{pm.module?.moduleCode}</p>
                          <p className="text-xs text-slate-500 max-w-[160px] truncate">{pm.module?.moduleTitle}</p>
                        </td>
                        <td className="text-center px-2 py-2.5 text-xs text-slate-400 whitespace-nowrap">{pm.stage ?? "—"}</td>
                        {lens.domains.map((d, di) => {
                          const cell = getCell(pm.moduleId, d.key);
                          const { bg, text, border } = levelStyle(cell.level, d.color, d.bg);
                          const isAi = cell.source === "ai";
                          const isInherited = cell.source === "inherited";
                          const prevDomain = lens.domains[di - 1];
                          const isAreaStart = !prevDomain || prevDomain.area !== d.area;
                          const btn = (
                            <button
                              onClick={() => setLevel(pm.moduleId, d.key, nextLevel(cell.level, activeLevels))}
                              className="relative inline-flex items-center justify-center w-full min-w-[72px] px-1.5 py-1 rounded border text-[10px] font-semibold transition-all hover:opacity-80 active:scale-95 gap-0.5"
                              style={{ backgroundColor: bg, color: text, borderColor: border }}
                            >
                              {isAi && <Sparkles className="h-2 w-2 opacity-60 shrink-0" />}
                              {isInherited && <Library className="h-2 w-2 opacity-50 shrink-0" />}
                              {cell.level[0]}
                            </button>
                          );
                          return (
                            <td
                              key={d.key}
                              className="text-center px-1.5 py-2.5"
                              style={{ borderLeft: isAreaStart ? `2px solid ${d.color}33` : undefined }}
                            >
                              {(isAi && cell.rationale) || isInherited ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>{btn}</TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[280px] bg-white border border-slate-200 shadow-md p-0 overflow-hidden" style={{ minWidth: 200 }}>
                                    <div className="px-3 py-2 border-b border-slate-100" style={{ backgroundColor: `${d.color}10` }}>
                                      <p className="text-xs font-semibold" style={{ color: d.color }}>
                                        {isInherited ? "Inherited from Module Catalogue" : `AI · ${d.label} · ${cell.level}`}
                                      </p>
                                    </div>
                                    {cell.rationale && (
                                      <div className="px-3 py-2">
                                        <p className="text-xs text-slate-600 leading-snug">{cell.rationale}</p>
                                      </div>
                                    )}
                                    <div className="px-3 py-1.5 border-t border-slate-50 bg-slate-50">
                                      <p className="text-[10px] text-slate-400">Click to override · Save to persist</p>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              ) : btn}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                /* GA standard table */
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">Module</th>
                      <th className="text-center px-3 py-3 font-semibold text-slate-500 text-xs w-16">Stage</th>
                      {lens.domains.map(d => {
                        const DIcon = d.icon;
                        return (
                          <th key={d.key} className="text-center px-4 py-3 font-semibold text-xs" style={{ color: d.color }}>
                            <div className="flex items-center justify-center gap-1"><DIcon className="h-3.5 w-3.5" />{d.label}</div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {modules.map(pm => (
                      <tr key={pm.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <p className="text-xs font-mono font-semibold text-slate-700">{pm.module?.moduleCode}</p>
                          <p className="text-xs text-slate-500 max-w-[200px] truncate">{pm.module?.moduleTitle}</p>
                        </td>
                        <td className="text-center px-3 py-3 text-xs text-slate-400">{pm.stage ?? "—"}</td>
                        {lens.domains.map(d => {
                          const cell = getCell(pm.moduleId, d.key);
                          const { bg, text, border } = levelStyle(cell.level, d.color, d.bg);
                          const isAi = cell.source === "ai";
                          const isInherited = cell.source === "inherited";
                          const btn = (
                            <button
                              onClick={() => setLevel(pm.moduleId, d.key, nextLevel(cell.level, activeLevels))}
                              className="relative inline-flex items-center justify-center min-w-[100px] px-2 py-1.5 rounded-md border text-xs font-semibold transition-all hover:opacity-80 active:scale-95 gap-1"
                              style={{
                                backgroundColor: bg, color: text,
                                borderColor: isInherited ? `${border}` : border,
                                opacity: isInherited && cell.level === "None" ? 0.7 : 1,
                              }}
                            >
                              {isAi && <Sparkles className="h-2.5 w-2.5 opacity-60 shrink-0" />}
                              {isInherited && <Library className="h-2.5 w-2.5 opacity-50 shrink-0" />}
                              {cell.level}
                            </button>
                          );
                          return (
                            <td key={d.key} className="text-center px-4 py-3">
                              {(isAi && cell.rationale) || isInherited ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>{btn}</TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[300px] bg-white border border-slate-200 shadow-md p-0 overflow-hidden" style={{ minWidth: 220 }}>
                                    {isInherited ? (
                                      <>
                                        <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
                                          <div className="flex items-center gap-1.5">
                                            <Library className="h-3 w-3 text-slate-400" />
                                            <p className="text-xs font-semibold text-slate-600">Inherited from Module Catalogue</p>
                                          </div>
                                        </div>
                                        <div className="px-3 py-2">
                                          <p className="text-xs text-slate-500">
                                            {cell.level === "None"
                                              ? "The catalogue has no classification for this domain yet. Click to set a programme-specific level."
                                              : `This level was set in the Module Catalogue and carries over automatically. Click to override for this programme only.`}
                                          </p>
                                        </div>
                                        {cell.rationale && (
                                          <div className="px-3 pb-2 text-xs text-slate-500 italic border-t border-slate-50 pt-2 leading-snug">
                                            {cell.rationale}
                                          </div>
                                        )}
                                        <div className="px-3 py-1.5 border-t border-slate-50 bg-slate-50">
                                          <p className="text-[10px] text-slate-400">Click to set a programme-specific override · Save to persist</p>
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <div className="px-3 py-2 border-b border-slate-100" style={{ backgroundColor: `${d.color}10` }}>
                                          <p className="text-xs font-semibold" style={{ color: d.color }}>
                                            AI suggestion · {d.label} · {cell.level}
                                          </p>
                                        </div>
                                        <div className="px-3 py-2">
                                          <p className="text-xs text-slate-600 leading-snug">{cell.rationale}</p>
                                        </div>
                                        {cell.evidence && cell.evidence.length > 0 && (
                                          <div className="px-3 pb-2.5 space-y-1.5 border-t border-slate-50 pt-2">
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Evidence</p>
                                            {cell.evidence.map((ev, i) => (
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
                                        <div className="px-3 py-1.5 border-t border-slate-50 bg-slate-50">
                                          <p className="text-[10px] text-slate-400">Click to override · Manual edits are preserved</p>
                                        </div>
                                      </>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              ) : btn}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50 gap-3 flex-wrap">
              <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                <span className="flex items-center gap-1">
                  <Library className="h-3 w-3" /> Inherited from Module Catalogue — hover for details
                </span>
                <span className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-[#F5A800]" /> AI-generated — click to override
                </span>
              </div>
              <Button onClick={save} disabled={!dirty || saving} style={{ backgroundColor: "#003865" }} className="text-white">
                {saving ? "Saving…" : dirty ? "Save Classifications" : <><Check className="h-3.5 w-3.5 mr-1.5" />Saved</>}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Map View ──────────────────────────────────────────────────────────────────
function MapView({ prog, selectedLens, apiLens, onLensChange }: { prog: Programme; selectedLens: string; apiLens: string; onLensChange: (l: string) => void }) {
  const modules: PmRow[] = [...(prog.modules ?? [])].sort((a, b) => a.orderIndex - b.orderIndex);
  const classifications: GaRow[] = prog.classifications ?? [];
  const lens = LENSES.find(l => l.key === selectedLens) ?? LENSES[0];
  const isGrouped = !!lens.areas && lens.areas.length > 0;

  const getLevel = (moduleId: number, domain: string): Level => {
    const found = classifications.find(c => c.moduleId === moduleId && c.domain === domain);
    return (found?.level ?? "None") as Level;
  };

  if (modules.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center space-y-2">
        <BookOpen className="h-8 w-8 text-slate-300 mx-auto" />
        <p className="text-slate-500 font-medium">No modules in programme yet</p>
        <p className="text-xs text-slate-400">Go to the Build tab to add modules first.</p>
      </div>
    );
  }

  const presentStages = STAGES.filter(s => modules.some(m => m.stage === s));
  const unstaged = modules.filter(m => !m.stage);
  if (unstaged.length) presentStages.push("Unassigned");

  const modsInStage = (stage: string) =>
    stage === "Unassigned" ? unstaged : modules.filter(m => m.stage === stage);

  const narrative = useMemo(
    () => generateNarrative(modules, classifications, lens),
    [modules, classifications, lens]
  );

  // Build dot items per module — for GA: 3 domains; for GreenComp/EC: areas (max level per area)
  const mapLevels = lens.apiLens === "entrecomp" ? EC_LEVELS : LEVELS;
  function getDotItems(pm: PmRow) {
    if (isGrouped) {
      return lens.areas!.map(area => {
        const levels = area.competenceKeys.map(k => LEVEL_ORDER[getLevel(pm.moduleId, k)] ?? 0);
        const maxIdx = Math.max(...levels);
        return { key: area.key, label: area.label, shortKey: area.shortLabel[0], color: area.color, level: mapLevels[maxIdx] as Level };
      });
    }
    return lens.domains.map(d => ({
      key: d.key, label: d.label, shortKey: d.key[0], color: d.color, level: getLevel(pm.moduleId, d.key),
    }));
  }

  return (
    <div className="space-y-5">
      {/* Lens selector */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
        <p className="text-sm font-semibold" style={{ color: "#003865" }}>Select lens</p>
        <div className="flex flex-wrap gap-2">
          {LENSES.map(l => (
            <button
              key={l.key}
              onClick={() => l.available && onLensChange(l.key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
                l.available
                  ? selectedLens === l.key
                    ? "border-[#003865] bg-[#003865] text-white"
                    : "border-slate-200 hover:border-[#003865] text-slate-700"
                  : "border-slate-100 text-slate-300 cursor-default"
              )}
            >
              {l.label}
              {!l.available && <span className="ml-1.5 text-[10px] bg-slate-100 text-slate-400 px-1 rounded">soon</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap gap-5 text-xs items-center">
          <div className="flex gap-3">
            {isGrouped
              ? lens.areas!.map(area => {
                  const AI = area.icon;
                  return (
                    <div key={area.key} className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: area.color }}>
                        <AI className="h-3 w-3 text-white" />
                      </div>
                      <span className="font-semibold" style={{ color: area.color }}>{area.label}</span>
                    </div>
                  );
                })
              : lens.domains.map(d => {
                  const DIcon = d.icon;
                  return (
                    <div key={d.key} className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: d.color }}>
                        <DIcon className="h-3 w-3 text-white" />
                      </div>
                      <span className="font-semibold" style={{ color: d.color }}>{d.label}</span>
                    </div>
                  );
                })
            }
          </div>
          <div className="border-l border-slate-200 pl-5 flex gap-4 text-slate-500">
            <span className="font-semibold text-slate-400">Border weight →</span>
            {mapLevels.filter(l => l !== "None").map(l => (
              <span key={l}><span className="font-semibold">{l[0]}</span> = {l}</span>
            ))}
            <span><span className="font-semibold text-slate-400">—</span> = None</span>
          </div>
        </div>
      </div>

      {/* Programme map grid */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold" style={{ color: "#003865" }}>Programme Map — {lens.label}</h2>
          <p className="text-xs text-slate-500 mt-0.5">Modules shown by year/stage. {isGrouped ? "Colour = GreenComp area (max level per area)." : "Colour = GA domain, border weight = engagement level."}</p>
        </div>
        <div className="p-5 space-y-6">
          {presentStages.map(stage => {
            const stageMods = modsInStage(stage);
            return (
              <div key={stage} className="programme-map-stage">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded" style={{ backgroundColor: "#003865", color: "#fff" }}>
                    {stage}
                  </span>
                  <span className="text-xs text-slate-400">{stageMods.length} module{stageMods.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {stageMods.map(pm => (
                    <ModuleMapCard key={pm.id} pm={pm} dotItems={getDotItems(pm)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Coverage counts */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold" style={{ color: "#003865" }}>Coverage Summary</h2>
          {isGrouped && <p className="text-xs text-slate-400 mt-0.5">Counts shown per GreenComp competence.</p>}
        </div>
        <div className="p-5 overflow-x-auto">
          {isGrouped ? (
            /* GreenComp competence counts per area */
            <div className="space-y-4">
              {lens.areas!.map(area => (
                <div key={area.key}>
                  <div className="flex items-center gap-2 mb-2">
                    {(() => { const AI = area.icon; return <AI className="h-3.5 w-3.5" style={{ color: area.color }} />; })()}
                    <span className="text-xs font-bold" style={{ color: area.color }}>{area.label}</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-2 text-xs font-semibold text-slate-500 pr-6">Competence</th>
                        {LEVELS.map(l => (
                          <th key={l} className="text-center py-2 px-3 text-xs font-semibold text-slate-500">{l}</th>
                        ))}
                        <th className="text-center py-2 px-3 text-xs font-semibold text-slate-500">Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lens.domains.filter(d => d.area === area.key).map(d => {
                        const rows = classifications.filter(c => c.domain === d.key);
                        const counts: Record<string, number> = { None: 0, Developing: 0, Consolidating: 0, Leading: 0, Foundation: 0, Intermediate: 0, Advanced: 0 };
                        for (const r of rows) counts[r.level] = (counts[r.level] ?? 0) + 1;
                        counts.None += modules.filter(m => !rows.find(r => r.moduleId === m.moduleId)).length;
                        const active = modules.length - counts.None;
                        return (
                          <tr key={d.key} className="border-b border-slate-50">
                            <td className="py-2 pr-6 text-xs font-medium text-slate-700">{d.label}</td>
                            {mapLevels.map(l => {
                              const { bg, text, border } = levelStyle(l, area.color, area.bg);
                              return (
                                <td key={l} className="text-center py-2 px-3">
                                  <span className="inline-flex items-center justify-center w-8 h-6 rounded text-xs font-bold border" style={{ backgroundColor: bg, color: text, borderColor: border }}>
                                    {counts[l] ?? 0}
                                  </span>
                                </td>
                              );
                            })}
                            <td className="text-center py-2 px-3">
                              <span className="text-xs font-semibold" style={{ color: active > 0 ? area.color : "#94a3b8" }}>
                                {active}/{modules.length}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ) : (
            /* GA coverage table */
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 text-xs font-semibold text-slate-500 pr-6">Domain</th>
                  {LEVELS.map(l => (
                    <th key={l} className="text-center py-2 px-4 text-xs font-semibold text-slate-500">{l}</th>
                  ))}
                  <th className="text-center py-2 px-4 text-xs font-semibold text-slate-500">Active</th>
                </tr>
              </thead>
              <tbody>
                {lens.domains.map(d => {
                  const rows = classifications.filter(c => c.domain === d.key);
                  const counts: Record<string, number> = { None: 0, Developing: 0, Consolidating: 0, Leading: 0 };
                  for (const r of rows) counts[r.level] = (counts[r.level] ?? 0) + 1;
                  counts.None += modules.filter(m => !rows.find(r => r.moduleId === m.moduleId)).length;
                  const active = modules.length - counts.None;
                  const DIcon = d.icon;
                  return (
                    <tr key={d.key} className="border-b border-slate-50">
                      <td className="py-3 pr-6">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: d.color }}>
                            <DIcon className="h-3 w-3 text-white" />
                          </div>
                          <span className="font-semibold text-xs" style={{ color: d.color }}>{d.label}</span>
                        </div>
                      </td>
                      {LEVELS.map(l => {
                        const { bg, text, border } = levelStyle(l as Level, d.color, d.bg);
                        return (
                          <td key={l} className="text-center py-3 px-4">
                            <span className="inline-flex items-center justify-center w-8 h-7 rounded text-xs font-bold border" style={{ backgroundColor: bg, color: text, borderColor: border }}>
                              {counts[l as Level] ?? 0}
                            </span>
                          </td>
                        );
                      })}
                      <td className="text-center py-3 px-4">
                        <span className="text-xs font-semibold" style={{ color: active > 0 ? d.color : "#94a3b8" }}>
                          {active}/{modules.length}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Narrative */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold" style={{ color: "#003865" }}>Narrative Summary</h2>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">Draft — for team discussion</span>
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
    </div>
  );
}

// ── Module Map Card ────────────────────────────────────────────────────────────
interface DotItem { key: string; label: string; shortKey: string; color: string; level: Level }

function ModuleMapCard({ pm, dotItems }: { pm: PmRow; dotItems: DotItem[] }) {
  const activeDots = dotItems.filter(d => d.level !== "None");

  const topLevel = activeDots.reduce<Level>((best, d) => {
    return LEVEL_ORDER[d.level] > LEVEL_ORDER[best] ? d.level : best;
  }, "None");

  const borderColor = activeDots.length === 0
    ? "#e2e8f0"
    : activeDots.length === 1
      ? activeDots[0].color
      : "#F5A800";

  const topLevelOrder = LEVEL_ORDER[topLevel] ?? 0;
  const borderStyle = topLevelOrder >= 3
    ? `3px solid ${borderColor}`
    : topLevelOrder === 2
      ? `2px solid ${borderColor}`
      : topLevelOrder === 1
        ? `2px dashed ${borderColor}`
        : `1px solid ${borderColor}`;

  return (
    <div
      className="rounded-lg p-2.5 bg-white flex flex-col gap-2"
      style={{ border: borderStyle, width: "120px", minHeight: "80px" }}
    >
      <div>
        <p className="text-[10px] font-mono font-bold text-slate-700 leading-tight">{pm.module?.moduleCode}</p>
        <p className="text-[10px] text-slate-500 leading-tight mt-0.5 line-clamp-2">{pm.module?.moduleTitle}</p>
      </div>
      <div className="flex gap-1 flex-wrap mt-auto">
        {dotItems.map(d => {
          if (d.level === "None") return null;
          return (
            <span
              key={d.key}
              title={`${d.label}: ${d.level}`}
              className="text-[9px] font-bold px-1 py-0.5 rounded"
              style={{ backgroundColor: d.color, color: "#fff" }}
            >
              {d.shortKey}{d.level[0]}
            </span>
          );
        })}
        {activeDots.length === 0 && <span className="text-[9px] text-slate-300 italic">none</span>}
      </div>
    </div>
  );
}
