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

async function upsertDesignLayer(client, layer) {
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
    [
      layer.key,
      layer.name,
      layer.description,
      JSON.stringify({
        family: "curriculum_design",
        designLayer: true,
        frameworkRole: "curriculum_design_layer",
        notACompetencyFramework: true,
        programmeMapLayer: layer.programmeMapLayer === true,
        moduleBuilderLayer: layer.moduleBuilderLayer === true,
        seed: layer.phase,
      }),
    ],
  );
}

async function upsertDesignLayerVersion(client, layer, frameworkId) {
  return one(
    client,
    `
      insert into framework_versions(framework_id, version_label, status, definition, source_url, notes, valid_from)
      values ($1, $2, 'active', $3::jsonb, null, $4, $5)
      on conflict (framework_id, version_label)
      do update set
        status = excluded.status,
        definition = excluded.definition,
        notes = excluded.notes,
        valid_from = excluded.valid_from,
        updated_at = now()
      returning id
    `,
    [
      frameworkId,
      layer.versionLabel,
      JSON.stringify({
        family: "curriculum_design",
        designLayer: true,
        programmeMapLayer: layer.programmeMapLayer === true,
        moduleBuilderLayer: layer.moduleBuilderLayer === true,
        domains: layer.domains.map((domain) => ({
          key: domain.key,
          name: domain.name,
          indicators: domain.indicators.map((indicator) => ({
            key: indicator.key,
            name: indicator.name,
          })),
        })),
      }),
      layer.notes,
      layer.validFrom,
    ],
  );
}

async function upsertDomain(client, layer, frameworkVersionId, domain, orderIndex) {
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
      JSON.stringify({ designLayer: layer.key, indicatorGroup: true, family: "curriculum_design" }),
    ],
  );
}

async function upsertIndicator(client, layer, frameworkVersionId, domainId, indicator, orderIndex) {
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
      indicator.key,
      indicator.name,
      indicator.description,
      orderIndex,
      JSON.stringify({
        designLayer: layer.key,
        indicator: true,
        notACompetency: true,
        family: "curriculum_design",
      }),
    ],
  );
}

async function upsertLens(client, layer) {
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
      layer.lensKey,
      layer.lensName,
      layer.lensDescription,
      JSON.stringify({
        family: "curriculum_design",
        designLayer: layer.key,
        purpose: "curriculum_design_analysis",
        aiClassification: false,
        seed: layer.phase,
      }),
    ],
  );
}

async function upsertLensVersion(client, layer, lensId) {
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
      layer.lensVersionLabel,
      JSON.stringify({
        inputEvidenceKinds: layer.inputEvidenceKinds,
        output: "competency_evaluations",
        outputMeaning: "evidence_linked_design_layer_indicators",
        aiClassification: false,
        defaultEvaluationStatus: "needs_review",
        evidenceMaturityLevels: ["none", "developing", "consolidating", "leading"],
      }),
      JSON.stringify({
        evaluationShape: {
          indicatorId: "uuid",
          observedLevel: "evidence_maturity_level",
          status: "draft|needs_review|reviewed|rejected|superseded",
          rationale: "string|null",
          evidenceItemIds: "uuid[]",
          metrics: "object",
        },
      }),
    ],
  );
}

async function upsertLensBinding(client, layer, lensVersionId, frameworkId, frameworkVersionId) {
  return one(
    client,
    `
      insert into lens_framework_bindings(lens_version_id, framework_id, framework_version_id, binding_role, configuration)
      values ($1, $2, $3, 'design_layer', $4::jsonb)
      on conflict (lens_version_id, framework_id, framework_version_id)
      do update set
        binding_role = excluded.binding_role,
        configuration = excluded.configuration
      returning id
    `,
    [lensVersionId, frameworkId, frameworkVersionId, JSON.stringify({ designLayerKey: layer.key, versionLabel: layer.versionLabel })],
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

async function upsertOutputSchema(client, layer, lensVersionId) {
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
      `${layer.key}-design-layer-evaluation-v1`,
      JSON.stringify({
        type: "object",
        required: ["indicatorId", "observedLevel", "status", "evidenceItemIds"],
        properties: {
          indicatorId: { type: "string", format: "uuid" },
          observedLevel: { enum: ["none", "developing", "consolidating", "leading"] },
          status: { enum: ["draft", "needs_review", "reviewed", "rejected", "superseded"] },
          rationale: { type: ["string", "null"] },
          evidenceItemIds: { type: "array", items: { type: "string", format: "uuid" } },
          metrics: { type: "object" },
        },
      }),
    ],
  );
}

export async function seedCurriculumDesignLayer(layer) {
  const client = databaseClient();
  await client.connect();
  try {
    const framework = await upsertDesignLayer(client, layer);
    const frameworkVersion = await upsertDesignLayerVersion(client, layer, framework.id);
    let domainCount = 0;
    let indicatorCount = 0;

    for (const [domainIndex, domain] of layer.domains.entries()) {
      const domainRow = await upsertDomain(client, layer, frameworkVersion.id, domain, domainIndex + 1);
      domainCount += 1;
      for (const [indicatorIndex, indicator] of domain.indicators.entries()) {
        await upsertIndicator(client, layer, frameworkVersion.id, domainRow.id, indicator, domainIndex * 10 + indicatorIndex + 1);
        indicatorCount += 1;
      }
    }

    const lens = await upsertLens(client, layer);
    const lensVersion = await upsertLensVersion(client, layer, lens.id);
    await upsertLensBinding(client, layer, lensVersion.id, framework.id, frameworkVersion.id);
    for (const [ruleIndex, rule] of layer.evidenceRules.entries()) {
      await upsertLensRule(client, lensVersion.id, rule.key, rule.ruleType, rule.rule, ruleIndex + 1);
    }
    await upsertOutputSchema(client, layer, lensVersion.id);

    const counts = await one(
      client,
      `
        select
          (select count(*) from competency_domains where framework_version_id = $1)::int as domains,
          (select count(*) from competencies where framework_version_id = $1)::int as indicators,
          (select count(*) from lenses where key = $3 and institution_id is null)::int as lenses,
          (select count(*) from lens_framework_bindings where lens_version_id = $2 and framework_version_id = $1)::int as bindings,
          (select count(*) from lens_evidence_rules where lens_version_id = $2)::int as rules,
          (select count(*) from lens_output_schemas where lens_version_id = $2)::int as output_schemas
      `,
      [frameworkVersion.id, lensVersion.id, layer.lensKey],
    );

    return {
      frameworkId: framework.id,
      frameworkVersionId: frameworkVersion.id,
      lensId: lens.id,
      lensVersionId: lensVersion.id,
      intendedDomains: domainCount,
      intendedIndicators: indicatorCount,
      counts,
    };
  } finally {
    await client.end();
  }
}
