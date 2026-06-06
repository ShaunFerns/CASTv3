import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

const requireFromDb = createRequire(new URL("../lib/db/package.json", import.meta.url));
const pg = requireFromDb("pg");
const { Client } = pg;

const root = process.cwd();
const migrationPath = path.join(root, "lib", "db", "migrations", "0009_phase4a_curriculum_ingestion.sql");
const migrationName = "0009_phase4a_curriculum_ingestion";
const migrationVersion = "20260606170000";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const databaseUrl = new URL(process.env.DATABASE_URL);
const requestedSslMode = databaseUrl.searchParams.get("sslmode");
databaseUrl.searchParams.delete("sslmode");

const client = new Client({
  connectionString: databaseUrl.toString(),
  ssl: requestedSslMode ? { rejectUnauthorized: false } : undefined,
});

const ids = {};

async function one(sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows[0];
}

async function many(sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows;
}

async function migrationAlreadyRecorded() {
  const row = await one(
    "select 1 from supabase_migrations.schema_migrations where name = $1 limit 1",
    [migrationName],
  );
  return Boolean(row);
}

async function recordMigrationIfNeeded() {
  if (await migrationAlreadyRecorded()) return false;
  await client.query(
    "insert into supabase_migrations.schema_migrations(version, name, statements) values ($1, $2, $3)",
    [migrationVersion, migrationName, []],
  );
  return true;
}

async function applyMigration() {
  if (await migrationAlreadyRecorded()) {
    return { applied: false, reason: "already_recorded" };
  }

  const sql = fs.readFileSync(migrationPath, "utf8");
  await client.query(sql);
  await recordMigrationIfNeeded();
  return { applied: true };
}

async function verifyMigrations() {
  return many(
    "select version, name from supabase_migrations.schema_migrations where name like '000%' order by version",
  );
}

async function verifyObjects() {
  const tables = await many(
    `
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name = any($1::text[])
      order by table_name
    `,
    [["ingestion_runs", "ingestion_items", "ingestion_errors", "ingestion_record_links"]],
  );

  const indexes = await many(
    `
      select indexname
      from pg_indexes
      where schemaname = 'public'
        and tablename = any($1::text[])
      order by indexname
    `,
    [["ingestion_runs", "ingestion_items", "ingestion_errors", "ingestion_record_links"]],
  );

  const fks = await many(
    `
      select conname
      from pg_constraint
      where contype = 'f'
        and conrelid in (
          'public.ingestion_runs'::regclass,
          'public.ingestion_items'::regclass,
          'public.ingestion_errors'::regclass,
          'public.ingestion_record_links'::regclass
        )
      order by conname
    `,
  );

  const rules = await many(
    `
      select key
      from data_quality_rules
      where key like 'ingestion.%'
      order by key
    `,
  );

  return { tables, indexes, fks, rules };
}

async function link(runId, itemId, relationship, column, value) {
  await client.query(
    `insert into ingestion_record_links(ingestion_run_id, ingestion_item_id, relationship, ${column}) values ($1, $2, $3, $4)`,
    [runId, itemId, relationship, value],
  );
}

async function createInstitution() {
  ids.institution = (await one(
    `
      insert into institutions(name, slug, status, settings)
      values ('CAST Phase 4A Smoke Institution', 'cast-phase4a-smoke', 'active', '{"smoke":true}'::jsonb)
      returning id
    `,
  )).id;
}

async function createQualityFinding({ runId, itemId, moduleId, descriptorId, field, title }) {
  const rule = await one("select id, default_severity from data_quality_rules where key = $1", [`ingestion.missing_${field}`]);
  const qualityRun = await one(
    `
      insert into data_quality_runs(institution_id, status, trigger, scope, started_at, completed_at, summary)
      values ($1, 'completed_with_issues', 'api', $2::jsonb, now(), now(), '{"smoke":true}'::jsonb)
      returning id
    `,
    [ids.institution, JSON.stringify({ runId, itemId })],
  );
  const result = await one(
    `
      insert into data_quality_results(
        institution_id,
        data_quality_run_id,
        data_quality_rule_id,
        severity,
        fingerprint,
        title,
        message,
        details,
        expected_value
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, '{"present":true}'::jsonb)
      returning id
    `,
    [
      ids.institution,
      qualityRun.id,
      rule.id,
      rule.default_severity,
      `${runId}:${itemId}:${field}`,
      title,
      `Smoke test missing ${field}`,
      JSON.stringify({ field }),
    ],
  );
  await link(runId, itemId, "quality_finding", "data_quality_result_id", result.id);
  if (descriptorId) {
    await client.query(
      "insert into data_quality_result_links(data_quality_result_id, module_descriptor_id, relationship) values ($1, $2, 'affected_descriptor')",
      [result.id, descriptorId],
    );
  } else if (moduleId) {
    await client.query(
      "insert into data_quality_result_links(data_quality_result_id, module_id, relationship) values ($1, $2, 'affected_module')",
      [result.id, moduleId],
    );
  }
  return result.id;
}

async function createCanonicalModule({ pathway, moduleCode, moduleTitle, descriptorText, sourceModuleId, sourceRecordId, importBatchId, expectQuality }) {
  const run = await one(
    `
      insert into ingestion_runs(institution_id, pathway, status, summary, metadata)
      values ($1, $2, 'running', '{"smoke":true}'::jsonb, '{"smoke":true}'::jsonb)
      returning id
    `,
    [ids.institution, pathway],
  );
  const item = await one(
    `
      insert into ingestion_items(ingestion_run_id, institution_id, item_type, status, source_identifier, input_payload, normalized_payload)
      values ($1, $2, 'module_descriptor', 'running', $3, $4::jsonb, $4::jsonb)
      returning id
    `,
    [run.id, ids.institution, moduleCode ?? moduleTitle ?? pathway, JSON.stringify({ moduleCode, moduleTitle })],
  );
  const module = await one(
    `
      insert into modules(institution_id, source_module_id, module_code, module_title, status, metadata)
      values ($1, $2, $3, $4, 'draft', '{"smoke":true}'::jsonb)
      returning id
    `,
    [ids.institution, sourceModuleId ?? null, moduleCode ?? null, moduleTitle ?? null],
  );
  await link(run.id, item.id, "created", "module_id", module.id);
  const descriptor = await one(
    `
      insert into module_descriptors(institution_id, module_id, source_module_id, version_label, status, descriptor_text, source_type, metadata)
      values ($1, $2, $3, $4, 'draft', $5, 'ingestion_smoke', '{"smoke":true}'::jsonb)
      returning id
    `,
    [ids.institution, module.id, sourceModuleId ?? null, `smoke-${pathway}`, descriptorText],
  );
  await link(run.id, item.id, "created", "module_descriptor_id", descriptor.id);
  const section = await one(
    `
      insert into descriptor_sections(institution_id, module_descriptor_id, section_type, title, content, source_location)
      values ($1, $2, 'aims', 'Aims', $3, $4::jsonb)
      returning id
    `,
    [ids.institution, descriptor.id, descriptorText, JSON.stringify({ runId: run.id, itemId: item.id })],
  );
  await link(run.id, item.id, "created", "descriptor_section_id", section.id);
  const evidence = await one(
    `
      insert into evidence_items(institution_id, descriptor_section_id, module_id, source_kind, evidence_text, confidence, status, source_location, metadata)
      values ($1, $2, $3, 'descriptor_section', $4, 1, 'extracted', $5::jsonb, '{"smoke":true}'::jsonb)
      returning id
    `,
    [ids.institution, section.id, module.id, descriptorText, JSON.stringify({ runId: run.id, itemId: item.id })],
  );
  await link(run.id, item.id, "created", "evidence_item_id", evidence.id);

  let qualityResultId = null;
  if (expectQuality) {
    qualityResultId = await createQualityFinding({
      runId: run.id,
      itemId: item.id,
      moduleId: module.id,
      descriptorId: descriptor.id,
      field: "module_code",
      title: "Missing module code",
    });
  }

  await client.query(
    "update ingestion_items set status = $2, summary = $3::jsonb where id = $1",
    [item.id, qualityResultId ? "completed_with_issues" : "completed", JSON.stringify({ moduleId: module.id, descriptorId: descriptor.id, evidenceId: evidence.id })],
  );
  await client.query(
    "update ingestion_runs set status = $2, completed_at = now(), summary = $3::jsonb where id = $1",
    [run.id, qualityResultId ? "completed_with_issues" : "completed", JSON.stringify({ moduleId: module.id, descriptorId: descriptor.id, evidenceId: evidence.id, qualityResultId })],
  );

  return { runId: run.id, itemId: item.id, moduleId: module.id, descriptorId: descriptor.id, sectionId: section.id, evidenceId: evidence.id, qualityResultId };
}

async function manualSmoke() {
  return createCanonicalModule({
    pathway: "manual_module",
    moduleCode: "SMK-MAN-101",
    moduleTitle: "Manual Smoke Module",
    descriptorText: "Manual smoke descriptor evidence.",
    expectQuality: false,
  });
}

async function pdfSmoke() {
  const doc = await one(
    `
      insert into documents(institution_id, document_type, title, status, metadata)
      values ($1, 'module_descriptor', 'PDF Text Smoke Descriptor', 'active', '{"smoke":true}'::jsonb)
      returning id
    `,
    [ids.institution],
  );
  const version = await one(
    `
      insert into document_versions(institution_id, document_id, version_label, file_name, mime_type, raw_text, status, metadata)
      values ($1, $2, 'smoke-pdf', 'smoke.txt', 'text/plain', 'PDF text smoke descriptor evidence.', 'active', '{"smoke":true}'::jsonb)
      returning id
    `,
    [ids.institution, doc.id],
  );
  const docSection = await one(
    `
      insert into document_sections(institution_id, document_version_id, section_type, heading, content)
      values ($1, $2, 'paragraph', 'Extracted descriptor text', 'PDF text smoke descriptor evidence.')
      returning id
    `,
    [ids.institution, version.id],
  );
  const result = await createCanonicalModule({
    pathway: "single_pdf",
    moduleCode: null,
    moduleTitle: "PDF Smoke Module",
    descriptorText: "PDF text smoke descriptor evidence.",
    expectQuality: true,
  });
  await link(result.runId, result.itemId, "created", "document_id", doc.id);
  await link(result.runId, result.itemId, "created", "document_version_id", version.id);
  await link(result.runId, result.itemId, "created", "document_section_id", docSection.id);
  return { ...result, documentId: doc.id, documentVersionId: version.id, documentSectionId: docSection.id };
}

async function akariSmoke() {
  const system = await one(
    `
      insert into source_systems(institution_id, key, name, system_type, metadata)
      values ($1, 'akari-smoke', 'Akari Smoke', 'akari', '{"smoke":true}'::jsonb)
      returning id
    `,
    [ids.institution],
  );
  const batch = await one(
    `
      insert into import_batches(institution_id, source_system_id, batch_type, status, external_batch_id, summary)
      values ($1, $2, 'module_catalogue', 'running', 'phase4a-smoke', '{"smoke":true}'::jsonb)
      returning id
    `,
    [ids.institution, system.id],
  );
  const sourceRecord = await one(
    `
      insert into source_records(institution_id, import_batch_id, source_system_id, record_type, status, source_identifier, payload)
      values ($1, $2, $3, 'module', 'parsed', 'AKARI-SMK-101', '{"moduleCode":"AKARI-SMK-101"}'::jsonb)
      returning id
    `,
    [ids.institution, batch.id, system.id],
  );
  const sourceProgramme = await one(
    `
      insert into source_programmes(institution_id, import_batch_id, source_system_id, source_record_id, external_id, code, name, raw_payload)
      values ($1, $2, $3, $4, 'SMK-PROG', 'SMK-PROG', 'Smoke Programme', '{"smoke":true}'::jsonb)
      returning id
    `,
    [ids.institution, batch.id, system.id, sourceRecord.id],
  );
  const sourceModule = await one(
    `
      insert into source_modules(institution_id, import_batch_id, source_system_id, source_record_id, external_id, module_code, module_title, credits, stage, semester, descriptor_text, raw_payload)
      values ($1, $2, $3, $4, 'AKARI-SMK-101', 'AKARI-SMK-101', 'Akari Smoke Module', '5', '1', '1', 'Akari smoke descriptor evidence.', '{"smoke":true}'::jsonb)
      returning id
    `,
    [ids.institution, batch.id, system.id, sourceRecord.id],
  );
  const structureItem = await one(
    `
      insert into source_structure_items(institution_id, import_batch_id, source_system_id, source_record_id, source_programme_id, source_module_id, external_id, stage, semester, credits, raw_payload)
      values ($1, $2, $3, $4, $5, $6, 'AKARI-SMK-101-STRUCTURE', '1', '1', '5', '{"smoke":true}'::jsonb)
      returning id
    `,
    [ids.institution, batch.id, system.id, sourceRecord.id, sourceProgramme.id, sourceModule.id],
  );
  const result = await createCanonicalModule({
    pathway: "akari",
    moduleCode: "AKARI-SMK-101",
    moduleTitle: "Akari Smoke Module",
    descriptorText: "Akari smoke descriptor evidence.",
    sourceModuleId: sourceModule.id,
    sourceRecordId: sourceRecord.id,
    importBatchId: batch.id,
    expectQuality: false,
  });
  await link(result.runId, result.itemId, "created", "import_batch_id", batch.id);
  await link(result.runId, result.itemId, "created", "source_record_id", sourceRecord.id);
  await link(result.runId, result.itemId, "created", "source_programme_id", sourceProgramme.id);
  await link(result.runId, result.itemId, "created", "source_module_id", sourceModule.id);
  await link(result.runId, result.itemId, "created", "source_structure_item_id", structureItem.id);
  await client.query("update import_batches set status = 'completed', completed_at = now() where id = $1", [batch.id]);
  return { ...result, sourceSystemId: system.id, importBatchId: batch.id, sourceRecordId: sourceRecord.id, sourceProgrammeId: sourceProgramme.id, sourceModuleId: sourceModule.id, sourceStructureItemId: structureItem.id };
}

async function countSmokeRecords(runIds) {
  const counts = {};
  for (const table of [
    "ingestion_runs",
    "ingestion_items",
    "ingestion_record_links",
    "modules",
    "module_descriptors",
    "descriptor_sections",
    "evidence_items",
    "data_quality_results",
  ]) {
    const isIngestionRunTable = table === "ingestion_runs";
    const isIngestionChildTable = table === "ingestion_items" || table === "ingestion_record_links";
    const query = isIngestionRunTable
      ? `select count(*)::int as count from ${table} where id = any($1::uuid[])`
      : isIngestionChildTable
        ? `select count(*)::int as count from ${table} where ingestion_run_id = any($1::uuid[])`
        : `select count(*)::int as count from ${table} where metadata->>'smoke' = 'true'`;
    const params = isIngestionRunTable || isIngestionChildTable ? [runIds] : [];
    const row = await one(query, params).catch(async () => ({ count: 0 }));
    counts[table] = row.count;
  }
  return counts;
}

async function countByIds(idsToCheck) {
  const checks = {};
  for (const [table, idsForTable] of Object.entries(idsToCheck)) {
    if (idsForTable.length === 0) {
      checks[table] = 0;
      continue;
    }
    const row = await one(`select count(*)::int as count from ${table} where id = any($1::uuid[])`, [idsForTable]);
    checks[table] = row.count;
  }
  return checks;
}

async function smokeTests() {
  await client.query("begin");
  try {
    await createInstitution();
    const manual = await manualSmoke();
    const pdf = await pdfSmoke();
    const akari = await akariSmoke();
    const createdIds = {
      ingestion_runs: [manual.runId, pdf.runId, akari.runId],
      ingestion_items: [manual.itemId, pdf.itemId, akari.itemId],
      modules: [manual.moduleId, pdf.moduleId, akari.moduleId],
      module_descriptors: [manual.descriptorId, pdf.descriptorId, akari.descriptorId],
      descriptor_sections: [manual.sectionId, pdf.sectionId, akari.sectionId],
      evidence_items: [manual.evidenceId, pdf.evidenceId, akari.evidenceId],
      data_quality_results: [pdf.qualityResultId].filter(Boolean),
    };
    const counts = await countByIds(createdIds);
    await client.query("rollback");
    const rollbackChecks = await countByIds(createdIds);
    return { manual, pdf, akari, countsBeforeRollback: counts, rollbackChecks, cleanup: "rolled_back" };
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function main() {
  await client.connect();
  try {
    const migration = await applyMigration();
    const migrations = await verifyMigrations();
    const objects = await verifyObjects();
    const smoke = await smokeTests();
    console.log(JSON.stringify({ migration, migrations, objects, smoke }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
