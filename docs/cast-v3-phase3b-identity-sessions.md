# CAST v3 Phase 3B-1 Identity and Session Foundation

## Scope

Phase 3B-1 adds the identity, session and programme-team scaffolding needed before tenant-aware API middleware and later RLS hardening.

Implemented scope:

- `users.auth_user_id` for future Supabase Auth or external IdP mapping.
- `app_sessions` for PostgreSQL-backed Express sessions.
- Canonical role and permission registry in code.
- `programme_memberships` for programme team access modelling.

Not implemented in this phase:

- Full RLS policies.
- Direct browser access to CAST v3 tables.
- Workflow migration from legacy prototype tables.
- UI redesign.

## Identity Model

`users.auth_user_id` is the intended canonical link to `auth.users.id` or an equivalent external identity subject represented as a UUID.

`users.external_subject` remains for compatibility until identity provider decisions are final.

Authorization should resolve in this order:

1. Authenticated session.
2. CAST `users` row.
3. Active `institution_memberships` row.
4. `membership_roles` and canonical permissions.
5. Optional `programme_memberships` or `review_assignments`.

## Session Model

The API now stores Express sessions in `app_sessions`.

The session table stores:

- `sid`
- serialized session payload
- expiry timestamp
- optional CAST `user_id`
- revocation timestamp
- metadata and timestamps

The browser continues to use the `cast.sid` HTTP-only cookie. The browser does not receive database credentials and should not directly mutate CAST v3 tables.

## Role Registry

The canonical role and permission registry lives in:

`lib/db/src/security/roleRegistry.ts`

The registry defines stable permission keys and canonical role keys for platform, institution and programme scopes. It is intentionally code-level scaffolding in this phase and does not seed production role rows automatically.

## Programme Memberships

`programme_memberships` links institution memberships to programme versions.

Programme roles:

- `programme_lead`
- `editor`
- `reviewer`
- `viewer`
- `external_contributor`

This provides the foundation for programme-scoped API middleware and external reviewer rules in later Phase 3B work.

## Tenant-Aware API Middleware

Phase 3B-2 adds reusable API middleware in:

`artifacts/api-server/src/lib/requestContext.ts`

The middleware builds a request context containing:

- the Express session
- CAST user
- active institution memberships
- selected institution
- selected institution membership
- role keys
- effective permissions

Middleware provided:

- `requireSession()`
- `resolveCurrentUser()`
- `requireInstitutionContext()`
- `requirePermission(permission)`
- `requireProgrammeAccess(programmeVersionId, action)`
- `requireReviewAccess(reviewCycleId, action)`
- `attachSystemActor(actorIdentifier, institutionId?)`

The selected institution is resolved from `x-cast-institution-id`, request parameters or the session. If a user has multiple active memberships and no institution is selected, protected routes return a safe `400` response.

The middleware is not yet applied broadly to legacy routes. The current diagnostic route is:

`GET /api/security/context`

This route is intentionally small and exists to smoke-test the security foundation without migrating product workflows.

## Audit Writer And Security Events

Phase 3B-3 adds API-side audit infrastructure on top of the Phase 2 `audit_events` table.

Core files:

- `artifacts/api-server/src/lib/requestId.ts`
- `artifacts/api-server/src/lib/auditWriter.ts`
- `artifacts/api-server/src/lib/requestContext.ts`

Every API request receives a correlation ID from the `x-request-id` header or a generated UUID. The API returns the same value in the `x-request-id` response header and stores it on `req.requestId` for logs and audit events.

Audit events use these conventions:

- `actor_type` is one of `user`, `system` or `worker`.
- User actors use `actor_user_id` and may include the user email as `actor_identifier`.
- System and worker actors use `actor_identifier`.
- `institution_id` is taken from the selected institution context when available.
- `request_id` links HTTP logs, API responses and audit rows.
- `action_type` uses dotted names such as `session.login`, `session.logout`, `security.permission_denied`, `programme.access_denied`, `review.access_granted` and `membership.role_change`.
- `subject_type` must use the existing `audit_subject_type` enum.
- `metadata` may contain route, method, status code, permission, access action, strategy and other non-secret context.

The audit writer is fail-safe for API availability: database insert failures are logged server-side and do not replace the original API response with a 500. Security-critical deployments should still monitor audit write failures in production logs.

Reusable helpers:

- `writeAuditEvent(...)`
- `writeRequestAuditEvent(...)`
- `withAudit(...)`
- `auditLoginSessionCreated(...)`
- `auditLogoutSessionRevoked(...)`
- `auditPermissionDenied(...)`
- `auditRoleMembershipChange(...)`
- `auditProgrammeAccessCheck(...)`
- `auditReviewAccessCheck(...)`
- `auditSystemActorAction(...)`

The programme and review access middleware records access-check outcomes when those helpers are used. The helpers are not broadly applied to legacy routes yet.
