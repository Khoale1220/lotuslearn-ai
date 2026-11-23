import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const worldSource =
  fs.readFileSync(
    new URL(
      "./ClassroomWorld.jsx",
      import.meta.url
    ),
    "utf8"
  );

const observabilitySource =
  fs.readFileSync(
    new URL(
      "./classroomRuntimeObservabilityV7.js",
      import.meta.url
    ),
    "utf8"
  );

test(
  "CW06 Runtime Observability V7 runtime contract",
  async (t) => {
    await t.test(
      "is instantiated exactly once",
      () => {
        const matches =
          worldSource.match(
            /const classroomRuntimeObservabilityV7\s*=/gu
          ) ?? [];

        assert.equal(
          matches.length,
          1
        );
      }
    );

    await t.test(
      "samples after renderer.render",
      () => {
        const renderIndex =
          worldSource.indexOf(
            "renderer.render(scene, camera);"
          );

        const observeIndex =
          worldSource.indexOf(
            "classroomRuntimeObservabilityV7.observeFrame({"
          );

        assert.ok(
          renderIndex >= 0
        );

        assert.ok(
          observeIndex >
          renderIndex
        );
      }
    );

    await t.test(
      "uses renderer.info as read-only runtime evidence",
      () => {
        assert.match(
          observabilitySource,
          /renderer\?\.info/u
        );

        assert.match(
          observabilitySource,
          /render\.calls/u
        );

        assert.match(
          observabilitySource,
          /render\.triangles/u
        );

        assert.match(
          observabilitySource,
          /memory\.geometries/u
        );

        assert.match(
          observabilitySource,
          /memory\.textures/u
        );

        assert.doesNotMatch(
          observabilitySource,
          /info\.reset\(/u
        );
      }
    );

    await t.test(
      "audits scene transforms without mutation",
      () => {
        assert.match(
          observabilitySource,
          /scene\.traverse/u
        );

        assert.match(
          observabilitySource,
          /invalidTransformCount/u
        );

        assert.doesNotMatch(
          observabilitySource,
          /\.position\.set\(/u
        );
      }
    );

    await t.test(
      "uses bounded runtime evidence",
      () => {
        assert.match(
          observabilitySource,
          /sampleCapacity:\s*240/u
        );

        assert.match(
          observabilitySource,
          /samples\.splice/u
        );

        assert.match(
          observabilitySource,
          /maximumRecordedDeltaMs:\s*250/u
        );
      }
    );

    await t.test(
      "provides percentile evidence",
      () => {
        assert.match(
          observabilitySource,
          /p50Ms/u
        );

        assert.match(
          observabilitySource,
          /p95Ms/u
        );

        assert.match(
          observabilitySource,
          /p99Ms/u
        );

        assert.match(
          observabilitySource,
          /estimatedFps/u
        );
      }
    );

    await t.test(
      "disposes exactly once from ClassroomWorld",
      () => {
        const matches =
          worldSource.match(
            /classroomRuntimeObservabilityV7\.dispose\(\);/gu
          ) ?? [];

        assert.equal(
          matches.length,
          1
        );
      }
    );

    await t.test(
      "preserves V6 window shades",
      () => {
        assert.match(
          worldSource,
          /classroomFinalContentV6\.tick\(\{/u
        );

        assert.match(
          worldSource,
          /classroomFinalContentV6\.dispose\(\);/u
        );
      }
    );

    await t.test(
      "preserves teacher intervention authority",
      () => {
        assert.match(
          worldSource,
          /RETRO_TEACHER_INTERVENTION_UI_EVENT/u
        );

        assert.match(
          worldSource,
          /emitTeacherInterventionCommand/u
        );

        assert.match(
          worldSource,
          /probe_understanding/u
        );
      }
    );

    await t.test(
      "preserves Locomotion V2",
      () => {
        assert.match(
          worldSource,
          /createThreeCameraMovementInput/u
        );

        assert.match(
          worldSource,
          /stepPlayerLocomotion\(\{/u
        );

        assert.match(
          worldSource,
          /resolveVelocityAfterCollision\(\{/u
        );

        assert.doesNotMatch(
          worldSource,
          /stepPlayerMovement\(\{/u
        );
      }
    );
  }
);