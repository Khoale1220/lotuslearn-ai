import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const trackedFiles = execFileSync(
  'git',
  ['ls-files', '-z'],
  { encoding: 'utf8' },
)
  .split('\0')
  .filter(Boolean);

const forbiddenSource = trackedFiles.filter((file) => {
  const normalized = file.replaceAll('\\', '/');
  const filename = normalized.split('/').at(-1) ?? '';

  return (
    normalized.endsWith('.ts') ||
    normalized.endsWith('.tsx') ||
    /^tsconfig.*\.json$/i.test(filename)
  );
});

const packageJson = JSON.parse(
  fs.readFileSync('package.json', 'utf8'),
);

const dependencies = {
  ...(packageJson.dependencies ?? {}),
  ...(packageJson.devDependencies ?? {}),
};

const forbiddenDependencies = Object.keys(
  dependencies,
).filter(
  (name) =>
    name === 'typescript' ||
    name === 'tsx' ||
    name.startsWith('@types/'),
);

const scripts = packageJson.scripts ?? {};

const forbiddenScripts = Object.entries(scripts)
  .filter(([name, command]) => {
    if (name === 'typecheck') {
      return true;
    }

    return (
      /\btsc\b/.test(command) ||
      /\btsx\b/.test(command)
    );
  })
  .map(([name]) => name);

let forbiddenLockPackages = [];

if (fs.existsSync('package-lock.json')) {
  const lock = JSON.parse(
    fs.readFileSync('package-lock.json', 'utf8'),
  );

  forbiddenLockPackages = Object.keys(
    lock.packages ?? {},
  ).filter(
    (path) =>
      path === 'node_modules/typescript' ||
      path === 'node_modules/tsx',
  );
}

const violations = [
  ...forbiddenSource.map(
    (value) => `tracked-source:${value}`,
  ),
  ...forbiddenDependencies.map(
    (value) => `direct-dependency:${value}`,
  ),
  ...forbiddenScripts.map(
    (value) => `package-script:${value}`,
  ),
  ...forbiddenLockPackages.map(
    (value) => `lockfile-package:${value}`,
  ),
];

console.log(
  `TRACKED_TYPESCRIPT_SOURCE_COUNT=${forbiddenSource.length}`,
);

console.log(
  `DIRECT_TYPESCRIPT_ECOSYSTEM_COUNT=${forbiddenDependencies.length}`,
);

console.log(
  `TS_TOOL_SCRIPT_COUNT=${forbiddenScripts.length}`,
);

console.log(
  `LOCKFILE_TS_COMPILER_RUNNER_COUNT=${forbiddenLockPackages.length}`,
);

if (violations.length > 0) {
  console.error('ZERO_TYPESCRIPT_REPOSITORY=FAIL');

  for (const violation of violations) {
    console.error(`VIOLATION=${violation}`);
  }

  process.exit(1);
}

console.log('ZERO_TYPESCRIPT_REPOSITORY=PASS');
