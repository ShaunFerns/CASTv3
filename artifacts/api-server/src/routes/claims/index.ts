import { Router, type IRouter, type Request } from "express";
import {
  generateGreenCompClaimsForModule,
  listReviewsForClaim,
  listClaimsForModule,
  reviewClaim,
  type ClaimReviewDecision,
} from "../../lib/evidenceClaims/service.js";
import {
  hasPermission,
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

function claimId(req: Request): string {
  const value = req.params.claimId;
  const resolved = Array.isArray(value) ? value[0] : value;
  if (!resolved?.trim()) throw new Error("claimId is required");
  return resolved.trim();
}

function requireClaimReviewPermission() {
  return (req: Request, res: { status: (code: number) => { json: (body: unknown) => void } }, next: () => void): void => {
    if (!req.cast) {
      res.status(401).json({ error: "unauthorized", message: "Authentication required" });
      return;
    }
    if (
      !hasPermission(req.cast, "analysis.review") &&
      !hasPermission(req.cast, "review.contribute") &&
      !hasPermission(req.cast, "review.manage")
    ) {
      res.status(403).json({ error: "forbidden", message: "Missing permission: analysis.review or review.contribute" });
      return;
    }
    next();
  };
}

function reviewBody(body: unknown): { decision: ClaimReviewDecision; rationale?: string; amendedText?: string } {
  const payload = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
  const decision = typeof payload.decision === "string" ? payload.decision : "";
  if (!["accept", "reject", "amend", "request_clarification", "not_applicable"].includes(decision)) {
    throw new Error("Choose a valid review action");
  }
  return {
    decision: decision as ClaimReviewDecision,
    rationale: typeof payload.rationale === "string" ? payload.rationale : undefined,
    amendedText: typeof payload.amendedText === "string" ? payload.amendedText : undefined,
  };
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

router.get(
  "/claims/:claimId/reviews",
  ...protectedClaims,
  requirePermission("curriculum.read"),
  async (req, res): Promise<void> => {
    try {
      res.json(await listReviewsForClaim(context(req), claimId(req)));
    } catch (error) {
      const message = error instanceof Error && error.message === "Claim not found" ? error.message : "Claim reviews could not be loaded";
      res.status(message === "Claim not found" ? 404 : 500).json({ error: message === "Claim not found" ? "not_found" : "claims_error", message });
    }
  },
);

router.post(
  "/claims/:claimId/review",
  ...protectedClaims,
  requireClaimReviewPermission(),
  async (req, res): Promise<void> => {
    const selectedClaimId = claimId(req);
    try {
      const result = await reviewClaim(context(req), selectedClaimId, reviewBody(req.body));
      writeRequestAuditEventSoon({
        req,
        actionType: "claims.human_review_recorded",
        subjectType: "human_review",
        subjectId: result.review.id,
        metadata: {
          aiClaimId: selectedClaimId,
          decision: result.review.decision,
          reviewStatus: result.review.status,
          institutionalFinding: result.claim.review.isInstitutionalFinding,
          phase: "6B.2",
        },
      });
      res.json(result);
    } catch (error) {
      writeRequestAuditEventSoon({
        req,
        actionType: "claims.human_review_failed",
        subjectType: "ai_claim",
        subjectId: selectedClaimId,
        metadata: {
          phase: "6B.2",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
      const message = error instanceof Error ? error.message : "Claim review could not be recorded";
      const status = message === "Claim not found" ? 404 : message.includes("required") || message.includes("valid") || message.includes("Unsupported") ? 400 : 500;
      res.status(status).json({ error: status === 404 ? "not_found" : status === 400 ? "bad_request" : "claims_error", message });
    }
  },
);

export default router;
