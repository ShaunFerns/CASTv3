import { runSeed } from "./lib/european-framework-seed-runner.mjs";

const digCompSeed = {
  key: "digcomp",
  name: "DigComp",
  description: "The European digital competence framework for citizens.",
  versionLabel: "3.0",
  validFrom: "2025-01-01",
  phase: "cast-v3-phase5g",
  lensKey: "digcomp-curriculum-evidence",
  lensName: "DigComp curriculum evidence lens",
  lensVersionLabel: "3.0-evidence-v1",
  notes: "Seeded by CAST v3 Phase 5G as an evidence-informed European map layer.",
  sourceMetadata: {
    family: "european",
    source: "European Commission Joint Research Centre",
    publication: "Digital Competence Framework for Citizens (DigComp) collection",
    publicationYear: 2025,
    versionLabel: "3.0",
    jrcId: "JRC144705",
    sourceUrl: "https://data.jrc.ec.europa.eu/collection/id-00414",
    referencePublicationUrl: "https://publications.jrc.ec.europa.eu/repository/handle/JRC128415",
    seed: "cast-v3-phase5g",
  },
  domains: [
    {
      key: "information-and-data-literacy",
      code: "1",
      name: "Information and data literacy",
      description: "Finding, evaluating and managing digital data, information and content.",
      competences: [
        { key: "browsing-searching-and-filtering", code: "1.1", name: "Browsing, searching and filtering data, information and digital content", description: "Articulate information needs and locate digital data, information and content." },
        { key: "evaluating-data-information-and-digital-content", code: "1.2", name: "Evaluating data, information and digital content", description: "Analyse, compare and critically evaluate credibility and reliability." },
        { key: "managing-data-information-and-digital-content", code: "1.3", name: "Managing data, information and digital content", description: "Organise, store and retrieve digital data, information and content." },
      ],
    },
    {
      key: "communication-and-collaboration",
      code: "2",
      name: "Communication and collaboration",
      description: "Interacting, sharing, collaborating and participating through digital technologies.",
      competences: [
        { key: "interacting-through-digital-technologies", code: "2.1", name: "Interacting through digital technologies", description: "Interact through a variety of digital technologies and understand appropriate communication means." },
        { key: "sharing-through-digital-technologies", code: "2.2", name: "Sharing through digital technologies", description: "Share data, information and digital content with others through appropriate technologies." },
        { key: "engaging-in-citizenship-through-digital-technologies", code: "2.3", name: "Engaging in citizenship through digital technologies", description: "Participate in society through public and private digital services." },
        { key: "collaborating-through-digital-technologies", code: "2.4", name: "Collaborating through digital technologies", description: "Use digital tools and technologies for collaborative processes." },
        { key: "netiquette", code: "2.5", name: "Netiquette", description: "Understand behavioural norms and know-how while using digital technologies." },
        { key: "managing-digital-identity", code: "2.6", name: "Managing digital identity", description: "Create and manage one or more digital identities and protect reputation." },
      ],
    },
    {
      key: "digital-content-creation",
      code: "3",
      name: "Digital content creation",
      description: "Creating, adapting and applying digital content responsibly.",
      competences: [
        { key: "developing-digital-content", code: "3.1", name: "Developing digital content", description: "Create and edit digital content in different formats." },
        { key: "integrating-and-re-elaborating-digital-content", code: "3.2", name: "Integrating and re-elaborating digital content", description: "Modify, refine and combine digital information and content." },
        { key: "copyright-and-licences", code: "3.3", name: "Copyright and licences", description: "Understand how copyright and licences apply to digital information and content." },
        { key: "programming", code: "3.4", name: "Programming", description: "Plan and create instructions for a computing system to solve a given problem or perform a task." },
      ],
    },
    {
      key: "safety",
      code: "4",
      name: "Safety",
      description: "Protecting devices, data, wellbeing and the environment in digital contexts.",
      competences: [
        { key: "protecting-devices", code: "4.1", name: "Protecting devices", description: "Protect devices and digital content, and understand risks and threats in digital environments." },
        { key: "protecting-personal-data-and-privacy", code: "4.2", name: "Protecting personal data and privacy", description: "Protect personal data and privacy in digital environments." },
        { key: "protecting-health-and-well-being", code: "4.3", name: "Protecting health and well-being", description: "Avoid health risks and threats to physical and psychological wellbeing while using digital technologies." },
        { key: "protecting-the-environment", code: "4.4", name: "Protecting the environment", description: "Be aware of environmental impacts of digital technologies and their use." },
      ],
    },
    {
      key: "problem-solving",
      code: "5",
      name: "Problem solving",
      description: "Resolving technical needs, using digital technology creatively and recognising capability gaps.",
      competences: [
        { key: "solving-technical-problems", code: "5.1", name: "Solving technical problems", description: "Identify technical problems when operating devices and using digital environments, and solve them." },
        { key: "identifying-needs-and-technological-responses", code: "5.2", name: "Identifying needs and technological responses", description: "Assess needs and identify digital tools and responses to address them." },
        { key: "creatively-using-digital-technology", code: "5.3", name: "Creatively using digital technology", description: "Use digital tools and technologies to create knowledge and innovate processes and products." },
        { key: "identifying-digital-competence-gaps", code: "5.4", name: "Identifying digital competence gaps", description: "Understand where digital competence can be strengthened or updated." },
      ],
    },
  ],
};

runSeed(digCompSeed).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
