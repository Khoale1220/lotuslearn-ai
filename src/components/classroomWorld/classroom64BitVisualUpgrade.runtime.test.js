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

const upgradeSource =
  fs.readFileSync(
    new URL(
      "./classroom64BitVisualUpgrade.js",
      import.meta.url
    ),
    "utf8"
  );

test(
  "CW06 64-bit visual runtime contract",
  async (t) => {
    await t.test(
      "upgrade initializes after the previous final-polish systems",
      () => {
        const performance =
          worldSource.indexOf(
            "createClassroomPerformanceBudget({"
          );

        const upgrade =
          worldSource.indexOf(
            "createClassroom64BitVisualUpgrade({"
          );

        assert.ok(
          performance >= 0
        );

        assert.ok(
          upgrade >
          performance
        );
      }
    );

    await t.test(
      "upgrade disposes before previous environment owners",
      () => {
        const upgradeDispose =
          worldSource.indexOf(
            "classroom64BitVisualUpgrade.dispose();"
          );

        const performanceDispose =
          worldSource.indexOf(
            "classroomPerformanceBudget.dispose();"
          );

        assert.ok(
          upgradeDispose >= 0
        );

        assert.ok(
          performanceDispose >
          upgradeDispose
        );
      }
    );

    await t.test(
      "uses high-quality sRGB texture sampling",
      () => {
        assert.match(
          upgradeSource,
          /THREE\.SRGBColorSpace/u
        );

        assert.match(
          upgradeSource,
          /THREE\.LinearMipmapLinearFilter/u
        );

        assert.match(
          upgradeSource,
          /anisotropy/u
        );
      }
    );

    await t.test(
      "uses physical glass only as a bounded accent",
      () => {
        assert.match(
          upgradeSource,
          /new THREE\.MeshPhysicalMaterial/u
        );

        assert.match(
          upgradeSource,
          /window-\(north\|center\|south\)-glass/u
        );
      }
    );

    await t.test(
      "uses soft shadow upgrade and textured floor",
      () => {
        assert.match(
          upgradeSource,
          /THREE\.PCFSoftShadowMap/u
        );

        assert.match(
          upgradeSource,
          /classroom-64bit-floor/u
        );
      }
    );

    await t.test(
      "Locomotion V2 remains authoritative",
      () => {
        assert.match(
          worldSource,
          /stepPlayerLocomotion\(\{/u
        );

        assert.doesNotMatch(
          worldSource,
          /stepPlayerMovement\(\{/u
        );
      }
    );
  }
);