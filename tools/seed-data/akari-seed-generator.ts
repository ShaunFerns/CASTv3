import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

type Row = Record<string, string | number | null>;

type GeneratorConfig = {
  schoolCount: number;
  programmeCount: number;
  moduleCount: number;
  seed: number;
  includeDataQualityIssues: boolean;
  outputPath: string;
};

type Programme = {
  code: string;
  title: string;
  version: string;
  school: string;
  campus: string;
  postgraduate?: boolean;
  themes: string[];
};

type Module = {
  moduleId: string;
  deliveryPeriodId: string;
  moduleCode: string;
  shortTitle: string;
  longTitle: string;
  school: string;
  faculty: string;
  campus: string;
  version: string;
  effectiveFrom: string;
  credits: number | null;
  level: string | null;
  language: string;
  coordinator: string;
  stage: number;
  semester: string | null;
  themes: string[];
  prerequisiteCodes: string[];
  assessments: Assessment[];
  learningOutcomes: Array<{ code: string; description: string | null }>;
  overview: string;
  syllabus: string;
  teachingMethods: string;
  modality: Modality;
};

type Assessment = {
  category: string;
  type: string;
  percentage: number;
  week: string;
  semester: string | null;
  passFail: string;
  threshold: string;
  authenticity: string;
  outcomes: string;
  description: string;
};

type Modality = {
  summary: string;
  attendance: string;
  category: string;
  deliveryMode: string;
  location: string;
};

const schema: Record<string, string[]> = {
  "Affiliated Programmes": [
    "Module Id",
    "Delivery Period Id",
    "Module Code",
    "Module Short Title",
    "Module Long Title",
    "School",
    "Faculty",
    "Campus",
    "Version",
    "Effective From",
    "ECTS Credits",
    "Level",
    "Language of Instruction",
    "Current Coordinator",
    "Programme Code",
    "Programme Title",
    "Programme Version",
  ],
  "Module Assessments": [
    "Module Id",
    "Delivery Period Id",
    "Module Code",
    "Module Short Title",
    "Module Long Title",
    "School",
    "Faculty",
    "Campus",
    "Version",
    "Effective From",
    "ECTS Credits",
    "Level",
    "Language of Instruction",
    "Current Coordinator",
    "Assessment Category",
    "Assessment Type",
    "Percentage of Total",
    "Indicative Week",
    "Semester",
    "Pass/Fail",
    "Assessment Threshold",
    "Assessment Authenticity",
    "Learning Outcomes Addressed",
    "Assessment Description",
  ],
  "Learning Outcomes": [
    "Module Id",
    "Delivery Period Id",
    "Module Code",
    "Module Short Title",
    "Module Long Title",
    "School",
    "Faculty",
    "Campus",
    "Version",
    "Effective From",
    "ECTS Credits",
    "Level",
    "Language of Instruction",
    "Current Coordinator",
    "Learning Outcome Code",
    "Learning Outcome Description",
  ],
  "Requisites": [
    "Module Id",
    "Delivery Period Id",
    "Module Code",
    "Module Short Title",
    "Module Long Title",
    "School",
    "Faculty",
    "Campus",
    "Version",
    "Effective From",
    "ECTS Credits",
    "Level",
    "Language of Instruction",
    "Current Coordinator",
    "Requisite Type",
    "Module Title",
    "Type",
    "Requisites Note",
  ],
  "Assessment Threshold Label": [
    "Module Id",
    "Delivery Period Id",
    "Module Code",
    "Module Short Title",
    "Module Long Title",
    "School",
    "Faculty",
    "Campus",
    "Version",
    "Effective From",
    "ECTS Credits",
    "Level",
    "Language of Instruction",
    "Current Coordinator",
    "Assessment Threshold Label",
    "Assessment Threshold Label Embedded Tables",
  ],
  "Sharing Arrangements": [
    "Module Id",
    "Delivery Period Id",
    "Module Code",
    "Module Short Title",
    "Module Long Title",
    "School",
    "Faculty",
    "Campus",
    "Version",
    "Effective From",
    "ECTS Credits",
    "Level",
    "Language of Instruction",
    "Current Coordinator",
    "Outline of Sharing Arrangements for Programmes",
    "Sharing Arrangements Embedded Tables",
  ],
  "Module Overview": [
    "Module Id",
    "Delivery Period Id",
    "Module Code",
    "Module Short Title",
    "Module Long Title",
    "School",
    "Faculty",
    "Campus",
    "Version",
    "Effective From",
    "ECTS Credits",
    "Level",
    "Language of Instruction",
    "Current Coordinator",
    "Module Overview",
    "Module Overview Embedded Tables",
  ],
  "Indicative Syllabus": [
    "Module Id",
    "Delivery Period Id",
    "Module Code",
    "Module Short Title",
    "Module Long Title",
    "School",
    "Faculty",
    "Campus",
    "Version",
    "Effective From",
    "ECTS Credits",
    "Level",
    "Language of Instruction",
    "Current Coordinator",
    "Indicative Syllabus",
    "Indicative Syllabus Embedded Tables",
  ],
  "Indicative Syllabus New Table": [
    "Module Id",
    "Delivery Period Id",
    "Module Code",
    "Module Short Title",
    "Module Long Title",
    "School",
    "Faculty",
    "Campus",
    "Version",
    "Effective From",
    "ECTS Credits",
    "Level",
    "Language of Instruction",
    "Current Coordinator",
    "Indicative Syllabus New Table",
  ],
  "Learning Teaching Methods": [
    "Module Id",
    "Delivery Period Id",
    "Module Code",
    "Module Short Title",
    "Module Long Title",
    "School",
    "Faculty",
    "Campus",
    "Version",
    "Effective From",
    "ECTS Credits",
    "Level",
    "Language of Instruction",
    "Current Coordinator",
    "Learning and Teaching Methods",
    "Learning and Teaching Methods Embedded Tables",
  ],
  "Change Description": [
    "Module Id",
    "Delivery Period Id",
    "Module Code",
    "Module Short Title",
    "Module Long Title",
    "School",
    "Faculty",
    "Campus",
    "Version",
    "Effective From",
    "ECTS Credits",
    "Level",
    "Language of Instruction",
    "Current Coordinator",
    "Change Description",
  ],
  "Reassessment Requirement": [
    "Module Id",
    "Delivery Period Id",
    "Module Code",
    "Module Short Title",
    "Module Long Title",
    "School",
    "Faculty",
    "Campus",
    "Version",
    "Effective From",
    "ECTS Credits",
    "Level",
    "Language of Instruction",
    "Current Coordinator",
    "Reassessment Requirement",
    "Special Repeat Arrangements",
  ],
  "Derogations": [
    "Module Id",
    "Delivery Period Id",
    "Module Code",
    "Module Short Title",
    "Module Long Title",
    "School",
    "Faculty",
    "Campus",
    "Version",
    "Effective From",
    "ECTS Credits",
    "Level",
    "Language of Instruction",
    "Current Coordinator",
    "Derogations",
  ],
  "Module Modalities": [
    "Module Id",
    "Delivery Period Id",
    "Module Code",
    "Module Short Title",
    "Module Long Title",
    "School",
    "Faculty",
    "Campus",
    "Version",
    "Effective From",
    "ECTS Credits",
    "Level",
    "Language of Instruction",
    "Current Coordinator",
    "Module Modalities",
    "Module Modalities Embedded Tables",
    "Full Time / Part Time Module Modalities",
    "Module Category Module Modalities",
    "Modality Delivery Mode Module Modalities",
    "Location Module Modalities",
    "Availabilities Code Module Modalities",
    "Start Date Module Modalities",
    "Year Module Modalities",
    "Teaching Period Key Date Module Modalities",
    "End Date Module Modalities",
    "Deferral Allowed Module Modalities",
  ],
};

const schools = [
  "School of Computing",
  "School of Engineering",
  "School of Science",
  "School of Business",
  "School of Creative Arts",
  "School of Education",
  "School of Health",
  "School of Sustainability",
];

const programmes: Programme[] = [
  { code: "DSC01", title: "BSc Data Science", version: "2026", school: "School of Computing", campus: "City Campus", themes: ["data", "digital", "research"] },
  { code: "CYB01", title: "BSc Cyber Security", version: "2026", school: "School of Computing", campus: "City Campus", themes: ["security", "digital", "ethics"] },
  { code: "AAI01", title: "BSc Applied Artificial Intelligence", version: "2026", school: "School of Computing", campus: "City Campus", themes: ["ai", "digital", "ethics"] },
  { code: "REN01", title: "BSc Renewable Energy Systems", version: "2026", school: "School of Engineering", campus: "Engineering Campus", themes: ["sustainability", "energy", "systems"] },
  { code: "SMF01", title: "BEng Smart Manufacturing", version: "2026", school: "School of Engineering", campus: "Engineering Campus", themes: ["manufacturing", "digital", "systems"] },
  { code: "HIN01", title: "BSc Health Informatics", version: "2026", school: "School of Health", campus: "Health Campus", themes: ["health", "data", "ethics"] },
  { code: "DGM01", title: "BA Digital Media", version: "2026", school: "School of Creative Arts", campus: "Creative Campus", themes: ["media", "digital", "creativity"] },
  { code: "CRI01", title: "BA Creative Industries", version: "2026", school: "School of Creative Arts", campus: "Creative Campus", themes: ["creativity", "enterprise", "culture"] },
  { code: "EDT01", title: "BA Education Technology", version: "2026", school: "School of Education", campus: "Education Campus", themes: ["education", "digital", "inclusion"] },
  { code: "SCO01", title: "BSc Sustainable Construction", version: "2026", school: "School of Sustainability", campus: "Sustainability Campus", themes: ["sustainability", "construction", "systems"] },
  { code: "BIN01", title: "BA Business Innovation", version: "2026", school: "School of Business", campus: "Business Campus", themes: ["business", "enterprise", "innovation"] },
  { code: "MDT01", title: "MSc Digital Transformation", version: "2026", school: "School of Business", campus: "City Campus", postgraduate: true, themes: ["digital", "leadership", "enterprise"] },
];

const commonModuleTitles = [
  "Academic and Professional Skills",
  "Digital Capability for Higher Education",
  "Sustainability in Society",
  "Systems Thinking and Change",
  "Data Literacy and Visualisation",
  "Research Methods",
  "Ethics, Inclusion and Responsible Practice",
  "Innovation and Entrepreneurship",
  "Project Management for Practice",
  "Collaborative Problem Solving",
  "Evidence-Based Decision Making",
  "Communication for Impact",
  "Community Engaged Learning",
  "Design Thinking Studio",
  "Workplace Learning and Reflection",
  "Applied Statistics",
  "Policy, Regulation and Governance",
  "Human-Centred Design",
  "Professional Portfolio",
  "Applied Research Project",
  "Capstone Project",
  "Technology, Society and Environment",
  "Responsible AI and Data Ethics",
  "Enterprise Challenge",
];

const progressionTitles = [
  "Programming Fundamentals",
  "Object Oriented Programming",
  "Software Engineering",
  "Advanced Application Development",
  "Data Analytics",
  "Machine Learning",
  "Applied AI",
  "Cyber Defence Operations",
  "Cloud Systems Engineering",
  "Renewable Energy Technologies",
  "Energy Systems Modelling",
  "Smart Manufacturing Systems",
  "Robotics and Automation",
  "Health Data Management",
  "Clinical Decision Support",
  "Digital Media Production",
  "Interactive Storytelling",
  "Creative Enterprise Practice",
  "Learning Design",
  "Educational Analytics",
  "Sustainable Construction Materials",
  "Circular Built Environment",
  "Business Model Innovation",
  "Digital Transformation Strategy",
];

const verbs = ["Analyse", "Evaluate", "Design", "Apply", "Create", "Critique", "Synthesise", "Reflect on"];
const assessmentTypes = ["Examination", "Project", "Portfolio", "Presentation", "Group Work", "Practical Assessment", "Reflective Journal", "Report"];
const coordinators = ["Dr Aisha Byrne", "Dr Liam O'Connor", "Prof Maya Chen", "Dr Sofia Martins", "Dr Niamh Kelly", "Dr Omar Rahman", "Dr Eva Nolan", "Dr Daniel Walsh"];
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function parseArgs(argv: string[]): GeneratorConfig {
  const defaults: GeneratorConfig = {
    schoolCount: 8,
    programmeCount: 12,
    moduleCount: 144,
    seed: 20260610,
    includeDataQualityIssues: false,
    outputPath: "sample-data/akari_seed_university_v1.xlsx",
  };

  for (const arg of argv) {
    const [key, value] = arg.split("=");
    if (key === "--schools" && value) defaults.schoolCount = Number(value);
    if (key === "--programmes" && value) defaults.programmeCount = Number(value);
    if (key === "--modules" && value) defaults.moduleCount = Number(value);
    if (key === "--seed" && value) defaults.seed = Number(value);
    if (key === "--output" && value) defaults.outputPath = value;
    if (key === "--include-data-quality-issues") defaults.includeDataQualityIssues = true;
  }

  return {
    ...defaults,
    schoolCount: Math.min(Math.max(defaults.schoolCount, 1), schools.length),
    programmeCount: Math.min(Math.max(defaults.programmeCount, 1), programmes.length),
    moduleCount: Math.max(defaults.moduleCount, 24),
    seed: Number.isFinite(defaults.seed) ? defaults.seed : 20260610,
  };
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function pick<T>(items: T[], rand: () => number): T {
  return items[Math.floor(rand() * items.length) % items.length];
}

function titleKey(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function schoolPrefix(school: string): string {
  const prefixes: Record<string, string> = {
    "School of Computing": "COMP",
    "School of Engineering": "ENG",
    "School of Science": "SCI",
    "School of Business": "BUS",
    "School of Creative Arts": "ART",
    "School of Education": "EDU",
    "School of Health": "HLTH",
    "School of Sustainability": "SUST",
  };
  return prefixes[school] ?? "CAST";
}

function stageToLevel(stage: number, postgraduate = false): string {
  if (postgraduate) return "Level 9";
  return `Level ${Math.min(8, 5 + stage)}`;
}

function baseRow(module: Module): Row {
  return {
    "Module Id": module.moduleId,
    "Delivery Period Id": module.deliveryPeriodId,
    "Module Code": module.moduleCode,
    "Module Short Title": module.shortTitle,
    "Module Long Title": module.longTitle,
    School: module.school,
    Faculty: module.faculty,
    Campus: module.campus,
    Version: module.version,
    "Effective From": module.effectiveFrom,
    "ECTS Credits": module.credits,
    Level: module.level,
    "Language of Instruction": module.language,
    "Current Coordinator": module.coordinator,
  };
}

function moduleOverview(module: Module): string {
  const themeText = module.themes.join(", ");
  return `${module.longTitle} develops evidence-informed curriculum capability through ${themeText}. Students engage with authentic higher education and professional contexts, using data, sustainability, digital practice, collaboration and reflective judgement to respond to complex problems. The module supports responsible decision making, inclusive participation and practical outputs that can be evidenced in a programme map.`;
}

function syllabus(module: Module): string {
  const topics = [
    `Foundations of ${module.shortTitle.toLowerCase()}`,
    "Evidence gathering, interpretation and communication",
    "Sustainability, ethics and responsible practice",
    "Digital tools, data handling and critical evaluation",
    "Collaboration, enterprise thinking and stakeholder engagement",
    "Applied project or case-based synthesis",
  ];
  return topics.map((topic, index) => `${index + 1}. ${topic}`).join("\n");
}

function teachingMethods(module: Module): string {
  const methods = [
    "interactive seminars",
    "applied laboratories or studios",
    "guided online preparation",
    "team-based problem solving",
    "structured reflection",
    "project supervision",
  ];
  return `Learning is supported through ${methods.join(", ")}. Students work with realistic briefs, open datasets, design scenarios and sustainability challenges. Activities include peer critique, formative checkpoints and opportunities to connect module evidence to programme-level graduate attributes.`;
}

function generateLearningOutcomes(module: Module, rand: () => number): Array<{ code: string; description: string | null }> {
  const contexts = [
    "disciplinary evidence",
    "digital tools and data sources",
    "sustainability implications",
    "stakeholder needs",
    "ethical and inclusive practice",
    "project outcomes",
    "professional communication",
  ];
  const count = 5 + Math.floor(rand() * 2);
  return Array.from({ length: count }, (_, index) => {
    const verb = verbs[(index + Math.floor(rand() * verbs.length)) % verbs.length];
    const context = contexts[(index + Math.floor(rand() * contexts.length)) % contexts.length];
    return {
      code: `MLO${index + 1}`,
      description: `${verb} ${context} in relation to ${module.shortTitle.toLowerCase()} and justify decisions using appropriate evidence, reflection and professional standards.`,
    };
  });
}

function generateAssessments(module: Module, rand: () => number): Assessment[] {
  const weights = module.stage >= 4 || module.shortTitle.toLowerCase().includes("capstone") ? [20, 30, 50] : [30, 30, 40];
  return weights.map((percentage, index) => {
    const type = module.shortTitle.toLowerCase().includes("laboratory") ? "Practical Assessment" : assessmentTypes[(index + Math.floor(rand() * assessmentTypes.length)) % assessmentTypes.length];
    const category = type === "Examination" ? "Examination" : "Coursework";
    return {
      category,
      type,
      percentage,
      week: index === 0 ? "Week 6" : index === 1 ? "Week 10" : "Semester End",
      semester: module.semester,
      passFail: "No",
      threshold: percentage >= 50 ? "Minimum mark of 40%" : "No separate threshold",
      authenticity: type === "Group Work" ? "Group contribution and individual reflection required" : "Individual evidence of learning required",
      outcomes: index === 0 ? "MLO1,MLO2" : index === 1 ? "MLO3,MLO4" : "MLO4,MLO5,MLO6",
      description: `${type} requiring students to apply evidence, communicate decisions and demonstrate ${module.themes.slice(0, 2).join(" and ")} capability in an authentic curriculum context.`,
    };
  });
}

function generateModality(module: Module, rand: () => number): Modality {
  const delivery = module.themes.includes("studio")
    ? "Studio"
    : module.themes.includes("laboratory") || module.school.includes("Science") || module.school.includes("Engineering")
      ? "Laboratory"
      : pick(["On Campus", "Hybrid", "Online", "Fieldwork", "Work Placement"], rand);
  const attendance = delivery === "Online" ? "Part Time" : pick(["Full Time", "Full Time / Part Time"], rand);
  const category = module.shortTitle.toLowerCase().includes("placement") ? "Work Placement" : module.stage >= 4 ? "Project" : "Taught";
  return {
    summary: `${delivery} learning with structured preparation, collaborative activity and evidence-based reflection.`,
    attendance,
    category,
    deliveryMode: delivery,
    location: delivery === "Online" ? "Online" : module.campus,
  };
}

function moduleThemes(title: string, programmeThemes: string[]): string[] {
  const key = titleKey(title);
  const themes = new Set(programmeThemes);
  if (key.includes("sustain") || key.includes("energy") || key.includes("construction") || key.includes("environment")) themes.add("sustainability");
  if (key.includes("data") || key.includes("digital") || key.includes("programming") || key.includes("ai") || key.includes("cyber")) themes.add("digital");
  if (key.includes("enterprise") || key.includes("innovation") || key.includes("business")) themes.add("enterprise");
  if (key.includes("research") || key.includes("dissertation")) themes.add("research");
  if (key.includes("studio") || key.includes("media") || key.includes("design")) themes.add("studio");
  if (key.includes("laboratory") || key.includes("practical")) themes.add("laboratory");
  themes.add("collaboration");
  return [...themes].slice(0, 5);
}

function createModule(input: {
  index: number;
  title: string;
  school: string;
  campus: string;
  stage: number;
  semester: "Semester 1" | "Semester 2";
  credits: number;
  themes: string[];
  postgraduate?: boolean;
  rand: () => number;
}): Module {
  const serial = String(input.index + 1).padStart(3, "0");
  const prefix = schoolPrefix(input.school);
  const moduleCode = `${prefix} H${input.stage}${serial}`;
  const module: Module = {
    moduleId: String(10000 + input.index),
    deliveryPeriodId: `DP-${input.stage}-${input.semester.endsWith("1") ? "1" : "2"}`,
    moduleCode,
    shortTitle: input.title,
    longTitle: input.title,
    school: input.school,
    faculty: input.school.replace("School of ", "Faculty of "),
    campus: input.campus,
    version: "1",
    effectiveFrom: "Sep 2026 ( September 2026 )",
    credits: input.credits,
    level: stageToLevel(input.stage, input.postgraduate),
    language: "English",
    coordinator: coordinators[input.index % coordinators.length],
    stage: input.stage,
    semester: input.semester,
    themes: input.themes,
    prerequisiteCodes: [],
    assessments: [],
    learningOutcomes: [],
    overview: "",
    syllabus: "",
    teachingMethods: "",
    modality: {
      summary: "",
      attendance: "",
      category: "",
      deliveryMode: "",
      location: "",
    },
  };
  module.overview = moduleOverview(module);
  module.syllabus = syllabus(module);
  module.teachingMethods = teachingMethods(module);
  module.learningOutcomes = generateLearningOutcomes(module, input.rand);
  module.assessments = generateAssessments(module, input.rand);
  module.modality = generateModality(module, input.rand);
  return module;
}

function generateModules(config: GeneratorConfig, selectedProgrammes: Programme[], rand: () => number): Module[] {
  const modules: Module[] = [];
  const commonCount = Math.min(24, config.moduleCount);
  for (let index = 0; index < commonCount; index += 1) {
    const stage = (index % 4) + 1;
    const title = commonModuleTitles[index % commonModuleTitles.length];
    modules.push(createModule({
      index,
      title,
      school: schools[index % config.schoolCount],
      campus: index % 3 === 0 ? "City Campus" : `${schools[index % config.schoolCount].replace("School of ", "")} Campus`,
      stage,
      semester: index % 2 === 0 ? "Semester 1" : "Semester 2",
      credits: title.toLowerCase().includes("capstone") ? 15 : 5,
      themes: moduleThemes(title, ["interdisciplinary"]),
      rand,
    }));
  }

  let index = modules.length;
  let programmeCursor = 0;
  while (modules.length < config.moduleCount) {
    const programme = selectedProgrammes[programmeCursor % selectedProgrammes.length];
    const baseTitle = progressionTitles[(index + programmeCursor) % progressionTitles.length];
    const title = modules.some((module) => module.shortTitle === baseTitle)
      ? `${baseTitle} for ${programme.title.replace(/^(BSc|BA|BEng|MSc)\s+/, "")}`
      : baseTitle;
    const stage = programme.postgraduate ? 1 + (index % 2) : (index % 4) + 1;
    modules.push(createModule({
      index,
      title,
      school: programme.school,
      campus: programme.campus,
      stage,
      semester: index % 2 === 0 ? "Semester 1" : "Semester 2",
      credits: title.toLowerCase().includes("capstone") || title.toLowerCase().includes("dissertation") ? 15 : pick([5, 5, 10], rand),
      themes: moduleThemes(title, programme.themes),
      postgraduate: programme.postgraduate,
      rand,
    }));
    index += 1;
    programmeCursor += 1;
  }

  const byStage = new Map<number, Module[]>();
  for (const module of modules) {
    byStage.set(module.stage, [...(byStage.get(module.stage) ?? []), module]);
  }
  for (const module of modules) {
    if (module.stage <= 1) continue;
    const earlier = [...modules].filter((candidate) => candidate.stage < module.stage && candidate.school === module.school);
    if (earlier.length > 0) module.prerequisiteCodes = [pick(earlier, rand).moduleCode];
  }
  return modules;
}

function generateAffiliations(modules: Module[], selectedProgrammes: Programme[], rand: () => number, includeIssues: boolean) {
  const common = modules.slice(0, 24);
  const remaining = modules.slice(24);
  const bySchool = new Map<string, Module[]>();
  for (const module of remaining) bySchool.set(module.school, [...(bySchool.get(module.school) ?? []), module]);

  const links: Array<{ module: Module; programme: Programme }> = [];
  for (const programme of selectedProgrammes) {
    for (const module of common) links.push({ module, programme });
    const schoolModules = bySchool.get(programme.school) ?? [];
    for (const module of schoolModules.slice(0, 10)) links.push({ module, programme });
    const related = remaining.filter((module) => module.school !== programme.school && module.themes.some((theme) => programme.themes.includes(theme)));
    for (const module of related.slice(0, 10)) links.push({ module, programme });
  }

  if (includeIssues && links.length > 0) links.push(links[0]);
  const deduped = includeIssues ? links : [...new Map(links.map((link) => [`${link.programme.code}:${link.module.moduleCode}`, link])).values()];
  deduped.sort((a, b) => a.programme.code.localeCompare(b.programme.code) || a.module.moduleCode.localeCompare(b.module.moduleCode));
  return deduped;
}

function applyDataQualityIssues(modules: Module[]) {
  if (modules.length < 8) return;
  modules[2].level = null;
  modules[3].semester = null;
  for (const assessment of modules[3].assessments) assessment.semester = null;
  modules[4].credits = null;
  modules[5].learningOutcomes[0].description = null;
}

function rowForProgramme(module: Module, programme: Programme): Row {
  return {
    ...baseRow(module),
    "Programme Code": programme.code,
    "Programme Title": programme.title,
    "Programme Version": programme.version,
  };
}

function buildWorkbookRows(modules: Module[], affiliations: Array<{ module: Module; programme: Programme }>): Record<string, Row[]> {
  const rows: Record<string, Row[]> = Object.fromEntries(Object.keys(schema).map((sheet) => [sheet, []]));

  rows["Affiliated Programmes"] = affiliations.map(({ module, programme }) => rowForProgramme(module, programme));

  rows["Module Assessments"] = modules.flatMap((module) => module.assessments.map((assessment) => ({
    ...baseRow(module),
    "Assessment Category": assessment.category,
    "Assessment Type": assessment.type,
    "Percentage of Total": assessment.percentage,
    "Indicative Week": assessment.week,
    Semester: assessment.semester,
    "Pass/Fail": assessment.passFail,
    "Assessment Threshold": assessment.threshold,
    "Assessment Authenticity": assessment.authenticity,
    "Learning Outcomes Addressed": assessment.outcomes,
    "Assessment Description": assessment.description,
  })));

  rows["Learning Outcomes"] = modules.flatMap((module) => module.learningOutcomes.map((outcome) => ({
    ...baseRow(module),
    "Learning Outcome Code": outcome.code,
    "Learning Outcome Description": outcome.description,
  })));

  rows["Requisites"] = modules.map((module) => ({
    ...baseRow(module),
    "Requisite Type": module.prerequisiteCodes.length ? "Pre-requisite" : null,
    "Module Title": module.prerequisiteCodes.join(", "),
    Type: module.prerequisiteCodes.length ? "Module" : null,
    "Requisites Note": module.prerequisiteCodes.length
      ? `Students should normally complete ${module.prerequisiteCodes.join(", ")} before undertaking this module.`
      : "No requisites exist.",
  }));

  rows["Assessment Threshold Label"] = modules.map((module) => ({
    ...baseRow(module),
    "Assessment Threshold Label": "Assessment components are reviewed using programme assessment regulations.",
    "Assessment Threshold Label Embedded Tables": null,
  }));

  rows["Sharing Arrangements"] = modules.map((module) => ({
    ...baseRow(module),
    "Outline of Sharing Arrangements for Programmes": "This module may be shared across related programmes where learning outcomes and assessment evidence align.",
    "Sharing Arrangements Embedded Tables": null,
  }));

  rows["Module Overview"] = modules.map((module) => ({
    ...baseRow(module),
    "Module Overview": module.overview,
    "Module Overview Embedded Tables": null,
  }));

  rows["Indicative Syllabus"] = modules.map((module) => ({
    ...baseRow(module),
    "Indicative Syllabus": module.syllabus,
    "Indicative Syllabus Embedded Tables": null,
  }));

  rows["Indicative Syllabus New Table"] = modules.map((module) => ({
    ...baseRow(module),
    "Indicative Syllabus New Table": module.syllabus,
  }));

  rows["Learning Teaching Methods"] = modules.map((module) => ({
    ...baseRow(module),
    "Learning and Teaching Methods": module.teachingMethods,
    "Learning and Teaching Methods Embedded Tables": null,
  }));

  rows["Change Description"] = modules.map((module) => ({
    ...baseRow(module),
    "Change Description": "Synthetic seed version created for CAST v3 curriculum intelligence testing.",
  }));

  rows["Reassessment Requirement"] = modules.map((module) => ({
    ...baseRow(module),
    "Reassessment Requirement": "Reassessment is normally by resubmission of the failed component or equivalent evidence of learning.",
    "Special Repeat Arrangements": module.assessments.some((assessment) => assessment.type === "Practical Assessment")
      ? "Practical or studio components may require an equivalent supervised task."
      : "No special repeat arrangements.",
  }));

  rows.Derogations = modules.map((module) => ({
    ...baseRow(module),
    Derogations: null,
  }));

  rows["Module Modalities"] = modules.map((module) => ({
    ...baseRow(module),
    "Module Modalities": module.modality.summary,
    "Module Modalities Embedded Tables": null,
    "Full Time / Part Time Module Modalities": module.modality.attendance,
    "Module Category Module Modalities": module.modality.category,
    "Modality Delivery Mode Module Modalities": module.modality.deliveryMode,
    "Location Module Modalities": module.modality.location,
    "Availabilities Code Module Modalities": `${module.moduleCode.replace(/\s+/g, "")}-2026`,
    "Start Date Module Modalities": "01-Sep-2026",
    "Year Module Modalities": "2026",
    "Teaching Period Key Date Module Modalities": module.semester ?? null,
    "End Date Module Modalities": "31-May-2027",
    "Deferral Allowed Module Modalities": "Yes",
  }));

  return rows;
}

function workbookFromRows(rowsBySheet: Record<string, Row[]>): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  for (const [sheetName, headers] of Object.entries(schema)) {
    const rows = rowsBySheet[sheetName] ?? [];
    const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers, skipHeader: false });
    worksheet["!cols"] = headers.map((header) => ({ wch: Math.min(Math.max(header.length + 4, 16), 42) }));
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  }
  return workbook;
}

function stats(rowsBySheet: Record<string, Row[]>, modules: Module[], affiliations: Array<{ module: Module; programme: Programme }>) {
  const sharedCounts = new Map<string, number>();
  for (const link of affiliations) sharedCounts.set(link.module.moduleCode, (sharedCounts.get(link.module.moduleCode) ?? 0) + 1);
  const modulesSharedAcrossProgrammes = [...sharedCounts.values()].filter((count) => count > 1).length;
  const assessmentWeightErrors = modules.filter((module) => module.assessments.reduce((sum, assessment) => sum + assessment.percentage, 0) !== 100).length;
  return {
    sheets: Object.fromEntries(Object.entries(rowsBySheet).map(([sheet, rows]) => [sheet, rows.length])),
    programmes: new Set(affiliations.map((link) => link.programme.code)).size,
    modules: modules.length,
    affiliations: affiliations.length,
    learningOutcomes: rowsBySheet["Learning Outcomes"].length,
    assessmentComponents: rowsBySheet["Module Assessments"].length,
    modulesSharedAcrossProgrammes,
    assessmentWeightErrors,
    modulesWithPrerequisites: modules.filter((module) => module.prerequisiteCodes.length > 0).length,
  };
}

async function main() {
  const config = parseArgs(process.argv.slice(2));
  const rand = seededRandom(config.seed);
  const selectedProgrammes = programmes.slice(0, config.programmeCount);
  const modules = generateModules(config, selectedProgrammes, rand);
  if (config.includeDataQualityIssues) applyDataQualityIssues(modules);
  const affiliations = generateAffiliations(modules, selectedProgrammes, rand, config.includeDataQualityIssues);
  const rowsBySheet = buildWorkbookRows(modules, affiliations);
  const workbook = workbookFromRows(rowsBySheet);
  const outputPath = path.isAbsolute(config.outputPath) ? config.outputPath : path.resolve(repositoryRoot, config.outputPath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  XLSX.writeFile(workbook, outputPath, { compression: true });
  console.log(JSON.stringify({
    outputPath,
    config,
    stats: stats(rowsBySheet, modules, affiliations),
  }, null, 2));
}

await main();
