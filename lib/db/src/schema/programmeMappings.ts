import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const programmesTable = pgTable("programmes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const programmeModulesTable = pgTable("programme_modules", {
  id: serial("id").primaryKey(),
  programmeId: integer("programme_id").notNull(),
  moduleId: integer("module_id").notNull(),
  stage: text("stage"),
  semester: text("semester"),
  coreOption: text("core_option"),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const gaClassificationsTable = pgTable("ga_classifications", {
  id: serial("id").primaryKey(),
  programmeId: integer("programme_id"),
  moduleId: integer("module_id").notNull(),
  lens: text("lens").notNull().default("ga"),
  domain: text("domain").notNull(),
  level: text("level").notNull().default("None"),
  source: text("source").notNull().default("user"),
  rationale: text("rationale"),
  evidence: text("evidence"),
});

export type Programme = typeof programmesTable.$inferSelect;
export type ProgrammeModule = typeof programmeModulesTable.$inferSelect;
export type GaClassification = typeof gaClassificationsTable.$inferSelect;
