import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateReliabilitySuite } from '../server/services/reliabilityFixtureProducer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function exportReliabilityFixtures(): void {
  const targetDir = path.resolve(__dirname, '../pipelines/tests/fixtures');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const suite = generateReliabilitySuite();
  const targetFile = path.join(targetDir, 'reliability_events.json');

  fs.writeFileSync(targetFile, JSON.stringify(suite, null, 2), 'utf-8');
  console.log(`Successfully exported reliability fixture suite to ${targetFile}`);
  console.log(`- Standard batch: ${suite.standardBatch.length} events`);
  console.log(`- Replay pair: 2 events`);
  console.log(`- Payload conflict pair: 2 events`);
  console.log(`- Analysis run conflict pair: 2 events`);
}

exportReliabilityFixtures();
