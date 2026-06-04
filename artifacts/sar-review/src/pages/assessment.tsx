import { BarChart3 } from "lucide-react";

export default function Assessment() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pt-8">
      <div className="flex items-center gap-4">
        <div
          className="inline-flex items-center justify-center w-12 h-12 rounded-lg"
          style={{ backgroundColor: "#003865" }}
        >
          <BarChart3 className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#003865" }}>
            Assessment Mapping
          </h1>
          <p className="text-slate-500 mt-0.5">Are we assessing what we say we teach?</p>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center space-y-3">
        <p className="text-lg font-semibold" style={{ color: "#003865" }}>In development</p>
        <p className="text-slate-500 text-sm">
          This tool will enable programme teams to check alignment between teaching content and assessment methods across modules.
        </p>
      </div>
    </div>
  );
}
