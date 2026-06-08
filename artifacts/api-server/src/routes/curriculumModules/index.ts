import { Router, type IRouter, type Request } from "express";
import {
  requireInstitutionContext,
  requirePermission,
  requireSession,
  resolveCurrentUser,
} from "../../lib/requestContext.js";
import {
  getModuleBuilderDetail,
  getModuleLibraryItem,
  listModuleLibrary,
  type ModuleLibraryFilters,
} from "../../lib/moduleLibrary/service.js";
import { archiveModule, hardDeleteModule } from "../../lib/cleanup/service.js";
import { writeRequestAuditEvent } from "../../lib/auditWriter.js";

const router: IRouter = Router();

const protectedModuleLibrary = [
  requireSession(),
  resolveCurrentUser(),
  requireInstitutionContext(),
] as const;

function context(req: Request) {
  if (!req.cast?.selectedInstitutionId) throw new Error("Institution context is required");
  return { institutionId: req.cast.selectedInstitutionId, userId: req.cast.user.id };
}

function queryString(req: Request, key: keyof ModuleLibraryFilters): string | undefined {
  const value = req.query[key];
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function idParam(req: Request, name: string): string {
  const value = req.params[name];
  const resolved = Array.isArray(value) ? value[0] : value;
  if (!resolved) throw new Error(`${name} is required`);
  return resolved;
}

router.get(
  "/curriculum/modules",
  ...protectedModuleLibrary,
  requirePermission("curriculum.read"),
  async (req, res): Promise<void> => {
    const filters: ModuleLibraryFilters = {
      q: queryString(req, "q"),
      programme: queryString(req, "programme"),
      stage: queryString(req, "stage"),
      semester: queryString(req, "semester"),
      upload: queryString(req, "upload"),
    };
    res.json(await listModuleLibrary(context(req), filters));
  },
);

router.get(
  "/curriculum/modules/:moduleId",
  ...protectedModuleLibrary,
  requirePermission("curriculum.read"),
  async (req, res): Promise<void> => {
    const item = await getModuleLibraryItem(context(req), idParam(req, "moduleId"));
    if (!item) {
      res.status(404).json({ error: "not_found", message: "Module not found" });
      return;
    }
    res.json({ module: item });
  },
);

router.get(
  "/curriculum/modules/:moduleId/builder-detail",
  ...protectedModuleLibrary,
  requirePermission("curriculum.read"),
  async (req, res): Promise<void> => {
    const detail = await getModuleBuilderDetail(context(req), idParam(req, "moduleId"));
    if (!detail) {
      res.status(404).json({ error: "not_found", message: "Module not found" });
      return;
    }
    res.json(detail);
  },
);

router.post(
  "/curriculum/modules/:moduleId/archive",
  ...protectedModuleLibrary,
  requirePermission("institution.manage"),
  async (req, res): Promise<void> => {
    const result = await archiveModule(context(req), idParam(req, "moduleId"));
    await writeRequestAuditEvent({
      req,
      actionType: "cleanup.module_archived",
      subjectType: "module",
      subjectId: result.subjectId,
      metadata: result,
    });
    res.json(result);
  },
);

router.delete(
  "/curriculum/modules/:moduleId",
  ...protectedModuleLibrary,
  requirePermission("institution.manage"),
  async (req, res): Promise<void> => {
    try {
      const result = await hardDeleteModule(context(req), idParam(req, "moduleId"));
      await writeRequestAuditEvent({
        req,
        actionType: "cleanup.module_deleted",
        subjectType: "module",
        subjectId: result.subjectId,
        metadata: result,
      });
      res.json(result);
    } catch (error) {
      const blockedReasons = (error as Error & { blockedReasons?: string[] }).blockedReasons;
      res.status(blockedReasons ? 409 : 400).json({
        error: blockedReasons ? "delete_blocked" : "cleanup_error",
        message: error instanceof Error ? error.message : "Module could not be deleted",
        blockedReasons,
      });
    }
  },
);

export default router;
