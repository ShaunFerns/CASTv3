import { desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, ingestionRunsTable } from "@workspace/db";
import { writeRequestAuditEvent } from "../../lib/auditWriter.js";
import {
  requireInstitutionContext,
  requirePermission,
  requireSession,
  resolveCurrentUser,
} from "../../lib/requestContext.js";
import {
  ingestAkariExport,
  ingestManualModule,
  ingestSinglePdfDescriptor,
} from "../../lib/ingestion/service.js";

const router: IRouter = Router();

const protectedIngestion = [
  requireSession(),
  resolveCurrentUser(),
  requireInstitutionContext(),
] as const;

function context(req: Express.Request) {
  if (!req.cast?.selectedInstitutionId) {
    throw new Error("Institution context is required");
  }
  return {
    institutionId: req.cast.selectedInstitutionId,
    actor: {
      userId: req.cast.user.id,
      email: req.cast.user.email,
    },
  };
}

router.get(
  "/ingestion/runs",
  ...protectedIngestion,
  requirePermission("imports.read"),
  async (req, res): Promise<void> => {
    const institutionId = req.cast?.selectedInstitutionId;
    if (!institutionId) {
      res.status(400).json({ error: "institution_context_required" });
      return;
    }

    const runs = await db
      .select()
      .from(ingestionRunsTable)
      .where(eq(ingestionRunsTable.institutionId, institutionId))
      .orderBy(desc(ingestionRunsTable.createdAt))
      .limit(25);

    res.json({ runs });
  },
);

router.post(
  "/ingestion/akari",
  ...protectedIngestion,
  requirePermission("imports.manage"),
  async (req, res): Promise<void> => {
    await writeRequestAuditEvent({
      req,
      actionType: "ingestion.start",
      subjectType: "ingestion_run",
      metadata: { pathway: "akari" },
    });

    const result = await ingestAkariExport(context(req), req.body);

    await writeRequestAuditEvent({
      req,
      actionType: result.status === "failed" ? "ingestion.failure" : "ingestion.success",
      subjectType: "ingestion_run",
      subjectId: result.runId,
      metadata: { pathway: "akari", status: result.status, created: result.created },
    });

    res.status(result.status === "failed" ? 500 : 201).json(result);
  },
);

router.post(
  "/ingestion/pdf",
  ...protectedIngestion,
  requirePermission("curriculum.write"),
  async (req, res): Promise<void> => {
    await writeRequestAuditEvent({
      req,
      actionType: "ingestion.start",
      subjectType: "ingestion_run",
      metadata: { pathway: "single_pdf" },
    });

    const result = await ingestSinglePdfDescriptor(context(req), req.body);

    await writeRequestAuditEvent({
      req,
      actionType: result.status === "failed" ? "ingestion.failure" : "ingestion.success",
      subjectType: "ingestion_run",
      subjectId: result.runId,
      metadata: { pathway: "single_pdf", status: result.status, created: result.created },
    });

    res.status(result.status === "failed" ? 500 : 201).json(result);
  },
);

router.post(
  "/ingestion/manual-module",
  ...protectedIngestion,
  requirePermission("curriculum.write"),
  async (req, res): Promise<void> => {
    await writeRequestAuditEvent({
      req,
      actionType: "ingestion.start",
      subjectType: "ingestion_run",
      metadata: { pathway: "manual_module" },
    });

    const result = await ingestManualModule(context(req), req.body);

    await writeRequestAuditEvent({
      req,
      actionType: result.status === "failed" ? "ingestion.failure" : "ingestion.success",
      subjectType: "ingestion_run",
      subjectId: result.runId,
      metadata: { pathway: "manual_module", status: result.status, created: result.created },
    });

    res.status(result.status === "failed" ? 500 : 201).json(result);
  },
);

export default router;
