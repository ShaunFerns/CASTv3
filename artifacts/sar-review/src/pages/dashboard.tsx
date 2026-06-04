import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { 
  useGetDashboardSummary, 
  useListModules,
  useDeleteModule,
  getGetDashboardSummaryQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SAR_OPTIONS, SCORE_BANDS, STATUS_OPTIONS, TU_DUBLIN_SCHOOLS } from "@/lib/constants";

import { useCalibration, calcCalibratedBand } from "@/lib/calibration";
import { AlertTriangle, ChevronLeft, ChevronRight, Download, Search, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";


export default function Dashboard() {
  const { uplift } = useCalibration();
  const [sarFilter, setSarFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [scoreBandFilter, setScoreBandFilter] = useState<string>("all");
  const [campusFilter, setCampusFilter] = useState<string>("all");
  const [schoolFilter, setSchoolFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: summary, isLoading: isSummaryLoading } = useGetDashboardSummary();
  const { data: modules, isLoading: isModulesLoading } = useListModules({
    sar: sarFilter !== "all" ? sarFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    campus: campusFilter !== "all" ? campusFilter : undefined,
  });

  const deleteModuleMutation = useDeleteModule();

  const handleExport = async () => {
    try {
      const response = await fetch('/api/export/csv');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'modules_export.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteConfirm = async () => {
    if (deleteTargetId === null) return;
    try {
      await deleteModuleMutation.mutateAsync({ id: deleteTargetId });
      queryClient.invalidateQueries({ queryKey: ["/api/modules"] });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      toast({ title: "Module deleted", description: "The module has been removed." });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete module." });
    } finally {
      setDeleteTargetId(null);
    }
  };

  const deleteTarget = modules?.find(m => m.id === deleteTargetId);

  const duplicateCodes = useMemo(() => {
    if (!modules) return new Set<string>();
    const counts: Record<string, number> = {};
    for (const m of modules) {
      counts[m.moduleCode] = (counts[m.moduleCode] || 0) + 1;
    }
    return new Set(
      Object.entries(counts)
        .filter(([, c]) => c > 1)
        .map(([code]) => code)
    );
  }, [modules]);

  const schoolOptions = useMemo(() => {
    if (!modules) return TU_DUBLIN_SCHOOLS;
    const fromData = Array.from(new Set(modules.map((m) => m.school).filter(Boolean) as string[]));
    const merged = Array.from(new Set([...TU_DUBLIN_SCHOOLS, ...fromData])).sort();
    return merged;
  }, [modules]);

  const displayModules = useMemo(() => {
    if (!modules) return [];
    return modules.filter((m) => {
      if (schoolFilter !== "all" && m.school !== schoolFilter) return false;
      if (scoreBandFilter !== "all") {
        const calibratedBand = calcCalibratedBand(m.averageScoreFinal, uplift);
        if (calibratedBand !== scoreBandFilter) return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!m.moduleCode.toLowerCase().includes(q) && !m.moduleTitle.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [modules, search, scoreBandFilter, schoolFilter, uplift]);

  useEffect(() => { setCurrentPage(1); }, [search, sarFilter, statusFilter, campusFilter, scoreBandFilter, schoolFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(displayModules.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pagedModules = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return displayModules.slice(start, start + pageSize);
  }, [displayModules, safeCurrentPage, pageSize]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#003865" }}>Dashboard</h1>
          <p className="text-slate-500 mt-1">Overview of module reviews and status.</p>
          {!isSummaryLoading && summary && (
            <p className="text-xs text-slate-400 mt-1">
              {summary.latestUploadAt
                ? <>Dataset uploaded: <span className="font-medium text-slate-500">{new Date(summary.latestUploadAt).toLocaleString("en-IE", { dateStyle: "medium", timeStyle: "short" })}</span> · </>
                : null}
              Total modules: <span className="font-medium text-slate-500">{summary.total}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleExport} variant="outline" className="flex items-center gap-2 bg-white">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Modules</CardTitle>
          </CardHeader>
          <CardContent>
            {isSummaryLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-3xl font-bold" style={{ color: "#003865" }}>{summary?.total || 0}</div>}
          </CardContent>
        </Card>
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Reviewed</CardTitle>
          </CardHeader>
          <CardContent>
            {isSummaryLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-3xl font-bold text-emerald-600">{summary?.byStatus?.['reviewed'] || 0}</div>}
          </CardContent>
        </Card>
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            {isSummaryLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-3xl font-bold text-amber-600">{summary?.byStatus?.['pending'] || 0}</div>}
          </CardContent>
        </Card>
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Avg Score</CardTitle>
          </CardHeader>
          <CardContent>
            {isSummaryLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-3xl font-bold text-blue-600">{summary?.averageScore?.toFixed(2) || "-"}</div>}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code or title..."
            className="pl-9 pr-8 bg-slate-50"
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
        <div className="w-full sm:w-[220px]">
          <Select value={sarFilter} onValueChange={setSarFilter}>
            <SelectTrigger className="bg-slate-50">
              <SelectValue placeholder="Filter by SAR" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All SARs</SelectItem>
              {SAR_OPTIONS.map(sar => (
                <SelectItem key={sar} value={sar}>{sar}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-[200px]">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="bg-slate-50">
              <SelectValue placeholder="Filter by Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUS_OPTIONS.map(s => (
                <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-[200px]">
          <Select value={campusFilter} onValueChange={setCampusFilter}>
            <SelectTrigger className="bg-slate-50">
              <SelectValue placeholder="Filter by Campus" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Campuses</SelectItem>
              <SelectItem value="Grangegorman">Grangegorman</SelectItem>
              <SelectItem value="Tallaght">Tallaght</SelectItem>
              <SelectItem value="Blanchardstown">Blanchardstown</SelectItem>
              <SelectItem value="Multiple">Multiple</SelectItem>
              <SelectItem value="Unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-[220px]">
          <Select value={schoolFilter} onValueChange={setSchoolFilter}>
            <SelectTrigger className="bg-slate-50">
              <SelectValue placeholder="Filter by School" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Schools</SelectItem>
              {schoolOptions.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-[200px]">
          <Select value={scoreBandFilter} onValueChange={setScoreBandFilter}>
            <SelectTrigger className="bg-slate-50">
              <SelectValue placeholder="Filter by Score Band" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Score Bands</SelectItem>
              {SCORE_BANDS.map(sb => (
                <SelectItem key={sb} value={sb}>{sb}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!isModulesLoading && modules && modules.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing <span className="font-medium text-slate-700">{pagedModules.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1}–{Math.min(safeCurrentPage * pageSize, displayModules.length)}</span> of{" "}
            <span className="font-medium text-slate-700">{displayModules.length}</span>
            {displayModules.length !== modules.length && <> (filtered from <span className="font-medium text-slate-700">{modules.length}</span>)</>}
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

      <div className="border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50/80">
            <TableRow>
              <TableHead className="font-semibold text-slate-700">Code</TableHead>
              <TableHead className="font-semibold text-slate-700">Title</TableHead>
              <TableHead className="font-semibold text-slate-700">School</TableHead>
              <TableHead className="font-semibold text-slate-700">Final SAR</TableHead>
              <TableHead className="font-semibold text-slate-700">Score Band</TableHead>
              <TableHead className="font-semibold text-slate-700">Avg Score</TableHead>
              <TableHead className="font-semibold text-slate-700">Requisites</TableHead>
              <TableHead className="font-semibold text-slate-700">Status</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isModulesLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center text-slate-500">Loading modules...</TableCell>
              </TableRow>
            ) : displayModules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center text-slate-500">No modules found matching filters.</TableCell>
              </TableRow>
            ) : (
              pagedModules.map((m) => (
                <TableRow key={m.id} className="hover:bg-slate-50/50 transition-colors">
                  <TableCell className="font-medium text-slate-900">
                    <div className="flex items-center gap-1.5">
                      {duplicateCodes.has(m.moduleCode) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                          </TooltipTrigger>
                          <TooltipContent side="right" className="text-xs">
                            Duplicate module code
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {m.moduleCode}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[250px] truncate text-slate-600" title={m.moduleTitle}>{m.moduleTitle}</TableCell>
                  <TableCell className="max-w-[180px]">
                    {m.school
                      ? <span className="text-xs text-slate-600 truncate block" title={m.school}>{m.school}</span>
                      : <span className="text-slate-300 text-xs">—</span>
                    }
                  </TableCell>
                  <TableCell className="text-slate-700">{m.selectedSarFinal || <span className="text-slate-400 italic text-sm">Unassigned</span>}</TableCell>
                  <TableCell>
                    {(() => {
                      const band = calcCalibratedBand(m.averageScoreFinal, uplift);
                      return band ? (
                        <Badge variant="outline" className={`
                          ${band === 'Strong Fit' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''}
                          ${band === 'Moderate Fit' ? 'bg-amber-50 text-amber-700 border-amber-200' : ''}
                          ${band === 'Weak Fit' ? 'bg-red-50 text-red-700 border-red-200' : ''}
                        `}>
                          {band}
                        </Badge>
                      ) : (
                        <span className="text-slate-400">-</span>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="font-medium text-slate-700">
                    {m.averageScoreFinal != null ? Math.min(m.averageScoreFinal + uplift, 4).toFixed(2) : "-"}
                  </TableCell>
                  <TableCell>
                    {m.requisitesStatus ? (
                      <Badge variant="outline" className={`text-xs whitespace-nowrap ${
                        m.requisitesStatus === 'None' ? 'bg-slate-50 text-slate-500 border-slate-200' :
                        m.requisitesStatus === 'Pre-requisite' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                        m.requisitesStatus === 'Co-requisite' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                        m.requisitesStatus === 'Pre- and Co-requisite' ? 'bg-red-50 text-red-700 border-red-200' :
                        'bg-slate-50 text-slate-400 border-slate-200'
                      }`}>
                        {m.requisitesStatus}
                      </Badge>
                    ) : (
                      <span className="text-slate-300 text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`capitalize ${
                      m.reviewStatus === 'reviewed' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      m.reviewStatus === 'scored' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                      m.reviewStatus === 'classified' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                      'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {m.reviewStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900" asChild>
                        <Link href={`/modules/${m.id}`}>View</Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => setDeleteTargetId(m.id)}
                        data-testid={`btn-delete-${m.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!isModulesLoading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={safeCurrentPage <= 1}
            className="h-8 w-8 p-0"
          >
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
                <span key={`ellipsis-${idx}`} className="text-slate-400 px-1 text-sm">…</span>
              ) : (
                <Button
                  key={item}
                  variant={safeCurrentPage === item ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(item as number)}
                  className="h-8 w-8 p-0 text-sm"
                  style={safeCurrentPage === item ? { backgroundColor: "#003865" } : {}}
                >
                  {item}
                </Button>
              )
            )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={safeCurrentPage >= totalPages}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      <AlertDialog open={deleteTargetId !== null} onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete module?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.moduleCode}: {deleteTarget?.moduleTitle}</strong> and all associated review data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
