export type FrameworkFamilyKey =
  | "european"
  | "curriculum_design"
  | "institutional"
  | "programme"
  | "disciplinary"
  | "professional_accreditation";

export type FrameworkFamily = {
  key: FrameworkFamilyKey;
  name: string;
  description: string;
  examples: string[];
  color: string;
};

export type RegisteredFramework = {
  key: string;
  name: string;
  family: FrameworkFamilyKey;
  ownerScope: "system" | "institution" | "programme";
  description: string;
  source: "registry" | "database" | "programme";
  versionLabel?: string;
  sourceUrl?: string;
  frameworkId?: string;
  frameworkVersionId?: string;
  programmeVersionId?: string;
  metadata?: Record<string, unknown>;
};

export const frameworkFamilies: FrameworkFamily[] = [
  {
    key: "european",
    name: "European Frameworks",
    description: "European competence and capacity frameworks that can be layered over curriculum evidence.",
    examples: ["DigComp", "GreenComp", "EntreComp", "LifeComp", "DigCompEdu", "DigCompOrg", "ResearchComp", "e-CF"],
    color: "blue",
  },
  {
    key: "curriculum_design",
    name: "Curriculum Design Layers",
    description: "Programme-level design layers that review curriculum balance, assessment patterns and evidence quality.",
    examples: ["Assessment", "Assessment balance", "Assessment diversity", "Workload", "Feedback evidence"],
    color: "cyan",
  },
  {
    key: "institutional",
    name: "Institutional Frameworks",
    description: "Institution-owned priorities, graduate attributes, readiness models and strategic curriculum lenses.",
    examples: ["Graduate Attributes", "DELTA Readiness", "Employability", "Sustainability", "Strategic Priorities"],
    color: "emerald",
  },
  {
    key: "programme",
    name: "Programme Frameworks",
    description: "Programme-owned graduate attributes, themes, learning threads and accreditation outcomes.",
    examples: ["Programme Graduate Attributes", "Programme Themes", "Learning Threads", "Signature Learning Experiences"],
    color: "violet",
  },
  {
    key: "disciplinary",
    name: "Disciplinary Frameworks",
    description: "Discipline-specific ways of thinking, practising, creating and reasoning.",
    examples: ["Engineering Thinking", "Computational Thinking", "Historical Thinking", "Clinical Reasoning", "Design Thinking"],
    color: "amber",
  },
  {
    key: "professional_accreditation",
    name: "Professional and Accreditation Frameworks",
    description: "Professional body standards, subject benchmarks and qualification descriptors.",
    examples: ["Engineers Ireland", "ACCA", "BCS", "NMBI", "Subject Benchmark Statements", "National Qualification Descriptors"],
    color: "rose",
  },
];

export const registryFrameworks: RegisteredFramework[] = [
  {
    key: "greencomp",
    name: "GreenComp",
    family: "european",
    ownerScope: "system",
    description: "European sustainability competence framework.",
    source: "registry",
    versionLabel: "2022",
    sourceUrl: "https://joint-research-centre.ec.europa.eu/greencomp-european-sustainability-competence-framework_en",
  },
  {
    key: "digcomp",
    name: "DigComp",
    family: "european",
    ownerScope: "system",
    description: "European digital competence framework for citizens.",
    source: "registry",
    versionLabel: "3.0",
    sourceUrl: "https://data.jrc.ec.europa.eu/collection/id-00414",
  },
  {
    key: "entrecomp",
    name: "EntreComp",
    family: "european",
    ownerScope: "system",
    description: "European entrepreneurship competence framework.",
    source: "registry",
    versionLabel: "2016",
    sourceUrl: "https://publications.jrc.ec.europa.eu/repository/handle/JRC101581",
  },
  {
    key: "lifecomp",
    name: "LifeComp",
    family: "european",
    ownerScope: "system",
    description: "European personal, social and learning to learn competence framework.",
    source: "registry",
    versionLabel: "2020",
    sourceUrl: "https://joint-research-centre.ec.europa.eu/lifecomp_en",
  },
  {
    key: "assessment-design",
    name: "Assessment",
    family: "curriculum_design",
    ownerScope: "system",
    description: "Evidence-informed programme map layer for assessment completeness, balance, alignment and risk.",
    source: "registry",
    versionLabel: "1.0",
    metadata: { designLayer: true, notACompetencyFramework: true, programmeMapLayer: true, moduleBuilderLayer: true },
  },
  {
    key: "modality-design",
    name: "Modality Design",
    family: "curriculum_design",
    ownerScope: "system",
    description: "Evidence-informed curriculum design layer for delivery modality fit, feasibility and risk.",
    source: "registry",
    versionLabel: "1.0",
    metadata: { designLayer: true, notACompetencyFramework: true, programmeMapLayer: false, moduleBuilderLayer: true },
  },
  {
    key: "researchcomp",
    name: "ResearchComp",
    family: "european",
    ownerScope: "system",
    description: "European competence framework for researchers.",
    source: "registry",
  },
  {
    key: "delta-readiness",
    name: "DELTA Readiness",
    family: "institutional",
    ownerScope: "institution",
    description: "Institutional readiness model for teaching, learning and assessment enhancement.",
    source: "registry",
  },
  {
    key: "institutional-priorities",
    name: "Institutional Strategic Priorities",
    family: "institutional",
    ownerScope: "institution",
    description: "Institution-defined strategic priorities used as curriculum layers.",
    source: "registry",
  },
  {
    key: "computational-thinking",
    name: "Computational Thinking",
    family: "disciplinary",
    ownerScope: "system",
    description: "A disciplinary thinking layer for computing and digitally intensive programmes.",
    source: "registry",
  },
  {
    key: "engineering-thinking",
    name: "Engineering Thinking",
    family: "disciplinary",
    ownerScope: "system",
    description: "A disciplinary thinking layer for engineering judgement, design and systems practice.",
    source: "registry",
  },
  {
    key: "professional-standards",
    name: "Professional Body Standards",
    family: "professional_accreditation",
    ownerScope: "institution",
    description: "A placeholder layer for professional and accreditation standards.",
    source: "registry",
  },
  {
    key: "programme-owned-frameworks",
    name: "Programme-Owned Frameworks",
    family: "programme",
    ownerScope: "programme",
    description: "Programme-defined attributes, themes, learning threads, signature learning experiences and outcomes.",
    source: "registry",
  },
  {
    key: "disciplinary-frameworks",
    name: "Disciplinary Frameworks",
    family: "disciplinary",
    ownerScope: "institution",
    description: "Disciplinary ways of thinking, threshold concepts, practices and subject-specific capabilities.",
    source: "registry",
  },
  {
    key: "professional-accreditation-frameworks",
    name: "Professional and Accreditation Frameworks",
    family: "professional_accreditation",
    ownerScope: "institution",
    description: "Professional standards, accreditation outcomes, subject benchmarks and qualification descriptors.",
    source: "registry",
  },
];

export function defaultVersionForFramework(frameworkKey: string): string {
  return registryFrameworks.find((framework) => framework.key === frameworkKey)?.versionLabel ?? "2022";
}

export function frameworkFamilyFromMetadata(metadata: Record<string, unknown> | null | undefined): FrameworkFamilyKey | undefined {
  const family = typeof metadata?.["family"] === "string" ? metadata["family"] : undefined;
  return frameworkFamilies.some((candidate) => candidate.key === family) ? (family as FrameworkFamilyKey) : undefined;
}
