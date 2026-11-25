import assert from "node:assert/strict";

import {
  readFileSync
} from "node:fs";

import path from "node:path";

import test from "node:test";

import * as THREE from "three";

import {
  fileURLToPath
} from "node:url";

import {
  CLASSROOM_PIXEL_MATERIAL_DEPTH_V28_PROFILE,
  createClassroomPixelMaterialDepthV28,
  createSeatDepthBlueprintsV28,
  createWindowDepthBlueprintsV28
} from "./classroomPixelMaterialDepthV28.js";

const DIRECTORY =
  path.dirname(
    fileURLToPath(
      import.meta.url
    )
  );

function readSource(name) {
  return readFileSync(
    path.join(
      DIRECTORY,
      name
    ),
    "utf8"
  );
}

test(
  "V28 profile locks a six-draw-call static depth layer",
  () => {
    const profile =
      CLASSROOM_PIXEL_MATERIAL_DEPTH_V28_PROFILE;

    assert.equal(
      profile.seatDepthCueCount,
      12
    );

    assert.equal(
      profile.windowLightPoolCount,
      3
    );

    assert.equal(
      profile.boardAccentCount,
      2
    );

    assert.equal(
      profile.staticVisualDrawCalls,
      6
    );

    assert.equal(
      profile.runtimeSceneTraversal,
      false
    );

    assert.equal(
      profile.runtimeAnimation,
      false
    );

    assert.equal(
      profile.visualOnly,
      true
    );
  }
);

test(
  "V28 seat depth blueprints are deterministic",
  () => {
    const first =
      createSeatDepthBlueprintsV28(
        12
      );

    const second =
      createSeatDepthBlueprintsV28(
        12
      );

    assert.deepEqual(
      first,
      second
    );

    assert.equal(
      first.length,
      12
    );

    for (
      const entry
      of first
    ) {
      assert.ok(
        Number.isFinite(
          entry.contact.x
        )
      );

      assert.ok(
        Number.isFinite(
          entry.contact.z
        )
      );

      assert.ok(
        Number.isFinite(
          entry.warmEdge.y
        )
      );

      assert.ok(
        Number.isFinite(
          entry.coolEdge.x
        )
      );
    }
  }
);

test(
  "V28 derives three light pools from canonical classroom windows",
  () => {
    const windows =
      createWindowDepthBlueprintsV28();

    assert.equal(
      windows.length,
      3
    );

    assert.deepEqual(
      windows.map(
        (entry) =>
          entry.z
      ),
      [
        -3.7,
        0,
        3.7
      ]
    );

    for (
      const entry
      of windows
    ) {
      assert.equal(
        entry.pool.x,
        5.15
      );

      assert.equal(
        entry.wallBand.x,
        6.93
      );
    }
  }
);

test(
  "V28 creates six frozen instanced visual layers",
  () => {
    const scene =
      new THREE.Scene();

    const runtime =
      createClassroomPixelMaterialDepthV28({
        scene
      });

    const root =
      scene.getObjectByName(
        "classroom-pixel-material-depth-v28"
      );

    assert.ok(
      root
    );

    assert.equal(
      root.children.length,
      6
    );

    assert.equal(
      root.matrixAutoUpdate,
      false
    );

    assert.equal(
      root.userData.visualOnly,
      true
    );

    assert.equal(
      root.userData.interactionExcluded,
      true
    );

    let instancedCount =
      0;

    root.traverse(
      (object) => {
        if (
          !object.isInstancedMesh
        ) {
          return;
        }

        instancedCount +=
          1;

        assert.equal(
          object.matrixAutoUpdate,
          false
        );

        assert.equal(
          object.userData.visualOnly,
          true
        );

        assert.equal(
          object.userData.interactionExcluded,
          true
        );

        assert.ok(
          object.boundingBox
        );

        assert.ok(
          object.boundingSphere
        );
      }
    );

    assert.equal(
      instancedCount,
      6
    );

    const snapshot =
      runtime.getSnapshot();

    assert.equal(
      snapshot.staticVisualDrawCalls,
      6
    );

    assert.equal(
      snapshot.seatDepthCueCount,
      12
    );

    assert.equal(
      snapshot.windowLightPoolCount,
      3
    );

    assert.equal(
      snapshot.boardAccentCount,
      2
    );

    runtime.dispose();

    assert.equal(
      scene.getObjectByName(
        "classroom-pixel-material-depth-v28"
      ),
      undefined
    );
  }
);

test(
  "V28 does not acquire fog renderer shadow or gameplay authority",
  () => {
    const source =
      readSource(
        "classroomPixelMaterialDepthV28.js"
      );

    for (
      const forbidden
      of [
        /scene\.fog\s*=/gu,
        /new THREE\.Fog/gu,
        /FogExp2/gu,
        /outputColorSpace\s*=/gu,
        /toneMapping\s*=/gu,
        /toneMappingExposure\s*=/gu,
        /shadow\.mapSize/gu,
        /shadowMap\.type/gu,
        /Raycaster/gu,
        /PointerLockControls/gu,
        /addEventListener\s*\(/gu,
        /requestAnimationFrame/gu,
        /emitTeacherInterventionCommand/gu,
        /resolvePlayerCollision/gu,
        /stepPlayerLocomotion/gu,
        /collisionObstacles/gu,
        /Math\.random/gu
      ]
    ) {
      assert.equal(
        forbidden.test(
          source
        ),
        false
      );
    }
  }
);

test(
  "V28 integration is construction-only",
  () => {
    const world =
      readSource(
        "ClassroomWorld.jsx"
      );

    assert.equal(
      world
        .split(
          "createClassroomPixelMaterialDepthV28({"
        )
        .length - 1,
      1
    );

    assert.equal(
      world
        .split(
          "classroomPixelMaterialDepthV28.dispose();"
        )
        .length - 1,
      1
    );

    assert.equal(
      world.includes(
        "classroomPixelMaterialDepthV28.tick("
      ),
      false
    );

    const cw06V10TickCount =
      world
        .split(
          "classroomCharacterVisualIntegrationV10.tick({"
        )
        .length - 1;

    assert.equal(
      cw06V10TickCount,
      2
    );

    const cw06InitialRosterSync =
      world.indexOf(
        "sceneRoster.sync(\n      initialRoster"
      );

    const cw06Animate =
      world.indexOf(
        "const animate = (timestamp) => {"
      );

    const cw06InitialV10Tick =
      cw06InitialRosterSync >= 0
        ? world.indexOf(
            "classroomCharacterVisualIntegrationV10.tick({",
            cw06InitialRosterSync
          )
        : -1;

    const cw06RuntimeV10Tick =
      cw06Animate >= 0
        ? world.indexOf(
            "classroomCharacterVisualIntegrationV10.tick({",
            cw06Animate
          )
        : -1;

    assert.ok(
      cw06InitialRosterSync >=
        0
    );

    assert.ok(
      cw06InitialV10Tick >
        cw06InitialRosterSync
    );

    assert.ok(
      cw06Animate >=
        0
    );

    assert.ok(
      cw06RuntimeV10Tick >
        cw06Animate
    );

    assert.notEqual(
      cw06InitialV10Tick,
      cw06RuntimeV10Tick
    );
  }
);
