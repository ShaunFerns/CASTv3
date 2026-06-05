import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Leaf, Handshake, Search, X, Sparkles, Pencil, Scale, Network, Eye, Zap, Loader2, RotateCcw, ChevronLeft, ChevronRight, Lock, Monitor, Share2, FileText, Shield, Lightbulb, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

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

// ── Domain / Lens Config ──────────────────────────────────────────────────────
interface DomainConfig { key: string; label: string; shortLabel: string; icon: LucideIcon; color: string; bg: string; desc: string; area?: string }
interface AreaConfig   { key: string; label: string; shortLabel: string; icon: LucideIcon; color: string; bg: string; competenceKeys: string[] }

const GA_DOMAINS: DomainConfig[] = [
  { key: "People",      label: "People",      shortLabel: "People",  icon: Users,     color: "#c2185b", bg: "#fce4ec", desc: "Digital capability, reflective practice, lifelong learning" },
  { key: "Planet",      label: "Planet",      shortLabel: "Planet",  icon: Leaf,      color: "#388e3c", bg: "#e8f5e9", desc: "Sustainability, ethics, SDGs, futures thinking" },
  { key: "Partnership", label: "Partnership", shortLabel: "Partner", icon: Handshake, color: "#1565c0", bg: "#e3f2fd", desc: "Collaboration, co-creation, real-world engagement" },
];

const GC_AREAS: AreaConfig[] = [
  { key: "values",     label: "Embodying Values",          shortLabel: "Values",     icon: Scale,   color: "#0f766e", bg: "#f0fdfa", competenceKeys: ["ValuingSustainability","SupportingFairness","PromotingNature"] },
  { key: "complexity", label: "Embracing Complexity",      shortLabel: "Complexity", icon: Network, color: "#7c3aed", bg: "#faf5ff", competenceKeys: ["SystemsThinking","CriticalThinking","ProblemFraming"] },
  { key: "futures",    label: "Envisioning Futures",       shortLabel: "Futures",    icon: Eye,     color: "#1d4ed8", bg: "#eff6ff", competenceKeys: ["FuturesLiteracy","Adaptability","ExploratoryThinking"] },
  { key: "action",     label: "Acting for Sustainability", shortLabel: "Action",     icon: Zap,     color: "#b45309", bg: "#fffbeb", competenceKeys: ["PoliticalAgency","CollectiveAction","IndividualInitiative"] },
];

const GC_DOMAINS: DomainConfig[] = [
  { key: "ValuingSustainability", label: "Valuing Sustainability", shortLabel: "Valuing",    icon: Scale,   color: "#0f766e", bg: "#f0fdfa", area: "values",     desc: "Sustainability values, ethics, worldviews" },
  { key: "SupportingFairness",    label: "Supporting Fairness",    shortLabel: "Fairness",   icon: Scale,   color: "#0f766e", bg: "#f0fdfa", area: "values",     desc: "Equity, justice, intergenerational responsibility" },
  { key: "PromotingNature",       label: "Promoting Nature",       shortLabel: "Nature",     icon: Leaf,    color: "#0f766e", bg: "#f0fdfa", area: "values",     desc: "Human-nature connection, biodiversity" },
  { key: "SystemsThinking",       label: "Systems Thinking",       shortLabel: "Systems",    icon: Network, color: "#7c3aed", bg: "#faf5ff", area: "complexity", desc: "Holistic, interconnected systems-level thinking" },
  { key: "CriticalThinking",      label: "Critical Thinking",      shortLabel: "Critical",   icon: Network, color: "#7c3aed", bg: "#faf5ff", area: "complexity", desc: "Scrutiny of assumptions, evidence evaluation" },
  { key: "ProblemFraming",        label: "Problem Framing",        shortLabel: "Framing",    icon: Network, color: "#7c3aed", bg: "#faf5ff", area: "complexity", desc: "Define and interpret sustainability challenges" },
  { key: "FuturesLiteracy",       label: "Futures Literacy",       shortLabel: "Futures",    icon: Eye,     color: "#1d4ed8", bg: "#eff6ff", area: "futures",    desc: "Possible/preferred future scenarios" },
  { key: "Adaptability",          label: "Adaptability",           shortLabel: "Adapt",      icon: Eye,     color: "#1d4ed8", bg: "#eff6ff", area: "futures",    desc: "Uncertainty, resilience, adaptive decision-making" },
  { key: "ExploratoryThinking",   label: "Exploratory Thinking",   shortLabel: "Explore",    icon: Eye,     color: "#1d4ed8", bg: "#eff6ff", area: "futures",    desc: "Creative, transdisciplinary, experimental thinking" },
  { key: "PoliticalAgency",       label: "Political Agency",       shortLabel: "Agency",     icon: Zap,     color: "#b45309", bg: "#fffbeb", area: "action",     desc: "Civic, policy, advocacy, accountability" },
  { key: "CollectiveAction",      label: "Collective Action",      shortLabel: "Collective", icon: Zap,     color: "#b45309", bg: "#fffbeb", area: "action",     desc: "Collaboration for shared sustainability goals" },
  { key: "IndividualInitiative",  label: "Individual Initiative",  shortLabel: "Initiative", icon: Zap,     color: "#b45309", bg: "#fffbeb", area: "action",     desc: "Personal responsibility, proactive contribution" },
];

const DC_AREAS: AreaConfig[] = [
  { key: "info",    label: "Information",    shortLabel: "Info",    icon: Search,    color: "#1e40af", bg: "#eff6ff", competenceKeys: ["BrowsingInfo","EvaluatingInfo","ManagingInfo"] },
  { key: "comm",    label: "Communication",  shortLabel: "Comm",    icon: Share2,    color: "#7c3aed", bg: "#faf5ff", competenceKeys: ["Interacting","Sharing","Citizenship","Collaborating","DigitalBehaviour","ManagingIdentity"] },
  { key: "content", label: "Content",        shortLabel: "Content", icon: FileText,  color: "#0d9488", bg: "#f0fdfa", competenceKeys: ["DevelopingContent","IntegratingContent","CopyrightLicences","ComputationalThinking"] },
  { key: "safety",  label: "Safety",         shortLabel: "Safety",  icon: Shield,    color: "#be123c", bg: "#fff1f2", competenceKeys: ["ProtectingDevices","ProtectingData","SupportingWellbeing","EnvironmentalImpact"] },
  { key: "problem", label: "Problem-solving", shortLabel: "Problem", icon: Lightbulb, color: "#b45309", bg: "#fffbeb", competenceKeys: ["SolvingTechnical","IdentifyingNeeds","CreativeSolutions","AddressingCompetenceGaps"] },
];

const DC_DOMAINS: DomainConfig[] = [
  { key: "BrowsingInfo",             label: "Browsing & searching",    shortLabel: "Browsing",   icon: Search,    color: "#1e40af", bg: "#eff6ff", area: "info",    desc: "Search, locate and retrieve digital content; judge relevance." },
  { key: "EvaluatingInfo",           label: "Evaluating information",  shortLabel: "Evaluating", icon: Search,    color: "#1e40af", bg: "#eff6ff", area: "info",    desc: "Critically evaluate digital sources for credibility." },
  { key: "ManagingInfo",             label: "Managing information",    shortLabel: "Managing",   icon: Search,    color: "#1e40af", bg: "#eff6ff", area: "info",    desc: "Store, organise and analyse digital data." },
  { key: "Interacting",              label: "Interacting digitally",   shortLabel: "Interact",   icon: Share2,    color: "#7c3aed", bg: "#faf5ff", area: "comm",    desc: "Interact with others using digital tools." },
  { key: "Sharing",                  label: "Sharing digitally",       shortLabel: "Sharing",    icon: Share2,    color: "#7c3aed", bg: "#faf5ff", area: "comm",    desc: "Share data, information and digital content." },
  { key: "Citizenship",              label: "Digital citizenship",     shortLabel: "Citizen",    icon: Share2,    color: "#7c3aed", bg: "#faf5ff", area: "comm",    desc: "Participate in society through digital technologies." },
  { key: "Collaborating",            label: "Collaborating digitally", shortLabel: "Collab",     icon: Share2,    color: "#7c3aed", bg: "#faf5ff", area: "comm",    desc: "Use digital tools for collaborative processes." },
  { key: "DigitalBehaviour",         label: "Digital behaviour",       shortLabel: "Behaviour",  icon: Share2,    color: "#7c3aed", bg: "#faf5ff", area: "comm",    desc: "Norms of online communities; cultural diversity." },
  { key: "ManagingIdentity",         label: "Digital identity",        shortLabel: "Identity",   icon: Share2,    color: "#7c3aed", bg: "#faf5ff", area: "comm",    desc: "Create and manage digital identities; data protection." },
  { key: "DevelopingContent",        label: "Developing content",      shortLabel: "Develop",    icon: FileText,  color: "#0d9488", bg: "#f0fdfa", area: "content", desc: "Create and edit digital content in various formats." },
  { key: "IntegratingContent",       label: "Integrating content",     shortLabel: "Integrate",  icon: FileText,  color: "#0d9488", bg: "#f0fdfa", area: "content", desc: "Modify and integrate content; understand copyright." },
  { key: "CopyrightLicences",        label: "Copyright & licences",    shortLabel: "Copyright",  icon: FileText,  color: "#0d9488", bg: "#f0fdfa", area: "content", desc: "Apply copyright and open licences to digital content." },
  { key: "ComputationalThinking",    label: "Computational thinking",  shortLabel: "Compute",    icon: FileText,  color: "#0d9488", bg: "#f0fdfa", area: "content", desc: "Algorithmic and computational thinking; programming." },
  { key: "ProtectingDevices",        label: "Protecting devices",      shortLabel: "Devices",    icon: Shield,    color: "#be123c", bg: "#fff1f2", area: "safety",  desc: "Protect devices and digital content from risks." },
  { key: "ProtectingData",           label: "Protecting data",         shortLabel: "Privacy",    icon: Shield,    color: "#be123c", bg: "#fff1f2", area: "safety",  desc: "Protect personal data and privacy online." },
  { key: "SupportingWellbeing",      label: "Supporting wellbeing",    shortLabel: "Wellbeing",  icon: Shield,    color: "#be123c", bg: "#fff1f2", area: "safety",  desc: "Avoid health risks; balance digital and physical worlds." },
  { key: "EnvironmentalImpact",      label: "Environmental impact",    shortLabel: "Environ",    icon: Shield,    color: "#be123c", bg: "#fff1f2", area: "safety",  desc: "Environmental impact of digital technologies." },
  { key: "SolvingTechnical",         label: "Solving technical issues", shortLabel: "Technical",  icon: Lightbulb, color: "#b45309", bg: "#fffbeb", area: "problem", desc: "Identify and resolve technical problems with devices." },
  { key: "IdentifyingNeeds",         label: "Identifying needs",       shortLabel: "Needs",      icon: Lightbulb, color: "#b45309", bg: "#fffbeb", area: "problem", desc: "Assess needs and identify digital technological responses." },
  { key: "CreativeSolutions",        label: "Creative solutions",      shortLabel: "Creative",   icon: Lightbulb, color: "#b45309", bg: "#fffbeb", area: "problem", desc: "Innovate processes using digital technologies creatively." },
  { key: "AddressingCompetenceGaps", label: "Competence gaps",         shortLabel: "Self-dev",   icon: Lightbulb, color: "#b45309", bg: "#fffbeb", area: "problem", desc: "Identify and address digital competence development needs." },
];

const EC_AREAS: AreaConfig[] = [
  { key: "ideas",     label: "Ideas & Opportunities", shortLabel: "Ideas",     color: "#d97706", bg: "#fffbeb", icon: Eye,       competenceKeys: ["SpottingOpportunities","Creativity","Vision","ValuingIdeas","EthicalSustainableThinking"] },
  { key: "resources", label: "Resources",              shortLabel: "Resources", color: "#7c3aed", bg: "#faf5ff", icon: Scale,     competenceKeys: ["SelfAwareness","Motivation","MobilisingResources","FinancialLiteracy","MobilisingOthers"] },
  { key: "action",    label: "Into Action",            shortLabel: "Action",    color: "#059669", bg: "#ecfdf5", icon: TrendingUp, competenceKeys: ["TakingInitiative","PlanningManagement","CopingWithUncertainty","WorkingWithOthers","LearningThroughExperience"] },
];

const EC_DOMAINS: DomainConfig[] = [
  { key: "SpottingOpportunities",      label: "Spotting Opportunities",        shortLabel: "Spotting",    icon: Eye,       color: "#d97706", bg: "#fffbeb", area: "ideas",     desc: "Identifying valuable opportunities in challenging contexts" },
  { key: "Creativity",                  label: "Creativity",                   shortLabel: "Creativity",  icon: Eye,       color: "#d97706", bg: "#fffbeb", area: "ideas",     desc: "Developing original, valuable ideas to influence action" },
  { key: "Vision",                      label: "Vision",                       shortLabel: "Vision",      icon: Eye,       color: "#d97706", bg: "#fffbeb", area: "ideas",     desc: "Envisioning the future and imagining ambitious goals" },
  { key: "ValuingIdeas",                label: "Valuing Ideas",                shortLabel: "Valuing",     icon: Eye,       color: "#d97706", bg: "#fffbeb", area: "ideas",     desc: "Recognising the value and potential of ideas" },
  { key: "EthicalSustainableThinking",  label: "Ethical & Sustainable Thinking",shortLabel: "Ethical",   icon: Eye,       color: "#d97706", bg: "#fffbeb", area: "ideas",     desc: "Assessing the consequences of ideas on sustainability and ethics" },
  { key: "SelfAwareness",               label: "Self-Awareness",               shortLabel: "Self-Aware",  icon: Scale,     color: "#7c3aed", bg: "#faf5ff", area: "resources", desc: "Reflecting on personal strengths, weaknesses, values and agency" },
  { key: "Motivation",                  label: "Motivation & Perseverance",    shortLabel: "Motivation",  icon: Scale,     color: "#7c3aed", bg: "#faf5ff", area: "resources", desc: "Maintaining focus and drive despite setbacks" },
  { key: "MobilisingResources",         label: "Mobilising Resources",         shortLabel: "Resources",   icon: Scale,     color: "#7c3aed", bg: "#faf5ff", area: "resources", desc: "Gathering and managing the resources needed to create value" },
  { key: "FinancialLiteracy",           label: "Financial & Economic Literacy", shortLabel: "Financial",  icon: Scale,     color: "#7c3aed", bg: "#faf5ff", area: "resources", desc: "Understanding financial concepts and managing finances" },
  { key: "MobilisingOthers",            label: "Mobilising Others",            shortLabel: "Mobilising",  icon: Scale,     color: "#7c3aed", bg: "#faf5ff", area: "resources", desc: "Inspiring and leading others toward a shared purpose" },
  { key: "TakingInitiative",            label: "Taking the Initiative",        shortLabel: "Initiative",  icon: TrendingUp, color: "#059669", bg: "#ecfdf5", area: "action",   desc: "Proactively initiating processes and making decisions" },
  { key: "PlanningManagement",          label: "Planning & Management",        shortLabel: "Planning",    icon: TrendingUp, color: "#059669", bg: "#ecfdf5", area: "action",   desc: "Setting goals and planning how to achieve them" },
  { key: "CopingWithUncertainty",       label: "Coping with Uncertainty",      shortLabel: "Uncertainty", icon: TrendingUp, color: "#059669", bg: "#ecfdf5", area: "action",   desc: "Making decisions and acting in uncertain and ambiguous situations" },
  { key: "WorkingWithOthers",           label: "Working with Others",          shortLabel: "Teamwork",    icon: TrendingUp, color: "#059669", bg: "#ecfdf5", area: "action",   desc: "Teaming up, collaborating and networking for value creation" },
  { key: "LearningThroughExperience",   label: "Learning Through Experience",  shortLabel: "Learning",    icon: TrendingUp, color: "#059669", bg: "#ecfdf5", area: "action",   desc: "Learning from experience to improve continuously" },
];

const LEVELS = ["None", "Developing", "Consolidating", "Leading"] as const;
const EC_LEVELS = ["None", "Foundation", "Intermediate", "Advanced"] as const;
type Level = "None" | "Developing" | "Consolidating" | "Leading" | "Foundation" | "Intermediate" | "Advanced";

function nextLevel(l: string, levels: readonly string[] = LEVELS): Level {
  const i = levels.indexOf(l);
  return levels[(i + 1) % levels.length] as Level;
}

function levelBadgeClass(level: string, color: string, bg: string) {
  if (level === "None")                                      return { bg: "#f8fafc", text: "#64748b", border: "#e2e8f0" };
  if (level === "Developing"    || level === "Foundation")  return { bg,             text: color,     border: `${color}55` };
  if (level === "Consolidating" || level === "Intermediate")return { bg: `${color}18`, text: color,   border: `${color}88` };
  return { bg: color, text: "#fff", border: color };
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface GaEvidenceItem { field: string; snippet: string; weight: "primary" | "secondary" }
interface GaSummary      { domain: string; level: Level; source?: string; rationale?: string; evidence?: string }

function parseEvidence(raw?: string): GaEvidenceItem[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as GaEvidenceItem[]; } catch { return []; }
}

interface CatalogueModule {
  id: number;
  moduleCode: string;
  moduleTitle: string;
  stageInferred: string | null;
  campus: string | null;
  disciplineFamily: string | null;
  gaClassifications: GaSummary[];
  programmeCount: number;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ModuleCatalogue() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [activeLens, setActiveLens] = useState<"ga" | "greencomp" | "digcomp" | "entrecomp">("ga");
  const [search, setSearch]                   = useState("");
  const [levelFilter, setLevelFilter]         = useState<string>("all");
  const [domainFilter, setDomainFilter]       = useState<string>("all");
  const [classifiedFilter, setClassifiedFilter] = useState<string>("all");
  const [campusFilter, setCampusFilter]       = useState<string>("all");
  const [pending, setPending]                 = useState<Record<string, Level>>({});
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress]     = useState<{ total: number; processed: number } | null>(null);

  const currentDomains = activeLens === "ga" ? GA_DOMAINS : activeLens === "digcomp" ? DC_DOMAINS : activeLens === "entrecomp" ? EC_DOMAINS : GC_DOMAINS;

  const { data: modules = [], isLoading } = useQuery<CatalogueModule[]>({
    queryKey: ["module-catalogue", activeLens],
    queryFn: () => apiFetch(`/module-catalogue?lens=${activeLens}`),
  });

  const { mutate: patchGa } = useMutation({
    mutationFn: ({ moduleId, domain, level }: { moduleId: number; domain: string; level: Level }) =>
      apiFetch(`/module-catalogue/${moduleId}/ga`, {
        method: "PATCH",
        body: JSON.stringify({ domain, level, lens: activeLens }),
      }),
    onSuccess: (_data, vars) => {
      setPending(p => { const next = { ...p }; delete next[`${vars.moduleId}-${vars.domain}`]; return next; });
      qc.invalidateQueries({ queryKey: ["module-catalogue", activeLens] });
      qc.invalidateQueries({ queryKey: ["pm-programme"] });
    },
  });

  function handleChipClick(moduleId: number, domain: string, currentLevel: Level) {
    if (!isAdmin) {
      toast({ variant: "destructive", title: "Admin access required", description: "Sign in as admin to edit classifications." });
      return;
    }
    const levels = activeLens === "entrecomp" ? EC_LEVELS : LEVELS;
    const next = nextLevel(currentLevel, levels);
    setPending(p => ({ ...p, [`${moduleId}-${domain}`]: next }));
    patchGa({ moduleId, domain, level: next });
  }

  function getDisplayLevel(m: CatalogueModule, domainKey: string) {
    const pendingKey = `${m.id}-${domainKey}`;
    const ga = m.gaClassifications.find(g => g.domain === domainKey);
    const level = (pending[pendingKey] ?? ga?.level ?? "None") as Level;
    return { level, source: pending[pendingKey] ? "user" : ga?.source, ga };
  }

  // ── Batch classify ──────────────────────────────────────────────────────────
  async function startBatchClassify(force = false) {
    if (!isAdmin) {
      toast({ variant: "destructive", title: "Admin access required", description: "Sign in as admin to run AI classification." });
      return;
    }
    try {
      const r = await apiFetch<{ started: boolean; message: string }>(
        `/module-catalogue/${activeLens}/batch-classify`,
        { method: "POST", body: JSON.stringify({ force }) }
      );
      if (r.started) {
        setBatchGenerating(true);
        setBatchProgress({ total: 0, processed: 0 });
        const interval = setInterval(async () => {
          try {
            const s = await apiFetch<{ total: number; processed: number; generating: boolean }>(
              `/module-catalogue/${activeLens}/batch-classify/status`
            );
            setBatchProgress({ total: s.total, processed: s.processed });
            if (!s.generating) {
              clearInterval(interval);
              setBatchGenerating(false);
              setBatchProgress(null);
              qc.invalidateQueries({ queryKey: ["module-catalogue", activeLens] });
            }
          } catch { /* ignore polling errors */ }
        }, 2000);
      } else {
        toast({ title: "Nothing to do", description: r.message });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Classification failed", description: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  // ── Filters ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return modules.filter(m => {
      if (search) {
        const q = search.toLowerCase();
        if (!m.moduleCode.toLowerCase().includes(q) && !m.moduleTitle.toLowerCase().includes(q)) return false;
      }
      if (campusFilter !== "all" && m.campus !== campusFilter) return false;
      if (classifiedFilter === "classified"   && m.gaClassifications.every(g => g.level === "None")) return false;
      if (classifiedFilter === "unclassified" && m.gaClassifications.some(g => g.level !== "None"))  return false;
      const dom = domainFilter !== "all" ? domainFilter : null;
      const lev = levelFilter  !== "all" ? levelFilter  : null;
      if (dom && lev) {
        const ga = m.gaClassifications.find(g => g.domain === dom);
        if (!ga || ga.level !== lev) return false;
      } else if (dom) {
        const ga = m.gaClassifications.find(g => g.domain === dom);
        if (!ga || ga.level === "None") return false;
      } else if (lev) {
        if (!m.gaClassifications.some(g => g.level === lev)) return false;
      }
      return true;
    });
  }, [modules, search, levelFilter, domainFilter, classifiedFilter, campusFilter]);

  // ── Stat cards ──────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (activeLens === "ga") {
      return GA_DOMAINS.map(d => {
        const active = modules.filter(m => {
          const ga = m.gaClassifications.find(g => g.domain === d.key);
          return ga && ga.level !== "None";
        }).length;
        const pct = modules.length > 0 ? Math.round((active / modules.length) * 100) : 0;
        return { key: d.key, label: d.label, icon: d.icon, color: d.color, bg: d.bg, active, pct };
      });
    }
    const areaSource = activeLens === "digcomp" ? DC_AREAS : activeLens === "entrecomp" ? EC_AREAS : GC_AREAS;
    return areaSource.map(area => {
      const active = modules.filter(m =>
        area.competenceKeys.some(k => {
          const gc = m.gaClassifications.find(g => g.domain === k);
          return gc && gc.level !== "None";
        })
      ).length;
      const pct = modules.length > 0 ? Math.round((active / modules.length) * 100) : 0;
      return { key: area.key, label: area.label, icon: area.icon, color: area.color, bg: area.bg, active, pct };
    });
  }, [modules, activeLens]);

  const hasFilters = search || levelFilter !== "all" || domainFilter !== "all" || classifiedFilter !== "all" || campusFilter !== "all";

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => { setCurrentPage(1); }, [search, levelFilter, domainFilter, classifiedFilter, campusFilter, activeLens, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pagedFiltered = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safeCurrentPage, pageSize]);

  // ── Chip helper ─────────────────────────────────────────────────────────────
  function renderChip(m: CatalogueModule, d: DomainConfig) {
    const { level, source, ga } = getDisplayLevel(m, d.key);
    const isPending = Boolean(pending[`${m.id}-${d.key}`]);
    const isAi  = !isPending && source === "ai";
    const isUser = isPending || source === "user";
    const { bg, text, border } = levelBadgeClass(level, d.color, d.bg);
    const evidenceItems = isAi ? parseEvidence(ga?.evidence) : [];

    return (
      <Tooltip key={d.key}>
        <TooltipTrigger asChild>
          <button
            onClick={() => handleChipClick(m.id, d.key, level)}
            className="group relative inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-semibold transition-all hover:opacity-80 active:scale-95"
            style={{ backgroundColor: bg, color: text, borderColor: border }}
          >
            {isAi && <Sparkles className="h-2 w-2 opacity-70 shrink-0" />}
            {isUser && !isAi && <Pencil className="h-2 w-2 opacity-60 shrink-0" />}
            {level[0] === "N" ? "—" : level[0]}
            <span className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center w-3 h-3 bg-slate-600 text-white rounded-full text-[7px]">↻</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[280px] bg-white border border-slate-200 shadow-md p-0 overflow-hidden" style={{ minWidth: 190 }}>
          {isAi && ga?.rationale ? (
            <>
              <div className="px-3 py-2 border-b border-slate-100" style={{ backgroundColor: `${d.color}10` }}>
                <p className="text-xs font-semibold" style={{ color: d.color }}>AI · {d.label} · {level}</p>
              </div>
              <div className="px-3 py-2">
                <p className="text-xs text-slate-600 leading-snug">{ga.rationale}</p>
              </div>
              {evidenceItems.length > 0 && (
                <div className="px-3 pb-2.5 space-y-1 border-t border-slate-50 pt-1.5">
                  {evidenceItems.map((ev, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span className="shrink-0 mt-0.5 inline-flex items-center px-1 rounded text-[9px] font-bold uppercase"
                        style={{ backgroundColor: ev.weight === "primary" ? `${d.color}18` : "#f1f5f9", color: ev.weight === "primary" ? d.color : "#94a3b8" }}>
                        {ev.weight === "primary" ? "●" : "○"} {ev.field}
                      </span>
                      <p className="text-[10px] text-slate-500 leading-tight italic">"{ev.snippet}"</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100">
                <p className="text-[10px] text-slate-400">Click to override · cycles through levels</p>
              </div>
            </>
          ) : (
            <div className="px-3 py-2">
              <p className="text-xs text-slate-500">{isUser ? "Manually set" : "Not yet classified"} · {d.label}: {level}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Click to change level</p>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#003865" }}>Module Catalogue</h1>
          <p className="text-slate-500 mt-1">All modules with curriculum lens classifications.</p>
          {!isLoading && modules.length > 0 && (
            <p className="text-xs text-slate-400 mt-1">Total: <span className="font-medium text-slate-500">{modules.length}</span> modules</p>
          )}
        </div>
        {/* AI batch-classify controls */}
        <div className="flex items-center gap-2 shrink-0">
          {batchGenerating ? (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#F5A800]" />
              <span>{batchProgress?.processed ?? 0} / {batchProgress?.total ?? "…"} classified</span>
              {batchProgress && batchProgress.total > 0 && (
                <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.round((batchProgress.processed / batchProgress.total) * 100)}%`, backgroundColor: "#F5A800" }} />
                </div>
              )}
            </div>
          ) : (
            <>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-[#F5A800] text-[#F5A800] hover:bg-[#F5A800]/10" onClick={() => startBatchClassify(false)}>
                {isAdmin ? <Sparkles className="h-3 w-3" /> : <Lock className="h-3 w-3 opacity-70" />}
                Auto-classify with AI
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-400" onClick={() => startBatchClassify(true)}>
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-white border border-slate-200 shadow-md text-slate-700">
                  <p className="text-xs">Re-classify all modules (overwrites existing AI classifications)</p>
                </TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
      </div>

      {/* Lens tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {([
          { key: "ga",        label: "Graduate Attributes" },
          { key: "greencomp", label: "GreenComp" },
          { key: "digcomp",   label: "DigComp 3.0" },
          { key: "entrecomp", label: "EntreComp" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setActiveLens(key); setDomainFilter("all"); setLevelFilter("all"); }}
            className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 ${
              activeLens === key
                ? "border-[#003865] text-[#003865] bg-white"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Stat cards */}
      {!isLoading && modules.length > 0 && (
        <div className={`grid gap-4 ${activeLens === "ga" ? "grid-cols-1 md:grid-cols-3" : activeLens === "digcomp" ? "grid-cols-2 md:grid-cols-5" : activeLens === "entrecomp" ? "grid-cols-1 md:grid-cols-3" : "grid-cols-2 md:grid-cols-4"}`}>
          {stats.map(({ key, label, icon: Icon, color, bg, active, pct }) => (
            <Card key={key} className="shadow-sm border-slate-200">
              <CardHeader className="pb-1.5 pt-4 px-4">
                <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Icon className="h-3 w-3" style={{ color }} />
                  {label}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold" style={{ color }}>{active}</span>
                  <span className="text-xs text-slate-400 pb-0.5">of {modules.length} ({pct}%)</span>
                </div>
                <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by code or title..." className="pl-9 pr-8 bg-slate-50" />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="w-full sm:w-[200px]">
          <Select value={domainFilter} onValueChange={setDomainFilter}>
            <SelectTrigger className="bg-slate-50">
              <SelectValue placeholder="All domains" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All domains</SelectItem>
              {currentDomains.map(d => <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-[160px]">
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="bg-slate-50">
              <SelectValue placeholder="All levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All levels</SelectItem>
              {(activeLens === "entrecomp" ? EC_LEVELS : LEVELS).map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-[180px]">
          <Select value={classifiedFilter} onValueChange={setClassifiedFilter}>
            <SelectTrigger className="bg-slate-50">
              <SelectValue placeholder="All modules" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All modules</SelectItem>
              <SelectItem value="classified">Classified only</SelectItem>
              <SelectItem value="unclassified">Unclassified only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-[180px]">
          <Select value={campusFilter} onValueChange={setCampusFilter}>
            <SelectTrigger className="bg-slate-50">
              <SelectValue placeholder="All campuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All campuses</SelectItem>
              <SelectItem value="Grangegorman">Grangegorman</SelectItem>
              <SelectItem value="Tallaght">Tallaght</SelectItem>
              <SelectItem value="Blanchardstown">Blanchardstown</SelectItem>
              <SelectItem value="Multiple">Multiple</SelectItem>
              <SelectItem value="Unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {hasFilters && (
          <button
            onClick={() => { setSearch(""); setLevelFilter("all"); setDomainFilter("all"); setClassifiedFilter("all"); setCampusFilter("all"); }}
            className="text-xs text-slate-400 hover:text-slate-600 underline whitespace-nowrap self-center"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Count row */}
      {!isLoading && modules.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing <span className="font-medium text-slate-700">{pagedFiltered.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1}–{Math.min(safeCurrentPage * pageSize, filtered.length)}</span> of{" "}
            <span className="font-medium text-slate-700">{filtered.length}</span>
            {filtered.length !== modules.length && <> (filtered from <span className="font-medium text-slate-700">{modules.length}</span>)</>}
            {" "}module{modules.length !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Per page:</span>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger className="w-[80px] h-8 text-sm bg-slate-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* ── GA Table ─────────────────────────────────────────────────────── */}
      {activeLens === "ga" && (
        <div className="border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                <TableHead className="font-semibold text-slate-700 w-8 text-center">#</TableHead>
                <TableHead className="font-semibold text-slate-700">Code</TableHead>
                <TableHead className="font-semibold text-slate-700">Title</TableHead>
                <TableHead className="font-semibold text-slate-700 text-center w-16">Progs</TableHead>
                {GA_DOMAINS.map(d => {
                  const DIcon = d.icon;
                  return (
                    <TableHead key={d.key} className="font-semibold text-center" style={{ color: d.color }}>
                      <div className="flex items-center justify-center gap-1"><DIcon className="h-3.5 w-3.5" />{d.label}</div>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="h-32 text-center text-slate-500">Loading modules…</TableCell></TableRow>
              ) : modules.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-32 text-center text-slate-500">No modules found. Upload modules via the Upload tab.</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-20 text-center text-sm text-slate-400">No modules match your filters.</TableCell></TableRow>
              ) : pagedFiltered.map((m, idx) => (
                <TableRow key={m.id} className="hover:bg-slate-50/50 transition-colors">
                  <TableCell className="text-center text-xs text-slate-300">{(safeCurrentPage - 1) * pageSize + idx + 1}</TableCell>
                  <TableCell className="font-medium text-slate-900"><span className="font-mono">{m.moduleCode}</span></TableCell>
                  <TableCell className="text-slate-600 max-w-[280px]">
                    <p className="truncate">{m.moduleTitle}</p>
                    {m.stageInferred && <p className="text-[11px] text-slate-400 mt-0.5">{m.stageInferred}</p>}
                  </TableCell>
                  <TableCell className="text-center">
                    {m.programmeCount > 0
                      ? <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: "#003865" }}>{m.programmeCount}</span>
                      : <span className="text-slate-300 text-sm">—</span>}
                  </TableCell>
                  {GA_DOMAINS.map(d => {
                    const { level, source, ga } = getDisplayLevel(m, d.key);
                    const isPending = Boolean(pending[`${m.id}-${d.key}`]);
                    const isAi  = !isPending && source === "ai";
                    const isUser = isPending || source === "user";
                    const { bg, text, border } = levelBadgeClass(level, d.color, d.bg);
                    const evidenceItems = isAi ? parseEvidence(ga?.evidence) : [];

                    return (
                      <TableCell key={d.key} className="text-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleChipClick(m.id, d.key, level)}
                              className="group relative inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-semibold transition-all hover:opacity-80 active:scale-95"
                              style={{ backgroundColor: bg, color: text, borderColor: border }}
                            >
                              {isAi && <Sparkles className="h-2.5 w-2.5 opacity-70 shrink-0" />}
                              {isUser && !isAi && <Pencil className="h-2.5 w-2.5 opacity-60 shrink-0" />}
                              {level}
                              <span className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center w-3.5 h-3.5 bg-slate-600 text-white rounded-full text-[8px]">↻</span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[300px] bg-white border border-slate-200 shadow-md p-0 overflow-hidden" style={{ minWidth: 200 }}>
                            {isAi && ga?.rationale ? (
                              <>
                                <div className="px-3 py-2 border-b border-slate-100" style={{ backgroundColor: `${d.color}10` }}>
                                  <p className="text-xs font-semibold" style={{ color: d.color }}>AI reviewed · {d.label} · {level}</p>
                                </div>
                                <div className="px-3 py-2"><p className="text-xs text-slate-600 leading-snug">{ga.rationale}</p></div>
                                {evidenceItems.length > 0 && (
                                  <div className="px-3 pb-2.5 space-y-1.5 border-t border-slate-50 pt-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Evidence</p>
                                    {evidenceItems.map((ev, i) => (
                                      <div key={i} className="flex items-start gap-1.5">
                                        <span className="shrink-0 mt-0.5 inline-flex items-center px-1 rounded text-[9px] font-bold uppercase"
                                          style={{ backgroundColor: ev.weight === "primary" ? `${d.color}18` : "#f1f5f9", color: ev.weight === "primary" ? d.color : "#94a3b8" }}>
                                          {ev.weight === "primary" ? "●" : "○"} {ev.field}
                                        </span>
                                        <p className="text-[11px] text-slate-500 leading-tight italic">"{ev.snippet}"</p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100">
                                  <p className="text-[10px] text-slate-400">Click to override · None → Developing → Consolidating → Leading</p>
                                </div>
                              </>
                            ) : (
                              <div className="px-3 py-2">
                                <p className="text-xs text-slate-500">{isUser ? "Manually set" : "Not yet classified"} · Click to change level</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">None → Developing → Consolidating → Leading</p>
                              </div>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── GreenComp Table ───────────────────────────────────────────────── */}
      {activeLens === "greencomp" && (
        <div className="border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                {/* Area header row */}
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="text-left px-3 py-3 font-semibold text-slate-700 text-xs sticky left-0 bg-slate-50/95" rowSpan={2}>#</th>
                  <th className="text-left px-3 py-3 font-semibold text-slate-700 text-xs sticky" rowSpan={2}>Code</th>
                  <th className="text-left px-3 py-3 font-semibold text-slate-700 text-xs" rowSpan={2}>Title</th>
                  <th className="text-center px-2 py-3 font-semibold text-slate-700 text-xs w-12" rowSpan={2}>Progs</th>
                  {GC_AREAS.map(area => (
                    <th
                      key={area.key}
                      colSpan={3}
                      className="text-center px-2 py-2 text-xs font-bold border-b border-slate-200"
                      style={{ color: area.color, borderLeft: `2px solid ${area.color}33` }}
                    >
                      <div className="flex items-center justify-center gap-1">
                        {(() => { const AI = area.icon; return <AI className="h-3 w-3" />; })()}
                        {area.shortLabel}
                      </div>
                    </th>
                  ))}
                </tr>
                {/* Competence sub-header row */}
                <tr className="border-b border-slate-100 bg-slate-50/30">
                  {GC_DOMAINS.map((d, di) => {
                    const prevD = GC_DOMAINS[di - 1];
                    const isAreaStart = !prevD || prevD.area !== d.area;
                    return (
                      <th
                        key={d.key}
                        className="text-center px-1 py-1.5 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap"
                        style={{ color: d.color, borderLeft: isAreaStart ? `2px solid ${d.color}33` : undefined }}
                        title={d.desc}
                      >
                        {d.shortLabel}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={4 + 12} className="h-32 text-center text-slate-500 text-sm">Loading modules…</td></tr>
                ) : modules.length === 0 ? (
                  <tr><td colSpan={4 + 12} className="h-32 text-center text-slate-500 text-sm">No modules found. Upload modules via the Upload tab.</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={4 + 12} className="h-20 text-center text-slate-400 text-sm">No modules match your filters.</td></tr>
                ) : pagedFiltered.map((m, idx) => (
                  <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="text-center px-3 py-2.5 text-xs text-slate-300">{(safeCurrentPage - 1) * pageSize + idx + 1}</td>
                    <td className="px-3 py-2.5 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">{m.moduleCode}</td>
                    <td className="px-3 py-2.5 text-slate-600 max-w-[200px]">
                      <p className="truncate text-xs">{m.moduleTitle}</p>
                      {m.stageInferred && <p className="text-[10px] text-slate-400">{m.stageInferred}</p>}
                    </td>
                    <td className="text-center px-2 py-2.5">
                      {m.programmeCount > 0
                        ? <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: "#003865" }}>{m.programmeCount}</span>
                        : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    {GC_DOMAINS.map((d, di) => {
                      const prevD = GC_DOMAINS[di - 1];
                      const isAreaStart = !prevD || prevD.area !== d.area;
                      return (
                        <td
                          key={d.key}
                          className="text-center px-1 py-2.5"
                          style={{ borderLeft: isAreaStart ? `2px solid ${d.color}22` : undefined }}
                        >
                          {renderChip(m, d)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── DigComp Table ─────────────────────────────────────────────────── */}
      {activeLens === "digcomp" && (
        <div className="border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                {/* Area header row */}
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="text-left px-3 py-3 font-semibold text-slate-700 text-xs sticky left-0 bg-slate-50/95" rowSpan={2}>#</th>
                  <th className="text-left px-3 py-3 font-semibold text-slate-700 text-xs sticky" rowSpan={2}>Code</th>
                  <th className="text-left px-3 py-3 font-semibold text-slate-700 text-xs" rowSpan={2}>Title</th>
                  <th className="text-center px-2 py-3 font-semibold text-slate-700 text-xs w-12" rowSpan={2}>Progs</th>
                  {DC_AREAS.map(area => (
                    <th
                      key={area.key}
                      colSpan={area.competenceKeys.length}
                      className="text-center px-2 py-2 text-xs font-bold border-b border-slate-200"
                      style={{ color: area.color, borderLeft: `2px solid ${area.color}33` }}
                    >
                      <div className="flex items-center justify-center gap-1">
                        {(() => { const AI = area.icon; return <AI className="h-3 w-3" />; })()}
                        {area.shortLabel}
                      </div>
                    </th>
                  ))}
                </tr>
                {/* Competence sub-header row */}
                <tr className="border-b border-slate-100 bg-slate-50/30">
                  {DC_DOMAINS.map((d, di) => {
                    const prevD = DC_DOMAINS[di - 1];
                    const isAreaStart = !prevD || prevD.area !== d.area;
                    return (
                      <th
                        key={d.key}
                        className="text-center px-1 py-1.5 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap"
                        style={{ color: d.color, borderLeft: isAreaStart ? `2px solid ${d.color}33` : undefined }}
                        title={d.desc}
                      >
                        {d.shortLabel}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={4 + 21} className="h-32 text-center text-slate-500 text-sm">Loading modules…</td></tr>
                ) : modules.length === 0 ? (
                  <tr><td colSpan={4 + 21} className="h-32 text-center text-slate-500 text-sm">No modules found. Upload modules via the Upload tab.</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={4 + 21} className="h-20 text-center text-slate-400 text-sm">No modules match your filters.</td></tr>
                ) : pagedFiltered.map((m, idx) => (
                  <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="text-center px-3 py-2.5 text-xs text-slate-300">{(safeCurrentPage - 1) * pageSize + idx + 1}</td>
                    <td className="px-3 py-2.5 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">{m.moduleCode}</td>
                    <td className="px-3 py-2.5 text-slate-600 max-w-[200px]">
                      <p className="truncate text-xs">{m.moduleTitle}</p>
                      {m.stageInferred && <p className="text-[10px] text-slate-400">{m.stageInferred}</p>}
                    </td>
                    <td className="text-center px-2 py-2.5">
                      {m.programmeCount > 0
                        ? <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: "#003865" }}>{m.programmeCount}</span>
                        : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    {DC_DOMAINS.map((d, di) => {
                      const prevD = DC_DOMAINS[di - 1];
                      const isAreaStart = !prevD || prevD.area !== d.area;
                      return (
                        <td
                          key={d.key}
                          className="text-center px-1 py-2.5"
                          style={{ borderLeft: isAreaStart ? `2px solid ${d.color}22` : undefined }}
                        >
                          {renderChip(m, d)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EntreComp table */}
      {activeLens === "entrecomp" && (
        <div className="border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="text-left px-3 py-3 font-semibold text-slate-700 text-xs sticky left-0 bg-slate-50/95" rowSpan={2}>#</th>
                  <th className="text-left px-3 py-3 font-semibold text-slate-700 text-xs" rowSpan={2}>Code</th>
                  <th className="text-left px-3 py-3 font-semibold text-slate-700 text-xs" rowSpan={2}>Title</th>
                  <th className="text-center px-2 py-3 font-semibold text-slate-700 text-xs w-12" rowSpan={2}>Progs</th>
                  {EC_AREAS.map(area => (
                    <th
                      key={area.key}
                      colSpan={EC_DOMAINS.filter(d => d.area === area.key).length}
                      className="text-center px-2 py-2 text-xs font-bold border-b border-slate-200"
                      style={{ color: area.color, borderLeft: `2px solid ${area.color}33` }}
                    >
                      <div className="flex items-center justify-center gap-1">
                        {(() => { const AI = area.icon; return <AI className="h-3 w-3" />; })()}
                        {area.shortLabel}
                      </div>
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-slate-100 bg-slate-50/30">
                  {EC_DOMAINS.map((d, di) => {
                    const prevD = EC_DOMAINS[di - 1];
                    const isAreaStart = !prevD || prevD.area !== d.area;
                    return (
                      <th
                        key={d.key}
                        className="text-center px-1 py-1.5 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap"
                        style={{ color: d.color, borderLeft: isAreaStart ? `2px solid ${d.color}33` : undefined }}
                        title={d.desc}
                      >
                        {d.shortLabel}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={4 + 15} className="h-32 text-center text-slate-500 text-sm">Loading modules…</td></tr>
                ) : modules.length === 0 ? (
                  <tr><td colSpan={4 + 15} className="h-32 text-center text-slate-500 text-sm">No modules found. Upload modules via the Upload tab.</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={4 + 15} className="h-20 text-center text-slate-400 text-sm">No modules match your filters.</td></tr>
                ) : pagedFiltered.map((m, idx) => (
                  <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="text-center px-3 py-2.5 text-xs text-slate-300">{(safeCurrentPage - 1) * pageSize + idx + 1}</td>
                    <td className="px-3 py-2.5 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">{m.moduleCode}</td>
                    <td className="px-3 py-2.5 text-slate-600 max-w-[200px]">
                      <p className="truncate text-xs">{m.moduleTitle}</p>
                      {m.stageInferred && <p className="text-[10px] text-slate-400">{m.stageInferred}</p>}
                    </td>
                    <td className="text-center px-2 py-2.5">
                      {m.programmeCount > 0
                        ? <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: "#003865" }}>{m.programmeCount}</span>
                        : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    {EC_DOMAINS.map((d, di) => {
                      const prevD = EC_DOMAINS[di - 1];
                      const isAreaStart = !prevD || prevD.area !== d.area;
                      return (
                        <td
                          key={d.key}
                          className="text-center px-1 py-2.5"
                          style={{ borderLeft: isAreaStart ? `2px solid ${d.color}22` : undefined }}
                        >
                          {renderChip(m, d)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safeCurrentPage <= 1} className="h-8 w-8 p-0">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - safeCurrentPage) <= 2)
            .reduce<(number | "…")[]>((acc, p, idx, arr) => {
              if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push("…");
              acc.push(p);
              return acc;
            }, [])
            .map((item, idx) =>
              item === "…" ? (
                <span key={`e-${idx}`} className="text-slate-400 px-1 text-sm">…</span>
              ) : (
                <Button key={item} variant={safeCurrentPage === item ? "default" : "outline"} size="sm" onClick={() => setCurrentPage(item as number)} className="h-8 w-8 p-0 text-sm" style={safeCurrentPage === item ? { backgroundColor: "#003865" } : {}}>
                  {item}
                </Button>
              )
            )}
          <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safeCurrentPage >= totalPages} className="h-8 w-8 p-0">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-500 pb-4">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-amber-400" />
          <span>AI-reviewed — hover for rationale and evidence</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Pencil className="h-3 w-3 text-slate-400" />
          <span>Manually set</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: "#003865" }}>1</span>
          <span>Number of programmes this module appears in</span>
        </div>
        {(activeLens === "greencomp" || activeLens === "digcomp" || activeLens === "entrecomp") && (
          <div className="flex items-center gap-1.5 text-slate-400">
            <span>
              {activeLens === "entrecomp"
                ? "F = Foundation · I = Intermediate · A = Advanced · — = None"
                : "D = Developing · C = Consolidating · L = Leading · — = None"
              }
            </span>
          </div>
        )}
        <div className="ml-auto text-slate-400">Click any cell to cycle level</div>
      </div>
    </div>
  );
}
