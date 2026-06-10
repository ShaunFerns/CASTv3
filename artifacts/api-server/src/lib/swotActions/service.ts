import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  actionPlanEvidenceLinksTable,
  actionPlanItemClaimLinksTable,
  actionPlanItemHumanReviewLinksTable,
  actionPlanItemReadinessLinksTable,
  actionPlanItemReviewNoteLinksTable,
  actionPlanItemSwotLinksTable,
  actionPlanItemsTable,
  actionPlansTable,
  db,
  readinessAssessmentsTable,
  readinessAssessmentItemsTable,
  reviewCyclesTable,
  reviewExportsTable,
  reviewNotesTable,
  swotItemClaimLinksTable,
  swotItemEvidenceLinksTable,
  swotItemHumanReviewLinksTable,
  swotItemReadinessLinksTable,
  swotItemReviewNoteLinksTable,
  swotItemsTable,
} from "@workspace/db";

type ActorContext = {
  institutionId: string;
  userId?: string;
};

type SwotCategory = "strength" | "weakness" | "opportunity" | "threat";
type SwotStatus = "draft" | "reviewed" | "approved" | "archived";
type ActionPriority = "low" | "medium" | "high" | "critical";
type ActionDisplayStatus = "proposed" | "approved" | "in_progress" | "completed" | "closed";
type ActionItemStatus = "not_started" | "in_progress" | "blocked" | "completed" | "cancelled";

type LinkInput = {
  evidenceItemIds?: string[];
  aiClaimIds?: string[];
  humanReviewIds?: string[];
  readinessAssessmentItemIds?: string[];
  reviewNoteIds?: string[];
  swotItemIds?: string[];
};

type SwotInput = LinkInput & {
  reviewCycleId?: string;
  programmeVersionId?: string;
  title?: string;
  description?: string;
  category?: SwotCategory;
  rationale?: string;
  status?: SwotStatus;
  readinessAreaKey?: string;
};

type ActionInput = LinkInput & {
  reviewCycleId?: string;
  programmeVersionId?: string;
  title?: string;
  description?: string;
  owner?: string;
  priority?: ActionPriority;
  targetDate?: string;
  status?: ActionDisplayStatus;
  progressNotes?: string;
  readinessAreaKey?: string;
};

const swotLabels: Record<SwotCategory, string> = {
  strength: "Strength",
  weakness: "Weakness",
  opportunity: "Opportunity",
  threat: "Threat",
};

const actionStatusLabels: Record<ActionDisplayStatus, string> = {
  proposed: "Proposed",
  approved: "Approved",
  in_progress: "In Progress",
  completed: "Completed",
  closed: "Closed",
};

function parseDate(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function uniqueIds(values?: string[]) {
  return [...new Set((values ?? []).filter((value) => typeof value === "string" && value.length > 0))];
}

function actionItemStatus(status: ActionDisplayStatus): ActionItemStatus {
  if (status === "in_progress") return "in_progress";
  if (status === "completed") return "completed";
  if (status === "closed") return "cancelled";
  return "not_started";
}

function displayStatusFromItem(item: typeof actionPlanItemsTable.$inferSelect): ActionDisplayStatus {
  const metadataStatus = item.metadata?.["displayStatus"];
  if (metadataStatus === "proposed" || metadataStatus === "approved" || metadataStatus === "in_progress" || metadataStatus === "completed" || metadataStatus === "closed") {
    return metadataStatus;
  }
  if (item.status === "in_progress") return "in_progress";
  if (item.status === "completed") return "completed";
  if (item.status === "cancelled") return "closed";
  return "proposed";
}

async function getReviewCycle(context: ActorContext, reviewCycleId: string) {
  const [cycle] = await db
    .select()
    .from(reviewCyclesTable)
    .where(and(eq(reviewCyclesTable.id, reviewCycleId), eq(reviewCyclesTable.institutionId, context.institutionId)))
    .limit(1);
  if (!cycle) throw new Error("Review cycle not found");
  return cycle;
}

async function getProgrammeReviewCycles(context: ActorContext, programmeVersionId: string) {
  return db
    .select()
    .from(reviewCyclesTable)
    .where(and(eq(reviewCyclesTable.institutionId, context.institutionId), eq(reviewCyclesTable.programmeVersionId, programmeVersionId)))
    .orderBy(desc(reviewCyclesTable.createdAt));
}

async function insertLinks(tableInsert: () => Promise<unknown>) {
  try {
    await tableInsert();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("duplicate key")) throw error;
  }
}

async function linkSwotItem(swotItemId: string, links: LinkInput) {
  for (const evidenceItemId of uniqueIds(links.evidenceItemIds)) {
    await insertLinks(() => db.insert(swotItemEvidenceLinksTable).values({ swotItemId, evidenceItemId }).onConflictDoNothing());
  }
  for (const aiClaimId of uniqueIds(links.aiClaimIds)) {
    await insertLinks(() => db.insert(swotItemClaimLinksTable).values({ swotItemId, aiClaimId }).onConflictDoNothing());
  }
  for (const humanReviewId of uniqueIds(links.humanReviewIds)) {
    await insertLinks(() => db.insert(swotItemHumanReviewLinksTable).values({ swotItemId, humanReviewId }).onConflictDoNothing());
  }
  for (const readinessAssessmentItemId of uniqueIds(links.readinessAssessmentItemIds)) {
    await insertLinks(() => db.insert(swotItemReadinessLinksTable).values({ swotItemId, readinessAssessmentItemId }).onConflictDoNothing());
  }
  for (const reviewNoteId of uniqueIds(links.reviewNoteIds)) {
    await insertLinks(() => db.insert(swotItemReviewNoteLinksTable).values({ swotItemId, reviewNoteId }).onConflictDoNothing());
  }
}

async function linkActionItem(actionPlanItemId: string, links: LinkInput) {
  for (const evidenceItemId of uniqueIds(links.evidenceItemIds)) {
    await insertLinks(() => db.insert(actionPlanEvidenceLinksTable).values({ actionPlanItemId, evidenceItemId }).onConflictDoNothing());
  }
  for (const swotItemId of uniqueIds(links.swotItemIds)) {
    await insertLinks(() => db.insert(actionPlanItemSwotLinksTable).values({ actionPlanItemId, swotItemId }).onConflictDoNothing());
  }
  for (const readinessAssessmentItemId of uniqueIds(links.readinessAssessmentItemIds)) {
    await insertLinks(() => db.insert(actionPlanItemReadinessLinksTable).values({ actionPlanItemId, readinessAssessmentItemId }).onConflictDoNothing());
  }
  for (const aiClaimId of uniqueIds(links.aiClaimIds)) {
    await insertLinks(() => db.insert(actionPlanItemClaimLinksTable).values({ actionPlanItemId, aiClaimId }).onConflictDoNothing());
  }
  for (const humanReviewId of uniqueIds(links.humanReviewIds)) {
    await insertLinks(() => db.insert(actionPlanItemHumanReviewLinksTable).values({ actionPlanItemId, humanReviewId }).onConflictDoNothing());
  }
  for (const reviewNoteId of uniqueIds(links.reviewNoteIds)) {
    await insertLinks(() => db.insert(actionPlanItemReviewNoteLinksTable).values({ actionPlanItemId, reviewNoteId }).onConflictDoNothing());
  }
}

async function ensureActionPlan(context: ActorContext, reviewCycleId: string) {
  const cycle = await getReviewCycle(context, reviewCycleId);
  const [existing] = await db
    .select()
    .from(actionPlansTable)
    .where(and(eq(actionPlansTable.institutionId, context.institutionId), eq(actionPlansTable.reviewCycleId, reviewCycleId)))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(actionPlansTable)
    .values({
      institutionId: context.institutionId,
      reviewCycleId,
      programmeVersionId: cycle.programmeVersionId,
      title: `${cycle.title} Enhancement Actions`,
      description: "Programme enhancement actions arising from review findings, readiness observations and SWOT discussion.",
      status: "active",
      metadata: { phase: "7C", generatedBy: "programme_workspace" },
    })
    .returning();
  return created;
}

export async function listSwotItems(context: ActorContext, programmeVersionId: string, reviewCycleId?: string) {
  const conditions = [
    eq(swotItemsTable.institutionId, context.institutionId),
    eq(swotItemsTable.programmeVersionId, programmeVersionId),
  ];
  if (reviewCycleId) conditions.push(eq(swotItemsTable.reviewCycleId, reviewCycleId));
  const items = await db.select().from(swotItemsTable).where(and(...conditions)).orderBy(desc(swotItemsTable.createdAt));
  const itemIds = items.map((item) => item.id);
  const [evidenceLinks, claimLinks, reviewLinks, readinessLinks, noteLinks] = itemIds.length
    ? await Promise.all([
        db.select().from(swotItemEvidenceLinksTable).where(inArray(swotItemEvidenceLinksTable.swotItemId, itemIds)),
        db.select().from(swotItemClaimLinksTable).where(inArray(swotItemClaimLinksTable.swotItemId, itemIds)),
        db.select().from(swotItemHumanReviewLinksTable).where(inArray(swotItemHumanReviewLinksTable.swotItemId, itemIds)),
        db.select().from(swotItemReadinessLinksTable).where(inArray(swotItemReadinessLinksTable.swotItemId, itemIds)),
        db.select().from(swotItemReviewNoteLinksTable).where(inArray(swotItemReviewNoteLinksTable.swotItemId, itemIds)),
      ])
    : [[], [], [], [], []];
  return {
    swotItems: items.map((item) => ({
      ...item,
      categoryLabel: swotLabels[item.itemType as SwotCategory] ?? item.itemType,
      traceability: {
        evidenceCount: evidenceLinks.filter((link) => link.swotItemId === item.id).length,
        claimCount: claimLinks.filter((link) => link.swotItemId === item.id).length,
        findingCount: reviewLinks.filter((link) => link.swotItemId === item.id).length,
        readinessCount: readinessLinks.filter((link) => link.swotItemId === item.id).length,
        reviewNoteCount: noteLinks.filter((link) => link.swotItemId === item.id).length,
      },
    })),
  };
}

export async function createSwotItem(context: ActorContext, input: SwotInput) {
  if (!input.reviewCycleId) throw new Error("Review cycle is required");
  const cycle = await getReviewCycle(context, input.reviewCycleId);
  const [created] = await db
    .insert(swotItemsTable)
    .values({
      institutionId: context.institutionId,
      reviewCycleId: cycle.id,
      programmeVersionId: input.programmeVersionId ?? cycle.programmeVersionId,
      itemType: input.category ?? "strength",
      status: input.status ?? "draft",
      title: input.title?.trim() || "Programme enhancement theme",
      description: input.description,
      rationale: input.rationale,
      metadata: {
        phase: "7C.1",
        readinessAreaKey: input.readinessAreaKey,
        evidenceTraceability: true,
      },
    })
    .returning();
  await linkSwotItem(created.id, input);
  return created;
}

export async function updateSwotItem(context: ActorContext, swotItemId: string, input: Partial<SwotInput>) {
  const [updated] = await db
    .update(swotItemsTable)
    .set({
      itemType: input.category,
      status: input.status,
      title: input.title,
      description: input.description,
      rationale: input.rationale,
      metadata: sql`${swotItemsTable.metadata} || ${JSON.stringify({ readinessAreaKey: input.readinessAreaKey })}::jsonb`,
    })
    .where(and(eq(swotItemsTable.id, swotItemId), eq(swotItemsTable.institutionId, context.institutionId)))
    .returning();
  if (!updated) throw new Error("SWOT item not found");
  await linkSwotItem(updated.id, input);
  return updated;
}

export async function getReviewContextOptions(context: ActorContext, programmeVersionId: string, reviewCycleId?: string) {
  const cycles = await getProgrammeReviewCycles(context, programmeVersionId);
  if (reviewCycleId) await getReviewCycle(context, reviewCycleId);
  const cycleIds = cycles.map((cycle) => cycle.id);
  const filteredCycleIds = reviewCycleId ? [reviewCycleId] : cycleIds;
  const [notes, readinessAssessments] = filteredCycleIds.length
    ? await Promise.all([
        db.select().from(reviewNotesTable).where(inArray(reviewNotesTable.reviewCycleId, filteredCycleIds)).orderBy(desc(reviewNotesTable.createdAt)),
        db.select().from(readinessAssessmentsTable).where(inArray(readinessAssessmentsTable.reviewCycleId, filteredCycleIds)),
      ])
    : [[], []];
  const readinessAssessmentIds = readinessAssessments.map((assessment) => assessment.id);
  const readinessItems = readinessAssessmentIds.length
    ? await db
        .select({
          id: readinessAssessmentItemsTable.id,
          title: readinessAssessmentItemsTable.title,
          criterionKey: readinessAssessmentItemsTable.criterionKey,
          rating: readinessAssessmentItemsTable.rating,
        })
        .from(readinessAssessmentItemsTable)
        .where(inArray(readinessAssessmentItemsTable.readinessAssessmentId, readinessAssessmentIds))
    : [];
  return {
    reviewCycles: cycles,
    reviewNotes: notes,
    readinessItems,
  };
}

export async function listActionPlanning(context: ActorContext, programmeVersionId: string, reviewCycleId?: string) {
  const planConditions = [
    eq(actionPlansTable.institutionId, context.institutionId),
    eq(actionPlansTable.programmeVersionId, programmeVersionId),
  ];
  if (reviewCycleId) planConditions.push(eq(actionPlansTable.reviewCycleId, reviewCycleId));
  const actionPlans = await db.select().from(actionPlansTable).where(and(...planConditions)).orderBy(desc(actionPlansTable.createdAt));
  const planIds = actionPlans.map((plan) => plan.id);
  const actionItems = planIds.length
    ? await db.select().from(actionPlanItemsTable).where(inArray(actionPlanItemsTable.actionPlanId, planIds)).orderBy(desc(actionPlanItemsTable.createdAt))
    : [];
  const itemIds = actionItems.map((item) => item.id);
  const [swotLinks, readinessLinks, claimLinks, reviewLinks, evidenceLinks, noteLinks] = itemIds.length
    ? await Promise.all([
        db.select().from(actionPlanItemSwotLinksTable).where(inArray(actionPlanItemSwotLinksTable.actionPlanItemId, itemIds)),
        db.select().from(actionPlanItemReadinessLinksTable).where(inArray(actionPlanItemReadinessLinksTable.actionPlanItemId, itemIds)),
        db.select().from(actionPlanItemClaimLinksTable).where(inArray(actionPlanItemClaimLinksTable.actionPlanItemId, itemIds)),
        db.select().from(actionPlanItemHumanReviewLinksTable).where(inArray(actionPlanItemHumanReviewLinksTable.actionPlanItemId, itemIds)),
        db.select().from(actionPlanEvidenceLinksTable).where(inArray(actionPlanEvidenceLinksTable.actionPlanItemId, itemIds)),
        db.select().from(actionPlanItemReviewNoteLinksTable).where(inArray(actionPlanItemReviewNoteLinksTable.actionPlanItemId, itemIds)),
      ])
    : [[], [], [], [], [], []];
  const now = Date.now();
  const decoratedItems = actionItems.map((item) => {
    const displayStatus = displayStatusFromItem(item);
    return {
      ...item,
      displayStatus,
      displayStatusLabel: actionStatusLabels[displayStatus],
      ownerName: typeof item.metadata?.["ownerName"] === "string" ? item.metadata["ownerName"] : "",
      progressNotes: typeof item.metadata?.["progressNotes"] === "string" ? item.metadata["progressNotes"] : "",
      traceability: {
        swotCount: swotLinks.filter((link) => link.actionPlanItemId === item.id).length,
        readinessCount: readinessLinks.filter((link) => link.actionPlanItemId === item.id).length,
        claimCount: claimLinks.filter((link) => link.actionPlanItemId === item.id).length,
        findingCount: reviewLinks.filter((link) => link.actionPlanItemId === item.id).length,
        evidenceCount: evidenceLinks.filter((link) => link.actionPlanItemId === item.id).length,
        reviewNoteCount: noteLinks.filter((link) => link.actionPlanItemId === item.id).length,
      },
    };
  });
  const openItems = decoratedItems.filter((item) => !["completed", "closed"].includes(item.displayStatus));
  const completedItems = decoratedItems.filter((item) => item.displayStatus === "completed");
  const overdueItems = openItems.filter((item) => item.dueAt && item.dueAt.getTime() < now);
  const byPriority = decoratedItems.reduce<Record<string, number>>((acc, item) => {
    acc[item.priority] = (acc[item.priority] ?? 0) + 1;
    return acc;
  }, {});
  const byStatus = decoratedItems.reduce<Record<string, number>>((acc, item) => {
    acc[item.displayStatus] = (acc[item.displayStatus] ?? 0) + 1;
    return acc;
  }, {});
  const byOwner = decoratedItems.reduce<Record<string, number>>((acc, item) => {
    const owner = item.ownerName || "Unassigned";
    acc[owner] = (acc[owner] ?? 0) + 1;
    return acc;
  }, {});
  return {
    actionPlans,
    actionItems: decoratedItems,
    monitoring: {
      totalActions: decoratedItems.length,
      openActions: openItems.length,
      overdueActions: overdueItems.length,
      completedActions: completedItems.length,
      byPriority,
      byStatus,
      byOwner,
      recentActivity: decoratedItems.slice(0, 8),
    },
  };
}

export async function createActionItem(context: ActorContext, input: ActionInput) {
  if (!input.reviewCycleId) throw new Error("Review cycle is required");
  const actionPlan = await ensureActionPlan(context, input.reviewCycleId);
  const displayStatus = input.status ?? "proposed";
  const [created] = await db
    .insert(actionPlanItemsTable)
    .values({
      actionPlanId: actionPlan.id,
      title: input.title?.trim() || "Programme enhancement action",
      description: input.description,
      status: actionItemStatus(displayStatus),
      priority: input.priority ?? "medium",
      dueAt: parseDate(input.targetDate),
      indicatorsOfSuccess: input.progressNotes,
      metadata: {
        phase: "7C.2",
        ownerName: input.owner,
        displayStatus,
        progressNotes: input.progressNotes,
        readinessAreaKey: input.readinessAreaKey,
      },
    })
    .returning();
  await linkActionItem(created.id, input);
  return { actionPlan, actionItem: created };
}

export async function updateActionItem(context: ActorContext, actionItemId: string, input: Partial<ActionInput>) {
  const displayStatus = input.status;
  const [updated] = await db
    .update(actionPlanItemsTable)
    .set({
      title: input.title,
      description: input.description,
      status: displayStatus ? actionItemStatus(displayStatus) : undefined,
      priority: input.priority,
      dueAt: input.targetDate !== undefined ? parseDate(input.targetDate) : undefined,
      metadata: sql`${actionPlanItemsTable.metadata} || ${JSON.stringify({
        ownerName: input.owner,
        displayStatus,
        progressNotes: input.progressNotes,
        readinessAreaKey: input.readinessAreaKey,
      })}::jsonb`,
      completedAt: displayStatus === "completed" ? new Date() : undefined,
    })
    .where(and(
      eq(actionPlanItemsTable.id, actionItemId),
      inArray(actionPlanItemsTable.actionPlanId, db.select({ id: actionPlansTable.id }).from(actionPlansTable).where(eq(actionPlansTable.institutionId, context.institutionId))),
    ))
    .returning();
  if (!updated) throw new Error("Action item not found");
  await linkActionItem(updated.id, input);
  return updated;
}

function swotCsv(items: Awaited<ReturnType<typeof listSwotItems>>["swotItems"]) {
  const rows = [
    ["Category", "Title", "Status", "Rationale", "Evidence", "Claims", "Findings", "Readiness", "Review Notes"],
    ...items.map((item) => [
      item.categoryLabel,
      item.title,
      item.status,
      item.rationale ?? "",
      item.traceability.evidenceCount,
      item.traceability.claimCount,
      item.traceability.findingCount,
      item.traceability.readinessCount,
      item.traceability.reviewNoteCount,
    ]),
  ];
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function actionCsv(items: Awaited<ReturnType<typeof listActionPlanning>>["actionItems"]) {
  const rows = [
    ["Title", "Owner", "Priority", "Status", "Target Date", "Progress Notes", "SWOT Links", "Finding Links", "Readiness Links", "Evidence Links"],
    ...items.map((item) => [
      item.title,
      item.ownerName,
      item.priority,
      item.displayStatusLabel,
      item.dueAt?.toISOString() ?? "",
      item.progressNotes,
      item.traceability.swotCount,
      item.traceability.findingCount,
      item.traceability.readinessCount,
      item.traceability.evidenceCount,
    ]),
  ];
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

export async function exportSwotSummary(context: ActorContext, programmeVersionId: string, reviewCycleId: string, format: "json" | "csv" = "json") {
  const swot = await listSwotItems(context, programmeVersionId, reviewCycleId);
  const payload = format === "csv" ? swotCsv(swot.swotItems) : JSON.stringify(swot, null, 2);
  const [reviewExport] = await db.insert(reviewExportsTable).values({
    institutionId: context.institutionId,
    reviewCycleId,
    requestedByUserId: context.userId,
    format,
    status: "completed",
    completedAt: new Date(),
    configuration: { exportType: "swot_summary" },
    metadata: { inlineExport: true, programmeVersionId },
  }).returning();
  return {
    reviewExport,
    filename: `cast-swot-summary-${reviewCycleId}.${format}`,
    contentType: format === "csv" ? "text/csv" : "application/json",
    payload,
  };
}

export async function exportActionPlan(context: ActorContext, programmeVersionId: string, reviewCycleId: string, format: "json" | "csv" = "json") {
  const actions = await listActionPlanning(context, programmeVersionId, reviewCycleId);
  const payload = format === "csv" ? actionCsv(actions.actionItems) : JSON.stringify(actions, null, 2);
  const [reviewExport] = await db.insert(reviewExportsTable).values({
    institutionId: context.institutionId,
    reviewCycleId,
    requestedByUserId: context.userId,
    format,
    status: "completed",
    completedAt: new Date(),
    configuration: { exportType: "action_plan_status_report" },
    metadata: { inlineExport: true, programmeVersionId },
  }).returning();
  return {
    reviewExport,
    filename: `cast-action-plan-${reviewCycleId}.${format}`,
    contentType: format === "csv" ? "text/csv" : "application/json",
    payload,
  };
}
