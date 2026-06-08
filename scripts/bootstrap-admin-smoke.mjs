import { spawn } from "node:child_process";
import process from "node:process";

const port = process.env.PORT ?? "4194";
const slug = process.env.CAST_BOOTSTRAP_INSTITUTION_SLUG ?? "";

if (!slug.startsWith("codex-smoke-")) {
  throw new Error("Refusing to run bootstrap smoke unless CAST_BOOTSTRAP_INSTITUTION_SLUG starts with codex-smoke-");
}

const serverEnv = {
  ...process.env,
  PORT: port,
  NODE_ENV: process.env.NODE_ENV ?? "development",
  AI_INTEGRATIONS_OPENAI_BASE_URL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  AI_INTEGRATIONS_OPENAI_API_KEY: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "dummy-local-key",
  SESSION_SECRET: process.env.SESSION_SECRET ?? "local-bootstrap-smoke-secret-32-chars",
  ADMIN_USERNAME: process.env.ADMIN_USERNAME ?? "legacy-admin",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? "legacy-admin-password",
  CAST_V3_PREVIEW_BRIDGE: "false",
};

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(url, options = {}) {
  const response = await fetch(url, options);
  return {
    status: response.status,
    headers: response.headers,
    text: await response.text(),
  };
}

function parseJson(result) {
  return result.text ? JSON.parse(result.text) : {};
}

async function waitForHealth(baseUrl) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await wait(500);
    try {
      const health = await request(`${baseUrl}/api/healthz`);
      if (health.status === 200) return health;
    } catch {
      // Keep waiting until server startup finishes.
    }
  }
  throw new Error("Health check did not respond");
}

function cookieFrom(response) {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) throw new Error("Login did not return a session cookie");
  return setCookie.split(";")[0];
}

async function cleanupSmokeData(userId, institutionId) {
  if (!userId || !institutionId) return;
  const { pool } = await import("@workspace/db");
  await pool.query("delete from audit_events where actor_user_id = $1 or institution_id = $2", [userId, institutionId]);
  await pool.query("delete from app_sessions where user_id = $1", [userId]);
  await pool.query("delete from institutions where id = $1", [institutionId]);
  await pool.query("delete from users where id = $1", [userId]);
  await pool.end();
}

async function main() {
  const required = [
    "DATABASE_URL",
    "CAST_BOOTSTRAP_ADMIN_EMAIL",
    "CAST_BOOTSTRAP_ADMIN_NAME",
    "CAST_BOOTSTRAP_ADMIN_PASSWORD",
    "CAST_BOOTSTRAP_INSTITUTION_NAME",
    "CAST_BOOTSTRAP_INSTITUTION_SLUG",
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) throw new Error(`Missing required env vars: ${missing.join(", ")}`);

  const server = spawn(process.execPath, ["--enable-source-maps", "artifacts/api-server/dist/index.mjs"], {
    env: serverEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderr = "";
  let userId;
  let institutionId;
  server.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  try {
    const baseUrl = `http://127.0.0.1:${port}`;
    await waitForHealth(baseUrl);

    const login = await request(`${baseUrl}/api/cast-v3/auth/bootstrap-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: process.env.CAST_BOOTSTRAP_ADMIN_EMAIL,
        password: process.env.CAST_BOOTSTRAP_ADMIN_PASSWORD,
      }),
    });
    if (login.status !== 200) throw new Error(`Bootstrap login failed: ${login.status} ${login.text}`);

    const cookie = cookieFrom(login);
    const context = await request(`${baseUrl}/api/security/context`, { headers: { cookie } });
    if (context.status !== 200) throw new Error(`Security context failed: ${context.status} ${context.text}`);
    const contextJson = parseJson(context);
    userId = contextJson.userId;
    institutionId = contextJson.selectedInstitutionId;

    const runs = await request(`${baseUrl}/api/ingestion/runs`, { headers: { cookie } });
    if (runs.status !== 200) throw new Error(`Upload Curriculum runs check failed: ${runs.status} ${runs.text}`);

    const workspace = await request(`${baseUrl}/api/programme-workspace/programme-versions`, { headers: { cookie } });
    if (workspace.status !== 200) throw new Error(`Programme workspace check failed: ${workspace.status} ${workspace.text}`);

    const upload = await request(`${baseUrl}/api/ingestion/manual-module`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        moduleCode: `SMOKE-${Date.now()}`,
        moduleTitle: "Bootstrap Smoke Test Module",
        credits: 5,
        stage: "Stage 1",
        semester: "Semester 1",
        sections: [
          { sectionType: "aims", title: "Aims", content: "Validate CAST v3 bootstrap access." },
          { sectionType: "learning_outcomes", title: "Learning outcomes", content: "Confirm protected upload routes work." },
          { sectionType: "assessment", title: "Assessment", content: "Portfolio 100%." },
        ],
      }),
    });
    if (upload.status !== 201) throw new Error(`Manual module upload failed: ${upload.status} ${upload.text}`);
    const uploadJson = parseJson(upload);

    const frameworkHub = await request(`${baseUrl}/frameworks`);
    const moduleBuilder = await request(`${baseUrl}/module-builder`);
    const programmeMap = await request(`${baseUrl}/programme/map`);

    console.log(`BOOTSTRAP_LOGIN_STATUS=${login.status}`);
    console.log(`SECURITY_CONTEXT_STATUS=${context.status}`);
    console.log(`SECURITY_CONTEXT_HAS_USER=${Boolean(contextJson.userId)}`);
    console.log(`SECURITY_CONTEXT_HAS_INSTITUTION=${Boolean(contextJson.selectedInstitutionId)}`);
    console.log(`SECURITY_CONTEXT_ROLES=${(contextJson.roleKeys ?? []).join(",")}`);
    console.log(`UPLOAD_CURRICULUM_RUNS_STATUS=${runs.status}`);
    console.log(`PROGRAMME_WORKSPACE_STATUS=${workspace.status}`);
    console.log(`MANUAL_UPLOAD_STATUS=${upload.status}`);
    console.log(`MANUAL_UPLOAD_EVIDENCE_COUNT=${uploadJson.created?.evidenceItemIds?.length ?? 0}`);
    console.log(`FRAMEWORK_HUB_STATUS=${frameworkHub.status}`);
    console.log(`MODULE_BUILDER_STATUS=${moduleBuilder.status}`);
    console.log(`PROGRAMME_MAP_STATUS=${programmeMap.status}`);
  } finally {
    server.kill("SIGTERM");
    await cleanupSmokeData(userId, institutionId).catch((error) => {
      console.log(`CLEANUP_ERROR=${error instanceof Error ? error.message : String(error)}`);
    });
    if (stderr.trim()) {
      console.log("STDERR_BEGIN");
      console.log(stderr.trim());
      console.log("STDERR_END");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
