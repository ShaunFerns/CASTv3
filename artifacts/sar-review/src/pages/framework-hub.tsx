import { useMemo } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, BookOpen, ExternalLink, Layers3, Map, Settings2, Sparkles, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type FrameworkPage = {
  key: string;
  name: string;
  family: string;
  status: "active" | "placeholder";
  version?: string;
  purpose: string;
  overview: string;
  sourceUrl?: string;
  domains: Array<{ name: string; competences: string[] }>;
  castUse: string;
  examples: string[];
  mapInterpretation: string;
};

const frameworks: FrameworkPage[] = [
  {
    key: "greencomp",
    name: "GreenComp",
    family: "European Frameworks",
    status: "active",
    version: "2022",
    purpose: "Sustainability competence framework for curriculum design and evidence discussion.",
    overview: "GreenComp gives programme teams a shared language for sustainability values, complexity, futures and action.",
    sourceUrl: "https://joint-research-centre.ec.europa.eu/greencomp-european-sustainability-competence-framework_en",
    domains: [
      { name: "Embodying sustainability values", competences: ["Valuing sustainability", "Supporting fairness", "Promoting nature"] },
      { name: "Embracing complexity in sustainability", competences: ["Systems thinking", "Critical thinking", "Problem framing"] },
      { name: "Envisioning sustainable futures", competences: ["Futures literacy", "Adaptability", "Exploratory thinking"] },
      { name: "Acting for sustainability", competences: ["Political agency", "Collective action", "Individual initiative"] },
    ],
    castUse: "CAST uses GreenComp as an evidence-informed layer over modules, descriptors, learning outcomes and assessments.",
    examples: ["Learning outcomes addressing systems thinking", "Assessment briefs involving sustainable futures", "Studio or project work with collective action evidence"],
    mapInterpretation: "GreenComp indicators show observed evidence maturity and linked evidence counts. They are observations for review, not automatic judgements.",
  },
  {
    key: "lifecomp",
    name: "LifeComp",
    family: "European Frameworks",
    status: "active",
    version: "2020",
    purpose: "Personal, social and learning to learn competence framework.",
    overview: "LifeComp supports reflection on personal capacity, social interaction and learning-to-learn evidence across curriculum design.",
    sourceUrl: "https://joint-research-centre.ec.europa.eu/lifecomp_en",
    domains: [
      { name: "Personal", competences: ["Self-regulation", "Flexibility", "Wellbeing"] },
      { name: "Social", competences: ["Empathy", "Communication", "Collaboration"] },
      { name: "Learning to learn", competences: ["Growth mindset", "Critical thinking", "Managing learning"] },
    ],
    castUse: "CAST maps LifeComp evidence without treating the framework as a learner assessment rubric.",
    examples: ["Reflective learning activities", "Collaborative assessment designs", "Wellbeing-aware learning design statements"],
    mapInterpretation: "LifeComp indicators help teams see where personal, social and reflective learning evidence is visible.",
  },
  {
    key: "entrecomp",
    name: "EntreComp",
    family: "European Frameworks",
    status: "active",
    version: "2016",
    purpose: "Entrepreneurship competence framework for value creation, resources and action.",
    overview: "EntreComp helps teams identify evidence of idea generation, value creation, resource use and collaborative action.",
    sourceUrl: "https://publications.jrc.ec.europa.eu/repository/handle/JRC101581",
    domains: [
      { name: "Ideas and opportunities", competences: ["Spotting opportunities", "Creativity", "Vision", "Valuing ideas", "Ethical and sustainable thinking"] },
      { name: "Resources", competences: ["Self-awareness and self-efficacy", "Motivation and perseverance", "Mobilising resources", "Financial and economic literacy", "Mobilising others"] },
      { name: "Into action", competences: ["Taking the initiative", "Planning and management", "Coping with uncertainty, ambiguity and risk", "Working with others", "Learning through experience"] },
    ],
    castUse: "CAST treats EntreComp as a curriculum evidence layer for entrepreneurial capacity, social value and initiative.",
    examples: ["Enterprise project briefs", "Community or industry challenge tasks", "Reflection on value creation and resource choices"],
    mapInterpretation: "EntreComp indicators show where entrepreneurial evidence is visible in the programme structure.",
  },
  {
    key: "digcomp",
    name: "DigComp",
    family: "European Frameworks",
    status: "active",
    version: "3.0",
    purpose: "Digital competence framework for participation, content creation, safety and problem solving.",
    overview: "DigComp gives a common structure for digital competence evidence across learning, work and civic participation.",
    sourceUrl: "https://data.jrc.ec.europa.eu/collection/id-00414",
    domains: [
      { name: "Information and data literacy", competences: ["Browsing, searching and filtering", "Evaluating data and information", "Managing data and information"] },
      { name: "Communication and collaboration", competences: ["Interacting", "Sharing", "Digital citizenship", "Collaborating", "Netiquette", "Digital identity"] },
      { name: "Digital content creation", competences: ["Digital content creation", "Content adaptation", "Copyright and licences", "Programming"] },
      { name: "Safety", competences: ["Protecting devices", "Protecting personal data", "Protecting wellbeing", "Protecting the environment"] },
      { name: "Problem solving", competences: ["Technical problems", "Needs and responses", "Creative technology use", "Digital competence gaps"] },
    ],
    castUse: "CAST maps DigComp evidence across descriptors, learning outcomes, assessments and curated programme structures.",
    examples: ["Digital research tasks", "Data handling activities", "Digital content outputs", "Privacy or safety evidence"],
    mapInterpretation: "DigComp indicators show how digital competence evidence is distributed across modules and stages.",
  },
  {
    key: "engineers-ireland",
    name: "Engineers Ireland",
    family: "Professional and Accreditation Frameworks",
    status: "active",
    version: "2021",
    purpose: "Professional accreditation framework for engineering education programme outcomes.",
    overview: "Engineers Ireland accreditation criteria define programme outcomes, programme areas and programme management expectations for engineering education programmes seeking professional accreditation.",
    domains: [
      { name: "Programme Outcomes", competences: ["Knowledge and Understanding", "Problem Analysis", "Design", "Investigation", "Professional and Ethical Responsibilities", "Teamwork and Lifelong Learning", "Communication", "Engineering Management"] },
      { name: "Programme Areas", competences: ["Science and Mathematics", "Discipline-specific Technology", "Software and Information Systems", "Creativity and Innovation", "Societal and Business Context", "Engineering Practice", "Sustainability"] },
      { name: "Programme Management Criteria", competences: ["Entry Standards, Transfer and Mobility", "Duration and Structure", "Objectives, Resourcing and Viability", "Assessment of Student Performance", "Programme Development and Quality Assurance"] },
    ],
    castUse: "CAST uses Engineers Ireland Programme Outcomes as an evidence-informed professional accreditation layer over modules, programme maps and review workspaces.",
    examples: ["Programme outcomes linked to module evidence", "Accreditation evidence distribution across stages", "Professional and ethical responsibilities visible in descriptors and assessments"],
    mapInterpretation: "Engineers Ireland indicators support accreditation readiness conversations. They are provisional evidence observations until reviewed by the programme team.",
  },
  {
    key: "programme-owned",
    name: "Programme-Owned Frameworks",
    family: "Programme Frameworks",
    status: "placeholder",
    purpose: "Programme graduate attributes, themes, learning threads, signature experiences and programme-specific outcomes.",
    overview: "Programme-owned frameworks let teams express what matters locally without hard-coding a single institutional attribute model.",
    domains: [{ name: "Configurable by programme", competences: ["Graduate attributes", "Programme themes", "Learning threads", "Signature learning experiences", "Programme-specific outcomes"] }],
    castUse: "CAST stores these as programme-owned records and projects them as map layers beside external frameworks.",
    examples: ["A studio signature experience", "A programme theme such as public engagement", "A programme-owned professional identity attribute"],
    mapInterpretation: "Programme layers show expected and observed evidence maturity using the same CAST scale.",
  },
  {
    key: "disciplinary",
    name: "Disciplinary Frameworks",
    family: "Disciplinary Frameworks",
    status: "placeholder",
    purpose: "Disciplinary thinking, practices, threshold concepts and subject-specific capabilities.",
    overview: "Disciplinary frameworks allow CAST to support subject-specific curriculum intelligence without changing the map architecture.",
    domains: [{ name: "Configurable by discipline", competences: ["Ways of thinking", "Threshold concepts", "Disciplinary practices", "Subject-specific capabilities"] }],
    castUse: "CAST will support disciplinary frameworks as configurable layers linked to the same evidence base.",
    examples: ["Engineering judgement", "Computational thinking", "Clinical reasoning", "Design critique"],
    mapInterpretation: "Disciplinary indicators will help teams see where subject-specific evidence appears across the programme.",
  },
  {
    key: "professional-accreditation",
    name: "Professional and Accreditation Frameworks",
    family: "Professional and Accreditation Frameworks",
    status: "placeholder",
    purpose: "Professional body standards, accreditation outcomes, subject benchmarks and qualification descriptors.",
    overview: "Professional and accreditation frameworks can be added when official source text is available for the relevant context.",
    domains: [{ name: "Configurable by source", competences: ["Professional standards", "Accreditation outcomes", "Subject benchmarks", "Qualification descriptors"] }],
    castUse: "CAST will map these frameworks as evidence-informed overlays without replacing human accreditation judgement.",
    examples: ["Programme evidence linked to accreditation outcomes", "Subject benchmark coverage", "Professional practice indicators"],
    mapInterpretation: "Professional indicators should support review preparation and evidence gathering, not automate accreditation decisions.",
  },
];

function pageFor(key?: string) {
  return frameworks.find((framework) => framework.key === key) ?? frameworks[0];
}

export default function FrameworkHub() {
  const [, params] = useRoute("/frameworks/:frameworkKey");
  const selected = pageFor(params?.frameworkKey);
  const isHub = !params?.frameworkKey;
  const totalCompetences = useMemo(() => selected.domains.reduce((sum, domain) => sum + domain.competences.length, 0), [selected]);

  if (!isHub) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <Link href="/frameworks" className="inline-flex items-center gap-2 text-sm font-medium text-blue-700">
          <ArrowLeft className="h-4 w-4" />
          Framework Library
        </Link>
        <section className="rounded border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge variant="outline">{selected.family}</Badge>
                {selected.version && <Badge variant="secondary">Version {selected.version}</Badge>}
                <Badge className={selected.status === "active" ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : "bg-slate-100 text-slate-700 hover:bg-slate-100"}>
                  {selected.status === "active" ? "Available" : "Foundation"}
                </Badge>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">{selected.name}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{selected.overview}</p>
            </div>
            {selected.sourceUrl && (
              <Button asChild variant="outline">
                <a href={selected.sourceUrl} target="_blank" rel="noreferrer">
                  Official Source
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
          <section className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" />Structure</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {selected.domains.map((domain) => (
                  <div key={domain.name} className="rounded border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-sm font-semibold text-slate-900">{domain.name}</h2>
                      <Badge variant="outline">{domain.competences.length}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {domain.competences.map((competence) => <Badge key={competence} variant="secondary">{competence}</Badge>)}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Map className="h-5 w-5" />How CAST Uses This Framework</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-600">
                <p>{selected.castUse}</p>
                <p>{selected.mapInterpretation}</p>
                <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                  Framework intelligence appears in Module Builder, Programme Workspace and Programme Maps. This library explains framework meaning, structure and use.
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" />Example Uses</CardTitle></CardHeader>
              <CardContent className="grid gap-2 md:grid-cols-3">
                {selected.examples.map((example) => <div key={example} className="rounded border border-slate-200 px-3 py-2 text-sm text-slate-600">{example}</div>)}
              </CardContent>
            </Card>
          </section>

          <aside className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Layers3 className="h-5 w-5" />At a Glance</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded border border-slate-200 p-4"><div className="text-2xl font-bold">{selected.domains.length}</div><div className="text-xs text-slate-500">Areas or domains</div></div>
                <div className="rounded border border-slate-200 p-4"><div className="text-2xl font-bold">{totalCompetences}</div><div className="text-xs text-slate-500">Competencies or attributes</div></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5" />Framework Management</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-600">
                <p>Create, import and manage custom frameworks here as CAST framework authoring is expanded.</p>
                <div className="grid gap-2">
                  <Button variant="outline" disabled>Create Framework</Button>
                  <Button variant="outline" disabled>Import Framework</Button>
                  <Button variant="outline" disabled>Manage Versions</Button>
                </div>
                <p className="text-xs text-slate-500">Current seeded frameworks remain managed by CAST system seeds.</p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <section className="rounded border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">Framework Library</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Learn what each framework means, how it is structured, and how CAST can use it as curriculum evidence context. Coverage, gaps and maturity intelligence live in Module Builder, Programme Workspace and Programme Maps.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/programme/map">
              View Framework Intelligence
              <Map className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <Card className="border-blue-100 bg-blue-50/60">
        <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h2 className="font-semibold text-slate-950">Custom Framework Management</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Framework Library is the home for creating, importing and managing framework definitions, versions and metadata. Authoring controls are intentionally separate from curriculum intelligence views.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled><Sparkles className="mr-2 h-4 w-4" />Create Framework</Button>
            <Button variant="outline" disabled><Upload className="mr-2 h-4 w-4" />Import Framework</Button>
            <Button variant="outline" disabled><Settings2 className="mr-2 h-4 w-4" />Manage Frameworks</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {frameworks.map((framework) => (
          <Link key={framework.key} href={`/frameworks/${framework.key}`} className="group rounded border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge variant="outline">{framework.family}</Badge>
                <h2 className="mt-3 text-lg font-semibold text-slate-950 group-hover:text-blue-700">{framework.name}</h2>
              </div>
              <Badge className={framework.status === "active" ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : "bg-slate-100 text-slate-700 hover:bg-slate-100"}>
                {framework.status === "active" ? "Available" : "Foundation"}
              </Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{framework.purpose}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="secondary">{framework.domains.length} areas</Badge>
              <Badge variant="secondary">{framework.domains.reduce((sum, domain) => sum + domain.competences.length, 0)} items</Badge>
              {framework.version && <Badge variant="secondary">{framework.version}</Badge>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
