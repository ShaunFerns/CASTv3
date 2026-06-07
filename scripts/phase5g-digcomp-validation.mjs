import { runValidation } from "./lib/framework-layer-validation-runner.mjs";

runValidation({
  frameworkKey: "digcomp",
  frameworkName: "DigComp",
  versionLabel: "3.0",
  lensKey: "digcomp-curriculum-evidence",
  expectedDomains: 5,
  expectedCompetencies: 21,
  competencyKey: "creatively-using-digital-technology",
  expectedLevel: "consolidating",
  observedLevel: "leading",
  phase: "5G",
  outputKey: "PHASE5G_DIGCOMP_SMOKE",
  evidenceText: "Students use digital technologies creatively to investigate a problem and produce an evidence-informed response.",
});
