# CAST v1 Acceptance Testing Framework

Status: Feature freeze acceptance testing  
Purpose: Identify release blockers, bugs, workflow issues, UX issues, data-integrity issues and performance risks before the first CAST v1 release.

CAST v1 testing should use realistic curriculum data, especially `sample-data/akari_seed_university_v1.xlsx`, and should verify the full evidence-to-enhancement workflow:

Upload -> Programme Workspace -> Programme Map -> Module Builder -> Claims -> Human Review -> Readiness -> SWOT -> Action Planning -> Exports

## Severity Categories

| Severity | Definition | Release Impact |
| --- | --- | --- |
| Critical | Data loss, security weakness, broken deployment, blocked login, blocked upload, or core workflow unusable. | Must fix before v1 release. |
| High | Major workflow failure, incorrect curriculum data, misleading analysis, broken review/action workflow, or serious performance degradation. | Should fix before v1 release unless explicitly accepted. |
| Medium | Usability issue, incomplete empty/loading state, confusing label, partial export issue, or non-blocking workflow friction. | Fix before release where practical; otherwise track as post-v1 hardening. |
| Low | Cosmetic issue, minor wording issue, non-critical polish, or small inconsistency. | Can be deferred if no user confusion or data risk. |

## Backlog Template

| Issue ID | Area | Description | Expected Behaviour | Actual Behaviour | Severity | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CAST-V1-001 | Example area | Example issue description. | Expected result. | Observed result. | Medium | Open | Link screenshots, logs or test data. |

Statuses: `Open`, `In Review`, `Ready to Fix`, `Fixed`, `Retest Required`, `Accepted Risk`, `Deferred`, `Closed`.

## Acceptance Checklist

Use this checklist as the internal acceptance test script. Record pass/fail evidence, browser, environment, dataset and tester initials for each item.

### Module Level

| Test ID | Area | Acceptance Check | Expected Result | Severity If Failed |
| --- | --- | --- | --- | --- |
| MOD-001 | Module Library | Open Module Library after Akari upload. | Uploaded modules are listed with module code, title, credits, stage, semester, descriptor status, evidence count, assessment count and data-quality flags where available. | Critical |
| MOD-002 | Module Library | Search by module code and title. | Results filter quickly and accurately without requiring a programme workspace. | High |
| MOD-003 | Module Library | Filter by programme, stage, semester and upload/import batch. | Filters return the expected module subset and can be cleared. | Medium |
| MOD-004 | Module Library | Open a module from the library. | User lands on the Module Builder detail page for the selected module. | High |
| MOD-005 | Module Builder | Review descriptor evidence sections. | Overview, syllabus, teaching methods, requisites and modality evidence display where imported. | High |
| MOD-006 | Learning Outcomes | Review imported learning outcomes. | Learning outcome codes and descriptions display correctly and remain linked to the module descriptor. | High |
| MOD-007 | Assessments | Review imported assessment components. | Category, type, weighting, indicative week, semester, threshold, authenticity, linked outcomes and description display where provided. | High |
| MOD-008 | Assessments | Check weighting completeness. | Complete assessments total 100%; incomplete weighting is flagged without silent correction. | High |
| MOD-009 | Claims | Generate GreenComp evidence claims for a module with evidence. | Claims are created only where supporting evidence exists and are labelled as AI-supported claims, not findings. | High |
| MOD-010 | Claims | Inspect claim evidence links. | Claim evidence count and supporting evidence references are visible. | High |
| MOD-011 | Human Review | Accept a claim. | Review record is saved; accepted claim becomes a reviewed finding; original claim remains unchanged. | Critical |
| MOD-012 | Human Review | Reject, amend, request clarification and mark not applicable. | Each action creates a review history entry without overwriting source evidence. | High |
| MOD-013 | Improvement Prompts | Open a weak or incomplete module. | Practical non-AI prompts appear for missing descriptors, learning outcomes, assessments, modality or weak evidence. | Medium |
| MOD-014 | Improvement Prompts | Open a complete module. | Prompts reduce appropriately and avoid judgemental wording. | Low |

### Programme Level

| Test ID | Area | Acceptance Check | Expected Result | Severity If Failed |
| --- | --- | --- | --- | --- |
| PROG-001 | Programme Workspace | Open a generated programme workspace. | Summary shows title, code, stage count, semester count, module count and last upload date. | Critical |
| PROG-002 | Programme Workspace | Review curriculum coverage. | GreenComp, LifeComp, EntreComp and DigComp coverage summaries display without implying automatic institutional judgement. | High |
| PROG-003 | Programme Workspace | Review data-quality summary. | Missing codes, missing credits, missing stage/semester, duplicate placements, missing outcomes and missing assessments are summarised. | High |
| PROG-004 | Programme Workspace | Use module drill-through. | Programme Workspace -> Module Library -> Module Builder navigation works. | High |
| PROG-005 | Programme Maps | Open base programme map with no overlay selected. | Stages, semesters, pathways, groups and modules remain visible. | Critical |
| PROG-006 | Programme Maps | Toggle framework layers. | Framework layers are independently visible/invisible and stack without breaking the base map. | High |
| PROG-007 | Programme Maps | Toggle evidence maturity and data-quality layers. | Indicators display correctly and remain distinguishable from framework evidence. | High |
| PROG-008 | Programme Maps | Use Provisional, Reviewed and All filters. | Visualisations default to provisional intelligence, reviewed filter shows reviewed/confirmed values only, and all filter combines valid provisional/reviewed values. | High |
| PROG-009 | Programme Maps | Add map annotation/comment. | Annotation saves, reloads and remains scoped to the correct programme map. | Medium |
| PROG-010 | Programme Maps | Create snapshot and export. | Snapshot and JSON/CSV export complete successfully with human-readable labels. | High |
| PROG-011 | Readiness | Open readiness tab. | Curriculum structure, framework coverage, assessment design, data quality and reviewed findings display as evidence-informed indicators. | High |
| PROG-012 | Readiness | Capture readiness assessment. | Captured summary stores strengths, gaps and observations without making automatic institutional decisions. | High |
| PROG-013 | SWOT | Create SWOT items from findings or readiness observations. | Strength, weakness, opportunity and threat items save with traceability to supporting evidence where provided. | High |
| PROG-014 | Action Planning | Create actions from SWOT/readiness/finding context. | Actions save owner, priority, target date, status and progress notes, with traceability. | High |
| PROG-015 | Monitoring | Review action summary. | Total, open, overdue and completed action counts are accurate. | Medium |
| PROG-016 | Exports | Export programme summary, readiness, SWOT and action reports. | Exports generate successfully and do not expose developer terminology. | High |

### Institution Level

| Test ID | Area | Acceptance Check | Expected Result | Severity If Failed |
| --- | --- | --- | --- | --- |
| INST-001 | Curriculum Intelligence | Dashboard summary updates after upload. | Programme, module, evidence and framework layer counts reflect uploaded data. | High |
| INST-002 | Shared Modules | Upload data with modules shared across programmes. | Shared modules remain canonical while programme placements are programme-specific. | Critical |
| INST-003 | Framework Coverage | Review multi-framework summaries. | GreenComp, LifeComp, EntreComp, DigComp, Assessment and Modality layer outputs display where seeded/evaluated. | High |
| INST-004 | Data Quality | Open data-quality diagnostics after imperfect upload. | Known issues are surfaced and source data is preserved rather than silently cleaned. | High |
| INST-005 | Data Quality | Check duplicate placement diagnostics. | Duplicate programme placements are detected and repeated uploads remain idempotent. | Critical |
| INST-006 | Provisional Intelligence | Upload programme data and open maps/workspace immediately. | Provisional summaries and visual indicators appear with the message: "Provisional analysis. Review required before formal use." | High |
| INST-007 | Confirmed Findings | Review/accept claims. | Reviewed/accepted values become confirmed findings and remain distinguishable from provisional analysis. | High |

### Administration

| Test ID | Area | Acceptance Check | Expected Result | Severity If Failed |
| --- | --- | --- | --- | --- |
| ADMIN-001 | Uploads | Upload the synthetic Akari workbook. | Upload completes, import validation counts are clear, and records appear in Module Library and Programme Workspace. | Critical |
| ADMIN-002 | Uploads | Upload module PDF/text descriptor. | Module, descriptor sections and evidence items are created or updated as expected. | High |
| ADMIN-003 | Uploads | Complete manual module entry. | Module, descriptor sections and evidence records are created without developer terminology in the UI. | High |
| ADMIN-004 | Repeated Uploads | Upload the same Akari workbook twice. | Canonical module count and programme placement count do not incorrectly duplicate. | Critical |
| ADMIN-005 | Delete Workflow | Delete an upload batch with no protected reviewed records. | Uploaded test data is removed or archived safely; framework seeds remain. | High |
| ADMIN-006 | Delete Workflow | Attempt normal deletion where reviewed findings exist. | Deletion is blocked with accurate diagnostics. | Critical |
| ADMIN-007 | Bootstrap Override | Use bootstrap administrator hard delete override. | Strong warning displays; protected records are deleted only by bootstrap admin; audit event is written. | Critical |
| ADMIN-008 | Permissions | Access protected routes while logged out. | User is redirected to login or receives a safe authentication-required response. | Critical |
| ADMIN-009 | Permissions | Access protected workflows as authenticated bootstrap admin. | Upload Curriculum, Programme Workspace, Programme Map, Framework Hub and Module Builder are usable. | Critical |
| ADMIN-010 | Permissions | Verify public navigation. | Public users do not see operational actions such as Upload Curriculum, Data Quality or Administration. | High |
| ADMIN-011 | Audit | Perform upload, review and cleanup actions. | Audit events are written for protected actions with safe actor context. | High |

## CAST v1 Acceptance Criteria

CAST v1 is acceptable for release when all critical criteria pass and any high-severity exceptions are explicitly accepted.

| Criterion ID | Acceptance Criterion | Required Result |
| --- | --- | --- |
| AC-001 | Akari upload works. | The reference synthetic workbook uploads successfully and produces canonical modules, programme structures, descriptor sections, learning outcomes, assessments and evidence items. |
| AC-002 | Learning outcomes display correctly. | Module Builder shows imported learning outcome codes and descriptions for modules with learning outcome data. |
| AC-003 | Assessment components display correctly. | Module Builder shows imported assessment category, type, weighting, semester/week and outcome links where available. |
| AC-004 | Duplicate uploads are handled correctly. | Re-uploading the same workbook does not inflate canonical module counts or programme placement counts. |
| AC-005 | Programme maps display correctly. | Base maps remain visible and overlays can be toggled independently. |
| AC-006 | Provisional analysis is immediate and labelled. | Users see provisional intelligence quickly, with review-required wording. |
| AC-007 | Reviewed findings are governed. | Accepted/amended reviews create findings; unreviewed claims remain provisional; rejected claims do not become findings. |
| AC-008 | Human review workflow works. | Accept, reject, amend, request clarification and not-applicable review paths save history without overwriting evidence. |
| AC-009 | SWOT and actions function. | Programme teams can create SWOT items and action plan items with traceability to findings/readiness/evidence. |
| AC-010 | Readiness supports judgement. | Readiness outputs show strengths, gaps and observations without automatic institutional decisions. |
| AC-011 | Exports generate successfully. | Programme maps, comparisons, readiness, SWOT and action exports complete in expected formats. |
| AC-012 | Onboarding tour functions. | First-login tour triggers once, can be skipped/completed, and can be restarted from Help. |
| AC-013 | Deletion protections work. | Normal deletion is blocked where reviewed records exist, while bootstrap override is restricted and audited. |
| AC-014 | Permissions protect operational pages. | Public users cannot access protected CAST v1 workflows. |
| AC-015 | Performance is acceptable with seed data. | Core pages remain usable with `akari_seed_university_v1.xlsx`; slow paths are logged as release blockers or accepted risks. |

## CAST v1 Release Readiness Checklist

### Data and Workflow

- [ ] Reference Akari workbook uploads successfully on staging.
- [ ] Repeated upload test passes without duplicate canonical modules or duplicate programme placements.
- [ ] Module Library shows complete records for uploaded modules.
- [ ] Module Builder shows descriptor evidence, learning outcomes, assessments, modality evidence, claims, reviews and prompts.
- [ ] Programme Workspace overview displays accurate programme, review and data-quality metrics.
- [ ] Programme Map base layer and overlays display correctly.
- [ ] Provisional/reviewed/all analysis filters behave correctly.
- [ ] Claims and human review produce confirmed findings only after review.
- [ ] Readiness, SWOT and Action Planning workflows can be completed end to end.
- [ ] Exports generate successfully and are understandable to non-developers.

### Security and Administration

- [ ] Public users cannot access protected workflows.
- [ ] Bootstrap admin login works with strong production secrets.
- [ ] Preview bridge is disabled in production.
- [ ] Supabase public schema warnings are understood and mitigated by the CAST API access model until full RLS rollout.
- [ ] Audit events are written for login/session, upload, review, delete and bootstrap override actions.
- [ ] Test-data cleanup does not delete framework seeds, users, institutions or audit events.
- [ ] Secrets, database dumps, uploaded documents and production data are not committed.

### Deployment and Performance

- [ ] Fresh deployment applies intended production migrations and skips optional legacy compatibility views.
- [ ] Framework and layer seed scripts are idempotent.
- [ ] Render deploy starts cleanly with required environment variables.
- [ ] Health check passes.
- [ ] Key pages load acceptably with the synthetic seed dataset.
- [ ] Large bundle and slow-query observations are recorded with severity and owner.

### UX and Content

- [ ] Public landing page is distinct from authenticated dashboard.
- [ ] Navigation labels use CAST v1 terminology and avoid developer terms.
- [ ] Empty states explain what the user can do next.
- [ ] Loading states appear for slow operations.
- [ ] Error messages are safe, clear and actionable.
- [ ] Onboarding tour helps first-time users understand the workflow.
- [ ] No TU Dublin-specific wording appears in generic CAST v1 product screens.

## Recommended Testing Order

1. Environment readiness: staging URL, database, migrations, seeds, environment variables and bootstrap admin.
2. Access and permissions: public routes, login, authenticated routes, protected API responses.
3. Upload workflows: Akari workbook, PDF/text descriptor and manual module entry.
4. Data integrity: canonical module reuse, shared modules, repeated upload, programme placement idempotency and data-quality diagnostics.
5. Module workflows: Module Library, Module Builder, learning outcomes, assessments, evidence, improvement prompts and claims.
6. Human review: claim review actions, findings creation, review history and audit events.
7. Programme workflows: Programme Workspace, Programme Maps, provisional/reviewed filters, snapshots and exports.
8. Review workflows: review cycles, readiness summaries and evidence references.
9. Enhancement workflows: SWOT, action planning, monitoring and exports.
10. Administration workflows: cleanup, delete protection, bootstrap override and audit verification.
11. UX review: navigation, wording, empty states, loading states, error states and onboarding.
12. Performance review: seed workbook upload time, Module Library load, Programme Workspace load, Programme Map load, export generation and repeated calculations.
13. Release decision: classify unresolved issues, mark release blockers, accept/defer non-blockers and update the readiness report.

## Testing Evidence to Capture

For each test pass, capture:

- Environment and deployment URL.
- Git commit hash.
- Dataset used.
- Browser and operating system.
- Tester name or initials.
- Date and time.
- Screenshots or screen recordings for failures.
- Server logs or request IDs for API failures.
- Export files for export tests.
- Issue IDs created for failed checks.

