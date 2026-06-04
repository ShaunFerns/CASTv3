import { Link } from "wouter";
import { ArrowRight, BarChart3, GitBranch, ClipboardCheck, Layers, GraduationCap } from "lucide-react";

const tools = [
  {
    href: "/sar",
    icon: GraduationCap,
    title: "SAR + Free Electives",
    description: "Select and review modules for inclusion using evidence-based alignment and structured analysis.",
    color: "#003865",
    available: true,
  },
  {
    href: "/structure",
    icon: GitBranch,
    title: "Structure Explorer",
    description: "Explore similarity, clustering, and structural patterns across the curriculum.",
    color: "#003865",
    available: true,
  },
  {
    href: "/programme",
    icon: ClipboardCheck,
    title: "Programme Mapping",
    description: "Map programmes against Graduate Attributes and curriculum lenses to assess coverage and balance.",
    color: "#003865",
    available: true,
  },
  {
    href: "/assessment",
    icon: BarChart3,
    title: "Assessment Mapping",
    description: "Review alignment between programme outcomes, module outcomes, assessment, and attributes.",
    color: "#003865",
    available: false,
  },
  {
    href: "/modality",
    icon: Layers,
    title: "Modality",
    description: "Support structured decisions about module and programme delivery modes.",
    color: "#003865",
    available: false,
  },
];

export default function Home() {
  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-12">
      {/* Hero */}
      <div className="text-center space-y-5 pt-8">
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold"
          style={{ backgroundColor: "#F5A800", color: "#003865" }}
        >
          TU Dublin · Arts Programme
        </div>
        <h1
          className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight"
          style={{ color: "#003865" }}
        >
          CAST
          <br />
          <span style={{ color: "#F5A800" }}>Curriculum Analysis & Structuring Tool</span>
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          A suite of tools to help programme teams analyse, map, and improve curriculum design.
          Select a tool to get started.
        </p>
      </div>

      {/* Tool cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const card = (
            <div
              className={`group relative bg-white rounded-xl border-2 p-7 shadow-sm transition-all duration-200 h-full flex flex-col gap-3 ${
                tool.available
                  ? "border-slate-200 hover:border-[#003865] hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
                  : "border-slate-100 opacity-60 cursor-default"
              }`}
            >
              <div
                className="inline-flex items-center justify-center w-12 h-12 rounded-lg"
                style={{ backgroundColor: tool.available ? tool.color : "#94a3b8" }}
              >
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <h2 className="text-lg font-bold" style={{ color: "#003865" }}>
                    {tool.title}
                  </h2>
                  {!tool.available && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 uppercase tracking-wide">
                      Coming soon
                    </span>
                  )}
                </div>
                <p className="text-slate-500 text-sm leading-relaxed">{tool.description}</p>
              </div>
              {tool.available && (
                <div className="flex items-center gap-1 text-sm font-semibold mt-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#003865" }}>
                  Open tool <ArrowRight className="w-4 h-4" />
                </div>
              )}
            </div>
          );

          return tool.available ? (
            <Link key={tool.href} href={tool.href} className="block h-full">
              {card}
            </Link>
          ) : (
            <div key={tool.href} className="block h-full">
              {card}
            </div>
          );
        })}
      </div>
    </div>
  );
}
