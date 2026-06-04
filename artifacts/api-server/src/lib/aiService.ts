import OpenAI from "openai";
import { SAR_FRAMEWORK, SarDefinitionFull } from "./sarFramework.js";

if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || !process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
  throw new Error("Missing AI_INTEGRATIONS_OPENAI_BASE_URL or AI_INTEGRATIONS_OPENAI_API_KEY");
}

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

const MODEL = "gpt-5.2";
const BATCH_MODEL = "gpt-4o-mini";

function sarListText(): string {
  return SAR_FRAMEWORK.map((sar) => `- **${sar.name}**: ${sar.definition}`).join("\n");
}

export interface ClassificationOutput {
  primarySar: string;
  secondarySar: string | null;
  confidence: "high" | "medium" | "low";
  rationale: string;
}

export async function classifyModule(moduleText: string): Promise<ClassificationOutput> {
  const prompt = `You are an academic classification assistant. Your task is to classify a module against a Subject Area Requirement (SAR) framework for a Liberal Arts programme.

SUBJECT AREA REQUIREMENTS:
${sarListText()}

CLASSIFICATION RULES:
- Use ONLY explicit evidence from the module text
- Do NOT infer or assume content not present
- Be conservative: only classify if there is clear, substantive alignment
- Confidence levels: high (strong clear fit), medium (partial fit), low (uncertain or peripheral fit)
- primarySar: the SAR this module most strongly aligns with
- secondarySar: the NEXT highest-likelihood SAR after the primary — the second-best fit based on explicit module content. Must be different from primarySar. Only use null if the module has genuinely no meaningful secondary alignment to any other SAR.

MODULE TEXT:
${moduleText}

Return ONLY valid JSON, no markdown, no explanation:
{
  "primarySar": "<SAR name from the list above>",
  "secondarySar": "<SAR name from the list above, or null only if no secondary alignment exists>",
  "confidence": "<high|medium|low>",
  "rationale": "<clear explanation based only on explicit module content, covering both primary and secondary SAR alignment>"
}`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_completion_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.choices[0]?.message?.content ?? "";
  const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  let parsed: ClassificationOutput;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`Invalid JSON from AI classification: ${jsonStr}`);
  }

  const sarNames = SAR_FRAMEWORK.map((s) => s.name);
  if (!sarNames.includes(parsed.primarySar)) {
    const closest = sarNames.find((n) => n.toLowerCase().includes(parsed.primarySar?.toLowerCase() ?? ""));
    parsed.primarySar = closest ?? sarNames[0];
  }
  if (parsed.secondarySar && !sarNames.includes(parsed.secondarySar)) {
    parsed.secondarySar = null;
  }

  return parsed;
}

export interface CriterionScore {
  name: string;
  score: number;
  rationale: string;
}

export interface ScoringOutput {
  criteria: CriterionScore[];
  averageScore: number;
  overallComment: string;
  suitabilityNote: string;
}

export async function scoreModule(moduleText: string, sar: SarDefinitionFull): Promise<ScoringOutput> {
  const criteriaText = sar.criteria
    .map((c, i) => `${i + 1}. **${c.name}**: ${c.description}`)
    .join("\n");

  const prompt = `You are an academic evaluation assistant. Your task is to score a module against the criteria for the following Subject Area Requirement (SAR).

SAR: ${sar.name}
SAR Definition: ${sar.definition}

SCORING CRITERIA:
${criteriaText}

SCORING RULES:
- Scores: 1 = weak, 2 = limited, 3 = good, 4 = strong
- Use ONLY explicit evidence from the module text
- Do NOT infer missing content
- Score conservatively — only award higher scores for clear, substantive evidence
- Distinguish between alignment (content matches) and suitability (fit is appropriate for the SAR)
- For Stage 3/4 specialist modules, recognise depth may be narrow but can still score well on relevant criteria

MODULE TEXT:
${moduleText}

Return ONLY valid JSON, no markdown, no explanation:
{
  "criteria": [
    {"name": "<criterion name>", "score": <1-4>, "rationale": "<evidence-based explanation>"},
    {"name": "<criterion name>", "score": <1-4>, "rationale": "<evidence-based explanation>"},
    {"name": "<criterion name>", "score": <1-4>, "rationale": "<evidence-based explanation>"},
    {"name": "<criterion name>", "score": <1-4>, "rationale": "<evidence-based explanation>"},
    {"name": "<criterion name>", "score": <1-4>, "rationale": "<evidence-based explanation>"}
  ],
  "overallComment": "<overall assessment of module alignment to SAR>",
  "suitabilityNote": "<note on whether this module is suitable for this SAR, distinguishing alignment from suitability>"
}`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_completion_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.choices[0]?.message?.content ?? "";
  const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  let parsed: { criteria: CriterionScore[]; overallComment: string; suitabilityNote: string };
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`Invalid JSON from AI scoring: ${jsonStr}`);
  }

  const criteria = sar.criteria.map((c, i) => {
    const found = parsed.criteria[i] ?? { name: c.name, score: 1, rationale: "No assessment provided." };
    return {
      name: c.name,
      score: Math.min(4, Math.max(1, Math.round(found.score))),
      rationale: found.rationale ?? "",
    };
  });

  const averageScore = criteria.reduce((sum, c) => sum + c.score, 0) / criteria.length;

  return {
    criteria,
    averageScore: Math.round(averageScore * 100) / 100,
    overallComment: parsed.overallComment ?? "",
    suitabilityNote: parsed.suitabilityNote ?? "",
  };
}

export interface FreeElectiveOutput {
  discipline_family: string;
  accessibility_score: number;
  stage_appropriateness_score: number;
  breadth_transferability_score: number;
  free_elective_average: number;
  free_elective_band: string;
  tag_explore: boolean;
  tag_useful_skills: boolean;
  tag_pathway_support: boolean;
  free_elective_rationale: string;
}

const DISCIPLINE_FAMILIES = [
  "Business & Enterprise",
  "Society, Culture & Humanities",
  "Media, Communication & Creative Practice",
  "Data, Computing & Digital",
  "Science, Environment & Sustainability",
  "Languages & Global Studies",
  "Health, Wellbeing & Sport",
];

function calcFreeElectiveBand(avg: number): string {
  if (avg >= 3.5) return "Recommended";
  if (avg >= 2.5) return "Acceptable";
  if (avg >= 1.5) return "Use With Caution";
  return "Not Suitable";
}

export async function analyzeFreeElective(
  moduleText: string,
  moduleCode: string,
  moduleTitle: string
): Promise<FreeElectiveOutput> {
  const familyList = DISCIPLINE_FAMILIES.map((f) => `- ${f}`).join("\n");

  const prompt = `You are an academic advisor helping classify university modules for free elective suitability.

MODULE CODE: ${moduleCode}
MODULE TITLE: ${moduleTitle}

MODULE TEXT:
${moduleText.slice(0, 6000)}

TASK 1 — DISCIPLINE FAMILY
Assign ONE discipline family from this list based on the module overview, learning outcomes, and syllabus (not based on school name):
${familyList}

TASK 2 — FREE ELECTIVE RUBRIC
Score each criterion 1–4 (1=poor, 2=limited, 3=good, 4=strong):

1. Accessibility (PRIMARY DRIVER): Can a non-specialist student realistically take this module and succeed? Consider language, assumed knowledge, and conceptual entry point.
2. Stage Appropriateness (INTERPRETED): Consider the module stage inferred from the code (1xxx=Stage 1, 2xxx=Stage 2, 3xxx=Stage 3, 4xxx=Stage 4), presence or absence of prerequisites, and whether the module appears introductory or advanced. A Stage 3 module CAN still score 3–4 if it is genuinely accessible. Stage is a signal, not a rule. Accessibility overrides stage.
3. Breadth & Transferability: Does this module develop broadly useful knowledge or transferable skills (writing, digital, analytical, communication, critical thinking)?

TASK 3 — ADVISING TAGS
Assign true/false for each:
- tag_explore: Introductory in nature or suitable for students trying a new discipline
- tag_useful_skills: Develops transferable skills (writing, digital, analytical, communication)
- tag_pathway_support: Supports likely programme or career directions (broadly useful for a range of degrees)

TASK 4 — SHORT RATIONALE
Write one or two sentences explaining the suitability band recommendation.

Return ONLY valid JSON, no markdown, no explanation:
{
  "discipline_family": "<one of the families listed above>",
  "accessibility_score": <1-4>,
  "stage_appropriateness_score": <1-4>,
  "breadth_transferability_score": <1-4>,
  "tag_explore": <true|false>,
  "tag_useful_skills": <true|false>,
  "tag_pathway_support": <true|false>,
  "free_elective_rationale": "<one to two sentence rationale>"
}`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_completion_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.choices[0]?.message?.content ?? "";
  const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  let parsed: Omit<FreeElectiveOutput, "free_elective_average" | "free_elective_band">;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`Invalid JSON from free elective analysis: ${jsonStr}`);
  }

  if (!DISCIPLINE_FAMILIES.includes(parsed.discipline_family)) {
    const closest = DISCIPLINE_FAMILIES.find((f) =>
      f.toLowerCase().includes((parsed.discipline_family ?? "").toLowerCase().split(" ")[0])
    );
    parsed.discipline_family = closest ?? DISCIPLINE_FAMILIES[1];
  }

  const scores = [
    Math.min(4, Math.max(1, Math.round(parsed.accessibility_score))),
    Math.min(4, Math.max(1, Math.round(parsed.stage_appropriateness_score))),
    Math.min(4, Math.max(1, Math.round(parsed.breadth_transferability_score))),
  ];

  const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;

  return {
    discipline_family: parsed.discipline_family,
    accessibility_score: scores[0],
    stage_appropriateness_score: scores[1],
    breadth_transferability_score: scores[2],
    free_elective_average: avg,
    free_elective_band: calcFreeElectiveBand(avg),
    tag_explore: Boolean(parsed.tag_explore),
    tag_useful_skills: Boolean(parsed.tag_useful_skills),
    tag_pathway_support: Boolean(parsed.tag_pathway_support),
    free_elective_rationale: parsed.free_elective_rationale ?? "",
  };
}

// ── Graduate Attribute Classification ─────────────────────────────────────────
export interface GaEvidenceItem {
  field: string;
  snippet: string;
  weight: "primary" | "secondary";
}

export interface GaClassificationOutput {
  People:      "None" | "Developing" | "Consolidating" | "Leading";
  Planet:      "None" | "Developing" | "Consolidating" | "Leading";
  Partnership: "None" | "Developing" | "Consolidating" | "Leading";
  rationale: {
    People:      string;
    Planet:      string;
    Partnership: string;
  };
  evidence: {
    People:      GaEvidenceItem[];
    Planet:      GaEvidenceItem[];
    Partnership: GaEvidenceItem[];
  };
}

const GA_LEVELS = ["None", "Developing", "Consolidating", "Leading"] as const;
type GaLevel = typeof GA_LEVELS[number];

function safeGaLevel(v: unknown): GaLevel {
  if (typeof v === "string" && GA_LEVELS.includes(v as GaLevel)) return v as GaLevel;
  return "None";
}

function safeEvidence(v: unknown): GaEvidenceItem[] {
  if (!Array.isArray(v)) return [];
  return v.filter(
    (item): item is GaEvidenceItem =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as GaEvidenceItem).field === "string" &&
      typeof (item as GaEvidenceItem).snippet === "string"
  ).map(item => ({
    field: item.field,
    snippet: item.snippet,
    weight: item.weight === "primary" || item.weight === "secondary" ? item.weight : "secondary",
  }));
}

// Build a weighted evidence block for the AI prompt
function buildEvidenceBlock(fields: {
  moduleCode: string;
  moduleTitle: string;
  overview: string | null;
  learningOutcomes: string | null;
  indicativeSyllabus: string | null;
  teachingMethods: string | null;
  assessmentText: string | null;
  stageInferred: string | null;
  disciplineFamily: string | null;
}): { text: string; fieldLabels: Record<string, string> } {
  const fieldLabels: Record<string, string> = {};

  // Primary evidence fields (highest weight — contain explicit curriculum intent)
  const primary: string[] = [];
  if (fields.overview) {
    primary.push(`[PRIMARY] Module Descriptor / Overview:\n${fields.overview.slice(0, 800)}`);
    fieldLabels["overview"] = "Module Descriptor";
  }
  if (fields.learningOutcomes) {
    primary.push(`[PRIMARY] Learning Outcomes:\n${fields.learningOutcomes.slice(0, 900)}`);
    fieldLabels["learningOutcomes"] = "Learning Outcomes";
  }
  if (fields.indicativeSyllabus) {
    primary.push(`[PRIMARY] Indicative Syllabus:\n${fields.indicativeSyllabus.slice(0, 700)}`);
    fieldLabels["indicativeSyllabus"] = "Indicative Syllabus";
  }

  // Secondary evidence fields (supporting — reveal pedagogy and assessment design)
  const secondary: string[] = [];
  if (fields.teachingMethods) {
    secondary.push(`[SECONDARY] Learning & Teaching Methods:\n${fields.teachingMethods.slice(0, 450)}`);
    fieldLabels["teachingMethods"] = "Learning & Teaching Methods";
  }
  if (fields.assessmentText) {
    secondary.push(`[SECONDARY] Assessment Approaches:\n${fields.assessmentText.slice(0, 450)}`);
    fieldLabels["assessmentText"] = "Assessment Approaches";
  }

  // Metadata (contextual — used for framing, not for inferring content)
  const meta: string[] = [
    `Module Code: ${fields.moduleCode}  |  Title: ${fields.moduleTitle}`,
  ];
  if (fields.stageInferred) meta.push(`Stage: ${fields.stageInferred}`);
  if (fields.disciplineFamily) meta.push(`Discipline Family: ${fields.disciplineFamily}`);

  const sections = [
    `--- MODULE METADATA ---\n${meta.join("\n")}`,
    ...(primary.length ? [`--- PRIMARY EVIDENCE (highest weight) ---\n${primary.join("\n\n")}`] : []),
    ...(secondary.length ? [`--- SECONDARY EVIDENCE (supporting weight) ---\n${secondary.join("\n\n")}`] : []),
  ];

  return { text: sections.join("\n\n"), fieldLabels };
}

export async function classifyModuleGA(
  moduleCode: string,
  moduleTitle: string,
  learningOutcomes: string | null,
  overview: string | null,
  indicativeSyllabus: string | null,
  teachingMethods: string | null,
  assessmentText: string | null = null,
  stageInferred: string | null = null,
  disciplineFamily: string | null = null,
): Promise<GaClassificationOutput> {
  const { text: evidenceBlock } = buildEvidenceBlock({
    moduleCode, moduleTitle, overview, learningOutcomes,
    indicativeSyllabus, teachingMethods, assessmentText,
    stageInferred, disciplineFamily,
  });

  const prompt = `You are a curriculum analyst for TU Dublin's Arts Programme. Your task is to classify a module against three Graduate Attribute (GA) domains using all available evidence.

The module evidence below is organised by weight:
- PRIMARY fields (descriptor, learning outcomes, syllabus) carry the highest weight — they directly express curriculum intent and expected student development.
- SECONDARY fields (teaching methods, assessment approaches) carry supporting weight — they reveal how the attribute is enacted in practice.
- METADATA is contextual framing only — do not infer GA content from the module code, stage, or discipline family alone.

━━━ GA DOMAINS AND EVIDENCE INDICATORS ━━━

1. People — Develops students as digitally capable, reflective, self-aware, feedback-engaged, adaptable learners prepared for lifelong learning and active participation in a digital society.
Evidence indicators: digital literacy or tools, reflective practice or journaling, self-assessment, feedback engagement, learner agency, personal/professional development, metacognitive skills, identity formation.

2. Planet — Builds sustainability-related knowledge, values, critical awareness, futures thinking, or commitment to responsible action regarding environment, society, or sustainable development.
Evidence indicators: sustainability, SDGs, climate, environment, ethical responsibility, systems thinking, futures thinking, social justice, responsible citizenship, action for change.

3. Partnership — Develops students' capacity for collaboration, co-creation, teamwork, interdisciplinary practice, authentic real-world engagement, or shared problem-solving with others.
Evidence indicators: group work, teamwork, collaboration, co-creation, community or external partnerships, real-world or authentic tasks, interdisciplinary projects, shared responsibility, professional engagement.

━━━ CLASSIFICATION LEVELS ━━━
- None: No meaningful or intentional contribution to this GA. Correct when evidence is absent. Not a failure.
- Developing: Identifiable but introductory or limited contribution. The attribute is present but peripheral.
- Consolidating: Purposefully embeds or extends the attribute. Clearly present in learning, teaching, or assessment design.
- Leading: Advanced, integrative, or high-impact contribution. Students engage autonomously, apply deeply, or demonstrate significant alignment.

━━━ CLASSIFICATION RULES ━━━
1. Use ONLY explicit evidence from the fields provided. Do NOT infer from the module code, stage, or title alone.
2. PRIMARY fields are the primary basis for classification. SECONDARY fields can elevate a level if they clearly reinforce PRIMARY evidence.
3. If in doubt, classify as None. Be conservative.
4. None is not a failure — it correctly indicates the module does not contribute to that attribute.
5. For each domain, identify the 1–3 most influential text snippets or field-level signals that drove your classification. If level is None, state which fields were checked and why they did not meet the threshold.

━━━ MODULE EVIDENCE ━━━
${evidenceBlock}

Return ONLY valid JSON, no markdown, no explanation:
{
  "People": "<None|Developing|Consolidating|Leading>",
  "Planet": "<None|Developing|Consolidating|Leading>",
  "Partnership": "<None|Developing|Consolidating|Leading>",
  "rationale": {
    "People": "<one clear sentence summarising the classification decision based on explicit evidence>",
    "Planet": "<one clear sentence summarising the classification decision based on explicit evidence>",
    "Partnership": "<one clear sentence summarising the classification decision based on explicit evidence>"
  },
  "evidence": {
    "People": [
      { "field": "<field label e.g. Learning Outcomes, Indicative Syllabus, Assessment Approaches>", "snippet": "<exact or near-exact short quote from that field, max 120 chars>", "weight": "<primary|secondary>" }
    ],
    "Planet": [
      { "field": "<field label>", "snippet": "<short quote>", "weight": "<primary|secondary>" }
    ],
    "Partnership": [
      { "field": "<field label>", "snippet": "<short quote>", "weight": "<primary|secondary>" }
    ]
  }
}

Rules for the evidence array:
- Include 1–3 items per domain. If level is None, include 0 items (empty array).
- Use ONLY text that genuinely appears in the provided evidence fields.
- Keep snippets short (under 120 characters). Truncate with "…" if needed.
- The "field" label must be one of: Module Descriptor, Learning Outcomes, Indicative Syllabus, Learning & Teaching Methods, Assessment Approaches.`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_completion_tokens: 1200,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.choices[0]?.message?.content ?? "";
  const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`Invalid JSON from GA classification: ${jsonStr}`);
  }

  const rationale = (parsed.rationale ?? {}) as Record<string, string>;
  const evidence  = (parsed.evidence  ?? {}) as Record<string, unknown>;

  return {
    People:      safeGaLevel(parsed.People),
    Planet:      safeGaLevel(parsed.Planet),
    Partnership: safeGaLevel(parsed.Partnership),
    rationale: {
      People:      rationale.People      ?? "No rationale provided.",
      Planet:      rationale.Planet      ?? "No rationale provided.",
      Partnership: rationale.Partnership ?? "No rationale provided.",
    },
    evidence: {
      People:      safeEvidence(evidence.People),
      Planet:      safeEvidence(evidence.Planet),
      Partnership: safeEvidence(evidence.Partnership),
    },
  };
}

export interface GABatchInput {
  moduleCode: string; moduleTitle: string;
  learningOutcomes: string | null; overview: string | null;
  indicativeSyllabus: string | null; teachingMethods: string | null;
  assessmentText: string | null; stageInferred: string | null;
  disciplineFamily: string | null;
}

export async function classifyModulesGABatch(modules: GABatchInput[]): Promise<GaClassificationOutput[]> {
  if (modules.length === 0) return [];

  const evidenceBlocks = modules.map((m, i) => {
    const { text } = buildEvidenceBlock(m);
    return `=== MODULE ${i + 1} ===\n${text}`;
  }).join("\n\n");

  const prompt = `You are a curriculum analyst for TU Dublin's Arts Programme. Classify each module against three Graduate Attribute (GA) domains.

PRIMARY fields (descriptor, learning outcomes, syllabus) carry the highest weight.
SECONDARY fields (teaching methods, assessment) carry supporting weight.
METADATA is framing only — do not infer GA content from code, stage, or discipline alone.

━━━ GA DOMAINS AND EVIDENCE INDICATORS ━━━

1. People — Develops students as digitally capable, reflective, self-aware, feedback-engaged, adaptable learners prepared for lifelong learning and active participation in a digital society.
Evidence indicators: digital literacy or tools, reflective practice or journaling, self-assessment, feedback engagement, learner agency, personal/professional development, metacognitive skills, identity formation.

2. Planet — Builds sustainability-related knowledge, values, critical awareness, futures thinking, or commitment to responsible action regarding environment, society, or sustainable development.
Evidence indicators: sustainability, SDGs, climate, environment, ethical responsibility, systems thinking, futures thinking, social justice, responsible citizenship, action for change.

3. Partnership — Develops students' capacity for collaboration, co-creation, teamwork, interdisciplinary practice, authentic real-world engagement, or shared problem-solving with others.
Evidence indicators: group work, teamwork, collaboration, co-creation, community or external partnerships, real-world or authentic tasks, interdisciplinary projects, shared responsibility, professional engagement.

━━━ CLASSIFICATION LEVELS ━━━
- None: No meaningful or intentional contribution. Not a failure.
- Developing: Identifiable but introductory or limited contribution.
- Consolidating: Purposefully embeds or extends the attribute.
- Leading: Advanced, integrative, or high-impact contribution.

━━━ RULES ━━━
1. Use ONLY explicit evidence from the fields provided.
2. If in doubt, classify as None. Be conservative.
3. For each domain at level != None, identify 1–3 influential text snippets. For None, use empty array.

━━━ MODULE EVIDENCE ━━━
Process ${modules.length} modules. Return a JSON array of exactly ${modules.length} objects in order.

${evidenceBlocks}

Return ONLY a valid JSON array of ${modules.length} objects:
[
  {
    "People": "<None|Developing|Consolidating|Leading>",
    "Planet": "<None|Developing|Consolidating|Leading>",
    "Partnership": "<None|Developing|Consolidating|Leading>",
    "rationale": { "People": "<one sentence>", "Planet": "<one sentence>", "Partnership": "<one sentence>" },
    "evidence": {
      "People": [{ "field": "<label>", "snippet": "<max 120 chars>", "weight": "<primary|secondary>" }],
      "Planet": [],
      "Partnership": []
    }
  }
]`;

  const response = await openai.chat.completions.create({
    model: BATCH_MODEL,
    max_completion_tokens: modules.length * 1200,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.choices[0]?.message?.content ?? "";
  const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  let parsed: Record<string, unknown>[];
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`Invalid JSON from GA batch classification: ${jsonStr.slice(0, 200)}`);
  }
  if (!Array.isArray(parsed) || parsed.length !== modules.length) {
    throw new Error(`Expected ${modules.length} GA results, got ${Array.isArray(parsed) ? parsed.length : "non-array"}`);
  }

  return parsed.map((p) => {
    const rat = (p.rationale ?? {}) as Record<string, string>;
    const ev  = (p.evidence  ?? {}) as Record<string, unknown>;
    return {
      People:      safeGaLevel(p.People),
      Planet:      safeGaLevel(p.Planet),
      Partnership: safeGaLevel(p.Partnership),
      rationale: {
        People:      rat.People      ?? "No rationale provided.",
        Planet:      rat.Planet      ?? "No rationale provided.",
        Partnership: rat.Partnership ?? "No rationale provided.",
      },
      evidence: {
        People:      safeEvidence(ev.People),
        Planet:      safeEvidence(ev.Planet),
        Partnership: safeEvidence(ev.Partnership),
      },
    };
  });
}

// ── GreenComp Classifier ───────────────────────────────────────────────────────

export const GREENCOMP_COMPETENCES = [
  "ValuingSustainability",
  "SupportingFairness",
  "PromotingNature",
  "SystemsThinking",
  "CriticalThinking",
  "ProblemFraming",
  "FuturesLiteracy",
  "Adaptability",
  "ExploratoryThinking",
  "PoliticalAgency",
  "CollectiveAction",
  "IndividualInitiative",
] as const;

export type GreenCompCompetence = typeof GREENCOMP_COMPETENCES[number];

export interface GcClassificationOutput {
  ValuingSustainability:  string;
  SupportingFairness:     string;
  PromotingNature:        string;
  SystemsThinking:        string;
  CriticalThinking:       string;
  ProblemFraming:         string;
  FuturesLiteracy:        string;
  Adaptability:           string;
  ExploratoryThinking:    string;
  PoliticalAgency:        string;
  CollectiveAction:       string;
  IndividualInitiative:   string;
  rationale:  Record<GreenCompCompetence, string>;
  evidence:   Record<GreenCompCompetence, Array<{ field: string; snippet: string; weight: "primary" | "secondary" }>>;
}

export async function classifyModuleGreenComp(
  moduleCode: string,
  moduleTitle: string,
  learningOutcomes: string | null,
  overview: string | null,
  indicativeSyllabus: string | null,
  teachingMethods: string | null,
  assessmentText: string | null = null,
  stageInferred: string | null = null,
  disciplineFamily: string | null = null,
): Promise<GcClassificationOutput> {
  const { text: evidenceBlock } = buildEvidenceBlock({
    moduleCode, moduleTitle, overview, learningOutcomes,
    indicativeSyllabus, teachingMethods, assessmentText,
    stageInferred, disciplineFamily,
  });

  const prompt = `You are a curriculum analyst for TU Dublin's Arts Programme. Classify a module against the GreenComp framework — the EU's reference framework for sustainability competences.

PRIMARY fields (descriptor, learning outcomes, syllabus) carry the highest weight.
SECONDARY fields (teaching methods, assessment) carry supporting weight.
METADATA is framing only — do not infer sustainability content from code, stage, or discipline alone.

━━━ GREENCOMP COMPETENCES ━━━

AREA 1 — Embodying sustainability values
1. ValuingSustainability: reflection on sustainability values, ethics, priorities, worldviews. Evidence: ethics, value reflection, environmental responsibility, critique of unsustainable assumptions, normative judgement.
2. SupportingFairness: equity, justice, fairness, intergenerational responsibility, social/environmental justice. Evidence: equality, justice, inclusion, fairness, present and future generations.
3. PromotingNature: human-nature connection, biodiversity, restoration, ecosystem wellbeing. Evidence: biodiversity, nature, ecological protection, restoration, ecosystem health, human-nature interdependence.

AREA 2 — Embracing complexity in sustainability
4. SystemsThinking: interconnected, holistic, multi-factor, systems-level thinking. Evidence: systems thinking, interdependence, multiple factors, holistic analysis, environmental-social-economic links.
5. CriticalThinking: scrutiny of assumptions, evaluation of evidence, critique of dominant positions, greenwashing. Evidence: critique, questioning assumptions, evaluating evidence, bias, critical reflection.
6. ProblemFraming: define/interpret sustainability challenges, stakeholders, context, wicked problems. Evidence: defining sustainability challenges, framing problems, identifying stakeholders, contextual analysis, prevention/mitigation/adaptation.

AREA 3 — Envisioning sustainable futures
7. FuturesLiteracy: possible/preferred/alternative sustainable futures, scenario planning. Evidence: future scenarios, preferred futures, alternative futures, transition thinking, future-oriented design.
8. Adaptability: uncertainty, transition, resilience, adaptive decision-making. Evidence: adaptation, resilience, uncertainty, transition, flexibility, response to change.
9. ExploratoryThinking: creative, transdisciplinary, experimental thinking for sustainability. Evidence: creativity, experimentation, innovation, exploration, transdisciplinary thinking, novel methods.

AREA 4 — Acting for sustainability
10. PoliticalAgency: civic, policy, governance, advocacy, accountability for sustainability. Evidence: policy, governance, advocacy, accountability, regulation, civic or political action.
11. CollectiveAction: collaboration for sustainability, shared problem-solving, community engagement. Evidence: collaboration, teamwork, collective problem-solving, group sustainability action, community engagement.
12. IndividualInitiative: personal responsibility, initiative, self-efficacy, proactive contribution. Evidence: initiative, agency, self-directed action, individual responsibility, proactive contribution.

━━━ CLASSIFICATION LEVELS ━━━
- None: No meaningful or intentional contribution. Not a failure.
- Developing: Identifiable but introductory or limited contribution.
- Consolidating: Purposefully embeds or extends the competence.
- Leading: Advanced, integrative, high-impact contribution with explicit sustained engagement.

━━━ RULES ━━━
1. Use ONLY explicit evidence from the fields provided.
2. If in doubt, use None. Be conservative.
3. For each competence at level != None, identify 1–3 influential text snippets.
4. For None, include an empty evidence array.

━━━ MODULE EVIDENCE ━━━
${evidenceBlock}

Return ONLY valid JSON, no markdown, no explanation. Use exactly these 12 keys plus rationale and evidence:
{
  "ValuingSustainability": "<None|Developing|Consolidating|Leading>",
  "SupportingFairness": "<None|Developing|Consolidating|Leading>",
  "PromotingNature": "<None|Developing|Consolidating|Leading>",
  "SystemsThinking": "<None|Developing|Consolidating|Leading>",
  "CriticalThinking": "<None|Developing|Consolidating|Leading>",
  "ProblemFraming": "<None|Developing|Consolidating|Leading>",
  "FuturesLiteracy": "<None|Developing|Consolidating|Leading>",
  "Adaptability": "<None|Developing|Consolidating|Leading>",
  "ExploratoryThinking": "<None|Developing|Consolidating|Leading>",
  "PoliticalAgency": "<None|Developing|Consolidating|Leading>",
  "CollectiveAction": "<None|Developing|Consolidating|Leading>",
  "IndividualInitiative": "<None|Developing|Consolidating|Leading>",
  "rationale": {
    "ValuingSustainability": "<one sentence>",
    "SupportingFairness": "<one sentence>",
    "PromotingNature": "<one sentence>",
    "SystemsThinking": "<one sentence>",
    "CriticalThinking": "<one sentence>",
    "ProblemFraming": "<one sentence>",
    "FuturesLiteracy": "<one sentence>",
    "Adaptability": "<one sentence>",
    "ExploratoryThinking": "<one sentence>",
    "PoliticalAgency": "<one sentence>",
    "CollectiveAction": "<one sentence>",
    "IndividualInitiative": "<one sentence>"
  },
  "evidence": {
    "ValuingSustainability": [{"field": "<label>", "snippet": "<short quote max 120 chars>", "weight": "<primary|secondary>"}],
    "SupportingFairness": [],
    "PromotingNature": [],
    "SystemsThinking": [],
    "CriticalThinking": [],
    "ProblemFraming": [],
    "FuturesLiteracy": [],
    "Adaptability": [],
    "ExploratoryThinking": [],
    "PoliticalAgency": [],
    "CollectiveAction": [],
    "IndividualInitiative": []
  }
}`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_completion_tokens: 2400,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.choices[0]?.message?.content ?? "";
  const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`Invalid JSON from GreenComp classification: ${jsonStr}`);
  }

  const rationale = (parsed.rationale ?? {}) as Record<string, string>;
  const evidence  = (parsed.evidence  ?? {}) as Record<string, unknown>;

  const result: Partial<GcClassificationOutput> = {
    rationale: {} as Record<GreenCompCompetence, string>,
    evidence:  {} as Record<GreenCompCompetence, Array<{ field: string; snippet: string; weight: "primary" | "secondary" }>>,
  };

  for (const comp of GREENCOMP_COMPETENCES) {
    (result as Record<string, unknown>)[comp] = safeGaLevel(parsed[comp]);
    (result.rationale as Record<string, string>)[comp] = rationale[comp] ?? "No rationale provided.";
    (result.evidence  as Record<string, unknown[]>)[comp] = safeEvidence(evidence[comp]);
  }

  return result as GcClassificationOutput;
}

export type GreenCompBatchInput = GABatchInput;

export async function classifyModulesGreenCompBatch(modules: GreenCompBatchInput[]): Promise<GcClassificationOutput[]> {
  if (modules.length === 0) return [];

  const evidenceBlocks = modules.map((m, i) => {
    const { text } = buildEvidenceBlock(m);
    return `=== MODULE ${i + 1} ===\n${text}`;
  }).join("\n\n");

  const prompt = `You are a curriculum analyst for TU Dublin's Arts Programme. Classify each module against the GreenComp framework — the EU's reference framework for sustainability competences.

PRIMARY fields (descriptor, learning outcomes, syllabus) carry the highest weight.
SECONDARY fields (teaching methods, assessment) carry supporting weight.
METADATA is framing only — do not infer sustainability content from code, stage, or discipline alone.

━━━ GREENCOMP COMPETENCES ━━━

AREA 1 — Embodying sustainability values
1. ValuingSustainability: reflection on sustainability values, ethics, priorities, worldviews. Evidence: ethics, value reflection, environmental responsibility, critique of unsustainable assumptions.
2. SupportingFairness: equity, justice, fairness, intergenerational responsibility. Evidence: equality, justice, inclusion, fairness, present and future generations.
3. PromotingNature: human-nature connection, biodiversity, restoration, ecosystem wellbeing. Evidence: biodiversity, nature, ecological protection, restoration, ecosystem health.

AREA 2 — Embracing complexity in sustainability
4. SystemsThinking: interconnected, holistic, multi-factor, systems-level thinking. Evidence: systems thinking, interdependence, holistic analysis, environmental-social-economic links.
5. CriticalThinking: scrutiny of assumptions, evaluation of evidence, critique of dominant positions. Evidence: critique, questioning assumptions, evaluating evidence, bias, critical reflection.
6. ProblemFraming: define/interpret sustainability challenges, stakeholders, context. Evidence: defining sustainability challenges, framing problems, identifying stakeholders, contextual analysis.

AREA 3 — Envisioning sustainable futures
7. FuturesLiteracy: possible/preferred/alternative sustainable futures, scenario planning. Evidence: future scenarios, preferred futures, alternative futures, transition thinking.
8. Adaptability: uncertainty, transition, resilience, adaptive decision-making. Evidence: adaptation, resilience, uncertainty, transition, flexibility, response to change.
9. ExploratoryThinking: creative, transdisciplinary, experimental thinking for sustainability. Evidence: creativity, experimentation, innovation, exploration, transdisciplinary thinking.

AREA 4 — Acting for sustainability
10. PoliticalAgency: civic, policy, governance, advocacy for sustainability. Evidence: policy, governance, advocacy, accountability, regulation, civic action.
11. CollectiveAction: collaboration for sustainability, shared problem-solving, community engagement. Evidence: collaboration, teamwork, collective problem-solving, community engagement.
12. IndividualInitiative: personal responsibility, initiative, self-efficacy, proactive contribution. Evidence: initiative, agency, self-directed action, individual responsibility.

━━━ CLASSIFICATION LEVELS ━━━
- None: No meaningful or intentional contribution. Not a failure.
- Developing: Identifiable but introductory or limited contribution.
- Consolidating: Purposefully embeds or extends the competence.
- Leading: Advanced, integrative, high-impact contribution.

━━━ RULES ━━━
1. Use ONLY explicit evidence from the fields provided.
2. If in doubt, use None. Be conservative.
3. For each competence at level != None, identify 1–3 influential text snippets. For None, use empty array.

━━━ MODULE EVIDENCE ━━━
Process ${modules.length} modules. Return a JSON array of exactly ${modules.length} objects in order.

${evidenceBlocks}

Return ONLY a valid JSON array of ${modules.length} objects. Each object must have exactly these keys: ValuingSustainability, SupportingFairness, PromotingNature, SystemsThinking, CriticalThinking, ProblemFraming, FuturesLiteracy, Adaptability, ExploratoryThinking, PoliticalAgency, CollectiveAction, IndividualInitiative, rationale, evidence.`;

  const response = await openai.chat.completions.create({
    model: BATCH_MODEL,
    max_completion_tokens: modules.length * 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.choices[0]?.message?.content ?? "";
  const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  let parsed: Record<string, unknown>[];
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`Invalid JSON from GreenComp batch classification: ${jsonStr.slice(0, 200)}`);
  }
  if (!Array.isArray(parsed) || parsed.length !== modules.length) {
    throw new Error(`Expected ${modules.length} GreenComp results, got ${Array.isArray(parsed) ? parsed.length : "non-array"}`);
  }

  return parsed.map((p) => {
    const rat = (p.rationale ?? {}) as Record<string, string>;
    const ev  = (p.evidence  ?? {}) as Record<string, unknown>;
    const result: Partial<GcClassificationOutput> = {
      rationale: {} as Record<GreenCompCompetence, string>,
      evidence:  {} as Record<GreenCompCompetence, Array<{ field: string; snippet: string; weight: "primary" | "secondary" }>>,
    };
    for (const comp of GREENCOMP_COMPETENCES) {
      (result as Record<string, unknown>)[comp] = safeGaLevel(p[comp]);
      (result.rationale as Record<string, string>)[comp] = rat[comp] ?? "No rationale provided.";
      (result.evidence  as Record<string, unknown[]>)[comp] = safeEvidence(ev[comp]);
    }
    return result as GcClassificationOutput;
  });
}

// ── DigComp 3.0 Classifier ────────────────────────────────────────────────────

export const DIGCOMP_COMPETENCES = [
  "BrowsingInfo",
  "EvaluatingInfo",
  "ManagingInfo",
  "Interacting",
  "Sharing",
  "Citizenship",
  "Collaborating",
  "DigitalBehaviour",
  "ManagingIdentity",
  "DevelopingContent",
  "IntegratingContent",
  "CopyrightLicences",
  "ComputationalThinking",
  "ProtectingDevices",
  "ProtectingData",
  "SupportingWellbeing",
  "EnvironmentalImpact",
  "SolvingTechnical",
  "IdentifyingNeeds",
  "CreativeSolutions",
  "AddressingCompetenceGaps",
] as const;

export type DigCompCompetence = typeof DIGCOMP_COMPETENCES[number];

export type DcClassificationOutput = Record<DigCompCompetence, string> & {
  rationale: Record<DigCompCompetence, string>;
  evidence: Record<DigCompCompetence, Array<{ field: string; snippet: string; weight: "primary" | "secondary" }>>;
};

const DC_COMPETENCE_DESCRIPTORS: Record<DigCompCompetence, { id: string; title: string; desc: string }> = {
  BrowsingInfo:              { id: "1.1", title: "Browsing, searching and filtering information",    desc: "Articulate information needs; search, locate and retrieve digital information; judge relevance of sources; filter results." },
  EvaluatingInfo:            { id: "1.2", title: "Evaluating information",                           desc: "Critically evaluate digital sources, content and the processes used to generate them for credibility and reliability." },
  ManagingInfo:              { id: "1.3", title: "Managing information",                             desc: "Store, manage, organise and analyse digital information and data; structure data for retrieval." },
  Interacting:               { id: "2.1", title: "Interacting through and with digital technologies",desc: "Interact with others using digital technologies; choose appropriate digital tools for communication contexts." },
  Sharing:                   { id: "2.2", title: "Sharing through digital technologies",             desc: "Share data, information and digital content; act as an intermediary; disseminate and curate." },
  Citizenship:               { id: "2.3", title: "Engaging in citizenship through digital technologies", desc: "Participate in society through digital technologies; assert digital rights; engage with public services, e-democracy." },
  Collaborating:             { id: "2.4", title: "Collaborating through digital technologies",      desc: "Use digital tools for collaborative processes; co-construct and co-create knowledge and content." },
  DigitalBehaviour:          { id: "2.5", title: "Digital behaviour",                               desc: "Familiar with norms and practices of online communities; aware of cultural diversity; manage one's digital footprint." },
  ManagingIdentity:          { id: "2.6", title: "Managing digital identity",                       desc: "Create and manage one or several digital identities; protect digital reputation; handle data shared through digital accounts." },
  DevelopingContent:         { id: "3.1", title: "Developing digital content",                      desc: "Create and edit digital content in different formats; express oneself through digital means." },
  IntegratingContent:        { id: "3.2", title: "Integrating and re-elaborating digital content",  desc: "Modify, refine, improve and integrate information and content into an existing body of knowledge; understand copyright." },
  CopyrightLicences:         { id: "3.3", title: "Copyright and licences",                          desc: "Understand how copyright and licences apply to digital content; apply open licences; respect intellectual property." },
  ComputationalThinking:     { id: "3.4", title: "Computational thinking and programming",          desc: "Plan and develop a sequence of instructions; apply algorithmic and computational thinking; understand and use programming." },
  ProtectingDevices:         { id: "4.1", title: "Protecting devices",                              desc: "Protect devices and digital content; understand risks and threats; know about safety and security measures." },
  ProtectingData:            { id: "4.2", title: "Protecting personal data and privacy",            desc: "Protect personal data and privacy in digital environments; understand how to use and share data; understand privacy policies." },
  SupportingWellbeing:       { id: "4.3", title: "Supporting wellbeing",                            desc: "Avoid health risks and threats to physical and psychological wellbeing; balance digital and physical worlds; aware of digital wellbeing." },
  EnvironmentalImpact:       { id: "4.4", title: "Environmental impacts of digital technologies",   desc: "Aware of environmental impact of digital technologies; take action to reduce digital footprint; use digital for sustainability." },
  SolvingTechnical:          { id: "5.1", title: "Identifying and solving technical problems",      desc: "Identify technical problems when operating devices and using digital environments; solve them or seek support." },
  IdentifyingNeeds:          { id: "5.2", title: "Identifying needs and digital technological responses", desc: "Assess needs; identify, evaluate, select and use digital tools and possible responses to meet them." },
  CreativeSolutions:         { id: "5.3", title: "Identifying creative solutions using digital technologies", desc: "Use digital tools to innovate processes and products; creatively engage with digital technologies." },
  AddressingCompetenceGaps:  { id: "5.4", title: "Identifying and addressing digital competence needs", desc: "Understand where own digital competence needs to be improved; support others; seek opportunities for self-development." },
};

function buildDigCompCompetenceList(): string {
  const areas = [
    { id: "1", label: "Information search, evaluation and management", keys: ["BrowsingInfo","EvaluatingInfo","ManagingInfo"] as DigCompCompetence[] },
    { id: "2", label: "Communication and collaboration",               keys: ["Interacting","Sharing","Citizenship","Collaborating","DigitalBehaviour","ManagingIdentity"] as DigCompCompetence[] },
    { id: "3", label: "Content creation",                              keys: ["DevelopingContent","IntegratingContent","CopyrightLicences","ComputationalThinking"] as DigCompCompetence[] },
    { id: "4", label: "Safety, wellbeing and responsible use",         keys: ["ProtectingDevices","ProtectingData","SupportingWellbeing","EnvironmentalImpact"] as DigCompCompetence[] },
    { id: "5", label: "Problem identification and solving",            keys: ["SolvingTechnical","IdentifyingNeeds","CreativeSolutions","AddressingCompetenceGaps"] as DigCompCompetence[] },
  ];
  return areas.map(area => {
    const comps = area.keys.map(k => {
      const d = DC_COMPETENCE_DESCRIPTORS[k];
      return `  ${d.id}. ${k} — ${d.title}: ${d.desc}`;
    }).join("\n");
    return `AREA ${area.id} — ${area.label}\n${comps}`;
  }).join("\n\n");
}

const DC_ANTI_OVERCLAIM = `
ANTI-OVERCLAIM RULE (CRITICAL):
Do NOT classify a module as DigComp-aligned simply because it uses digital delivery tools.
Weak evidence (classify as None): online submission, VLE access, lecture slides online, email, Moodle/Brightspace/Teams/Zoom use without learner competence development, software listed as a resource but not linked to learning outcomes.
Strong evidence: learners evaluate or create digital information, manage data, build digital content, collaborate digitally, apply cybersecurity or privacy principles, engage critically with AI, use computational thinking, address digital wellbeing or sustainability.
If the evidence is weak or generic, classify as None. Do not overclaim.`;

export async function classifyModuleDigComp(
  moduleCode: string,
  moduleTitle: string,
  learningOutcomes: string | null,
  overview: string | null,
  indicativeSyllabus: string | null,
  teachingMethods: string | null,
  assessmentText: string | null = null,
  stageInferred: string | null = null,
  disciplineFamily: string | null = null,
): Promise<DcClassificationOutput> {
  const { text: evidenceBlock } = buildEvidenceBlock({
    moduleCode, moduleTitle, overview, learningOutcomes,
    indicativeSyllabus, teachingMethods, assessmentText,
    stageInferred, disciplineFamily,
  });

  const competenceList = buildDigCompCompetenceList();
  const keyList = DIGCOMP_COMPETENCES.join('", "');
  const levelFields = DIGCOMP_COMPETENCES.map(k => `  "${k}": "<None|Developing|Consolidating|Leading>"`).join(",\n");
  const rationaleFields = DIGCOMP_COMPETENCES.map(k => `    "${k}": "<one sentence>"`).join(",\n");
  const evidenceFields = DIGCOMP_COMPETENCES.map(k => `    "${k}": []`).join(",\n");

  const prompt = `You are a curriculum analyst for TU Dublin's Arts Programme. Classify a module against DigComp 3.0 — the EU's European Digital Competence Framework (Fifth Edition, 2025).

PRIMARY fields (descriptor, learning outcomes, syllabus) carry the highest weight.
SECONDARY fields (teaching methods, assessment) carry supporting weight.
METADATA is framing only — do not infer digital competence from the module code or title alone.

━━━ CLASSIFICATION LEVELS ━━━
- None: No meaningful evidence that learners develop this DigComp competence. Use for absent, administrative, or generic digital use.
- Developing: Limited or early evidence. Learners encounter or practise the competence at an introductory level.
- Consolidating: Clear evidence. Learners actively develop, apply, reflect on or demonstrate the competence through outcomes, activities or assessment.
- Leading: Strong and explicit evidence. Learners create, critique, evaluate, design, lead, solve or collaborate at an advanced level through this competence.

━━━ DIGCOMP 3.0 COMPETENCES (use EXACTLY these 21 keys) ━━━
${competenceList}
${DC_ANTI_OVERCLAIM}

━━━ MODULE EVIDENCE ━━━
${evidenceBlock}

Return ONLY valid JSON, no markdown. Use exactly these 21 keys plus rationale and evidence:
{
${levelFields},
  "rationale": {
${rationaleFields}
  },
  "evidence": {
${evidenceFields}
  }
}

For evidence: include 1–3 items per competence where level != None. For None, use empty array [].
Each evidence item: { "field": "<label>", "snippet": "<max 120 chars>", "weight": "<primary|secondary>" }
Field labels: Module Descriptor, Learning Outcomes, Indicative Syllabus, Learning & Teaching Methods, Assessment Approaches.`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_completion_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.choices[0]?.message?.content ?? "";
  const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`Invalid JSON from DigComp classification: ${jsonStr}`);
  }

  const rationale = (parsed.rationale ?? {}) as Record<string, string>;
  const evidence  = (parsed.evidence  ?? {}) as Record<string, unknown>;
  const result: Partial<DcClassificationOutput> = {
    rationale: {} as Record<DigCompCompetence, string>,
    evidence:  {} as Record<DigCompCompetence, Array<{ field: string; snippet: string; weight: "primary" | "secondary" }>>,
  };
  for (const comp of DIGCOMP_COMPETENCES) {
    (result as Record<string, unknown>)[comp] = safeGaLevel(parsed[comp]);
    (result.rationale as Record<string, string>)[comp] = rationale[comp] ?? "No rationale provided.";
    (result.evidence  as Record<string, unknown[]>)[comp] = safeEvidence(evidence[comp]);
  }
  return result as DcClassificationOutput;
}

export type DigCompBatchInput = GABatchInput;

export async function classifyModulesDigCompBatch(modules: DigCompBatchInput[]): Promise<DcClassificationOutput[]> {
  if (modules.length === 0) return [];

  const evidenceBlocks = modules.map((m, i) => {
    const { text } = buildEvidenceBlock(m);
    return `=== MODULE ${i + 1} ===\n${text}`;
  }).join("\n\n");

  const competenceList = buildDigCompCompetenceList();
  const keyList = DIGCOMP_COMPETENCES.join('", "');

  const prompt = `You are a curriculum analyst for TU Dublin's Arts Programme. Classify each module against DigComp 3.0 — the EU Digital Competence Framework (Fifth Edition, 2025).

PRIMARY fields (descriptor, learning outcomes, syllabus) carry the highest weight.
SECONDARY fields (teaching methods, assessment) carry supporting weight.
METADATA is framing only.

━━━ CLASSIFICATION LEVELS ━━━
- None: No meaningful evidence of DigComp competence development.
- Developing: Limited or introductory engagement.
- Consolidating: Clear active development or application.
- Leading: Strong, advanced, critical or creative engagement.

━━━ DIGCOMP 3.0 COMPETENCES (use EXACTLY these 21 keys) ━━━
${competenceList}
${DC_ANTI_OVERCLAIM}

━━━ MODULE EVIDENCE ━━━
Process ${modules.length} modules. Return a JSON array of exactly ${modules.length} objects in order.

${evidenceBlocks}

Return ONLY a valid JSON array of ${modules.length} objects. Each must have exactly these keys: "${keyList}", rationale, evidence.
For evidence: 1–3 items where level != None, empty array for None.`;

  const response = await openai.chat.completions.create({
    model: BATCH_MODEL,
    max_completion_tokens: modules.length * 3000,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.choices[0]?.message?.content ?? "";
  const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  let parsed: Record<string, unknown>[];
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`Invalid JSON from DigComp batch classification: ${jsonStr.slice(0, 200)}`);
  }
  if (!Array.isArray(parsed) || parsed.length !== modules.length) {
    throw new Error(`Expected ${modules.length} DigComp results, got ${Array.isArray(parsed) ? parsed.length : "non-array"}`);
  }

  return parsed.map((p) => {
    const rat = (p.rationale ?? {}) as Record<string, string>;
    const ev  = (p.evidence  ?? {}) as Record<string, unknown>;
    const result: Partial<DcClassificationOutput> = {
      rationale: {} as Record<DigCompCompetence, string>,
      evidence:  {} as Record<DigCompCompetence, Array<{ field: string; snippet: string; weight: "primary" | "secondary" }>>,
    };
    for (const comp of DIGCOMP_COMPETENCES) {
      (result as Record<string, unknown>)[comp] = safeGaLevel(p[comp]);
      (result.rationale as Record<string, string>)[comp] = rat[comp] ?? "No rationale provided.";
      (result.evidence  as Record<string, unknown[]>)[comp] = safeEvidence(ev[comp]);
    }
    return result as DcClassificationOutput;
  });
}

// ── EntreComp Classifier ──────────────────────────────────────────────────────

export const ENTRECOMP_COMPETENCES = [
  "SpottingOpportunities",
  "Creativity",
  "Vision",
  "ValuingIdeas",
  "EthicalSustainableThinking",
  "SelfAwareness",
  "Motivation",
  "MobilisingResources",
  "FinancialLiteracy",
  "MobilisingOthers",
  "TakingInitiative",
  "PlanningManagement",
  "CopingWithUncertainty",
  "WorkingWithOthers",
  "LearningThroughExperience",
] as const;

export type EntreCompCompetence = typeof ENTRECOMP_COMPETENCES[number];

export type EcClassificationOutput = Record<EntreCompCompetence, string> & {
  rationale: Record<EntreCompCompetence, string>;
  evidence: Record<EntreCompCompetence, Array<{ field: string; snippet: string; weight: "primary" | "secondary" }>>;
};

function safeEcLevel(raw: unknown): string {
  if (typeof raw !== "string") return "None";
  const v = raw.trim();
  if (["None", "Foundation", "Intermediate", "Advanced"].includes(v)) return v;
  return "None";
}

const EC_COMPETENCE_DESCRIPTORS: Record<EntreCompCompetence, { area: string; desc: string }> = {
  SpottingOpportunities:      { area: "1", desc: "Identify value-creating opportunities in personal, professional, and social contexts; recognise unmet needs, problems worth solving, and emerging trends." },
  Creativity:                 { area: "1", desc: "Develop creative ideas by combining knowledge across domains; generate novel approaches; challenge assumptions and experiment with new methods." },
  Vision:                     { area: "1", desc: "Work towards a future-oriented, purposeful goal; articulate and communicate a clear vision; imagine and frame possibilities beyond the present." },
  ValuingIdeas:               { area: "1", desc: "Make aesthetic and functional judgements about ideas; assess their novelty, desirability, and feasibility; distinguish between ideas with and without value." },
  EthicalSustainableThinking: { area: "1", desc: "Assess the ethical implications and sustainability consequences of ideas and actions; consider social, environmental, and long-term impact." },
  SelfAwareness:              { area: "2", desc: "Reflect on own strengths, weaknesses, motivations, and capabilities; understand entrepreneurial potential; develop a sense of agency and self-efficacy." },
  Motivation:                 { area: "2", desc: "Maintain focus, drive, and perseverance towards goals; demonstrate resilience and determination; show enthusiasm and commitment to initiating change." },
  MobilisingResources:        { area: "2", desc: "Gather, manage, and deploy the tangible resources (people, knowledge, finances, materials, digital tools) needed to create value." },
  FinancialLiteracy:          { area: "2", desc: "Understand and apply financial and economic concepts to value creation; assess economic viability; manage budgets, costs, and financial planning." },
  MobilisingOthers:           { area: "2", desc: "Inspire, enthuse, and persuade others; build networks and alliances; lead others towards a shared goal." },
  TakingInitiative:           { area: "3", desc: "Proactively initiate processes, projects, or actions without being prompted; seize opportunities and take calculated risks; act with agency." },
  PlanningManagement:         { area: "3", desc: "Set goals and plans; structure projects, tasks, and timelines; manage resources, priorities, and progress; adapt plans in response to change." },
  CopingWithUncertainty:      { area: "3", desc: "Make decisions under ambiguity and uncertainty; pivot and adapt when circumstances change; demonstrate resilience and manage risk." },
  WorkingWithOthers:          { area: "3", desc: "Collaborate effectively in teams; build partnerships and networks; negotiate, communicate, and resolve conflicts constructively." },
  LearningThroughExperience:  { area: "3", desc: "Learn from both success and failure; reflect critically on entrepreneurial experience; transfer insights to new contexts; embrace a growth mindset." },
};

function buildEntreCompCompetenceList(): string {
  const areas: Array<{ label: string; keys: EntreCompCompetence[] }> = [
    { label: "Ideas and Opportunities", keys: ["SpottingOpportunities","Creativity","Vision","ValuingIdeas","EthicalSustainableThinking"] },
    { label: "Resources",               keys: ["SelfAwareness","Motivation","MobilisingResources","FinancialLiteracy","MobilisingOthers"] },
    { label: "Into Action",             keys: ["TakingInitiative","PlanningManagement","CopingWithUncertainty","WorkingWithOthers","LearningThroughExperience"] },
  ];
  return areas.map((area, ai) => {
    const comps = area.keys.map((k, ki) => {
      const d = EC_COMPETENCE_DESCRIPTORS[k];
      return `  ${ai + 1}.${ki + 1}. ${k} — ${d.desc}`;
    }).join("\n");
    return `AREA ${ai + 1} — ${area.label}\n${comps}`;
  }).join("\n\n");
}

export async function classifyModuleEntreComp(
  moduleCode: string,
  moduleTitle: string,
  learningOutcomes: string | null,
  overview: string | null,
  indicativeSyllabus: string | null,
  teachingMethods: string | null,
  assessmentText: string | null = null,
  stageInferred: string | null = null,
  disciplineFamily: string | null = null,
): Promise<EcClassificationOutput> {
  const { text: evidenceBlock } = buildEvidenceBlock({
    moduleCode, moduleTitle, overview, learningOutcomes,
    indicativeSyllabus, teachingMethods, assessmentText,
    stageInferred, disciplineFamily,
  });

  const competenceList = buildEntreCompCompetenceList();
  const keyList = ENTRECOMP_COMPETENCES.join('", "');
  const levelFields = ENTRECOMP_COMPETENCES.map(k => `  "${k}": "<None|Foundation|Intermediate|Advanced>"`).join(",\n");
  const rationaleFields = ENTRECOMP_COMPETENCES.map(k => `    "${k}": "<one sentence>"`).join(",\n");
  const evidenceFields = ENTRECOMP_COMPETENCES.map(k => `    "${k}": []`).join(",\n");

  const prompt = `You are a curriculum analyst for TU Dublin's Arts Programme. Classify a module against EntreComp — the European Entrepreneurship Competence Framework.

PRIMARY fields (descriptor, learning outcomes, syllabus) carry the highest weight.
SECONDARY fields (teaching methods, assessment) carry supporting weight.
METADATA is framing only — do not infer entrepreneurial content from module code, stage, or discipline name alone.

━━━ CLASSIFICATION LEVELS ━━━
- None: No meaningful or intentional contribution to this competence. Not a failure — most competences will be None for most modules.
- Foundation: Introductory or surface-level engagement. Learners encounter the competence idea but do not develop it substantially.
- Intermediate: Active and purposeful development. Learners practise, apply, or reflect on the competence through outcomes, activities, or assessment.
- Advanced: Strong, integrative, or critical engagement. Learners demonstrate, lead, create, or evaluate at a sophisticated level through this competence.

━━━ ENTRECOMP COMPETENCES (use EXACTLY these 15 keys) ━━━
${competenceList}

━━━ RULES ━━━
1. Use ONLY explicit evidence from the fields provided. Do NOT infer from the module code, title, or stage.
2. If in doubt, use None. Be conservative — most modules will have None across most competences.
3. For each competence at level != None, identify 1–3 influential text snippets. For None, use empty array [].
4. EntreComp is about entrepreneurship, innovation, and value creation — not just business subjects. Creative, social, and civic modules may also engage competences.

━━━ MODULE EVIDENCE ━━━
${evidenceBlock}

Return ONLY valid JSON, no markdown. Use exactly these 15 keys plus rationale and evidence:
{
${levelFields},
  "rationale": {
${rationaleFields}
  },
  "evidence": {
${evidenceFields}
  }
}

For evidence: 1–3 items per competence where level != None, empty array for None.
Each evidence item: { "field": "<label>", "snippet": "<max 120 chars>", "weight": "<primary|secondary>" }
Field labels: Module Descriptor, Learning Outcomes, Indicative Syllabus, Learning & Teaching Methods, Assessment Approaches.`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_completion_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.choices[0]?.message?.content ?? "";
  const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`Invalid JSON from EntreComp classification: ${jsonStr}`);
  }

  const rationale = (parsed.rationale ?? {}) as Record<string, string>;
  const evidence  = (parsed.evidence  ?? {}) as Record<string, unknown>;
  const result: Partial<EcClassificationOutput> = {
    rationale: {} as Record<EntreCompCompetence, string>,
    evidence:  {} as Record<EntreCompCompetence, Array<{ field: string; snippet: string; weight: "primary" | "secondary" }>>,
  };
  for (const comp of ENTRECOMP_COMPETENCES) {
    (result as Record<string, unknown>)[comp] = safeEcLevel(parsed[comp]);
    (result.rationale as Record<string, string>)[comp] = rationale[comp] ?? "No rationale provided.";
    (result.evidence  as Record<string, unknown[]>)[comp] = safeEvidence(evidence[comp]);
  }
  return result as EcClassificationOutput;
}

export type EntreCompBatchInput = GABatchInput;

export async function classifyModulesEntreCompBatch(modules: EntreCompBatchInput[]): Promise<EcClassificationOutput[]> {
  if (modules.length === 0) return [];

  const evidenceBlocks = modules.map((m, i) => {
    const { text } = buildEvidenceBlock(m);
    return `=== MODULE ${i + 1} ===\n${text}`;
  }).join("\n\n");

  const competenceList = buildEntreCompCompetenceList();
  const keyList = ENTRECOMP_COMPETENCES.join('", "');

  const prompt = `You are a curriculum analyst for TU Dublin's Arts Programme. Classify each module against EntreComp — the European Entrepreneurship Competence Framework.

PRIMARY fields (descriptor, learning outcomes, syllabus) carry the highest weight.
SECONDARY fields (teaching methods, assessment) carry supporting weight.
METADATA is framing only.

━━━ CLASSIFICATION LEVELS ━━━
- None: No meaningful evidence of this competence. Use for absent or tangential content. Most competences should be None.
- Foundation: Introductory encounter with the competence idea.
- Intermediate: Active development, practice, or application of the competence.
- Advanced: Sophisticated, integrative, or critical engagement at a high level.

━━━ ENTRECOMP COMPETENCES (use EXACTLY these 15 keys) ━━━
${competenceList}

━━━ RULES ━━━
1. Use ONLY explicit evidence from the fields provided. If in doubt, use None.
2. Be conservative — most modules will have None across most competences.
3. EntreComp applies beyond business: creative, social, and civic modules may engage competences.
4. For evidence: 1–3 items per competence where level != None, empty array for None.

━━━ MODULE EVIDENCE ━━━
Process ${modules.length} modules. Return a JSON array of exactly ${modules.length} objects in order.

${evidenceBlocks}

Return ONLY a valid JSON array of ${modules.length} objects. Each must have exactly these keys: "${keyList}", rationale, evidence.`;

  const response = await openai.chat.completions.create({
    model: BATCH_MODEL,
    max_completion_tokens: modules.length * 2500,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.choices[0]?.message?.content ?? "";
  const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  let parsed: Record<string, unknown>[];
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`Invalid JSON from EntreComp batch classification: ${jsonStr.slice(0, 200)}`);
  }
  if (!Array.isArray(parsed) || parsed.length !== modules.length) {
    throw new Error(`Expected ${modules.length} EntreComp results, got ${Array.isArray(parsed) ? parsed.length : "non-array"}`);
  }

  return parsed.map((p) => {
    const rat = (p.rationale ?? {}) as Record<string, string>;
    const ev  = (p.evidence  ?? {}) as Record<string, unknown>;
    const result: Partial<EcClassificationOutput> = {
      rationale: {} as Record<EntreCompCompetence, string>,
      evidence:  {} as Record<EntreCompCompetence, Array<{ field: string; snippet: string; weight: "primary" | "secondary" }>>,
    };
    for (const comp of ENTRECOMP_COMPETENCES) {
      (result as Record<string, unknown>)[comp] = safeEcLevel(p[comp]);
      (result.rationale as Record<string, string>)[comp] = rat[comp] ?? "No rationale provided.";
      (result.evidence  as Record<string, unknown[]>)[comp] = safeEvidence(ev[comp]);
    }
    return result as EcClassificationOutput;
  });
}

export interface ExtractFieldsOutput {
  moduleCode: string | null;
  moduleTitle: string | null;
  overview: string | null;
  learningOutcomes: string | null;
  indicativeSyllabus: string | null;
  teachingMethods: string | null;
  assessmentText: string | null;
  requisitesStatus: string | null;
  requisitesRaw: string | null;
}

export async function extractFields(rawText: string): Promise<ExtractFieldsOutput> {
  const prompt = `You are an academic module descriptor parser. Extract structured information from the raw text below.

Return ONLY valid JSON with these fields (use null if not found):
{
  "moduleCode": "<e.g. LANG1001 or null>",
  "moduleTitle": "<full module title or null>",
  "overview": "<module description / aims / introduction paragraph(s) or null>",
  "learningOutcomes": "<all learning outcomes listed, preserving numbering if present, or null>",
  "indicativeSyllabus": "<indicative content / syllabus / topics or null>",
  "teachingMethods": "<content from the 'Learning and Teaching Methods' section only — do not include assessment information here, or null>",
  "assessmentText": "<content from assessment-related sections such as 'Module Content & Assessment', assessment breakdown, assessment type, weighting, indicative week, linked learning outcomes, semester, threshold, examination details, reassessment requirements — extract as much structured detail as is present, or null>",
  "requisitesStatus": "<one of: 'None', 'Pre-requisite', 'Co-requisite', 'Pre- and Co-requisite', 'Unknown' — based on the Requisites section of the document>",
  "requisitesRaw": "<verbatim text from the Requisites section of the document, or null if not present>"
}

Rules:
- Extract verbatim or lightly cleaned text — do not paraphrase
- If a section is clearly absent, use null
- Module code is typically an alphanumeric code like LANG1001, COMM2003, etc.
- Do not invent or hallucinate content not present in the text
- For requisitesStatus: if the Requisites section says 'No requisites exist' or similar, use 'None'. If it lists pre-requisites only, use 'Pre-requisite'. If co-requisites only, use 'Co-requisite'. If both, use 'Pre- and Co-requisite'. If the section is missing or unreadable, use 'Unknown'.
- teachingMethods must NOT contain assessment information — keep teaching delivery methods only
- assessmentText should capture all assessment-related content separately

RAW TEXT:
${rawText.slice(0, 8000)}`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_completion_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.choices[0]?.message?.content ?? "";
  const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    return JSON.parse(jsonStr) as ExtractFieldsOutput;
  } catch {
    return {
      moduleCode: null,
      moduleTitle: null,
      overview: null,
      learningOutcomes: null,
      indicativeSyllabus: null,
      teachingMethods: null,
      assessmentText: null,
      requisitesStatus: null,
      requisitesRaw: null,
    };
  }
}
