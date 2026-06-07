import { runValidation } from "./lib/framework-layer-validation-runner.mjs";

runValidation({
  frameworkKey: "greencomp",
  frameworkName: "GreenComp",
  versionLabel: "2022",
  lensKey: "greencomp-curriculum-evidence",
  expectedDomains: 4,
  expectedCompetencies: 12,
  competencyKey: "systems-thinking",
  expectedLevel: "leading",
  observedLevel: "developing",
  phase: "5C",
  outputKey: "PHASE5C_GREENCOMP_EXPECTATIONS_SMOKE",
  evidenceText: "Students analyse a sustainability challenge using systems thinking and evidence-informed reflection.",
});
