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
  publication: "LifeComp: The European Framework for Personal, Social and Learning to Learn Key Competence",
  authors: ["Arianna Sala", "Yves Punie", "Vladimir Garkov", "Marcelino Cabrera Giraldez"],
  publicationYear: 2020,
  versionLabel: "2020",
  jrcId: "JRC120911",
  doi: "10.2760/302967",
  isbn: "978-92-76-19418-7",
  catalogueNumber: "KJ-NA-30246-EN-N",
  sourceUrl: "https://joint-research-centre.ec.europa.eu/lifecomp_en",
  referenceModelUrl: "https://joint-research-centre.ec.europa.eu/lifecomp/lifecomp-conceptual-reference-model_en",
  seed: "cast-v3-phase5c",
};

const lifeComp = [
  {
    key: "personal",
    code: "P",
    name: "Personal",
    description: "Competences for self-awareness, self-management, adaptability and wellbeing.",
    competences: [
      {
        key: "self-regulation",
        code: "P1",
        name: "Self-regulation",
        description: "Awareness and management of emotions, thoughts and behaviour.",
      },
      {
        key: "flexibility",
        code: "P2",
        name: "Flexibility",
        description: "Ability to manage transitions and uncertainty, and to face challenges.",
      },
      {
        key: "wellbeing",
        code: "P3",
        name: "Wellbeing",
        description: "Pursuit of life satisfaction, care of physical, mental and social health, and adoption of a sustainable lifestyle.",
      },
    ],
  },
  {
    key: "social",
    code: "S",
    name: "Social",
    description: "Competences for understanding others, communicating and collaborating.",
    competences: [
      {
        key: "empathy",
        code: "S1",
        name: "Empathy",
        description: "The understanding of another person's emotions, experiences and values, and the provision of appropriate responses.",
      },
      {
        key: "communication",
        code: "S2",
        name: "Communication",
        description: "Use of relevant communication strategies, domain-specific codes and tools depending on the context and the content.",
      },
      {
        key: "collaboration",
        code: "S3",
        name: "Collaboration",
        description: "Engagement in group activity and teamwork acknowledging and respecting others.",
      },
    ],
  },
  {
    key: "learning-to-learn",
    code: "L",
    name: "Learning to learn",
    description: "Competences for reflective, self-directed and lifelong learning.",
    competences: [
      {
        key: "growth-mindset",
        code: "L1",
        name: "Growth mindset",
        description: "Belief in one's and others' potential to continuously learn and progress.",
      },
      {
        key: "critical-thinking",
        code: "L2",
        name: "Critical thinking",
        description: "Assessment of information and arguments to support reasoned conclusions and develop innovative solutions.",
      },
      {
        key: "managing-learning",
        code: "L3",
        name: "Managing learning",
        description: "The planning, organising, monitoring and reviewing of one's own learning.",
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
      values (null, 'lifecomp', 'LifeComp', 'The European framework for personal, social and learning to learn key competence.', 'system', 'active', $1::jsonb)
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
      values ($1, '2020', 'active', $2::jsonb, $3, 'Seeded by CAST v3 Phase 5C as the second evidence-informed European map layer.', '2020-07-03')
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
        areas: lifeComp.map((area) => ({
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
      JSON.stringify({ code: area.code, family: "european", framework: "lifecomp" }),
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
      JSON.stringify({ code: competence.code, family: "european", framework: "lifecomp" }),
    ],
  );
}

async function upsertLens() {
  return one(
    `
      insert into lenses(institution_id, key, name, description, status, metadata)
      values (null, 'lifecomp-curriculum-evidence', 'LifeComp curriculum evidence lens', 'Evidence-informed curriculum mapping lens for LifeComp.', 'active', $1::jsonb)
      on conflict (key) where institution_id is null
      do update set
        name = excluded.name,
        description = excluded.description,
        status = excluded.status,
        metadata = excluded.metadata,
        updated_at = now()
      returning id
    `,
    [JSON.stringify({ family: "european", framework: "lifecomp", purpose: "curriculum_evidence_mapping", seed: "cast-v3-phase5c" })],
  );
}

async function upsertLensVersion(lensId) {
  return one(
    `
      insert into lens_versions(lens_id, version_label, status, analysis_contract, output_contract)
      values ($1, '2020-evidence-v1', 'active', $2::jsonb, $3::jsonb)
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
    [lensVersionId, frameworkId, frameworkVersionId, JSON.stringify({ frameworkKey: "lifecomp", versionLabel: "2020" })],
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
      values ($1, 'lifecomp-competency-evaluation-v1', $2::jsonb)
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
  for (const [areaIndex, area] of lifeComp.entries()) {
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
        (select count(*) from lenses where key = 'lifecomp-curriculum-evidence' and institution_id is null) as lenses,
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
    console.log("LIFECOMP_SEED=ok");
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
