import { createRequire } from "node:module";
import process from "node:process";

const requireFromDb = createRequire(new URL("../../lib/db/package.json", import.meta.url));
const pg = requireFromDb("pg");
const { Client } = pg;

function databaseClient() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const databaseUrl = new URL(process.env.DATABASE_URL);
  const requestedSslMode = databaseUrl.searchParams.get("sslmode");
  databaseUrl.searchParams.delete("sslmode");
  return new Client({
    connectionString: databaseUrl.toString(),
    ssl: requestedSslMode ? { rejectUnauthorized: false } : undefined,
  });
}

async function one(client, sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows[0];
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export async function runFrameworkLayerValidation(config) {
  const client = databaseClient();
  await client.connect();
  await client.query("begin");
  try {
    const framework = await one(
      client,
      `
        select f.id as framework_id, fv.id as framework_version_id
        from frameworks f
        join framework_versions fv on fv.framework_id = f.id
        where f.institution_id is null and f.key = $1 and fv.version_label = $2
        limit 1
      `,
      [config.frameworkKey, config.versionLabel],
    );
    assert(framework, `${config.frameworkName} framework seed is missing`);

    const counts = await one(
      client,
      `
        select
          (select count(*) from competency_domains where framework_version_id = $1)::int as domains,
          (select count(*) from competencies where framework_version_id = $1)::int as competencies,
          (select count(*) from lenses where institution_id is null and key = $2)::int as lenses,
          (select count(*) from lens_framework_bindings where framework_version_id = $1)::int as bindings
      `,
      [framework.framework_version_id, config.lensKey],
    );
    assert(counts.domains === config.expectedDomains, `Expected ${config.expectedDomains} ${config.frameworkName} domains, got ${counts.domains}`);
    assert(counts.competencies === config.expectedCompetencies, `Expected ${config.expectedCompetencies} ${config.frameworkName} competencies, got ${counts.competencies}`);
    assert(counts.lenses === 1, `Expected ${config.frameworkName} lens`);
    assert(counts.bindings >= 1, `Expected ${config.frameworkName} lens/framework binding`);

    const competency = await one(
      client,
      `
        select c.id, c.key, c.name, cd.id as domain_id, cd.name as domain_name
        from competencies c
        join competency_domains cd on cd.id = c.competency_domain_id
        where c.framework_version_id = $1 and c.key = $2
        limit 1
      `,
      [framework.framework_version_id, config.competencyKey],
    );
    assert(competency, `Expected ${config.competencyKey} competency`);

    const slug = `cast-${config.frameworkKey}-phase5-smoke`;
    const institution = await one(client, `insert into institutions(name, slug, status, settings) values ($1, $2, 'active', '{"smoke":true}'::jsonb) returning id`, [
      `CAST ${config.frameworkName} Phase 5 Smoke Institution`,
      slug,
    ]);
    const sourceSystem = await one(client, `insert into source_systems(institution_id, key, name, system_type, metadata) values ($1, $2, $3, 'akari', '{"smoke":true}'::jsonb) returning id`, [
      institution.id,
      `${config.frameworkKey}-akari`,
      `${config.frameworkName} Akari`,
    ]);
    const batch = await one(client, `insert into import_batches(institution_id, source_system_id, batch_type, status, external_batch_id, summary) values ($1, $2, 'programme_structure', 'completed', $3, '{"smoke":true}'::jsonb) returning id`, [
      institution.id,
      sourceSystem.id,
      `phase5-${config.frameworkKey}`,
    ]);
    const record = await one(client, `insert into source_records(institution_id, import_batch_id, source_system_id, record_type, status, source_identifier, payload) values ($1, $2, $3, 'structure_item', 'parsed', $4, '{"smoke":true}'::jsonb) returning id`, [
      institution.id,
      batch.id,
      sourceSystem.id,
      `P5-${config.frameworkKey.toUpperCase()}-STRUCT-1`,
    ]);
    const sourceProgramme = await one(client, `insert into source_programmes(institution_id, import_batch_id, source_system_id, source_record_id, external_id, code, name, raw_payload) values ($1, $2, $3, $4, $5, $5, $6, '{"smoke":true}'::jsonb) returning id`, [
      institution.id,
      batch.id,
      sourceSystem.id,
      record.id,
      `P5-${config.frameworkKey.toUpperCase()}-PROG`,
      `${config.frameworkName} Smoke Programme`,
    ]);
    const sourceModule = await one(client, `insert into source_modules(institution_id, import_batch_id, source_system_id, source_record_id, external_id, module_code, module_title, credits, descriptor_text, raw_payload) values ($1, $2, $3, $4, $5, $6, $7, '5', $8, '{"smoke":true}'::jsonb) returning id`, [
      institution.id,
      batch.id,
      sourceSystem.id,
      record.id,
      `P5-${config.frameworkKey.toUpperCase()}-MOD-1`,
      `P5-${config.frameworkKey.toUpperCase()}-MOD-1`,
      `${config.frameworkName} Smoke Module`,
      config.evidenceText,
    ]);
    const sourceItem = await one(client, `insert into source_structure_items(institution_id, import_batch_id, source_system_id, source_record_id, source_programme_id, source_module_id, external_id, stage, semester, pathway, core_option, credits, raw_payload) values ($1, $2, $3, $4, $5, $6, $7, '1', '1', 'Common', 'core', '5', '{"smoke":true}'::jsonb) returning id`, [
      institution.id,
      batch.id,
      sourceSystem.id,
      record.id,
      sourceProgramme.id,
      sourceModule.id,
      `P5-${config.frameworkKey.toUpperCase()}-ITEM-1`,
    ]);
    const module = await one(client, `insert into modules(institution_id, source_module_id, module_code, module_title, status, default_credits, metadata) values ($1, $2, $3, $4, 'active', 5, '{"smoke":true}'::jsonb) returning id`, [
      institution.id,
      sourceModule.id,
      `P5-${config.frameworkKey.toUpperCase()}-MOD-1`,
      `${config.frameworkName} Smoke Module`,
    ]);
    const descriptor = await one(client, `insert into module_descriptors(institution_id, module_id, source_module_id, version_label, status, descriptor_text, source_type, metadata) values ($1, $2, $3, 'phase5', 'active', $4, 'smoke', '{"smoke":true}'::jsonb) returning id`, [
      institution.id,
      module.id,
      sourceModule.id,
      config.evidenceText,
    ]);
    const section = await one(client, `insert into descriptor_sections(institution_id, module_descriptor_id, section_type, title, content, order_index) values ($1, $2, 'learning_outcomes', 'Learning outcomes', $3, 1) returning id`, [
      institution.id,
      descriptor.id,
      config.evidenceText,
    ]);
    const programme = await one(client, `insert into programme_versions(institution_id, source_programme_id, programme_key, programme_code, programme_name, version_label, status, academic_year, metadata) values ($1, $2, $3, $3, $4, 'Draft', 'draft', '2026/27', '{"smoke":true}'::jsonb) returning id`, [
      institution.id,
      sourceProgramme.id,
      `P5-${config.frameworkKey.toUpperCase()}-PROG`,
      `${config.frameworkName} Smoke Programme`,
    ]);
    const structure = await one(client, `insert into curated_structures(institution_id, programme_version_id, source_programme_id, key, name, status, metadata) values ($1, $2, $3, 'primary', $4, 'draft', '{"smoke":true}'::jsonb) returning id`, [
      institution.id,
      programme.id,
      sourceProgramme.id,
      `${config.frameworkName} Smoke Structure`,
    ]);
    const group = await one(client, `insert into curated_structure_groups(institution_id, curated_structure_id, group_type, key, name, stage, semester, order_index) values ($1, $2, 'semester', 'stage-1-semester-1', 'Semester 1', '1', '1', 1) returning id`, [
      institution.id,
      structure.id,
    ]);
    const item = await one(client, `insert into curated_structure_items(institution_id, curated_structure_id, curated_structure_group_id, module_id, module_descriptor_id, source_structure_item_id, source_module_id, item_type, core_option, stage, semester, pathway, credits, label, metadata) values ($1, $2, $3, $4, $5, $6, $7, 'module', 'core', '1', '1', 'Common', 5, $8, '{"smoke":true}'::jsonb) returning id`, [
      institution.id,
      structure.id,
      group.id,
      module.id,
      descriptor.id,
      sourceItem.id,
      sourceModule.id,
      `${config.frameworkName} Smoke Module`,
    ]);
    const evidence = await one(client, `insert into evidence_items(institution_id, descriptor_section_id, programme_version_id, module_id, curated_structure_item_id, source_kind, evidence_text, confidence, status, metadata) values ($1, $2, $3, $4, $5, 'descriptor_section', $6, 1, 'extracted', '{"smoke":true}'::jsonb) returning id`, [
      institution.id,
      section.id,
      programme.id,
      module.id,
      item.id,
      config.evidenceText,
    ]);
    const expectation = await one(client, `insert into programme_competency_expectations(institution_id, programme_version_id, competency_id, scope, expected_level, rationale, metadata) values ($1, $2, $3, 'programme', $4, $5, '{"smoke":true}'::jsonb) returning id, expected_level`, [
      institution.id,
      programme.id,
      competency.id,
      config.expectedLevel,
      `Smoke expected evidence maturity for ${config.frameworkName}.`,
    ]);
    const evaluation = await one(client, `insert into competency_evaluations(institution_id, programme_version_id, competency_id, curated_structure_item_id, module_id, module_descriptor_id, observed_level, source, status, confidence, rationale, metadata) values ($1, $2, $3, $4, $5, $6, $7, 'human', 'needs_review', 0.9, $8, $9::jsonb) returning id, observed_level, status`, [
      institution.id,
      programme.id,
      competency.id,
      item.id,
      module.id,
      descriptor.id,
      config.observedLevel,
      `Smoke non-AI evidence-informed ${config.frameworkName} evaluation.`,
      JSON.stringify({ framework: config.frameworkKey, phase: config.phase, aiClassification: false }),
    ]);
    await client.query(`insert into competency_evaluation_evidence_links(competency_evaluation_id, evidence_item_id, relevance, notes) values ($1, $2, 0.9, $3)`, [
      evaluation.id,
      evidence.id,
      `${config.frameworkName} smoke evidence link.`,
    ]);

    const coverage = await one(
      client,
      `
        select
          (select count(*) from competencies where framework_version_id = $1)::int as total_competences,
          (select count(distinct pce.competency_id) from programme_competency_expectations pce where pce.programme_version_id = $2 and pce.expected_level <> 'none')::int as expected_competences,
          (select count(distinct ce.competency_id) from competency_evaluations ce where ce.programme_version_id = $2)::int as observed_competences,
          (select count(distinct ce.module_id) from competency_evaluations ce where ce.programme_version_id = $2 and ce.module_id is not null)::int as modules_with_framework,
          (select count(*) from competency_evaluations ce where ce.programme_version_id = $2 and ce.observed_level = $3)::int as observed_level_count,
          (select count(*) from competency_evaluation_evidence_links ceel join competency_evaluations ce on ce.id = ceel.competency_evaluation_id where ce.programme_version_id = $2)::int as evidence_links,
          (select count(*) from competency_evaluations ce where ce.programme_version_id = $2 and ce.status = 'needs_review')::int as needs_review_count
      `,
      [framework.framework_version_id, programme.id, config.observedLevel],
    );

    assert(coverage.total_competences === config.expectedCompetencies, `Expected ${config.expectedCompetencies} total ${config.frameworkName} competencies`);
    assert(coverage.expected_competences === 1, `Expected one ${config.frameworkName} expectation`);
    assert(coverage.observed_competences === 1, `Expected one observed ${config.frameworkName} competency`);
    assert(coverage.modules_with_framework === 1, `Expected one module with ${config.frameworkName} evidence`);
    assert(coverage.observed_level_count === 1, `Expected one ${config.observedLevel} evidence-maturity evaluation`);
    assert(coverage.evidence_links === 1, "Expected one linked evidence item");
    assert(coverage.needs_review_count === 1, "Expected evaluation to be needs_review");

    console.log(`${config.outputKey}=passed`);
    console.log(`PROGRAMME_VERSION_ID=${programme.id}`);
    console.log(`COMPETENCY=${competency.key}`);
    console.log(`DOMAIN=${competency.domain_name}`);
    console.log(`EXPECTATION_ID=${expectation.id}`);
    console.log(`EVALUATION_ID=${evaluation.id}`);
    console.log(`TOTAL_COMPETENCES=${coverage.total_competences}`);
    console.log(`EXPECTED_COMPETENCES=${coverage.expected_competences}`);
    console.log(`OBSERVED_COMPETENCES=${coverage.observed_competences}`);
    console.log(`MODULES_WITH_FRAMEWORK=${coverage.modules_with_framework}`);
    console.log(`OBSERVED_LEVEL_COUNT=${coverage.observed_level_count}`);
    console.log(`EVIDENCE_LINKS=${coverage.evidence_links}`);
    console.log(`NEEDS_REVIEW=${coverage.needs_review_count}`);

    await client.query("rollback");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

export function runValidation(config) {
  runFrameworkLayerValidation(config).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
