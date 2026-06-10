import { Router, type IRouter, type Request } from "express";
import { writeRequestAuditEvent } from "../../lib/auditWriter.js";
import {
  archiveImportBatch,
  hardDeleteImportBatch,
  listCleanupImportBatches,
} from "../../lib/cleanup/service.js";
import {
  hasBootstrapDeleteOverride,
  requireInstitutionContext,
  requirePermission,
  requireSession,
  resolveCurrentUser,
} from "../../lib/requestContext.js";

const router: IRouter = Router();

const protectedCleanup = [
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

function wantsBootstrapOverride(req: Request): boolean {
  return req.query["bootstrapOverride"] === "true" || req.body?.bootstrapOverride === true;
}

router.get(
  "/cleanup/import-batches",
  ...protectedCleanup,
  requirePermission("institution.manage"),
  async (req, res): Promise<void> => {
    res.json(await listCleanupImportBatches(context(req)));
  },
);

router.post(
  "/cleanup/import-batches/:importBatchId/archive",
  ...protectedCleanup,
  requirePermission("institution.manage"),
  async (req, res): Promise<void> => {
    const result = await archiveImportBatch(context(req), idParam(req, "importBatchId"));
    await writeRequestAuditEvent({
      req,
      actionType: "cleanup.import_batch_archived",
      subjectType: "import_batch",
      subjectId: result.subjectId,
      metadata: result,
    });
    res.json(result);
  },
);

router.delete(
  "/cleanup/import-batches/:importBatchId",
  ...protectedCleanup,
  requirePermission("institution.manage"),
  async (req, res): Promise<void> => {
    try {
      const bootstrapOverride = wantsBootstrapOverride(req);
      if (bootstrapOverride && !hasBootstrapDeleteOverride(req)) {
        res.status(403).json({
          error: "forbidden",
          message: "Bootstrap administrator override is not available for this session.",
        });
        return;
      }

      const result = await hardDeleteImportBatch(context(req), idParam(req, "importBatchId"), { bootstrapOverride });
      await writeRequestAuditEvent({
        req,
        actionType: bootstrapOverride ? "cleanup.bootstrap_override_delete" : "cleanup.import_batch_deleted",
        subjectType: "import_batch",
        subjectId: result.subjectId,
        metadata: result,
      });
      res.json(result);
    } catch (error) {
      const blockedReasons = (error as Error & { blockedReasons?: string[] }).blockedReasons;
      const diagnostics = (error as Error & { diagnostics?: unknown }).diagnostics;
      res.status(blockedReasons ? 409 : 400).json({
        error: blockedReasons ? "delete_blocked" : "cleanup_error",
        message: error instanceof Error ? error.message : "Upload could not be deleted",
        blockedReasons,
        diagnostics,
      });
    }
  },
);

export default router;
