import { Router, type IRouter } from "express";

import { withAudit } from "../../lib/auditWriter.js";
import {
  requireInstitutionContext,
  requirePermission,
  requireSession,
  resolveCurrentUser,
} from "../../lib/requestContext.js";

const router: IRouter = Router();

router.get(
  "/security/context",
  requireSession(),
  resolveCurrentUser(),
  requireInstitutionContext(),
  requirePermission("institution.read"),
  withAudit((req) => ({
    actionType: "security.context_read",
    subjectType: "user",
    subjectId: req.cast?.user.id,
    metadata: { route: "/api/security/context" },
  })),
  (req, res) => {
    res.json({
      actorType: req.cast?.actorType,
      userId: req.cast?.user.id,
      selectedInstitutionId: req.cast?.selectedInstitutionId,
      membershipId: req.cast?.institutionMembership?.id,
      roleKeys: req.cast?.roleKeys ?? [],
      effectivePermissions: req.cast?.effectivePermissions ?? [],
    });
  },
);

export default router;
