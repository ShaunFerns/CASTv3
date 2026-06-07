import { spawn } from "node:child_process";
import process from "node:process";

const port = process.env.PORT ?? "4191";
const serverEnv = {
  ...process.env,
  PORT: port,
  NODE_ENV: process.env.NODE_ENV ?? "production",
  DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://cast:cast@localhost:5432/cast",
  AI_INTEGRATIONS_OPENAI_BASE_URL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  AI_INTEGRATIONS_OPENAI_API_KEY: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "dummy-local-key",
  SESSION_SECRET: process.env.SESSION_SECRET ?? "local-render-smoke-secret-32-characters",
  ADMIN_USERNAME: process.env.ADMIN_USERNAME ?? "admin",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? "admin",
  CAST_V3_PREVIEW_BRIDGE: process.env.CAST_V3_PREVIEW_BRIDGE ?? "false",
};

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestText(url) {
  const response = await fetch(url);
  return {
    status: response.status,
    text: await response.text(),
  };
}

async function waitForHealth(baseUrl) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await wait(500);
    try {
      return await requestText(`${baseUrl}/api/healthz`);
    } catch {
      // Keep waiting until the server starts or the attempt budget is exhausted.
    }
  }

  throw new Error("Health check did not respond");
}

async function main() {
  const server = spawn(process.execPath, ["--enable-source-maps", "artifacts/api-server/dist/index.mjs"], {
    env: serverEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderr = "";
  server.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  try {
    const baseUrl = `http://127.0.0.1:${port}`;
    const health = await waitForHealth(baseUrl);
    const programmeMap = await requestText(`${baseUrl}/programme/map`);
    const frameworkHub = await requestText(`${baseUrl}/frameworks/greencomp`);

    console.log(`HEALTH_STATUS=${health.status}`);
    console.log(`MAP_STATUS=${programmeMap.status}`);
    console.log(`MAP_HAS_ROOT=${programmeMap.text.includes('id="root"')}`);
    console.log(`FRAMEWORK_HUB_STATUS=${frameworkHub.status}`);
    console.log(`FRAMEWORK_HUB_HAS_ROOT=${frameworkHub.text.includes('id="root"')}`);

    if (
      health.status !== 200 ||
      programmeMap.status !== 200 ||
      frameworkHub.status !== 200 ||
      !programmeMap.text.includes('id="root"') ||
      !frameworkHub.text.includes('id="root"')
    ) {
      throw new Error("Render smoke test failed");
    }
  } finally {
    server.kill("SIGTERM");
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
