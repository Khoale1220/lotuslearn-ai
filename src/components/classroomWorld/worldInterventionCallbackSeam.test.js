import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const WORLD_PATH =
  new URL(
    "./ClassroomWorld.jsx",
    import.meta.url
  );

const APP_PATH =
  new URL(
    "../../App.jsx",
    import.meta.url
  );

const worldSource =
  fs.readFileSync(
    WORLD_PATH,
    "utf8"
  );

const appSource =
  fs.readFileSync(
    APP_PATH,
    "utf8"
  );

test(
  "CW06 A3.3 world intervention callback seam",
  async (t) => {
    await t.test(
      "accepts the locked callback prop",
      () => {
        assert.match(
          worldSource,
          /onTeacherIntervention\s*=\s*null/
        );
      }
    );

    await t.test(
      "defines exactly one internal command seam",
      () => {
        const matches =
          worldSource.match(
            /\bemitTeacherInterventionCommand\b/g
          ) ?? [];

        assert.equal(
          matches.length,
          1
        );
      }
    );

    await t.test(
      "remains inert when the callback is absent",
      () => {
        assert.match(
          worldSource,
          /typeof\s+onTeacherIntervention\s*!==\s*"function"/
        );

        assert.match(
          worldSource,
          /return null;/
        );
      }
    );

    await t.test(
      "permits only sanitized intent fields",
      () => {
        assert.match(
          worldSource,
          /"studentKey"/
        );

        assert.match(
          worldSource,
          /"actionType"/
        );

        assert.match(
          worldSource,
          /"analysisKey"/
        );

        assert.match(
          worldSource,
          /Unsupported world intervention intent field/
        );
      }
    );

    await t.test(
      "creates an immutable command envelope",
      () => {
        assert.match(
          worldSource,
          /Object\.freeze\s*\(\s*\{/
        );

        assert.match(
          worldSource,
          /onTeacherIntervention\s*\(\s*command\s*\)/
        );
      }
    );

    await t.test(
      "does not own command materialization",
      () => {
        assert.doesNotMatch(
          worldSource,
          /materializeTeacherIntervention/
        );

        assert.doesNotMatch(
          worldSource,
          /createTeacherInterventionCommand/
        );

        assert.doesNotMatch(
          worldSource,
          /teacherInterventionContract/
        );

        assert.doesNotMatch(
          worldSource,
          /teacherInterventionCommand\.js/
        );
      }
    );

    await t.test(
      "does not own identity or clock generation",
      () => {
        assert.doesNotMatch(
          worldSource,
          /randomUUID/
        );

        assert.doesNotMatch(
          worldSource,
          /Date\.now/
        );

        assert.doesNotMatch(
          worldSource,
          /new Date\s*\(/
        );
      }
    );

    await t.test(
      "does not perform network writes",
      () => {
        assert.doesNotMatch(
          worldSource,
          /\bfetch\s*\(/
        );

        assert.doesNotMatch(
          worldSource,
          /\baxios\b/
        );

        assert.doesNotMatch(
          worldSource,
          /XMLHttpRequest/
        );
      }
    );

    await t.test(
      "contains no forbidden raw student surface",
      () => {
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
            worldSource.includes(
              forbidden
            ),
            false,
            `forbidden world surface: ${forbidden}`
          );
        }
      }
    );

    await t.test(
      "is connected to the existing App orchestrator",
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
  }
);
