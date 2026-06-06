DO $$
BEGIN
  IF to_regclass('public.module_reviews') IS NOT NULL THEN
    EXECUTE $view$
      CREATE OR REPLACE VIEW compat_legacy_module_reviews
      WITH (security_invoker = true) AS
      SELECT
        id AS legacy_module_review_id,
        NULL::uuid AS institution_id,
        module_code,
        module_title,
        source_type,
        source_file_name,
        raw_text,
        overview,
        learning_outcomes,
        indicative_syllabus,
        teaching_methods,
        assessment_text,
        stage_inferred,
        credits,
        semester,
        campus,
        school,
        review_status,
        created_at,
        updated_at
      FROM module_reviews
    $view$;
  END IF;

  IF to_regclass('public.programmes') IS NOT NULL THEN
    EXECUTE $view$
      CREATE OR REPLACE VIEW compat_legacy_programmes
      WITH (security_invoker = true) AS
      SELECT
        id AS legacy_programme_id,
        NULL::uuid AS institution_id,
        code,
        name,
        description,
        created_at,
        updated_at
      FROM programmes
    $view$;
  END IF;

  IF to_regclass('public.programme_modules') IS NOT NULL THEN
    EXECUTE $view$
      CREATE OR REPLACE VIEW compat_legacy_programme_modules
      WITH (security_invoker = true) AS
      SELECT
        id AS legacy_programme_module_id,
        NULL::uuid AS institution_id,
        programme_id AS legacy_programme_id,
        module_id AS legacy_module_review_id,
        stage,
        semester,
        core_option,
        order_index,
        created_at
      FROM programme_modules
    $view$;
  END IF;

  IF to_regclass('public.ga_classifications') IS NOT NULL THEN
    EXECUTE $view$
      CREATE OR REPLACE VIEW compat_legacy_ga_classifications
      WITH (security_invoker = true) AS
      SELECT
        id AS legacy_ga_classification_id,
        NULL::uuid AS institution_id,
        programme_id AS legacy_programme_id,
        module_id AS legacy_module_review_id,
        lens,
        domain,
        level,
        source,
        rationale,
        evidence
      FROM ga_classifications
    $view$;
  END IF;

  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    EXECUTE $view$
      CREATE OR REPLACE VIEW compat_legacy_audit_logs
      WITH (security_invoker = true) AS
      SELECT
        id AS legacy_audit_log_id,
        NULL::uuid AS institution_id,
        actor,
        action_type,
        module_id AS legacy_module_review_id,
        modules_affected,
        lens,
        ip_address,
        details,
        created_at
      FROM audit_logs
    $view$;
  END IF;
END $$;
