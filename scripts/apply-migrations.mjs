import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const requireFromDb = createRequire(new URL("../lib/db/package.json", import.meta.url));

const migrationsDir = path.resolve(fileURLToPath(new URL("../lib/db/migrations", import.meta.url)));
const dryRun = process.argv.includes("--dry-run") || process.env.CAST_MIGRATIONS_DRY_RUN === "true";
const migrationIdPattern = /^(?:000[1-9]|001[0-1])_.*\.sql$/;
const expectedMigrationIds = new Set(["0001", "0002", "0003", "0004", "0005", "0006", "0007", "0008", "0009", "0010", "0011"]);

const requiredObjectsByMigration = {
  "0001": {
    tables: ["institutions", "users", "frameworks", "framework_versions", "lenses", "programme_maps", "institution_priorities", "audit_events"],
    types: ["institution_status", "framework_status", "lens_status", "programme_map_status", "audit_actor_type"],
  },
  "0002": {
    tables: ["import_batches", "source_records", "source_programmes", "source_modules", "source_structure_items"],
    types: ["import_batch_status", "source_record_status", "source_record_type"],
  },
  "0003": {
    tables: ["programme_versions", "modules", "module_descriptors", "descriptor_sections", "curated_structures", "curated_structure_items", "learning_outcomes", "assessment_components"],
    types: ["curriculum_version_status", "module_status", "descriptor_section_type", "curated_structure_status"],
  },
  "0004": {
    tables: ["documents", "document_versions", "document_sections", "evidence_items", "competency_domains", "competencies", "programme_graduate_attributes", "competency_evaluations", "competency_evaluation_evidence_links"],
    types: ["document_status", "evidence_item_status", "scaffolding_level", "competency_evaluation_status"],
  },
  "0005": {
    tables: ["analysis_runs", "ai_model_runs", "prompt_versions", "ai_claims", "claim_evidence_links", "human_reviews", "clarification_requests", "descriptor_improvement_suggestions"],
    types: ["analysis_run_status", "ai_claim_status", "human_review_decision", "descriptor_suggestion_status"],
  },
  "0006": {
    tables: ["review_cycles", "review_assignments", "readiness_assessments", "readiness_assessment_items", "swot_items", "action_plans", "action_plan_items", "action_plan_milestones", "review_exports"],
    types: ["review_cycle_type", "review_cycle_status", "swot_item_type", "action_plan_status", "action_plan_item_status"],
  },
  "0007": {
    tables: ["data_quality_rules", "data_quality_runs", "data_quality_results", "data_quality_result_links", "local_workers", "worker_jobs", "worker_job_artifacts", "worker_sync_events"],
    types: ["data_quality_severity", "data_quality_result_status", "local_worker_status", "worker_job_status"],
  },
  "0008": {
    tables: ["app_sessions", "programme_memberships", "roles", "institution_memberships"],
    columns: [{ table: "users", column: "auth_user_id" }],
  },
  "0009": {
    tables: ["ingestion_runs", "ingestion_items", "ingestion_errors", "ingestion_record_links"],
    types: ["ingestion_run_type", "ingestion_run_status", "ingestion_item_status", "ingestion_error_severity"],
  },
  "0010": {
    tables: ["priority_expectations", "programme_attribute_expectations", "programme_competency_expectations", "competency_evaluations", "ai_claims", "descriptor_improvement_suggestions"],
    types: ["evidence_maturity_level"],
  },
  "0011": {
    tables: ["institutions", "users", "app_sessions", "modules", "evidence_items", "audit_events", "cast_schema_migrations"],
    publicTablesHaveRls: true,
  },
};

function checksum(sql) {
  return createHash("sha256").update(sql).digest("hex");
}

function databaseClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required unless running with --dry-run.");
  }

  const pg = requireFromDb("pg");
  const { Client } = pg;
  const databaseUrl = new URL(process.env.DATABASE_URL);
  const requestedSslMode = databaseUrl.searchParams.get("sslmode");
  databaseUrl.searchParams.delete("sslmode");

  return new Client({
    connectionString: databaseUrl.toString(),
    ssl: requestedSslMode ? { rejectUnauthorized: false } : undefined,
  });
}

async function loadMigrations() {
  const filenames = (await readdir(migrationsDir))
    .filter((filename) => migrationIdPattern.test(filename))
    .sort();

  const migrations = [];
  for (const filename of filenames) {
    const id = filename.slice(0, 4);
    const sql = await readFile(path.join(migrationsDir, filename), "utf8");
    migrations.push({ id, filename, sql, checksum: checksum(sql) });
  }

  const actualIds = new Set(migrations.map((migration) => migration.id));
  for (const expectedId of expectedMigrationIds) {
    if (!actualIds.has(expectedId)) {
      throw new Error(`Required migration ${expectedId} was not found in ${migrationsDir}`);
    }
  }

  return migrations.filter((migration) => expectedMigrationIds.has(migration.id));
}

async function ensureLedger(client) {
  await client.query(`
    create table if not exists cast_schema_migrations (
      id text primary key,
      filename text not null,
      checksum text not null,
      status text not null check (status in ('applied', 'baselined')),
      applied_at timestamptz not null default now(),
      execution_ms integer not null default 0
    )
  `);
}

async function tableExists(client, tableName) {
  const result = await client.query("select to_regclass($1) is not null as exists", [`public.${tableName}`]);
  return result.rows[0]?.exists === true;
}

async function typeExists(client, typeName) {
  const result = await client.query("select to_regtype($1) is not null as exists", [`public.${typeName}`]);
  return result.rows[0]?.exists === true;
}

async function columnExists(client, tableName, columnName) {
  const result = await client.query(
    `
      select exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = $1
          and column_name = $2
      ) as exists
    `,
    [tableName, columnName],
  );
  return result.rows[0]?.exists === true;
}

async function allPublicTablesHaveRls(client) {
  const result = await client.query(`
    select not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind in ('r', 'p')
        and not c.relrowsecurity
    ) as ok
  `);
  return result.rows[0]?.ok === true;
}

async function migrationObjectsAlreadyExist(client, migrationId) {
  const required = requiredObjectsByMigration[migrationId];
  if (!required) return false;

  for (const tableName of required.tables ?? []) {
    if (!(await tableExists(client, tableName))) return false;
  }

  for (const typeName of required.types ?? []) {
    if (!(await typeExists(client, typeName))) return false;
  }

  for (const column of required.columns ?? []) {
    if (!(await columnExists(client, column.table, column.column))) return false;
  }

  if (required.publicTablesHaveRls && !(await allPublicTablesHaveRls(client))) return false;

  return true;
}

async function appliedMigration(client, migrationId) {
  const result = await client.query("select id, filename, checksum, status from cast_schema_migrations where id = $1", [
    migrationId,
  ]);
  return result.rows[0];
}

async function recordMigration(client, migration, status, executionMs) {
  await client.query(
    `
      insert into cast_schema_migrations (id, filename, checksum, status, execution_ms)
      values ($1, $2, $3, $4, $5)
      on conflict (id)
      do update set
        filename = excluded.filename,
        checksum = excluded.checksum,
        status = excluded.status,
        applied_at = now(),
        execution_ms = excluded.execution_ms
    `,
    [migration.id, migration.filename, migration.checksum, status, executionMs],
  );
}

async function applyMigration(client, migration) {
  const recorded = await appliedMigration(client, migration.id);
  if (recorded) {
    if (recorded.checksum !== migration.checksum) {
      throw new Error(
        `Migration ${migration.id} is already recorded with a different checksum. Refusing to continue.`,
      );
    }
    console.log(`MIGRATION_SKIPPED=${migration.filename}`);
    return;
  }

  const startedAt = Date.now();
  try {
    await client.query("begin");
    await client.query(migration.sql);
    await recordMigration(client, migration, "applied", Date.now() - startedAt);
    await client.query("commit");
    console.log(`MIGRATION_APPLIED=${migration.filename}`);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);

    if (await migrationObjectsAlreadyExist(client, migration.id)) {
      await recordMigration(client, migration, "baselined", Date.now() - startedAt);
      console.log(`MIGRATION_BASELINED=${migration.filename}`);
      return;
    }

    throw error;
  }
}

async function main() {
  const migrations = await loadMigrations();
  console.log(`CORE_MIGRATIONS=${migrations.map((migration) => migration.filename).join(",")}`);
  console.log("OPTIONAL_MIGRATION_SKIPPED=0090_legacy_compatibility_views.sql");

  if (dryRun) {
    console.log("CAST_MIGRATIONS_DRY_RUN=ok");
    return;
  }

  const client = databaseClient();
  await client.connect();
  try {
    await client.query("select pg_advisory_lock(hashtext('cast_v3_schema_migrations'))");
    await ensureLedger(client);
    for (const migration of migrations) {
      await applyMigration(client, migration);
    }
    console.log("CAST_MIGRATIONS=ok");
  } finally {
    await client.query("select pg_advisory_unlock(hashtext('cast_v3_schema_migrations'))").catch(() => undefined);
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
