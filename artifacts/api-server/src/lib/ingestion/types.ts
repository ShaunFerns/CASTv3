export type IngestionPathway = "akari" | "single_pdf" | "manual_module" | "programme_wizard";

export type DescriptorSectionInput = {
  sectionType?: string;
  title?: string;
  content?: string;
};

export type NormalizedModuleInput = {
  moduleCode?: string;
  moduleTitle?: string;
  credits?: number;
  stage?: string;
  semester?: string;
  programmeCode?: string;
  programmeName?: string;
  school?: string;
  department?: string;
  campus?: string;
  descriptorText?: string;
  sections?: DescriptorSectionInput[];
  raw?: Record<string, unknown>;
  sourceIdentifier?: string;
  rowNumber?: string | number;
};

export type IngestionActor = {
  userId?: string;
  email?: string;
};

export type IngestionContext = {
  institutionId: string;
  actor: IngestionActor;
};

export type AkariIngestionInput = {
  fileName?: string;
  mimeType?: string;
  fileBase64?: string;
  csvText?: string;
  rows?: Record<string, unknown>[];
};

export type PdfDescriptorIngestionInput = {
  fileName: string;
  mimeType?: string;
  fileBase64?: string;
  rawText?: string;
  moduleCode?: string;
  moduleTitle?: string;
  credits?: number;
  stage?: string;
  semester?: string;
  sections?: DescriptorSectionInput[];
};

export type ManualModuleIngestionInput = {
  moduleCode?: string;
  moduleTitle?: string;
  credits?: number;
  stage?: string;
  semester?: string;
  school?: string;
  department?: string;
  campus?: string;
  descriptorText?: string;
  sections?: DescriptorSectionInput[];
};

export type IngestionResult = {
  runId: string;
  status: string;
  created: {
    importBatchIds: string[];
    sourceRecordIds: string[];
    sourceProgrammeIds: string[];
    sourceModuleIds: string[];
    sourceStructureItemIds: string[];
    documentIds: string[];
    documentVersionIds: string[];
    documentSectionIds: string[];
    moduleIds: string[];
    moduleDescriptorIds: string[];
    descriptorSectionIds: string[];
    evidenceItemIds: string[];
    dataQualityResultIds: string[];
  };
  errors: Array<{ code: string; message: string; severity: string; fieldPath?: string }>;
};
