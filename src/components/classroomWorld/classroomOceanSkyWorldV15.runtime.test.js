import assert from "node:assert/strict";

import fs from "node:fs";

import {
  describe,
  it
} from "node:test";

const source =
  fs.readFileSync(
    new URL(
      "./ClassroomWorld.jsx",
      import.meta.url
    ),
    "utf8"
  );

describe(
  "CW06 ocean sky V15 runtime integration",
  () => {
    it(
      "constructs the visual world after camera creation",
      () => {
        const camera =
          source.indexOf(
            "scene.add(camera);"
          );

        const ocean =
          source.indexOf(
            "createClassroomOceanSkyWorldV15({"
          );

        assert.ok(
          camera >= 0
        );

        assert.ok(
          ocean > camera
        );
      }
    );

    it(
      "ticks ocean world before rendering",
      () => {
        const tick =
          source.indexOf(
            "classroomOceanSkyWorldV15.tick({"
          );

        const render =
          source.indexOf(
            "renderer.render(scene, camera);"
          );

        assert.ok(
          tick >= 0
        );

        assert.ok(
          render > tick
        );
      }
    );

    it(
      "owns an explicit teardown path",
      () => {
        assert.match(
          source,
          /classroomOceanSkyWorldV15\.dispose\(\);/u
        );
      }
    );

    it(
      "preserves canonical locomotion",
      () => {
        assert.match(
          source,
          /stepPlayerLocomotion\(\{/u
        );

        assert.match(
          source,
          /resolveVelocityAfterCollision\(\{/u
        );
      }
    );

    it(
      "preserves interaction and replay authorities",
      () => {
        assert.match(
          source,
          /classroomInteractionAuthorityV11/u
        );

        assert.match(
          source,
          /classroomInteractionReplayAuditV12/u
        );

        assert.match(
          source,
          /classroomInputStateTimelineV13/u
        );
      }
    );
  }
);