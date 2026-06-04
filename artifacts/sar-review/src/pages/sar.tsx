import { Link } from "wouter";
import { LayoutDashboard, Upload, PieChart, BookOpen, Brain, FileCheck2, ArrowRight, Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const SAR_CRITERIA: Record<string, string[]> = {
  "Language Studies": ["Language skills development", "Linguistic or structural analysis", "Cultural and contextual understanding", "Communicative competence", "Reflection on language learning"],
  "Quantitative Analysis": ["Numerical and mathematical reasoning", "Data interpretation and analysis", "Statistical methods", "Quantitative problem solving", "Critical evaluation of evidence"],
  "Writing & Text Analysis": ["Academic writing development", "Critical reading", "Textual interpretation and critique", "Genre and discipline awareness", "Reflection on writing process"],
  "Health / Wellness / Sports": ["Health and wellbeing concepts", "Sport, exercise, or physical activity", "Psychological and behavioural dimensions", "Evidence-based practice", "Lifestyle and public health"],
  "Sustainability": ["Environmental sustainability", "Social sustainability", "Economic sustainability", "Systems thinking", "Action and responsibility"],
  "Communications": ["Oral communication", "Written communication", "Media and multimodal communication", "Audience and context awareness", "Professional communication competence"],
  "Creativity": ["Creative practice or production", "Creative thinking and ideation", "Critical reflection on creativity", "Collaboration and co-creation", "Innovation and originality"],
  "Digital Literacy": ["Digital tools and technologies", "Data literacy and information management", "Critical digital engagement", "Digital communication and collaboration", "Ethics and digital citizenship"],
};

const panels = [
  {
    href: "/upload",
    icon: Upload,
    title: "Upload Modules",
    description:
      "Import module descriptors via PDF, Excel batch file, or manual entry to begin the classification workflow.",
    color: "#003865",
    accent: "border-[#003865]",
    hover: "hover:border-[#003865]",
  },
  {
    href: "/dashboard",
    icon: LayoutDashboard,
    title: "SAR Dashboard",
    description:
      "View all uploaded modules, filter by SAR category, score band or status, and export your review data to CSV.",
    color: "#003865",
    accent: "border-[#003865]",
    hover: "hover:border-[#003865]",
  },
  {
    href: "/free-electives",
    icon: Sparkles,
    title: "Free Electives Dashboard",
    description:
      "Classify modules by discipline family and view AI-generated suitability scores for free elective advising.",
    color: "#F5A800",
    accent: "border-[#F5A800]",
    hover: "hover:border-[#F5A800]",
  },
  {
    href: "/summary",
    icon: PieChart,
    title: "Analytics Summary",
    description:
      "Explore aggregate scoring statistics and SAR distribution charts across all reviewed Arts programme modules.",
    color: "#003865",
    accent: "border-[#003865]",
    hover: "hover:border-[#003865]",
  },
];

const features = [
  {
    icon: Brain,
    title: "AI-Powered Classification",
    description:
      "Each module is automatically classified against the 8 Subject Area Requirements using GPT-based analysis of the module content.",
  },
  {
    icon: FileCheck2,
    title: "Evidence-Based Scoring",
    description:
      "Criteria are scored 1–4 based on textual evidence in the module descriptor. Reviewers can verify and override all AI suggestions.",
  },
  {
    icon: BookOpen,
    title: "Arts Programme SARs",
    description:
      "Covers all 8 SAR categories: Language Studies, Quantitative Analysis, Writing & Text Analysis, Health/Wellness/Sports, Sustainability, Communications, Creativity, and Digital Literacy.",
  },
  {
    icon: Sparkles,
    title: "Free Elective Analysis",
    description:
      "Modules are assessed for free elective suitability: AI assigns a discipline family, a suitability score (1–5), and advising tags. Results are reviewed in the Free Electives Dashboard and exportable for programme planning.",
  },
];

export default function Home() {
  return (
    <div className="space-y-16 animate-in fade-in duration-500 pb-12">
      {/* Hero */}
      <div className="text-center space-y-6 pt-8">
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
          <span className="font-semibold" style={{ color: "#003865" }}>CAST – Curriculum Analysis & Structuring Tool</span>{" "}
          supports programme teams in analysing module descriptors for SAR alignment and free elective
          planning. It is designed to improve visibility, consistency, and curriculum decision-making
          while keeping academic judgement with programme teams.
        </p>
        <div className="flex items-center justify-center gap-4 pt-2">
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white shadow-md transition-all hover:opacity-90 hover:shadow-lg"
            style={{ backgroundColor: "#003865" }}
          >
            Get Started <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Three main panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {panels.map((panel) => {
          const Icon = panel.icon;
          return (
            <Link key={panel.href} href={panel.href} className="block h-full">
              <div
                className={`group relative bg-white rounded-xl border-2 p-7 shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer h-full ${panel.hover} border-slate-200`}
              >
                <div
                  className="inline-flex items-center justify-center w-12 h-12 rounded-lg mb-4"
                  style={{ backgroundColor: panel.color }}
                >
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-xl font-bold mb-2" style={{ color: "#003865" }}>
                  {panel.title}
                </h2>
                <p className="text-slate-500 text-sm leading-relaxed">{panel.description}</p>
                <div
                  className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <ArrowRight className="w-5 h-5" style={{ color: panel.color }} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* How it works */}
      <div>
        <h2
          className="text-2xl font-bold text-center mb-8"
          style={{ color: "#003865" }}
        >
          How It Works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <div
                  className="inline-flex items-center justify-center w-10 h-10 rounded-lg mb-4"
                  style={{ backgroundColor: "rgba(0,56,101,0.08)" }}
                >
                  <Icon className="w-5 h-5" style={{ color: "#003865" }} />
                </div>
                <h3 className="font-bold text-base mb-2" style={{ color: "#003865" }}>
                  {f.title}
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* SAR Categories quick reference */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
        <h2 className="text-xl font-bold mb-5" style={{ color: "#003865" }}>
          The 8 Subject Area Requirements (SARs)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.keys(SAR_CRITERIA).map((sar, i) => (
            <Tooltip key={sar} delayDuration={100}>
              <TooltipTrigger asChild>
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium cursor-default select-none transition-colors hover:brightness-95"
                  style={{ backgroundColor: "rgba(0,56,101,0.06)", color: "#003865" }}
                >
                  <span
                    className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold"
                    style={{ backgroundColor: "#F5A800", color: "#003865" }}
                  >
                    {i + 1}
                  </span>
                  {sar}
                </div>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="max-w-[240px] p-3"
                style={{ backgroundColor: "#003865", color: "white", border: "none" }}
              >
                <p className="font-semibold text-xs mb-2 opacity-70 uppercase tracking-wider">5 Criteria</p>
                <ol className="space-y-1">
                  {SAR_CRITERIA[sar].map((criterion, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs">
                      <span
                        className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
                        style={{ backgroundColor: "#F5A800", color: "#003865" }}
                      >
                        {j + 1}
                      </span>
                      {criterion}
                    </li>
                  ))}
                </ol>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </div>
  );
}
