import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');

const contractPath = path.join(
  repoRoot,
  'contracts',
  'stage3-diagnosis-contract.v1.json',
);

const contract = JSON.parse(
  fs.readFileSync(contractPath, 'utf8'),
);

const readAuthority = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

test('Stage 3 contract v1 locks the existing cross-language envelope', () => {
  assert.equal(contract.contractVersion, 'stage3-diagnosis.v1');
  assert.equal(contract.stage.number, 3);
  assert.equal(contract.stage.ownershipTarget, 'python');

  assert.deepEqual(
    contract.request.fields,
    ['context', 'observations'],
  );

  assert.deepEqual(
    contract.request.required,
    ['context', 'observations'],
  );

  assert.deepEqual(
    contract.response.fields,
    [
      'classSnapshot',
      'misconceptionClusters',
      'modelUsed',
      'durationMs',
      'telemetry',
    ],
  );

  assert.deepEqual(
    contract.response.required,
    contract.response.fields,
  );
});

test('current coordinator matches the locked Stage 3 request contract', () => {
  const source = readAuthority(contract.authorities.coordinator);

  assert.match(
    source,
    /diagnoseClassPatterns\s*\(\s*context\s*,\s*observations\s*\)/,
  );
});

test('current diagnosis producer exposes every locked response field', () => {
  const source = readAuthority(contract.authorities.currentProducer);

  for (const field of contract.response.fields) {
    assert.match(
      source,
      new RegExp(`\\b${field}\\b`),
      `diagnosis producer must retain response field ${field}`,
    );
  }
});

test('contract preserves fail-closed and telemetry semantics', () => {
  assert.equal(contract.error.behavior, 'fail_closed');
  assert.equal(
    contract.error.preserveExistingPipelineClassification,
    true,
  );
  assert.equal(contract.error.invalidJsonIsFailure, true);
  assert.equal(contract.error.nonZeroProcessExitIsFailure, true);
  assert.equal(
    contract.error.missingRequiredResponseFieldIsFailure,
    true,
  );

  assert.equal(
    contract.telemetry.preserveExistingSemantics,
    true,
  );

  assert.deepEqual(
    contract.telemetry.responseFields,
    ['modelUsed', 'durationMs', 'telemetry'],
  );
});

test('MIG03 ownership boundary remains intentionally narrow', () => {
  assert.ok(
    contract.ownership.python.includes(
      'Stage 3 diagnosis business logic',
    ),
  );

  assert.ok(
    contract.ownership.javascript.includes(
      'pipeline orchestration',
    ),
  );

  assert.ok(
    contract.ownership.javascript.includes(
      'thin process adapter',
    ),
  );

  assert.ok(
    contract.invariants.includes(
      'No Stage 4, Stage 5, Stage 6 ownership migration in MIG03',
    ),
  );

  assert.ok(
    contract.invariants.includes(
      'No frontend ownership migration in MIG03',
    ),
  );

  assert.ok(
    contract.invariants.includes(
      'No database ownership migration in MIG03',
    ),
  );
});
