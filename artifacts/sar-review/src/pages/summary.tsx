import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  GraduationCap, GitBranch, ClipboardCheck, BarChart2, Leaf, Monitor,
  ArrowRight, TrendingUp, AlertTriangle, CheckCircle2, CircleDot,
  BookOpen, Users, Globe, Handshake, Scale, Network, Eye, Zap,
  Search, MessageSquare, FileCode2, ShieldCheck, Lightbulb,
  Loader2,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
async function apiFetch<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}/api${path}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<T>;
}

// ── Types ──────────────────────────────────────────────────────────────────
interface CastOverview {
  modules: {
    total: number; scored: number; reviewed: number; mapped: number;
    latestUpload: string | null;
  };
  sar: {
    scored: number; avgScore: number | null;
    bands: { strongFit: number; moderateFit: number; weakFit: number };
    bySar: Array<{ name: string; count: number }>;
  };
  freeElectives: { analysed: number; recommended: number; avgScore: number | null };
  programmes: {
    total: number; totalMappings: number; uniqueMapped: number;
    list: Array<{ id: number; name: string; code: string | null; moduleCount: number }>;
  };
  ga: { classified: number; byDomain: { People: number; Planet: number; Partnership: number } };
  greencomp: { classified: number; byArea: { values: number; complexity: number; futures: number; action: number } };
  digcomp: { classified: number; byArea: { information: number; communication: number; contentCreation: number; safety: number; problemSolving: number } };
  entrecomp: { classified: number; byArea: { ideas: number; resources: number; action: number } };
}

// ── Helpers ────────────────────────────────────────────────────────────────
function pct(n: number, total: number) {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}
function coverageColor(p: number) {
  if (p >= 75) return "#10b981";
  if (p >= 40) return "#f59e0b";
  return "#ef4444";
}

// ── Progress pill ──────────────────────────────────────────────────────────
function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const p = pct(value, max);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${p}%`, backgroundColor: color }} />
      </div>
      <span className="text-[11px] font-semibold w-8 text-right" style={{ color }}>{p}%</span>
    </div>
  );
}

// ── Stat metric row ────────────────────────────────────────────────────────
function MetricRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">{label}</span>
        <span className="text-xs font-semibold text-slate-700">{value}<span className="text-slate-400 font-normal"> / {total}</span></span>
      </div>
      <ProgressBar value={value} max={total} color={color} />
    </div>
  );
}

// ── Tool health tile ───────────────────────────────────────────────────────
function ToolTile({
  icon: Icon, label, stat, sub, href, color, status,
}: {
  icon: React.ElementType; label: string; stat: string; sub: string;
  href: string; color: string; status: "active" | "partial" | "empty";
}) {
  const statusDot = status === "active" ? "#10b981" : status === "partial" ? "#f59e0b" : "#cbd5e1";
  return (
    <Link href={href} className="group block bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <Icon className="w-4.5 h-4.5" style={{ color }} />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: statusDot }} />
          <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
        </div>
      </div>
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-xl font-bold" style={{ color: "#003865" }}>{stat}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </Link>
  );
}

// ── Strategic insight bullet ───────────────────────────────────────────────
function InsightBullet({ type, text }: { type: "good" | "warn" | "info"; text: string }) {
  const cfg = {
    good: { icon: CheckCircle2, color: "#10b981", bg: "#f0fdf4" },
    warn: { icon: AlertTriangle, color: "#f59e0b", bg: "#fffbeb" },
    info: { icon: CircleDot,    color: "#3b82f6", bg: "#eff6ff" },
  }[type];
  const BulletIcon = cfg.icon;
  return (
    <div className="flex gap-3 items-start rounded-lg px-4 py-3" style={{ backgroundColor: cfg.bg }}>
      <BulletIcon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: cfg.color }} />
      <p className="text-sm text-slate-700 leading-relaxed" dangerouslySetInnerHTML={{
        __html: text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      }} />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function Summary() {
  const { data, isLoading } = useQuery<CastOverview>({
    queryKey: ["cast-overview"],
    queryFn: () => apiFetch("/cast-overview"),
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center p-24">
        <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
      </div>
    );
  }

  const { modules, sar, freeElectives, programmes, ga, greencomp, digcomp, entrecomp } = data;

  // ── Computed insights ────────────────────────────────────────────────────
  const insights: Array<{ type: "good" | "warn" | "info"; text: string }> = [];

  const scoredPct = pct(modules.scored, modules.total);
  const reviewedPct = pct(modules.reviewed, modules.total);
  const mappedPct = pct(modules.mapped, modules.total);
  const gaPct = pct(ga.classified, modules.total);
  const gcPct = pct(greencomp.classified, modules.total);
  const dcPct = pct(digcomp.classified, modules.total);
  const ecPct = pct(entrecomp.classified, modules.total);

  if (scoredPct >= 80) insights.push({ type: "good", text: `**${scoredPct}% of modules scored** — the SAR corpus is well-covered for analysis.` });
  else if (scoredPct > 0) insights.push({ type: "warn", text: `Only **${scoredPct}% of modules have been scored**. Upload and score the remaining ${modules.total - modules.scored} modules to complete SAR coverage.` });

  if (reviewedPct < 50 && modules.scored > 0) insights.push({ type: "warn", text: `**${modules.reviewed} modules reviewed** out of ${modules.scored} scored. Human review is at ${reviewedPct}% — consider scheduling a review sprint.` });
  else if (reviewedPct >= 80) insights.push({ type: "good", text: `**${reviewedPct}% of modules have been human-reviewed**, indicating strong quality assurance across the SAR corpus.` });

  if (programmes.total === 0) {
    insights.push({ type: "info", text: `**No programmes mapped yet.** Add programmes in the Programme Mapping tool to enable lens-based readiness analysis.` });
  } else if (mappedPct < 30) {
    insights.push({ type: "warn", text: `Only **${mappedPct}% of catalogue modules are linked to a programme**. ${modules.total - modules.mapped} modules are unmapped — they will not appear in programme-level lens analysis.` });
  } else {
    insights.push({ type: "good", text: `**${modules.mapped} of ${modules.total} modules are mapped** to ${programmes.total} programme${programmes.total > 1 ? "s" : ""} (${mappedPct}% coverage).` });
  }

  if (gaPct === 0) {
    insights.push({ type: "info", text: `**Graduate Attributes classification has not started.** Go to Module Catalogue → GA tab to classify modules against People, Planet, and Partnership.` });
  } else if (gaPct < 40) {
    insights.push({ type: "warn", text: `**GA coverage is ${gaPct}%** (${ga.classified}/${modules.total} modules). Classification is underway but more than half the catalogue remains unclassified.` });
  } else {
    insights.push({ type: "good", text: `**GA lens covers ${gaPct}% of the catalogue** (${ga.classified} modules). ${ga.byDomain.People} People · ${ga.byDomain.Planet} Planet · ${ga.byDomain.Partnership} Partnership.` });
  }

  if (gcPct === 0) {
    insights.push({ type: "info", text: `**GreenComp classification has not started.** Use the GreenComp tab in Module Catalogue or the Classify view in Programme Mapping to begin sustainability analysis.` });
  } else if (gcPct < 40) {
    insights.push({ type: "warn", text: `**GreenComp coverage is ${gcPct}%** (${greencomp.classified}/${modules.total} modules). The sustainability lens is partially populated.` });
  } else {
    insights.push({ type: "good", text: `**GreenComp lens covers ${gcPct}% of the catalogue.** Strongest area: ${(() => {
      const a = greencomp.byArea;
      return Object.entries(a).sort((x, y) => y[1] - x[1])[0][0];
    })()}.` });
  }

  const DC_AREA_LABELS: Record<string, string> = {
    information: "Information", communication: "Communication",
    contentCreation: "Content Creation", safety: "Safety & Wellbeing",
    problemSolving: "Problem Solving",
  };
  if (digcomp.classified === 0) {
    insights.push({ type: "info", text: `**DigComp analysis has not yet been run** across the catalogue. Use the DigComp tab in Module Catalogue to start classifying digital competence evidence.` });
  } else if (dcPct < 50) {
    insights.push({ type: "warn", text: `**DigComp coverage is ${dcPct}%** (${digcomp.classified}/${modules.total} modules). The digital competence lens is partially populated.` });
  } else {
    const topDc = Object.entries(digcomp.byArea).sort((a, b) => b[1] - a[1]);
    const topLabel = DC_AREA_LABELS[topDc[0][0]] ?? topDc[0][0];
    const lowLabel = DC_AREA_LABELS[topDc[topDc.length - 1][0]] ?? topDc[topDc.length - 1][0];
    insights.push({ type: "good", text: `**DigComp lens covers ${dcPct}% of the catalogue** (${digcomp.classified} modules). Evidence of digital competence is strongest in **${topLabel}** and least visible in **${lowLabel}**.` });
  }

  if (entrecomp.classified === 0) {
    insights.push({ type: "info", text: `**EntreComp analysis has not yet been run** across the catalogue. Use the EntreComp tab in Module Catalogue to start classifying entrepreneurial competence.` });
  } else if (ecPct < 40) {
    insights.push({ type: "warn", text: `**EntreComp coverage is ${ecPct}%** (${entrecomp.classified}/${modules.total} modules). The entrepreneurial competence lens is partially populated.` });
  } else {
    const topEc = Object.entries(entrecomp.byArea).sort((a, b) => b[1] - a[1]);
    const EC_AREA_LABELS: Record<string, string> = { ideas: "Ideas & Opportunities", resources: "Resources", action: "Into Action" };
    const topLabel = EC_AREA_LABELS[topEc[0][0]] ?? topEc[0][0];
    insights.push({ type: "good", text: `**EntreComp lens covers ${ecPct}% of the catalogue** (${entrecomp.classified} modules). Strongest area: **${topLabel}**. ${entrecomp.byArea.ideas} Ideas & Opportunities · ${entrecomp.byArea.resources} Resources · ${entrecomp.byArea.action} Into Action.` });
  }

  if (sar.bands.strongFit > 0) {
    const sfPct = pct(sar.bands.strongFit, modules.scored || 1);
    insights.push({ type: sfPct >= 50 ? "good" : "info", text: `**${sfPct}% of scored modules are Strong Fit** (${sar.bands.strongFit} modules). ${sar.bands.moderateFit} Moderate Fit, ${sar.bands.weakFit} Weak Fit.` });
  }

  if (freeElectives.analysed > 0) {
    const recPct = pct(freeElectives.recommended, freeElectives.analysed);
    insights.push({ type: recPct >= 60 ? "good" : "info", text: `**${recPct}% of Free Elective analyses are Recommended** (${freeElectives.recommended}/${freeElectives.analysed}). Average suitability score: ${freeElectives.avgScore?.toFixed(2) ?? "—"}/4.00.` });
  }

  // Top SAR
  const topSar = [...sar.bySar].sort((a, b) => b.count - a.count).filter(s => s.count > 0).slice(0, 3);
  if (topSar.length > 0) {
    insights.push({ type: "info", text: `**Top SAR areas:** ${topSar.map(s => `${s.name} (${s.count})`).join(" · ")}.` });
  }

  // ── Donut chart data ─────────────────────────────────────────────────────
  const sarDonutData = [
    { name: "Strong Fit",   value: sar.bands.strongFit,   color: "#10b981" },
    { name: "Moderate Fit", value: sar.bands.moderateFit, color: "#f59e0b" },
    { name: "Weak Fit",     value: sar.bands.weakFit,     color: "#ef4444" },
  ].filter(d => d.value > 0);

  const unscored = modules.total - modules.scored;
  if (unscored > 0) sarDonutData.push({ name: "Not scored", value: unscored, color: "#e2e8f0" });

  // ── Tool status helpers ──────────────────────────────────────────────────
  function toolStatus(n: number, good = 10): "active" | "partial" | "empty" {
    if (n === 0) return "empty";
    if (n >= good) return "active";
    return "partial";
  }

  return (
    <div className="space-y-7 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-12">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-3" style={{ backgroundColor: "#F5A800", color: "#003865" }}>
            CAST Analytics
          </div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#003865" }}>Suite Overview</h1>
          <p className="text-slate-500 mt-1">Aggregated insight across all CAST tools and data sources.</p>
        </div>
        {modules.latestUpload && (
          <p className="text-xs text-slate-400 shrink-0">
            Last upload: {new Date(modules.latestUpload).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        )}
      </div>

      {/* ── Tool health strip ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 gap-3">
        <ToolTile icon={GraduationCap}  label="SAR Review"       href="/sar"                  stat={`${modules.scored}`}          sub={`of ${modules.total} modules scored`}                                         color="#003865" status={toolStatus(modules.scored, 20)} />
        <ToolTile icon={GitBranch}      label="Structure"         href="/structure"             stat={`${modules.total}`}           sub="modules in corpus"                                                            color="#475569" status={toolStatus(modules.total, 20)} />
        <ToolTile icon={ClipboardCheck} label="Programme Map"     href="/programme"             stat={`${programmes.total}`}        sub={`programme${programmes.total !== 1 ? "s" : ""}, ${modules.mapped} modules`}  color="#1d4ed8" status={toolStatus(programmes.total, 1)} />
        <ToolTile icon={BarChart2}      label="Grad. Attributes"  href="/programme/ga"          stat={`${ga.classified}`}           sub={`of ${modules.total} classified`}                                             color="#c2185b" status={toolStatus(ga.classified, 10)} />
        <ToolTile icon={Leaf}           label="GreenComp"         href="/programme/greencomp"   stat={`${greencomp.classified}`}    sub={`of ${modules.total} classified`}                                             color="#0f766e" status={toolStatus(greencomp.classified, 10)} />
        <ToolTile icon={Monitor}        label="DigComp"           href="/programme/digcomp"     stat={`${digcomp.classified}`}      sub={`of ${modules.total} classified`}                                             color="#0369a1" status={toolStatus(digcomp.classified, 10)} />
        <ToolTile icon={TrendingUp}     label="EntreComp"         href="/programme/entrecomp"   stat={`${entrecomp.classified}`}    sub={`of ${modules.total} classified`}                                             color="#d97706" status={toolStatus(entrecomp.classified, 10)} />
      </div>

      {/* ── Module corpus ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 lg:col-span-1">
          <h2 className="text-sm font-semibold mb-1" style={{ color: "#003865" }}>Module Corpus</h2>
          <p className="text-xs text-slate-400 mb-5">Upload, scoring, and review coverage</p>

          <div className="text-4xl font-bold mb-0.5" style={{ color: "#003865" }}>{modules.total}</div>
          <p className="text-xs text-slate-400 mb-5">modules in database</p>

          <div className="space-y-3.5">
            <MetricRow label="SAR scored"         value={modules.scored}   total={modules.total} color="#003865" />
            <MetricRow label="Human reviewed"     value={modules.reviewed} total={modules.total} color="#1d4ed8" />
            <MetricRow label="Mapped to programme" value={modules.mapped}  total={modules.total} color="#0f766e" />
            <MetricRow label="Free Elective analysed" value={freeElectives.analysed} total={modules.total} color="#b45309" />
          </div>
        </div>

        {/* ── SAR band donut ──────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold mb-1" style={{ color: "#003865" }}>SAR Score Distribution</h2>
          <p className="text-xs text-slate-400 mb-4">Band breakdown across scored modules</p>
          {modules.scored === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-300 text-xs">
              <BookOpen className="w-8 h-8 mb-2" />
              No modules scored yet
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={sarDonutData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={2} dataKey="value">
                    {sarDonutData.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2">
                {[
                  { label: "Strong Fit", count: sar.bands.strongFit, color: "#10b981" },
                  { label: "Moderate Fit", count: sar.bands.moderateFit, color: "#f59e0b" },
                  { label: "Weak Fit", count: sar.bands.weakFit, color: "#ef4444" },
                ].map(({ label, count, color }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-xs text-slate-600">{label} <strong>{count}</strong></span>
                  </div>
                ))}
              </div>
              {sar.avgScore !== null && (
                <p className="text-center text-xs text-slate-400 mt-2">
                  Avg score: <strong className="text-slate-600">{sar.avgScore.toFixed(2)}</strong> / 4.00
                </p>
              )}
            </>
          )}
        </div>

        {/* ── Top SAR areas ───────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold mb-1" style={{ color: "#003865" }}>SAR Area Coverage</h2>
          <p className="text-xs text-slate-400 mb-4">Module count per Subject Area Requirement</p>
          {sar.bySar.every(s => s.count === 0) ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-300 text-xs">
              <BarChart2 className="w-8 h-8 mb-2" />
              No SAR assignments yet
            </div>
          ) : (
            <div className="space-y-2">
              {sar.bySar.sort((a, b) => b.count - a.count).map(({ name, count }) => {
                const p = pct(count, modules.total);
                return (
                  <div key={name}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-slate-600 truncate pr-2">{name}</span>
                      <span className="font-semibold text-slate-700 shrink-0">{count}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-slate-400" style={{ width: `${p}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Lens classification coverage ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">

        {/* Graduate Attributes */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#fce4ec" }}>
              <Users className="w-3.5 h-3.5" style={{ color: "#c2185b" }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: "#003865" }}>Graduate Attributes Lens</h2>
              <p className="text-xs text-slate-400">People · Planet · Partnership</p>
            </div>
            <Link href="/programme/ga" className="ml-auto text-xs text-blue-500 hover:underline flex items-center gap-1">
              Dashboard <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="flex items-end gap-4 mb-5">
            <div>
              <div className="text-3xl font-bold" style={{ color: "#c2185b" }}>{ga.classified}</div>
              <div className="text-xs text-slate-400">of {modules.total} classified</div>
            </div>
            <div className="flex-1 mb-1">
              <ProgressBar value={ga.classified} max={modules.total} color="#c2185b" />
            </div>
          </div>

          <div className="space-y-3">
            {[
              { label: "People",      value: ga.byDomain.People,      icon: Users,     color: "#c2185b" },
              { label: "Planet",      value: ga.byDomain.Planet,      icon: Globe,     color: "#388e3c" },
              { label: "Partnership", value: ga.byDomain.Partnership, icon: Handshake, color: "#1565c0" },
            ].map(({ label, value, icon: DomainIcon, color }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}18` }}>
                  <DomainIcon className="w-3.5 h-3.5" style={{ color }} />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-slate-600 font-medium">{label}</span>
                    <span className="font-semibold" style={{ color }}>{value}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct(value, modules.total)}%`, backgroundColor: color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {ga.classified === 0 && (
            <Link href="/programme/catalogue" className="mt-4 block text-center text-xs text-blue-500 hover:underline">
              Go to Module Catalogue to start GA classification →
            </Link>
          )}
        </div>

        {/* GreenComp */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#f0fdfa" }}>
              <Leaf className="w-3.5 h-3.5" style={{ color: "#0f766e" }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: "#003865" }}>GreenComp Lens</h2>
              <p className="text-xs text-slate-400">EU Sustainability Competence Framework</p>
            </div>
            <Link href="/programme/greencomp" className="ml-auto text-xs text-blue-500 hover:underline flex items-center gap-1">
              Dashboard <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="flex items-end gap-4 mb-5">
            <div>
              <div className="text-3xl font-bold" style={{ color: "#0f766e" }}>{greencomp.classified}</div>
              <div className="text-xs text-slate-400">of {modules.total} classified</div>
            </div>
            <div className="flex-1 mb-1">
              <ProgressBar value={greencomp.classified} max={modules.total} color="#0f766e" />
            </div>
          </div>

          <div className="space-y-3">
            {[
              { label: "Values",     value: greencomp.byArea.values,     icon: Scale,   color: "#0f766e" },
              { label: "Complexity", value: greencomp.byArea.complexity, icon: Network, color: "#7c3aed" },
              { label: "Futures",    value: greencomp.byArea.futures,    icon: Eye,     color: "#1d4ed8" },
              { label: "Action",     value: greencomp.byArea.action,     icon: Zap,     color: "#b45309" },
            ].map(({ label, value, icon: AreaIcon, color }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}18` }}>
                  <AreaIcon className="w-3.5 h-3.5" style={{ color }} />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-slate-600 font-medium">{label}</span>
                    <span className="font-semibold" style={{ color }}>{value}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct(value, modules.total)}%`, backgroundColor: color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {greencomp.classified === 0 && (
            <Link href="/programme/catalogue" className="mt-4 block text-center text-xs text-blue-500 hover:underline">
              Go to Module Catalogue to start GreenComp classification →
            </Link>
          )}
        </div>

        {/* DigComp 3.0 */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#e0f2fe" }}>
              <Monitor className="w-3.5 h-3.5" style={{ color: "#0369a1" }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: "#003865" }}>DigComp 3.0 Lens</h2>
              <p className="text-xs text-slate-400">European Digital Competence Framework</p>
            </div>
            <Link href="/programme/digcomp" className="ml-auto text-xs text-blue-500 hover:underline flex items-center gap-1">
              Dashboard <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="flex items-end gap-4 mb-5">
            <div>
              <div className="text-3xl font-bold" style={{ color: "#0369a1" }}>{digcomp.classified}</div>
              <div className="text-xs text-slate-400">of {modules.total} classified</div>
            </div>
            <div className="flex-1 mb-1">
              <ProgressBar value={digcomp.classified} max={modules.total} color="#0369a1" />
            </div>
          </div>

          <div className="space-y-3">
            {([
              { key: "information",    label: "Information",      fullLabel: "Information search, evaluation and management", icon: Search,       color: "#0369a1" },
              { key: "communication",  label: "Communication",    fullLabel: "Communication and collaboration",                icon: MessageSquare, color: "#7c3aed" },
              { key: "contentCreation",label: "Content Creation", fullLabel: "Content creation",                              icon: FileCode2,     color: "#0f766e" },
              { key: "safety",         label: "Safety & Wellbeing",fullLabel: "Safety, wellbeing and responsible use",        icon: ShieldCheck,   color: "#b45309" },
              { key: "problemSolving", label: "Problem Solving",  fullLabel: "Problem identification and solving",            icon: Lightbulb,     color: "#be185d" },
            ] as Array<{ key: keyof typeof digcomp.byArea; label: string; fullLabel: string; icon: React.ElementType; color: string }>).map(({ key, label, fullLabel, icon: AreaIcon, color }) => (
              <div key={key} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}18` }}>
                  <AreaIcon className="w-3.5 h-3.5" style={{ color }} aria-hidden />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-slate-600 font-medium" title={fullLabel}>{label}</span>
                    <span className="font-semibold" style={{ color }}>{digcomp.byArea[key]}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct(digcomp.byArea[key], modules.total)}%`, backgroundColor: color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {digcomp.classified === 0 && (
            <Link href="/programme/catalogue" className="mt-4 block text-center text-xs text-blue-500 hover:underline">
              Go to Module Catalogue to start DigComp classification →
            </Link>
          )}
        </div>

        {/* EntreComp */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#fffbeb" }}>
              <TrendingUp className="w-3.5 h-3.5" style={{ color: "#d97706" }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: "#003865" }}>EntreComp Lens</h2>
              <p className="text-xs text-slate-400">EU Entrepreneurship Competence Framework</p>
            </div>
            <Link href="/programme/entrecomp" className="ml-auto text-xs text-blue-500 hover:underline flex items-center gap-1">
              Dashboard <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="flex items-end gap-4 mb-5">
            <div>
              <div className="text-3xl font-bold" style={{ color: "#d97706" }}>{entrecomp.classified}</div>
              <div className="text-xs text-slate-400">of {modules.total} classified</div>
            </div>
            <div className="flex-1 mb-1">
              <ProgressBar value={entrecomp.classified} max={modules.total} color="#d97706" />
            </div>
          </div>

          <div className="space-y-3">
            {[
              { label: "Ideas & Opportunities", value: entrecomp.byArea.ideas,     icon: Eye,        color: "#d97706" },
              { label: "Resources",             value: entrecomp.byArea.resources,  icon: Scale,      color: "#7c3aed" },
              { label: "Into Action",           value: entrecomp.byArea.action,     icon: TrendingUp, color: "#059669" },
            ].map(({ label, value, icon: AreaIcon, color }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}18` }}>
                  <AreaIcon className="w-3.5 h-3.5" style={{ color }} />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-slate-600 font-medium">{label}</span>
                    <span className="font-semibold" style={{ color }}>{value}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct(value, modules.total)}%`, backgroundColor: color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {entrecomp.classified === 0 && (
            <Link href="/programme/catalogue" className="mt-4 block text-center text-xs text-blue-500 hover:underline">
              Go to Module Catalogue to start EntreComp classification →
            </Link>
          )}
        </div>
      </div>

      {/* ── Programme mapping ──────────────────────────────────────────── */}
      {programmes.total > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold" style={{ color: "#003865" }}>Programme Mapping Readiness</h2>
              <p className="text-xs text-slate-400 mt-0.5">{programmes.total} programme{programmes.total !== 1 ? "s" : ""} · {modules.mapped} unique modules mapped</p>
            </div>
            <Link href="/programme" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
              Open <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {programmes.list.map(prog => {
              const p = pct(prog.moduleCount, modules.total);
              const cov = coverageColor(p);
              return (
                <Link key={prog.id} href={`/programme`} className="block bg-slate-50 rounded-lg p-3 border border-slate-100 hover:border-slate-200 transition-colors">
                  <p className="text-xs font-bold text-slate-700 truncate">{prog.name}</p>
                  {prog.code && <p className="text-[10px] text-slate-400 mb-2">{prog.code}</p>}
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${p}%`, backgroundColor: cov }} />
                    </div>
                    <span className="text-[11px] font-semibold" style={{ color: cov }}>{prog.moduleCount}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{prog.moduleCount} module{prog.moduleCount !== 1 ? "s" : ""} mapped</p>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Free Electives ─────────────────────────────────────────────── */}
      {freeElectives.analysed > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#fffbeb" }}>
              <TrendingUp className="w-3.5 h-3.5" style={{ color: "#b45309" }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: "#003865" }}>Free Elective Analysis</h2>
              <p className="text-xs text-slate-400">AI suitability scoring across the module catalogue</p>
            </div>
            <Link href="/free-electives" className="ml-auto text-xs text-blue-500 hover:underline flex items-center gap-1">
              Open <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-2xl font-bold" style={{ color: "#003865" }}>{freeElectives.analysed}</p>
              <p className="text-xs text-slate-400">of {modules.total} analysed</p>
              <ProgressBar value={freeElectives.analysed} max={modules.total} color="#b45309" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{freeElectives.recommended}</p>
              <p className="text-xs text-slate-400">recommended ({pct(freeElectives.recommended, freeElectives.analysed)}%)</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{freeElectives.avgScore?.toFixed(2) ?? "—"}</p>
              <p className="text-xs text-slate-400">avg suitability score / 4.00</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Strategic insights ─────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-sm font-semibold" style={{ color: "#003865" }}>Strategic Insights</h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full border text-slate-500 border-slate-200 bg-white">auto-generated · for team review</span>
        </div>
        <div className="space-y-2">
          {insights.map((ins, i) => (
            <InsightBullet key={i} type={ins.type} text={ins.text} />
          ))}
        </div>
      </div>

    </div>
  );
}
