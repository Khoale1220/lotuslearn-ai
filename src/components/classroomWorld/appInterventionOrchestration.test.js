import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const APP_PATH =
  new URL("../../App.jsx", import.meta.url);

const appSource =
  fs.readFileSync(APP_PATH, "utf8");

function getHandlerSource() {
  const match =
    appSource.match(
      /const\s+handleTeacherIntervention\s*=\s*\(input\)\s*=>\s*\{[\s\S]*?return intervention;\s*\};/
    );

  assert.ok(
    match,
    "handleTeacherIntervention must exist"
  );

  return match[0];
}

test(
  "CW06 A3.2 App intervention orchestration",
  async (t) => {
    await t.test(
      "imports command factory and materializer",
      () => {
        assert.match(
          appSource,
          /createTeacherInterventionCommand/
        );

        assert.match(
          appSource,
          /materializeTeacherIntervention/
        );

        assert.match(
          appSource,
          /teacherInterventionCommand\.js/
        );
      }
    );

    await t.test(
      "owns an in-memory intervention sink",
      () => {
        assert.match(
          appSource,
          /setLastTeacherIntervention/
        );

        assert.match(
          appSource,
          /const\s*\[\s*,\s*setLastTeacherIntervention\s*\]\s*=\s*useState\(null\)/
        );
      }
    );

    await t.test(
      "defines the locked App orchestrator",
      () => {
        assert.match(
          appSource,
          /const\s+handleTeacherIntervention\s*=\s*\(input\)\s*=>/
        );
      }
    );

    await t.test(
      "canonicalizes command before materialization",
      () => {
        const source =
          getHandlerSource();

        assert.match(
          source,
          /createTeacherInterventionCommand\(input\)/
        );

        assert.match(
          source,
          /materializeTeacherIntervention/
        );

        assert.match(
          source,
          /setLastTeacherIntervention\s*\(\s*intervention\s*\)/
        );
      }
    );

    await t.test(
      "App owns secure intervention-key generation",
      () => {
        const source =
          getHandlerSource();

        assert.match(
          source,
          /globalThis\.crypto\?\.randomUUID/
        );

        assert.match(
          source,
          /globalThis\.crypto\.randomUUID\(\)/
        );

        assert.match(
          source,
          /intervention-\$\{globalThis\.crypto\.randomUUID\(\)\}/
        );
      }
    );

    await t.test(
      "App owns canonical UTC clock generation",
      () => {
        const source =
          getHandlerSource();

        assert.match(
          source,
          /new Date\(\)\.toISOString\(\)/
        );
      }
    );

    await t.test(
      "wires callback to ClassroomWorld exactly once",
      () => {
        const matches =
          appSource.match(
            /onTeacherIntervention=\{handleTeacherIntervention\}/g
          ) ?? [];

        assert.equal(
          matches.length,
          1
        );
      }
    );

    await t.test(
      "orchestrator performs no network write",
      () => {
        const source =
          getHandlerSource();

        assert.doesNotMatch(
          source,
          /\bfetch\s*\(/
        );

        assert.doesNotMatch(
          source,
          /\baxios\b/
        );

        assert.doesNotMatch(
          source,
          /XMLHttpRequest/
        );
      }
    );

    await t.test(
      "orchestrator contains no raw student-data surface",
      () => {
        const source =
          getHandlerSource();

        for (
          const forbidden of [
            "rawSubmission",
            "rawSubmissions",
            "studentName",
            "email",
            "rawAnalysis"
          ]
        ) {
          assert.equal(
            source.includes(forbidden),
            false,
            `forbidden surface: ${forbidden}`
          );
        }
      }
    );
  }
);
