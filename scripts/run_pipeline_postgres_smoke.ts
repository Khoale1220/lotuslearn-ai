import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEMO_CONTEXT, DEMO_SUBMISSIONS } from '../src/data/demoClassroom';
import { generateGroundedDemoAnalysis } from '../server/services/demoFallbackGenerator';
import { produceAnalyticalEvents } from '../server/services/analyticalEventProducer';

function runPostgresPipelineSmoke(): void {
  const tmpDir = os.tmpdir();
  const tmpJsonPath = path.join(tmpDir, `lotuslearn_pg_events_${Date.now()}.json`);

  const pgUrl =
    process.env.LOTUSLEARN_DATABASE_URL ||
    'postgresql://postgres@localhost/lotuslearn_test?host=/tmp';

  try {
    const demoResult = generateGroundedDemoAnalysis(DEMO_CONTEXT, DEMO_SUBMISSIONS);
    const events = produceAnalyticalEvents(demoResult);
    fs.writeFileSync(tmpJsonPath, JSON.stringify(events, null, 2), 'utf-8');

    const pythonCmd = process.env.PYTHON || 'python3';
    console.log(`Running PostgreSQL analytical pipeline smoke test against: ${pgUrl.split('@')[0]}...`);

    const result = spawnSync(
      pythonCmd,
      ['-m', 'lotuslearn_pipeline.cli', '--input', tmpJsonPath, '--db', pgUrl, '--metrics', '--exit-on-rejection'],
      { stdio: 'inherit', env: { ...process.env, LOTUSLEARN_DATABASE_URL: pgUrl } }
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

runPostgresPipelineSmoke();
