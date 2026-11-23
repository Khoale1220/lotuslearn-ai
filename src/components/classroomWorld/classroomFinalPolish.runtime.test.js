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
  "CW06 final polish runtime ownership",
  async (t) => {
    await t.test(
      "final polish layers initialize after Student Visual V2",
      () => {
        const studentIndex =
          source.indexOf(
            "createStudentVisualV2({"
          );

        const exteriorIndex =
          source.indexOf(
            "createClassroomExteriorDepthV2({"
          );

        const feedbackIndex =
          source.indexOf(
            "createClassroomInteractionFeedbackV2({"
          );

        const performanceIndex =
          source.indexOf(
            "createClassroomPerformanceBudget({"
          );

        assert.ok(
          studentIndex >= 0
        );

        assert.ok(
          exteriorIndex >
          studentIndex
        );

        assert.ok(
          feedbackIndex >
          exteriorIndex
        );

        assert.ok(
          performanceIndex >
          feedbackIndex
        );
      }
    );

    await t.test(
      "visual updates remain outside locomotion authority",
      () => {
        const studentTick =
          source.indexOf(
            "classroomStudentVisualV2.tick();"
          );

        const exteriorUpdate =
          source.indexOf(
            "classroomExteriorDepthV2.update(camera);"
          );

        const performanceSample =
          source.indexOf(
            "classroomPerformanceBudget.sample();"
          );

        const locomotion =
          source.indexOf(
            "if (controls.isLocked) {"
          );

        assert.ok(
          studentTick >= 0
        );

        assert.ok(
          exteriorUpdate >
          studentTick
        );

        assert.ok(
          performanceSample >
          exteriorUpdate
        );

        assert.ok(
          locomotion >
          performanceSample
        );
      }
    );

    await t.test(
      "target feedback consumes the existing center ray",
      () => {
        const rayIndex =
          source.indexOf(
            "raycaster.setFromCamera(center, camera);"
          );

        const feedbackIndex =
          source.indexOf(
            "classroomInteractionFeedbackV2.update({"
          );

        assert.ok(
          rayIndex >= 0
        );

        assert.ok(
          feedbackIndex >
          rayIndex
        );
      }
    );

    await t.test(
      "final polish disposes before Student Visual V2",
      () => {
        const performanceDispose =
          source.indexOf(
            "classroomPerformanceBudget.dispose();"
          );

        const feedbackDispose =
          source.indexOf(
            "classroomInteractionFeedbackV2.dispose();"
          );

        const exteriorDispose =
          source.indexOf(
            "classroomExteriorDepthV2.dispose();"
          );

        const studentDispose =
          source.indexOf(
            "classroomStudentVisualV2.dispose();"
          );

        assert.ok(
          performanceDispose >= 0
        );

        assert.ok(
          feedbackDispose >
          performanceDispose
        );

        assert.ok(
          exteriorDispose >
          feedbackDispose
        );

        assert.ok(
          studentDispose >
          exteriorDispose
        );
      }
    );

    await t.test(
      "Locomotion V2 remains authoritative",
      () => {
        assert.match(
          source,
          /stepPlayerLocomotion\(\{/u
        );

        assert.match(
          source,
          /resolveVelocityAfterCollision\(\{/u
        );

        assert.doesNotMatch(
          source,
          /stepPlayerMovement\(\{/u
        );
      }
    );
  }
);