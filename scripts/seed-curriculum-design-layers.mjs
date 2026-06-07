import { seedCurriculumDesignLayer } from "./lib/curriculum-design-layer-seed-runner.mjs";

const assessmentDesignLayer = {
  key: "assessment-design",
  name: "Assessment Design",
  description: "Evidence-informed curriculum design layer for assessment completeness, balance, alignment and risk.",
  versionLabel: "1.0",
  validFrom: "2026-06-07",
  phase: "cast-v3-phase5j",
  programmeMapLayer: true,
  moduleBuilderLayer: true,
  lensKey: "assessment-design-evidence",
  lensName: "Assessment Design evidence lens",
  lensDescription: "Deterministic, evidence-informed lens for reviewing assessment design evidence across a programme.",
  lensVersionLabel: "1.0-evidence-v1",
  notes: "Seeded by CAST v3 Phase 5J as a curriculum design layer, not a competency framework.",
  inputEvidenceKinds: ["assessment_component", "descriptor_section", "learning_outcome", "manual"],
  domains: [
    {
      key: "assessment-completeness",
      name: "Assessment completeness",
      description: "Whether assessment evidence contains enough component detail to support review.",
      indicators: [
        {
          key: "total-weighting-completeness",
          name: "Total weighting completeness",
          description: "Assessment components provide a coherent total weighting for the module.",
        },
        {
          key: "assessment-component-detail",
          name: "Assessment component detail",
          description: "Assessment evidence includes named components, types, modes and descriptions where available.",
        },
      ],
    },
    {
      key: "assessment-timing-and-workload",
      name: "Assessment timing and workload",
      description: "Whether assessment timing evidence can support programme workload review.",
      indicators: [
        {
          key: "assessment-timing-workload",
          name: "Assessment timing and workload",
          description: "Assessment components include timing evidence such as week, period or sequence where available.",
        },
      ],
    },
    {
      key: "assessment-diversity",
      name: "Assessment diversity",
      description: "Evidence for variety and balance across assessment types and modes.",
      indicators: [
        {
          key: "assessment-type-mix",
          name: "Assessment type mix",
          description: "Assessment components show a mix of assessment types rather than a single opaque assessment pattern.",
        },
        {
          key: "formative-summative-balance",
          name: "Formative and summative balance",
          description: "Assessment evidence distinguishes formative, summative or review-oriented assessment where available.",
        },
        {
          key: "group-individual-balance",
          name: "Group and individual balance",
          description: "Assessment evidence distinguishes group and individual work where available.",
        },
      ],
    },
    {
      key: "outcome-alignment",
      name: "Outcome alignment",
      description: "Whether assessment evidence can be linked to learning outcomes.",
      indicators: [
        {
          key: "assessment-outcome-alignment",
          name: "Assessment outcome alignment",
          description: "Assessment components or sections provide evidence that assessment is connected to learning outcomes.",
        },
      ],
    },
    {
      key: "feedback-and-review-evidence",
      name: "Feedback and review evidence",
      description: "Evidence that assessment design includes feedback, review or iterative learning opportunities.",
      indicators: [
        {
          key: "feedback-review-evidence",
          name: "Feedback and review evidence",
          description: "Descriptor evidence includes feedback, review, feedforward or reflection signals.",
        },
      ],
    },
    {
      key: "assessment-risk-and-data-quality",
      name: "Assessment risk and data quality",
      description: "Assessment data quality issues that affect programme review confidence.",
      indicators: [
        {
          key: "assessment-risk-data-quality",
          name: "Assessment risk and data quality",
          description: "Assessment evidence identifies missing weighting, type, timing, mode or outcome-link information.",
        },
      ],
    },
  ],
  evidenceRules: [
    {
      key: "eligible-assessment-evidence",
      ruleType: "include",
      rule: {
        sourceKinds: ["assessment_component", "descriptor_section", "learning_outcome", "manual"],
        descriptorSectionTypes: ["assessment", "learning_outcomes", "teaching_and_learning_strategy"],
        target: "competency_evaluations",
        aiClassification: false,
      },
    },
    {
      key: "review-readiness",
      ruleType: "threshold",
      rule: {
        defaultStatus: "needs_review",
        requireEvidenceLink: true,
        institutionalJudgement: false,
      },
    },
  ],
};

const modalityDesignLayer = {
  key: "modality-design",
  name: "Modality Design",
  description: "Evidence-informed curriculum design layer for delivery modality fit, feasibility and risk.",
  versionLabel: "1.0",
  validFrom: "2026-06-07",
  phase: "cast-v3-phase5j",
  programmeMapLayer: false,
  moduleBuilderLayer: true,
  lensKey: "modality-design-evidence",
  lensName: "Modality Design evidence lens",
  lensDescription: "Deterministic, evidence-informed lens for reviewing modality and delivery design evidence across a programme.",
  lensVersionLabel: "1.0-evidence-v1",
  notes: "Seeded by CAST v3 Phase 5J as a curriculum design layer, not a competency framework.",
  inputEvidenceKinds: ["descriptor_section", "assessment_component", "manual"],
  domains: [
    {
      key: "learning-design-fit",
      name: "Learning design fit",
      description: "Whether modality evidence is connected to the intended learning design.",
      indicators: [
        {
          key: "current-planned-modality",
          name: "Current or planned modality",
          description: "Descriptor evidence identifies current or planned delivery modality where available.",
        },
        {
          key: "learning-design-fit",
          name: "Learning design fit",
          description: "Teaching and learning evidence supports the selected delivery approach.",
        },
      ],
    },
    {
      key: "assessment-fit",
      name: "Assessment fit",
      description: "Whether assessment evidence is compatible with the delivery approach.",
      indicators: [
        {
          key: "modality-assessment-fit",
          name: "Assessment fit",
          description: "Assessment evidence identifies requirements or risks for the delivery modality.",
        },
      ],
    },
    {
      key: "learner-access-and-equity",
      name: "Learner access and equity",
      description: "Evidence for access, inclusion, flexibility and learner support considerations.",
      indicators: [
        {
          key: "learner-access-equity",
          name: "Learner access and equity",
          description: "Descriptor evidence addresses access, inclusion, flexibility or learner support.",
        },
      ],
    },
    {
      key: "stage-cohort-context",
      name: "Stage and cohort context",
      description: "Evidence that delivery design considers stage, cohort or transition context.",
      indicators: [
        {
          key: "stage-cohort-context",
          name: "Stage and cohort context",
          description: "Modality evidence accounts for stage, semester, cohort, transition or attendance context.",
        },
      ],
    },
    {
      key: "resource-and-feasibility-fit",
      name: "Resource and feasibility fit",
      description: "Evidence for practical feasibility, specialist spaces, equipment or digital tools.",
      indicators: [
        {
          key: "resource-feasibility-fit",
          name: "Resource and feasibility fit",
          description: "Descriptor evidence identifies resources, spaces, equipment, tools or constraints for delivery.",
        },
      ],
    },
  ],
  evidenceRules: [
    {
      key: "eligible-modality-evidence",
      ruleType: "include",
      rule: {
        sourceKinds: ["descriptor_section", "assessment_component", "manual"],
        descriptorSectionTypes: ["teaching_and_learning_strategy", "assessment", "modality", "resources"],
        target: "competency_evaluations",
        aiClassification: false,
      },
    },
    {
      key: "review-readiness",
      ruleType: "threshold",
      rule: {
        defaultStatus: "needs_review",
        requireEvidenceLink: true,
        institutionalJudgement: false,
      },
    },
  ],
};

async function runLayer(layer) {
  const result = await seedCurriculumDesignLayer(layer);
  console.log(`${layer.key.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_SEED=ok`);
  console.log(`FRAMEWORK_ID=${result.frameworkId}`);
  console.log(`FRAMEWORK_VERSION_ID=${result.frameworkVersionId}`);
  console.log(`LENS_ID=${result.lensId}`);
  console.log(`LENS_VERSION_ID=${result.lensVersionId}`);
  console.log(`DOMAINS=${result.counts.domains}`);
  console.log(`INDICATORS=${result.counts.indicators}`);
  console.log(`LENSES=${result.counts.lenses}`);
  console.log(`BINDINGS=${result.counts.bindings}`);
  console.log(`RULES=${result.counts.rules}`);
  console.log(`OUTPUT_SCHEMAS=${result.counts.output_schemas}`);
}

for (const layer of [assessmentDesignLayer, modalityDesignLayer]) {
  await runLayer(layer);
}
