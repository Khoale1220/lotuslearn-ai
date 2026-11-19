import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert';
import { test } from 'node:test';

import { PipelineError } from '../errors/pipelineErrors';
import { runObserverCli } from './pythonObserverAdapter';

const fixturePath = resolve(
  process.cwd(),
  'pipelines',
  'tests',
  'fixtures',
  'observer_service_parity.json'
);

const fixture = JSON.parse(
  readFileSync(fixturePath, 'utf8')
);

test('Python Observer adapter preserves the golden cross-language contract', async () => {
  const testCase = fixture.cases[0];

  const result = await runObserverCli({
    context: testCase.input.context,
    submissions: testCase.input.submissions,
    providerResult: testCase.provider_result,
  });

  assert.deepStrictEqual(
    result,
    testCase.expected
  );
});

test('Python Observer adapter fails closed on malformed provider output', async () => {
  const testCase = fixture.cases[0];

  await assert.rejects(
    () =>
      runObserverCli({
        context: testCase.input.context,
        submissions: testCase.input.submissions,
        providerResult: {
          text: 'not-json',
          modelUsed: 'gemini-test',
          durationMs: 1,
          telemetry: testCase.provider_result.telemetry,
        },
      }),
    (error: unknown) => {
      assert.ok(error instanceof PipelineError);
      assert.strictEqual(
        error.code,
        'OBSERVER_SCHEMA_ERROR'
      );

      return true;
    }
  );
});
