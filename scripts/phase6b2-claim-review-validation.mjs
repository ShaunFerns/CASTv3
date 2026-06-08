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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function one(sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows[0];
}

async function main() {
  await client.connect();
  await client.query("begin");

  try {
    const institution = await one(`
      insert into institutions(name, slug, status, settings)
      values ('CAST Phase 6B2 Smoke Institution', 'cast-phase6b2-smoke', 'active', '{"smoke":true}'::jsonb)
      returning id
    `);
    const reviewer = await one(`
      insert into users(email, display_name, status, metadata)
      values ('phase6b2-reviewer@cast.local', 'Phase 6B2 Reviewer', 'active', '{"smoke":true}'::jsonb)
      returning id, email, display_name
    `);
    const analysisRun = await one(`
      insert into analysis_runs(institution_id, run_type, status, started_at, completed_at, configuration, summary)
      values ($1, 'framework_analysis', 'completed', now(), now(), '{"phase":"6B.2","smoke":true}'::jsonb, '{"claimsCreated":1}'::jsonb)
      returning id
    `, [institution.id]);
    const modelRun = await one(`
      insert into ai_model_runs(institution_id, analysis_run_id, provider, model, status, started_at, completed_at, model_configuration)
      values ($1, $2, 'cast', 'deterministic-greencomp-claims-v1', 'completed', now(), now(), '{"aiCallMade":false}'::jsonb)
      returning id
    `, [institution.id, analysisRun.id]);
    const claim = await one(`
      insert into ai_claims(
        institution_id,
        analysis_run_id,
        ai_model_run_id,
        claim_type,
        status,
        title,
        claim_text,
        rationale,
        confidence,
        metadata
      )
      values (
        $1,
        $2,
        $3,
        'competency_observation',
        'needs_review',
        'GreenComp smoke claim',
        'Evidence suggests this module addresses a GreenComp competence.',
        'Smoke claim linked to a deterministic analysis run.',
        0.74,
        '{"phase":"6B.2","claimOnly":true,"notInstitutionalFinding":true}'::jsonb
      )
      returning id, claim_text
    `, [institution.id, analysisRun.id, modelRun.id]);

    const acceptedReview = await one(`
      insert into human_reviews(institution_id, subject_type, ai_claim_id, reviewer_user_id, decision, rationale, metadata)
      values ($1, 'ai_claim', $2, $3, 'accept', 'Evidence is sufficient for a reviewed finding.', '{"phase":"6B.2","institutionalFinding":true}'::jsonb)
      returning id, decision, created_at
    `, [institution.id, claim.id, reviewer.id]);

    const acceptedStatus = await one(`
      select
        case hr.decision
          when 'accept' then 'accepted'
          when 'reject' then 'rejected'
          when 'amend' then 'amended'
          when 'request_clarification' then 'clarification_required'
          when 'not_applicable' then 'not_applicable'
        end as review_status,
        (hr.decision in ('accept', 'amend')) as is_institutional_finding,
        case when hr.decision = 'amend' then coalesce(hr.amended_text, ac.claim_text)
             when hr.decision = 'accept' then ac.claim_text
             else null
        end as finding_text,
        ac.claim_text as original_claim_text
      from human_reviews hr
      join ai_claims ac on ac.id = hr.ai_claim_id
      where hr.id = $1
    `, [acceptedReview.id]);

    assert(acceptedStatus.review_status === "accepted", "Expected accepted review status");
    assert(acceptedStatus.is_institutional_finding === true, "Accepted claim should be a finding");
    assert(acceptedStatus.finding_text === claim.claim_text, "Accepted finding should use the original claim text");

    const amendedReview = await one(`
      insert into human_reviews(institution_id, subject_type, ai_claim_id, reviewer_user_id, decision, amended_text, rationale, metadata)
      values ($1, 'ai_claim', $2, $3, 'amend', 'Reviewed finding text amended by a human reviewer.', 'Finding text clarified.', '{"phase":"6B.2","institutionalFinding":true}'::jsonb)
      returning id, decision, amended_text
    `, [institution.id, claim.id, reviewer.id]);

    const reviewCounts = await one(`
      select
        count(*)::int as total_reviews,
        count(*) filter (where decision = 'accept')::int as accepted_reviews,
        count(*) filter (where decision = 'amend')::int as amended_reviews
      from human_reviews
      where institution_id = $1 and ai_claim_id = $2
    `, [institution.id, claim.id]);

    const latestFinding = await one(`
      select
        case when hr.decision = 'amend' then hr.amended_text
             when hr.decision = 'accept' then ac.claim_text
             else null
        end as finding_text,
        hr.decision,
        ac.claim_text as original_claim_text
      from human_reviews hr
      join ai_claims ac on ac.id = hr.ai_claim_id
      where hr.institution_id = $1 and hr.ai_claim_id = $2
      order by hr.created_at desc, hr.id desc
      limit 1
    `, [institution.id, claim.id]);

    assert(reviewCounts.total_reviews === 2, "Expected two review history records");
    assert(reviewCounts.accepted_reviews === 1, "Expected one accepted review");
    assert(reviewCounts.amended_reviews === 1, "Expected one amended review");
    assert(latestFinding.decision === "amend", "Expected latest review to be amended");
    assert(latestFinding.finding_text === amendedReview.amended_text, "Amended finding should use amended review text");
    assert(latestFinding.original_claim_text === claim.claim_text, "Original claim text should be preserved");

    console.log("PHASE6B2_CLAIM_REVIEW_SMOKE=passed");
    console.log(`CLAIM_ID=${claim.id}`);
    console.log(`REVIEWS_RECORDED=${reviewCounts.total_reviews}`);
    console.log("ACCEPTED_CREATES_FINDING=true");
    console.log("AMENDED_CREATES_FINDING=true");
    console.log("ORIGINAL_CLAIM_PRESERVED=true");

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
