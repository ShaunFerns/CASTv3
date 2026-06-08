import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  aiClaimsTable,
  aiModelRunsTable,
  analysisRunsTable,
  assessmentComponentsTable,
  claimEvidenceLinksTable,
  competenciesTable,
  competencyDomainsTable,
  db,
  descriptorSectionsTable,
  evidenceItemsTable,
  frameworksTable,
  frameworkVersionsTable,
  learningOutcomesTable,
  lensesTable,
  lensVersionsTable,
  moduleDescriptorsTable,
  modulesTable,
  promptVersionsTable,
} from "@workspace/db";

export type ClaimActorContext = {
  institutionId: string;
  userId?: string;
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
  message: string;
  claims: EvidenceClaimDto[];
};

type GreenCompRule = {
  key: string;
  terms: string[];
};

const deterministicProvider = "cast";
const deterministicModel = "deterministic-greencomp-claims-v1";
const promptKey = "greencomp-evidence-claim-foundation";
const promptVersionLabel = "1.0-deterministic";

const greenCompRules: GreenCompRule[] = [
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
];

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

async function loadGreenCompConfiguration() {
  const [frameworkRow] = await db
    .select({ framework: frameworksTable, frameworkVersion: frameworkVersionsTable })
    .from(frameworksTable)
    .innerJoin(frameworkVersionsTable, eq(frameworkVersionsTable.frameworkId, frameworksTable.id))
    .where(and(eq(frameworksTable.key, "greencomp"), eq(frameworkVersionsTable.versionLabel, "2022")))
    .limit(1);

  const [lensRow] = await db
    .select({ lens: lensesTable, lensVersion: lensVersionsTable })
    .from(lensesTable)
    .innerJoin(lensVersionsTable, eq(lensVersionsTable.lensId, lensesTable.id))
    .where(eq(lensesTable.key, "greencomp-curriculum-evidence"))
    .limit(1);

  if (!frameworkRow) throw new Error("GreenComp framework seed is not available");
  if (!lensRow) throw new Error("GreenComp evidence lens seed is not available");

  return {
    framework: frameworkRow.framework,
    frameworkVersion: frameworkRow.frameworkVersion,
    lens: lensRow.lens,
    lensVersion: lensRow.lensVersion,
  };
}

async function ensurePromptVersion(context: ClaimActorContext) {
  const [existing] = await db
    .select()
    .from(promptVersionsTable)
    .where(
      and(
        eq(promptVersionsTable.institutionId, context.institutionId),
        eq(promptVersionsTable.key, promptKey),
        eq(promptVersionsTable.versionLabel, promptVersionLabel),
      ),
    )
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(promptVersionsTable)
    .values({
      institutionId: context.institutionId,
      key: promptKey,
      name: "GreenComp evidence claim foundation",
      versionLabel: promptVersionLabel,
      status: "active",
      systemPrompt: "Deterministic CAST GreenComp evidence-claim foundation. No AI model call is made in Phase 6B.1.",
      userPromptTemplate: "Create provisional GreenComp evidence claims only when linked evidence exists.",
      outputSchema: {
        claimText: "string",
        rationale: "string",
        confidence: "number",
        evidenceItemIds: "string[]",
      },
      configuration: {
        phase: "6B.1",
        deterministic: true,
        framework: "greencomp",
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

async function existingGenerationKeys(context: ClaimActorContext, moduleId: string) {
  const rows = await db
    .select({ metadata: aiClaimsTable.metadata })
    .from(aiClaimsTable)
    .where(and(eq(aiClaimsTable.institutionId, context.institutionId), eq(aiClaimsTable.moduleId, moduleId)));

  return new Set(rows.map((row) => (typeof row.metadata.generationKey === "string" ? row.metadata.generationKey : undefined)).filter(Boolean));
}

function generationKey(moduleId: string, competencyId: string, evidenceIds: string[]): string {
  return `greencomp:${moduleId}:${competencyId}:${evidenceIds.sort().join(",")}`;
}

function formatCompetencyCode(competency: typeof competenciesTable.$inferSelect): string {
  const code = competency.metadata?.["code"];
  return typeof code === "string" && code.trim() ? code.trim() : competency.key;
}

export async function generateGreenCompClaimsForModule(
  context: ClaimActorContext,
  moduleId: string,
): Promise<ClaimGenerationResponse> {
  const module = await loadCanonicalModule(context, moduleId);
  if (!module) throw new Error("Module not found");

  const [{ framework, frameworkVersion, lensVersion }, promptVersion, moduleEvidence] = await Promise.all([
    loadGreenCompConfiguration(),
    ensurePromptVersion(context),
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
        framework: "greencomp",
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
      model: deterministicModel,
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

  const existingKeys = await existingGenerationKeys(context, moduleId);
  let claimsCreated = 0;
  let claimsSkipped = 0;

  for (const row of competencies) {
    const rule = greenCompRules.find((candidate) => candidate.key === row.competency.key);
    if (!rule) continue;

    const scoredEvidence = moduleEvidence.evidence
      .map((item) => ({ item, score: evidenceScore(item, rule.terms) }))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (scoredEvidence.length === 0) continue;

    const evidenceIds = scoredEvidence.map((candidate) => candidate.item.id);
    const key = generationKey(moduleId, row.competency.id, evidenceIds);
    if (existingKeys.has(key)) {
      claimsSkipped += 1;
      continue;
    }

    const matchCount = scoredEvidence.reduce((sum, candidate) => sum + candidate.score, 0);
    const competencyCode = formatCompetencyCode(row.competency);
    const confidence = confidenceFor(matchCount, scoredEvidence.length);
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
        title: `GreenComp ${competencyCode}: ${row.competency.name}`,
        claimText: `Evidence suggests this module addresses GreenComp competence ${competencyCode} (${row.competency.name}).`,
        rationale: `This provisional claim is based on ${scoredEvidence.length} linked evidence source${scoredEvidence.length === 1 ? "" : "s"} containing terms associated with ${row.competency.name}.`,
        confidence,
        metadata: {
          phase: "6B.1",
          frameworkKey: "greencomp",
          frameworkName: framework.name,
          frameworkVersion: frameworkVersion.versionLabel,
          lensKey: "greencomp-curriculum-evidence",
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

    existingKeys.add(key);
    claimsCreated += 1;
  }

  const completedAt = new Date();
  await Promise.all([
    db
      .update(aiModelRunsTable)
      .set({
        status: "completed",
        completedAt,
        responseMetadata: { claimsCreated, claimsSkipped, evidenceConsidered: moduleEvidence.evidence.length },
      })
      .where(eq(aiModelRunsTable.id, modelRun.id)),
    db
      .update(analysisRunsTable)
      .set({
        status: "completed",
        completedAt,
        summary: { claimsCreated, claimsSkipped, evidenceConsidered: moduleEvidence.evidence.length },
      })
      .where(eq(analysisRunsTable.id, analysisRun.id)),
  ]);

  const claims = await listClaimsForModule(context, moduleId);
  return {
    analysisRunId: analysisRun.id,
    claimsCreated,
    claimsSkipped,
    evidenceConsidered: moduleEvidence.evidence.length,
    message: claimsCreated > 0
      ? `Generated ${claimsCreated} provisional GreenComp claim${claimsCreated === 1 ? "" : "s"}.`
      : "No new GreenComp claims were generated from the available evidence.",
    claims: claims.claims,
  };
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

  const claims = rows.map((row) => ({
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
    createdAt: row.claim.createdAt?.toISOString() ?? null,
  }));

  return { claims, total: claims.length };
}
