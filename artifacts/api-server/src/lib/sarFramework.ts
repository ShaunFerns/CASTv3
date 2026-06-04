export interface SarCriteria {
  name: string;
  description: string;
}

export interface SarDefinitionFull {
  name: string;
  definition: string;
  criteria: SarCriteria[];
}

export const SAR_FRAMEWORK: SarDefinitionFull[] = [
  {
    name: "Language Studies",
    definition: "Modules that develop students' abilities in understanding, analysing, and using language(s), including linguistics, applied language, translation, or language acquisition.",
    criteria: [
      { name: "Language skills development", description: "Explicitly develops reading, writing, speaking, or listening in a target language." },
      { name: "Linguistic or structural analysis", description: "Engages with grammar, phonology, syntax, discourse, or language systems." },
      { name: "Cultural and contextual understanding", description: "Addresses cultural, social, or historical dimensions of language use." },
      { name: "Communicative competence", description: "Develops practical language use in authentic or near-authentic contexts." },
      { name: "Reflection on language learning", description: "Includes metalinguistic awareness or strategies for language acquisition." },
    ],
  },
  {
    name: "Quantitative Analysis",
    definition: "Modules that develop students' ability to understand, apply, and critically evaluate numerical, statistical, or mathematical methods.",
    criteria: [
      { name: "Numerical and mathematical reasoning", description: "Applies mathematical or statistical concepts in the module." },
      { name: "Data interpretation and analysis", description: "Uses quantitative data to draw conclusions or make decisions." },
      { name: "Statistical methods", description: "Introduces or applies statistical techniques (e.g. regression, probability, hypothesis testing)." },
      { name: "Quantitative problem solving", description: "Requires structured problem solving using numerical approaches." },
      { name: "Critical evaluation of evidence", description: "Encourages critical appraisal of numerical evidence and its limitations." },
    ],
  },
  {
    name: "Writing and Text Analysis",
    definition: "Modules that develop students' capacities to produce, interpret, and critically engage with written texts across disciplines.",
    criteria: [
      { name: "Academic writing development", description: "Explicitly develops writing skills, argument construction, or written communication." },
      { name: "Critical reading", description: "Requires systematic engagement with and analysis of written texts." },
      { name: "Textual interpretation and critique", description: "Develops skills in interpreting meaning, argument, and rhetoric in texts." },
      { name: "Genre and discipline awareness", description: "Addresses discipline-specific or genre conventions in writing or reading." },
      { name: "Reflection on writing process", description: "Includes drafting, revision, feedback, or metacognitive engagement with writing." },
    ],
  },
  {
    name: "Health / Wellness / Sports",
    definition: "Modules that engage students with concepts, practices, or research in physical health, mental wellbeing, or sport and exercise science.",
    criteria: [
      { name: "Health and wellbeing concepts", description: "Addresses physical, mental, or social dimensions of health or wellness." },
      { name: "Sport, exercise, or physical activity", description: "Engages with sport, physical activity, or exercise science concepts." },
      { name: "Psychological and behavioural dimensions", description: "Addresses psychological aspects of health, performance, or behaviour change." },
      { name: "Evidence-based practice", description: "Draws on research evidence to understand health or wellness outcomes." },
      { name: "Lifestyle and public health", description: "Addresses lifestyle factors, prevention, or population health perspectives." },
    ],
  },
  {
    name: "Sustainability",
    definition: "Modules that develop students' understanding of sustainability — environmental, social, and economic — and their capacity to engage critically with sustainability challenges.",
    criteria: [
      { name: "Environmental sustainability", description: "Addresses ecological systems, climate, biodiversity, or environmental impact." },
      { name: "Social sustainability", description: "Engages with equity, justice, community resilience, or social dimensions of sustainability." },
      { name: "Economic sustainability", description: "Addresses sustainable business, circular economy, or economic dimensions of sustainability." },
      { name: "Systems thinking", description: "Encourages holistic analysis of interconnected sustainability challenges." },
      { name: "Action and responsibility", description: "Develops capacity for critical reflection or action towards sustainable futures." },
    ],
  },
  {
    name: "Communications",
    definition: "Modules that develop students' skills in communicating effectively across contexts, media, and audiences — including oral, written, and digital communication.",
    criteria: [
      { name: "Oral communication", description: "Develops skills in presenting, speaking, or verbal communication." },
      { name: "Written communication", description: "Develops clear, audience-appropriate written communication." },
      { name: "Media and multimodal communication", description: "Addresses communication across different media or modalities." },
      { name: "Audience and context awareness", description: "Develops ability to tailor communication to different audiences or contexts." },
      { name: "Professional communication competence", description: "Prepares students for communication in professional or public contexts." },
    ],
  },
  {
    name: "Creativity",
    definition: "Modules that develop students' creative capacities — including creative thinking, artistic practice, design, or innovation — and their ability to reflect critically on creative processes.",
    criteria: [
      { name: "Creative practice or production", description: "Involves producing creative work (artistic, design, performance, or other)." },
      { name: "Creative thinking and ideation", description: "Develops divergent thinking, imagination, or idea generation." },
      { name: "Critical reflection on creativity", description: "Encourages metacognitive engagement with creative process or output." },
      { name: "Collaboration and co-creation", description: "Involves collaborative creative work or group creative processes." },
      { name: "Innovation and originality", description: "Encourages novel approaches, experimentation, or risk-taking in creative work." },
    ],
  },
  {
    name: "Digital Literacy",
    definition: "Modules that develop students' ability to engage critically and competently with digital tools, data, and technologies in academic, professional, or everyday contexts.",
    criteria: [
      { name: "Digital tools and technologies", description: "Develops practical skills in using digital tools or platforms." },
      { name: "Data literacy and information management", description: "Addresses finding, evaluating, or managing digital information and data." },
      { name: "Critical digital engagement", description: "Encourages critical analysis of digital media, algorithms, or technology." },
      { name: "Digital communication and collaboration", description: "Uses or develops skills in digital communication or collaborative digital platforms." },
      { name: "Ethics and digital citizenship", description: "Addresses ethical, legal, or civic dimensions of digital participation." },
    ],
  },
];

export function getSarByName(name: string): SarDefinitionFull | undefined {
  return SAR_FRAMEWORK.find((sar) => sar.name === name);
}

export function inferStage(moduleCode: string): string {
  const match = moduleCode.match(/(\d)/);
  if (!match) return "Unknown";
  const digit = parseInt(match[1], 10);
  if (digit >= 1 && digit <= 4) return `Stage ${digit}`;
  return "Unknown";
}

export function calcScoreBand(avg: number): string {
  if (avg >= 3.0) return "Strong Fit";
  if (avg >= 2.5) return "Moderate Fit";
  return "Weak Fit";
}

export function buildModuleText(module: {
  overview?: string | null;
  learningOutcomes?: string | null;
  indicativeSyllabus?: string | null;
  teachingMethods?: string | null;
  rawText?: string | null;
}): string {
  const parts: string[] = [];
  if (module.overview) parts.push(`MODULE OVERVIEW:\n${module.overview}`);
  if (module.learningOutcomes) parts.push(`LEARNING OUTCOMES:\n${module.learningOutcomes}`);
  if (module.indicativeSyllabus) parts.push(`INDICATIVE SYLLABUS:\n${module.indicativeSyllabus}`);
  if (module.teachingMethods) parts.push(`TEACHING METHODS:\n${module.teachingMethods}`);
  if (parts.length === 0 && module.rawText) return module.rawText;
  return parts.join("\n\n");
}
