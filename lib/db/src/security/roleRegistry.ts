export const canonicalPermissions = [
  "platform.admin",
  "platform.support",
  "platform.read",
  "institution.read",
  "institution.manage",
  "institution.manage_users",
  "institution.manage_roles",
  "curriculum.read",
  "curriculum.write",
  "imports.read",
  "imports.manage",
  "frameworks.read",
  "frameworks.manage",
  "evidence.read",
  "evidence.write",
  "analysis.read",
  "analysis.run",
  "analysis.review",
  "programme.read",
  "programme.write",
  "programme.manage_team",
  "review.read",
  "review.manage",
  "review.contribute",
  "action_plan.read",
  "action_plan.write",
  "data_quality.read",
  "data_quality.manage",
  "worker.read",
  "worker.manage",
  "audit.read",
] as const;

export type CanonicalPermission = (typeof canonicalPermissions)[number];

export type CanonicalRoleScope = "platform" | "institution" | "programme";

export type CanonicalRoleDefinition = {
  readonly key: string;
  readonly name: string;
  readonly scope: CanonicalRoleScope;
  readonly description: string;
  readonly permissions: readonly CanonicalPermission[];
};

export const canonicalRoles = [
  {
    key: "platform_admin",
    name: "Platform Admin",
    scope: "platform",
    description: "Full CAST platform administration across institutions.",
    permissions: [
      "platform.admin",
      "platform.support",
      "platform.read",
      "institution.read",
      "institution.manage",
      "institution.manage_users",
      "institution.manage_roles",
      "frameworks.manage",
      "audit.read",
    ],
  },
  {
    key: "platform_support",
    name: "Platform Support",
    scope: "platform",
    description: "Support access for platform diagnostics without unrestricted data mutation.",
    permissions: ["platform.support", "platform.read", "institution.read", "audit.read"],
  },
  {
    key: "platform_readonly",
    name: "Platform Readonly",
    scope: "platform",
    description: "Read-only platform oversight.",
    permissions: ["platform.read", "institution.read"],
  },
  {
    key: "institution_admin",
    name: "Institution Admin",
    scope: "institution",
    description: "Institution-level administration, membership and role management.",
    permissions: [
      "institution.read",
      "institution.manage",
      "institution.manage_users",
      "institution.manage_roles",
      "curriculum.read",
      "curriculum.write",
      "imports.manage",
      "frameworks.manage",
      "evidence.read",
      "evidence.write",
      "analysis.run",
      "analysis.review",
      "review.manage",
      "action_plan.write",
      "data_quality.manage",
      "worker.manage",
      "audit.read",
    ],
  },
  {
    key: "quality_lead",
    name: "Quality Lead",
    scope: "institution",
    description: "Institution quality and review leadership.",
    permissions: [
      "institution.read",
      "curriculum.read",
      "evidence.read",
      "analysis.read",
      "analysis.review",
      "review.manage",
      "action_plan.write",
      "data_quality.read",
      "audit.read",
    ],
  },
  {
    key: "curriculum_lead",
    name: "Curriculum Lead",
    scope: "institution",
    description: "Institution curriculum design and enhancement leadership.",
    permissions: [
      "institution.read",
      "curriculum.read",
      "curriculum.write",
      "frameworks.read",
      "evidence.read",
      "evidence.write",
      "analysis.run",
      "analysis.review",
      "programme.read",
      "programme.write",
      "review.contribute",
      "action_plan.write",
    ],
  },
  {
    key: "import_manager",
    name: "Import Manager",
    scope: "institution",
    description: "Source-system import and reconciliation management.",
    permissions: ["institution.read", "imports.read", "imports.manage", "curriculum.read", "data_quality.read"],
  },
  {
    key: "framework_manager",
    name: "Framework Manager",
    scope: "institution",
    description: "Institution-owned frameworks, lenses and priorities management.",
    permissions: ["institution.read", "frameworks.read", "frameworks.manage", "curriculum.read"],
  },
  {
    key: "programme_lead",
    name: "Programme Lead",
    scope: "programme",
    description: "Programme-level ownership and team coordination.",
    permissions: [
      "programme.read",
      "programme.write",
      "programme.manage_team",
      "curriculum.read",
      "curriculum.write",
      "evidence.read",
      "evidence.write",
      "analysis.run",
      "analysis.review",
      "review.contribute",
      "action_plan.write",
      "data_quality.read",
    ],
  },
  {
    key: "programme_editor",
    name: "Programme Editor",
    scope: "programme",
    description: "Programme curriculum and evidence editing.",
    permissions: [
      "programme.read",
      "programme.write",
      "curriculum.read",
      "curriculum.write",
      "evidence.read",
      "evidence.write",
      "analysis.review",
      "review.contribute",
      "action_plan.write",
    ],
  },
  {
    key: "programme_reviewer",
    name: "Programme Reviewer",
    scope: "programme",
    description: "Programme review contribution without general curriculum mutation.",
    permissions: ["programme.read", "curriculum.read", "evidence.read", "analysis.read", "review.contribute"],
  },
  {
    key: "programme_viewer",
    name: "Programme Viewer",
    scope: "programme",
    description: "Read-only programme access.",
    permissions: ["programme.read", "curriculum.read", "evidence.read", "review.read"],
  },
  {
    key: "external_reviewer",
    name: "External Reviewer",
    scope: "programme",
    description: "Time-bound external review contribution for assigned programmes or cycles.",
    permissions: ["programme.read", "curriculum.read", "evidence.read", "review.contribute"],
  },
] as const satisfies readonly CanonicalRoleDefinition[];

export type CanonicalRoleKey = (typeof canonicalRoles)[number]["key"];

export function isCanonicalPermission(value: string): value is CanonicalPermission {
  return canonicalPermissions.includes(value as CanonicalPermission);
}

export function getCanonicalRole(key: string): CanonicalRoleDefinition | undefined {
  return canonicalRoles.find((role) => role.key === key);
}
