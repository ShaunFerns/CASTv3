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

async function main() {
  await client.connect();
  await client.query("begin");
  try {
    const greenComp = await one(`
      select f.id as framework_id, fv.id as framework_version_id
      from frameworks f
      join framework_versions fv on fv.framework_id = f.id
      where f.institution_id is null and f.key = 'greencomp' and fv.version_label = '2022'
      limit 1
    `);
    assert(greenComp, "GreenComp framework seed is missing");

    const frameworkCounts = await one(`
      select
        (select count(*) from competency_domains where framework_version_id = $1)::int as domains,
        (select count(*) from competencies where framework_version_id = $1)::int as competencies,
        (select count(*) from lenses where institution_id is null and key = 'greencomp-curriculum-evidence')::int as lenses,
        (select count(*) from lens_framework_bindings where framework_version_id = $1)::int as bindings
    `, [greenComp.framework_version_id]);
    assert(frameworkCounts.domains === 4, `Expected 4 GreenComp domains, got ${frameworkCounts.domains}`);
    assert(frameworkCounts.competencies === 12, `Expected 12 GreenComp competences, got ${frameworkCounts.competencies}`);
    assert(frameworkCounts.lenses === 1, "Expected GreenComp lens");
    assert(frameworkCounts.bindings >= 1, "Expected GreenComp lens/framework binding");

    const competency = await one(`
      select c.id, c.key, c.name, cd.id as domain_id, cd.name as domain_name
      from competencies c
      join competency_domains cd on cd.id = c.competency_domain_id
      where c.framework_version_id = $1 and c.key = 'systems-thinking'
      limit 1
    `, [greenComp.framework_version_id]);
    assert(competency, "Expected systems-thinking competency");

    const institution = await one(`
      insert into institutions(name, slug, status, settings)
      values ('CAST Phase 5B Smoke Institution', 'cast-phase5b-smoke', 'active', '{"smoke":true}'::jsonb)
      returning id
    `);
    const sourceSystem = await one(`
      insert into source_systems(institution_id, key, name, system_type, metadata)
      values ($1, 'phase5b-akari', 'Phase 5B Akari', 'akari', '{"smoke":true}'::jsonb)
      returning id
    `, [institution.id]);
    const batch = await one(`
      insert into import_batches(institution_id, source_system_id, batch_type, status, external_batch_id, summary)
      values ($1, $2, 'programme_structure', 'completed', 'phase5b', '{"smoke":true}'::jsonb)
      returning id
    `, [institution.id, sourceSystem.id]);
    const record = await one(`
      insert into source_records(institution_id, import_batch_id, source_system_id, record_type, status, source_identifier, payload)
      values ($1, $2, $3, 'structure_item', 'parsed', 'P5B-STRUCT-1', '{"smoke":true}'::jsonb)
      returning id
    `, [institution.id, batch.id, sourceSystem.id]);
    const sourceProgramme = await one(`
      insert into source_programmes(institution_id, import_batch_id, source_system_id, source_record_id, external_id, code, name, raw_payload)
      values ($1, $2, $3, $4, 'P5B-PROG', 'P5B-PROG', 'Phase 5B Smoke Programme', '{"smoke":true}'::jsonb)
      returning id
    `, [institution.id, batch.id, sourceSystem.id, record.id]);
    const sourceModule = await one(`
      insert into source_modules(institution_id, import_batch_id, source_system_id, source_record_id, external_id, module_code, module_title, credits, descriptor_text, raw_payload)
      values ($1, $2, $3, $4, 'P5B-MOD-1', 'P5B-MOD-1', 'GreenComp Smoke Module', '5', 'Sustainability systems thinking descriptor.', '{"smoke":true}'::jsonb)
      returning id
    `, [institution.id, batch.id, sourceSystem.id, record.id]);
    const sourceItem = await one(`
      insert into source_structure_items(institution_id, import_batch_id, source_system_id, source_record_id, source_programme_id, source_module_id, external_id, stage, semester, pathway, core_option, credits, raw_payload)
      values ($1, $2, $3, $4, $5, $6, 'P5B-ITEM-1', '1', '1', 'Common', 'core', '5', '{"smoke":true}'::jsonb)
      returning id
    `, [institution.id, batch.id, sourceSystem.id, record.id, sourceProgramme.id, sourceModule.id]);
    const module = await one(`
      insert into modules(institution_id, source_module_id, module_code, module_title, status, default_credits, metadata)
      values ($1, $2, 'P5B-MOD-1', 'GreenComp Smoke Module', 'active', 5, '{"smoke":true}'::jsonb)
      returning id
    `, [institution.id, sourceModule.id]);
    const descriptor = await one(`
      insert into module_descriptors(institution_id, module_id, source_module_id, version_label, status, descriptor_text, source_type, metadata)
      values ($1, $2, $3, 'phase5b', 'active', 'Sustainability systems thinking descriptor.', 'smoke', '{"smoke":true}'::jsonb)
      returning id
    `, [institution.id, module.id, sourceModule.id]);
    const section = await one(`
      insert into descriptor_sections(institution_id, module_descriptor_id, section_type, title, content, order_index)
      values ($1, $2, 'learning_outcomes', 'Learning outcomes', 'Students analyse sustainability problems using systems thinking.', 1)
      returning id
    `, [institution.id, descriptor.id]);
    const programme = await one(`
      insert into programme_versions(institution_id, source_programme_id, programme_key, programme_code, programme_name, version_label, status, academic_year, metadata)
      values ($1, $2, 'P5B-PROG', 'P5B-PROG', 'Phase 5B Smoke Programme', 'Draft', 'draft', '2026/27', '{"smoke":true}'::jsonb)
      returning id
    `, [institution.id, sourceProgramme.id]);
    const structure = await one(`
      insert into curated_structures(institution_id, programme_version_id, source_programme_id, key, name, status, metadata)
      values ($1, $2, $3, 'primary', 'Phase 5B Smoke Structure', 'draft', '{"smoke":true}'::jsonb)
      returning id
    `, [institution.id, programme.id, sourceProgramme.id]);
    const group = await one(`
      insert into curated_structure_groups(institution_id, curated_structure_id, group_type, key, name, stage, semester, order_index)
      values ($1, $2, 'semester', 'stage-1-semester-1', 'Semester 1', '1', '1', 1)
      returning id
    `, [institution.id, structure.id]);
    const item = await one(`
      insert into curated_structure_items(institution_id, curated_structure_id, curated_structure_group_id, module_id, module_descriptor_id, source_structure_item_id, source_module_id, item_type, core_option, stage, semester, pathway, credits, label, metadata)
      values ($1, $2, $3, $4, $5, $6, $7, 'module', 'core', '1', '1', 'Common', 5, 'GreenComp Smoke Module', '{"smoke":true}'::jsonb)
      returning id
    `, [institution.id, structure.id, group.id, module.id, descriptor.id, sourceItem.id, sourceModule.id]);
    const evidence = await one(`
      insert into evidence_items(institution_id, descriptor_section_id, programme_version_id, module_id, curated_structure_item_id, source_kind, evidence_text, confidence, status, metadata)
      values ($1, $2, $3, $4, $5, 'descriptor_section', 'Students analyse sustainability problems using systems thinking.', 1, 'extracted', '{"smoke":true}'::jsonb)
      returning id
    `, [institution.id, section.id, programme.id, module.id, item.id]);
    const evaluation = await one(`
      insert into competency_evaluations(institution_id, programme_version_id, competency_id, curated_structure_item_id, module_id, module_descriptor_id, observed_level, source, status, confidence, rationale, metadata)
      values ($1, $2, $3, $4, $5, $6, 'developing', 'human', 'needs_review', 0.9, 'Smoke non-AI evidence-informed GreenComp evaluation.', '{"framework":"greencomp","phase":"5B","aiClassification":false}'::jsonb)
      returning id, observed_level, status
    `, [institution.id, programme.id, competency.id, item.id, module.id, descriptor.id]);
    await client.query(`
      insert into competency_evaluation_evidence_links(competency_evaluation_id, evidence_item_id, relevance, notes)
      values ($1, $2, 0.9, 'Phase 5B smoke evidence link.')
    `, [evaluation.id, evidence.id]);

    const coverage = await one(`
      select
        (select count(*) from competencies where framework_version_id = $1)::int as total_competences,
        (select count(distinct ce.competency_id) from competency_evaluations ce where ce.programme_version_id = $2)::int as observed_competences,
        (select count(distinct ce.module_id) from competency_evaluations ce where ce.programme_version_id = $2 and ce.module_id is not null)::int as modules_with_greencomp,
        (select count(*) from competency_evaluations ce where ce.programme_version_id = $2 and ce.observed_level = 'developing')::int as developing_count,
        (select count(*) from competency_evaluation_evidence_links ceel join competency_evaluations ce on ce.id = ceel.competency_evaluation_id where ce.programme_version_id = $2)::int as evidence_links,
        (select count(*) from competency_evaluations ce where ce.programme_version_id = $2 and ce.status = 'needs_review')::int as needs_review_count
    `, [greenComp.framework_version_id, programme.id]);

    assert(coverage.total_competences === 12, "Expected 12 total GreenComp competences");
    assert(coverage.observed_competences === 1, "Expected one observed GreenComp competence");
    assert(coverage.modules_with_greencomp === 1, "Expected one module with GreenComp evidence");
    assert(coverage.developing_count === 1, "Expected one Developing evidence-maturity evaluation");
    assert(coverage.evidence_links === 1, "Expected one linked evidence item");
    assert(coverage.needs_review_count === 1, "Expected evaluation to be needs_review");

    console.log("PHASE5B_GREENCOMP_SMOKE=passed");
    console.log(`PROGRAMME_VERSION_ID=${programme.id}`);
    console.log(`COMPETENCY=${competency.key}`);
    console.log(`DOMAIN=${competency.domain_name}`);
    console.log(`EVALUATION_ID=${evaluation.id}`);
    console.log(`TOTAL_GREENCOMP_COMPETENCES=${coverage.total_competences}`);
    console.log(`OBSERVED_COMPETENCES=${coverage.observed_competences}`);
    console.log(`MODULES_WITH_GREENCOMP=${coverage.modules_with_greencomp}`);
    console.log(`DEVELOPING_COUNT=${coverage.developing_count}`);
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
