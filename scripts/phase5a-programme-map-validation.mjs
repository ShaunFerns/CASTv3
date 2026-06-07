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

async function scalar(sql, params = []) {
  const result = await one(sql, params);
  return Number(Object.values(result)[0]);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  await client.connect();
  await client.query("begin");
  try {
    const institution = await one(`
      insert into institutions(name, slug, status, settings)
      values ('CAST Phase 5A Smoke Institution', 'cast-phase5a-smoke', 'active', '{"smoke":true}'::jsonb)
      returning id
    `);
    const sourceSystem = await one(`
      insert into source_systems(institution_id, key, name, system_type, metadata)
      values ($1, 'phase5a-akari', 'Phase 5A Akari', 'akari', '{"smoke":true}'::jsonb)
      returning id
    `, [institution.id]);
    const batch = await one(`
      insert into import_batches(institution_id, source_system_id, batch_type, status, external_batch_id, summary)
      values ($1, $2, 'programme_structure', 'completed', 'phase5a', '{"smoke":true}'::jsonb)
      returning id
    `, [institution.id, sourceSystem.id]);
    const record = await one(`
      insert into source_records(institution_id, import_batch_id, source_system_id, record_type, status, source_identifier, payload)
      values ($1, $2, $3, 'structure_item', 'parsed', 'P5A-STRUCT-1', '{"smoke":true}'::jsonb)
      returning id
    `, [institution.id, batch.id, sourceSystem.id]);
    const sourceProgramme = await one(`
      insert into source_programmes(institution_id, import_batch_id, source_system_id, source_record_id, external_id, code, name, raw_payload)
      values ($1, $2, $3, $4, 'P5A-PROG', 'P5A-PROG', 'Phase 5A Smoke Programme', '{"smoke":true}'::jsonb)
      returning id
    `, [institution.id, batch.id, sourceSystem.id, record.id]);
    const sourceModule = await one(`
      insert into source_modules(institution_id, import_batch_id, source_system_id, source_record_id, external_id, module_code, module_title, credits, descriptor_text, raw_payload)
      values ($1, $2, $3, $4, 'P5A-MOD-1', 'P5A-MOD-1', 'Layered Map Smoke Module', '5', 'Descriptor text for map smoke.', '{"smoke":true}'::jsonb)
      returning id
    `, [institution.id, batch.id, sourceSystem.id, record.id]);
    const sourceItem = await one(`
      insert into source_structure_items(institution_id, import_batch_id, source_system_id, source_record_id, source_programme_id, source_module_id, external_id, stage, semester, pathway, group_name, core_option, credits, raw_payload)
      values ($1, $2, $3, $4, $5, $6, 'P5A-ITEM-1', '1', '1', 'Common', 'Core modules', 'core', '5', '{"smoke":true}'::jsonb)
      returning id
    `, [institution.id, batch.id, sourceSystem.id, record.id, sourceProgramme.id, sourceModule.id]);
    const module = await one(`
      insert into modules(institution_id, source_module_id, module_code, module_title, status, default_credits, metadata)
      values ($1, $2, 'P5A-MOD-1', 'Layered Map Smoke Module', 'active', 5, '{"smoke":true}'::jsonb)
      returning id
    `, [institution.id, sourceModule.id]);
    const descriptor = await one(`
      insert into module_descriptors(institution_id, module_id, source_module_id, version_label, status, descriptor_text, source_type, metadata)
      values ($1, $2, $3, 'phase5a', 'active', 'Descriptor text for map smoke.', 'smoke', '{"smoke":true}'::jsonb)
      returning id
    `, [institution.id, module.id, sourceModule.id]);
    const section = await one(`
      insert into descriptor_sections(institution_id, module_descriptor_id, section_type, title, content, order_index)
      values ($1, $2, 'learning_outcomes', 'Learning outcomes', 'Evidence-rich learning outcome.', 1)
      returning id
    `, [institution.id, descriptor.id]);
    const programme = await one(`
      insert into programme_versions(institution_id, source_programme_id, programme_key, programme_code, programme_name, version_label, status, academic_year, metadata)
      values ($1, $2, 'P5A-PROG', 'P5A-PROG', 'Phase 5A Smoke Programme', 'Draft', 'draft', '2026/27', '{"smoke":true}'::jsonb)
      returning id
    `, [institution.id, sourceProgramme.id]);
    const structure = await one(`
      insert into curated_structures(institution_id, programme_version_id, source_programme_id, key, name, status, metadata)
      values ($1, $2, $3, 'primary', 'Phase 5A Smoke Structure', 'draft', '{"smoke":true}'::jsonb)
      returning id
    `, [institution.id, programme.id, sourceProgramme.id]);
    const stage = await one(`
      insert into curated_structure_groups(institution_id, curated_structure_id, group_type, key, name, stage, order_index)
      values ($1, $2, 'stage', 'stage-1', 'Stage 1', '1', 1)
      returning id
    `, [institution.id, structure.id]);
    const semester = await one(`
      insert into curated_structure_groups(institution_id, curated_structure_id, parent_group_id, group_type, key, name, stage, semester, order_index)
      values ($1, $2, $3, 'semester', 'stage-1-semester-1', 'Semester 1', '1', '1', 1)
      returning id
    `, [institution.id, structure.id, stage.id]);
    const item = await one(`
      insert into curated_structure_items(institution_id, curated_structure_id, curated_structure_group_id, module_id, module_descriptor_id, source_structure_item_id, source_module_id, item_type, core_option, stage, semester, pathway, credits, label, metadata)
      values ($1, $2, $3, $4, $5, $6, $7, 'module', 'core', '1', '1', 'Common', 5, 'Layered Map Smoke Module', '{"smoke":true}'::jsonb)
      returning id
    `, [institution.id, structure.id, semester.id, module.id, descriptor.id, sourceItem.id, sourceModule.id]);
    await client.query(`
      insert into reconciliation_links(institution_id, source_type, source_id, target_type, target_id, status, confidence, rationale, metadata)
      values ($1, 'source_structure_item', $2, 'curated_structure_item', $3, 'confirmed', 0.95, 'Phase 5A smoke reconciliation.', '{"smoke":true}'::jsonb)
    `, [institution.id, sourceItem.id, item.id]);
    await one(`
      insert into evidence_items(institution_id, descriptor_section_id, programme_version_id, module_id, curated_structure_item_id, source_kind, evidence_text, confidence, status, metadata)
      values ($1, $2, $3, $4, $5, 'descriptor_section', 'Evidence-rich learning outcome.', 1, 'extracted', '{"smoke":true}'::jsonb)
      returning id
    `, [institution.id, section.id, programme.id, module.id, item.id]);
    const qualityRule = await one(`
      insert into data_quality_rules(key, name, description, category, default_severity, status, implementation_key, rule_definition, is_system_managed)
      values ('programme.item_missing_descriptor.phase5a', 'Phase 5A smoke descriptor check', 'Smoke data quality rule.', 'completeness', 'warning', 'active', 'phase5a.smoke', '{"smoke":true}'::jsonb, true)
      returning id
    `);
    const qualityRun = await one(`
      insert into data_quality_runs(institution_id, programme_version_id, curated_structure_id, status, trigger, scope, started_at, completed_at, summary)
      values ($1, $2, $3, 'completed_with_issues', 'api', '{"smoke":true}'::jsonb, now(), now(), '{"issueCount":1}'::jsonb)
      returning id
    `, [institution.id, programme.id, structure.id]);
    const qualityResult = await one(`
      insert into data_quality_results(institution_id, data_quality_run_id, data_quality_rule_id, severity, fingerprint, title, message, details)
      values ($1, $2, $3, 'warning', 'phase5a', 'Phase 5A smoke quality signal', 'Smoke quality indicator.', '{"smoke":true}'::jsonb)
      returning id
    `, [institution.id, qualityRun.id, qualityRule.id]);
    await client.query(`
      insert into data_quality_result_links(data_quality_result_id, curated_structure_item_id, relationship)
      values ($1, $2, 'quality_target')
    `, [qualityResult.id, item.id]);
    const framework = await one(`
      insert into frameworks(institution_id, key, name, owner_type, status, metadata)
      values ($1, 'phase5a-framework', 'Phase 5A Institutional Framework', 'institution', 'active', '{"family":"institutional","smoke":true}'::jsonb)
      returning id
    `, [institution.id]);
    const frameworkVersion = await one(`
      insert into framework_versions(framework_id, version_label, status, definition, notes)
      values ($1, '2026', 'active', '{"smoke":true}'::jsonb, 'Phase 5A smoke version')
      returning id
    `, [framework.id]);
    const domain = await one(`
      insert into competency_domains(framework_version_id, key, name, order_index)
      values ($1, 'domain', 'Smoke Domain', 1)
      returning id
    `, [frameworkVersion.id]);
    const competency = await one(`
      insert into competencies(framework_version_id, competency_domain_id, key, name, order_index)
      values ($1, $2, 'competency', 'Smoke Competency', 1)
      returning id
    `, [frameworkVersion.id, domain.id]);
    await client.query(`
      insert into programme_competency_expectations(institution_id, programme_version_id, competency_id, scope, module_id, expected_level, rationale)
      values ($1, $2, $3, 'module', $4, 'developing', 'Phase 5A smoke expectation.')
    `, [institution.id, programme.id, competency.id, module.id]);
    const attribute = await one(`
      insert into programme_graduate_attributes(institution_id, programme_version_id, key, name, status, order_index)
      values ($1, $2, 'pga', 'Smoke Programme Attribute', 'active', 1)
      returning id
    `, [institution.id, programme.id]);
    await client.query(`
      insert into programme_attribute_expectations(institution_id, programme_version_id, programme_graduate_attribute_id, scope, module_id, expected_level, rationale)
      values ($1, $2, $3, 'module', $4, 'consolidating', 'Phase 5A smoke attribute expectation.')
    `, [institution.id, programme.id, attribute.id, module.id]);

    const modulePlacements = await scalar(`select count(*) from curated_structure_items where curated_structure_id = $1`, [structure.id]);
    const evidenceCount = await scalar(`select count(*) from evidence_items where curated_structure_item_id = $1`, [item.id]);
    const qualityCount = await scalar(`
      select count(*)
      from data_quality_result_links dqrl
      join data_quality_results dqr on dqr.id = dqrl.data_quality_result_id
      where dqrl.curated_structure_item_id = $1
    `, [item.id]);
    const frameworkCount = await scalar(`select count(*) from frameworks where institution_id = $1`, [institution.id]);
    const programmeLayerCount = await scalar(`select count(*) from programme_graduate_attributes where programme_version_id = $1`, [programme.id]);
    const expectationCount = await scalar(`
      select
        (select count(*) from programme_competency_expectations where programme_version_id = $1)
        +
        (select count(*) from programme_attribute_expectations where programme_version_id = $1) as total
    `, [programme.id]);

    assert(modulePlacements === 1, "Expected one curated module placement");
    assert(evidenceCount === 1, "Expected one evidence item linked to the map placement");
    assert(qualityCount === 1, "Expected one data quality indicator linked to the map placement");
    assert(frameworkCount === 1, "Expected one institution framework");
    assert(programmeLayerCount === 1, "Expected one programme-owned attribute layer source");
    assert(expectationCount === 2, "Expected competency and attribute expectations");

    console.log("PHASE5A_PROGRAMME_MAP_SMOKE=passed");
    console.log(`PROGRAMME_VERSION_ID=${programme.id}`);
    console.log(`CURATED_STRUCTURE_ID=${structure.id}`);
    console.log(`MODULE_PLACEMENTS=${modulePlacements}`);
    console.log(`EVIDENCE_ITEMS=${evidenceCount}`);
    console.log(`QUALITY_INDICATORS=${qualityCount}`);
    console.log(`FRAMEWORKS=${frameworkCount}`);
    console.log(`PROGRAMME_ATTRIBUTE_LAYERS=${programmeLayerCount}`);
    console.log(`EXPECTATIONS=${expectationCount}`);

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
