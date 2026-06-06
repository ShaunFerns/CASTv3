import type { Request } from "express";
import { and, eq } from "drizzle-orm";
import {
  canonicalRoles,
  db,
  institutionMembershipsTable,
  institutionsTable,
  membershipRolesTable,
  rolesTable,
  usersTable,
} from "@workspace/db";

export type PreviewBridgeSession = {
  enabled: true;
  institutionId: string;
  userId: string;
  membershipId: string;
  roleId: string;
  roleKey: string;
};

const previewRoleKey = "institution_admin";
const previewBridgePermissions = [
  "imports.read",
  "programme.read",
  "programme.write",
  "data_quality.read",
] as const;

function enabledFlag(): boolean {
  return process.env.CAST_V3_PREVIEW_BRIDGE === "true";
}

export function isPreviewBridgeEnabled(): boolean {
  return enabledFlag() && process.env.NODE_ENV !== "production";
}

function previewInstitutionSlug(): string {
  return process.env.CAST_V3_PREVIEW_INSTITUTION_SLUG ?? "cast-preview";
}

function previewInstitutionName(): string {
  return process.env.CAST_V3_PREVIEW_INSTITUTION_NAME ?? "CAST Preview Institution";
}

function previewUserEmail(): string {
  return process.env.CAST_V3_PREVIEW_USER_EMAIL ?? "preview-admin@cast.local";
}

function previewUserName(): string {
  return process.env.CAST_V3_PREVIEW_USER_NAME ?? "CAST Preview Admin";
}

async function ensureInstitution(): Promise<typeof institutionsTable.$inferSelect> {
  const slug = previewInstitutionSlug();
  const [existing] = await db.select().from(institutionsTable).where(eq(institutionsTable.slug, slug)).limit(1);
  if (existing) {
    if (existing.status === "active") return existing;
    const [updated] = await db
      .update(institutionsTable)
      .set({ status: "active" })
      .where(eq(institutionsTable.id, existing.id))
      .returning();
    return updated ?? existing;
  }

  const [created] = await db
    .insert(institutionsTable)
    .values({
      slug,
      name: previewInstitutionName(),
      status: "active",
      settings: {
        previewBridge: true,
      },
    })
    .returning();

  if (!created) throw new Error("Failed to create preview institution");
  return created;
}

async function ensureUser(): Promise<typeof usersTable.$inferSelect> {
  const email = previewUserEmail();
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing) {
    if (existing.status === "active") return existing;
    const [updated] = await db
      .update(usersTable)
      .set({ status: "active" })
      .where(eq(usersTable.id, existing.id))
      .returning();
    return updated ?? existing;
  }

  const [created] = await db
    .insert(usersTable)
    .values({
      email,
      displayName: previewUserName(),
      status: "active",
      externalSubject: "preview-bridge",
      metadata: {
        previewBridge: true,
      },
    })
    .returning();

  if (!created) throw new Error("Failed to create preview user");
  return created;
}

async function ensureInstitutionRole(institutionId: string): Promise<typeof rolesTable.$inferSelect> {
  const roleDefinition = canonicalRoles.find((role) => role.key === previewRoleKey);
  if (!roleDefinition) throw new Error(`Canonical role not found: ${previewRoleKey}`);
  const permissions = [...new Set([...roleDefinition.permissions, ...previewBridgePermissions])].sort();

  const [existing] = await db
    .select()
    .from(rolesTable)
    .where(and(eq(rolesTable.institutionId, institutionId), eq(rolesTable.key, roleDefinition.key)))
    .limit(1);
  if (existing) {
    const [updated] = await db
      .update(rolesTable)
      .set({
        name: roleDefinition.name,
        description: `${roleDefinition.description} Seeded for CAST v3 preview bridge access.`,
        scope: roleDefinition.scope,
        permissions: {
          permissions,
          previewBridge: true,
        },
      })
      .where(eq(rolesTable.id, existing.id))
      .returning();
    return updated ?? existing;
  }

  const [created] = await db
    .insert(rolesTable)
    .values({
      institutionId,
      key: roleDefinition.key,
      name: roleDefinition.name,
      description: `${roleDefinition.description} Seeded for CAST v3 preview bridge access.`,
      scope: roleDefinition.scope,
      permissions: {
        permissions,
        previewBridge: true,
      },
    })
    .returning();

  if (!created) throw new Error("Failed to create preview role");
  return created;
}

async function ensureMembership(
  institutionId: string,
  userId: string,
): Promise<typeof institutionMembershipsTable.$inferSelect> {
  const [existing] = await db
    .select()
    .from(institutionMembershipsTable)
    .where(
      and(
        eq(institutionMembershipsTable.institutionId, institutionId),
        eq(institutionMembershipsTable.userId, userId),
      ),
    )
    .limit(1);
  if (existing) {
    if (existing.status === "active") return existing;
    const [updated] = await db
      .update(institutionMembershipsTable)
      .set({ status: "active" })
      .where(eq(institutionMembershipsTable.id, existing.id))
      .returning();
    return updated ?? existing;
  }

  const [created] = await db
    .insert(institutionMembershipsTable)
    .values({
      institutionId,
      userId,
      status: "active",
      title: "CAST v3 Preview Admin",
      department: "Preview",
    })
    .returning();

  if (!created) throw new Error("Failed to create preview membership");
  return created;
}

async function ensureMembershipRole(membershipId: string, roleId: string): Promise<void> {
  const [existing] = await db
    .select({ id: membershipRolesTable.id })
    .from(membershipRolesTable)
    .where(and(eq(membershipRolesTable.membershipId, membershipId), eq(membershipRolesTable.roleId, roleId)))
    .limit(1);
  if (existing) return;

  await db.insert(membershipRolesTable).values({ membershipId, roleId });
}

export async function applyPreviewBridgeSession(req: Request): Promise<PreviewBridgeSession | undefined> {
  if (!isPreviewBridgeEnabled()) return undefined;

  const institution = await ensureInstitution();
  const user = await ensureUser();
  const role = await ensureInstitutionRole(institution.id);
  const membership = await ensureMembership(institution.id, user.id);
  await ensureMembershipRole(membership.id, role.id);

  req.session.castUserId = user.id;
  req.session.selectedInstitutionId = institution.id;

  return {
    enabled: true,
    institutionId: institution.id,
    userId: user.id,
    membershipId: membership.id,
    roleId: role.id,
    roleKey: role.key,
  };
}
