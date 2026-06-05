import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { auditActorTypeEnum, auditSubjectTypeEnum } from "./phase2Enums";
import { institutionsTable } from "./phase2Tenancy";
import { usersTable } from "./phase2Access";

export const auditEventsTable = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").references(() => institutionsTable.id, { onDelete: "set null" }),
    actorType: auditActorTypeEnum("actor_type").notNull().default("system"),
    actorUserId: uuid("actor_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    actorIdentifier: text("actor_identifier"),
    actionType: text("action_type").notNull(),
    subjectType: auditSubjectTypeEnum("subject_type").notNull(),
    subjectId: text("subject_id"),
    legacyTable: text("legacy_table"),
    legacyId: text("legacy_id"),
    requestId: text("request_id"),
    ipAddress: text("ip_address"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_events_institution_idx").on(table.institutionId),
    index("audit_events_actor_user_idx").on(table.actorUserId),
    index("audit_events_subject_idx").on(table.subjectType, table.subjectId),
    index("audit_events_legacy_idx").on(table.legacyTable, table.legacyId),
    index("audit_events_created_at_idx").on(table.createdAt),
  ],
);

export type AuditEvent = typeof auditEventsTable.$inferSelect;
export type InsertAuditEvent = typeof auditEventsTable.$inferInsert;
