import { Router, type IRouter, type Request } from "express";
import { writeRequestAuditEvent } from "../../lib/auditWriter.js";
import { archiveProgrammeVersion } from "../../lib/cleanup/service.js";
import {
  requireInstitutionContext,
  requirePermission,
  requireSession,
  resolveCurrentUser,
} from "../../lib/requestContext.js";
import {
  buildInitialCuratedStructure,
  compareProgrammeStates,
  createProgrammeVersionFromSource,
  exportProgrammeComparison,
  getCuratedStructure,
  getProgrammeOverview,
  getProgrammeVersion,
  listProgrammeComparisonOptions,
  listProgrammeVersions,
  listSourceProgrammes,
  mapPreview,
  runProgrammeQualityChecks,
  sourceComparison,
  updateStructureGroup,
  updateStructureItem,
  upsertReconciliation,
} from "../../lib/programmeWorkspace/service.js";
import {
  addReviewNote,
  addReviewParticipant,
  buildReadinessSummary,
  createReadinessAssessment,
  createReviewCycle,
  exportReadinessSummary,
  exportReviewCycle,
  getReadinessAssessments,
  getReviewCycle,
  listReviewCycles,
  updateReviewCycle,
} from "../../lib/reviewReadiness/service.js";

const router: IRouter = Router();

const protectedWorkspace = [
  requireSession(),
  resolveCurrentUser(),
  requireInstitutionContext(),
] as const;

function context(req: Request) {
  if (!req.cast?.selectedInstitutionId) throw new Error("Institution context is required");
  return {
    institutionId: req.cast.selectedInstitutionId,
    userId: req.cast.user.id,
  };
}

function idParam(req: Request, name: string): string {
  const value = req.params[name];
  const resolved = Array.isArray(value) ? value[0] : value;
  if (!resolved) throw new Error(`${name} is required`);
  return resolved;
}

router.get(
  "/programme-workspace/source-programmes",
  ...protectedWorkspace,
  requirePermission("imports.read"),
  async (req, res): Promise<void> => {
    res.json({ sourceProgrammes: await listSourceProgrammes(context(req)) });
  },
);

router.get(
  "/programme-workspace/programme-versions",
  ...protectedWorkspace,
  requirePermission("programme.read"),
  async (req, res): Promise<void> => {
    res.json({ programmeVersions: await listProgrammeVersions(context(req)) });
  },
);

router.post(
  "/programme-workspace/programme-versions",
  ...protectedWorkspace,
  requirePermission("programme.write"),
  async (req, res): Promise<void> => {
    const programme = await createProgrammeVersionFromSource(context(req), req.body);
    await writeRequestAuditEvent({
      req,
      actionType: "programme_workspace.programme_version_created",
      subjectType: "programme_version",
      subjectId: programme.id,
      metadata: { sourceProgrammeId: programme.sourceProgrammeId },
    });
    res.status(201).json({ programmeVersion: programme });
  },
);

router.get(
  "/programme-workspace/programme-versions/:programmeVersionId",
  ...protectedWorkspace,
  requirePermission("programme.read"),
  async (req, res): Promise<void> => {
    const programme = await getProgrammeVersion(context(req), idParam(req, "programmeVersionId"));
    if (!programme) {
      res.status(404).json({ error: "not_found", message: "Programme version not found" });
      return;
    }
    res.json({ programmeVersion: programme });
  },
);

router.get(
  "/programme-workspace/programme-versions/:programmeVersionId/overview",
  ...protectedWorkspace,
  requirePermission("programme.read"),
  async (req, res): Promise<void> => {
    res.json(await getProgrammeOverview(context(req), idParam(req, "programmeVersionId")));
  },
);

router.get(
  "/programme-workspace/programme-versions/:programmeVersionId/review-cycles",
  ...protectedWorkspace,
  requirePermission("programme.read"),
  async (req, res): Promise<void> => {
    res.json(await listReviewCycles(context(req), idParam(req, "programmeVersionId")));
  },
);

router.post(
  "/programme-workspace/review-cycles",
  ...protectedWorkspace,
  requirePermission("programme.write"),
  async (req, res): Promise<void> => {
    const reviewCycle = await createReviewCycle(context(req), req.body);
    await writeRequestAuditEvent({
      req,
      actionType: "review_cycle.created",
      subjectType: "review_cycle",
      subjectId: reviewCycle.id,
      metadata: { programmeVersionId: reviewCycle.programmeVersionId, cycleType: reviewCycle.cycleType },
    });
    res.status(201).json({ reviewCycle });
  },
);

router.get(
  "/programme-workspace/review-cycles/:reviewCycleId",
  ...protectedWorkspace,
  requirePermission("programme.read"),
  async (req, res): Promise<void> => {
    res.json(await getReviewCycle(context(req), idParam(req, "reviewCycleId")));
  },
);

router.patch(
  "/programme-workspace/review-cycles/:reviewCycleId",
  ...protectedWorkspace,
  requirePermission("programme.write"),
  async (req, res): Promise<void> => {
    const reviewCycle = await updateReviewCycle(context(req), idParam(req, "reviewCycleId"), req.body);
    await writeRequestAuditEvent({
      req,
      actionType: "review_cycle.updated",
      subjectType: "review_cycle",
      subjectId: reviewCycle.id,
      metadata: { status: reviewCycle.status },
    });
    res.json({ reviewCycle });
  },
);

router.post(
  "/programme-workspace/review-cycles/:reviewCycleId/participants",
  ...protectedWorkspace,
  requirePermission("programme.write"),
  async (req, res): Promise<void> => {
    const participant = await addReviewParticipant(context(req), idParam(req, "reviewCycleId"), req.body);
    await writeRequestAuditEvent({
      req,
      actionType: "review_cycle.participant_added",
      subjectType: "review_cycle",
      subjectId: idParam(req, "reviewCycleId"),
      metadata: { participantId: participant.id, role: participant.role },
    });
    res.status(201).json({ participant });
  },
);

router.post(
  "/programme-workspace/review-cycles/:reviewCycleId/notes",
  ...protectedWorkspace,
  requirePermission("programme.write"),
  async (req, res): Promise<void> => {
    const note = await addReviewNote(context(req), idParam(req, "reviewCycleId"), req.body);
    await writeRequestAuditEvent({
      req,
      actionType: "review_cycle.note_added",
      subjectType: "review_cycle",
      subjectId: idParam(req, "reviewCycleId"),
      metadata: { noteId: note.id, noteType: note.noteType },
    });
    res.status(201).json({ note });
  },
);

router.post(
  "/programme-workspace/review-cycles/:reviewCycleId/export",
  ...protectedWorkspace,
  requirePermission("programme.read"),
  async (req, res): Promise<void> => {
    const format = req.body?.format === "csv" ? "csv" : "json";
    const result = await exportReviewCycle(context(req), idParam(req, "reviewCycleId"), format);
    await writeRequestAuditEvent({
      req,
      actionType: "review_cycle.exported",
      subjectType: "review_export",
      subjectId: result.reviewExport.id,
      metadata: { reviewCycleId: idParam(req, "reviewCycleId"), format },
    });
    res.status(201).json(result);
  },
);

router.get(
  "/programme-workspace/programme-versions/:programmeVersionId/readiness",
  ...protectedWorkspace,
  requirePermission("programme.read"),
  async (req, res): Promise<void> => {
    const programmeVersionId = idParam(req, "programmeVersionId");
    const [summary, stored] = await Promise.all([
      buildReadinessSummary(context(req), programmeVersionId),
      getReadinessAssessments(context(req), programmeVersionId),
    ]);
    res.json({ summary, ...stored });
  },
);

router.post(
  "/programme-workspace/review-cycles/:reviewCycleId/readiness-assessments",
  ...protectedWorkspace,
  requirePermission("programme.write"),
  async (req, res): Promise<void> => {
    const result = await createReadinessAssessment(context(req), idParam(req, "reviewCycleId"));
    await writeRequestAuditEvent({
      req,
      actionType: "readiness_assessment.created",
      subjectType: "readiness_assessment",
      subjectId: result.readinessAssessment.id,
      metadata: { reviewCycleId: idParam(req, "reviewCycleId"), itemCount: result.items.length },
    });
    res.status(201).json(result);
  },
);

router.post(
  "/programme-workspace/review-cycles/:reviewCycleId/readiness/export",
  ...protectedWorkspace,
  requirePermission("programme.read"),
  async (req, res): Promise<void> => {
    const format = req.body?.format === "csv" ? "csv" : "json";
    const result = await exportReadinessSummary(context(req), idParam(req, "reviewCycleId"), format);
    await writeRequestAuditEvent({
      req,
      actionType: "readiness_assessment.exported",
      subjectType: "review_export",
      subjectId: result.reviewExport.id,
      metadata: { reviewCycleId: idParam(req, "reviewCycleId"), format },
    });
    res.status(201).json(result);
  },
);

router.get(
  "/programme-workspace/comparison-options",
  ...protectedWorkspace,
  requirePermission("programme.read"),
  async (req, res): Promise<void> => {
    res.json(await listProgrammeComparisonOptions(context(req)));
  },
);

router.post(
  "/programme-workspace/comparisons",
  ...protectedWorkspace,
  requirePermission("programme.read"),
  async (req, res): Promise<void> => {
    res.json(await compareProgrammeStates(context(req), req.body));
  },
);

router.post(
  "/programme-workspace/comparisons/export",
  ...protectedWorkspace,
  requirePermission("programme.read"),
  async (req, res): Promise<void> => {
    const result = await exportProgrammeComparison(context(req), req.body);
    await writeRequestAuditEvent({
      req,
      actionType: "programme_workspace.comparison_exported",
      subjectType: "programme_version",
      subjectId: req.body?.rightId ?? req.body?.leftId,
      metadata: {
        mode: req.body?.mode,
        format: req.body?.format ?? "json",
        leftId: req.body?.leftId,
        rightId: req.body?.rightId,
        inlineExport: true,
      },
    });
    res.status(201).json(result);
  },
);

router.post(
  "/programme-workspace/programme-versions/:programmeVersionId/archive",
  ...protectedWorkspace,
  requirePermission("institution.manage"),
  async (req, res): Promise<void> => {
    const result = await archiveProgrammeVersion(context(req), idParam(req, "programmeVersionId"));
    await writeRequestAuditEvent({
      req,
      actionType: "cleanup.programme_version_archived",
      subjectType: "programme_version",
      subjectId: result.subjectId,
      metadata: result,
    });
    res.json(result);
  },
);

router.post(
  "/programme-workspace/programme-versions/:programmeVersionId/reconcile",
  ...protectedWorkspace,
  requirePermission("programme.write"),
  async (req, res): Promise<void> => {
    const link = await upsertReconciliation(context(req), req.body);
    await writeRequestAuditEvent({
      req,
      actionType: "programme_workspace.reconciliation_saved",
      subjectType: "programme_version",
      subjectId: idParam(req, "programmeVersionId"),
      metadata: { reconciliationLinkId: link.id },
    });
    res.status(201).json({ reconciliationLink: link });
  },
);

router.post(
  "/programme-workspace/programme-versions/:programmeVersionId/structure",
  ...protectedWorkspace,
  requirePermission("programme.write"),
  async (req, res): Promise<void> => {
    const result = await buildInitialCuratedStructure(context(req), idParam(req, "programmeVersionId"));
    await writeRequestAuditEvent({
      req,
      actionType: "programme_workspace.structure_generated",
      subjectType: "curated_structure",
      subjectId: result.structure.id,
      metadata: { groupsCreated: result.groupsCreated, itemsCreated: result.itemsCreated },
    });
    res.status(201).json(result);
  },
);

router.get(
  "/programme-workspace/programme-versions/:programmeVersionId/structure",
  ...protectedWorkspace,
  requirePermission("programme.read"),
  async (req, res): Promise<void> => {
    res.json(await getCuratedStructure(context(req), idParam(req, "programmeVersionId")));
  },
);

router.patch(
  "/programme-workspace/structure-groups/:groupId",
  ...protectedWorkspace,
  requirePermission("programme.write"),
  async (req, res): Promise<void> => {
    const group = await updateStructureGroup(context(req), idParam(req, "groupId"), req.body);
    await writeRequestAuditEvent({
      req,
      actionType: "programme_workspace.structure_group_updated",
      subjectType: "curated_structure",
      subjectId: group.curatedStructureId,
      metadata: { groupId: group.id },
    });
    res.json({ group });
  },
);

router.patch(
  "/programme-workspace/structure-items/:itemId",
  ...protectedWorkspace,
  requirePermission("programme.write"),
  async (req, res): Promise<void> => {
    const item = await updateStructureItem(context(req), idParam(req, "itemId"), req.body);
    await writeRequestAuditEvent({
      req,
      actionType: "programme_workspace.structure_item_updated",
      subjectType: "curated_structure_item",
      subjectId: item.id,
      metadata: { curatedStructureId: item.curatedStructureId },
    });
    res.json({ item });
  },
);

router.get(
  "/programme-workspace/programme-versions/:programmeVersionId/source-comparison",
  ...protectedWorkspace,
  requirePermission("programme.read"),
  async (req, res): Promise<void> => {
    res.json(await sourceComparison(context(req), idParam(req, "programmeVersionId")));
  },
);

router.post(
  "/programme-workspace/programme-versions/:programmeVersionId/data-quality",
  ...protectedWorkspace,
  requirePermission("data_quality.manage"),
  async (req, res): Promise<void> => {
    const result = await runProgrammeQualityChecks(context(req), idParam(req, "programmeVersionId"));
    await writeRequestAuditEvent({
      req,
      actionType: "programme_workspace.data_quality_run",
      subjectType: "programme_version",
      subjectId: idParam(req, "programmeVersionId"),
      metadata: { dataQualityRunId: result.qualityRun.id, resultCount: result.results.length },
    });
    res.status(201).json(result);
  },
);

router.get(
  "/programme-workspace/programme-versions/:programmeVersionId/map-preview",
  ...protectedWorkspace,
  requirePermission("programme.read"),
  async (req, res): Promise<void> => {
    res.json(await mapPreview(context(req), idParam(req, "programmeVersionId")));
  },
);

export default router;
