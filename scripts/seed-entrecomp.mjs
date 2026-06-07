import { runSeed } from "./lib/european-framework-seed-runner.mjs";

const entreCompSeed = {
  key: "entrecomp",
  name: "EntreComp",
  description: "The European entrepreneurship competence framework.",
  versionLabel: "2016",
  validFrom: "2016-06-06",
  phase: "cast-v3-phase5f",
  lensKey: "entrecomp-curriculum-evidence",
  lensName: "EntreComp curriculum evidence lens",
  lensVersionLabel: "2016-evidence-v1",
  notes: "Seeded by CAST v3 Phase 5F as an evidence-informed European map layer.",
  sourceMetadata: {
    family: "european",
    source: "European Commission Joint Research Centre",
    publication: "EntreComp: The Entrepreneurship Competence Framework",
    authors: ["Margherita Bacigalupo", "Panagiotis Kampylis", "Yves Punie", "Lieve Van den Brande"],
    publicationYear: 2016,
    versionLabel: "2016",
    jrcId: "JRC101581",
    doi: "10.2791/593884",
    isbn: "978-92-79-58538-8",
    catalogueNumber: "LF-NA-27939-EN-N",
    sourceUrl: "https://publications.jrc.ec.europa.eu/repository/handle/JRC101581",
    seed: "cast-v3-phase5f",
  },
  domains: [
    {
      key: "ideas-and-opportunities",
      code: "1",
      name: "Ideas and opportunities",
      description: "Seeing possibilities, shaping ideas and considering value for others.",
      competences: [
        { key: "spotting-opportunities", code: "1.1", name: "Spotting opportunities", description: "Use imagination and abilities to identify opportunities for creating value." },
        { key: "creativity", code: "1.2", name: "Creativity", description: "Shape creative and purposeful ideas." },
        { key: "vision", code: "1.3", name: "Vision", description: "Work towards a future-facing vision." },
        { key: "valuing-ideas", code: "1.4", name: "Valuing ideas", description: "Make the most of ideas and opportunities." },
        { key: "ethical-and-sustainable-thinking", code: "1.5", name: "Ethical and sustainable thinking", description: "Assess the consequences and impact of ideas, opportunities and actions." },
      ],
    },
    {
      key: "resources",
      code: "2",
      name: "Resources",
      description: "Mobilising personal, material and social resources to create value.",
      competences: [
        { key: "self-awareness-and-self-efficacy", code: "2.1", name: "Self-awareness and self-efficacy", description: "Reflect on needs, aspirations and abilities." },
        { key: "motivation-and-perseverance", code: "2.2", name: "Motivation and perseverance", description: "Stay focused and continue towards aims." },
        { key: "mobilising-resources", code: "2.3", name: "Mobilising resources", description: "Gather and manage the resources needed to act on ideas." },
        { key: "financial-and-economic-literacy", code: "2.4", name: "Financial and economic literacy", description: "Estimate financial and economic implications of value-creating activity." },
        { key: "mobilising-others", code: "2.5", name: "Mobilising others", description: "Inspire, persuade and involve others." },
      ],
    },
    {
      key: "into-action",
      code: "3",
      name: "Into action",
      description: "Turning ideas and resources into value-creating activity.",
      competences: [
        { key: "taking-the-initiative", code: "3.1", name: "Taking the initiative", description: "Act on ideas and opportunities." },
        { key: "planning-and-management", code: "3.2", name: "Planning and management", description: "Prioritise, organise and follow up." },
        { key: "coping-with-uncertainty-ambiguity-and-risk", code: "3.3", name: "Coping with uncertainty, ambiguity and risk", description: "Make decisions when outcomes are uncertain, information is incomplete or risk is present." },
        { key: "working-with-others", code: "3.4", name: "Working with others", description: "Team up, collaborate and network." },
        { key: "learning-through-experience", code: "3.5", name: "Learning through experience", description: "Use experience and reflection to improve future value-creating activity." },
      ],
    },
  ],
};

runSeed(entreCompSeed).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
