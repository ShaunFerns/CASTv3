import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actor: text("actor").notNull().default("admin"),
  actionType: text("action_type").notNull(),
  moduleId: integer("module_id"),
  modulesAffected: integer("modules_affected"),
  lens: text("lens"),
  ipAddress: text("ip_address"),
  details: text("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
