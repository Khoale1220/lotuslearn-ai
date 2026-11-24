import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PIPELINE_SOURCE_DIRECTORY =
  fileURLToPath(
    new URL(
      "../../pipelines/src/",
      import.meta.url,
    ),
  );

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_STDOUT_BYTES = 128 * 1024;
const MAX_STDERR_BYTES = 16 * 1024;

class TeacherInterventionBridgeError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);

    this.name = "TeacherInterventionBridgeError";
    this.code = code;
  }
}

function resolvePythonCommand(env) {
  if (
    typeof env.LOTUSLEARN_PYTHON_BIN === "string" &&
    env.LOTUSLEARN_PYTHON_BIN.trim()
  ) {
    return env.LOTUSLEARN_PYTHON_BIN.trim();
  }

  return process.platform === "win32"
    ? "python"
    : "python3";
}

function createChildEnvironment(env) {
  const existingPythonPath =
    typeof env.PYTHONPATH === "string"
      ? env.PYTHONPATH
      : "";

  return {
    ...env,
    PYTHONPATH: [
      PIPELINE_SOURCE_DIRECTORY,
      existingPythonPath,
    ]
      .filter(Boolean)
      .join(path.delimiter),
    PYTHONUNBUFFERED: "1",
    PYTHONDONTWRITEBYTECODE: "1",
  };
}

function decodeResponse(stdoutText) {
  const lines = stdoutText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new TeacherInterventionBridgeError(
      "PYTHON_BRIDGE_EMPTY_RESPONSE",
      "teacher intervention persistence returned no response",
    );
  }

  try {
    return JSON.parse(lines.at(-1));
  } catch {
    throw new TeacherInterventionBridgeError(
      "PYTHON_BRIDGE_INVALID_RESPONSE",
      "teacher intervention persistence returned invalid JSON",
    );
  }
}

function persistTeacherInterventionViaPython(
  intervention,
  {
    spawnImpl = spawn,
    env = process.env,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = {},
) {
  if (!env.LOTUSLEARN_DATABASE_URL) {
    return Promise.reject(
      new TeacherInterventionBridgeError(
        "PERSISTENCE_NOT_CONFIGURED",
        "teacher intervention persistence is unavailable",
      ),
    );
  }

  const pythonCommand =
    resolvePythonCommand(env);

  return new Promise((resolve, reject) => {
    let settled = false;
    let stdoutText = "";
    let stderrText = "";

    const finishReject = (error) => {
      if (settled) {
        return;
      }

      settled = true;
      reject(error);
    };

    const finishResolve = (value) => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(value);
    };

    let child;

    try {
      child = spawnImpl(
        pythonCommand,
        [
          "-m",
          "lotuslearn_pipeline.teacher_intervention_cli",
        ],
        {
          cwd: PIPELINE_SOURCE_DIRECTORY,
          env: createChildEnvironment(env),
          stdio: ["pipe", "pipe", "pipe"],
          windowsHide: true,
        },
      );
    } catch (error) {
      finishReject(
        new TeacherInterventionBridgeError(
          "PYTHON_BRIDGE_SPAWN_FAILED",
          "teacher intervention persistence process could not start",
          { cause: error },
        ),
      );

      return;
    }

    const timer = setTimeout(() => {
      child.kill();

      finishReject(
        new TeacherInterventionBridgeError(
          "PYTHON_BRIDGE_TIMEOUT",
          "teacher intervention persistence timed out",
        ),
      );
    }, timeoutMs);

    const clearTimer = () => {
      clearTimeout(timer);
    };

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk) => {
      stdoutText += chunk;

      if (
        Buffer.byteLength(stdoutText, "utf8") >
        MAX_STDOUT_BYTES
      ) {
        child.kill();
        clearTimer();

        finishReject(
          new TeacherInterventionBridgeError(
            "PYTHON_BRIDGE_OUTPUT_LIMIT",
            "teacher intervention response exceeded limit",
          ),
        );
      }
    });

    child.stderr.on("data", (chunk) => {
      stderrText += chunk;

      if (
        Buffer.byteLength(stderrText, "utf8") >
        MAX_STDERR_BYTES
      ) {
        child.kill();
        clearTimer();

        finishReject(
          new TeacherInterventionBridgeError(
            "PYTHON_BRIDGE_ERROR_LIMIT",
            "teacher intervention error output exceeded limit",
          ),
        );
      }
    });

    child.on("error", (error) => {
      clearTimer();

      finishReject(
        new TeacherInterventionBridgeError(
          "PYTHON_BRIDGE_SPAWN_FAILED",
          "teacher intervention persistence process failed",
          { cause: error },
        ),
      );
    });

    child.on("close", (exitCode) => {
      clearTimer();

      if (settled) {
        return;
      }

      let payload;

      try {
        payload = decodeResponse(stdoutText);
      } catch (error) {
        finishReject(error);
        return;
      }

      if (
        exitCode !== 0 ||
        payload?.ok !== true
      ) {
        finishReject(
          new TeacherInterventionBridgeError(
            payload?.error?.code ??
              "PYTHON_BRIDGE_FAILED",
            payload?.error?.message ??
              "teacher intervention persistence failed",
          ),
        );

        return;
      }

      finishResolve({
        created: payload.created === true,
        intervention: payload.intervention,
      });
    });

    child.stdin.on("error", (error) => {
      clearTimer();

      finishReject(
        new TeacherInterventionBridgeError(
          "PYTHON_BRIDGE_INPUT_FAILED",
          "teacher intervention persistence input failed",
          { cause: error },
        ),
      );
    });

    child.stdin.end(
      JSON.stringify(intervention),
    );
  });
}

export {
  TeacherInterventionBridgeError,
  persistTeacherInterventionViaPython,
};