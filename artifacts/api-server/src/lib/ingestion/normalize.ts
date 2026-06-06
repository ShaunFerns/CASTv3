import type { DescriptorSectionInput, NormalizedModuleInput } from "./types.js";

const sectionTypes = new Set([
  "aims",
  "learning_outcomes",
  "indicative_content",
  "teaching_and_learning_strategy",
  "assessment",
  "requisites",
  "resources",
  "graduate_attributes",
  "modality",
  "other",
]);

const aliases = {
  moduleCode: ["modulecode", "module_code", "code", "module id", "moduleid"],
  moduleTitle: ["moduletitle", "module_title", "title", "name", "module name", "modulename"],
  credits: ["credits", "credit", "ects"],
  stage: ["stage", "year", "level"],
  semester: ["semester", "term", "teaching period", "teachingperiod"],
  programmeCode: ["programmecode", "programme_code", "program code", "programcode", "programme id", "programmeid"],
  programmeName: ["programmename", "programme_name", "program name", "programname", "programme title", "programmetitle"],
  school: ["school", "faculty"],
  department: ["department", "dept"],
  campus: ["campus"],
  descriptorText: ["descriptor", "descriptor text", "descriptortext", "description", "module descriptor"],
} as const;

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, " ");
}

function getString(row: Record<string, unknown>, names: readonly string[]): string | undefined {
  const entries = Object.entries(row);
  for (const name of names) {
    const match = entries.find(([key]) => normalizeKey(key) === name);
    if (match && match[1] != null && String(match[1]).trim()) {
      return String(match[1]).trim();
    }
  }
  return undefined;
}

function parseCredits(value: string | number | undefined): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (!value) return undefined;
  const parsed = Number(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function normalizeDescriptorSection(input: DescriptorSectionInput, orderIndex: number): Required<DescriptorSectionInput> & { orderIndex: number } {
  const type = input.sectionType && sectionTypes.has(input.sectionType) ? input.sectionType : "other";
  return {
    sectionType: type,
    title: input.title?.trim() || type.replace(/_/g, " "),
    content: input.content?.trim() ?? "",
    orderIndex,
  };
}

export function sectionsFromText(text: string | undefined): DescriptorSectionInput[] {
  if (!text?.trim()) return [];
  return [{ sectionType: "other", title: "Descriptor text", content: text.trim() }];
}

export function normalizeAkariRow(row: Record<string, unknown>, index: number): NormalizedModuleInput {
  const creditsText = getString(row, aliases.credits);
  return {
    moduleCode: getString(row, aliases.moduleCode),
    moduleTitle: getString(row, aliases.moduleTitle),
    credits: parseCredits(creditsText),
    stage: getString(row, aliases.stage),
    semester: getString(row, aliases.semester),
    programmeCode: getString(row, aliases.programmeCode),
    programmeName: getString(row, aliases.programmeName),
    school: getString(row, aliases.school),
    department: getString(row, aliases.department),
    campus: getString(row, aliases.campus),
    descriptorText: getString(row, aliases.descriptorText),
    raw: row,
    rowNumber: index + 2,
    sourceIdentifier: getString(row, aliases.moduleCode) ?? `row-${index + 2}`,
  };
}

export function normalizeManualInput(input: NormalizedModuleInput): NormalizedModuleInput {
  return {
    ...input,
    moduleCode: input.moduleCode?.trim() || undefined,
    moduleTitle: input.moduleTitle?.trim() || undefined,
    stage: input.stage?.trim() || undefined,
    semester: input.semester?.trim() || undefined,
    school: input.school?.trim() || undefined,
    department: input.department?.trim() || undefined,
    campus: input.campus?.trim() || undefined,
    descriptorText: input.descriptorText?.trim() || undefined,
    sections: input.sections?.map((section, index) => normalizeDescriptorSection(section, index)),
  };
}
