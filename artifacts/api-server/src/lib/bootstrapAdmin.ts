import type { Request } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  canonicalRoles,
  db,
  institutionMembershipsTable,
  institutionsTable,
  membershipRolesTable,
  rolesTable,
  usersTable,
  type CanonicalPermission,
} from "@workspace/db";

export type BootstrapAdminSession = {
  institutionId: string;
  userId: string;
  membershipId: string;
  roleId: string;
  roleKey: string;
};

const bootstrapRoleKey = "institution_admin";
const bootstrapPermissions = [
  "imports.read",
  "programme.read",
  "programme.write",
  "data_quality.read",
] as const satisfies readonly CanonicalPermission[];

type BootstrapAdminConfig = {
  email: string;
  name: string;
  password: string;
  institutionName: string;
  institutionSlug: string;
};

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function isStrongPassword(password: string): boolean {
  return (
    password.length >= 16 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

function isStrongSessionSecret(secret: string | undefined): boolean {
  const unsafeSecrets = new Set([
    "cast-dev-secret-change-in-production",
    "change-me",
    "replace-me",
    "local-development-secret-change-me-32chars",
  ]);
  return Boolean(secret && secret.length >= 32 && !unsafeSecrets.has(secret));
}

function missingConfigError(missing: string[]): Error {
  return new Error(`CAST v3 bootstrap admin configuration is missing: ${missing.join(", ")}`);
}

export function bootstrapAdminConfig(): BootstrapAdminConfig {
  const config = {
    email: env("CAST_BOOTSTRAP_ADMIN_EMAIL"),
    name: env("CAST_BOOTSTRAP_ADMIN_NAME"),
    password: env("CAST_BOOTSTRAP_ADMIN_PASSWORD"),
    institutionName: env("CAST_BOOTSTRAP_INSTITUTION_NAME"),
    institutionSlug: env("CAST_BOOTSTRAP_INSTITUTION_SLUG"),
  };

  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw missingConfigError(missing);
  }

  return {
    email: config.email!.toLowerCase(),
    name: config.name!,
    password: config.password!,
    institutionName: config.institutionName!,
    institutionSlug: config.institutionSlug!,
  };
}

export function validateProductionBootstrapAdminConfig(): void {
  if (process.env.NODE_ENV !== "production") return;

  const config = bootstrapAdminConfig();
  if (!isStrongPassword(config.password)) {
    throw new Error(
      "CAST_BOOTSTRAP_ADMIN_PASSWORD must be at least 16 characters and include uppercase, lowercase, number and symbol characters in production.",
    );
  }

  if (!isStrongSessionSecret(process.env.SESSION_SECRET)) {
    throw new Error("SESSION_SECRET must be set to a strong value of at least 32 characters in production.");
  }
}

function safePasswordMatches(candidate: string, expected: string): boolean {
  const candidateHash = createHash("sha256").update(candidate).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(candidateHash, expectedHash);
}

export function authenticateBootstrapAdmin(email: string | undefined, password: string | undefined): BootstrapAdminConfig {
  const config = bootstrapAdminConfig();
  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  if (email.trim().toLowerCase() !== config.email || !safePasswordMatches(password, config.password)) {
    throw new Error("Invalid CAST v3 bootstrap credentials");
  }

  return config;
}

async function ensureInstitution(config: BootstrapAdminConfig): Promise<typeof institutionsTable.$inferSelect> {
  const [existing] = await db
    .select()
    .from(institutionsTable)
    .where(eq(institutionsTable.slug, config.institutionSlug))
    .limit(1);

  if (existing) {
    if (existing.status === "active") return existing;
    const [updated] = await db
      .update(institutionsTable)
      .set({ status: "active", name: config.institutionName })
      .where(eq(institutionsTable.id, existing.id))
      .returning();
    return updated ?? existing;
  }

  const [created] = await db
    .insert(institutionsTable)
    .values({
      slug: config.institutionSlug,
      name: config.institutionName,
      status: "active",
      settings: {
        bootstrapAccess: true,
      },
    })
    .returning();

  if (!created) throw new Error("Failed to create bootstrap institution");
  return created;
}

async function ensureUser(config: BootstrapAdminConfig): Promise<typeof usersTable.$inferSelect> {
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, config.email)).limit(1);
  if (existing) {
    const [updated] = await db
      .update(usersTable)
      .set({
        displayName: config.name,
        status: "active",
        externalSubject: existing.externalSubject ?? "bootstrap-admin",
        metadata: {
          ...(existing.metadata ?? {}),
          bootstrapAdmin: true,
        },
      })
      .where(eq(usersTable.id, existing.id))
      .returning();
    return updated ?? existing;
  }

  const [created] = await db
    .insert(usersTable)
    .values({
      email: config.email,
      displayName: config.name,
      status: "active",
      externalSubject: "bootstrap-admin",
      metadata: {
        bootstrapAdmin: true,
      },
    })
    .returning();

  if (!created) throw new Error("Failed to create bootstrap user");
  return created;
}

async function ensureInstitutionRole(institutionId: string): Promise<typeof rolesTable.$inferSelect> {
  const roleDefinition = canonicalRoles.find((role) => role.key === bootstrapRoleKey);
  if (!roleDefinition) throw new Error(`Canonical role not found: ${bootstrapRoleKey}`);

  const permissions = [...new Set([...roleDefinition.permissions, ...bootstrapPermissions])].sort();

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
        description: `${roleDefinition.description} Seeded for CAST v3 bootstrap admin access.`,
        scope: roleDefinition.scope,
        permissions: {
          permissions,
          bootstrapAccess: true,
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
      description: `${roleDefinition.description} Seeded for CAST v3 bootstrap admin access.`,
      scope: roleDefinition.scope,
      permissions: {
        permissions,
        bootstrapAccess: true,
      },
    })
    .returning();

  if (!created) throw new Error("Failed to create bootstrap role");
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
      .set({ status: "active", title: "CAST v3 Bootstrap Admin" })
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
      title: "CAST v3 Bootstrap Admin",
      department: "Administration",
    })
    .returning();

  if (!created) throw new Error("Failed to create bootstrap membership");
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

export async function createBootstrapAdminSession(req: Request, config: BootstrapAdminConfig): Promise<BootstrapAdminSession> {
  const institution = await ensureInstitution(config);
  const user = await ensureUser(config);
  const role = await ensureInstitutionRole(institution.id);
  const membership = await ensureMembership(institution.id, user.id);
  await ensureMembershipRole(membership.id, role.id);

  req.session.castUserId = user.id;
  req.session.selectedInstitutionId = institution.id;
  req.session.authStrategy = "bootstrap_admin";

  return {
    institutionId: institution.id,
    userId: user.id,
    membershipId: membership.id,
    roleId: role.id,
    roleKey: role.key,
  };
}
