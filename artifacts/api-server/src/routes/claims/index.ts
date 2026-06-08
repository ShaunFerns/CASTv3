import { Router, type IRouter, type Request } from "express";
import {
  generateGreenCompClaimsForModule,
  listClaimsForModule,
} from "../../lib/evidenceClaims/service.js";
import {
  requireInstitutionContext,
  requirePermission,
  requireSession,
  resolveCurrentUser,
} from "../../lib/requestContext.js";
import { writeRequestAuditEventSoon } from "../../lib/auditWriter.js";

const router: IRouter = Router();

const protectedClaims = [
  requireSession(),
  resolveCurrentUser(),
  requireInstitutionContext(),
] as const;

function context(req: Request) {
  if (!req.cast?.selectedInstitutionId) throw new Error("Institution context is required");
  return { institutionId: req.cast.selectedInstitutionId, userId: req.cast.user.id };
}

function moduleId(req: Request): string {
  const value = req.params.moduleId;
  const resolved = Array.isArray(value) ? value[0] : value;
  if (!resolved?.trim()) throw new Error("moduleId is required");
  return resolved.trim();
}

router.get(
  "/claims/modules/:moduleId",
  ...protectedClaims,
  requirePermission("curriculum.read"),
  async (req, res): Promise<void> => {
    try {
      res.json(await listClaimsForModule(context(req), moduleId(req)));
    } catch (error) {
      const message = error instanceof Error && error.message === "Module not found" ? error.message : "Claims could not be loaded";
      res.status(message === "Module not found" ? 404 : 500).json({ error: message === "Module not found" ? "not_found" : "claims_error", message });
    }
  },
);

router.post(
  "/claims/modules/:moduleId/generate",
  ...protectedClaims,
  requirePermission("curriculum.write"),
  async (req, res): Promise<void> => {
    const selectedModuleId = moduleId(req);
    try {
      const result = await generateGreenCompClaimsForModule(context(req), selectedModuleId);
      writeRequestAuditEventSoon({
        req,
        actionType: "claims.greencomp_generated",
        subjectType: "module",
        subjectId: selectedModuleId,
        metadata: {
          analysisRunId: result.analysisRunId,
          claimsCreated: result.claimsCreated,
          claimsSkipped: result.claimsSkipped,
          evidenceConsidered: result.evidenceConsidered,
          phase: "6B.1",
        },
      });
      res.json(result);
    } catch (error) {
      writeRequestAuditEventSoon({
        req,
        actionType: "claims.greencomp_generation_failed",
        subjectType: "module",
        subjectId: selectedModuleId,
        metadata: {
          phase: "6B.1",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
      const message = error instanceof Error && error.message === "Module not found" ? error.message : "GreenComp claims could not be generated";
      res.status(message === "Module not found" ? 404 : 500).json({ error: message === "Module not found" ? "not_found" : "claims_error", message });
    }
  },
);

export default router;
