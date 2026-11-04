import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateReliabilitySuite } from '../server/services/reliabilityFixtureProducer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function verifyReliabilityFixtures(): void {
  const targetFile = path.resolve(__dirname, '../pipelines/tests/fixtures/reliability_events.json');
  if (!fs.existsSync(targetFile)) {
    console.error(`ERROR: Reliability fixture file does not exist at ${targetFile}`);
    process.exit(1);
  }

  const existingContent = fs.readFileSync(targetFile, 'utf-8').trim();
  const generatedSuite = generateReliabilitySuite();
  const generatedContent = JSON.stringify(generatedSuite, null, 2).trim();

  if (existingContent !== generatedContent) {
    console.error('ERROR: Reliability fixture drift detected! The committed fixtures do not match generated output.');
    process.exit(1);
  }

  console.log('PASS: Reliability fixtures verified. Zero drift detected between generator and committed JSON.');
}

verifyReliabilityFixtures();
