import { and, asc, eq, inArray } from "drizzle-orm";
import {
  assessmentComponentsTable,
  competenciesTable,
  competencyDomainsTable,
  competencyEvaluationEvidenceLinksTable,
  competencyEvaluationsTable,
  curatedStructureItemsTable,
  curatedStructuresTable,
  db,
  descriptorSectionsTable,
  evidenceItemsTable,
  frameworkVersionsTable,
  frameworksTable,
  learningOutcomesTable,
  lensVersionsTable,
  lensesTable,
  moduleDescriptorsTable,
  modulesTable,
  programmeVersionsTable,
} from "@workspace/db";

type ActorContext = {
  institutionId: string;
  userId?: string;
};

type EvidenceMaturityLevel = "none" | "developing" | "consolidating" | "leading";

type DesignLayerKey = "assessment-design" | "modality-design";

type StructureItem = typeof curatedStructureItemsTable.$inferSelect;
type DesignIndicator = typeof competenciesTable.$inferSelect & {
  domain?: typeof competencyDomainsTable.$inferSelect;
};
type ModuleRow = typeof modulesTable.$inferSelect;
type ModuleDescriptorRow = typeof moduleDescriptorsTable.$inferSelect;
type DescriptorSectionRow = typeof descriptorSectionsTable.$inferSelect;
type LearningOutcomeRow = typeof learningOutcomesTable.$inferSelect;
type AssessmentComponentRow = typeof assessmentComponentsTable.$inferSelect;
type EvidenceItemRow = typeof evidenceItemsTable.$inferSelect;

const maturityRank: Record<EvidenceMaturityLevel, number> = {
  none: 0,
  developing: 1,
  consolidating: 2,
  leading: 3,
};

const assessmentIndicatorKeys = [
  "total-weighting-completeness",
  "assessment-component-detail",
  "assessment-timing-workload",
  "assessment-type-mix",
  "formative-summative-balance",
  "group-individual-balance",
  "assessment-outcome-alignment",
  "feedback-review-evidence",
  "assessment-risk-data-quality",
] as const;

const modalityIndicatorKeys = [
  "current-planned-modality",
  "learning-design-fit",
  "modality-assessment-fit",
  "learner-access-equity",
  "stage-cohort-context",
  "resource-feasibility-fit",
] as const;

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function containsAny(text: string, terms: string[]) {
  const lower = text.toLowerCase();
  return terms.some((term) => lower.includes(term));
}

function highestLevel(levels: EvidenceMaturityLevel[]): EvidenceMaturityLevel {
  return levels.reduce((highest, level) => (maturityRank[level] > maturityRank[highest] ? level : highest), "none");
}

function maturityDistribution(levels: EvidenceMaturityLevel[]) {
  return { none: 0, developing: 0, consolidating: 0, leading: 0, ...levels.reduce<Record<string, number>>((counts, level) => {
    counts[level] = (counts[level] ?? 0) + 1;
    return counts;
  }, {}) };
}

async function assertProgramme(context: ActorContext, programmeVersionId: string) {
  const [programme] = await db
    .select()
    .from(programmeVersionsTable)
    .where(and(eq(programmeVersionsTable.id, programmeVersionId), eq(programmeVersionsTable.institutionId, context.institutionId)))
    .limit(1);
  if (!programme) throw new Error("Programme version not found");
  return programme;
}

async function designLayerBundle(layerKey: DesignLayerKey) {
  const versionLabel = "1.0";
  const [framework] = await db
    .select({ framework: frameworksTable, version: frameworkVersionsTable })
    .from(frameworksTable)
    .innerJoin(frameworkVersionsTable, eq(frameworkVersionsTable.frameworkId, frameworksTable.id))
    .where(and(eq(frameworksTable.key, layerKey), eq(frameworkVersionsTable.versionLabel, versionLabel)))
    .limit(1);
  if (!framework) throw new Error(`${layerKey} seed has not been applied`);

  const indicators = await db
    .select({ indicator: competenciesTable, domain: competencyDomainsTable })
    .from(competenciesTable)
    .leftJoin(competencyDomainsTable, eq(competenciesTable.competencyDomainId, competencyDomainsTable.id))
    .where(eq(competenciesTable.frameworkVersionId, framework.version.id))
    .orderBy(asc(competencyDomainsTable.orderIndex), asc(competenciesTable.orderIndex));

  const [lens] = await db
    .select({ lens: lensesTable, version: lensVersionsTable })
    .from(lensesTable)
    .innerJoin(lensVersionsTable, eq(lensVersionsTable.lensId, lensesTable.id))
    .where(and(eq(lensesTable.key, `${layerKey}-evidence`), eq(lensVersionsTable.versionLabel, "1.0-evidence-v1")))
    .limit(1);

  return {
    framework,
    lensVersionId: lens?.version.id,
    indicators: Object.fromEntries(indicators.map((row) => [row.indicator.key, { ...row.indicator, domain: row.domain ?? undefined }])) as Record<string, DesignIndicator | undefined>,
  };
}

async function programmeDesignRows(context: ActorContext, programmeVersionId: string) {
  const programme = await assertProgramme(context, programmeVersionId);
  const [structure] = await db
    .select()
    .from(curatedStructuresTable)
    .where(and(eq(curatedStructuresTable.programmeVersionId, programmeVersionId), eq(curatedStructuresTable.institutionId, context.institutionId)))
    .orderBy(asc(curatedStructuresTable.key))
    .limit(1);

  const items = structure
    ? await db
        .select()
        .from(curatedStructureItemsTable)
        .where(eq(curatedStructureItemsTable.curatedStructureId, structure.id))
        .orderBy(asc(curatedStructureItemsTable.orderIndex), asc(curatedStructureItemsTable.label))
    : [];

  const moduleIds = items.map((item) => item.moduleId).filter((id): id is string => Boolean(id));
  const descriptorIds = items.map((item) => item.moduleDescriptorId).filter((id): id is string => Boolean(id));

  const modules: ModuleRow[] = moduleIds.length > 0 ? await db.select().from(modulesTable).where(inArray(modulesTable.id, moduleIds)) : [];
  const descriptors: ModuleDescriptorRow[] = descriptorIds.length > 0 ? await db.select().from(moduleDescriptorsTable).where(inArray(moduleDescriptorsTable.id, descriptorIds)) : [];
  const sections: DescriptorSectionRow[] = descriptorIds.length > 0 ? await db.select().from(descriptorSectionsTable).where(inArray(descriptorSectionsTable.moduleDescriptorId, descriptorIds)) : [];
  const outcomes: LearningOutcomeRow[] = descriptorIds.length > 0 ? await db.select().from(learningOutcomesTable).where(inArray(learningOutcomesTable.moduleDescriptorId, descriptorIds)) : [];
  const assessments: AssessmentComponentRow[] = descriptorIds.length > 0 ? await db.select().from(assessmentComponentsTable).where(inArray(assessmentComponentsTable.moduleDescriptorId, descriptorIds)) : [];
  const evidence: EvidenceItemRow[] =
    moduleIds.length > 0 || descriptorIds.length > 0
      ? await db
          .select()
          .from(evidenceItemsTable)
          .where(and(eq(evidenceItemsTable.institutionId, context.institutionId), eq(evidenceItemsTable.programmeVersionId, programmeVersionId)))
      : [];

  return { programme, structure, items, modules, descriptors, sections, outcomes, assessments, evidence };
}

function evidenceForItem(data: Awaited<ReturnType<typeof programmeDesignRows>>, item: StructureItem) {
  return data.evidence.filter(
    (evidence) =>
      evidence.curatedStructureItemId === item.id ||
      evidence.moduleId === item.moduleId,
  );
}

async function upsertRuleEvaluation(input: {
  context: ActorContext;
  programmeVersionId: string;
  layerKey: DesignLayerKey;
  phase: string;
  item: StructureItem;
  indicator: DesignIndicator;
  lensVersionId?: string;
  observedLevel: EvidenceMaturityLevel;
  rationale: string;
  evidenceItems: Array<typeof evidenceItemsTable.$inferSelect>;
  metrics: Record<string, unknown>;
}) {
  const [existing] = await db
    .select()
    .from(competencyEvaluationsTable)
    .where(
      and(
        eq(competencyEvaluationsTable.institutionId, input.context.institutionId),
        eq(competencyEvaluationsTable.programmeVersionId, input.programmeVersionId),
        eq(competencyEvaluationsTable.competencyId, input.indicator.id),
        eq(competencyEvaluationsTable.curatedStructureItemId, input.item.id),
        eq(competencyEvaluationsTable.source, "rule"),
      ),
    )
    .limit(1);

  const values = {
    institutionId: input.context.institutionId,
    programmeVersionId: input.programmeVersionId,
    competencyId: input.indicator.id,
    lensVersionId: input.lensVersionId,
    curatedStructureItemId: input.item.id,
    moduleId: input.item.moduleId,
    moduleDescriptorId: input.item.moduleDescriptorId,
    observedLevel: input.observedLevel,
    source: "rule" as const,
    status: "needs_review" as const,
    rationale: input.rationale,
    createdByUserId: input.context.userId,
    metadata: {
      designLayer: input.layerKey,
      designIndicator: input.indicator.key,
      phase: input.phase,
      aiClassification: false,
      institutionalJudgement: false,
      metrics: input.metrics,
    },
  };

  const [evaluation] = existing
    ? await db
        .update(competencyEvaluationsTable)
        .set({ ...values, createdByUserId: existing.createdByUserId ?? input.context.userId })
        .where(eq(competencyEvaluationsTable.id, existing.id))
        .returning()
    : await db.insert(competencyEvaluationsTable).values(values).returning();

  for (const evidence of input.evidenceItems.slice(0, 6)) {
    await db
      .insert(competencyEvaluationEvidenceLinksTable)
      .values({
        competencyEvaluationId: evaluation.id,
        evidenceItemId: evidence.id,
        relevance: evidence.confidence,
        notes: `Linked during deterministic ${input.layerKey} materialisation.`,
      })
      .onConflictDoNothing();
  }

  return evaluation;
}

function assessmentComponentWeek(component: typeof assessmentComponentsTable.$inferSelect): string | undefined {
  const metadata = metadataRecord(component.metadata);
  return asText(metadata["week"] ?? metadata["assessmentWeek"] ?? metadata["timing"] ?? metadata["period"]) || undefined;
}

function assessmentEvidenceText(input: {
  sections: Array<typeof descriptorSectionsTable.$inferSelect>;
  components: Array<typeof assessmentComponentsTable.$inferSelect>;
}) {
  return [
    ...input.sections.map((section) => `${section.title ?? ""} ${section.content ?? ""}`),
    ...input.components.map((component) => `${component.componentName ?? ""} ${component.componentType ?? ""} ${component.assessmentMode ?? ""} ${component.description ?? ""}`),
  ].join("\n");
}

function assessmentLevels(input: {
  sections: Array<typeof descriptorSectionsTable.$inferSelect>;
  outcomes: Array<typeof learningOutcomesTable.$inferSelect>;
  components: Array<typeof assessmentComponentsTable.$inferSelect>;
  evidenceCount: number;
}) {
  const totalWeight = input.components.reduce((sum, component) => sum + (Number(component.weighting) || 0), 0);
  const componentsWithType = input.components.filter((component) => Boolean(component.componentType?.trim()));
  const componentsWithMode = input.components.filter((component) => Boolean(component.assessmentMode?.trim()));
  const weeks = input.components.map(assessmentComponentWeek).filter(Boolean);
  const typeSet = new Set(componentsWithType.map((component) => component.componentType?.trim().toLowerCase()));
  const modeText = input.components.map((component) => component.assessmentMode ?? "").join(" ").toLowerCase();
  const allText = assessmentEvidenceText(input);
  const hasAssessmentSection = input.sections.some((section) => section.sectionType === "assessment" && Boolean(section.content?.trim()));
  const hasOutcomeLanguage = containsAny(allText, ["learning outcome", "outcome", "mlo", "plo"]);
  const feedbackLanguage = containsAny(allText, ["feedback", "feedforward", "review", "reflection", "reflective"]);
  const formativeLanguage = containsAny(allText, ["formative", "summative"]);

  return {
    metrics: {
      totalWeight,
      componentCount: input.components.length,
      componentsWithType: componentsWithType.length,
      componentsWithMode: componentsWithMode.length,
      timedComponentCount: weeks.length,
      typeCount: typeSet.size,
      learningOutcomeCount: input.outcomes.length,
      evidenceCount: input.evidenceCount,
    },
    levels: {
      "total-weighting-completeness": input.components.length === 0 && !hasAssessmentSection ? "none" : totalWeight >= 99 && totalWeight <= 101 ? "leading" : totalWeight > 0 && totalWeight <= 100 ? "consolidating" : "developing",
      "assessment-component-detail": input.components.length === 0 ? (hasAssessmentSection ? "developing" : "none") : componentsWithType.length === input.components.length && componentsWithMode.length > 0 ? "leading" : componentsWithType.length > 0 ? "consolidating" : "developing",
      "assessment-timing-workload": input.components.length === 0 ? "none" : weeks.length === input.components.length && weeks.length > 0 ? "leading" : weeks.length > 0 ? "consolidating" : "developing",
      "assessment-type-mix": input.components.length === 0 ? "none" : typeSet.size >= 3 ? "leading" : typeSet.size === 2 ? "consolidating" : "developing",
      "formative-summative-balance": formativeLanguage ? (containsAny(allText, ["formative"]) && containsAny(allText, ["summative"]) ? "leading" : "consolidating") : input.components.length > 0 ? "developing" : "none",
      "group-individual-balance": modeText.includes("group") && modeText.includes("individual") ? "leading" : componentsWithMode.length > 0 ? "consolidating" : input.components.length > 0 ? "developing" : "none",
      "assessment-outcome-alignment": input.outcomes.length === 0 && !hasOutcomeLanguage ? "none" : hasOutcomeLanguage && input.components.length > 0 ? "consolidating" : input.outcomes.length > 0 && input.components.length > 0 ? "developing" : "none",
      "feedback-review-evidence": feedbackLanguage ? "consolidating" : hasAssessmentSection || input.components.length > 0 ? "developing" : "none",
      "assessment-risk-data-quality": input.components.length > 0 && totalWeight >= 99 && totalWeight <= 101 && componentsWithType.length === input.components.length ? "leading" : input.components.length > 0 && totalWeight > 0 ? "consolidating" : hasAssessmentSection ? "developing" : "none",
    } satisfies Record<(typeof assessmentIndicatorKeys)[number], EvidenceMaturityLevel>,
  };
}

export async function materialiseAssessmentDesignLayer(context: ActorContext, programmeVersionId: string) {
  const layer = await designLayerBundle("assessment-design");
  const data = await programmeDesignRows(context, programmeVersionId);
  const evaluations = [];

  for (const item of data.items) {
    const sections = data.sections.filter((section) => section.moduleDescriptorId === item.moduleDescriptorId);
    const outcomes = data.outcomes.filter((outcome) => outcome.moduleDescriptorId === item.moduleDescriptorId);
    const components = data.assessments.filter((component) => component.moduleDescriptorId === item.moduleDescriptorId);
    const evidence = evidenceForItem(data, item).filter(
      (candidate) =>
        candidate.sourceKind === "assessment_component" ||
        candidate.sourceKind === "descriptor_section" ||
        candidate.sourceKind === "learning_outcome" ||
        candidate.sourceKind === "manual",
    );
    const analysis = assessmentLevels({ sections, outcomes, components, evidenceCount: evidence.length });

    for (const key of assessmentIndicatorKeys) {
      const indicator = layer.indicators[key];
      if (!indicator) continue;
      evaluations.push(
        await upsertRuleEvaluation({
          context,
          programmeVersionId,
          layerKey: "assessment-design",
          phase: "5J",
          item,
          indicator,
          lensVersionId: layer.lensVersionId,
          observedLevel: analysis.levels[key],
          rationale: "Deterministic assessment design signal generated from descriptor sections, assessment components, learning outcomes and evidence items. This is review-ready evidence, not an institutional judgement.",
          evidenceItems: evidence,
          metrics: analysis.metrics,
        }),
      );
    }
  }

  return assessmentDesignSummary(context, programmeVersionId, evaluations);
}

function modalityForText(text: string) {
  const lower = text.toLowerCase();
  if (containsAny(lower, ["hyflex", "hy-flex"])) return "hyflex";
  if (containsAny(lower, ["blended", "hybrid"])) return "blended";
  if (containsAny(lower, ["online", "remote", "virtual", "asynchronous", "synchronous"])) return "online";
  if (containsAny(lower, ["in person", "in-person", "on campus", "campus", "face-to-face"])) return "in_person";
  return undefined;
}

function modalityLevels(input: {
  programmeMode?: string | null;
  stage?: string | null;
  semester?: string | null;
  sections: Array<typeof descriptorSectionsTable.$inferSelect>;
  components: Array<typeof assessmentComponentsTable.$inferSelect>;
  evidenceCount: number;
}) {
  const text = [
    input.programmeMode ?? "",
    ...input.sections.map((section) => `${section.title ?? ""} ${section.content ?? ""}`),
    ...input.components.map((component) => `${component.componentName ?? ""} ${component.componentType ?? ""} ${component.assessmentMode ?? ""} ${component.description ?? ""}`),
  ].join("\n");
  const modality = modalityForText(text);
  const hasTeachingStrategy = input.sections.some((section) => section.sectionType === "teaching_and_learning_strategy" && Boolean(section.content?.trim()));
  const hasModalitySection = input.sections.some((section) => section.sectionType === "modality" && Boolean(section.content?.trim()));
  const activeLearning = containsAny(text, ["workshop", "tutorial", "discussion", "project", "problem", "lab", "studio", "fieldwork", "simulation", "reflection"]);
  const assessmentRisk = containsAny(text, ["exam", "presentation", "portfolio", "group", "lab", "authentic", "proctored"]);
  const accessEquity = containsAny(text, ["access", "accessible", "inclusive", "equity", "flexible", "udl", "support", "commuter", "international"]);
  const stageContext = Boolean(input.stage || input.semester) && containsAny(text, ["stage", "year", "semester", "cohort", "transition", "attendance"]);
  const feasibility = containsAny(text, ["resource", "room", "lab", "studio", "equipment", "software", "tool", "platform", "device", "constraint", "capacity"]);

  return {
    metrics: {
      currentPlannedModality: modality ?? "unspecified",
      evidenceCount: input.evidenceCount,
      teachingStrategySections: input.sections.filter((section) => section.sectionType === "teaching_and_learning_strategy").length,
      modalitySections: input.sections.filter((section) => section.sectionType === "modality").length,
      assessmentComponentCount: input.components.length,
      riskFlags: [
        assessmentRisk ? "assessment_modality_fit_requires_review" : undefined,
        !feasibility && modality ? "feasibility_evidence_gap" : undefined,
        !accessEquity && modality ? "learner_access_evidence_gap" : undefined,
      ].filter(Boolean),
    },
    levels: {
      "current-planned-modality": modality ? (hasModalitySection ? "consolidating" : "developing") : "none",
      "learning-design-fit": hasTeachingStrategy && activeLearning && modality ? "leading" : hasTeachingStrategy && activeLearning ? "consolidating" : hasTeachingStrategy ? "developing" : "none",
      "modality-assessment-fit": input.components.length > 0 && assessmentRisk && modality ? "consolidating" : input.components.length > 0 ? "developing" : "none",
      "learner-access-equity": accessEquity && modality ? "consolidating" : accessEquity ? "developing" : "none",
      "stage-cohort-context": stageContext && modality ? "consolidating" : input.stage || input.semester ? "developing" : "none",
      "resource-feasibility-fit": feasibility && modality ? "consolidating" : feasibility ? "developing" : "none",
    } satisfies Record<(typeof modalityIndicatorKeys)[number], EvidenceMaturityLevel>,
  };
}

export async function materialiseModalityDesignLayer(context: ActorContext, programmeVersionId: string) {
  const layer = await designLayerBundle("modality-design");
  const data = await programmeDesignRows(context, programmeVersionId);
  const evaluations = [];

  for (const item of data.items) {
    const sections = data.sections.filter((section) => section.moduleDescriptorId === item.moduleDescriptorId);
    const components = data.assessments.filter((component) => component.moduleDescriptorId === item.moduleDescriptorId);
    const evidence = evidenceForItem(data, item).filter(
      (candidate) => candidate.sourceKind === "assessment_component" || candidate.sourceKind === "descriptor_section" || candidate.sourceKind === "manual",
    );
    const analysis = modalityLevels({
      programmeMode: data.programme.modeOfDelivery,
      stage: item.stage,
      semester: item.semester,
      sections,
      components,
      evidenceCount: evidence.length,
    });

    for (const key of modalityIndicatorKeys) {
      const indicator = layer.indicators[key];
      if (!indicator) continue;
      evaluations.push(
        await upsertRuleEvaluation({
          context,
          programmeVersionId,
          layerKey: "modality-design",
          phase: "5J",
          item,
          indicator,
          lensVersionId: layer.lensVersionId,
          observedLevel: analysis.levels[key],
          rationale: "Deterministic modality design signal generated from teaching, learning, assessment, resource and modality evidence. This is review-ready evidence, not an institutional judgement.",
          evidenceItems: evidence,
          metrics: analysis.metrics,
        }),
      );
    }
  }

  return modalityDesignSummary(context, programmeVersionId, evaluations);
}

async function designLayerEvaluations(context: ActorContext, programmeVersionId: string, layerKey: DesignLayerKey) {
  const layer = await designLayerBundle(layerKey);
  const indicatorIds = Object.values(layer.indicators).map((indicator) => indicator?.id).filter((id): id is string => Boolean(id));
  if (indicatorIds.length === 0) return { layer, evaluations: [] };
  const evaluations = await db
    .select({ evaluation: competencyEvaluationsTable, indicator: competenciesTable, domain: competencyDomainsTable })
    .from(competencyEvaluationsTable)
    .innerJoin(competenciesTable, eq(competencyEvaluationsTable.competencyId, competenciesTable.id))
    .leftJoin(competencyDomainsTable, eq(competenciesTable.competencyDomainId, competencyDomainsTable.id))
    .where(
      and(
        eq(competencyEvaluationsTable.institutionId, context.institutionId),
        eq(competencyEvaluationsTable.programmeVersionId, programmeVersionId),
        inArray(competencyEvaluationsTable.competencyId, indicatorIds),
      ),
    );

  const evaluationIds = evaluations.map((row) => row.evaluation.id);
  const links =
    evaluationIds.length > 0
      ? await db
          .select()
          .from(competencyEvaluationEvidenceLinksTable)
          .where(inArray(competencyEvaluationEvidenceLinksTable.competencyEvaluationId, evaluationIds))
      : [];

  return {
    layer,
    evaluations: evaluations.map((row) => ({
      ...row.evaluation,
      indicator: row.indicator,
      domain: row.domain ?? undefined,
      evidenceCount: links.filter((link) => link.competencyEvaluationId === row.evaluation.id).length,
    })),
  };
}

export async function assessmentDesignSummary(
  context: ActorContext,
  programmeVersionId: string,
  providedEvaluations?: Array<typeof competencyEvaluationsTable.$inferSelect>,
) {
  const data = await programmeDesignRows(context, programmeVersionId);
  const evaluationBundle = providedEvaluations ? undefined : await designLayerEvaluations(context, programmeVersionId, "assessment-design");
  const evaluations = providedEvaluations ?? evaluationBundle?.evaluations ?? [];
  const levels = evaluations.map((evaluation) => evaluation.observedLevel as EvidenceMaturityLevel);
  const componentTypes = data.assessments.reduce<Record<string, number>>((counts, component) => {
    const key = component.componentType?.trim().toLowerCase() || "unspecified";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  const modes = data.assessments.reduce<Record<string, number>>((counts, component) => {
    const key = component.assessmentMode?.trim().toLowerCase() || "unspecified";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  const moduleDescriptorIdsWithAssessment = new Set(data.assessments.map((component) => component.moduleDescriptorId));
  const modulesWithEvidence = new Set(evaluations.filter((evaluation: any) => (evaluation.evidenceCount ?? 0) > 0).map((evaluation) => evaluation.moduleId).filter(Boolean));
  const modulesWithCompleteWeighting = data.items.filter((item) => {
    const components = data.assessments.filter((component) => component.moduleDescriptorId === item.moduleDescriptorId);
    const total = components.reduce((sum, component) => sum + (Number(component.weighting) || 0), 0);
    return total >= 99 && total <= 101;
  }).length;

  return {
    status: "evidence_informed",
    layerKey: "assessment-design",
    message: "Assessment Design outputs are deterministic evidence signals for human review, not automatic institutional judgements.",
    modulePlacementCount: data.items.length,
    modulesWithAssessmentComponents: moduleDescriptorIdsWithAssessment.size,
    modulesWithNoAssessmentComponents: data.items.filter((item) => !moduleDescriptorIdsWithAssessment.has(item.moduleDescriptorId ?? "")).length,
    modulesWithAssessmentEvidence: modulesWithEvidence.size,
    modulesWithNoAssessmentEvidence: data.items.length - modulesWithEvidence.size,
    modulesWithCompleteWeighting,
    assessmentComponentCount: data.assessments.length,
    assessmentTypeMix: componentTypes,
    groupIndividualBalance: modes,
    evidenceMaturityDistribution: maturityDistribution(levels),
    reviewStatusCounts: evaluations.reduce<Record<string, number>>((counts, evaluation) => {
      counts[evaluation.status] = (counts[evaluation.status] ?? 0) + 1;
      return counts;
    }, {}),
    indicatorCount: evaluations.length,
    highestObservedMaturity: highestLevel(levels),
  };
}

export async function modalityDesignSummary(
  context: ActorContext,
  programmeVersionId: string,
  providedEvaluations?: Array<typeof competencyEvaluationsTable.$inferSelect>,
) {
  const data = await programmeDesignRows(context, programmeVersionId);
  const evaluationBundle = providedEvaluations ? undefined : await designLayerEvaluations(context, programmeVersionId, "modality-design");
  const evaluations = providedEvaluations ?? evaluationBundle?.evaluations ?? [];
  const levels = evaluations.map((evaluation) => evaluation.observedLevel as EvidenceMaturityLevel);
  const modalitySections = data.sections.filter((section) => section.sectionType === "modality");
  const teachingSections = data.sections.filter((section) => section.sectionType === "teaching_and_learning_strategy");
  const currentPlannedModality = evaluations.reduce<Record<string, number>>((counts, evaluation) => {
    const metrics = metadataRecord(metadataRecord(evaluation.metadata)["metrics"]);
    const modality = asText(metrics["currentPlannedModality"]) || "unspecified";
    if (modality !== "unspecified") counts[modality] = (counts[modality] ?? 0) + 1;
    return counts;
  }, {});
  const riskFlags = evaluations.flatMap((evaluation) => {
    const metrics = metadataRecord(metadataRecord(evaluation.metadata)["metrics"]);
    return Array.isArray(metrics["riskFlags"]) ? metrics["riskFlags"].filter((flag): flag is string => typeof flag === "string") : [];
  });
  const modulesWithEvidence = new Set((evaluations as Array<any>).filter((evaluation) => (evaluation.evidenceCount ?? 0) > 0).map((evaluation) => evaluation.moduleId).filter(Boolean));

  return {
    status: "evidence_informed",
    layerKey: "modality-design",
    message: "Modality Design outputs are deterministic evidence signals for human review, not automatic institutional judgements.",
    modulePlacementCount: data.items.length,
    teachingStrategySectionCount: teachingSections.length,
    modalitySectionCount: modalitySections.length,
    modulesWithModalityEvidence: modulesWithEvidence.size,
    modulesWithNoModalityEvidence: data.items.length - modulesWithEvidence.size,
    currentPlannedModality,
    riskFlags: riskFlags.reduce<Record<string, number>>((counts, flag) => {
      counts[flag] = (counts[flag] ?? 0) + 1;
      return counts;
    }, {}),
    evidenceMaturityDistribution: maturityDistribution(levels),
    reviewStatusCounts: evaluations.reduce<Record<string, number>>((counts, evaluation) => {
      counts[evaluation.status] = (counts[evaluation.status] ?? 0) + 1;
      return counts;
    }, {}),
    indicatorCount: evaluations.length,
    highestObservedMaturity: highestLevel(levels),
  };
}
