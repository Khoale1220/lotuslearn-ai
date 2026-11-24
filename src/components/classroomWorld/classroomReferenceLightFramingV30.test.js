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
  CLASSROOM_REFERENCE_LIGHT_FRAMING_V30_PROFILE,
  createClassroomReferenceLightFramingV30,
  createLightShaftGeometryV30,
  createWindowLightBlueprintsV30
} from "./classroomReferenceLightFramingV30.js";

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
  "V30 profile locks five static visual draw calls with zero real lights",
  () => {
    const profile =
      CLASSROOM_REFERENCE_LIGHT_FRAMING_V30_PROFILE;

    assert.equal(
      profile.windowLightShaftCount,
      3
    );

    assert.equal(
      profile.mullionShadowCount,
      9
    );

    assert.equal(
      profile.boardFrameCount,
      4
    );

    assert.equal(
      profile.cornerFrameCount,
      4
    );

    assert.equal(
      profile.teacherFocusCount,
      1
    );

    assert.equal(
      profile.staticVisualDrawCalls,
      5
    );

    assert.equal(
      profile.addedRealLights,
      0
    );

    assert.equal(
      profile.addedShadowCastingLights,
      0
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
  "V30 light-shaft geometry is deterministic and bounded",
  () => {
    const first =
      createLightShaftGeometryV30();

    const second =
      createLightShaftGeometryV30();

    assert.deepEqual(
      Array.from(
        first.attributes
          .position
          .array
      ),
      Array.from(
        second.attributes
          .position
          .array
      )
    );

    assert.deepEqual(
      Array.from(
        first.index.array
      ),
      Array.from(
        second.index.array
      )
    );

    assert.ok(
      first.boundingBox
    );

    assert.ok(
      first.boundingSphere
    );

    first.dispose();
    second.dispose();
  }
);

test(
  "V30 derives shafts and nine mullion shadows from canonical windows",
  () => {
    const blueprint =
      createWindowLightBlueprintsV30();

    assert.equal(
      blueprint
        .shafts
        .length,
      3
    );

    assert.equal(
      blueprint
        .mullions
        .length,
      9
    );

    assert.deepEqual(
      blueprint
        .shafts
        .map(
          (entry) =>
            entry.z
        ),
      [
        -3.7,
        0,
        3.7
      ]
    );

    assert.deepEqual(
      blueprint
        .mullions
        .filter(
          (
            _entry,
            index
          ) =>
            index %
              3 ===
            1
        )
        .map(
          (entry) =>
            entry.z
        ),
      [
        -3.7,
        0,
        3.7
      ]
    );
  }
);

test(
  "V30 creates five frozen instanced visual layers without adding lights",
  () => {
    const scene =
      new THREE.Scene();

    const hemisphere =
      new THREE.HemisphereLight(
        0xffffff,
        0x222222,
        1
      );

    const sunlight =
      new THREE.DirectionalLight(
        0xffffff,
        1
      );

    scene.add(
      hemisphere,
      sunlight
    );

    const lightCountBefore =
      scene.children.filter(
        (object) =>
          object.isLight
      ).length;

    const runtime =
      createClassroomReferenceLightFramingV30({
        scene,

        teacherAnchor:
          {
            x: 0,
            z: 0
          }
      });

    const root =
      scene.getObjectByName(
        "classroom-reference-light-framing-v30"
      );

    assert.ok(
      root
    );

    assert.equal(
      root.children.length,
      5
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

    const lightCountAfter =
      scene.children.filter(
        (object) =>
          object.isLight
      ).length;

    assert.equal(
      lightCountAfter,
      lightCountBefore
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

        assert.equal(
          object.castShadow,
          false
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
      5
    );

    const shaft =
      root.getObjectByName(
        "cw06-v30-window-air-light-shafts"
      );

    const focus =
      root.getObjectByName(
        "cw06-v30-teacher-station-focus"
      );

    assert.equal(
      shaft.material.transparent,
      true
    );

    assert.equal(
      shaft.material.depthWrite,
      false
    );

    assert.equal(
      shaft.material.forceSinglePass,
      true
    );

    assert.equal(
      focus.material.transparent,
      true
    );

    assert.equal(
      focus.material.depthWrite,
      false
    );

    assert.equal(
      focus.material.forceSinglePass,
      true
    );

    const snapshot =
      runtime.getSnapshot();

    assert.equal(
      snapshot.windowLightShaftCount,
      3
    );

    assert.equal(
      snapshot.mullionShadowCount,
      9
    );

    assert.equal(
      snapshot.staticVisualDrawCalls,
      5
    );

    assert.equal(
      snapshot.addedRealLights,
      0
    );

    assert.equal(
      snapshot.addedShadowCastingLights,
      0
    );

    runtime.dispose();

    assert.equal(
      scene.getObjectByName(
        "classroom-reference-light-framing-v30"
      ),
      undefined
    );

    hemisphere.dispose();
    sunlight.dispose();
  }
);

test(
  "V30 does not acquire camera renderer fog shadow or gameplay authority",
  () => {
    const source =
      readSource(
        "classroomReferenceLightFramingV30.js"
      );

    for (
      const forbidden
      of [
        /new THREE\.DirectionalLight/gu,
        /new THREE\.PointLight/gu,
        /new THREE\.SpotLight/gu,
        /PerspectiveCamera/gu,
        /\.fov\s*=/gu,
        /\.zoom\s*=/gu,
        /updateProjectionMatrix\s*\(/gu,
        /scene\.fog\s*=/gu,
        /new THREE\.Fog/gu,
        /FogExp2/gu,
        /outputColorSpace\s*=/gu,
        /toneMapping\s*=/gu,
        /shadow\.mapSize/gu,
        /shadowMap\.type/gu,
        /castShadow\s*=\s*true/gu,
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
  "V30 integration remains construction-only",
  () => {
    const world =
      readSource(
        "ClassroomWorld.jsx"
      );

    assert.equal(
      world
        .split(
          "createClassroomReferenceLightFramingV30({"
        )
        .length - 1,
      1
    );

    assert.equal(
      world
        .split(
          "classroomReferenceLightFramingV30.dispose();"
        )
        .length - 1,
      1
    );

    assert.equal(
      world.includes(
        "classroomReferenceLightFramingV30.tick("
      ),
      false
    );

    assert.equal(
      world
        .split(
          "classroomCharacterVisualIntegrationV10.tick({"
        )
        .length - 1,
      1
    );
  }
);
