import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { Session, SessionData } from "express-session";
import { and, eq, inArray } from "drizzle-orm";
import {
  canonicalRoles,
  db,
  institutionMembershipsTable,
  membershipRolesTable,
  programmeMembershipsTable,
  programmeVersionsTable,
  reviewAssignmentsTable,
  reviewCyclesTable,
  rolesTable,
  usersTable,
  type CanonicalPermission,
  type User,
  isCanonicalPermission,
} from "@workspace/db";
import {
  auditPermissionDenied,
  auditProgrammeAccessCheck,
  auditReviewAccessCheck,
} from "./auditWriter.js";

type MembershipRow = typeof institutionMembershipsTable.$inferSelect;
type RoleRow = typeof rolesTable.$inferSelect;
type ProgrammeMembershipRow = typeof programmeMembershipsTable.$inferSelect;
type ReviewAssignmentRow = typeof reviewAssignmentsTable.$inferSelect;

export type CastActorType = "user" | "system" | "worker";

export type CastRequestContext = {
  session: Session & Partial<SessionData>;
  actorType: CastActorType;
  actorIdentifier?: string;
  user: User;
  memberships: MembershipRow[];
  selectedInstitutionId?: string;
  institutionMembership?: MembershipRow;
  roleKeys: string[];
  effectivePermissions: CanonicalPermission[];
};

export type CastSystemActorContext = {
  actorType: "system";
  actorIdentifier: string;
  selectedInstitutionId?: string;
  roleKeys: string[];
  effectivePermissions: CanonicalPermission[];
};

export type CastWorkerActorContext = {
  actorType: "worker";
  actorIdentifier: string;
  selectedInstitutionId?: string;
  roleKeys: string[];
  effectivePermissions: CanonicalPermission[];
};

declare global {
  namespace Express {
    interface Request {
      cast?: CastRequestContext;
      castSystemActor?: CastSystemActorContext;
      castWorkerActor?: CastWorkerActorContext;
    }
  }
}

declare module "express-session" {
  interface SessionData {
    castUserId?: string;
    authUserId?: string;
    selectedInstitutionId?: string;
  }
}

const institutionHeaderName = "x-cast-institution-id";

const programmeActionPermissions = {
  read: ["programme.read", "curriculum.read"],
  write: ["programme.write", "curriculum.write"],
  manage_team: ["programme.manage_team", "institution.manage"],
  review: ["review.contribute", "review.manage"],
} as const satisfies Record<string, readonly CanonicalPermission[]>;

const reviewActionPermissions = {
  read: ["review.read", "review.contribute", "review.manage"],
  contribute: ["review.contribute", "review.manage"],
  manage: ["review.manage"],
} as const satisfies Record<string, readonly CanonicalPermission[]>;

export type ProgrammeAccessAction = keyof typeof programmeActionPermissions;
export type ReviewAccessAction = keyof typeof reviewActionPermissions;

function sendUnauthorized(res: Response, message = "Authentication required"): void {
  res.status(401).json({ error: "unauthorized", message });
}

function sendForbidden(res: Response, message = "Access forbidden"): void {
  res.status(403).json({ error: "forbidden", message });
}

function sendBadRequest(res: Response, message: string): void {
  res.status(400).json({ error: "bad_request", message });
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function selectedInstitutionFromRequest(req: Request): string | undefined {
  const headerValue = req.header(institutionHeaderName);
  const queryValue = typeof req.query["institutionId"] === "string" ? req.query["institutionId"] : undefined;
  const bodyValue =
    typeof req.body === "object" && req.body !== null && "institutionId" in req.body
      ? (req.body as { institutionId?: unknown }).institutionId
      : undefined;

  return asString(headerValue) ?? asString(queryValue) ?? asString(bodyValue) ?? asString(req.session.selectedInstitutionId);
}

function canonicalPermissionsForRole(roleKey: string): readonly CanonicalPermission[] {
  return canonicalRoles.find((role) => role.key === roleKey)?.permissions ?? [];
}

function permissionsFromRolePayload(permissions: Record<string, unknown>): CanonicalPermission[] {
  const fromArray = permissions["permissions"];
  if (Array.isArray(fromArray)) {
    return fromArray.filter(
      (permission): permission is CanonicalPermission => typeof permission === "string" && isCanonicalPermission(permission),
    );
  }

  return Object.entries(permissions)
    .filter(([, enabled]) => enabled === true)
    .map(([permission]) => permission)
    .filter(isCanonicalPermission);
}

function mergePermissions(roleRows: RoleRow[]): CanonicalPermission[] {
  const permissions = new Set<CanonicalPermission>();

  for (const role of roleRows) {
    for (const permission of canonicalPermissionsForRole(role.key)) {
      permissions.add(permission);
    }
    for (const permission of permissionsFromRolePayload(role.permissions)) {
      permissions.add(permission);
    }
  }

  return [...permissions].sort();
}

async function loadRoleRows(membershipIds: string[]): Promise<RoleRow[]> {
  if (membershipIds.length === 0) return [];

  const rows = await db
    .select({ role: rolesTable })
    .from(membershipRolesTable)
    .innerJoin(rolesTable, eq(membershipRolesTable.roleId, rolesTable.id))
    .where(inArray(membershipRolesTable.membershipId, membershipIds));

  return rows.map((row) => row.role);
}

export function requireSession(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.session) {
      sendUnauthorized(res);
      return;
    }
    next();
  };
}

export function resolveCurrentUser(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.session) {
      sendUnauthorized(res);
      return;
    }

    const castUserId = asString(req.session.castUserId);
    const authUserId = asString(req.session.authUserId);

    if (!castUserId && !authUserId) {
      sendUnauthorized(res, "No CAST user is associated with this session");
      return;
    }

    const [user] = castUserId
      ? await db.select().from(usersTable).where(eq(usersTable.id, castUserId)).limit(1)
      : await db.select().from(usersTable).where(eq(usersTable.authUserId, authUserId as string)).limit(1);

    if (!user || user.status !== "active") {
      sendUnauthorized(res, "Active CAST user not found");
      return;
    }

    const memberships = await db
      .select()
      .from(institutionMembershipsTable)
      .where(and(eq(institutionMembershipsTable.userId, user.id), eq(institutionMembershipsTable.status, "active")));

    const roleRows = await loadRoleRows(memberships.map((membership) => membership.id));

    req.cast = {
      session: req.session,
      actorType: "user",
      user,
      memberships,
      roleKeys: [...new Set(roleRows.map((role) => role.key))].sort(),
      effectivePermissions: mergePermissions(roleRows),
    };

    next();
  };
}

export function requireInstitutionContext(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.cast) {
      sendUnauthorized(res);
      return;
    }

    const requestedInstitutionId = selectedInstitutionFromRequest(req);
    const membership =
      requestedInstitutionId !== undefined
        ? req.cast.memberships.find((candidate) => candidate.institutionId === requestedInstitutionId)
        : req.cast.memberships.length === 1
          ? req.cast.memberships[0]
          : undefined;

    if (!membership) {
      if (req.cast.memberships.length > 1 && !requestedInstitutionId) {
        sendBadRequest(res, `Select an institution using the ${institutionHeaderName} header`);
        return;
      }
      sendForbidden(res, "No active membership for the selected institution");
      return;
    }

    const roleRows = await loadRoleRows([membership.id]);

    req.cast = {
      ...req.cast,
      selectedInstitutionId: membership.institutionId,
      institutionMembership: membership,
      roleKeys: [...new Set(roleRows.map((role) => role.key))].sort(),
      effectivePermissions: mergePermissions(roleRows),
    };
    req.session.selectedInstitutionId = membership.institutionId;

    next();
  };
}

export function hasPermission(context: Pick<CastRequestContext, "effectivePermissions">, permission: CanonicalPermission): boolean {
  return context.effectivePermissions.includes(permission) || context.effectivePermissions.includes("platform.admin");
}

export function requirePermission(permission: CanonicalPermission): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.cast) {
      sendUnauthorized(res);
      return;
    }

    if (!hasPermission(req.cast, permission)) {
      auditPermissionDenied(req, permission);
      sendForbidden(res, `Missing permission: ${permission}`);
      return;
    }

    next();
  };
}

export async function canAccessProgramme(
  context: CastRequestContext,
  programmeVersionId: string,
  action: ProgrammeAccessAction,
): Promise<boolean> {
  const [programme] = await db
    .select({
      id: programmeVersionsTable.id,
      institutionId: programmeVersionsTable.institutionId,
    })
    .from(programmeVersionsTable)
    .where(eq(programmeVersionsTable.id, programmeVersionId))
    .limit(1);

  if (!programme || programme.institutionId !== context.selectedInstitutionId) return false;

  if (programmeActionPermissions[action].some((permission) => hasPermission(context, permission))) {
    return true;
  }

  if (!context.institutionMembership) return false;

  const programmeMemberships = await db
    .select()
    .from(programmeMembershipsTable)
    .where(
      and(
        eq(programmeMembershipsTable.programmeVersionId, programmeVersionId),
        eq(programmeMembershipsTable.membershipId, context.institutionMembership.id),
        eq(programmeMembershipsTable.status, "active"),
      ),
    );

  return programmeMemberships.some((membership) => programmeMembershipAllows(membership, action));
}

function programmeMembershipAllows(membership: ProgrammeMembershipRow, action: ProgrammeAccessAction): boolean {
  if (action === "read") return true;
  if (action === "write") return membership.role === "programme_lead" || membership.role === "editor";
  if (action === "manage_team") return membership.role === "programme_lead";
  if (action === "review") {
    return (
      membership.role === "programme_lead" ||
      membership.role === "reviewer" ||
      membership.role === "external_contributor"
    );
  }

  return false;
}

export function requireProgrammeAccess(
  programmeVersionId: string | ((req: Request) => string | undefined),
  action: ProgrammeAccessAction,
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.cast) {
      sendUnauthorized(res);
      return;
    }

    const resolvedProgrammeVersionId =
      typeof programmeVersionId === "function" ? programmeVersionId(req) : programmeVersionId;

    if (!resolvedProgrammeVersionId) {
      sendBadRequest(res, "Programme version id is required");
      return;
    }

    const allowed = await canAccessProgramme(req.cast, resolvedProgrammeVersionId, action);
    auditProgrammeAccessCheck(req, resolvedProgrammeVersionId, action, allowed);

    if (!allowed) {
      sendForbidden(res, "Programme access denied");
      return;
    }

    next();
  };
}

export async function canAccessReview(
  context: CastRequestContext,
  reviewCycleId: string,
  action: ReviewAccessAction,
): Promise<boolean> {
  const [reviewCycle] = await db
    .select({
      id: reviewCyclesTable.id,
      institutionId: reviewCyclesTable.institutionId,
    })
    .from(reviewCyclesTable)
    .where(eq(reviewCyclesTable.id, reviewCycleId))
    .limit(1);

  if (!reviewCycle || reviewCycle.institutionId !== context.selectedInstitutionId) return false;

  if (reviewActionPermissions[action].some((permission) => hasPermission(context, permission))) {
    return true;
  }

  if (!context.institutionMembership) return false;

  const assignments = await db
    .select()
    .from(reviewAssignmentsTable)
    .where(
      and(
        eq(reviewAssignmentsTable.reviewCycleId, reviewCycleId),
        eq(reviewAssignmentsTable.membershipId, context.institutionMembership.id),
        eq(reviewAssignmentsTable.status, "active"),
      ),
    );

  return assignments.some((assignment) => reviewAssignmentAllows(assignment, action));
}

function reviewAssignmentAllows(assignment: ReviewAssignmentRow, action: ReviewAccessAction): boolean {
  if (action === "read") return true;

  if (action === "contribute") {
    return (
      assignment.role === "owner" ||
      assignment.role === "lead" ||
      assignment.role === "contributor" ||
      assignment.role === "reviewer" ||
      assignment.role === "external_reviewer"
    );
  }

  if (action === "manage") {
    return assignment.role === "owner" || assignment.role === "lead" || assignment.role === "approver";
  }

  return false;
}

export function requireReviewAccess(
  reviewCycleId: string | ((req: Request) => string | undefined),
  action: ReviewAccessAction,
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.cast) {
      sendUnauthorized(res);
      return;
    }

    const resolvedReviewCycleId = typeof reviewCycleId === "function" ? reviewCycleId(req) : reviewCycleId;

    if (!resolvedReviewCycleId) {
      sendBadRequest(res, "Review cycle id is required");
      return;
    }

    const allowed = await canAccessReview(req.cast, resolvedReviewCycleId, action);
    auditReviewAccessCheck(req, resolvedReviewCycleId, action, allowed);

    if (!allowed) {
      sendForbidden(res, "Review access denied");
      return;
    }

    next();
  };
}

export function createSystemActorContext(actorIdentifier: string, selectedInstitutionId?: string): CastSystemActorContext {
  return {
    actorType: "system",
    actorIdentifier,
    selectedInstitutionId,
    roleKeys: ["system"],
    effectivePermissions: ["platform.admin"],
  };
}

export function attachSystemActor(actorIdentifier: string, selectedInstitutionId?: string): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.castSystemActor = createSystemActorContext(actorIdentifier, selectedInstitutionId);
    next();
  };
}

export function createWorkerActorContext(actorIdentifier: string, selectedInstitutionId?: string): CastWorkerActorContext {
  return {
    actorType: "worker",
    actorIdentifier,
    selectedInstitutionId,
    roleKeys: ["worker"],
    effectivePermissions: ["worker.manage"],
  };
}

export function attachWorkerActor(actorIdentifier: string, selectedInstitutionId?: string): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.castWorkerActor = createWorkerActorContext(actorIdentifier, selectedInstitutionId);
    next();
  };
}
