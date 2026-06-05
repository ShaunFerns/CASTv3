import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import {
  programmeMapCellStatusEnum,
  programmeMapExportFormatEnum,
  programmeMapLayerTypeEnum,
  programmeMapStatusEnum,
} from "./phase2Enums";
import { lensVersionsTable, lensesTable } from "./phase2Lenses";
import { institutionsTable } from "./phase2Tenancy";
import { usersTable } from "./phase2Access";
import { programmeVersionsTable } from "./phase2Curriculum";

export const programmeMapsTable = pgTable(
  "programme_maps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id").notNull().references(() => institutionsTable.id, { onDelete: "cascade" }),
    legacyProgrammeId: integer("legacy_programme_id"),
    programmeVersionId: uuid("programme_version_id").references(() => programmeVersionsTable.id, { onDelete: "set null" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    status: programmeMapStatusEnum("status").notNull().default("draft"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: uuid("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("programme_maps_institution_key_unique").on(table.institutionId, table.key),
    index("programme_maps_institution_idx").on(table.institutionId),
    index("programme_maps_legacy_programme_idx").on(table.legacyProgrammeId),
    index("programme_maps_programme_version_idx").on(table.programmeVersionId),
    index("programme_maps_status_idx").on(table.status),
  ],
);

export const programmeMapVersionsTable = pgTable(
  "programme_map_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programmeMapId: uuid("programme_map_id").notNull().references(() => programmeMapsTable.id, { onDelete: "cascade" }),
    versionLabel: text("version_label").notNull(),
    status: programmeMapStatusEnum("status").notNull().default("draft"),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: uuid("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("programme_map_versions_map_label_unique").on(table.programmeMapId, table.versionLabel),
    index("programme_map_versions_map_idx").on(table.programmeMapId),
    index("programme_map_versions_status_idx").on(table.status),
  ],
);

export const programmeMapLayersTable = pgTable(
  "programme_map_layers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programmeMapVersionId: uuid("programme_map_version_id").notNull().references(() => programmeMapVersionsTable.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    layerType: programmeMapLayerTypeEnum("layer_type").notNull(),
    lensId: uuid("lens_id").references(() => lensesTable.id, { onDelete: "set null" }),
    lensVersionId: uuid("lens_version_id").references(() => lensVersionsTable.id, { onDelete: "set null" }),
    orderIndex: integer("order_index").notNull().default(0),
    configuration: jsonb("configuration").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("programme_map_layers_version_key_unique").on(table.programmeMapVersionId, table.key),
    index("programme_map_layers_version_idx").on(table.programmeMapVersionId),
    index("programme_map_layers_lens_idx").on(table.lensId),
    index("programme_map_layers_type_idx").on(table.layerType),
  ],
);

export const programmeMapLayerSourcesTable = pgTable(
  "programme_map_layer_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programmeMapLayerId: uuid("programme_map_layer_id").notNull().references(() => programmeMapLayersTable.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    configuration: jsonb("configuration").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("programme_map_layer_sources_unique").on(table.programmeMapLayerId, table.sourceType, table.sourceId),
    index("programme_map_layer_sources_source_idx").on(table.sourceType, table.sourceId),
  ],
);

export const programmeMapCellsTable = pgTable(
  "programme_map_cells",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programmeMapLayerId: uuid("programme_map_layer_id").notNull().references(() => programmeMapLayersTable.id, { onDelete: "cascade" }),
    rowKey: text("row_key").notNull(),
    columnKey: text("column_key").notNull(),
    subjectType: text("subject_type"),
    subjectId: text("subject_id"),
    value: jsonb("value").$type<Record<string, unknown>>().notNull().default({}),
    status: programmeMapCellStatusEnum("status").notNull().default("draft"),
    evidenceSummary: text("evidence_summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("programme_map_cells_layer_position_unique").on(table.programmeMapLayerId, table.rowKey, table.columnKey, table.subjectType, table.subjectId),
    index("programme_map_cells_layer_idx").on(table.programmeMapLayerId),
    index("programme_map_cells_subject_idx").on(table.subjectType, table.subjectId),
    index("programme_map_cells_status_idx").on(table.status),
  ],
);

export const programmeMapAnnotationsTable = pgTable(
  "programme_map_annotations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programmeMapVersionId: uuid("programme_map_version_id").notNull().references(() => programmeMapVersionsTable.id, { onDelete: "cascade" }),
    programmeMapCellId: uuid("programme_map_cell_id").references(() => programmeMapCellsTable.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    annotationType: text("annotation_type").notNull().default("note"),
    body: text("body").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("programme_map_annotations_version_idx").on(table.programmeMapVersionId),
    index("programme_map_annotations_cell_idx").on(table.programmeMapCellId),
  ],
);

export const programmeMapExportsTable = pgTable(
  "programme_map_exports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programmeMapVersionId: uuid("programme_map_version_id").notNull().references(() => programmeMapVersionsTable.id, { onDelete: "cascade" }),
    requestedByUserId: uuid("requested_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    format: programmeMapExportFormatEnum("format").notNull(),
    storageKey: text("storage_key"),
    status: text("status").notNull().default("pending"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("programme_map_exports_version_idx").on(table.programmeMapVersionId),
    index("programme_map_exports_status_idx").on(table.status),
  ],
);

export type ProgrammeMap = typeof programmeMapsTable.$inferSelect;
export type InsertProgrammeMap = typeof programmeMapsTable.$inferInsert;
export type ProgrammeMapVersion = typeof programmeMapVersionsTable.$inferSelect;
export type InsertProgrammeMapVersion = typeof programmeMapVersionsTable.$inferInsert;
export type ProgrammeMapLayer = typeof programmeMapLayersTable.$inferSelect;
export type InsertProgrammeMapLayer = typeof programmeMapLayersTable.$inferInsert;
export type ProgrammeMapLayerSource = typeof programmeMapLayerSourcesTable.$inferSelect;
export type InsertProgrammeMapLayerSource = typeof programmeMapLayerSourcesTable.$inferInsert;
export type ProgrammeMapCell = typeof programmeMapCellsTable.$inferSelect;
export type InsertProgrammeMapCell = typeof programmeMapCellsTable.$inferInsert;
export type ProgrammeMapAnnotation = typeof programmeMapAnnotationsTable.$inferSelect;
export type InsertProgrammeMapAnnotation = typeof programmeMapAnnotationsTable.$inferInsert;
export type ProgrammeMapExport = typeof programmeMapExportsTable.$inferSelect;
export type InsertProgrammeMapExport = typeof programmeMapExportsTable.$inferInsert;
