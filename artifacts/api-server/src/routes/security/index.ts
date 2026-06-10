import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";

import { db, usersTable } from "@workspace/db";
import { withAudit } from "../../lib/auditWriter.js";
import {
  requireInstitutionContext,
  requirePermission,
  requireSession,
  resolveCurrentUser,
} from "../../lib/requestContext.js";

const router: IRouter = Router();

function onboardingState(metadata: Record<string, unknown> | null | undefined) {
  const onboarding = metadata?.["onboarding"];
  if (!onboarding || typeof onboarding !== "object" || Array.isArray(onboarding)) {
    return { guidedTourCompleted: false };
  }
  const state = onboarding as Record<string, unknown>;
  return {
    guidedTourCompleted: state["guidedTourCompleted"] === true,
    guidedTourCompletedAt: typeof state["guidedTourCompletedAt"] === "string" ? state["guidedTourCompletedAt"] : null,
  };
}

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
      userDisplayName: req.cast?.user.displayName,
      userEmail: req.cast?.user.email,
      selectedInstitutionId: req.cast?.selectedInstitutionId,
      membershipId: req.cast?.institutionMembership?.id,
      roleKeys: req.cast?.roleKeys ?? [],
      effectivePermissions: req.cast?.effectivePermissions ?? [],
      onboarding: onboardingState(req.cast?.user.metadata),
    });
  },
);

router.patch(
  "/security/onboarding-tour",
  requireSession(),
  resolveCurrentUser(),
  requireInstitutionContext(),
  requirePermission("institution.read"),
  withAudit((req) => ({
    actionType: "onboarding.tour_state_updated",
    subjectType: "user",
    subjectId: req.cast?.user.id,
    metadata: {
      completed: req.body?.completed === true,
      route: "/api/security/onboarding-tour",
    },
  })),
  async (req, res) => {
    const completed = req.body?.completed === true;
    const metadataPatch = {
      onboarding: {
        guidedTourCompleted: completed,
        guidedTourCompletedAt: completed ? new Date().toISOString() : null,
      },
    };

    const [updated] = await db
      .update(usersTable)
      .set({
        metadata: sql`${usersTable.metadata} || ${JSON.stringify(metadataPatch)}::jsonb`,
      })
      .where(eq(usersTable.id, req.cast?.user.id as string))
      .returning();

    res.json({ onboarding: onboardingState(updated?.metadata) });
  },
);

export default router;
