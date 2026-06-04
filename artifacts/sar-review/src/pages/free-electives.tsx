import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { useListModules } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ExternalLink, Download, BookOpen, Filter, Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ModuleReview } from "@workspace/api-zod";
import { TU_DUBLIN_SCHOOLS } from "@/lib/constants";

const SUITABILITY_BANDS = ["Recommended", "Acceptable", "Use With Caution", "Not Suitable"];

const BAND_COLORS: Record<string, string> = {
  Recommended: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Acceptable: "bg-blue-100 text-blue-800 border-blue-200",
  "Use With Caution": "bg-amber-100 text-amber-800 border-amber-200",
  "Not Suitable": "bg-red-100 text-red-800 border-red-200",
};

const SCHOOL_CHIP_COLORS = [
  "bg-indigo-50 text-indigo-700",
  "bg-purple-50 text-purple-700",
  "bg-pink-50 text-pink-700",
  "bg-cyan-50 text-cyan-700",
  "bg-green-50 text-green-700",
  "bg-orange-50 text-orange-700",
  "bg-rose-50 text-rose-700",
  "bg-sky-50 text-sky-700",
  "bg-teal-50 text-teal-700",
  "bg-amber-50 text-amber-700",
  "bg-lime-50 text-lime-700",
];
function schoolColor(school: string, schools: string[]) {
  const idx = schools.indexOf(school);
  return SCHOOL_CHIP_COLORS[idx % SCHOOL_CHIP_COLORS.length] ?? "bg-slate-50 text-slate-700";
}

function ScoreDot({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-slate-300 text-xs">-</span>;
  const colors =
    score >= 4
      ? "bg-emerald-500 text-white"
      : score >= 3
        ? "bg-blue-500 text-white"
        : score >= 2
          ? "bg-amber-500 text-white"
          : "bg-red-500 text-white";
  return (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${colors}`}>
      {score}
    </div>
  );
}

function TagBadge({ label, active }: { label: string; active: boolean | null | undefined }) {
  if (!active) return null;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#003865]/10 text-[#003865] border border-[#003865]/20">
      {label}
    </span>
  );
}

const ALL = "all";

export default function FreeElectives() {
  const [disciplineFilter, setDisciplineFilter] = useState<string>(ALL);
  const [bandFilter, setBandFilter] = useState<string>(ALL);
  const [tagFilter, setTagFilter] = useState<string>(ALL);
  const [stageFilter, setStageFilter] = useState<string>(ALL);
  const [search, setSearch] = useState<string>("");

  const { data: modules = [], isLoading } = useListModules();

  const analysed = (modules as ModuleReview[]).filter((m) => m.freeElectiveBandAi != null);

  const schoolOptions = useMemo(() => {
    const fromData = Array.from(new Set(analysed.map((m) => m.school).filter(Boolean) as string[])).sort();
    return fromData.length > 0 ? fromData : TU_DUBLIN_SCHOOLS;
  }, [analysed]);

  const filtered = analysed.filter((m) => {
    if (disciplineFilter !== ALL && m.school !== disciplineFilter) return false;
    if (bandFilter !== ALL && m.freeElectiveBandAi !== bandFilter) return false;
    if (stageFilter !== ALL && m.stageInferred !== stageFilter) return false;
    if (tagFilter === "explore" && !m.tagExplore) return false;
    if (tagFilter === "useful_skills" && !m.tagUsefulSkills) return false;
    if (tagFilter === "pathway_support" && !m.tagPathwaySupport) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!m.moduleCode.toLowerCase().includes(q) && !m.moduleTitle.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const stages = Array.from(new Set(analysed.map((m) => m.stageInferred).filter(Boolean)));

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => { setCurrentPage(1); }, [disciplineFilter, bandFilter, tagFilter, stageFilter, search, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pagedFiltered = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safeCurrentPage, pageSize]);

  const bySchool = useMemo(() => {
    return schoolOptions.reduce<Record<string, number>>((acc, s) => {
      acc[s] = analysed.filter((m) => m.school === s).length;
      return acc;
    }, {});
  }, [schoolOptions, analysed]);

  function handleExport() {
    window.location.href = "/api/export/csv";
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: "#003865" }}>
            Free Electives Dashboard
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            AI-led school and suitability analysis for free elective advising.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          className="gap-2 border-[#003865] text-[#003865] hover:bg-[#003865] hover:text-white"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </div>


      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
        <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code or title..."
            className="pl-9 pr-8 text-sm bg-slate-50"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <Select value={disciplineFilter} onValueChange={setDisciplineFilter}>
          <SelectTrigger className="w-56 text-sm">
            <SelectValue placeholder="School" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Schools</SelectItem>
            {schoolOptions.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={bandFilter} onValueChange={setBandFilter}>
          <SelectTrigger className="w-44 text-sm">
            <SelectValue placeholder="Suitability Band" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Bands</SelectItem>
            {SUITABILITY_BANDS.map((b) => (
              <SelectItem key={b} value={b}>{b}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={tagFilter} onValueChange={setTagFilter}>
          <SelectTrigger className="w-40 text-sm">
            <SelectValue placeholder="Tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Tags</SelectItem>
            <SelectItem value="explore">Explore</SelectItem>
            <SelectItem value="useful_skills">Useful Skills</SelectItem>
            <SelectItem value="pathway_support">Pathway Support</SelectItem>
          </SelectContent>
        </Select>

        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-32 text-sm">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Stages</SelectItem>
            {stages.map((s) => (
              <SelectItem key={s!} value={s!}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(disciplineFilter !== ALL || bandFilter !== ALL || tagFilter !== ALL || stageFilter !== ALL || search) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setDisciplineFilter(ALL); setBandFilter(ALL); setTagFilter(ALL); setStageFilter(ALL); setSearch(""); }}
            className="text-slate-500 text-xs"
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Results count + per-page */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <BookOpen className="w-4 h-4" />
          {isLoading
            ? "Loading modules..."
            : analysed.length === 0
              ? "No modules have been analysed yet. Open a module and click Run Free Elective Analysis."
              : pagedFiltered.length === 0
                ? `Showing 0 of ${filtered.length} analysed modules`
                : `Showing ${(safeCurrentPage - 1) * pageSize + 1}–${Math.min(safeCurrentPage * pageSize, filtered.length)} of ${filtered.length}${filtered.length !== analysed.length ? ` (filtered from ${analysed.length})` : ""} analysed modules`}
        </div>
        {!isLoading && analysed.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Per page:</span>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger className="w-[80px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Table */}
      {filtered.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-semibold">Code</th>
                <th className="text-left px-4 py-3 font-semibold">Title</th>
                <th className="text-left px-4 py-3 font-semibold">School</th>
                <th className="text-center px-3 py-3 font-semibold">Access.</th>
                <th className="text-center px-3 py-3 font-semibold">Stage</th>
                <th className="text-center px-3 py-3 font-semibold">Breadth</th>
                <th className="text-center px-3 py-3 font-semibold">Avg</th>
                <th className="text-left px-4 py-3 font-semibold">Band</th>
                <th className="text-left px-4 py-3 font-semibold">Tags</th>
                <th className="text-center px-3 py-3 font-semibold">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pagedFiltered.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                    {m.moduleCode}
                  </td>
                  <td className="px-4 py-3 text-slate-800 max-w-[200px]">
                    <span className="line-clamp-2">{m.moduleTitle}</span>
                  </td>
                  <td className="px-4 py-3">
                    {m.school ? (
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${schoolColor(m.school, schoolOptions)}`}>
                        {m.school}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex justify-center">
                      <ScoreDot score={m.accessibilityScoreAi} />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex justify-center">
                      <ScoreDot score={m.stageAppropriatenessScoreAi} />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex justify-center">
                      <ScoreDot score={m.breadthTransferabilityScoreAi} />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="font-bold text-[#003865]">
                      {m.freeElectiveAverageAi != null ? m.freeElectiveAverageAi.toFixed(2) : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {m.freeElectiveBandAi ? (
                      <span className={`text-xs px-2 py-1 rounded-full font-medium border ${BAND_COLORS[m.freeElectiveBandAi] ?? "bg-slate-100 text-slate-700"}`}>
                        {m.freeElectiveBandAi}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <TagBadge label="Explore" active={m.tagExplore} />
                      <TagBadge label="Useful Skills" active={m.tagUsefulSkills} />
                      <TagBadge label="Pathway Support" active={m.tagPathwaySupport} />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <Link href={`/modules/${m.id}`}>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-[#003865]">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

      {/* Empty state when filtered to nothing */}
      {!isLoading && analysed.length > 0 && filtered.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No modules match the current filters.</p>
        </div>
      )}
    </div>
  );
}
