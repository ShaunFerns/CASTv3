import { Router, type IRouter, type Request } from "express";
import {
  generateFrameworkClaimsForModule,
  generateFrameworkClaimsForScope,
  generateGreenCompClaimsForScope,
  generateGreenCompClaimsForModule,
  listReviewsForClaim,
  listClaimsForModule,
  reviewClaim,
  type FrameworkIntelligenceKey,
  type GreenCompBulkGenerationScope,
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

function frameworkKey(req: Request): FrameworkIntelligenceKey {
  const value = req.params.frameworkKey;
  const resolved = Array.isArray(value) ? value[0] : value;
  if (resolved === "greencomp" || resolved === "digcomp" || resolved === "entrecomp" || resolved === "engineers-ireland") return resolved;
  throw new Error("Choose a valid framework: greencomp, digcomp, entrecomp or engineers-ireland");
}

function greenCompScopeBody(body: unknown): { scope: GreenCompBulkGenerationScope; targetId?: string } {
  const payload = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
  const scope = typeof payload.scope === "string" ? payload.scope : "";
  if (!["module", "programme", "institution"].includes(scope)) throw new Error("Choose a valid GreenComp analysis scope");
  const targetId = typeof payload.targetId === "string" && payload.targetId.trim() ? payload.targetId.trim() : undefined;
  return { scope: scope as GreenCompBulkGenerationScope, targetId };
}

function frameworkScopeBody(body: unknown): { scope: GreenCompBulkGenerationScope; targetId?: string } {
  const payload = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
  const scope = typeof payload.scope === "string" ? payload.scope : "";
  if (!["module", "programme", "institution"].includes(scope)) throw new Error("Choose a valid framework analysis scope");
  const targetId = typeof payload.targetId === "string" && payload.targetId.trim() ? payload.targetId.trim() : undefined;
  return { scope: scope as GreenCompBulkGenerationScope, targetId };
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
      const message = error instanceof Error && error.message === "Module not found" ? error.message : "GreenComp analysis could not be generated";
      res.status(message === "Module not found" ? 404 : 500).json({ error: message === "Module not found" ? "not_found" : "claims_error", message });
    }
  },
);

router.post(
  "/claims/modules/:moduleId/frameworks/:frameworkKey/generate",
  ...protectedClaims,
  requirePermission("curriculum.write"),
  async (req, res): Promise<void> => {
    const selectedModuleId = moduleId(req);
    let selectedFramework: FrameworkIntelligenceKey = "greencomp";
    try {
      selectedFramework = frameworkKey(req);
      const result = await generateFrameworkClaimsForModule(context(req), selectedModuleId, selectedFramework);
      writeRequestAuditEventSoon({
        req,
        actionType: `claims.${selectedFramework}_generated`,
        subjectType: "module",
        subjectId: selectedModuleId,
        metadata: {
          frameworkKey: selectedFramework,
          analysisRunId: result.analysisRunId,
          claimsCreated: result.claimsCreated,
          claimsSkipped: result.claimsSkipped,
          evaluationsCreated: result.evaluationsCreated,
          evidenceConsidered: result.evidenceConsidered,
          deterministic: true,
        },
      });
      res.json(result);
    } catch (error) {
      writeRequestAuditEventSoon({
        req,
        actionType: `claims.${selectedFramework}_generation_failed`,
        subjectType: "module",
        subjectId: selectedModuleId,
        metadata: {
          frameworkKey: selectedFramework,
          error: error instanceof Error ? error.message : "Unknown error",
          deterministic: true,
        },
      });
      const message = error instanceof Error ? error.message : "Framework analysis could not be generated";
      const status = message === "Module not found" ? 404 : message.includes("valid framework") ? 400 : 500;
      res.status(status).json({ error: status === 404 ? "not_found" : status === 400 ? "bad_request" : "claims_error", message });
    }
  },
);

router.post(
  "/claims/greencomp/generate",
  ...protectedClaims,
  requirePermission("curriculum.write"),
  async (req, res): Promise<void> => {
    try {
      const input = greenCompScopeBody(req.body);
      const result = await generateGreenCompClaimsForScope(context(req), input);
      writeRequestAuditEventSoon({
        req,
        actionType: "claims.greencomp_bulk_generated",
        subjectType: input.scope === "module" ? "module" : input.scope === "programme" ? "programme_version" : "institution",
        subjectId: input.targetId,
        metadata: {
          scope: input.scope,
          modulesAnalysed: result.modulesAnalysed,
          modulesWithClaims: result.modulesWithClaims,
          claimsCreated: result.claimsCreated,
          claimsSkipped: result.claimsSkipped,
          evaluationsCreated: result.evaluationsCreated,
          evidenceConsidered: result.evidenceConsidered,
          deterministic: true,
        },
      });
      res.json(result);
    } catch (error) {
      writeRequestAuditEventSoon({
        req,
        actionType: "claims.greencomp_bulk_generation_failed",
        subjectType: "framework",
        metadata: {
          error: error instanceof Error ? error.message : "Unknown error",
          deterministic: true,
        },
      });
      const message = error instanceof Error ? error.message : "GreenComp analysis could not be generated";
      const status = message.includes("required") || message.includes("valid") ? 400 : message.includes("not found") ? 404 : 500;
      res.status(status).json({ error: status === 400 ? "bad_request" : status === 404 ? "not_found" : "claims_error", message });
    }
  },
);

router.post(
  "/claims/frameworks/:frameworkKey/generate",
  ...protectedClaims,
  requirePermission("curriculum.write"),
  async (req, res): Promise<void> => {
    let selectedFramework: FrameworkIntelligenceKey = "greencomp";
    try {
      selectedFramework = frameworkKey(req);
      const input = frameworkScopeBody(req.body);
      const result = await generateFrameworkClaimsForScope(context(req), { frameworkKey: selectedFramework, ...input });
      writeRequestAuditEventSoon({
        req,
        actionType: `claims.${selectedFramework}_bulk_generated`,
        subjectType: input.scope === "module" ? "module" : input.scope === "programme" ? "programme_version" : "institution",
        subjectId: input.targetId,
        metadata: {
          frameworkKey: selectedFramework,
          scope: input.scope,
          modulesAnalysed: result.modulesAnalysed,
          modulesWithClaims: result.modulesWithClaims,
          claimsCreated: result.claimsCreated,
          claimsSkipped: result.claimsSkipped,
          evaluationsCreated: result.evaluationsCreated,
          evidenceConsidered: result.evidenceConsidered,
          deterministic: true,
        },
      });
      res.json(result);
    } catch (error) {
      writeRequestAuditEventSoon({
        req,
        actionType: `claims.${selectedFramework}_bulk_generation_failed`,
        subjectType: "framework",
        metadata: {
          frameworkKey: selectedFramework,
          error: error instanceof Error ? error.message : "Unknown error",
          deterministic: true,
        },
      });
      const message = error instanceof Error ? error.message : "Framework analysis could not be generated";
      const status = message.includes("required") || message.includes("valid") ? 400 : message.includes("not found") ? 404 : 500;
      res.status(status).json({ error: status === 400 ? "bad_request" : status === 404 ? "not_found" : "claims_error", message });
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
