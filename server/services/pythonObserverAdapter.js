import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import { z } from "zod";
import { PipelineError } from "../errors/pipelineErrors";
import {
  NormalizedSourceEvidenceSchema,
  StudentObservationListSchema
} from "../schemas/analysisSchemas";
const ObserverCliResultSchema = z.object({
  observations: StudentObservationListSchema,
  normalizedEvidence: z.array(NormalizedSourceEvidenceSchema),
  modelUsed: z.string().min(1),
  durationMs: z.number().nonnegative(),
  telemetry: z.unknown().optional()
});
const OBSERVER_CLI_TIMEOUT_MS = 15e3;
const OBSERVER_CLI_MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
function resolvePythonExecutable(repoRoot) {
  const explicit = process.env.LOTUSLEARN_PYTHON_BIN || process.env.PYTHON;
  if (explicit) {
    return explicit;
  }
  const localPython = process.platform === "win32" ? join(repoRoot, ".venv", "Scripts", "python.exe") : join(repoRoot, ".venv", "bin", "python");
  if (existsSync(localPython)) {
    return localPython;
  }
  return process.platform === "win32" ? "python" : "python3";
}
function observerBoundaryError(code, message, cause) {
  return new PipelineError({
    code,
    stage: "Stage 2: Gemini Observer",
    message,
    retryable: false,
    cause
  });
}
async function runObserverCli(request) {
  const repoRoot = process.cwd();
  const pythonExecutable = resolvePythonExecutable(repoRoot);
  const pipelineSource = join(repoRoot, "pipelines", "src");
  const pythonPath = process.env.PYTHONPATH ? `${pipelineSource}${delimiter}${process.env.PYTHONPATH}` : pipelineSource;
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.env.LOTUSLEARN_PYTHON_EXECUTABLE?.trim() || pythonExecutable,
      ["-m", "lotuslearn_pipeline.observer_cli"],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          PYTHONPATH: pythonPath
        },
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true
      }
    );
    let stdout = "";
    let stderr = "";
    let outputBytes = 0;
    let settled = false;
    const rejectOnce = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    };
    const timeout = setTimeout(() => {
      child.kill();
      rejectOnce(
        observerBoundaryError(
          "INVARIANT_FAILURE",
          `Python Observer CLI exceeded ${OBSERVER_CLI_TIMEOUT_MS}ms.`
        )
      );
    }, OBSERVER_CLI_TIMEOUT_MS);
    child.on("error", (error) => {
      rejectOnce(
        observerBoundaryError(
          "INVARIANT_FAILURE",
          `Unable to start Python Observer CLI using "${pythonExecutable}".`,
          error
        )
      );
    });
    child.stdout.on("data", (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > OBSERVER_CLI_MAX_OUTPUT_BYTES) {
        child.kill();
        rejectOnce(
          observerBoundaryError(
            "INVARIANT_FAILURE",
            "Python Observer CLI exceeded the maximum output size."
          )
        );
        return;
      }
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("close", (exitCode) => {
      if (settled) return;
      clearTimeout(timeout);
      if (exitCode !== 0) {
        const detail = stderr.trim() || `exit code ${exitCode}`;
        rejectOnce(
          observerBoundaryError(
            exitCode === null ? "INVARIANT_FAILURE" : "OBSERVER_SCHEMA_ERROR",
            `Python Observer CLI failed: ${detail}`
          )
        );
        return;
      }
      let decoded;
      try {
        decoded = JSON.parse(stdout);
      } catch (error) {
        rejectOnce(
          observerBoundaryError(
            "OBSERVER_SCHEMA_ERROR",
            "Python Observer CLI returned malformed JSON.",
            error
          )
        );
        return;
      }
      const parsed = ObserverCliResultSchema.safeParse(decoded);
      if (!parsed.success) {
        rejectOnce(
          observerBoundaryError(
            "OBSERVER_SCHEMA_ERROR",
            `Python Observer CLI contract validation failed: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ")}`
          )
        );
        return;
      }
      if (request.providerResult && parsed.data.modelUsed !== request.providerResult.modelUsed) {
        rejectOnce(
          observerBoundaryError(
            "OBSERVER_SCHEMA_ERROR",
            "Python Observer CLI changed provider model identity."
          )
        );
        return;
      }
      settled = true;
      resolve({
        observations: parsed.data.observations,
        normalizedEvidence: parsed.data.normalizedEvidence,
        modelUsed: parsed.data.modelUsed,
        durationMs: parsed.data.durationMs,
        telemetry: parsed.data.telemetry
      });
    });
    child.stdin.on("error", (error) => {
      rejectOnce(
        observerBoundaryError(
          "INVARIANT_FAILURE",
          "Unable to write Observer request to Python CLI.",
          error
        )
      );
    });
    child.stdin.end(JSON.stringify(request));
  });
}
async function observeSubmissions(context, submissions) {
  return runObserverCli({
    context,
    submissions
  });
}
export {
  observeSubmissions,
  runObserverCli
};
