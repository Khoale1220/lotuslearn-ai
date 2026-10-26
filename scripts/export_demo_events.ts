import fs from 'node:fs';
import path from 'node:path';
import { DEMO_CONTEXT, DEMO_SUBMISSIONS } from '../src/data/demoClassroom';
import { generateGroundedDemoAnalysis } from '../server/services/demoFallbackGenerator';
import { produceAnalyticalEvents } from '../server/services/analyticalEventProducer';

function main() {
  const demoResult = generateGroundedDemoAnalysis(DEMO_CONTEXT, DEMO_SUBMISSIONS);
  const events = produceAnalyticalEvents(demoResult);

  const outputPath = process.argv[2];
  const jsonStr = JSON.stringify(events, null, 2);

  if (outputPath) {
    fs.writeFileSync(path.resolve(outputPath), jsonStr, 'utf-8');
    console.log(`Exported ${events.length} analytical events to ${outputPath}`);
  } else {
    process.stdout.write(jsonStr);
  }
}

main();
