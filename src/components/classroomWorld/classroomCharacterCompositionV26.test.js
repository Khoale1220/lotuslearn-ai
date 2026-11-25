import assert from "node:assert/strict";

import {
  readFileSync
} from "node:fs";

import path from "node:path";

import test from "node:test";

import * as THREE from "three";

import {
  CLASSROOM_CHARACTER_COMPOSITION_V26_PROFILE,
  createClassroomCharacterCompositionV26,
  isCharacterPresentationSpriteV26,
  layerMaskV26
} from "./classroomCharacterCompositionV26.js";

import {
  fileURLToPath
} from "node:url";

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
  "V26 profile locks character composition targets",
  () => {
    assert.equal(
      CLASSROOM_CHARACTER_COMPOSITION_V26_PROFILE
        .visualLayer,
      30
    );

    assert.equal(
      CLASSROOM_CHARACTER_COMPOSITION_V26_PROFILE
        .targetCameraFov,
      66
    );

    assert.equal(
      CLASSROOM_CHARACTER_COMPOSITION_V26_PROFILE
        .characterScaleMultiplier,
      1.12
    );

    assert.equal(
      CLASSROOM_CHARACTER_COMPOSITION_V26_PROFILE
        .runtimeSceneTraversal,
      false
    );

    assert.equal(
      CLASSROOM_CHARACTER_COMPOSITION_V26_PROFILE
        .visualOnly,
      true
    );
  }
);

test(
  "V26 recognizes only sprite presentation objects on layer 30",
  () => {
    const material =
      new THREE.SpriteMaterial();

    const character =
      new THREE.Sprite(
        material
      );

    character.layers.set(
      30
    );

    const ordinarySprite =
      new THREE.Sprite(
        material
      );

    ordinarySprite.layers.set(
      0
    );

    const mesh =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          1,
          1,
          1
        ),
        new THREE.MeshBasicMaterial()
      );

    mesh.layers.set(
      30
    );

    assert.equal(
      isCharacterPresentationSpriteV26(
        character
      ),
      true
    );

    assert.equal(
      isCharacterPresentationSpriteV26(
        ordinarySprite
      ),
      false
    );

    assert.equal(
      isCharacterPresentationSpriteV26(
        mesh
      ),
      false
    );

    character.material.dispose();
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
);

test(
  "V26 scales only visual character sprites and restores them on dispose",
  () => {
    const scene =
      new THREE.Scene();

    const camera =
      new THREE.PerspectiveCamera(
        70,
        16 / 9,
        0.1,
        50
      );

    let projectionUpdates =
      0;

    const originalUpdate =
      camera.updateProjectionMatrix
        .bind(
          camera
        );

    camera.updateProjectionMatrix =
      () => {
        projectionUpdates +=
          1;

        originalUpdate();
      };

    const material =
      new THREE.SpriteMaterial();

    const character =
      new THREE.Sprite(
        material
      );

    character.layers.set(
      30
    );

    character.scale.set(
      1.2,
      1.8,
      1
    );

    const originalScale =
      character.scale.clone();

    const normalSprite =
      new THREE.Sprite(
        material
      );

    normalSprite.layers.set(
      0
    );

    normalSprite.scale.set(
      2,
      2,
      1
    );

    const ordinaryScale =
      normalSprite.scale.clone();

    scene.add(
      character,
      normalSprite
    );

    const runtime =
      createClassroomCharacterCompositionV26({
        scene,
        camera
      });

    const snapshot =
      runtime.getSnapshot();

    assert.equal(
      snapshot.composedCharacterCount,
      1
    );

    assert.equal(
      camera.fov,
      66
    );

    assert.ok(
      Math.abs(
        character.scale.x -
        originalScale.x *
          1.12
      ) <
        0.000001
    );

    assert.ok(
      Math.abs(
        character.scale.y -
        originalScale.y *
          1.12
      ) <
        0.000001
    );

    assert.equal(
      normalSprite.scale.equals(
        ordinaryScale
      ),
      true
    );

    runtime.dispose();

    assert.equal(
      character.scale.equals(
        originalScale
      ),
      true
    );

    assert.equal(
      camera.fov,
      70
    );

    assert.ok(
      projectionUpdates >=
        2
    );

    material.dispose();
  }
);

test(
  "V26 visual-layer bit remains deterministic",
  () => {
    assert.equal(
      layerMaskV26(
        30
      ),
      1073741824
    );
  }
);

test(
  "V26 integration is construction-only with no runtime tick",
  () => {
    const world =
      readSource(
        "ClassroomWorld.jsx"
      );

    assert.equal(
      world
        .split(
          "createClassroomCharacterCompositionV26({"
        )
        .length - 1,
      1
    );

    assert.equal(
      world
        .split(
          "classroomCharacterCompositionV26.dispose();"
        )
        .length - 1,
      1
    );

    assert.equal(
      world.includes(
        "classroomCharacterCompositionV26.tick("
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

test(
  "V26 does not acquire interaction locomotion or collision authority",
  () => {
    const source =
      readSource(
        "classroomCharacterCompositionV26.js"
      );

    for (
      const forbidden
      of [
        /Raycaster/gu,
        /PointerLockControls/gu,
        /addEventListener\s*\(/gu,
        /emitTeacherInterventionCommand/gu,
        /collisionObstacles/gu,
        /resolvePlayerCollision/gu,
        /stepPlayerLocomotion/gu,
        /playerVelocity/gu,
        /requestAnimationFrame/gu,
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
