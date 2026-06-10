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
  createProgrammeVersionFromSource,
  getCuratedStructure,
  getProgrammeOverview,
  getProgrammeVersion,
  listProgrammeVersions,
  listSourceProgrammes,
  mapPreview,
  runProgrammeQualityChecks,
  sourceComparison,
  updateStructureGroup,
  updateStructureItem,
  upsertReconciliation,
} from "../../lib/programmeWorkspace/service.js";

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
