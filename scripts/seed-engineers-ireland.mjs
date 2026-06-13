import { runSeed } from "./lib/european-framework-seed-runner.mjs";

const engineersIrelandSeed = {
  key: "engineers-ireland",
  name: "Engineers Ireland",
  description: "Professional accreditation framework for engineering education programme outcomes.",
  versionLabel: "2021",
  validFrom: "2021-01-01",
  phase: "cast-v1-professional-accreditation",
  lensKey: "engineers-ireland-curriculum-evidence",
  lensName: "Engineers Ireland curriculum evidence lens",
  lensVersionLabel: "2021-evidence-v1",
  notes: "Seeded from Engineers Ireland Accreditation Criteria, January 2021. CAST uses the Programme Outcomes as evidence-informed accreditation outcomes; Programme Areas and Programme Management Criteria are retained as contextual metadata.",
  sourceMetadata: {
    family: "professional_accreditation",
    source: "Engineers Ireland",
    publication: "Accreditation Criteria",
    publicationYear: 2021,
    versionLabel: "January 2021",
    sourceDocument: "Engineers Ireland Accreditation Criteria 2021.pdf",
    seed: "cast-v1-professional-accreditation",
    accreditationContext: [
      "Engineering Technician",
      "Associate Engineer",
      "Chartered Engineer with further learning",
      "Chartered Engineer",
    ],
    programmeAreas: [
      "PA1 Science and Mathematics",
      "PA2 Discipline-specific Technology",
      "PA3 Software and Information Systems",
      "PA4 Creativity and Innovation",
      "PA5 Societal and Business Context",
      "PA6 Engineering Practice",
      "PA7 Sustainability",
    ],
    programmeManagementCriteria: [
      "PM1 Entry Standards, Transfer and Mobility",
      "PM2 Duration and Structure",
      "PM3 Objectives, Resourcing and Viability",
      "PM4 Assessment of Student Performance",
      "PM5 Programme Development and Quality Assurance",
    ],
  },
  domains: [
    {
      key: "programme-outcomes",
      code: "PO",
      name: "Programme Outcomes",
      description: "Engineers Ireland Programme Outcomes used by CAST as professional accreditation evidence outcomes.",
      competences: [
        {
          key: "knowledge-and-understanding",
          code: "PO1",
          name: "Knowledge and Understanding",
          description: "Knowledge and understanding of mathematics, sciences, data science, analytics and technologies underpinning the relevant branch of engineering, with depth varying by accreditation standard.",
        },
        {
          key: "problem-analysis",
          code: "PO2",
          name: "Problem Analysis",
          description: "Ability to identify, formulate and analyse engineering problems, with problem complexity varying by accreditation standard.",
        },
        {
          key: "design",
          code: "PO3",
          name: "Design",
          description: "Ability to contribute to or design solutions to engineering problems, including consideration of professional responsibilities, standards and design requirements.",
        },
        {
          key: "investigation",
          code: "PO4",
          name: "Investigation",
          description: "Ability to investigate, experiment, use data and apply research or testing methods to support engineering problem solving.",
        },
        {
          key: "professional-and-ethical-responsibilities",
          code: "PO5",
          name: "Professional and Ethical Responsibilities",
          description: "Understanding of and commitment to professional and ethical responsibilities towards people and the environment in engineering practice.",
        },
        {
          key: "teamwork-and-lifelong-learning",
          code: "PO6",
          name: "Teamwork and Lifelong Learning",
          description: "Ability to work independently and in diverse and inclusive teams, and to prepare for lifelong learning and continuing professional development.",
        },
        {
          key: "communication",
          code: "PO7",
          name: "Communication",
          description: "Ability to communicate effectively about engineering activities to diverse audiences, with activity complexity varying by accreditation standard.",
        },
        {
          key: "engineering-management",
          code: "PO8",
          name: "Engineering Management",
          description: "Knowledge and understanding of engineering management principles, resources, project management and financial decision-making relevant to engineering work and projects.",
        },
      ],
    },
  ],
};

runSeed(engineersIrelandSeed).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
