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
  CLASSROOM_PROP_DENSITY_LIGHTING_V27_PROFILE,
  createClassroomPropDensityLightingV27,
  createSeatPropBlueprintsV27
} from "./classroomPropDensityLightingV27.js";

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
  "V27 profile locks static composition budget",
  () => {
    const profile =
      CLASSROOM_PROP_DENSITY_LIGHTING_V27_PROFILE;

    assert.equal(
      profile.seatPropCount,
      12
    );

    assert.equal(
      profile.wallCardCount,
      4
    );

    assert.equal(
      profile.shadowPocketCount,
      6
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
  "V27 seat prop blueprint generation is deterministic",
  () => {
    const first =
      createSeatPropBlueprintsV27(
        8
      );

    const second =
      createSeatPropBlueprintsV27(
        8
      );

    assert.deepEqual(
      first,
      second
    );

    assert.equal(
      first.length,
      8
    );

    for (
      const entry
      of first
    ) {
      assert.ok(
        Number.isFinite(
          entry.book.x
        )
      );

      assert.ok(
        Number.isFinite(
          entry.book.y
        )
      );

      assert.ok(
        Number.isFinite(
          entry.book.z
        )
      );

      assert.ok(
        Number.isFinite(
          entry.paper.x
        )
      );

      assert.ok(
        Number.isFinite(
          entry.paper.z
        )
      );
    }
  }
);

test(
  "V27 creates static visual-only prop density and tunes existing lighting",
  () => {
    const scene =
      new THREE.Scene();

    const hemisphere =
      new THREE.HemisphereLight(
        0xe7efff,
        0x2c2436,
        2.4
      );

    scene.add(
      hemisphere
    );

    const sunlight =
      new THREE.DirectionalLight(
        0xfff0d8,
        2.2
      );

    sunlight.name =
      "classroom-window-sun";

    scene.add(
      sunlight
    );

    const originalHemisphere =
      hemisphere.intensity;

    const originalSunlight =
      sunlight.intensity;

    const runtime =
      createClassroomPropDensityLightingV27({
        scene,

        teacherAnchor:
          {
            x: 0,
            z: 0
          }
      });

    const root =
      scene.getObjectByName(
        "classroom-prop-density-lighting-v27"
      );

    assert.ok(
      root
    );

    assert.equal(
      root.userData.visualOnly,
      true
    );

    assert.equal(
      root.userData.interactionExcluded,
      true
    );

    const snapshot =
      runtime.getSnapshot();

    assert.equal(
      snapshot.bookInstanceCount,
      15
    );

    assert.equal(
      snapshot.paperInstanceCount,
      14
    );

    assert.equal(
      snapshot.shadowPocketCount,
      6
    );

    assert.equal(
      snapshot.wallCardCount,
      4
    );

    assert.equal(
      snapshot.chalkPieceCount,
      5
    );

    assert.equal(
      snapshot.staticVisualDrawCalls,
      6
    );

    assert.equal(
      snapshot.runtimeSceneTraversal,
      false
    );

    assert.equal(
      snapshot.runtimeAnimation,
      false
    );

    assert.ok(
      hemisphere.intensity <
        originalHemisphere
    );

    assert.ok(
      sunlight.intensity >
        originalSunlight
    );

    let instancedMeshes =
      0;

    root.traverse(
      (object) => {
        if (
          object.isInstancedMesh
        ) {
          instancedMeshes +=
            1;

          assert.equal(
            object.matrixAutoUpdate,
            false
          );

          assert.ok(
            object.boundingSphere
          );

          assert.ok(
            object.boundingBox
          );
        }

        if (
          object.isMesh
        ) {
          assert.equal(
            object.userData
              .interactionExcluded,
            true
          );

          assert.equal(
            object.userData
              .visualOnly,
            true
          );
        }
      }
    );

    assert.equal(
      instancedMeshes,
      5
    );

    runtime.dispose();

    assert.equal(
      scene.getObjectByName(
        "classroom-prop-density-lighting-v27"
      ),
      undefined
    );

    assert.equal(
      hemisphere.intensity,
      originalHemisphere
    );

    assert.equal(
      sunlight.intensity,
      originalSunlight
    );
  }
);

test(
  "V27 does not acquire gameplay authority",
  () => {
    const source =
      readSource(
        "classroomPropDensityLightingV27.js"
      );

    for (
      const forbidden
      of [
        /Raycaster/gu,
        /PointerLockControls/gu,
        /addEventListener\s*\(/gu,
        /requestAnimationFrame/gu,
        /emitTeacherInterventionCommand/gu,
        /resolvePlayerCollision/gu,
        /stepPlayerLocomotion/gu,
        /collisionObstacles/gu,
        /AudioListener/gu,
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
  "V27 does not increase shadow-map resolution",
  () => {
    const source =
      readSource(
        "classroomPropDensityLightingV27.js"
      );

    assert.equal(
      /shadow\.mapSize/gu.test(
        source
      ),
      false
    );

    assert.equal(
      /shadowMap\.type/gu.test(
        source
      ),
      false
    );
  }
);

test(
  "V27 integration remains construction-only",
  () => {
    const world =
      readSource(
        "ClassroomWorld.jsx"
      );

    assert.equal(
      world
        .split(
          "createClassroomPropDensityLightingV27({"
        )
        .length - 1,
      1
    );

    assert.equal(
      world
        .split(
          "classroomPropDensityLightingV27.dispose();"
        )
        .length - 1,
      1
    );

    assert.equal(
      world.includes(
        "classroomPropDensityLightingV27.tick("
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
