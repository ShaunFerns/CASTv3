import { createRequire } from "node:module";
import process from "node:process";

const requireFromDb = createRequire(new URL("../lib/db/package.json", import.meta.url));
const pg = requireFromDb("pg");
const { Client } = pg;

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const databaseUrl = new URL(process.env.DATABASE_URL);
const requestedSslMode = databaseUrl.searchParams.get("sslmode");
databaseUrl.searchParams.delete("sslmode");

const client = new Client({
  connectionString: databaseUrl.toString(),
  ssl: requestedSslMode ? { rejectUnauthorized: false } : undefined,
});

async function one(sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows[0];
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function layer(layerKey, versionLabel, lensKey, expectedDomains, expectedIndicators) {
  const row = await one(
    `
      select f.id as framework_id, fv.id as framework_version_id, lv.id as lens_version_id
      from frameworks f
      join framework_versions fv on fv.framework_id = f.id
      join lenses l on l.key = $3 and l.institution_id is null
      join lens_versions lv on lv.lens_id = l.id and lv.version_label = '1.0-evidence-v1'
      where f.institution_id is null and f.key = $1 and fv.version_label = $2
      limit 1
    `,
    [layerKey, versionLabel, lensKey],
  );
  assert(row, `${layerKey} seed is missing`);
  const counts = await one(
    `
      select
        (select count(*) from competency_domains where framework_version_id = $1)::int as domains,
        (select count(*) from competencies where framework_version_id = $1)::int as indicators,
        (select count(*) from lens_framework_bindings where framework_version_id = $1 and lens_version_id = $2)::int as bindings,
        (select count(*) from lens_evidence_rules where lens_version_id = $2)::int as rules,
        (select count(*) from lens_output_schemas where lens_version_id = $2)::int as output_schemas
    `,
    [row.framework_version_id, row.lens_version_id],
  );
  assert(counts.domains === expectedDomains, `Expected ${expectedDomains} ${layerKey} domains, got ${counts.domains}`);
  assert(counts.indicators === expectedIndicators, `Expected ${expectedIndicators} ${layerKey} indicators, got ${counts.indicators}`);
  assert(counts.bindings === 1, `Expected ${layerKey} lens binding`);
  assert(counts.rules >= 2, `Expected ${layerKey} lens evidence rules`);
  assert(counts.output_schemas === 1, `Expected ${layerKey} output schema`);
  return row;
}

async function indicator(frameworkVersionId, key) {
  const row = await one(
    `
      select c.id, c.key, c.name, cd.name as domain_name
      from competencies c
      join competency_domains cd on cd.id = c.competency_domain_id
      where c.framework_version_id = $1 and c.key = $2
      limit 1
    `,
    [frameworkVersionId, key],
  );
  assert(row, `Expected design indicator ${key}`);
  return row;
}

async function insertEvaluation(input) {
  const evaluation = await one(
    `
      insert into competency_evaluations(
        institution_id,
        programme_version_id,
        competency_id,
        lens_version_id,
        curated_structure_item_id,
        module_id,
        module_descriptor_id,
        observed_level,
        source,
        status,
        confidence,
        rationale,
        metadata
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, 'rule', 'needs_review', 1, $9, $10::jsonb)
      returning id, observed_level, status
    `,
    [
      input.institutionId,
      input.programmeVersionId,
      input.indicatorId,
      input.lensVersionId,
      input.itemId,
      input.moduleId,
      input.descriptorId,
      input.observedLevel,
      input.rationale,
      JSON.stringify({
        designLayer: input.layerKey,
        phase: "5J",
        aiClassification: false,
        institutionalJudgement: false,
      }),
    ],
  );
  await client.query(
    `
      insert into competency_evaluation_evidence_links(competency_evaluation_id, evidence_item_id, relevance, notes)
      values ($1, $2, 1, $3)
    `,
    [evaluation.id, input.evidenceItemId, `${input.layerKey} smoke evidence link.`],
  );
  return evaluation;
}

async function main() {
  await client.connect();
  await client.query("begin");
  try {
    const assessment = await layer("assessment-design", "1.0", "assessment-design-evidence", 6, 9);
    const modality = await layer("modality-design", "1.0", "modality-design-evidence", 5, 6);
    const weightingIndicator = await indicator(assessment.framework_version_id, "total-weighting-completeness");
    const typeMixIndicator = await indicator(assessment.framework_version_id, "assessment-type-mix");
    const modalityIndicator = await indicator(modality.framework_version_id, "current-planned-modality");
    const feasibilityIndicator = await indicator(modality.framework_version_id, "resource-feasibility-fit");

    const institution = await one(
      `insert into institutions(name, slug, status, settings) values ('CAST Phase 5J Smoke Institution', 'cast-phase5j-smoke', 'active', '{"smoke":true}'::jsonb) returning id`,
    );
    const module = await one(
      `insert into modules(institution_id, module_code, module_title, status, default_credits, metadata) values ($1, 'P5J-MOD-1', 'Curriculum Design Layer Smoke Module', 'active', 5, '{"smoke":true}'::jsonb) returning id`,
      [institution.id],
    );
    const descriptor = await one(
      `insert into module_descriptors(institution_id, module_id, version_label, status, descriptor_text, source_type, metadata) values ($1, $2, 'phase5j', 'active', $3, 'smoke', '{"smoke":true}'::jsonb) returning id`,
      [
        institution.id,
        module.id,
        "Assessment includes a portfolio and presentation with feedback. Teaching uses blended workshops, online activities and lab resources.",
      ],
    );
    const assessmentSection = await one(
      `insert into descriptor_sections(institution_id, module_descriptor_id, section_type, title, content, order_index) values ($1, $2, 'assessment', 'Assessment', $3, 1) returning id`,
      [
        institution.id,
        descriptor.id,
        "Portfolio 60% and presentation 40%. Feedback and review are included. Assessment is aligned to learning outcomes.",
      ],
    );
    const teachingSection = await one(
      `insert into descriptor_sections(institution_id, module_descriptor_id, section_type, title, content, order_index) values ($1, $2, 'teaching_and_learning_strategy', 'Teaching and learning', $3, 2) returning id`,
      [
        institution.id,
        descriptor.id,
        "Blended workshops, online activities, lab simulation and inclusive access support are used for the cohort.",
      ],
    );
    await one(
      `insert into learning_outcomes(institution_id, module_descriptor_id, descriptor_section_id, outcome_code, outcome_text, status) values ($1, $2, $3, 'MLO1', 'Apply design decisions to a curriculum scenario.', 'active') returning id`,
      [institution.id, descriptor.id, assessmentSection.id],
    );
    await one(
      `insert into assessment_components(institution_id, module_descriptor_id, descriptor_section_id, component_name, component_type, assessment_mode, weighting, description, status, metadata) values ($1, $2, $3, 'Portfolio', 'Portfolio', 'Individual', 60, 'Portfolio with feedback in week 8.', 'active', '{"week":"8","summative":true}'::jsonb) returning id`,
      [institution.id, descriptor.id, assessmentSection.id],
    );
    await one(
      `insert into assessment_components(institution_id, module_descriptor_id, descriptor_section_id, component_name, component_type, assessment_mode, weighting, description, status, metadata) values ($1, $2, $3, 'Presentation', 'Presentation', 'Group', 40, 'Group presentation in week 11.', 'active', '{"week":"11","summative":true}'::jsonb) returning id`,
      [institution.id, descriptor.id, assessmentSection.id],
    );
    const programme = await one(
      `insert into programme_versions(institution_id, programme_key, programme_code, programme_name, version_label, status, academic_year, mode_of_delivery, metadata) values ($1, 'P5J-PROG', 'P5J-PROG', 'Phase 5J Smoke Programme', 'Draft', 'draft', '2026/27', 'Blended', '{"smoke":true}'::jsonb) returning id`,
      [institution.id],
    );
    const structure = await one(
      `insert into curated_structures(institution_id, programme_version_id, key, name, status, metadata) values ($1, $2, 'primary', 'Phase 5J Smoke Structure', 'draft', '{"smoke":true}'::jsonb) returning id`,
      [institution.id, programme.id],
    );
    const group = await one(
      `insert into curated_structure_groups(institution_id, curated_structure_id, group_type, key, name, stage, semester, order_index) values ($1, $2, 'semester', 'stage-1-semester-1', 'Semester 1', '1', '1', 1) returning id`,
      [institution.id, structure.id],
    );
    const item = await one(
      `insert into curated_structure_items(institution_id, curated_structure_id, curated_structure_group_id, module_id, module_descriptor_id, item_type, core_option, stage, semester, pathway, credits, label, metadata) values ($1, $2, $3, $4, $5, 'module', 'core', '1', '1', 'Common', 5, 'Curriculum Design Layer Smoke Module', '{"smoke":true}'::jsonb) returning id`,
      [institution.id, structure.id, group.id, module.id, descriptor.id],
    );
    const evidence = await one(
      `insert into evidence_items(institution_id, descriptor_section_id, programme_version_id, module_id, curated_structure_item_id, source_kind, evidence_text, confidence, status, metadata) values ($1, $2, $3, $4, $5, 'descriptor_section', $6, 1, 'extracted', '{"smoke":true}'::jsonb) returning id`,
      [institution.id, teachingSection.id, programme.id, module.id, item.id, "Blended workshops, online activities, lab simulation and inclusive access support."],
    );

    await insertEvaluation({
      institutionId: institution.id,
      programmeVersionId: programme.id,
      indicatorId: weightingIndicator.id,
      lensVersionId: assessment.lens_version_id,
      itemId: item.id,
      moduleId: module.id,
      descriptorId: descriptor.id,
      observedLevel: "leading",
      rationale: "Smoke assessment weighting is complete.",
      layerKey: "assessment-design",
      evidenceItemId: evidence.id,
    });
    await insertEvaluation({
      institutionId: institution.id,
      programmeVersionId: programme.id,
      indicatorId: typeMixIndicator.id,
      lensVersionId: assessment.lens_version_id,
      itemId: item.id,
      moduleId: module.id,
      descriptorId: descriptor.id,
      observedLevel: "consolidating",
      rationale: "Smoke assessment type mix is evidenced.",
      layerKey: "assessment-design",
      evidenceItemId: evidence.id,
    });
    await insertEvaluation({
      institutionId: institution.id,
      programmeVersionId: programme.id,
      indicatorId: modalityIndicator.id,
      lensVersionId: modality.lens_version_id,
      itemId: item.id,
      moduleId: module.id,
      descriptorId: descriptor.id,
      observedLevel: "consolidating",
      rationale: "Smoke modality is evidenced as blended.",
      layerKey: "modality-design",
      evidenceItemId: evidence.id,
    });
    await insertEvaluation({
      institutionId: institution.id,
      programmeVersionId: programme.id,
      indicatorId: feasibilityIndicator.id,
      lensVersionId: modality.lens_version_id,
      itemId: item.id,
      moduleId: module.id,
      descriptorId: descriptor.id,
      observedLevel: "consolidating",
      rationale: "Smoke resource feasibility is evidenced.",
      layerKey: "modality-design",
      evidenceItemId: evidence.id,
    });

    const smoke = await one(
      `
        select
          (select count(*) from competency_evaluations ce join competencies c on c.id = ce.competency_id where ce.programme_version_id = $1 and c.framework_version_id = $2)::int as assessment_evaluations,
          (select count(*) from competency_evaluations ce join competencies c on c.id = ce.competency_id where ce.programme_version_id = $1 and c.framework_version_id = $3)::int as modality_evaluations,
          (select count(*) from competency_evaluation_evidence_links ceel join competency_evaluations ce on ce.id = ceel.competency_evaluation_id where ce.programme_version_id = $1)::int as evidence_links,
          (select count(distinct ce.module_id) from competency_evaluations ce join competencies c on c.id = ce.competency_id where ce.programme_version_id = $1 and c.framework_version_id in ($2, $3))::int as modules_with_design_layer_evidence
      `,
      [programme.id, assessment.framework_version_id, modality.framework_version_id],
    );
    assert(smoke.assessment_evaluations === 2, "Expected two assessment design evaluations");
    assert(smoke.modality_evaluations === 2, "Expected two modality design evaluations");
    assert(smoke.evidence_links === 4, "Expected four design layer evidence links");
    assert(smoke.modules_with_design_layer_evidence === 1, "Expected one module with design layer evidence");

    console.log("PHASE5J_CURRICULUM_DESIGN_LAYERS_SMOKE=passed");
    console.log(`PROGRAMME_VERSION_ID=${programme.id}`);
    console.log(`ASSESSMENT_INDICATORS=${smoke.assessment_evaluations}`);
    console.log(`MODALITY_INDICATORS=${smoke.modality_evaluations}`);
    console.log(`EVIDENCE_LINKS=${smoke.evidence_links}`);
    console.log(`MODULES_WITH_DESIGN_LAYER_EVIDENCE=${smoke.modules_with_design_layer_evidence}`);

    await client.query("rollback");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
