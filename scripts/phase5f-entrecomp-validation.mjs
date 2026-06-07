import { runValidation } from "./lib/framework-layer-validation-runner.mjs";

runValidation({
  frameworkKey: "entrecomp",
  frameworkName: "EntreComp",
  versionLabel: "2016",
  lensKey: "entrecomp-curriculum-evidence",
  expectedDomains: 3,
  expectedCompetencies: 15,
  competencyKey: "creativity",
  expectedLevel: "consolidating",
  observedLevel: "consolidating",
  phase: "5F",
  outputKey: "PHASE5F_ENTRECOMP_SMOKE",
  evidenceText: "Students shape purposeful ideas and test value-creating proposals with peers and external stakeholders.",
});
