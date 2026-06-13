import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  aiClaimsTable,
  aiModelRunsTable,
  analysisRunsTable,
  assessmentComponentsTable,
  claimEvidenceLinksTable,
  competenciesTable,
  competencyEvaluationEvidenceLinksTable,
  competencyEvaluationsTable,
  competencyDomainsTable,
  curatedStructureItemsTable,
  curatedStructuresTable,
  db,
  descriptorSectionsTable,
  evidenceItemsTable,
  frameworksTable,
  frameworkVersionsTable,
  humanReviewsTable,
  learningOutcomesTable,
  lensesTable,
  lensVersionsTable,
  moduleDescriptorsTable,
  modulesTable,
  promptVersionsTable,
  usersTable,
} from "@workspace/db";

export type ClaimActorContext = {
  institutionId: string;
  userId?: string;
};

export type ClaimReviewDecision = "accept" | "reject" | "amend" | "request_clarification" | "not_applicable";

export type ClaimReviewStatus =
  | "not_reviewed"
  | "accepted"
  | "rejected"
  | "amended"
  | "clarification_required"
  | "not_applicable";

export type ClaimReviewDto = {
  id: string;
  decision: ClaimReviewDecision;
  status: ClaimReviewStatus;
  rationale?: string | null;
  amendedText?: string | null;
  reviewer?: { id?: string | null; name?: string | null; email?: string | null };
  createdAt?: string | null;
};

export type EvidenceClaimDto = {
  id: string;
  title?: string | null;
  claimText: string;
  rationale?: string | null;
  confidence?: number | null;
  claimType: string;
  status: string;
  framework?: { key?: string | null; name?: string | null; versionLabel?: string | null };
  lens?: { key?: string | null; name?: string | null; versionLabel?: string | null };
  competency?: { id?: string | null; key?: string | null; name?: string | null; domain?: string | null };
  analysisRun: {
    id: string;
    status: string;
    startedAt?: string | null;
    completedAt?: string | null;
    model?: string | null;
    provider?: string | null;
    promptVersion?: string | null;
  };
  evidence: Array<{
    id: string;
    sourceKind: string;
    evidenceText?: string | null;
    descriptorSectionId?: string | null;
    learningOutcomeId?: string | null;
    assessmentComponentId?: string | null;
    documentSectionId?: string | null;
    relevance?: number | null;
    relationship: string;
  }>;
  review: {
    status: ClaimReviewStatus;
    isInstitutionalFinding: boolean;
    findingText?: string | null;
    latestReview?: ClaimReviewDto | null;
  };
  reviewHistory: ClaimReviewDto[];
  createdAt?: string | null;
};

export type ModuleClaimsResponse = {
  claims: EvidenceClaimDto[];
  total: number;
};

export type ClaimGenerationResponse = {
  analysisRunId?: string;
  claimsCreated: number;
  claimsSkipped: number;
  evidenceConsidered: number;
  evaluationsCreated?: number;
  modulesAnalysed?: number;
  modulesWithClaims?: number;
  message: string;
  claims: EvidenceClaimDto[];
};

export type FrameworkIntelligenceKey = "greencomp" | "digcomp" | "entrecomp" | "engineers-ireland";

export type GreenCompBulkGenerationScope = "module" | "programme" | "institution";

export type GreenCompBulkGenerationResponse = {
  scope: GreenCompBulkGenerationScope;
  modulesAnalysed: number;
  modulesWithClaims: number;
  claimsCreated: number;
  claimsSkipped: number;
  evaluationsCreated: number;
  evidenceConsidered: number;
  results: Array<{
    moduleId: string;
    claimsCreated: number;
    claimsSkipped: number;
    evaluationsCreated: number;
    evidenceConsidered: number;
    message: string;
  }>;
};

export type ClaimReviewInput = {
  decision: ClaimReviewDecision;
  rationale?: string;
  amendedText?: string;
};

export type ClaimReviewResponse = {
  claim: EvidenceClaimDto;
  review: ClaimReviewDto;
  message: string;
};

type FrameworkRule = {
  key: string;
  terms: string[];
};

const deterministicProvider = "cast";
const promptVersionLabel = "1.0-deterministic";

const frameworkClaimConfigs: Record<FrameworkIntelligenceKey, {
  key: FrameworkIntelligenceKey;
  name: string;
  versionLabel: string;
  lensKey: string;
  model: string;
  promptKey: string;
  promptName: string;
  rules: FrameworkRule[];
}> = {
  greencomp: {
    key: "greencomp",
    name: "GreenComp",
    versionLabel: "2022",
    lensKey: "greencomp-curriculum-evidence",
    model: "deterministic-greencomp-claims-v1",
    promptKey: "greencomp-evidence-claim-foundation",
    promptName: "GreenComp evidence claim foundation",
    rules: [
      { key: "valuing-sustainability", terms: ["sustainability", "sustainable", "values", "ethic", "responsibility"] },
      { key: "supporting-fairness", terms: ["fairness", "equity", "justice", "inclusive", "future generations", "social responsibility"] },
      { key: "promoting-nature", terms: ["nature", "biodiversity", "ecosystem", "ecological", "environment", "climate"] },
      { key: "systems-thinking", terms: ["system", "systems", "interdepend", "complex", "holistic", "interact"] },
      { key: "critical-thinking", terms: ["critical", "critique", "evaluate", "evidence", "assumption", "argument"] },
      { key: "problem-framing", terms: ["problem", "challenge", "frame", "scope", "mitigate", "adapt"] },
      { key: "futures-literacy", terms: ["future", "scenario", "forecast", "vision", "long-term", "anticipate"] },
      { key: "adaptability", terms: ["adapt", "uncertainty", "risk", "transition", "change", "resilience"] },
      { key: "exploratory-thinking", terms: ["explore", "creative", "innovation", "experiment", "interdisciplinary", "novel"] },
      { key: "political-agency", terms: ["policy", "governance", "political", "accountability", "regulation", "civic"] },
      { key: "collective-action", terms: ["collabor", "team", "collective", "community", "stakeholder", "partnership"] },
      { key: "individual-initiative", terms: ["initiative", "action", "contribute", "leadership", "personal", "practice"] },
    ],
  },
  digcomp: {
    key: "digcomp",
    name: "DigComp",
    versionLabel: "3.0",
    lensKey: "digcomp-curriculum-evidence",
    model: "deterministic-digcomp-claims-v1",
    promptKey: "digcomp-evidence-claim-foundation",
    promptName: "DigComp evidence claim foundation",
    rules: [
      { key: "browsing-searching-and-filtering", terms: ["search", "filter", "information need", "digital content", "retrieve"] },
      { key: "evaluating-data-information-and-digital-content", terms: ["evaluate", "credibility", "reliability", "data", "information", "evidence"] },
      { key: "managing-data-information-and-digital-content", terms: ["manage data", "database", "dataset", "organise", "store", "retrieve"] },
      { key: "interacting-through-digital-technologies", terms: ["digital communication", "online interaction", "virtual", "platform", "collaborative tool"] },
      { key: "sharing-through-digital-technologies", terms: ["share", "publish", "digital content", "repository", "online"] },
      { key: "engaging-in-citizenship-through-digital-technologies", terms: ["digital citizenship", "civic", "public service", "participation", "society"] },
      { key: "collaborating-through-digital-technologies", terms: ["collaborat", "team", "digital tool", "version control", "shared workspace"] },
      { key: "netiquette", terms: ["netiquette", "online behaviour", "digital etiquette", "professional conduct", "respectful"] },
      { key: "managing-digital-identity", terms: ["digital identity", "profile", "privacy", "reputation", "credential"] },
      { key: "developing-digital-content", terms: ["develop digital", "create digital", "media", "content", "website", "app"] },
      { key: "integrating-and-re-elaborating-digital-content", terms: ["integrat", "adapt", "remix", "combine", "edit digital"] },
      { key: "copyright-and-licences", terms: ["copyright", "licence", "creative commons", "intellectual property", "attribution"] },
      { key: "programming", terms: ["program", "code", "software", "algorithm", "script", "application"] },
      { key: "protecting-devices", terms: ["security", "cyber", "device", "malware", "threat", "protect"] },
      { key: "protecting-personal-data-and-privacy", terms: ["personal data", "privacy", "gdpr", "data protection", "confidential"] },
      { key: "protecting-health-and-well-being", terms: ["wellbeing", "screen", "digital health", "online safety", "accessibility"] },
      { key: "protecting-the-environment", terms: ["environment", "sustainable digital", "energy", "carbon", "e-waste"] },
      { key: "solving-technical-problems", terms: ["troubleshoot", "technical problem", "debug", "diagnose", "resolve"] },
      { key: "identifying-needs-and-technological-responses", terms: ["requirements", "user needs", "technology solution", "digital response", "select tools"] },
      { key: "creatively-using-digital-technology", terms: ["innovation", "creative", "prototype", "digital technology", "design solution"] },
      { key: "identifying-digital-competence-gaps", terms: ["digital skills", "competence gap", "professional development", "upskill", "reflect"] },
    ],
  },
  entrecomp: {
    key: "entrecomp",
    name: "EntreComp",
    versionLabel: "2016",
    lensKey: "entrecomp-curriculum-evidence",
    model: "deterministic-entrecomp-claims-v1",
    promptKey: "entrecomp-evidence-claim-foundation",
    promptName: "EntreComp evidence claim foundation",
    rules: [
      { key: "spotting-opportunities", terms: ["opportunit", "market", "need", "problem", "value"] },
      { key: "creativity", terms: ["creative", "ideat", "innovation", "design", "novel"] },
      { key: "vision", terms: ["vision", "future", "strategy", "purpose", "long-term"] },
      { key: "valuing-ideas", terms: ["value proposition", "evaluate ideas", "benefit", "impact", "feasibility"] },
      { key: "ethical-and-sustainable-thinking", terms: ["ethical", "sustainable", "responsible", "impact", "consequence"] },
      { key: "self-awareness-and-self-efficacy", terms: ["self-awareness", "reflect", "confidence", "strengths", "self-efficacy"] },
      { key: "motivation-and-perseverance", terms: ["motivation", "perseverance", "resilience", "persistence", "goal"] },
      { key: "mobilising-resources", terms: ["resource", "budget", "materials", "time management", "capacity"] },
      { key: "financial-and-economic-literacy", terms: ["financial", "economic", "cost", "revenue", "business model"] },
      { key: "mobilising-others", terms: ["persuade", "pitch", "stakeholder", "influence", "engage others"] },
      { key: "taking-the-initiative", terms: ["initiative", "action", "lead", "start", "implement"] },
      { key: "planning-and-management", terms: ["plan", "manage", "milestone", "schedule", "project"] },
      { key: "coping-with-uncertainty-ambiguity-and-risk", terms: ["risk", "uncertainty", "ambiguity", "contingency", "decision"] },
      { key: "working-with-others", terms: ["team", "collaborat", "group work", "partnership", "network"] },
      { key: "learning-through-experience", terms: ["reflect", "lesson learned", "iterate", "feedback", "experience"] },
    ],
  },
  "engineers-ireland": {
    key: "engineers-ireland",
    name: "Engineers Ireland",
    versionLabel: "2021",
    lensKey: "engineers-ireland-curriculum-evidence",
    model: "deterministic-engineers-ireland-claims-v1",
    promptKey: "engineers-ireland-evidence-claim-foundation",
    promptName: "Engineers Ireland evidence claim foundation",
    rules: [
      { key: "knowledge-and-understanding", terms: ["mathematics", "science", "engineering science", "data science", "analytics", "technology"] },
      { key: "problem-analysis", terms: ["problem", "analyse", "analyze", "formulate", "model", "engineering problem"] },
      { key: "design", terms: ["design", "requirements", "solution", "prototype", "system", "component", "process"] },
      { key: "investigation", terms: ["investigat", "experiment", "simulation", "data", "research", "test", "laboratory"] },
      { key: "professional-and-ethical-responsibilities", terms: ["professional", "ethical", "sustainability", "sustainable", "safety", "risk", "environment", "equality", "diversity", "inclusion"] },
      { key: "teamwork-and-lifelong-learning", terms: ["team", "collaborat", "lifelong learning", "cpd", "self-directed", "inclusive"] },
      { key: "communication", terms: ["communicat", "presentation", "report", "audience", "technical paper", "defend"] },
      { key: "engineering-management", terms: ["management", "project", "resource", "financial", "commercial", "governance", "contract"] },
    ],
  },
};

function preview(text: string | null | undefined, limit = 220): string | null {
  if (!text?.trim()) return null;
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > limit ? `${compact.slice(0, limit - 1)}...` : compact;
}

function evidenceText(item: typeof evidenceItemsTable.$inferSelect): string {
  return (item.evidenceText ?? "").toLowerCase();
}

function evidenceScore(item: typeof evidenceItemsTable.$inferSelect, terms: string[]): number {
  const text = evidenceText(item);
  return terms.reduce((score, term) => score + (text.includes(term.toLowerCase()) ? 1 : 0), 0);
}

function confidenceFor(matchCount: number, evidenceCount: number): number {
  return Math.min(0.88, Number((0.48 + matchCount * 0.06 + evidenceCount * 0.04).toFixed(2)));
}

async function loadCanonicalModule(context: ClaimActorContext, moduleId: string) {
  const [module] = await db
    .select()
    .from(modulesTable)
    .where(and(eq(modulesTable.id, moduleId), eq(modulesTable.institutionId, context.institutionId)))
    .limit(1);

  return module;
}

async function loadFrameworkConfiguration(frameworkKey: FrameworkIntelligenceKey) {
  const config = frameworkClaimConfigs[frameworkKey];
  const [frameworkRow] = await db
    .select({ framework: frameworksTable, frameworkVersion: frameworkVersionsTable })
    .from(frameworksTable)
    .innerJoin(frameworkVersionsTable, eq(frameworkVersionsTable.frameworkId, frameworksTable.id))
    .where(and(eq(frameworksTable.key, config.key), eq(frameworkVersionsTable.versionLabel, config.versionLabel)))
    .limit(1);

  const [lensRow] = await db
    .select({ lens: lensesTable, lensVersion: lensVersionsTable })
    .from(lensesTable)
    .innerJoin(lensVersionsTable, eq(lensVersionsTable.lensId, lensesTable.id))
    .where(eq(lensesTable.key, config.lensKey))
    .limit(1);

  if (!frameworkRow) throw new Error(`${config.name} framework seed is not available`);
  if (!lensRow) throw new Error(`${config.name} evidence lens seed is not available`);

  return {
    config,
    framework: frameworkRow.framework,
    frameworkVersion: frameworkRow.frameworkVersion,
    lens: lensRow.lens,
    lensVersion: lensRow.lensVersion,
  };
}

async function ensurePromptVersion(context: ClaimActorContext, config: typeof frameworkClaimConfigs[FrameworkIntelligenceKey]) {
  const [existing] = await db
    .select()
    .from(promptVersionsTable)
    .where(
      and(
        eq(promptVersionsTable.institutionId, context.institutionId),
        eq(promptVersionsTable.key, config.promptKey),
        eq(promptVersionsTable.versionLabel, promptVersionLabel),
      ),
    )
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(promptVersionsTable)
    .values({
      institutionId: context.institutionId,
      key: config.promptKey,
      name: config.promptName,
      versionLabel: promptVersionLabel,
      status: "active",
      systemPrompt: `Deterministic CAST ${config.name} evidence-claim foundation. No AI model call is made.`,
      userPromptTemplate: `Create provisional ${config.name} evidence claims only when linked evidence exists.`,
      outputSchema: {
        claimText: "string",
        rationale: "string",
        confidence: "number",
        evidenceItemIds: "string[]",
      },
      configuration: {
        phase: "6B.1",
        deterministic: true,
        framework: config.key,
      },
      createdByUserId: context.userId,
    })
    .returning();

  return created;
}

async function loadModuleEvidence(context: ClaimActorContext, moduleId: string) {
  const descriptors = await db
    .select()
    .from(moduleDescriptorsTable)
    .where(and(eq(moduleDescriptorsTable.institutionId, context.institutionId), eq(moduleDescriptorsTable.moduleId, moduleId)))
    .orderBy(asc(moduleDescriptorsTable.createdAt));

  const descriptorIds = descriptors.map((descriptor) => descriptor.id);

  const [sections, outcomes, assessments, evidence] = await Promise.all([
    descriptorIds.length
      ? db
          .select()
          .from(descriptorSectionsTable)
          .where(and(eq(descriptorSectionsTable.institutionId, context.institutionId), inArray(descriptorSectionsTable.moduleDescriptorId, descriptorIds)))
      : [],
    descriptorIds.length
      ? db
          .select()
          .from(learningOutcomesTable)
          .where(and(eq(learningOutcomesTable.institutionId, context.institutionId), inArray(learningOutcomesTable.moduleDescriptorId, descriptorIds)))
      : [],
    descriptorIds.length
      ? db
          .select()
          .from(assessmentComponentsTable)
          .where(and(eq(assessmentComponentsTable.institutionId, context.institutionId), inArray(assessmentComponentsTable.moduleDescriptorId, descriptorIds)))
      : [],
    db
      .select()
      .from(evidenceItemsTable)
      .where(and(eq(evidenceItemsTable.institutionId, context.institutionId), eq(evidenceItemsTable.moduleId, moduleId)))
      .orderBy(asc(evidenceItemsTable.createdAt)),
  ]);

  return {
    descriptors,
    sections,
    outcomes,
    assessments,
    evidence: evidence.filter((item) => item.evidenceText?.trim()),
  };
}

function summarizeEvidenceSources(input: {
  evidence: Array<typeof evidenceItemsTable.$inferSelect>;
  sections: Array<typeof descriptorSectionsTable.$inferSelect>;
  outcomes: Array<typeof learningOutcomesTable.$inferSelect>;
  assessments: Array<typeof assessmentComponentsTable.$inferSelect>;
}) {
  const sectionIds = new Set(input.sections.map((section) => section.id));
  const outcomeIds = new Set(input.outcomes.map((outcome) => outcome.id));
  const assessmentIds = new Set(input.assessments.map((assessment) => assessment.id));

  return {
    evidenceItems: input.evidence.length,
    descriptorSections: input.evidence.filter((item) => item.descriptorSectionId && sectionIds.has(item.descriptorSectionId)).length,
    learningOutcomes: input.evidence.filter((item) => item.learningOutcomeId && outcomeIds.has(item.learningOutcomeId)).length,
    assessmentComponents: input.evidence.filter((item) => item.assessmentComponentId && assessmentIds.has(item.assessmentComponentId)).length,
  };
}

async function existingGenerationClaims(context: ClaimActorContext, moduleId: string) {
  const rows = await db
    .select()
    .from(aiClaimsTable)
    .where(and(eq(aiClaimsTable.institutionId, context.institutionId), eq(aiClaimsTable.moduleId, moduleId)));

  return new Map(
    rows
      .map((row) => [typeof row.metadata.generationKey === "string" ? row.metadata.generationKey : undefined, row] as const)
      .filter((entry): entry is [string, typeof aiClaimsTable.$inferSelect] => Boolean(entry[0])),
  );
}

function generationKey(frameworkKey: FrameworkIntelligenceKey, moduleId: string, competencyId: string, evidenceIds: string[]): string {
  return `${frameworkKey}:${moduleId}:${competencyId}:${evidenceIds.sort().join(",")}`;
}

function maturityForEvidence(matchCount: number, evidenceCount: number) {
  if (matchCount >= 8 || evidenceCount >= 5) return "leading";
  if (matchCount >= 5 || evidenceCount >= 3) return "consolidating";
  if (matchCount >= 2 || evidenceCount >= 2) return "developing";
  return "developing";
}

async function placementForModule(context: ClaimActorContext, moduleId: string) {
  const [row] = await db
    .select({ item: curatedStructureItemsTable, structure: curatedStructuresTable })
    .from(curatedStructureItemsTable)
    .innerJoin(curatedStructuresTable, eq(curatedStructureItemsTable.curatedStructureId, curatedStructuresTable.id))
    .where(and(eq(curatedStructureItemsTable.institutionId, context.institutionId), eq(curatedStructureItemsTable.moduleId, moduleId)))
    .orderBy(asc(curatedStructureItemsTable.orderIndex), asc(curatedStructureItemsTable.createdAt))
    .limit(1);

  return row;
}

async function ensureFrameworkEvaluation(input: {
  context: ClaimActorContext;
  frameworkKey: FrameworkIntelligenceKey;
  frameworkName: string;
  moduleId: string;
  moduleDescriptorId?: string | null;
  lensVersionId: string;
  competencyId: string;
  generationKey: string;
  evidence: Array<typeof evidenceItemsTable.$inferSelect>;
  confidence: number;
  matchCount: number;
  rationale: string;
}) {
  const existing = await db
    .select()
    .from(competencyEvaluationsTable)
    .where(and(eq(competencyEvaluationsTable.institutionId, input.context.institutionId), eq(competencyEvaluationsTable.moduleId, input.moduleId)))
    .then((rows) => rows.find((row) => row.metadata?.generationKey === input.generationKey));

  if (existing) return { evaluation: existing, created: false };

  const placement = await placementForModule(input.context, input.moduleId);
  const evidenceProgrammeVersionId = input.evidence.find((item) => item.programmeVersionId)?.programmeVersionId;
  const evidenceStructureItemId = input.evidence.find((item) => item.curatedStructureItemId)?.curatedStructureItemId;

  const [evaluation] = await db
    .insert(competencyEvaluationsTable)
    .values({
      institutionId: input.context.institutionId,
      programmeVersionId: evidenceProgrammeVersionId ?? placement?.structure.programmeVersionId,
      competencyId: input.competencyId,
      lensVersionId: input.lensVersionId,
      curatedStructureItemId: evidenceStructureItemId ?? placement?.item.id,
      moduleId: input.moduleId,
      moduleDescriptorId: input.moduleDescriptorId,
      observedLevel: maturityForEvidence(input.matchCount, input.evidence.length),
      source: "rule",
      status: "needs_review",
      confidence: input.confidence,
      rationale: input.rationale,
      createdByUserId: input.context.userId,
      metadata: {
        framework: input.frameworkKey,
        generationKey: input.generationKey,
        deterministic: true,
        aiCallMade: false,
        analysisScope: "provisional",
        formalUseRequiresReview: true,
        generatedFromClaimWorkflow: true,
      },
    })
    .returning();

  if (input.evidence.length > 0) {
    await db.insert(competencyEvaluationEvidenceLinksTable).values(
      input.evidence.map((item) => ({
        competencyEvaluationId: evaluation.id,
        evidenceItemId: item.id,
        relevance: input.confidence,
        notes: `Linked during deterministic ${input.frameworkName} analysis.`,
      })),
    ).onConflictDoNothing();
  }

  return { evaluation, created: true };
}

function formatCompetencyCode(competency: typeof competenciesTable.$inferSelect): string {
  const code = competency.metadata?.["code"];
  return typeof code === "string" && code.trim() ? code.trim() : competency.key;
}

function reviewStatusForDecision(decision: ClaimReviewDecision): ClaimReviewStatus {
  if (decision === "accept") return "accepted";
  if (decision === "reject") return "rejected";
  if (decision === "amend") return "amended";
  if (decision === "request_clarification") return "clarification_required";
  return "not_applicable";
}

function reviewLabel(status: ClaimReviewStatus): string {
  return status.replace(/_/g, " ");
}

function isFindingStatus(status: ClaimReviewStatus): boolean {
  return status === "accepted" || status === "amended";
}

function claimFindingText(claim: typeof aiClaimsTable.$inferSelect, latestReview?: ClaimReviewDto | null): string | null {
  if (!latestReview) return null;
  if (latestReview.status === "amended") return latestReview.amendedText?.trim() || claim.claimText;
  if (latestReview.status === "accepted") return claim.claimText;
  return null;
}

function reviewDto(row: {
  review: typeof humanReviewsTable.$inferSelect;
  reviewer?: typeof usersTable.$inferSelect | null;
}): ClaimReviewDto {
  return {
    id: row.review.id,
    decision: row.review.decision as ClaimReviewDecision,
    status: reviewStatusForDecision(row.review.decision as ClaimReviewDecision),
    rationale: row.review.rationale,
    amendedText: row.review.amendedText,
    reviewer: {
      id: row.reviewer?.id ?? row.review.reviewerUserId,
      name: row.reviewer?.displayName,
      email: row.reviewer?.email,
    },
    createdAt: row.review.createdAt?.toISOString() ?? null,
  };
}

export async function generateFrameworkClaimsForModule(
  context: ClaimActorContext,
  moduleId: string,
  frameworkKey: FrameworkIntelligenceKey,
): Promise<ClaimGenerationResponse> {
  const module = await loadCanonicalModule(context, moduleId);
  if (!module) throw new Error("Module not found");

  const frameworkConfiguration = await loadFrameworkConfiguration(frameworkKey);
  const { config, framework, frameworkVersion, lensVersion } = frameworkConfiguration;
  const [promptVersion, moduleEvidence] = await Promise.all([
    ensurePromptVersion(context, config),
    loadModuleEvidence(context, moduleId),
  ]);

  const startedAt = new Date();
  const [analysisRun] = await db
    .insert(analysisRunsTable)
    .values({
      institutionId: context.institutionId,
      runType: "framework_analysis",
      status: "running",
      moduleId,
      moduleDescriptorId: moduleEvidence.descriptors.at(-1)?.id,
      lensVersionId: lensVersion.id,
      frameworkVersionId: frameworkVersion.id,
      requestedByUserId: context.userId,
      startedAt,
      configuration: {
        phase: "6B.1",
        framework: config.key,
        claimOnly: true,
        deterministic: true,
      },
    })
    .returning();

  const [modelRun] = await db
    .insert(aiModelRunsTable)
    .values({
      institutionId: context.institutionId,
      analysisRunId: analysisRun.id,
      promptVersionId: promptVersion.id,
      provider: deterministicProvider,
      model: config.model,
      status: "running",
      modelConfiguration: {
        deterministic: true,
        aiCallMade: false,
      },
      startedAt,
    })
    .returning();

  if (moduleEvidence.evidence.length === 0) {
    const completedAt = new Date();
    await Promise.all([
      db
        .update(aiModelRunsTable)
        .set({ status: "completed", completedAt, responseMetadata: { claimsCreated: 0, reason: "no_evidence" } })
        .where(eq(aiModelRunsTable.id, modelRun.id)),
      db
        .update(analysisRunsTable)
        .set({ status: "completed", completedAt, summary: { claimsCreated: 0, reason: "No evidence items were available." } })
        .where(eq(analysisRunsTable.id, analysisRun.id)),
    ]);

    return {
      analysisRunId: analysisRun.id,
      claimsCreated: 0,
      claimsSkipped: 0,
      evidenceConsidered: 0,
      message: "No claims were generated because this module does not yet have evidence items.",
      claims: [],
    };
  }

  const competencies = await db
    .select({ competency: competenciesTable, domain: competencyDomainsTable })
    .from(competenciesTable)
    .leftJoin(competencyDomainsTable, eq(competenciesTable.competencyDomainId, competencyDomainsTable.id))
    .where(eq(competenciesTable.frameworkVersionId, frameworkVersion.id))
    .orderBy(asc(competenciesTable.orderIndex));

  const existingClaimsByKey = await existingGenerationClaims(context, moduleId);
  let claimsCreated = 0;
  let claimsSkipped = 0;
  let evaluationsCreated = 0;

  for (const row of competencies) {
    const rule = config.rules.find((candidate) => candidate.key === row.competency.key);
    if (!rule) continue;

    const scoredEvidence = moduleEvidence.evidence
      .map((item) => ({ item, score: evidenceScore(item, rule.terms) }))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (scoredEvidence.length === 0) continue;

    const evidenceIds = scoredEvidence.map((candidate) => candidate.item.id);
    const key = generationKey(config.key, moduleId, row.competency.id, evidenceIds);
    const matchCount = scoredEvidence.reduce((sum, candidate) => sum + candidate.score, 0);
    const competencyCode = formatCompetencyCode(row.competency);
    const confidence = confidenceFor(matchCount, scoredEvidence.length);
    const rationale = `This provisional claim is based on ${scoredEvidence.length} linked evidence source${scoredEvidence.length === 1 ? "" : "s"} containing terms associated with ${row.competency.name}.`;

    if (existingClaimsByKey.has(key)) {
      const evaluation = await ensureFrameworkEvaluation({
        context,
        frameworkKey: config.key,
        frameworkName: config.name,
        moduleId,
        moduleDescriptorId: moduleEvidence.descriptors.at(-1)?.id,
        lensVersionId: lensVersion.id,
        competencyId: row.competency.id,
        generationKey: key,
        evidence: scoredEvidence.map((candidate) => candidate.item),
        confidence,
        matchCount,
        rationale,
      });
      if (evaluation.created) evaluationsCreated += 1;
      claimsSkipped += 1;
      continue;
    }

    const sourceSummary = summarizeEvidenceSources({
      evidence: scoredEvidence.map((candidate) => candidate.item),
      sections: moduleEvidence.sections,
      outcomes: moduleEvidence.outcomes,
      assessments: moduleEvidence.assessments,
    });

    const [claim] = await db
      .insert(aiClaimsTable)
      .values({
        institutionId: context.institutionId,
        analysisRunId: analysisRun.id,
        aiModelRunId: modelRun.id,
        promptVersionId: promptVersion.id,
        programmeVersionId: scoredEvidence.find((candidate) => candidate.item.programmeVersionId)?.item.programmeVersionId,
        moduleId,
        moduleDescriptorId: moduleEvidence.descriptors.at(-1)?.id,
        descriptorSectionId: scoredEvidence.find((candidate) => candidate.item.descriptorSectionId)?.item.descriptorSectionId,
        curatedStructureItemId: scoredEvidence.find((candidate) => candidate.item.curatedStructureItemId)?.item.curatedStructureItemId,
        lensVersionId: lensVersion.id,
        frameworkVersionId: frameworkVersion.id,
        competencyId: row.competency.id,
        claimType: "competency_observation",
        status: "needs_review",
        title: `${config.name} ${competencyCode}: ${row.competency.name}`,
        claimText: `Evidence suggests this module contributes to ${config.name} competence ${competencyCode} (${row.competency.name}).`,
        rationale,
        confidence,
        metadata: {
          phase: "6B.1",
          frameworkKey: config.key,
          frameworkName: framework.name,
          frameworkVersion: frameworkVersion.versionLabel,
          lensKey: config.lensKey,
          deterministic: true,
          aiCallMade: false,
          claimOnly: true,
          notInstitutionalFinding: true,
          generationKey: key,
          matchedTerms: rule.terms.filter((term) => scoredEvidence.some((candidate) => evidenceText(candidate.item).includes(term.toLowerCase()))),
          sourceSummary,
        },
      })
      .returning();

    await db.insert(claimEvidenceLinksTable).values(
      scoredEvidence.map((candidate) => ({
        aiClaimId: claim.id,
        evidenceItemId: candidate.item.id,
        relevance: Math.min(0.95, 0.55 + candidate.score * 0.1),
        relationship: "supports",
        notes: preview(candidate.item.evidenceText),
      })),
    );

    const evaluation = await ensureFrameworkEvaluation({
      context,
      frameworkKey: config.key,
      frameworkName: config.name,
      moduleId,
      moduleDescriptorId: moduleEvidence.descriptors.at(-1)?.id,
      lensVersionId: lensVersion.id,
      competencyId: row.competency.id,
      generationKey: key,
      evidence: scoredEvidence.map((candidate) => candidate.item),
      confidence,
      matchCount,
      rationale,
    });
    if (evaluation.created) evaluationsCreated += 1;
    existingClaimsByKey.set(key, claim);
    claimsCreated += 1;
  }

  const completedAt = new Date();
  await Promise.all([
    db
      .update(aiModelRunsTable)
      .set({
        status: "completed",
        completedAt,
        responseMetadata: { claimsCreated, claimsSkipped, evaluationsCreated, evidenceConsidered: moduleEvidence.evidence.length },
      })
      .where(eq(aiModelRunsTable.id, modelRun.id)),
    db
      .update(analysisRunsTable)
      .set({
        status: "completed",
        completedAt,
        summary: { claimsCreated, claimsSkipped, evaluationsCreated, evidenceConsidered: moduleEvidence.evidence.length },
      })
      .where(eq(analysisRunsTable.id, analysisRun.id)),
  ]);

  const claims = await listClaimsForModule(context, moduleId);
  return {
    analysisRunId: analysisRun.id,
    claimsCreated,
    claimsSkipped,
    evaluationsCreated,
    evidenceConsidered: moduleEvidence.evidence.length,
    message: claimsCreated > 0
      ? `Generated ${claimsCreated} provisional ${config.name} claim${claimsCreated === 1 ? "" : "s"}.`
      : `No new ${config.name} claims were generated from the available evidence.`,
    claims: claims.claims,
  };
}

export async function generateGreenCompClaimsForModule(
  context: ClaimActorContext,
  moduleId: string,
): Promise<ClaimGenerationResponse> {
  return generateFrameworkClaimsForModule(context, moduleId, "greencomp");
}

async function moduleIdsForFrameworkScope(context: ClaimActorContext, scope: GreenCompBulkGenerationScope, targetId?: string) {
  if (scope === "module") {
    if (!targetId) throw new Error("moduleId is required for current module analysis");
    const module = await loadCanonicalModule(context, targetId);
    if (!module) throw new Error("Module not found");
    return [module.id];
  }

  if (scope === "programme") {
    if (!targetId) throw new Error("programmeVersionId is required for programme analysis");
    const rows = await db
      .select({ moduleId: curatedStructureItemsTable.moduleId })
      .from(curatedStructureItemsTable)
      .innerJoin(curatedStructuresTable, eq(curatedStructureItemsTable.curatedStructureId, curatedStructuresTable.id))
      .where(and(eq(curatedStructureItemsTable.institutionId, context.institutionId), eq(curatedStructuresTable.programmeVersionId, targetId)));
    return [...new Set(rows.map((row) => row.moduleId).filter((id): id is string => Boolean(id)))];
  }

  const rows = await db
    .select({ id: modulesTable.id })
    .from(modulesTable)
    .where(eq(modulesTable.institutionId, context.institutionId))
    .orderBy(asc(modulesTable.moduleCode), asc(modulesTable.moduleTitle));
  return rows.map((row) => row.id);
}

export async function generateFrameworkClaimsForScope(
  context: ClaimActorContext,
  input: { frameworkKey: FrameworkIntelligenceKey; scope: GreenCompBulkGenerationScope; targetId?: string },
): Promise<GreenCompBulkGenerationResponse> {
  const moduleIds = await moduleIdsForFrameworkScope(context, input.scope, input.targetId);
  const results: GreenCompBulkGenerationResponse["results"] = [];

  for (const id of moduleIds) {
    const result = await generateFrameworkClaimsForModule(context, id, input.frameworkKey);
    results.push({
      moduleId: id,
      claimsCreated: result.claimsCreated,
      claimsSkipped: result.claimsSkipped,
      evaluationsCreated: result.evaluationsCreated ?? 0,
      evidenceConsidered: result.evidenceConsidered,
      message: result.message,
    });
  }

  const claimsCreated = results.reduce((sum, result) => sum + result.claimsCreated, 0);
  const claimsSkipped = results.reduce((sum, result) => sum + result.claimsSkipped, 0);
  const evaluationsCreated = results.reduce((sum, result) => sum + result.evaluationsCreated, 0);
  const evidenceConsidered = results.reduce((sum, result) => sum + result.evidenceConsidered, 0);

  return {
    scope: input.scope,
    modulesAnalysed: moduleIds.length,
    modulesWithClaims: results.filter((result) => result.claimsCreated > 0 || result.claimsSkipped > 0).length,
    claimsCreated,
    claimsSkipped,
    evaluationsCreated,
    evidenceConsidered,
    results,
  };
}

export async function generateGreenCompClaimsForScope(
  context: ClaimActorContext,
  input: { scope: GreenCompBulkGenerationScope; targetId?: string },
): Promise<GreenCompBulkGenerationResponse> {
  return generateFrameworkClaimsForScope(context, { frameworkKey: "greencomp", ...input });
}

export async function listClaimsForModule(context: ClaimActorContext, moduleId: string): Promise<ModuleClaimsResponse> {
  const module = await loadCanonicalModule(context, moduleId);
  if (!module) throw new Error("Module not found");

  const rows = await db
    .select({
      claim: aiClaimsTable,
      analysisRun: analysisRunsTable,
      modelRun: aiModelRunsTable,
      promptVersion: promptVersionsTable,
      framework: frameworksTable,
      frameworkVersion: frameworkVersionsTable,
      lens: lensesTable,
      lensVersion: lensVersionsTable,
      competency: competenciesTable,
      domain: competencyDomainsTable,
    })
    .from(aiClaimsTable)
    .innerJoin(analysisRunsTable, eq(aiClaimsTable.analysisRunId, analysisRunsTable.id))
    .leftJoin(aiModelRunsTable, eq(aiClaimsTable.aiModelRunId, aiModelRunsTable.id))
    .leftJoin(promptVersionsTable, eq(aiClaimsTable.promptVersionId, promptVersionsTable.id))
    .leftJoin(frameworkVersionsTable, eq(aiClaimsTable.frameworkVersionId, frameworkVersionsTable.id))
    .leftJoin(frameworksTable, eq(frameworkVersionsTable.frameworkId, frameworksTable.id))
    .leftJoin(lensVersionsTable, eq(aiClaimsTable.lensVersionId, lensVersionsTable.id))
    .leftJoin(lensesTable, eq(lensVersionsTable.lensId, lensesTable.id))
    .leftJoin(competenciesTable, eq(aiClaimsTable.competencyId, competenciesTable.id))
    .leftJoin(competencyDomainsTable, eq(competenciesTable.competencyDomainId, competencyDomainsTable.id))
    .where(and(eq(aiClaimsTable.institutionId, context.institutionId), eq(aiClaimsTable.moduleId, moduleId)))
    .orderBy(desc(aiClaimsTable.createdAt));

  const claimIds = rows.map((row) => row.claim.id);
  const evidenceRows = claimIds.length
    ? await db
        .select({ link: claimEvidenceLinksTable, evidence: evidenceItemsTable })
        .from(claimEvidenceLinksTable)
        .innerJoin(evidenceItemsTable, eq(claimEvidenceLinksTable.evidenceItemId, evidenceItemsTable.id))
        .where(inArray(claimEvidenceLinksTable.aiClaimId, claimIds))
        .orderBy(asc(claimEvidenceLinksTable.createdAt))
    : [];

  const evidenceByClaim = new Map<string, typeof evidenceRows>();
  for (const row of evidenceRows) {
    evidenceByClaim.set(row.link.aiClaimId, [...(evidenceByClaim.get(row.link.aiClaimId) ?? []), row]);
  }

  const reviewRows = claimIds.length
    ? await db
        .select({ review: humanReviewsTable, reviewer: usersTable })
        .from(humanReviewsTable)
        .leftJoin(usersTable, eq(humanReviewsTable.reviewerUserId, usersTable.id))
        .where(and(eq(humanReviewsTable.institutionId, context.institutionId), inArray(humanReviewsTable.aiClaimId, claimIds)))
        .orderBy(desc(humanReviewsTable.createdAt))
    : [];

  const reviewsByClaim = new Map<string, ClaimReviewDto[]>();
  for (const row of reviewRows) {
    if (!row.review.aiClaimId) continue;
    reviewsByClaim.set(row.review.aiClaimId, [...(reviewsByClaim.get(row.review.aiClaimId) ?? []), reviewDto(row)]);
  }

  const claims = rows.map((row) => {
    const reviewHistory = reviewsByClaim.get(row.claim.id) ?? [];
    const latestReview = reviewHistory.at(0) ?? null;
    const reviewStatus = latestReview?.status ?? "not_reviewed";
    const findingText = claimFindingText(row.claim, latestReview);

    return {
      id: row.claim.id,
      title: row.claim.title,
      claimText: row.claim.claimText,
      rationale: row.claim.rationale,
      confidence: row.claim.confidence,
      claimType: row.claim.claimType,
      status: row.claim.status,
      framework: {
        key: row.framework?.key,
        name: row.framework?.name,
        versionLabel: row.frameworkVersion?.versionLabel,
      },
      lens: {
        key: row.lens?.key,
        name: row.lens?.name,
        versionLabel: row.lensVersion?.versionLabel,
      },
      competency: {
        id: row.competency?.id,
        key: row.competency?.key,
        name: row.competency?.name,
        domain: row.domain?.name,
      },
      analysisRun: {
        id: row.analysisRun.id,
        status: row.analysisRun.status,
        startedAt: row.analysisRun.startedAt?.toISOString() ?? null,
        completedAt: row.analysisRun.completedAt?.toISOString() ?? null,
        model: row.modelRun?.model,
        provider: row.modelRun?.provider,
        promptVersion: row.promptVersion?.versionLabel,
      },
      evidence: (evidenceByClaim.get(row.claim.id) ?? []).map((evidenceRow) => ({
        id: evidenceRow.evidence.id,
        sourceKind: evidenceRow.evidence.sourceKind,
        evidenceText: preview(evidenceRow.evidence.evidenceText),
        descriptorSectionId: evidenceRow.evidence.descriptorSectionId,
        learningOutcomeId: evidenceRow.evidence.learningOutcomeId,
        assessmentComponentId: evidenceRow.evidence.assessmentComponentId,
        documentSectionId: evidenceRow.evidence.documentSectionId,
        relevance: evidenceRow.link.relevance,
        relationship: evidenceRow.link.relationship,
      })),
      review: {
        status: reviewStatus,
        isInstitutionalFinding: isFindingStatus(reviewStatus),
        findingText,
        latestReview,
      },
      reviewHistory,
      createdAt: row.claim.createdAt?.toISOString() ?? null,
    };
  });

  return { claims, total: claims.length };
}

export async function listReviewsForClaim(context: ClaimActorContext, claimId: string): Promise<{ reviews: ClaimReviewDto[]; total: number }> {
  const [claim] = await db
    .select()
    .from(aiClaimsTable)
    .where(and(eq(aiClaimsTable.id, claimId), eq(aiClaimsTable.institutionId, context.institutionId)))
    .limit(1);

  if (!claim) throw new Error("Claim not found");

  const rows = await db
    .select({ review: humanReviewsTable, reviewer: usersTable })
    .from(humanReviewsTable)
    .leftJoin(usersTable, eq(humanReviewsTable.reviewerUserId, usersTable.id))
    .where(and(eq(humanReviewsTable.institutionId, context.institutionId), eq(humanReviewsTable.aiClaimId, claimId)))
    .orderBy(desc(humanReviewsTable.createdAt));

  const reviews = rows.map(reviewDto);
  return { reviews, total: reviews.length };
}

export async function reviewClaim(context: ClaimActorContext, claimId: string, input: ClaimReviewInput): Promise<ClaimReviewResponse> {
  const [claim] = await db
    .select()
    .from(aiClaimsTable)
    .where(and(eq(aiClaimsTable.id, claimId), eq(aiClaimsTable.institutionId, context.institutionId)))
    .limit(1);

  if (!claim) throw new Error("Claim not found");

  const decision = input.decision;
  if (!["accept", "reject", "amend", "request_clarification", "not_applicable"].includes(decision)) {
    throw new Error("Unsupported review action");
  }

  const amendedText = input.amendedText?.trim();
  if (decision === "amend" && !amendedText) {
    throw new Error("Amended text is required when amending a claim");
  }

  const [review] = await db
    .insert(humanReviewsTable)
    .values({
      institutionId: context.institutionId,
      subjectType: "ai_claim",
      aiClaimId: claimId,
      reviewerUserId: context.userId,
      decision,
      amendedText: decision === "amend" ? amendedText : undefined,
      rationale: input.rationale?.trim() || undefined,
      metadata: {
        phase: "6B.2",
        governance: "human_review_foundation",
        originalClaimStatus: claim.status,
        originalClaimPreserved: true,
        institutionalFinding: decision === "accept" || decision === "amend",
      },
    })
    .returning();

  const [reviewer] = context.userId
    ? await db.select().from(usersTable).where(eq(usersTable.id, context.userId)).limit(1)
    : [];
  const reviewResult = reviewDto({ review, reviewer });

  const moduleClaims: ModuleClaimsResponse = claim.moduleId
    ? await listClaimsForModule(context, claim.moduleId)
    : { claims: [], total: 0 };
  const reviewedClaim = moduleClaims.claims.find((candidate) => candidate.id === claimId);

  if (!reviewedClaim) throw new Error("Reviewed claim could not be reloaded");

  return {
    claim: reviewedClaim,
    review: reviewResult,
    message: reviewResult.status === "accepted" || reviewResult.status === "amended"
      ? `Claim reviewed as a ${reviewLabel(reviewResult.status)} finding.`
      : `Claim review recorded as ${reviewLabel(reviewResult.status)}.`,
  };
}
