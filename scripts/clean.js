import fs from 'node:fs';
import path from 'node:path';

const targets = ['dist', 'server.js', '.pytest_cache', 'pipelines/dist', 'pipelines/build', 'pipelines/*.egg-info'];

for (const target of targets) {
  try {
    const fullPath = path.resolve(process.cwd(), target);
    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    }
  } catch (err) {
    // Ignore if not found
  }
}
