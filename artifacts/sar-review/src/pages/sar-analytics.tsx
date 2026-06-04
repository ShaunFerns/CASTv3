import { useState } from "react";
import { useGetDashboardSummary, useListModules } from "@workspace/api-client-react";
import { useCalibration, calcCalibratedBand } from "@/lib/calibration";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, FileDown } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";

const COLORS = ['#1e40af', '#047857', '#b45309', '#be123c', '#6d28d9', '#0f766e', '#1d4ed8', '#0369a1'];

const BAND_COLORS: Record<string, string> = {
  Recommended: '#10b981',
  Acceptable: '#3b82f6',
  'Use With Caution': '#f59e0b',
  'Not Suitable': '#ef4444',
};

const FAMILY_COLORS = ['#003865', '#1d4ed8', '#0369a1', '#047857', '#6d28d9', '#b45309', '#be123c'];

const ALL_SARS = [
  'Language Studies',
  'Quantitative Analysis',
  'Writing and Text Analysis',
  'Health / Wellness / Sports',
  'Sustainability',
  'Communications',
  'Creativity',
  'Digital Literacy',
];

const SAR_BANDS = ['Strong Fit', 'Moderate Fit', 'Weak Fit'] as const;
type SarBand = typeof SAR_BANDS[number] | 'all';

const BAND_PILL_COLORS: Record<string, { bg: string; text: string; activeBg: string; activeText: string }> = {
  'Strong Fit':   { bg: 'bg-emerald-50', text: 'text-emerald-700', activeBg: 'bg-emerald-600', activeText: 'text-white' },
  'Moderate Fit': { bg: 'bg-amber-50',   text: 'text-amber-700',   activeBg: 'bg-amber-500',   activeText: 'text-white' },
  'Weak Fit':     { bg: 'bg-red-50',     text: 'text-red-700',     activeBg: 'bg-red-500',     activeText: 'text-white' },
};

export default function SarAnalytics() {
  const { uplift } = useCalibration();
  const { data: summary, isLoading } = useGetDashboardSummary();
  const { data: allModules, isLoading: isModulesLoading } = useListModules();
  const [sarBandFilter, setSarBandFilter] = useState<SarBand>('all');

  if (isLoading || isModulesLoading) {
    return <div className="flex justify-center p-24"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  }

  if (!summary) return null;

  const scoredModules = (allModules ?? []).filter((m) => m.averageScoreFinal != null);

  const calibratedBandCounts: Record<string, number> = { 'Strong Fit': 0, 'Moderate Fit': 0, 'Weak Fit': 0 };
  for (const m of scoredModules) {
    const band = calcCalibratedBand(m.averageScoreFinal, uplift);
    if (band) calibratedBandCounts[band] = (calibratedBandCounts[band] || 0) + 1;
  }

  const sarFilteredModules = scoredModules.filter(
    (m) => m.selectedSarFinal && (sarBandFilter === 'all' || calcCalibratedBand(m.averageScoreFinal, uplift) === sarBandFilter)
  );
  const sarCounts: Record<string, number> = {};
  for (const m of sarFilteredModules) {
    const sar = m.selectedSarFinal!;
    sarCounts[sar] = (sarCounts[sar] || 0) + 1;
  }
  const sarData = ALL_SARS.map((name) => ({ name, count: sarCounts[name] ?? 0 }));

  const scoreBandData = Object.entries(calibratedBandCounts).map(([name, count]) => ({
    name,
    count
  }));

  const stageData = Object.entries(summary.byStage)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => {
      const numA = parseInt(a.name.replace(/\D/g, ""), 10);
      const numB = parseInt(b.name.replace(/\D/g, ""), 10);
      return numA - numB;
    });

  const analysedModules = (allModules ?? []).filter(m => m.freeElectiveProcessedAt);

  const feBandCounts: Record<string, number> = {};
  const feFamilyCounts: Record<string, number> = {};
  let feScoreSum = 0;
  let feRecommendedCount = 0;

  for (const m of analysedModules) {
    const band = m.freeElectiveBandAi ?? 'Unknown';
    feBandCounts[band] = (feBandCounts[band] || 0) + 1;
    if (band === 'Recommended') feRecommendedCount++;

    const family = m.disciplineFamily ?? 'Unknown';
    feFamilyCounts[family] = (feFamilyCounts[family] || 0) + 1;

    if (m.freeElectiveAverageAi) feScoreSum += m.freeElectiveAverageAi;
  }

  const feBandData = Object.entries(feBandCounts).map(([name, count]) => ({ name, count }));
  const feFamilyData = Object.entries(feFamilyCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  const feAvgScore = analysedModules.length > 0 ? feScoreSum / analysedModules.length : null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Analytics Summary</h1>
          <p className="text-slate-500 mt-1">High-level distribution and scoring insights.</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-[#003865] text-[#003865] hover:bg-[#003865] hover:text-white"
            onClick={() => { window.location.href = "/api/export/decision-workbook"; }}
          >
            <FileDown className="w-4 h-4" />
            Export Decision Workbook
          </Button>
          <p className="text-xs text-slate-400">Strong Fit SARs + Recommended Free Electives</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Evaluated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-slate-900">{summary.total}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Global Avg Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-600">
              {summary.averageScore != null ? Math.min(summary.averageScore + uplift, 4).toFixed(2) : "-"}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Strong Fits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-emerald-600">{calibratedBandCounts['Strong Fit'] || 0}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Fully Reviewed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-slate-700">{summary.byStatus['reviewed'] || 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="shadow-sm border-slate-200 col-span-1 lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Distribution by Subject Area Requirement (SAR)</CardTitle>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setSarBandFilter('all')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    sarBandFilter === 'all'
                      ? 'bg-slate-700 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All
                </button>
                {SAR_BANDS.map((band) => {
                  const c = BAND_PILL_COLORS[band];
                  const active = sarBandFilter === band;
                  return (
                    <button
                      key={band}
                      onClick={() => setSarBandFilter(band)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        active ? `${c.activeBg} ${c.activeText}` : `${c.bg} ${c.text} hover:opacity-80`
                      }`}
                    >
                      {band}
                    </button>
                  );
                })}
              </div>
            </div>
            {sarBandFilter !== 'all' && (
              <p className="text-xs text-slate-400 mt-1">
                Showing {sarFilteredModules.length} module{sarFilteredModules.length !== 1 ? 's' : ''} in the <span className="font-medium">{sarBandFilter}</span> band
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sarData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    interval={0}
                    height={80}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                  />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="count" fill="#1e40af" radius={[4, 4, 0, 0]}>
                    {sarData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.count === 0 ? '#e2e8f0' : COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle>Distribution by Score Band</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={scoreBandData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="count"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {scoreBandData.map((entry, index) => {
                      let color = '#94a3b8';
                      if (entry.name === 'Strong Fit') color = '#10b981';
                      if (entry.name === 'Moderate Fit') color = '#f59e0b';
                      if (entry.name === 'Weak Fit') color = '#ef4444';
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle>Distribution by Stage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stageData} layout="vertical" margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px' }} />
                  <Bar dataKey="count" fill="#475569" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Free Elective Analytics */}
      <div>
        <div className="flex items-center gap-2 mb-6">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ backgroundColor: '#F5A800' }}>
            <Sparkles className="w-4 h-4" style={{ color: '#003865' }} />
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ color: '#003865' }}>Free Elective Analysis</h2>
            <p className="text-sm text-slate-500">AI-generated discipline classification and suitability scoring</p>
          </div>
        </div>

        {analysedModules.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center text-slate-400 text-sm">
            No modules have been analysed for free electives yet. Open a module and run the Free Elective Analysis.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card className="shadow-sm border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Modules Analysed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold" style={{ color: '#003865' }}>{analysedModules.length}</div>
                  <p className="text-xs text-slate-400 mt-1">of {(allModules ?? []).length} total</p>
                </CardContent>
              </Card>
              <Card className="shadow-sm border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Recommended</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-emerald-600">{feRecommendedCount}</div>
                  <p className="text-xs text-slate-400 mt-1">
                    {analysedModules.length > 0
                      ? `${Math.round((feRecommendedCount / analysedModules.length) * 100)}% of analysed`
                      : '-'}
                  </p>
                </CardContent>
              </Card>
              <Card className="shadow-sm border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Avg Suitability Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-blue-600">
                    {feAvgScore !== null ? feAvgScore.toFixed(2) : '-'}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">out of 4.00</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="shadow-sm border-slate-200">
                <CardHeader>
                  <CardTitle>Suitability Band Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={feBandData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="count"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {feBandData.map((entry) => (
                            <Cell key={entry.name} fill={BAND_COLORS[entry.name] ?? '#94a3b8'} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '8px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-slate-200">
                <CardHeader>
                  <CardTitle>Distribution by Discipline Family</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={feFamilyData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                        <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          width={140}
                        />
                        <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px' }} />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          {feFamilyData.map((entry, index) => (
                            <Cell key={entry.name} fill={FAMILY_COLORS[index % FAMILY_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
