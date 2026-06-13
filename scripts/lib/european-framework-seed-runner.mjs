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

async function many(client, sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows;
}

async function upsertGlobalFramework(client, seed) {
  return one(
    client,
    `
      insert into frameworks(institution_id, key, name, description, owner_type, status, metadata)
      values (null, $1, $2, $3, 'system', 'active', $4::jsonb)
      on conflict (key) where institution_id is null
      do update set
        name = excluded.name,
        description = excluded.description,
        owner_type = excluded.owner_type,
        status = excluded.status,
        metadata = excluded.metadata,
        updated_at = now()
      returning id
    `,
    [seed.key, seed.name, seed.description, JSON.stringify(seed.sourceMetadata)],
  );
}

async function upsertFrameworkVersion(client, seed, frameworkId) {
  return one(
    client,
    `
      insert into framework_versions(framework_id, version_label, status, definition, source_url, notes, valid_from)
      values ($1, $2, 'active', $3::jsonb, $4, $5, $6)
      on conflict (framework_id, version_label)
      do update set
        status = excluded.status,
        definition = excluded.definition,
        source_url = excluded.source_url,
        notes = excluded.notes,
        valid_from = excluded.valid_from,
        updated_at = now()
      returning id
    `,
    [
      frameworkId,
      seed.versionLabel,
      JSON.stringify({
        ...seed.sourceMetadata,
        areas: seed.domains.map((domain) => ({
          key: domain.key,
          code: domain.code,
          name: domain.name,
          competences: domain.competences.map((competence) => ({
            key: competence.key,
            code: competence.code,
            name: competence.name,
          })),
        })),
      }),
      seed.sourceMetadata.sourceUrl,
      seed.notes,
      seed.validFrom,
    ],
  );
}

async function upsertDomain(client, seed, frameworkVersionId, domain, orderIndex) {
  const family = seed.sourceMetadata.family ?? "european";
  return one(
    client,
    `
      insert into competency_domains(framework_version_id, key, name, description, order_index, metadata)
      values ($1, $2, $3, $4, $5, $6::jsonb)
      on conflict (framework_version_id, key)
      do update set
        name = excluded.name,
        description = excluded.description,
        order_index = excluded.order_index,
        metadata = excluded.metadata,
        updated_at = now()
      returning id
    `,
    [
      frameworkVersionId,
      domain.key,
      domain.name,
      domain.description,
      orderIndex,
      JSON.stringify({ code: domain.code, family, framework: seed.key }),
    ],
  );
}

async function upsertCompetence(client, seed, frameworkVersionId, domainId, competence, orderIndex) {
  const family = seed.sourceMetadata.family ?? "european";
  return one(
    client,
    `
      insert into competencies(framework_version_id, competency_domain_id, key, name, description, order_index, metadata)
      values ($1, $2, $3, $4, $5, $6, $7::jsonb)
      on conflict (framework_version_id, key)
      do update set
        competency_domain_id = excluded.competency_domain_id,
        name = excluded.name,
        description = excluded.description,
        order_index = excluded.order_index,
        metadata = excluded.metadata,
        updated_at = now()
      returning id
    `,
    [
      frameworkVersionId,
      domainId,
      competence.key,
      competence.name,
      competence.description,
      orderIndex,
      JSON.stringify({ code: competence.code, family, framework: seed.key }),
    ],
  );
}

async function upsertLens(client, seed) {
  const family = seed.sourceMetadata.family ?? "european";
  return one(
    client,
    `
      insert into lenses(institution_id, key, name, description, status, metadata)
      values (null, $1, $2, $3, 'active', $4::jsonb)
      on conflict (key) where institution_id is null
      do update set
        name = excluded.name,
        description = excluded.description,
        status = excluded.status,
        metadata = excluded.metadata,
        updated_at = now()
      returning id
    `,
    [
      seed.lensKey,
      seed.lensName,
      `Evidence-informed curriculum mapping lens for ${seed.name}.`,
      JSON.stringify({ family, framework: seed.key, purpose: "curriculum_evidence_mapping", seed: seed.phase }),
    ],
  );
}

async function upsertLensVersion(client, seed, lensId) {
  return one(
    client,
    `
      insert into lens_versions(lens_id, version_label, status, analysis_contract, output_contract)
      values ($1, $2, 'active', $3::jsonb, $4::jsonb)
      on conflict (lens_id, version_label)
      do update set
        status = excluded.status,
        analysis_contract = excluded.analysis_contract,
        output_contract = excluded.output_contract,
        updated_at = now()
      returning id
    `,
    [
      lensId,
      seed.lensVersionLabel,
      JSON.stringify({
        inputEvidenceKinds: ["descriptor_section", "learning_outcome", "assessment_component", "manual"],
        output: "competency_evaluations",
        aiClassification: false,
        defaultEvaluationStatus: "needs_review",
        evidenceMaturityLevels: ["none", "developing", "consolidating", "leading"],
      }),
      JSON.stringify({
        evaluationShape: {
          competencyId: "uuid",
          observedLevel: "evidence_maturity_level",
          status: "draft|needs_review|reviewed|rejected|superseded",
          confidence: "number|null",
          rationale: "string|null",
          evidenceItemIds: "uuid[]",
        },
      }),
    ],
  );
}

async function upsertLensBinding(client, seed, lensVersionId, frameworkId, frameworkVersionId) {
  return one(
    client,
    `
      insert into lens_framework_bindings(lens_version_id, framework_id, framework_version_id, binding_role, configuration)
      values ($1, $2, $3, 'primary', $4::jsonb)
      on conflict (lens_version_id, framework_id, framework_version_id)
      do update set
        binding_role = excluded.binding_role,
        configuration = excluded.configuration
      returning id
    `,
    [lensVersionId, frameworkId, frameworkVersionId, JSON.stringify({ frameworkKey: seed.key, versionLabel: seed.versionLabel })],
  );
}

async function upsertLensRule(client, lensVersionId, key, ruleType, rule, orderIndex) {
  return one(
    client,
    `
      insert into lens_evidence_rules(lens_version_id, key, rule_type, rule, order_index)
      values ($1, $2, $3, $4::jsonb, $5)
      on conflict (lens_version_id, key)
      do update set
        rule_type = excluded.rule_type,
        rule = excluded.rule,
        order_index = excluded.order_index,
        updated_at = now()
      returning id
    `,
    [lensVersionId, key, ruleType, JSON.stringify(rule), orderIndex],
  );
}

async function upsertOutputSchema(client, seed, lensVersionId) {
  return one(
    client,
    `
      insert into lens_output_schemas(lens_version_id, key, schema)
      values ($1, $2, $3::jsonb)
      on conflict (lens_version_id, key)
      do update set schema = excluded.schema
      returning id
    `,
    [
      lensVersionId,
      `${seed.key}-competency-evaluation-v1`,
      JSON.stringify({
        type: "object",
        required: ["competencyId", "observedLevel", "status", "evidenceItemIds"],
        properties: {
          competencyId: { type: "string", format: "uuid" },
          observedLevel: { enum: ["none", "developing", "consolidating", "leading"] },
          status: { enum: ["draft", "needs_review", "reviewed", "rejected", "superseded"] },
          rationale: { type: ["string", "null"] },
          confidence: { type: ["number", "null"] },
          evidenceItemIds: { type: "array", items: { type: "string", format: "uuid" } },
        },
      }),
    ],
  );
}

export async function seedEuropeanFramework(seed) {
  const client = databaseClient();
  await client.connect();
  try {
    const framework = await upsertGlobalFramework(client, seed);
    const frameworkVersion = await upsertFrameworkVersion(client, seed, framework.id);
    let domainCount = 0;
    let competenceCount = 0;

    for (const [domainIndex, domain] of seed.domains.entries()) {
      const domainRow = await upsertDomain(client, seed, frameworkVersion.id, domain, domainIndex + 1);
      domainCount += 1;
      for (const [competenceIndex, competence] of domain.competences.entries()) {
        await upsertCompetence(client, seed, frameworkVersion.id, domainRow.id, competence, domainIndex * 10 + competenceIndex + 1);
        competenceCount += 1;
      }
    }

    const lens = await upsertLens(client, seed);
    const lensVersion = await upsertLensVersion(client, seed, lens.id);
    await upsertLensBinding(client, seed, lensVersion.id, framework.id, frameworkVersion.id);
    await upsertLensRule(
      client,
      lensVersion.id,
      "eligible-evidence-sources",
      "include",
      {
        sourceKinds: ["descriptor_section", "learning_outcome", "assessment_component", "manual"],
        target: "competency_evaluations",
        aiClassification: false,
      },
      1,
    );
    await upsertLensRule(
      client,
      lensVersion.id,
      "review-readiness",
      "threshold",
      {
        defaultStatus: "needs_review",
        requireEvidenceLink: true,
        requireRationaleForManualEvaluations: false,
      },
      2,
    );
    await upsertOutputSchema(client, seed, lensVersion.id);

    const counts = await many(
      client,
      `
        select
          (select count(*) from competency_domains where framework_version_id = $1) as domains,
          (select count(*) from competencies where framework_version_id = $1) as competencies,
          (select count(*) from lenses where key = $3 and institution_id is null) as lenses,
          (select count(*) from lens_framework_bindings where lens_version_id = $2 and framework_version_id = $1) as bindings,
          (select count(*) from lens_evidence_rules where lens_version_id = $2) as rules,
          (select count(*) from lens_output_schemas where lens_version_id = $2) as output_schemas
      `,
      [frameworkVersion.id, lensVersion.id, seed.lensKey],
    );

    return {
      frameworkId: framework.id,
      frameworkVersionId: frameworkVersion.id,
      lensId: lens.id,
      lensVersionId: lensVersion.id,
      intendedDomains: domainCount,
      intendedCompetencies: competenceCount,
      counts: counts[0],
    };
  } finally {
    await client.end();
  }
}

export async function runSeed(seed) {
  const result = await seedEuropeanFramework(seed);
  const label = `${seed.key.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_SEED`;
  console.log(`${label}=ok`);
  console.log(`FRAMEWORK_ID=${result.frameworkId}`);
  console.log(`FRAMEWORK_VERSION_ID=${result.frameworkVersionId}`);
  console.log(`LENS_ID=${result.lensId}`);
  console.log(`LENS_VERSION_ID=${result.lensVersionId}`);
  console.log(`DOMAINS=${result.counts.domains}`);
  console.log(`COMPETENCIES=${result.counts.competencies}`);
  console.log(`LENSES=${result.counts.lenses}`);
  console.log(`BINDINGS=${result.counts.bindings}`);
  console.log(`RULES=${result.counts.rules}`);
  console.log(`OUTPUT_SCHEMAS=${result.counts.output_schemas}`);
}
