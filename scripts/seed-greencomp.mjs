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

const sourceMetadata = {
  family: "european",
  source: "European Commission Joint Research Centre",
  publication: "GreenComp: The European sustainability competence framework",
  publicationYear: 2022,
  versionLabel: "2022",
  doi: "10.2760/13286",
  isbn: "978-92-76-46485-3",
  catalogueNumber: "KJ-NA-30955-EN-N",
  sourceUrl: "https://joint-research-centre.ec.europa.eu/greencomp-european-sustainability-competence-framework_en",
  seed: "cast-v3-phase5b",
};

const greenComp = [
  {
    key: "embodying-sustainability-values",
    code: "1",
    name: "Embodying sustainability values",
    description: "Reflecting on and grounding action in sustainability values.",
    competences: [
      {
        key: "valuing-sustainability",
        code: "1.1",
        name: "Valuing sustainability",
        description: "To reflect on personal values; identify and explain how values vary among people and over time, while critically evaluating how they align with sustainability values.",
      },
      {
        key: "supporting-fairness",
        code: "1.2",
        name: "Supporting fairness",
        description: "To support equity and justice for current and future generations and learn from previous generations for sustainability.",
      },
      {
        key: "promoting-nature",
        code: "1.3",
        name: "Promoting nature",
        description: "To acknowledge that humans are part of nature; and to respect the needs and rights of other species and of nature itself in order to restore and regenerate healthy and resilient ecosystems.",
      },
    ],
  },
  {
    key: "embracing-complexity-in-sustainability",
    code: "2",
    name: "Embracing complexity in sustainability",
    description: "Understanding sustainability problems as complex, situated and systemic.",
    competences: [
      {
        key: "systems-thinking",
        code: "2.1",
        name: "Systems thinking",
        description: "To approach a sustainability problem from all sides; to consider time, space and context in order to understand how elements interact within and between systems.",
      },
      {
        key: "critical-thinking",
        code: "2.2",
        name: "Critical thinking",
        description: "To assess information and arguments, identify assumptions, challenge the status quo, and reflect on how personal, social and cultural backgrounds influence thinking and conclusions.",
      },
      {
        key: "problem-framing",
        code: "2.3",
        name: "Problem framing",
        description: "To formulate current or potential challenges as a sustainability problem in terms of difficulty, people involved, time and geographical scope, in order to identify suitable approaches to anticipating and preventing problems, and to mitigating and adapting to already existing problems.",
      },
    ],
  },
  {
    key: "envisioning-sustainable-futures",
    code: "3",
    name: "Envisioning sustainable futures",
    description: "Imagining, exploring and adapting towards sustainable futures.",
    competences: [
      {
        key: "futures-literacy",
        code: "3.1",
        name: "Futures literacy",
        description: "To envision alternative sustainable futures by imagining and developing alternative scenarios and identifying the steps needed to achieve a preferred sustainable future.",
      },
      {
        key: "adaptability",
        code: "3.2",
        name: "Adaptability",
        description: "To manage transitions and challenges in complex sustainability situations and make decisions related to the future in the face of uncertainty, ambiguity and risk.",
      },
      {
        key: "exploratory-thinking",
        code: "3.3",
        name: "Exploratory thinking",
        description: "To adopt a relational way of thinking by exploring and linking different disciplines, using creativity and experimentation with novel ideas or methods.",
      },
    ],
  },
  {
    key: "acting-for-sustainability",
    code: "4",
    name: "Acting for sustainability",
    description: "Taking individual and collective action for sustainability.",
    competences: [
      {
        key: "political-agency",
        code: "4.1",
        name: "Political agency",
        description: "To navigate the political system, identify political responsibility and accountability for unsustainable behaviour, and demand effective policies for sustainability.",
      },
      {
        key: "collective-action",
        code: "4.2",
        name: "Collective action",
        description: "To act for change in collaboration with others.",
      },
      {
        key: "individual-initiative",
        code: "4.3",
        name: "Individual initiative",
        description: "To identify own potential for sustainability and to actively contribute to improving prospects for the community and the planet.",
      },
    ],
  },
];

async function one(sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows[0];
}

async function many(sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows;
}

async function upsertGlobalFramework() {
  return one(
    `
      insert into frameworks(institution_id, key, name, description, owner_type, status, metadata)
      values (null, 'greencomp', 'GreenComp', 'The European sustainability competence framework.', 'system', 'active', $1::jsonb)
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
    [JSON.stringify(sourceMetadata)],
  );
}

async function upsertFrameworkVersion(frameworkId) {
  return one(
    `
      insert into framework_versions(framework_id, version_label, status, definition, source_url, notes, valid_from)
      values ($1, '2022', 'active', $2::jsonb, $3, 'Seeded by CAST v3 Phase 5B as the first evidence-informed map layer.', '2022-01-12')
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
      JSON.stringify({
        ...sourceMetadata,
        areas: greenComp.map((area) => ({
          key: area.key,
          code: area.code,
          name: area.name,
          competences: area.competences.map((competence) => ({
            key: competence.key,
            code: competence.code,
            name: competence.name,
          })),
        })),
      }),
      sourceMetadata.sourceUrl,
    ],
  );
}

async function upsertDomain(frameworkVersionId, area, orderIndex) {
  return one(
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
      area.key,
      area.name,
      area.description,
      orderIndex,
      JSON.stringify({ code: area.code, family: "european", framework: "greencomp" }),
    ],
  );
}

async function upsertCompetence(frameworkVersionId, domainId, competence, orderIndex) {
  return one(
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
      JSON.stringify({ code: competence.code, family: "european", framework: "greencomp" }),
    ],
  );
}

async function upsertLens() {
  return one(
    `
      insert into lenses(institution_id, key, name, description, status, metadata)
      values (null, 'greencomp-curriculum-evidence', 'GreenComp curriculum evidence lens', 'Evidence-informed curriculum mapping lens for GreenComp.', 'active', $1::jsonb)
      on conflict (key) where institution_id is null
      do update set
        name = excluded.name,
        description = excluded.description,
        status = excluded.status,
        metadata = excluded.metadata,
        updated_at = now()
      returning id
    `,
    [JSON.stringify({ family: "european", framework: "greencomp", purpose: "curriculum_evidence_mapping", seed: "cast-v3-phase5b" })],
  );
}

async function upsertLensVersion(lensId) {
  return one(
    `
      insert into lens_versions(lens_id, version_label, status, analysis_contract, output_contract)
      values ($1, '2022-evidence-v1', 'active', $2::jsonb, $3::jsonb)
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

async function upsertLensBinding(lensVersionId, frameworkId, frameworkVersionId) {
  return one(
    `
      insert into lens_framework_bindings(lens_version_id, framework_id, framework_version_id, binding_role, configuration)
      values ($1, $2, $3, 'primary', $4::jsonb)
      on conflict (lens_version_id, framework_id, framework_version_id)
      do update set
        binding_role = excluded.binding_role,
        configuration = excluded.configuration
      returning id
    `,
    [lensVersionId, frameworkId, frameworkVersionId, JSON.stringify({ frameworkKey: "greencomp", versionLabel: "2022" })],
  );
}

async function upsertLensRule(lensVersionId, key, ruleType, rule, orderIndex) {
  return one(
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

async function upsertOutputSchema(lensVersionId) {
  return one(
    `
      insert into lens_output_schemas(lens_version_id, key, schema)
      values ($1, 'greencomp-competency-evaluation-v1', $2::jsonb)
      on conflict (lens_version_id, key)
      do update set schema = excluded.schema
      returning id
    `,
    [
      lensVersionId,
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

async function seed() {
  const framework = await upsertGlobalFramework();
  const frameworkVersion = await upsertFrameworkVersion(framework.id);
  let domainCount = 0;
  let competenceCount = 0;
  for (const [areaIndex, area] of greenComp.entries()) {
    const domain = await upsertDomain(frameworkVersion.id, area, areaIndex + 1);
    domainCount += 1;
    for (const [competenceIndex, competence] of area.competences.entries()) {
      await upsertCompetence(frameworkVersion.id, domain.id, competence, areaIndex * 10 + competenceIndex + 1);
      competenceCount += 1;
    }
  }

  const lens = await upsertLens();
  const lensVersion = await upsertLensVersion(lens.id);
  await upsertLensBinding(lensVersion.id, framework.id, frameworkVersion.id);
  await upsertLensRule(
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
  await upsertOutputSchema(lensVersion.id);

  const counts = await many(
    `
      select
        (select count(*) from competency_domains where framework_version_id = $1) as domains,
        (select count(*) from competencies where framework_version_id = $1) as competencies,
        (select count(*) from lenses where key = 'greencomp-curriculum-evidence' and institution_id is null) as lenses,
        (select count(*) from lens_framework_bindings where lens_version_id = $2 and framework_version_id = $1) as bindings,
        (select count(*) from lens_evidence_rules where lens_version_id = $2) as rules,
        (select count(*) from lens_output_schemas where lens_version_id = $2) as output_schemas
    `,
    [frameworkVersion.id, lensVersion.id],
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
}

async function main() {
  await client.connect();
  try {
    const result = await seed();
    console.log("GREENCOMP_SEED=ok");
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
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
