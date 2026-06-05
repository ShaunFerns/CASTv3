import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { institutionStatusEnum } from "./phase2Enums";

export const institutionsTable = pgTable(
  "institutions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    status: institutionStatusEnum("status").notNull().default("active"),
    countryCode: text("country_code"),
    timezone: text("timezone").notNull().default("UTC"),
    settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("institutions_slug_unique").on(table.slug),
    index("institutions_status_idx").on(table.status),
  ],
);

export type Institution = typeof institutionsTable.$inferSelect;
export type InsertInstitution = typeof institutionsTable.$inferInsert;
