import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { z } from 'zod';

import type {
  LearningContext,
  NormalizedSourceEvidence,
  StudentObservation,
  StudentSubmission,
} from '../../src/types';
import type {
  GenerationResult,
  StageModelTelemetry,
} from '../geminiClient';
import { PipelineError } from '../errors/pipelineErrors';
import {
  NormalizedSourceEvidenceSchema,
  StudentObservationListSchema,
} from '../schemas/analysisSchemas';
import { generateObserverProviderResult } from './observerProvider';

export interface ObserverResult {
  observations: StudentObservation[];
  normalizedEvidence: NormalizedSourceEvidence[];
  modelUsed: string;
  durationMs: number;
  telemetry?: StageModelTelemetry;
}

interface ObserverCliRequest {
  context: LearningContext;
  submissions: StudentSubmission[];
  providerResult: GenerationResult;
}

const ObserverCliResultSchema = z.object({
  observations: StudentObservationListSchema,
  normalizedEvidence: z.array(NormalizedSourceEvidenceSchema),
  modelUsed: z.string().min(1),
  durationMs: z.number().nonnegative(),
  telemetry: z.unknown().optional(),
});

const OBSERVER_CLI_TIMEOUT_MS = 15_000;
const OBSERVER_CLI_MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

function resolvePythonExecutable(repoRoot: string): string {
  const explicit =
    process.env.LOTUSLEARN_PYTHON_BIN ||
    process.env.PYTHON;

  if (explicit) {
    return explicit;
  }

  const localPython =
    process.platform === 'win32'
      ? join(repoRoot, '.venv', 'Scripts', 'python.exe')
      : join(repoRoot, '.venv', 'bin', 'python');

  if (existsSync(localPython)) {
    return localPython;
  }

  return process.platform === 'win32'
    ? 'python'
    : 'python3';
}

function observerBoundaryError(
  code: 'OBSERVER_SCHEMA_ERROR' | 'INVARIANT_FAILURE',
  message: string,
  cause?: unknown
): PipelineError {
  return new PipelineError({
    code,
    stage: 'Stage 2: Gemini Observer',
    message,
    retryable: false,
    cause,
  });
}

export async function runObserverCli(
  request: ObserverCliRequest
): Promise<ObserverResult> {
  const repoRoot = process.cwd();
  const pythonExecutable = resolvePythonExecutable(repoRoot);
  const pipelineSource = join(repoRoot, 'pipelines', 'src');

  const pythonPath = process.env.PYTHONPATH
    ? `${pipelineSource}${delimiter}${process.env.PYTHONPATH}`
    : pipelineSource;

  return new Promise<ObserverResult>((resolve, reject) => {
    const child = spawn(
      pythonExecutable,
      ['-m', 'lotuslearn_pipeline.observer_cli'],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          PYTHONPATH: pythonPath,
        },
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      }
    );

    let stdout = '';
    let stderr = '';
    let outputBytes = 0;
    let settled = false;

    const rejectOnce = (error: PipelineError) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    };

    const timeout = setTimeout(() => {
      child.kill();

      rejectOnce(
        observerBoundaryError(
          'INVARIANT_FAILURE',
          `Python Observer CLI exceeded ${OBSERVER_CLI_TIMEOUT_MS}ms.`
        )
      );
    }, OBSERVER_CLI_TIMEOUT_MS);

    child.on('error', (error) => {
      rejectOnce(
        observerBoundaryError(
          'INVARIANT_FAILURE',
          `Unable to start Python Observer CLI using "${pythonExecutable}".`,
          error
        )
      );
    });

    child.stdout.on('data', (chunk: Buffer) => {
      outputBytes += chunk.length;

      if (outputBytes > OBSERVER_CLI_MAX_OUTPUT_BYTES) {
        child.kill();

        rejectOnce(
          observerBoundaryError(
            'INVARIANT_FAILURE',
            'Python Observer CLI exceeded the maximum output size.'
          )
        );

        return;
      }

      stdout += chunk.toString('utf8');
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('close', (exitCode) => {
      if (settled) return;

      clearTimeout(timeout);

      if (exitCode !== 0) {
        const detail = stderr.trim() || `exit code ${exitCode}`;

        rejectOnce(
          observerBoundaryError(
            exitCode === 2
              ? 'OBSERVER_SCHEMA_ERROR'
              : 'INVARIANT_FAILURE',
            `Python Observer CLI failed: ${detail}`
          )
        );

        return;
      }

      let decoded: unknown;

      try {
        decoded = JSON.parse(stdout);
      } catch (error) {
        rejectOnce(
          observerBoundaryError(
            'OBSERVER_SCHEMA_ERROR',
            'Python Observer CLI returned malformed JSON.',
            error
          )
        );

        return;
      }

      const parsed = ObserverCliResultSchema.safeParse(decoded);

      if (!parsed.success) {
        rejectOnce(
          observerBoundaryError(
            'OBSERVER_SCHEMA_ERROR',
            `Python Observer CLI contract validation failed: ${parsed.error.issues
              .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
              .join(', ')}`
          )
        );

        return;
      }

      if (parsed.data.modelUsed !== request.providerResult.modelUsed) {
        rejectOnce(
          observerBoundaryError(
            'OBSERVER_SCHEMA_ERROR',
            'Python Observer CLI changed provider model identity.'
          )
        );

        return;
      }

      settled = true;

      resolve({
        observations:
          parsed.data.observations as StudentObservation[],
        normalizedEvidence:
          parsed.data.normalizedEvidence as NormalizedSourceEvidence[],
        modelUsed: parsed.data.modelUsed,
        durationMs: parsed.data.durationMs,
        telemetry:
          parsed.data.telemetry as StageModelTelemetry | undefined,
      });
    });

    child.stdin.on('error', (error) => {
      rejectOnce(
        observerBoundaryError(
          'INVARIANT_FAILURE',
          'Unable to write Observer request to Python CLI.',
          error
        )
      );
    });

    child.stdin.end(JSON.stringify(request));
  });
}

export async function observeSubmissions(
  context: LearningContext,
  submissions: StudentSubmission[]
): Promise<ObserverResult> {
  const providerResult =
    await generateObserverProviderResult(
      context,
      submissions
    );

  return runObserverCli({
    context,
    submissions,
    providerResult,
  });
}
