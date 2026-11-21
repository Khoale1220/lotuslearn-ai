import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import { z } from "zod";
import { PipelineError } from "../errors/pipelineErrors.js";
import {
  ClassSnapshotSchema,
  MisconceptionClusterSchema
} from "../schemas/analysisSchemas.js";

const DiagnosisCliResultSchema = z.object({
  classSnapshot: ClassSnapshotSchema,
  misconceptionClusters: z.array(MisconceptionClusterSchema),
  modelUsed: z.string().min(1),
  durationMs: z.number().nonnegative(),
  telemetry: z.record(z.string(), z.unknown())
});

const DIAGNOSIS_CLI_TIMEOUT_MS = 120_000;
const DIAGNOSIS_CLI_MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

function resolvePythonExecutable(repoRoot) {
  const explicit =
    process.env.LOTUSLEARN_PYTHON_EXECUTABLE?.trim() ||
    process.env.LOTUSLEARN_PYTHON_BIN?.trim() ||
    process.env.PYTHON?.trim();

  if (explicit) {
    return explicit;
  }

  const localPython =
    process.platform === "win32"
      ? join(repoRoot, ".venv", "Scripts", "python.exe")
      : join(repoRoot, ".venv", "bin", "python");

  if (existsSync(localPython)) {
    return localPython;
  }

  return process.platform === "win32" ? "python" : "python3";
}

function diagnosisBoundaryError(message, cause) {
  return new PipelineError({
    code: "INVARIANT_FAILURE",
    stage: "Stage 3: Gemini Diagnosis",
    message,
    retryable: false,
    cause
  });
}

async function runDiagnosisCli(request) {
  const repoRoot = process.cwd();
  const pythonExecutable = resolvePythonExecutable(repoRoot);
  const pipelineSource = join(repoRoot, "pipelines", "src");
  const pythonPath = process.env.PYTHONPATH
    ? `${pipelineSource}${delimiter}${process.env.PYTHONPATH}`
    : pipelineSource;

  return new Promise((resolve, reject) => {
    const child = spawn(
      pythonExecutable,
      ["-m", "lotuslearn_pipeline.diagnosis_cli"],
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
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      reject(error);
    };

    const timeout = setTimeout(() => {
      child.kill();

      rejectOnce(
        diagnosisBoundaryError(
          `Python Diagnosis CLI exceeded ${DIAGNOSIS_CLI_TIMEOUT_MS}ms.`
        )
      );
    }, DIAGNOSIS_CLI_TIMEOUT_MS);

    child.on("error", (error) => {
      rejectOnce(
        diagnosisBoundaryError(
          `Unable to start Python Diagnosis CLI using "${pythonExecutable}".`,
          error
        )
      );
    });

    child.stdout.on("data", (chunk) => {
      outputBytes += chunk.length;

      if (outputBytes > DIAGNOSIS_CLI_MAX_OUTPUT_BYTES) {
        child.kill();

        rejectOnce(
          diagnosisBoundaryError(
            "Python Diagnosis CLI exceeded the maximum output size."
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
      if (settled) {
        return;
      }

      clearTimeout(timeout);

      if (exitCode !== 0) {
        const detail = stderr.trim() || `exit code ${exitCode}`;

        rejectOnce(
          new Error(`Python Diagnosis CLI failed: ${detail}`)
        );

        return;
      }

      let decoded;

      try {
        decoded = JSON.parse(stdout);
      } catch (error) {
        rejectOnce(
          diagnosisBoundaryError(
            "Python Diagnosis CLI returned malformed JSON.",
            error
          )
        );

        return;
      }

      const parsed = DiagnosisCliResultSchema.safeParse(decoded);

      if (!parsed.success) {
        rejectOnce(
          diagnosisBoundaryError(
            `Python Diagnosis CLI contract validation failed: ${parsed.error.issues
              .map(
                (issue) =>
                  `${issue.path.join(".")}: ${issue.message}`
              )
              .join(", ")}`
          )
        );

        return;
      }

      if (
        request.providerResult &&
        parsed.data.modelUsed !== request.providerResult.modelUsed
      ) {
        rejectOnce(
          diagnosisBoundaryError(
            "Python Diagnosis CLI changed provider model identity."
          )
        );

        return;
      }

      settled = true;
      resolve(parsed.data);
    });

    child.stdin.on("error", (error) => {
      rejectOnce(
        diagnosisBoundaryError(
          "Unable to write Diagnosis request to Python CLI.",
          error
        )
      );
    });

    child.stdin.end(JSON.stringify(request));
  });
}

async function diagnoseClassPatterns(context, observations) {
  return runDiagnosisCli({
    context,
    observations
  });
}

export {
  diagnoseClassPatterns,
  runDiagnosisCli
};
