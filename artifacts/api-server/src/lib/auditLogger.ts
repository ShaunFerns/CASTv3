import type { Request } from "express";
import { db, auditLogsTable } from "@workspace/db";

export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress ?? "unknown";
}

export type AuditAction =
  | "module_create"
  | "module_batch_import"
  | "module_update"
  | "module_delete"
  | "module_classify"
  | "module_score"
  | "module_extract_fields"
  | "module_analyze_free_elective"
  | "module_parse_pdf"
  | "module_parse_excel"
  | "structure_cache_clear"
  | "structure_embeddings_generate"
  | "programme_create"
  | "programme_update"
  | "programme_delete"
  | "programme_module_add"
  | "programme_module_remove"
  | "programme_module_update"
  | "programme_modules_reorder"
  | "programme_classifications_save"
  | "programme_auto_classify"
  | "programme_parse_structure"
  | "catalogue_classification_update"
  | "catalogue_batch_classify"
  | "csv_import";

interface AuditOptions {
  moduleId?: number;
  modulesAffected?: number;
  lens?: string;
  ipAddress?: string;
  details?: Record<string, unknown>;
}

export async function logAudit(action: AuditAction, options: AuditOptions = {}): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      actor: "admin",
      actionType: action,
      moduleId: options.moduleId ?? null,
      modulesAffected: options.modulesAffected ?? null,
      lens: options.lens ?? null,
      ipAddress: options.ipAddress ?? null,
      details: options.details ? JSON.stringify(options.details) : null,
    });
  } catch (err) {
    console.error("[audit]", err);
  }
}
