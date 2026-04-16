import "dotenv/config";

import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const drizzleDir = path.resolve(__dirname, "../drizzle");
const journalPath = path.join(drizzleDir, "meta", "_journal.json");

function resolveDrizzleKitCommand() {
  const unixPath = path.resolve(__dirname, "../node_modules/.bin/drizzle-kit");
  const windowsPath = `${unixPath}.cmd`;
  const resolved = process.platform === "win32" ? windowsPath : unixPath;

  if (!fs.existsSync(resolved)) {
    console.error(
      "Missing local drizzle-kit binary. Install dev dependencies (for Render use: npm ci --include=dev).",
    );
    process.exit(1);
  }

  return resolved;
}

async function hasUserTables(databaseUrl) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const query = `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
      ) AS has_tables;
    `;

    const result = await client.query(query);
    return Boolean(result.rows[0]?.has_tables);
  } finally {
    await client.end();
  }
}

function readLatestMigrationMetadata() {
  if (!fs.existsSync(journalPath)) {
    throw new Error(`Missing migration journal: ${journalPath}`);
  }

  const journalRaw = fs.readFileSync(journalPath, "utf8");
  const journal = JSON.parse(journalRaw);
  const entries = Array.isArray(journal.entries) ? journal.entries : [];

  if (entries.length === 0) {
    return null;
  }

  const latest = entries[entries.length - 1];
  const tag = latest?.tag;
  const when = latest?.when;

  if (typeof tag !== "string" || tag.length === 0 || typeof when !== "number") {
    throw new Error("Invalid latest migration entry in drizzle meta journal");
  }

  const sqlPath = path.join(drizzleDir, `${tag}.sql`);

  if (!fs.existsSync(sqlPath)) {
    throw new Error(`Missing migration SQL file: ${sqlPath}`);
  }

  const sql = fs.readFileSync(sqlPath, "utf8");
  const hash = crypto.createHash("sha256").update(sql).digest("hex");

  return {
    tag,
    when,
    hash,
  };
}

async function baselineLatestMigration(databaseUrl) {
  const latest = readLatestMigrationMetadata();

  if (!latest) {
    return;
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query("CREATE SCHEMA IF NOT EXISTS drizzle");
    await client.query(`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `);

    const lastApplied = await client.query(
      "SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1",
    );

    if (lastApplied.rows.length > 0) {
      return;
    }

    await client.query(
      "INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)",
      [latest.hash, latest.when],
    );

    console.log(
      `Stored migration baseline at ${latest.tag}; future deployments can run drizzle migrate safely.`,
    );
  } finally {
    await client.end();
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("DATABASE_URL is required for first-deploy schema sync");
    process.exit(1);
  }

  const nonEmptySchema = await hasUserTables(databaseUrl);

  if (nonEmptySchema) {
    console.log("Detected existing tables in public schema; skipping forced db push.");
    process.exit(0);
  }

  console.log("Public schema is empty; running drizzle-kit push --force for first deployment.");

  const command = resolveDrizzleKitCommand();
  const result = spawnSync(command, ["push", "--force"], {
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }

  await baselineLatestMigration(databaseUrl);

  process.exit(result.status ?? 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});