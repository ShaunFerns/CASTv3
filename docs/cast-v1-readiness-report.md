# CAST v1 Readiness Report

Date: 2026-06-10  
Status: Hardening and acceptance testing phase  
Codebase: CAST v3 preparing for first CAST v1 product release

## Purpose

CAST is the Curriculum Analysis and Strategy Tool: an evidence-informed curriculum intelligence and enhancement platform for higher education.

The current objective is not new feature development. The objective is to prepare CAST for first-release readiness through stability checks, data-integrity testing, workflow validation, usability review, performance observation and deployment hardening.

## Current Working Features

- Public landing page, CAST v3 bootstrap login and authenticated dashboard.
- Upload Curriculum flows for module PDF/text, manual module entry and Akari-compatible programme spreadsheets.
- Akari multi-sheet import into canonical modules, module descriptors, descriptor sections, learning outcomes, assessment components, modality evidence and programme affiliations.
- Module Library for browsing uploaded canonical modules and upload history cleanup actions.
- Module Builder with descriptor evidence, learning outcomes, assessments, modality evidence, improvement prompts, evidence claims and human review.
- Programme Workspace overview with programme summary, module status, data quality, review and readiness views.
- Programme Maps with framework/design/data-quality overlays, annotations, snapshots and exports.
- Framework and design layers for GreenComp, LifeComp, Assessment and Modality using evidence maturity levels: None, Developing, Consolidating, Leading.
- Evidence claims foundation and human review workflow, keeping claims distinct from reviewed findings.
- Review cycles, readiness assessments, SWOT, action planning and monitoring.
- Guided onboarding tour for first-time workflow orientation.
- Supabase/PostgreSQL schema hardening with public-table RLS hardening migration present.

## Acceptance Dataset

The synthetic Akari seed workbook is suitable for v1 acceptance and performance testing:

File: `sample-data/akari_seed_university_v1.xlsx`

Observed workbook scale:

| Sheet | Rows |
| --- | ---: |
| Affiliated Programmes | 528 |
| Module Assessments | 432 |
| Learning Outcomes | 796 |
| Requisites | 144 |
| Assessment Threshold Label | 144 |
| Sharing Arrangements | 144 |
| Module Overview | 144 |
| Indicative Syllabus | 144 |
| Indicative Syllabus New Table | 144 |
| Learning Teaching Methods | 144 |
| Change Description | 144 |
| Reassessment Requirement | 144 |
| Derogations | 144 |
| Module Modalities | 144 |

This dataset is large enough to test realistic programme sharing, programme placement integrity, descriptor evidence materialisation, learning-outcome creation, assessment creation, modality evidence, programme maps and review workflows.

## Data Integrity Review

### Areas Already Addressed

- Canonical modules are separated from upload/source records.
- Programme placement integrity has semantic duplicate checks for repeated Akari uploads.
- Import batches preserve source truth while materialising canonical curriculum records.
- Test-data cleanup is scoped to uploaded test data and avoids framework seeds, institutions, users and audit events.
- Human reviews and reviewed findings create safety boundaries around deletion.
- Audit events are used for sensitive lifecycle actions.

### Acceptance Tests Still Required

- Upload the same Akari workbook twice and confirm canonical module count remains stable.
- Confirm programme placement count remains stable after repeated upload.
- Confirm evidence items do not multiply unexpectedly after repeated upload.
- Confirm source records/import history remain traceable after repeated upload.
- Confirm archive/delete is blocked when reviewed claims, findings or actions exist.
- Confirm framework seeds remain after upload cleanup.
- Confirm programme maps use generated programme structures without inventing missing stage/semester data.

## End-to-End Workflow Test Plan

The full v1 workflow should be tested with `akari_seed_university_v1.xlsx`:

1. Log in through CAST bootstrap access.
2. Upload the Akari workbook through Upload Curriculum.
3. Confirm import summary: modules, programme links, outcomes, assessments, modality evidence and validation warnings.
4. Open Module Library and verify search/filter, module counts, descriptor status, evidence count, assessment count and data-quality flags.
5. Open Module Builder for representative modules and verify descriptor evidence, learning outcomes, assessment components, modality evidence and improvement prompts.
6. Generate GreenComp evidence claims for representative modules.
7. Review claims as accepted, rejected, amended, clarification required and not applicable.
8. Open Programme Workspace and verify summary, coverage, review status and data-quality sections.
9. Open Programme Map and toggle framework, design and data-quality layers.
10. Create a programme map annotation, snapshot and export.
11. Create or inspect review cycles and readiness views.
12. Create SWOT items linked to findings/readiness observations.
13. Create action plan items linked to SWOT/finding/readiness context.
14. Verify monitoring summaries and exports.
15. Repeat upload and verify idempotency.
16. Cleanup test upload and verify modules/programmes disappear where safe.

## UX Review

### Strengths

- The authenticated dashboard now communicates the CAST workflow: Evidence, Analyse, Insights, Review, Act.
- Upload Curriculum uses user-facing terminology and avoids developer terms such as ingestion.
- Module Library closes a major usability gap by letting users inspect uploads immediately.
- Module Builder now supports a usable loop: upload, inspect, prompt, claim, review.
- Programme Workspace has become the main programme chair surface.
- The onboarding tour helps orient first-time users without becoming a large help system.

### UX Risks

- Some legacy routes and labels remain in the codebase and should be tested for accidental exposure.
- Newer Programme Workspace tabs may need more consistent empty states and loading states.
- Module Builder deep links should be tested when no module is selected.
- Upload cleanup actions are powerful and should be tested carefully for confirmation copy and disabled states.
- The public, dashboard and About pages should remain clearly differentiated.

## Performance Observations

### Known Signals

- The seed workbook provides a realistic baseline of 144 modules, 528 programme affiliations, 796 learning outcomes and 432 assessment components.
- Frontend build previously reports large bundle/chunk warnings. This is not automatically a release blocker, but it is a v1 performance risk.
- Programme Workspace, Programme Map and Module Builder now perform several aggregate queries and derived calculations; these should be timed against the seed workbook.
- Repeated calculations for coverage, claims and data quality should be profiled before Porto demonstration preparation.

### Deployment Hardening Completed In This Pass

- The production migration runner has been updated to include migrations `0001` through `0013`.
- The optional legacy compatibility view migration `0090_legacy_compatibility_views.sql` remains outside the default production path and is only included when explicitly requested.
- Migration-runner object validation now includes the Phase 7B review/readiness additions and Phase 7C SWOT/action traceability links.

### Performance Tests To Run

- Akari workbook upload elapsed time and memory footprint.
- Module Library initial load, search and filter response time.
- Programme Workspace overview load time for a programme with many shared modules.
- Programme Map layer toggle response time.
- Module Builder load time for descriptor-heavy modules.
- Claim generation smoke timing for representative modules.
- Export generation timing for programme maps, comparison, review/readiness and action reports.

## Release Blockers

| ID | Issue | Severity | Workflow Affected | Proposed Fix |
| --- | --- | --- | --- | --- |
| V1-BLOCKER-001 | Full end-to-end acceptance testing has not yet been executed on staging with the synthetic Akari workbook. | Critical | All v1 workflows | Run the full acceptance checklist and record pass/fail evidence before release. |
| V1-BLOCKER-002 | Delete/archive safety must be proven with reviewed claims, findings and action plans present. | High | Data integrity, governance | Run destructive-action acceptance tests and confirm protected records block hard deletion. |
| V1-BLOCKER-003 | The updated migration runner must be validated against disposable/staging Supabase after including migrations `0012` and `0013`. | High | Deployment, Review, Readiness, SWOT, Action Planning | Run the production migration path against a clean staging database and confirm required tables, indexes and RLS status. |

## High-Priority Fix Candidates

| ID | Issue | Severity | Workflow Affected | Proposed Fix |
| --- | --- | --- | --- | --- |
| V1-HIGH-001 | Duplicate evidence behaviour after repeated uploads needs formal regression coverage. | High | Upload, Module Builder, Programme Workspace | Add or run acceptance tests checking module, placement, descriptor section and evidence counts before/after repeated upload. |
| V1-HIGH-002 | Programme placement idempotency is implemented but should be regression tested with shared modules across multiple programmes. | High | Programme Workspace, Programme Map | Upload the seed workbook twice and compare placement counts by programme/module/stage/semester/pathway/group/core-option. |
| V1-HIGH-003 | Data-quality diagnostics should be verified against controlled issue workbooks. | High | Data Quality, Programme Workspace | Generate a seed workbook with `--include-data-quality-issues` and verify warnings for missing stage, semester, credits, outcomes and duplicate placements. |
| V1-HIGH-004 | RLS hardening exists, but application access still relies on server-side session enforcement rather than full Supabase Auth/OIDC. | High | Security | Keep browser mutations behind the CAST API, verify no direct client table access, and plan full identity/RLS implementation post-v1. |
| V1-HIGH-005 | Render deployment should be tested from a fresh service build using the production migration/seed path. | High | Deployment | Run Render smoke after updating migration coverage and confirm bootstrap login, dashboard and core workflows. |

## Medium-Priority Fix Candidates

| ID | Issue | Severity | Workflow Affected | Proposed Fix |
| --- | --- | --- | --- | --- |
| V1-MED-001 | Frontend bundle/chunk size warnings may affect first-load performance. | Medium | All frontend screens | Add code splitting for larger authenticated workspace pages after v1 blockers are resolved. |
| V1-MED-002 | Empty and loading states across newer Programme Workspace tabs may be inconsistent. | Medium | Programme Workspace | Review each tab with no data, partial data and large data. |
| V1-MED-003 | Onboarding tour should be smoke tested across protected routes and missing-selection states. | Medium | Onboarding, Module Builder, Programme Workspace | Confirm tour gracefully handles unavailable targets and can be restarted from Help. |
| V1-MED-004 | Export content should be reviewed for human-readable labels and absence of developer terminology. | Medium | Programme Map, Comparison, Review, Readiness, SWOT, Actions | Test JSON/CSV exports and check column naming. |
| V1-MED-005 | Legacy prototype routes remain in the app and may confuse testers if accidentally exposed. | Medium | Navigation, UX | Audit route access and labels; defer removal until after v1 unless a route creates user confusion. |

## UX Improvements Recommended Before V1

- Review all public and authenticated navigation labels for consistent CAST terminology.
- Ensure every protected route has a clear authentication-required response.
- Add stronger empty states for Programme Workspace tabs when no review cycles, readiness entries, SWOT items or actions exist.
- Add small explanatory text to destructive cleanup modals that clarifies archive versus hard delete.
- Test the About page, landing page and dashboard as three distinct surfaces: orientation, product entry and working platform.
- Confirm Module Library search/filter labels do not expose source-table or ingestion terminology.

## Performance Recommendations

- Use the seed workbook as the standard v1 performance fixture.
- Record timing for upload, Module Library load, Programme Workspace load, Programme Map load and Module Builder load.
- Cache or precompute expensive programme summaries only after measured bottlenecks are confirmed.
- Review database indexes only against observed slow queries, not speculative joins.
- Consider route-level code splitting for Programme Workspace, Programme Map and Module Builder if first-load performance is weak.

## Acceptance Testing Backlog

| Test ID | Acceptance Test | Severity | Expected Result |
| --- | --- | --- | --- |
| AT-001 | Upload `akari_seed_university_v1.xlsx`. | Critical | Import completes with module, programme, descriptor, outcome, assessment and modality counts. |
| AT-002 | Upload the same workbook a second time. | Critical | Canonical module count and programme placement count do not duplicate. |
| AT-003 | Open Module Library after upload. | Critical | Modules show code, title, credits, stage/semester where present, descriptor status, evidence count and assessment count. |
| AT-004 | Open Module Builder for a module with assessments. | Critical | Descriptor evidence, outcomes, assessments, modality evidence and prompts are visible. |
| AT-005 | Generate GreenComp claims for one module. | High | Claims are evidence linked and labelled as unreviewed/provisional. |
| AT-006 | Review a claim as accepted and amended. | High | Review history is retained and reviewed finding status is visible. |
| AT-007 | Open Programme Workspace overview. | Critical | Programme summary, coverage, review status, data quality and module status table load. |
| AT-008 | Open Programme Map and toggle layers. | High | Base map remains visible and overlays can be switched without losing structure. |
| AT-009 | Create map annotation, snapshot and export. | Medium | Annotation persists and export is generated. |
| AT-010 | Create a review cycle and readiness summary. | High | Review/readiness data appears in Programme Workspace and exports. |
| AT-011 | Create SWOT and action plan items from reviewed context. | High | Items retain programme/review traceability and appear in monitoring. |
| AT-012 | Attempt hard delete with reviewed records present. | Critical | Hard delete is blocked with safe explanation. |
| AT-013 | Cleanup a safe test upload. | High | Uploaded modules/programmes are removed or archived safely; framework seeds remain. |
| AT-014 | Run Render smoke after deployment. | Critical | Login, dashboard, upload, Module Library and Programme Workspace respond successfully. |
| AT-015 | Verify no secrets or database dumps are committed. | Critical | Secret scan passes and `.gitignore` protects generated/private data. |

## Recommended Post-V1 Enhancements

- Full Supabase Auth/OIDC and broader RLS policy implementation.
- Dedicated automated acceptance suite for seed workbook imports and repeated-upload idempotency.
- Query-level performance instrumentation and targeted indexes.
- More refined Programme Map visualisation modes such as heatmaps and density views.
- Richer human review dashboards for governance and evidence packs.
- Expanded framework seeds and programme-owned graduate attribute tooling.
- Role-specific dashboards for programme chairs, module leaders, reviewers and quality teams.

## Current Recommendation

CAST should remain in feature freeze until the release blockers are resolved and the acceptance checklist is run against a staging deployment using the synthetic Akari workbook. The strongest immediate action is to validate the updated production migration path against staging, then run the full upload-to-action-planning workflow with repeated-upload and cleanup checks.
