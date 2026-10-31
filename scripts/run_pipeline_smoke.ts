import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEMO_CONTEXT, DEMO_SUBMISSIONS } from '../src/data/demoClassroom';
import { generateGroundedDemoAnalysis } from '../server/services/demoFallbackGenerator';
import { produceAnalyticalEvents } from '../server/services/analyticalEventProducer';

function runPipelineSmoke(): void {
  const tmpDir = os.tmpdir();
  const tmpJsonPath = path.join(tmpDir, `lotuslearn_demo_events_${Date.now()}.json`);

  try {
    const demoResult = generateGroundedDemoAnalysis(DEMO_CONTEXT, DEMO_SUBMISSIONS);
    const events = produceAnalyticalEvents(demoResult);
    fs.writeFileSync(tmpJsonPath, JSON.stringify(events, null, 2), 'utf-8');

    // Default to in-memory database (:memory:)
    const pythonCmd = process.env.PYTHON || 'python';
    const result = spawnSync(
      pythonCmd,
      ['-m', 'lotuslearn_pipeline.cli', '--input', tmpJsonPath, '--db', ':memory:', '--metrics', '--exit-on-rejection'],
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
