import { Router, type IRouter, type Request } from "express";
import { writeRequestAuditEvent } from "../../lib/auditWriter.js";
import {
  requireInstitutionContext,
  requirePermission,
  requireSession,
  resolveCurrentUser,
} from "../../lib/requestContext.js";
import {
  getAvailableLayers,
  getCoverageSummary,
  createDigCompEvaluation,
  createEntreCompEvaluation,
  createProgrammeMapAnnotation,
  createProgrammeMapExport,
  createProgrammeMapSnapshot,
  createFrameworkCompetencyExpectation,
  createGreenCompEvaluation,
  createLifeCompEvaluation,
  createProgrammeAttributeExpectation,
  createProgrammeGraduateAttribute,
  getDigCompCoverageSummary,
  getEntreCompCoverageSummary,
  getFrameworkCoverageSummaryByKey,
  getFrameworkExpectationAnalysis,
  getFrameworkFamilies,
  getFrameworkRegistry,
  getGreenCompCoverageSummary,
  getLifeCompCoverageSummary,
  listProgrammeMapAnnotations,
  listProgrammeMapExports,
  listProgrammeMapSnapshots,
  getProgrammeOwnedFramework,
  getProgrammeMapMetadata,
  getProgrammeMapProjection,
} from "../../lib/programmeMap/service.js";
import {
  assessmentDesignSummary,
  materialiseAssessmentDesignLayer,
  materialiseModalityDesignLayer,
  modalityDesignSummary,
} from "../../lib/curriculumDesignLayers/service.js";

const router: IRouter = Router();

const protectedProgrammeMap = [
  requireSession(),
  resolveCurrentUser(),
  requireInstitutionContext(),
] as const;

function context(req: Request) {
  if (!req.cast?.selectedInstitutionId) throw new Error("Institution context is required");
  return {
    institutionId: req.cast.selectedInstitutionId,
    userId: req.cast.user.id,
  };
}

function idParam(req: Request, name: string): string {
  const value = req.params[name];
  const resolved = Array.isArray(value) ? value[0] : value;
  if (!resolved) throw new Error(`${name} is required`);
  return resolved;
}

function layerKeys(req: Request): string[] {
  const raw = req.query["layers"];
  const value = Array.isArray(raw) ? raw.join(",") : raw;
  if (typeof value !== "string" || value.trim().length === 0) return [];
  return value.split(",").map((layer) => layer.trim()).filter(Boolean);
}

function analysisStatus(req: Request): "all" | "provisional" | "reviewed" {
  const raw = req.query["analysisStatus"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "provisional" || value === "reviewed" ? value : "all";
}

router.get(
  "/programme-map/framework-families",
  ...protectedProgrammeMap,
  requirePermission("programme.read"),
  async (_req, res): Promise<void> => {
    res.json(await getFrameworkFamilies());
  },
);

router.get(
  "/programme-map/programme-versions/:programmeVersionId/frameworks",
  ...protectedProgrammeMap,
  requirePermission("programme.read"),
  async (req, res): Promise<void> => {
    res.json(await getFrameworkRegistry(context(req), idParam(req, "programmeVersionId")));
  },
);

router.get(
  "/programme-map/programme-versions/:programmeVersionId/layers",
  ...protectedProgrammeMap,
  requirePermission("programme.read"),
  async (req, res): Promise<void> => {
    res.json(await getAvailableLayers(context(req), idParam(req, "programmeVersionId")));
  },
);

router.get(
  "/programme-map/programme-versions/:programmeVersionId/metadata",
  ...protectedProgrammeMap,
  requirePermission("programme.read"),
  async (req, res): Promise<void> => {
    res.json(await getProgrammeMapMetadata(context(req), idParam(req, "programmeVersionId")));
  },
);

router.get(
  "/programme-map/programme-versions/:programmeVersionId/coverage-summary",
  ...protectedProgrammeMap,
  requirePermission("programme.read"),
  async (req, res): Promise<void> => {
    res.json(await getCoverageSummary(context(req), idParam(req, "programmeVersionId")));
  },
);

router.get(
  "/programme-map/programme-versions/:programmeVersionId/annotations",
  ...protectedProgrammeMap,
  requirePermission("programme.read"),
  async (req, res): Promise<void> => {
    res.json(await listProgrammeMapAnnotations(context(req), idParam(req, "programmeVersionId")));
  },
);

router.post(
  "/programme-map/programme-versions/:programmeVersionId/annotations",
  ...protectedProgrammeMap,
  requirePermission("programme.write"),
  async (req, res): Promise<void> => {
    const programmeVersionId = idParam(req, "programmeVersionId");
    const result = await createProgrammeMapAnnotation(context(req), programmeVersionId, req.body);
    await writeRequestAuditEvent({
      req,
      actionType: "programme_map.annotation_created",
      subjectType: "programme_map",
      subjectId: result.map.id,
      metadata: {
        programmeVersionId,
        annotationId: result.annotation.id,
        annotationType: result.annotation.annotationType,
      },
    });
    res.status(201).json(result);
  },
);

router.get(
  "/programme-map/programme-versions/:programmeVersionId/snapshots",
  ...protectedProgrammeMap,
  requirePermission("programme.read"),
  async (req, res): Promise<void> => {
    res.json(await listProgrammeMapSnapshots(context(req), idParam(req, "programmeVersionId")));
  },
);

router.post(
  "/programme-map/programme-versions/:programmeVersionId/snapshots",
  ...protectedProgrammeMap,
  requirePermission("programme.write"),
  async (req, res): Promise<void> => {
    const programmeVersionId = idParam(req, "programmeVersionId");
    const result = await createProgrammeMapSnapshot(context(req), programmeVersionId, req.body);
    await writeRequestAuditEvent({
      req,
      actionType: "programme_map.snapshot_created",
      subjectType: "programme_map",
      subjectId: result.map.id,
      metadata: {
        programmeVersionId,
        snapshotId: result.snapshot.id,
        versionLabel: result.snapshot.versionLabel,
      },
    });
    res.status(201).json(result);
  },
);

router.get(
  "/programme-map/programme-versions/:programmeVersionId/exports",
  ...protectedProgrammeMap,
  requirePermission("programme.read"),
  async (req, res): Promise<void> => {
    res.json(await listProgrammeMapExports(context(req), idParam(req, "programmeVersionId")));
  },
);

router.post(
  "/programme-map/programme-versions/:programmeVersionId/exports",
  ...protectedProgrammeMap,
  requirePermission("programme.read"),
  async (req, res): Promise<void> => {
    const programmeVersionId = idParam(req, "programmeVersionId");
    const result = await createProgrammeMapExport(context(req), programmeVersionId, req.body);
    await writeRequestAuditEvent({
      req,
      actionType: "programme_map.export_created",
      subjectType: "programme_map",
      subjectId: result.map.id,
      metadata: {
        programmeVersionId,
        exportId: result.export.id,
        format: result.export.format,
        inlineExport: true,
      },
    });
    res.status(201).json(result);
  },
);

router.get(
  "/programme-map/programme-versions/:programmeVersionId/greencomp/coverage-summary",
  ...protectedProgrammeMap,
  requirePermission("programme.read"),
  async (req, res): Promise<void> => {
    res.json(await getGreenCompCoverageSummary(context(req), idParam(req, "programmeVersionId"), analysisStatus(req)));
  },
);

router.get(
  "/programme-map/programme-versions/:programmeVersionId/lifecomp/coverage-summary",
  ...protectedProgrammeMap,
  requirePermission("programme.read"),
  async (req, res): Promise<void> => {
    res.json(await getLifeCompCoverageSummary(context(req), idParam(req, "programmeVersionId"), analysisStatus(req)));
  },
);

router.get(
  "/programme-map/programme-versions/:programmeVersionId/entrecomp/coverage-summary",
  ...protectedProgrammeMap,
  requirePermission("programme.read"),
  async (req, res): Promise<void> => {
    res.json(await getEntreCompCoverageSummary(context(req), idParam(req, "programmeVersionId"), analysisStatus(req)));
  },
);

router.get(
  "/programme-map/programme-versions/:programmeVersionId/digcomp/coverage-summary",
  ...protectedProgrammeMap,
  requirePermission("programme.read"),
  async (req, res): Promise<void> => {
    res.json(await getDigCompCoverageSummary(context(req), idParam(req, "programmeVersionId"), analysisStatus(req)));
  },
);

router.get(
  "/programme-map/programme-versions/:programmeVersionId/frameworks/:frameworkKey/coverage-summary",
  ...protectedProgrammeMap,
  requirePermission("programme.read"),
  async (req, res): Promise<void> => {
    res.json(await getFrameworkCoverageSummaryByKey(context(req), idParam(req, "programmeVersionId"), idParam(req, "frameworkKey"), analysisStatus(req)));
  },
);

router.get(
  "/programme-map/programme-versions/:programmeVersionId/assessment-design/summary",
  ...protectedProgrammeMap,
  requirePermission("programme.read"),
  async (req, res): Promise<void> => {
    res.json(await assessmentDesignSummary(context(req), idParam(req, "programmeVersionId")));
  },
);

router.post(
  "/programme-map/programme-versions/:programmeVersionId/assessment-design/materialise",
  ...protectedProgrammeMap,
  requirePermission("analysis.review"),
  async (req, res): Promise<void> => {
    const programmeVersionId = idParam(req, "programmeVersionId");
    const result = await materialiseAssessmentDesignLayer(context(req), programmeVersionId);
    await writeRequestAuditEvent({
      req,
      actionType: "programme_map.assessment_design_materialised",
      subjectType: "competency_evaluation",
      subjectId: programmeVersionId,
      metadata: {
        programmeVersionId,
        layerKey: "assessment-design",
        indicatorCount: result.indicatorCount,
        aiClassification: false,
        institutionalJudgement: false,
      },
    });
    res.status(201).json(result);
  },
);

router.get(
  "/programme-map/programme-versions/:programmeVersionId/modality-design/summary",
  ...protectedProgrammeMap,
  requirePermission("programme.read"),
  async (req, res): Promise<void> => {
    res.json(await modalityDesignSummary(context(req), idParam(req, "programmeVersionId")));
  },
);

router.post(
  "/programme-map/programme-versions/:programmeVersionId/modality-design/materialise",
  ...protectedProgrammeMap,
  requirePermission("analysis.review"),
  async (req, res): Promise<void> => {
    const programmeVersionId = idParam(req, "programmeVersionId");
    const result = await materialiseModalityDesignLayer(context(req), programmeVersionId);
    await writeRequestAuditEvent({
      req,
      actionType: "programme_map.modality_design_materialised",
      subjectType: "competency_evaluation",
      subjectId: programmeVersionId,
      metadata: {
        programmeVersionId,
        layerKey: "modality-design",
        indicatorCount: result.indicatorCount,
        aiClassification: false,
        institutionalJudgement: false,
      },
    });
    res.status(201).json(result);
  },
);

router.get(
  "/programme-map/programme-versions/:programmeVersionId/frameworks/:frameworkKey/expectation-analysis",
  ...protectedProgrammeMap,
  requirePermission("programme.read"),
  async (req, res): Promise<void> => {
    res.json(await getFrameworkExpectationAnalysis(context(req), idParam(req, "programmeVersionId"), idParam(req, "frameworkKey"), analysisStatus(req)));
  },
);

router.get(
  "/programme-map/programme-versions/:programmeVersionId/programme-owned-framework",
  ...protectedProgrammeMap,
  requirePermission("programme.read"),
  async (req, res): Promise<void> => {
    res.json(await getProgrammeOwnedFramework(context(req), idParam(req, "programmeVersionId")));
  },
);

router.post(
  "/programme-map/programme-versions/:programmeVersionId/programme-attributes",
  ...protectedProgrammeMap,
  requirePermission("programme.write"),
  async (req, res): Promise<void> => {
    const programmeVersionId = idParam(req, "programmeVersionId");
    const result = await createProgrammeGraduateAttribute(context(req), programmeVersionId, req.body);
    await writeRequestAuditEvent({
      req,
      actionType: "programme_map.programme_attribute_created",
      subjectType: "competency",
      subjectId: result.attribute.id,
      metadata: {
        programmeVersionId,
        attributeKey: result.attribute.key,
        kind: result.attribute.metadata["kind"],
      },
    });
    res.status(201).json(result);
  },
);

router.post(
  "/programme-map/programme-versions/:programmeVersionId/programme-attributes/:attributeId/expectations",
  ...protectedProgrammeMap,
  requirePermission("analysis.review"),
  async (req, res): Promise<void> => {
    const programmeVersionId = idParam(req, "programmeVersionId");
    const result = await createProgrammeAttributeExpectation(context(req), programmeVersionId, idParam(req, "attributeId"), req.body);
    await writeRequestAuditEvent({
      req,
      actionType: "programme_map.programme_attribute_expectation_created",
      subjectType: "competency",
      subjectId: result.attribute.id,
      metadata: {
        programmeVersionId,
        expectationId: result.expectation.id,
        attributeKey: result.attribute.key,
        expectedLevel: result.expectation.expectedLevel,
        scope: result.expectation.scope,
      },
    });
    res.status(201).json(result);
  },
);

router.post(
  "/programme-map/programme-versions/:programmeVersionId/frameworks/:frameworkKey/expectations",
  ...protectedProgrammeMap,
  requirePermission("analysis.review"),
  async (req, res): Promise<void> => {
    const programmeVersionId = idParam(req, "programmeVersionId");
    const frameworkKey = idParam(req, "frameworkKey");
    const result = await createFrameworkCompetencyExpectation(context(req), programmeVersionId, frameworkKey, req.body);
    await writeRequestAuditEvent({
      req,
      actionType: "programme_map.framework_expectation_created",
      subjectType: "competency",
      subjectId: result.competency.id,
      metadata: {
        programmeVersionId,
        frameworkKey,
        expectationId: result.expectation.id,
        competencyId: result.competency.id,
        expectedLevel: result.expectation.expectedLevel,
        scope: result.expectation.scope,
      },
    });
    res.status(201).json(result);
  },
);

router.post(
  "/programme-map/programme-versions/:programmeVersionId/greencomp/evaluations",
  ...protectedProgrammeMap,
  requirePermission("analysis.review"),
  async (req, res): Promise<void> => {
    const programmeVersionId = idParam(req, "programmeVersionId");
    const result = await createGreenCompEvaluation(context(req), programmeVersionId, req.body);
    await writeRequestAuditEvent({
      req,
      actionType: "programme_map.greencomp_evaluation_created",
      subjectType: "competency_evaluation",
      subjectId: result.evaluation.id,
      metadata: {
        programmeVersionId,
        competencyId: result.competency.id,
        observedLevel: result.evaluation.observedLevel,
        status: result.evaluation.status,
        evidenceLinked: result.evidenceLinked,
        aiClassification: false,
      },
    });
    res.status(201).json(result);
  },
);

router.post(
  "/programme-map/programme-versions/:programmeVersionId/lifecomp/evaluations",
  ...protectedProgrammeMap,
  requirePermission("analysis.review"),
  async (req, res): Promise<void> => {
    const programmeVersionId = idParam(req, "programmeVersionId");
    const result = await createLifeCompEvaluation(context(req), programmeVersionId, req.body);
    await writeRequestAuditEvent({
      req,
      actionType: "programme_map.lifecomp_evaluation_created",
      subjectType: "competency_evaluation",
      subjectId: result.evaluation.id,
      metadata: {
        programmeVersionId,
        competencyId: result.competency.id,
        observedLevel: result.evaluation.observedLevel,
        status: result.evaluation.status,
        evidenceLinked: result.evidenceLinked,
        aiClassification: false,
      },
    });
    res.status(201).json(result);
  },
);

router.post(
  "/programme-map/programme-versions/:programmeVersionId/entrecomp/evaluations",
  ...protectedProgrammeMap,
  requirePermission("analysis.review"),
  async (req, res): Promise<void> => {
    const programmeVersionId = idParam(req, "programmeVersionId");
    const result = await createEntreCompEvaluation(context(req), programmeVersionId, req.body);
    await writeRequestAuditEvent({
      req,
      actionType: "programme_map.entrecomp_evaluation_created",
      subjectType: "competency_evaluation",
      subjectId: result.evaluation.id,
      metadata: {
        programmeVersionId,
        competencyId: result.competency.id,
        observedLevel: result.evaluation.observedLevel,
        status: result.evaluation.status,
        evidenceLinked: result.evidenceLinked,
        aiClassification: false,
      },
    });
    res.status(201).json(result);
  },
);

router.post(
  "/programme-map/programme-versions/:programmeVersionId/digcomp/evaluations",
  ...protectedProgrammeMap,
  requirePermission("analysis.review"),
  async (req, res): Promise<void> => {
    const programmeVersionId = idParam(req, "programmeVersionId");
    const result = await createDigCompEvaluation(context(req), programmeVersionId, req.body);
    await writeRequestAuditEvent({
      req,
      actionType: "programme_map.digcomp_evaluation_created",
      subjectType: "competency_evaluation",
      subjectId: result.evaluation.id,
      metadata: {
        programmeVersionId,
        competencyId: result.competency.id,
        observedLevel: result.evaluation.observedLevel,
        status: result.evaluation.status,
        evidenceLinked: result.evidenceLinked,
        aiClassification: false,
      },
    });
    res.status(201).json(result);
  },
);

router.get(
  "/programme-map/programme-versions/:programmeVersionId",
  ...protectedProgrammeMap,
  requirePermission("programme.read"),
  async (req, res): Promise<void> => {
    const result = await getProgrammeMapProjection(context(req), idParam(req, "programmeVersionId"), layerKeys(req), analysisStatus(req));
    await writeRequestAuditEvent({
      req,
      actionType: "programme_map.viewed",
      subjectType: "programme_map",
      subjectId: result.curatedStructure?.id ?? result.programmeVersion.id,
      metadata: {
        programmeVersionId: result.programmeVersion.id,
        activeLayerKeys: result.activeLayers.filter((layer) => layer.active).map((layer) => layer.key),
        analysisStatus: result.analysisStatus,
        rowCount: result.rows.length,
      },
    });
    res.json(result);
  },
);

export default router;
