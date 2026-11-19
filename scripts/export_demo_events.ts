import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEMO_CONTEXT, DEMO_SUBMISSIONS } from '../src/data/demoClassroom';
import { generateGroundedDemoAnalysis } from '../server/services/demoFallbackGenerator';

function resolvePythonCommand(): string {
  if (process.env.PYTHON) {
    return process.env.PYTHON;
  }

  if (spawnSync('python3', ['--version']).status === 0) {
    return 'python3';
  }

  return 'python';
}

function buildPythonEnvironment(): NodeJS.ProcessEnv {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDir, '..');
  const pipelineSource = path.join(repoRoot, 'pipelines', 'src');

  const pythonPath = [
    pipelineSource,
    process.env.PYTHONPATH,
  ]
    .filter(Boolean)
    .join(path.delimiter);

  return {
    ...process.env,
    PYTHONPATH: pythonPath,
  };
}

function main(): void {
  const demoResult = generateGroundedDemoAnalysis(
    DEMO_CONTEXT,
    DEMO_SUBMISSIONS
  );

  const outputPath = process.argv[2] ?? '-';

  const result = spawnSync(
    resolvePythonCommand(),
    [
      '-m',
      'lotuslearn_pipeline.event_export_cli',
      '--input',
      '-',
      '--output',
      outputPath,
    ],
    {
      input: JSON.stringify(demoResult),
      stdio: ['pipe', 'inherit', 'inherit'],
      env: buildPythonEnvironment(),
    }
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

main();
