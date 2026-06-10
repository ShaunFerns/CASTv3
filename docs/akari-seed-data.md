# CAST v3 Synthetic Akari Seed Data

`tools/seed-data/akari-seed-generator.ts` creates a realistic synthetic Akari-compatible workbook for CAST v3 demonstrations, development, testing and training.

The generator preserves the worksheet names and column headers from `module_sections_multi_sheet_6_ids_w1.xlsx`. It writes the generated workbook to:

`sample-data/akari_seed_university_v1.xlsx`

## Workbook Structure

The workbook contains these worksheets:

- `Affiliated Programmes`
- `Module Assessments`
- `Learning Outcomes`
- `Requisites`
- `Assessment Threshold Label`
- `Sharing Arrangements`
- `Module Overview`
- `Indicative Syllabus`
- `Indicative Syllabus New Table`
- `Learning Teaching Methods`
- `Change Description`
- `Reassessment Requirement`
- `Derogations`
- `Module Modalities`

All sheets preserve the shared Akari module identifiers used by CAST imports:

- `Module Id`
- `Delivery Period Id`
- `Module Code`
- `Version`

## Generation Rules

The default dataset generates:

- 8 schools
- 12 programmes
- 144 modules
- 500+ programme affiliations
- 700+ learning outcomes
- 300+ assessment components
- realistic prerequisite chains
- realistic modality combinations
- shared modules across programmes
- descriptor sections likely to produce useful GreenComp, DigComp, EntreComp and LifeComp evidence

Assessment component weightings are generated to total 100% for each module.

## Configuration

Run the generator from the repository root:

```bash
pnpm --filter @workspace/seed-data-tools generate:akari
```

Supported options:

```bash
pnpm --filter @workspace/seed-data-tools generate:akari -- --schools=8 --programmes=12 --modules=144 --seed=20260610
pnpm --filter @workspace/seed-data-tools generate:akari -- --include-data-quality-issues
pnpm --filter @workspace/seed-data-tools generate:akari -- --output=sample-data/custom-akari.xlsx
```

Options:

- `--schools=<number>`: number of schools to use from the built-in school list.
- `--programmes=<number>`: number of programmes to use from the built-in programme list.
- `--modules=<number>`: target module count.
- `--seed=<number>`: deterministic random seed.
- `--include-data-quality-issues`: introduces a small number of controlled issues such as missing stage, missing semester, missing credits, duplicate placement rows and incomplete learning outcomes.
- `--output=<path>`: output workbook path.

## CAST Import Notes

The workbook is intended to be uploaded through the existing CAST v3 Upload Curriculum page using the Programme Data/Akari spreadsheet path. The generator does not change the import pipeline and does not require special handling.

Use the default dataset for clean demonstrations. Regenerate with `--include-data-quality-issues` when testing CAST data-quality dashboards and diagnostics.
