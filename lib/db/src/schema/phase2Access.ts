import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import {
  membershipStatusEnum,
  roleScopeEnum,
  userStatusEnum,
} from "./phase2Enums";
import { institutionsTable } from "./phase2Tenancy";

export const usersTable = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    displayName: text("display_name"),
    status: userStatusEnum("status").notNull().default("invited"),
    externalSubject: text("external_subject"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email),
    index("users_status_idx").on(table.status),
    index("users_external_subject_idx").on(table.externalSubject),
  ],
);

export const rolesTable = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").references(() => institutionsTable.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    scope: roleScopeEnum("scope").notNull().default("institution"),
    permissions: jsonb("permissions").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("roles_institution_key_unique").on(table.institutionId, table.key),
    uniqueIndex("roles_global_key_unique").on(table.key).where(sql`${table.institutionId} is null`),
    index("roles_scope_idx").on(table.scope),
  ],
);

export const institutionMembershipsTable = pgTable(
  "institution_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    status: membershipStatusEnum("status").notNull().default("invited"),
    title: text("title"),
    department: text("department"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("institution_memberships_institution_user_unique").on(table.institutionId, table.userId),
    index("institution_memberships_user_idx").on(table.userId),
    index("institution_memberships_status_idx").on(table.status),
  ],
);

export const membershipRolesTable = pgTable(
  "membership_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    membershipId: uuid("membership_id").notNull().references(() => institutionMembershipsTable.id, { onDelete: "cascade" }),
    roleId: uuid("role_id").notNull().references(() => rolesTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("membership_roles_membership_role_unique").on(table.membershipId, table.roleId),
    index("membership_roles_role_idx").on(table.roleId),
  ],
);

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
export type Role = typeof rolesTable.$inferSelect;
export type InsertRole = typeof rolesTable.$inferInsert;
export type InstitutionMembership = typeof institutionMembershipsTable.$inferSelect;
export type InsertInstitutionMembership = typeof institutionMembershipsTable.$inferInsert;
export type MembershipRole = typeof membershipRolesTable.$inferSelect;
export type InsertMembershipRole = typeof membershipRolesTable.$inferInsert;
