import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source =
  fs.readFileSync(
    new URL(
      "./ClassroomWorld.jsx",
      import.meta.url
    ),
    "utf8"
  );

test(
  "CW06 Student Visual V2 runtime ownership",
  async (t) => {
    await t.test(
      "environment and student visual layers follow lighting",
      () => {
        const lightingIndex =
          source.indexOf(
            "createClassroomLightingV2({"
          );

        const environmentIndex =
          source.indexOf(
            "createEnvironmentDetailV2({"
          );

        const studentVisualIndex =
          source.indexOf(
            "createStudentVisualV2({"
          );

        assert.ok(
          lightingIndex >= 0
        );

        assert.ok(
          environmentIndex >
          lightingIndex
        );

        assert.ok(
          studentVisualIndex >
          environmentIndex
        );
      }
    );

    await t.test(
      "student visual synchronization is outside locomotion authority",
      () => {
        const deltaIndex =
          source.indexOf(
            "timer.getDelta();"
          );

        const visualTickIndex =
          source.indexOf(
            "classroomStudentVisualV2.tick();"
          );

        const locomotionIndex =
          source.indexOf(
            "if (controls.isLocked) {"
          );

        assert.ok(
          deltaIndex >= 0
        );

        assert.ok(
          visualTickIndex >
          deltaIndex
        );

        assert.ok(
          locomotionIndex >
          visualTickIndex
        );

        assert.match(
          source,
          /stepPlayerLocomotion\(\{/u
        );

        assert.doesNotMatch(
          source,
          /stepPlayerMovement\(\{/u
        );
      }
    );

    await t.test(
      "student and detail resources dispose before environment foundation",
      () => {
        const studentDispose =
          source.indexOf(
            "classroomStudentVisualV2.dispose();"
          );

        const environmentDispose =
          source.indexOf(
            "classroomEnvironmentDetailV2.dispose();"
          );

        const furnitureDispose =
          source.indexOf(
            "classroomFurnitureV2.dispose();"
          );

        const rendererDispose =
          source.indexOf(
            "renderer.dispose();"
          );

        assert.ok(
          studentDispose >= 0
        );

        assert.ok(
          environmentDispose >
          studentDispose
        );

        assert.ok(
          furnitureDispose >
          environmentDispose
        );

        assert.ok(
          rendererDispose >
          furnitureDispose
        );
      }
    );
  }
);