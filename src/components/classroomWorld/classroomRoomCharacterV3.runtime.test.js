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
  "CW06 Room Geometry V3 and Character V3 runtime ownership",
  async (t) => {
    await t.test(
      "V3 layers initialize after 64-bit visual upgrade",
      () => {
        const upgradeIndex =
          source.indexOf(
            "createClassroom64BitVisualUpgrade({"
          );

        const roomIndex =
          source.indexOf(
            "createClassroomRoomGeometryV3({"
          );

        const characterIndex =
          source.indexOf(
            "createClassroomCharacterV3({"
          );

        assert.ok(
          upgradeIndex >= 0
        );

        assert.ok(
          roomIndex >
          upgradeIndex
        );

        assert.ok(
          characterIndex >
          roomIndex
        );
      }
    );

    await t.test(
      "Character V3 follows Student Visual V2 synchronization",
      () => {
        const studentTick =
          source.indexOf(
            "classroomStudentVisualV2.tick();"
          );

        const characterTick =
          source.indexOf(
            "classroomCharacterV3.tick();"
          );

        const exteriorUpdate =
          source.indexOf(
            "classroomExteriorDepthV2.update(camera);"
          );

        assert.ok(
          studentTick >= 0
        );

        assert.ok(
          characterTick >
          studentTick
        );

        assert.ok(
          exteriorUpdate >
          characterTick
        );
      }
    );

    await t.test(
      "V3 visual layers dispose before 64-bit material owner",
      () => {
        const characterDispose =
          source.indexOf(
            "classroomCharacterV3.dispose();"
          );

        const roomDispose =
          source.indexOf(
            "classroomRoomGeometryV3.dispose();"
          );

        const upgradeDispose =
          source.indexOf(
            "classroom64BitVisualUpgrade.dispose();"
          );

        assert.ok(
          characterDispose >= 0
        );

        assert.ok(
          roomDispose >
          characterDispose
        );

        assert.ok(
          upgradeDispose >
          roomDispose
        );
      }
    );

    await t.test(
      "camera-axis fix and Locomotion V2 remain authoritative",
      () => {
        assert.match(
          source,
          /createThreeCameraMovementInput/u
        );

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