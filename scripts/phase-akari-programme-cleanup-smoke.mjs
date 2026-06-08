import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";

const requireFromDb = createRequire(new URL("../lib/db/package.json", import.meta.url));

const baseUrl = process.env.CAST_SMOKE_BASE_URL ?? "http://127.0.0.1:4197";
const workbookPath = process.env.AKARI_WORKBOOK_PATH;
const email = process.env.CAST_BOOTSTRAP_ADMIN_EMAIL;
const password = process.env.CAST_BOOTSTRAP_ADMIN_PASSWORD;

if (!workbookPath) throw new Error("AKARI_WORKBOOK_PATH is required");
if (!email || !password) throw new Error("CAST_BOOTSTRAP_ADMIN_EMAIL and CAST_BOOTSTRAP_ADMIN_PASSWORD are required");

let cookie = "";

async function frameworkSeedCounts() {
  if (!process.env.DATABASE_URL) return null;
  const { Client } = requireFromDb("pg");
  const databaseUrl = new URL(process.env.DATABASE_URL);
  const requestedSslMode = databaseUrl.searchParams.get("sslmode");
  databaseUrl.searchParams.delete("sslmode");
  const client = new Client({
    connectionString: databaseUrl.toString(),
    ssl: requestedSslMode ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  try {
    const result = await client.query(
      `select count(*)::int as frameworks
       from frameworks
       where key in ('greencomp', 'lifecomp', 'entrecomp', 'digcomp', 'assessment-design', 'modality-design')`,
    );
    return Number(result.rows[0]?.frameworks ?? 0);
  } finally {
    await client.end();
  }
}

async function request(route, options = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...(options.headers ?? {}),
    },
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${route} failed with ${response.status}: ${payload.message ?? payload.error ?? "unknown error"}`);
  }
  return payload;
}

async function main() {
  await request("/api/cast-v3/auth/bootstrap-login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  const frameworkSeedCountBefore = await frameworkSeedCounts();
  const beforeModules = await request("/api/curriculum/modules");
  const beforeProgrammes = await request("/api/programme-workspace/programme-versions");

  const buffer = fs.readFileSync(workbookPath);
  const upload = await request("/api/ingestion/akari", {
    method: "POST",
    body: JSON.stringify({
      fileName: path.basename(workbookPath),
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileBase64: buffer.toString("base64"),
    }),
  });

  const importBatchId = upload.created?.importBatchIds?.[0];
  if (!importBatchId) throw new Error("Akari upload did not return an import batch id");

  const afterModules = await request("/api/curriculum/modules");
  const afterProgrammes = await request("/api/programme-workspace/programme-versions");
  const cleanupBatches = await request("/api/cleanup/import-batches");

  const uploadedBatch = cleanupBatches.importBatches.find((batch) => batch.id === importBatchId);
  if (!uploadedBatch) throw new Error("Uploaded import batch is not visible in cleanup history");

  const generatedProgrammes = afterProgrammes.programmeVersions.length - beforeProgrammes.programmeVersions.length;
  const moduleDelta = afterModules.modules.length - beforeModules.modules.length;

  if (uploadedBatch.counts.modules < 1) throw new Error("Cleanup upload history did not report uploaded modules");
  if (afterProgrammes.programmeVersions.length < 1) throw new Error("Programme Workspace did not expose any generated programme versions");

  const cleanup = await request(`/api/cleanup/import-batches/${importBatchId}`, { method: "DELETE" });
  const finalModules = await request("/api/curriculum/modules");
  const finalBatches = await request("/api/cleanup/import-batches");
  const frameworkSeedCountAfter = await frameworkSeedCounts();
  const stillVisible = finalBatches.importBatches.some((batch) => batch.id === importBatchId);
  if (stillVisible) throw new Error("Deleted import batch is still visible in upload history");
  if (frameworkSeedCountBefore !== null && frameworkSeedCountAfter !== frameworkSeedCountBefore) {
    throw new Error("Framework seed count changed during upload cleanup");
  }

  console.log("AKARI_PROGRAMME_CLEANUP_SMOKE=passed");
  console.log(`IMPORT_BATCH_ID=${importBatchId}`);
  console.log(`UPLOAD_STATUS=${upload.status}`);
  console.log(`MODULE_DELTA=${moduleDelta}`);
  console.log(`DRAFT_PROGRAMMES_DELTA=${generatedProgrammes}`);
  console.log(`UPLOAD_HISTORY_MODULES=${uploadedBatch.counts.modules}`);
  console.log(`UPLOAD_HISTORY_PROGRAMMES=${uploadedBatch.counts.programmeVersions}`);
  console.log(`DELETE_MODULES=${cleanup.counts?.modules ?? 0}`);
  console.log(`FINAL_MODULE_COUNT=${finalModules.modules.length}`);
  if (frameworkSeedCountAfter !== null) console.log(`FRAMEWORK_SEEDS_REMAIN=${frameworkSeedCountAfter}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
