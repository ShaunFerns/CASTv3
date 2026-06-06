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

async function many(sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows;
}

async function createQualityRule(key, name) {
  return one(
    `
      insert into data_quality_rules(key, name, description, category, default_severity, status, implementation_key, rule_definition, is_system_managed)
      values ($1, $2, $2, 'mapping', 'warning', 'active', $1, '{"phase":"4B-smoke"}'::jsonb, true)
      returning id
    `,
    [key, name],
  );
}

async function linkReconciliation({ institutionId, sourceType, sourceId, targetType, targetId, rationale }) {
  return one(
    `
      insert into reconciliation_links(institution_id, source_type, source_id, target_type, target_id, status, confidence, rationale, metadata)
      values ($1, $2, $3, $4, $5, 'confirmed', 1, $6, '{"smoke":true}'::jsonb)
      returning id
    `,
    [institutionId, sourceType, sourceId, targetType, targetId, rationale],
  );
}

async function main() {
  await client.connect();
  await client.query("begin");
  try {
    const institution = await one(
      `
        insert into institutions(name, slug, status, settings)
        values ('CAST Phase 4B Smoke Institution', 'cast-phase4b-smoke', 'active', '{"smoke":true}'::jsonb)
        returning id
      `,
    );

    const ingestionRun = await one(
      `
        insert into ingestion_runs(institution_id, pathway, status, summary, metadata)
        values ($1, 'akari', 'completed', '{"smoke":true}'::jsonb, '{"phase":"4B"}'::jsonb)
        returning id
      `,
      [institution.id],
    );
    const sourceSystem = await one(
      `
        insert into source_systems(institution_id, key, name, system_type, metadata)
        values ($1, 'akari-phase4b-smoke', 'Akari Phase 4B Smoke', 'akari', '{"smoke":true}'::jsonb)
        returning id
      `,
      [institution.id],
    );
    const batch = await one(
      `
        insert into import_batches(institution_id, source_system_id, batch_type, status, external_batch_id, summary)
        values ($1, $2, 'programme_structure', 'completed', 'phase4b-smoke', '{"smoke":true}'::jsonb)
        returning id
      `,
      [institution.id, sourceSystem.id],
    );
    const sourceRecord = await one(
      `
        insert into source_records(institution_id, import_batch_id, source_system_id, record_type, status, source_identifier, payload)
        values ($1, $2, $3, 'structure_item', 'parsed', 'P4B-SMK-101', '{"smoke":true}'::jsonb)
        returning id
      `,
      [institution.id, batch.id, sourceSystem.id],
    );
    const sourceProgramme = await one(
      `
        insert into source_programmes(institution_id, import_batch_id, source_system_id, source_record_id, external_id, code, name, award, level, school, raw_payload)
        values ($1, $2, $3, $4, 'P4B-PROG', 'P4B-PROG', 'Phase 4B Smoke Programme', 'BSc', '8', 'Computing', '{"smoke":true}'::jsonb)
        returning id
      `,
      [institution.id, batch.id, sourceSystem.id, sourceRecord.id],
    );
    const sourceModule = await one(
      `
        insert into source_modules(institution_id, import_batch_id, source_system_id, source_record_id, external_id, module_code, module_title, credits, stage, semester, descriptor_text, raw_payload)
        values ($1, $2, $3, $4, 'P4B-MOD-101', 'P4B-MOD-101', 'Phase 4B Smoke Module', '5', '1', '1', 'Curated workspace smoke descriptor.', '{"smoke":true}'::jsonb)
        returning id
      `,
      [institution.id, batch.id, sourceSystem.id, sourceRecord.id],
    );
    const sourceStructureItem = await one(
      `
        insert into source_structure_items(institution_id, import_batch_id, source_system_id, source_record_id, source_programme_id, source_module_id, external_id, stage, semester, pathway, core_option, credits, raw_payload)
        values ($1, $2, $3, $4, $5, $6, 'P4B-STRUCT-101', '1', '1', 'Common', 'core', '5', '{"smoke":true}'::jsonb)
        returning id
      `,
      [institution.id, batch.id, sourceSystem.id, sourceRecord.id, sourceProgramme.id, sourceModule.id],
    );
    const ingestionItem = await one(
      `
        insert into ingestion_items(ingestion_run_id, institution_id, item_type, status, source_identifier, input_payload, normalized_payload)
        values ($1, $2, 'akari_structure_item', 'completed', 'P4B-STRUCT-101', '{"smoke":true}'::jsonb, '{"smoke":true}'::jsonb)
        returning id
      `,
      [ingestionRun.id, institution.id],
    );
    for (const [column, id] of [
      ["import_batch_id", batch.id],
      ["source_record_id", sourceRecord.id],
      ["source_programme_id", sourceProgramme.id],
      ["source_module_id", sourceModule.id],
      ["source_structure_item_id", sourceStructureItem.id],
    ]) {
      await client.query(
        `insert into ingestion_record_links(ingestion_run_id, ingestion_item_id, relationship, ${column}) values ($1, $2, 'created', $3)`,
        [ingestionRun.id, ingestionItem.id, id],
      );
    }

    const module = await one(
      `
        insert into modules(institution_id, source_module_id, module_code, module_title, status, default_credits, metadata)
        values ($1, $2, 'P4B-MOD-101', 'Phase 4B Smoke Module', 'active', 5, '{"smoke":true}'::jsonb)
        returning id
      `,
      [institution.id, sourceModule.id],
    );
    const descriptor = await one(
      `
        insert into module_descriptors(institution_id, module_id, source_module_id, version_label, status, descriptor_text, source_type, metadata)
        values ($1, $2, $3, 'phase4b-smoke', 'active', 'Curated workspace smoke descriptor.', 'ingestion_smoke', '{"smoke":true}'::jsonb)
        returning id
      `,
      [institution.id, module.id, sourceModule.id],
    );
    const programme = await one(
      `
        insert into programme_versions(institution_id, source_programme_id, programme_key, programme_code, programme_name, version_label, status, academic_year, award, level, school, metadata)
        values ($1, $2, 'P4B-PROG', 'P4B-PROG', 'Phase 4B Smoke Programme', 'Draft', 'draft', '2026/27', 'BSc', '8', 'Computing', '{"smoke":true}'::jsonb)
        returning id
      `,
      [institution.id, sourceProgramme.id],
    );
    await linkReconciliation({ institutionId: institution.id, sourceType: "source_programme", sourceId: sourceProgramme.id, targetType: "programme_version", targetId: programme.id, rationale: "Smoke programme version from source." });
    await linkReconciliation({ institutionId: institution.id, sourceType: "source_module", sourceId: sourceModule.id, targetType: "module", targetId: module.id, rationale: "Smoke module reconciliation." });

    const structure = await one(
      `
        insert into curated_structures(institution_id, programme_version_id, source_programme_id, key, name, status, metadata)
        values ($1, $2, $3, 'primary', 'Smoke curated structure', 'draft', '{"smoke":true}'::jsonb)
        returning id
      `,
      [institution.id, programme.id, sourceProgramme.id],
    );
    const stageGroup = await one(
      `
        insert into curated_structure_groups(institution_id, curated_structure_id, group_type, key, name, stage, order_index, metadata)
        values ($1, $2, 'stage', 'stage-1', 'Stage 1', '1', 1, '{"smoke":true}'::jsonb)
        returning id
      `,
      [institution.id, structure.id],
    );
    const semesterGroup = await one(
      `
        insert into curated_structure_groups(institution_id, curated_structure_id, parent_group_id, group_type, key, name, stage, semester, order_index, metadata)
        values ($1, $2, $3, 'semester', 'stage-1-semester-1', 'Semester 1', '1', '1', 1, '{"smoke":true}'::jsonb)
        returning id
      `,
      [institution.id, structure.id, stageGroup.id],
    );
    const item = await one(
      `
        insert into curated_structure_items(institution_id, curated_structure_id, curated_structure_group_id, module_id, module_descriptor_id, source_structure_item_id, source_module_id, item_type, core_option, stage, semester, pathway, credits, label, metadata)
        values ($1, $2, $3, $4, $5, $6, $7, 'module', 'core', '1', '1', 'Common', 5, 'Phase 4B Smoke Module', '{"smoke":true}'::jsonb)
        returning id
      `,
      [institution.id, structure.id, semesterGroup.id, module.id, descriptor.id, sourceStructureItem.id, sourceModule.id],
    );
    await linkReconciliation({ institutionId: institution.id, sourceType: "source_structure_item", sourceId: sourceStructureItem.id, targetType: "curated_structure_item", targetId: item.id, rationale: "Smoke curated item from source structure item." });

    const editedItem = await one(
      `
        update curated_structure_items
        set core_option = 'required', credits = 10, notes = 'Smoke edit'
        where id = $1
        returning id, core_option, credits, notes
      `,
      [item.id],
    );

    const qualityRule = await createQualityRule("programme.item_missing_stage", "Structure item missing stage");
    const qualityRun = await one(
      `
        insert into data_quality_runs(institution_id, programme_version_id, curated_structure_id, status, trigger, scope, started_at, completed_at, summary)
        values ($1, $2, $3, 'completed_with_issues', 'api', '{"smoke":true}'::jsonb, now(), now(), '{"issueCount":1}'::jsonb)
        returning id
      `,
      [institution.id, programme.id, structure.id],
    );
    const qualityResult = await one(
      `
        insert into data_quality_results(institution_id, data_quality_run_id, data_quality_rule_id, severity, fingerprint, title, message, details, expected_value)
        values ($1, $2, $3, 'warning', 'phase4b-smoke', 'Structure item missing stage', 'Smoke quality result', '{"smoke":true}'::jsonb, '{"quality":"complete"}'::jsonb)
        returning id
      `,
      [institution.id, qualityRun.id, qualityRule.id],
    );
    await client.query(
      "insert into data_quality_result_links(data_quality_result_id, curated_structure_item_id, relationship) values ($1, $2, 'quality_target')",
      [qualityResult.id, item.id],
    );

    const comparison = {
      sourceStructureItems: Number((await one("select count(*)::int as count from source_structure_items where source_programme_id = $1", [sourceProgramme.id])).count),
      curatedStructureItems: Number((await one("select count(*)::int as count from curated_structure_items where curated_structure_id = $1", [structure.id])).count),
    };
    const mapPreview = await many(
      `
        select csi.stage, csi.semester, csi.pathway, csi.core_option, csi.credits, m.module_code, m.module_title, md.status as descriptor_status
        from curated_structure_items csi
        left join modules m on m.id = csi.module_id
        left join module_descriptors md on md.id = csi.module_descriptor_id
        where csi.curated_structure_id = $1
        order by csi.stage, csi.semester, csi.order_index
      `,
      [structure.id],
    );

    const createdIds = {
      programme_versions: [programme.id],
      curated_structures: [structure.id],
      curated_structure_groups: [stageGroup.id, semesterGroup.id],
      curated_structure_items: [item.id],
      reconciliation_links: [],
      data_quality_results: [qualityResult.id],
    };
    const countsBeforeRollback = {};
    for (const [table, ids] of Object.entries(createdIds)) {
      if (ids.length === 0) continue;
      countsBeforeRollback[table] = Number((await one(`select count(*)::int as count from ${table} where id = any($1::uuid[])`, [ids])).count);
    }

    await client.query("rollback");

    const rollbackChecks = {};
    for (const [table, ids] of Object.entries(createdIds)) {
      if (ids.length === 0) continue;
      rollbackChecks[table] = Number((await one(`select count(*)::int as count from ${table} where id = any($1::uuid[])`, [ids])).count);
    }

    console.log(JSON.stringify({
      created: {
        programmeVersionId: programme.id,
        structureId: structure.id,
        groupIds: [stageGroup.id, semesterGroup.id],
        itemId: item.id,
        editedItem,
        qualityRunId: qualityRun.id,
        qualityResultId: qualityResult.id,
      },
      comparison,
      mapPreview,
      countsBeforeRollback,
      rollbackChecks,
      cleanup: "rolled_back",
    }, null, 2));
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
