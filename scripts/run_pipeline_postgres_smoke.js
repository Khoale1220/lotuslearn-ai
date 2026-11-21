import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DEMO_CONTEXT, DEMO_SUBMISSIONS } from "../src/data/demoClassroom.js";
import { generateGroundedDemoAnalysis } from "../server/services/demoFallbackGenerator.js";
function runPostgresPipelineSmoke() {
  const tmpDir = os.tmpdir();
  const tmpJsonPath = path.join(tmpDir, `lotuslearn_pg_events_${Date.now()}.json`);
  const pgUrl = process.env.LOTUSLEARN_DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/lotuslearn_test";
  try {
    const demoResult = generateGroundedDemoAnalysis(DEMO_CONTEXT, DEMO_SUBMISSIONS);
    const producerPythonCommand = spawnSync("python3", ["--version"]).status === 0 ? "python3" : "python";
    const producerEnv = {
      ...process.env,
      PYTHONPATH: [
        path.resolve(process.cwd(), "pipelines/src"),
        process.env.PYTHONPATH ?? ""
      ].filter(Boolean).join(path.delimiter)
    };
    const producerResult = spawnSync(
      producerPythonCommand,
      [
        "-m",
        "lotuslearn_pipeline.event_export_cli",
        "--input",
        "-",
        "--output",
        tmpJsonPath
      ],
      {
        input: JSON.stringify(demoResult),
        encoding: "utf-8",
        stdio: ["pipe", "inherit", "inherit"],
        env: producerEnv
      }
    );
    if (producerResult.status !== 0) {
      throw new Error(
        `Python analytical-event export failed with status ${producerResult.status ?? "unknown"}`
      );
    }
    const pythonCmd = process.env.PYTHON || (spawnSync("python3", ["--version"]).status === 0 ? "python3" : "python");
    console.log(`Running PostgreSQL analytical pipeline smoke test against: ${pgUrl.split("@")[0]}...`);
    const result = spawnSync(
      pythonCmd,
      [
        "-m",
        "lotuslearn_pipeline.cli",
        "--input",
        tmpJsonPath,
        "--db",
        pgUrl,
        "--reconcile",
        "--metrics",
        "--exit-on-rejection"
      ],
      { stdio: "inherit", env: { ...process.env, LOTUSLEARN_DATABASE_URL: pgUrl } }
    );
    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  } finally {
    if (fs.existsSync(tmpJsonPath)) {
      try {
        fs.unlinkSync(tmpJsonPath);
      } catch {
      }
    }
  }
}
runPostgresPipelineSmoke();
