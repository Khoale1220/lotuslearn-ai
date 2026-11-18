import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEMO_CONTEXT, DEMO_SUBMISSIONS } from '../src/data/demoClassroom';
import { generateGroundedDemoAnalysis } from '../server/services/demoFallbackGenerator';
function runPipelineSmoke(): void {
  const tmpDir = os.tmpdir();
  const tmpJsonPath = path.join(tmpDir, `lotuslearn_demo_events_${Date.now()}.json`);

  try {
    const demoResult = generateGroundedDemoAnalysis(DEMO_CONTEXT, DEMO_SUBMISSIONS);
    const analysisJsonPath = `${tmpJsonPath}.analysis.json`;
    fs.writeFileSync(
      analysisJsonPath,
      JSON.stringify(demoResult, null, 2),
      'utf-8',
    );

    const producerPython =
      spawnSync('python3', ['--version']).status === 0 ? 'python3' : 'python';

    const producerEnv = {
      ...process.env,
      PYTHONPATH: [
        path.resolve(process.cwd(), 'pipelines/src'),
        process.env.PYTHONPATH ?? '',
      ]
        .filter(Boolean)
        .join(path.delimiter),
    };

    const producerResult = spawnSync(
      producerPython,
      [
        '-m',
        'lotuslearn_pipeline.event_export_cli',
        '--input',
        analysisJsonPath,
        '--output',
        tmpJsonPath,
      ],
      {
        stdio: 'inherit',
        env: producerEnv,
      },
    );

    if (producerResult.status !== 0) {
      throw new Error(
        `Python analytical-event export failed with status ${producerResult.status ?? 'unknown'}`,
      );
    }

    // Target database URL or default to in-memory database (:memory:)
    const pythonCmd =
      process.env.PYTHON ||
      (spawnSync('python3', ['--version']).status === 0 ? 'python3' : 'python');
    const dbTarget = process.env.LOTUSLEARN_DATABASE_URL || ':memory:';
    const result = spawnSync(
      pythonCmd,
      [
        '-m',
        'lotuslearn_pipeline.cli',
        '--input',
        tmpJsonPath,
        '--db',
        dbTarget,
        '--reconcile',
        '--metrics',
        '--exit-on-rejection',
      ],
      { stdio: 'inherit', env: { ...process.env } }
    );

    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  } finally {
    if (fs.existsSync(tmpJsonPath)) {
      try {
        fs.unlinkSync(tmpJsonPath);
      } catch {
        // Ignore cleanup error
      }
    }
  }
}

runPipelineSmoke();
