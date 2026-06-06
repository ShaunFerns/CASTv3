import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import {
  institutionMembershipsTable,
  usersTable,
} from "./phase2Access";
import { programmeVersionsTable } from "./phase2Curriculum";
import {
  programmeMembershipRoleEnum,
  programmeMembershipStatusEnum,
} from "./phase2Enums";
import { institutionsTable } from "./phase2Tenancy";

export const programmeMembershipsTable = pgTable(
  "programme_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    programmeVersionId: uuid("programme_version_id").notNull().references(() => programmeVersionsTable.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id").notNull().references(() => institutionMembershipsTable.id, { onDelete: "cascade" }),
    role: programmeMembershipRoleEnum("role").notNull(),
    status: programmeMembershipStatusEnum("status").notNull().default("invited"),
    responsibilities: text("responsibilities"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: uuid("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("programme_memberships_programme_membership_role_unique").on(
      table.programmeVersionId,
      table.membershipId,
      table.role,
    ),
    index("programme_memberships_institution_idx").on(table.institutionId),
    index("programme_memberships_programme_idx").on(table.programmeVersionId),
    index("programme_memberships_membership_idx").on(table.membershipId),
    index("programme_memberships_role_status_idx").on(table.role, table.status),
    index("programme_memberships_expires_at_idx").on(table.expiresAt),
  ],
);

export type ProgrammeMembership = typeof programmeMembershipsTable.$inferSelect;
export type InsertProgrammeMembership = typeof programmeMembershipsTable.$inferInsert;
