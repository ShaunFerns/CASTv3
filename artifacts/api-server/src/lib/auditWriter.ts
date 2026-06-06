import type { Request, RequestHandler, Response } from "express";
import { auditEventsTable, db, type InsertAuditEvent } from "@workspace/db";
import { logger } from "./logger.js";
import type { CastRequestContext, CastSystemActorContext, CastWorkerActorContext } from "./requestContext.js";

export type AuditActorContext = CastRequestContext | CastSystemActorContext | CastWorkerActorContext;

export type AuditSubjectType = InsertAuditEvent["subjectType"];
export type AuditActorType = InsertAuditEvent["actorType"];

export type AuditWriteInput = {
  actor?: AuditActorContext;
  actorType?: AuditActorType;
  actorUserId?: string | null;
  actorIdentifier?: string | null;
  institutionId?: string | null;
  actionType: string;
  subjectType: AuditSubjectType;
  subjectId?: string | null;
  legacyTable?: string | null;
  legacyId?: string | null;
  requestId?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
};

export type AuditRequestOptions = Omit<AuditWriteInput, "requestId" | "ipAddress"> & {
  req: Request;
};

export type WithAuditOptions = Omit<AuditWriteInput, "requestId" | "ipAddress"> | ((req: Request, res: Response) => Omit<AuditWriteInput, "requestId" | "ipAddress">);

function actorFromRequest(req: Request): AuditActorContext | undefined {
  return req.cast ?? req.castSystemActor ?? req.castWorkerActor;
}

function actorFields(actor: AuditActorContext | undefined): Pick<InsertAuditEvent, "actorType" | "actorUserId" | "actorIdentifier" | "institutionId"> {
  if (!actor) {
    return {
      actorType: "system",
      actorUserId: null,
      actorIdentifier: "anonymous_request",
      institutionId: null,
    };
  }

  if (actor.actorType === "user") {
    return {
      actorType: "user",
      actorUserId: actor.user.id,
      actorIdentifier: actor.actorIdentifier ?? actor.user.email,
      institutionId: actor.selectedInstitutionId ?? null,
    };
  }

  return {
    actorType: actor.actorType,
    actorUserId: null,
    actorIdentifier: actor.actorIdentifier,
    institutionId: actor.selectedInstitutionId ?? null,
  };
}

function normaliseMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
  return metadata ?? {};
}

export async function writeAuditEvent(input: AuditWriteInput): Promise<void> {
  const actorDefaults = actorFields(input.actor);

  const event: InsertAuditEvent = {
    institutionId: input.institutionId ?? actorDefaults.institutionId,
    actorType: input.actorType ?? actorDefaults.actorType,
    actorUserId: input.actorUserId ?? actorDefaults.actorUserId,
    actorIdentifier: input.actorIdentifier ?? actorDefaults.actorIdentifier,
    actionType: input.actionType,
    subjectType: input.subjectType,
    subjectId: input.subjectId ?? null,
    legacyTable: input.legacyTable ?? null,
    legacyId: input.legacyId ?? null,
    requestId: input.requestId ?? null,
    ipAddress: input.ipAddress ?? null,
    metadata: normaliseMetadata(input.metadata),
  };

  try {
    await db.insert(auditEventsTable).values(event);
  } catch (error) {
    logger.warn({ err: error, actionType: input.actionType, subjectType: input.subjectType }, "Failed to write audit event");
  }
}

export async function writeRequestAuditEvent({ req, ...input }: AuditRequestOptions): Promise<void> {
  await writeAuditEvent({
    actor: input.actor ?? actorFromRequest(req),
    ...input,
    requestId: req.requestId,
    ipAddress: req.ip,
  });
}

export function writeRequestAuditEventSoon(options: AuditRequestOptions): void {
  void writeRequestAuditEvent(options);
}

export function withAudit(options: WithAuditOptions): RequestHandler {
  return (req, res, next): void => {
    res.on("finish", () => {
      const resolved = typeof options === "function" ? options(req, res) : options;
      writeRequestAuditEventSoon({
        req,
        ...resolved,
        metadata: {
          ...(resolved.metadata ?? {}),
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
        },
      });
    });

    next();
  };
}

export function auditLoginSessionCreated(req: Request, metadata?: Record<string, unknown>): void {
  writeRequestAuditEventSoon({
    req,
    actorType: "system",
    actorIdentifier: "legacy_admin_login",
    actionType: "session.login",
    subjectType: "app_session",
    subjectId: req.sessionID,
    metadata,
  });
}

export function auditLogoutSessionRevoked(req: Request, sessionId: string | undefined, metadata?: Record<string, unknown>): void {
  writeRequestAuditEventSoon({
    req,
    actionType: "session.logout",
    subjectType: "app_session",
    subjectId: sessionId,
    metadata,
  });
}

export function auditPermissionDenied(req: Request, permission: string, metadata?: Record<string, unknown>): void {
  writeRequestAuditEventSoon({
    req,
    actionType: "security.permission_denied",
    subjectType: "user",
    subjectId: req.cast?.user.id,
    metadata: {
      permission,
      path: req.path,
      method: req.method,
      ...metadata,
    },
  });
}

export function auditRoleMembershipChange(
  actor: AuditActorContext,
  subjectType: "user" | "programme_membership",
  subjectId: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  return writeAuditEvent({
    actor,
    actionType: "membership.role_change",
    subjectType,
    subjectId,
    metadata,
  });
}

export function auditProgrammeAccessCheck(
  req: Request,
  programmeVersionId: string,
  action: string,
  allowed: boolean,
  metadata?: Record<string, unknown>,
): void {
  writeRequestAuditEventSoon({
    req,
    actionType: allowed ? "programme.access_granted" : "programme.access_denied",
    subjectType: "programme_version",
    subjectId: programmeVersionId,
    metadata: {
      action,
      allowed,
      ...metadata,
    },
  });
}

export function auditReviewAccessCheck(
  req: Request,
  reviewCycleId: string,
  action: string,
  allowed: boolean,
  metadata?: Record<string, unknown>,
): void {
  writeRequestAuditEventSoon({
    req,
    actionType: allowed ? "review.access_granted" : "review.access_denied",
    subjectType: "review_cycle",
    subjectId: reviewCycleId,
    metadata: {
      action,
      allowed,
      ...metadata,
    },
  });
}

export function auditSystemActorAction(
  actor: CastSystemActorContext | CastWorkerActorContext,
  actionType: string,
  subjectType: AuditSubjectType,
  subjectId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  return writeAuditEvent({
    actor,
    actionType,
    subjectType,
    subjectId,
    metadata,
  });
}
