DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'evidence_maturity_level') THEN
    CREATE TYPE evidence_maturity_level AS ENUM ('none', 'developing', 'consolidating', 'leading');
  END IF;
END $$;

ALTER TABLE priority_expectations
  ALTER COLUMN expected_level DROP DEFAULT,
  ALTER COLUMN expected_level TYPE evidence_maturity_level
    USING (
      CASE expected_level::text
        WHEN 'not_applicable' THEN 'none'
        WHEN 'introduce' THEN 'developing'
        WHEN 'develop' THEN 'consolidating'
        WHEN 'integrate' THEN 'leading'
        WHEN 'demonstrate' THEN 'leading'
        ELSE 'none'
      END
    )::evidence_maturity_level,
  ALTER COLUMN expected_level SET DEFAULT 'none';

ALTER TABLE programme_attribute_expectations
  ALTER COLUMN expected_level DROP DEFAULT,
  ALTER COLUMN expected_level TYPE evidence_maturity_level
    USING (
      CASE expected_level::text
        WHEN 'not_applicable' THEN 'none'
        WHEN 'introduce' THEN 'developing'
        WHEN 'develop' THEN 'consolidating'
        WHEN 'integrate' THEN 'leading'
        WHEN 'demonstrate' THEN 'leading'
        ELSE 'none'
      END
    )::evidence_maturity_level,
  ALTER COLUMN expected_level SET DEFAULT 'none';

ALTER TABLE programme_competency_expectations
  ALTER COLUMN expected_level DROP DEFAULT,
  ALTER COLUMN expected_level TYPE evidence_maturity_level
    USING (
      CASE expected_level::text
        WHEN 'not_applicable' THEN 'none'
        WHEN 'introduce' THEN 'developing'
        WHEN 'develop' THEN 'consolidating'
        WHEN 'integrate' THEN 'leading'
        WHEN 'demonstrate' THEN 'leading'
        ELSE 'none'
      END
    )::evidence_maturity_level,
  ALTER COLUMN expected_level SET DEFAULT 'none';

ALTER TABLE competency_evaluations
  ALTER COLUMN observed_level DROP DEFAULT,
  ALTER COLUMN observed_level TYPE evidence_maturity_level
    USING (
      CASE observed_level::text
        WHEN 'not_applicable' THEN 'none'
        WHEN 'introduce' THEN 'developing'
        WHEN 'develop' THEN 'consolidating'
        WHEN 'integrate' THEN 'leading'
        WHEN 'demonstrate' THEN 'leading'
        ELSE 'none'
      END
    )::evidence_maturity_level,
  ALTER COLUMN observed_level SET DEFAULT 'none';

ALTER TABLE ai_claims
  ALTER COLUMN observed_level TYPE evidence_maturity_level
    USING (
      CASE observed_level::text
        WHEN 'not_applicable' THEN 'none'
        WHEN 'introduce' THEN 'developing'
        WHEN 'develop' THEN 'consolidating'
        WHEN 'integrate' THEN 'leading'
        WHEN 'demonstrate' THEN 'leading'
        ELSE NULL
      END
    )::evidence_maturity_level;

ALTER TABLE descriptor_improvement_suggestions
  ALTER COLUMN intended_level TYPE evidence_maturity_level
    USING (
      CASE intended_level::text
        WHEN 'not_applicable' THEN 'none'
        WHEN 'introduce' THEN 'developing'
        WHEN 'develop' THEN 'consolidating'
        WHEN 'integrate' THEN 'leading'
        WHEN 'demonstrate' THEN 'leading'
        ELSE NULL
      END
    )::evidence_maturity_level;
