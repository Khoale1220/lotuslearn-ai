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
  CLASSROOM_REFERENCE_SURFACE_V29_PROFILE,
  createClassroomReferenceSurfaceSilhouetteV29,
  createReferenceSurfaceTextureSetV29,
  createWindowSilhouetteBlueprintsV29
} from "./classroomReferenceSurfaceSilhouetteV29.js";

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
  "V29 profile locks six static reference-driven layers",
  () => {
    const profile =
      CLASSROOM_REFERENCE_SURFACE_V29_PROFILE;

    assert.equal(
      profile.textureCount,
      6
    );

    assert.equal(
      profile.staticVisualDrawCalls,
      6
    );

    assert.equal(
      profile.textureFiltering,
      "nearest"
    );

    assert.equal(
      profile.mipmaps,
      false
    );

    assert.equal(
      profile.anisotropy,
      1
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
  "V29 procedural color textures obey retro pixel sampling policy",
  () => {
    const textures =
      createReferenceSurfaceTextureSetV29();

    const entries =
      Object.values(
        textures
      );

    assert.equal(
      entries.length,
      6
    );

    for (
      const texture
      of entries
    ) {
      assert.equal(
        texture.isDataTexture,
        true
      );

      assert.equal(
        texture.magFilter,
        THREE.NearestFilter
      );

      assert.equal(
        texture.minFilter,
        THREE.NearestFilter
      );

      assert.equal(
        texture.generateMipmaps,
        false
      );

      assert.equal(
        texture.anisotropy,
        1
      );

      assert.equal(
        texture.colorSpace,
        THREE.SRGBColorSpace
      );

      texture.dispose();
    }
  }
);

test(
  "V29 procedural surface generation is deterministic",
  () => {
    const first =
      createReferenceSurfaceTextureSetV29();

    const second =
      createReferenceSurfaceTextureSetV29();

    const names =
      Object.keys(
        first
      );

    assert.deepEqual(
      names,
      Object.keys(
        second
      )
    );

    for (
      const name
      of names
    ) {
      assert.deepEqual(
        Array.from(
          first[name].image.data
        ),
        Array.from(
          second[name].image.data
        )
      );

      first[name].dispose();
      second[name].dispose();
    }
  }
);

test(
  "V29 derives environment silhouettes from canonical three-window layout",
  () => {
    const result =
      createWindowSilhouetteBlueprintsV29();

    assert.equal(
      result.length,
      3
    );

    assert.deepEqual(
      result.map(
        (entry) =>
          entry.skyline.z
      ),
      [
        -3.7,
        0,
        3.7
      ]
    );

    for (
      const entry
      of result
    ) {
      assert.ok(
        entry.skyline.x >
          7.04
      );

      assert.ok(
        entry.foliage.x >
          7.04
      );

      assert.ok(
        entry.foliage.x <
          entry.skyline.x
      );
    }
  }
);

test(
  "V29 creates exactly six frozen instanced visual layers",
  () => {
    const scene =
      new THREE.Scene();

    const runtime =
      createClassroomReferenceSurfaceSilhouetteV29({
        scene
      });

    const root =
      scene.getObjectByName(
        "classroom-reference-surface-silhouette-v29"
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
      snapshot.textureCount,
      6
    );

    assert.equal(
      snapshot.wallWearCount,
      8
    );

    assert.equal(
      snapshot.floorScuffCount,
      10
    );

    assert.equal(
      snapshot.deskGrainCount,
      12
    );

    assert.equal(
      snapshot.boardSmudgeCount,
      4
    );

    assert.equal(
      snapshot.skylineInstanceCount,
      3
    );

    assert.equal(
      snapshot.foliageInstanceCount,
      3
    );

    assert.equal(
      snapshot.staticVisualDrawCalls,
      6
    );

    runtime.dispose();

    assert.equal(
      scene.getObjectByName(
        "classroom-reference-surface-silhouette-v29"
      ),
      undefined
    );
  }
);

test(
  "V29 does not acquire renderer fog shadows gameplay or animation authority",
  () => {
    const source =
      readSource(
        "classroomReferenceSurfaceSilhouetteV29.js"
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
  "V29 integration remains construction-only",
  () => {
    const world =
      readSource(
        "ClassroomWorld.jsx"
      );

    assert.equal(
      world
        .split(
          "createClassroomReferenceSurfaceSilhouetteV29({"
        )
        .length - 1,
      1
    );

    assert.equal(
      world
        .split(
          "classroomReferenceSurfaceSilhouetteV29.dispose();"
        )
        .length - 1,
      1
    );

    assert.equal(
      world.includes(
        "classroomReferenceSurfaceSilhouetteV29.tick("
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
