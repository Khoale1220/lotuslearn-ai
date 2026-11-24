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
  CLASSROOM_PIXEL_CONTACT_GROUNDING_V36_PROFILE,
  createClassroomPixelContactGroundingV36,
  deriveStudentContactShadowV36,
  discoverGroundingSourcesV36,
  furnitureShadowStatePreservedV36,
  looksLikeFurnitureShadowV36
} from "./classroomPixelContactGroundingV36.js";

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

function createFixture() {
  const scene =
    new THREE.Scene();

  const furnitureRoot =
    new THREE.Group();

  furnitureRoot.name =
    "classroom-furniture-v2";

  const existingShadowGeometry =
    new THREE.PlaneGeometry(
      1.8,
      0.9
    );

  const existingShadowMaterial =
    new THREE.MeshBasicMaterial({
      color:
        0x231b27,

      transparent:
        true,

      opacity:
        0.24,

      depthWrite:
        false
    });

  const existingShadow =
    new THREE.Mesh(
      existingShadowGeometry,
      existingShadowMaterial
    );

  existingShadow.name =
    "student-desk-shadow-existing";

  existingShadow.rotation.x =
    -Math.PI / 2;

  existingShadow.position.y =
    0.008;

  furnitureRoot.add(
    existingShadow
  );

  scene.add(
    furnitureRoot
  );

  const atlasData =
    new Uint8Array(
      512 *
      384 *
      4
    );

  const atlas =
    new THREE.DataTexture(
      atlasData,
      512,
      384,
      THREE.RGBAFormat
    );

  atlas.magFilter =
    THREE.NearestFilter;

  atlas.minFilter =
    THREE.NearestFilter;

  atlas.generateMipmaps =
    false;

  const sprite =
    new THREE.Sprite(
      new THREE.SpriteMaterial({
        map:
          atlas
      })
    );

  sprite.name =
    "student-character-v36-test";

  sprite.userData = {
    studentKey:
      "student-v36-test"
  };

  sprite.position.set(
    1.2,
    1.55,
    -0.7
  );

  scene.add(
    sprite
  );

  scene.updateMatrixWorld(
    true
  );

  return {
    scene,
    furnitureRoot,
    existingShadow,
    existingShadowGeometry,
    existingShadowMaterial,
    sprite,
    atlas
  };
}

function disposeFixture(
  fixture
) {
  fixture
    .existingShadowGeometry
    .dispose();

  fixture
    .existingShadowMaterial
    .dispose();

  fixture
    .sprite
    .material
    .dispose();

  fixture
    .atlas
    .dispose();
}

test(
  "V36 adds one instanced visual layer only",
  () => {
    const profile =
      CLASSROOM_PIXEL_CONTACT_GROUNDING_V36_PROFILE;

    assert.equal(
      profile.addedMeshes,
      1
    );

    assert.equal(
      profile.addedGeometries,
      1
    );

    assert.equal(
      profile.addedMaterials,
      1
    );

    assert.equal(
      profile.addedTextures,
      0
    );

    assert.equal(
      profile.addedLights,
      0
    );

    assert.equal(
      profile.addedDrawCalls,
      1
    );

    assert.equal(
      profile.addedShadowMaps,
      0
    );

    assert.equal(
      profile.runtimeSceneTraversal,
      false
    );

    assert.equal(
      profile.runtimeTick,
      false
    );
  }
);

test(
  "V36 recognizes canonical Furniture V2 shadow without claiming V27",
  () => {
    const fixture =
      createFixture();

    assert.equal(
      looksLikeFurnitureShadowV36(
        fixture.existingShadow
      ),
      true
    );

    const unrelatedRoot =
      new THREE.Group();

    unrelatedRoot.name =
      "classroom-prop-density-lighting-v27";

    const unrelatedShadow =
      new THREE.Mesh(
        new THREE.PlaneGeometry(
          1,
          1
        ),

        new THREE.MeshBasicMaterial({
          transparent:
            true,

          opacity:
            0.2
        })
      );

    unrelatedShadow.name =
      "cinematic-shadow-pocket";

    unrelatedRoot.add(
      unrelatedShadow
    );

    fixture.scene.add(
      unrelatedRoot
    );

    assert.equal(
      looksLikeFurnitureShadowV36(
        unrelatedShadow
      ),
      false
    );

    unrelatedShadow.geometry.dispose();
    unrelatedShadow.material.dispose();

    disposeFixture(
      fixture
    );
  }
);

test(
  "V36 performs one discovery pass and finds students plus Furniture V2 shadows",
  () => {
    const fixture =
      createFixture();

    const discovery =
      discoverGroundingSourcesV36(
        fixture.scene
      );

    assert.equal(
      discovery.furnitureRootFound,
      true
    );

    assert.equal(
      discovery.furnitureShadows.length,
      1
    );

    assert.equal(
      discovery.furnitureShadows[0],
      fixture.existingShadow
    );

    assert.equal(
      discovery.studentSprites.length,
      1
    );

    assert.equal(
      discovery.studentSprites[0],
      fixture.sprite
    );

    disposeFixture(
      fixture
    );
  }
);

test(
  "V36 deterministic contact blueprint remains on floor plane",
  () => {
    const fixture =
      createFixture();

    const first =
      deriveStudentContactShadowV36({
        sprite:
          fixture.sprite,

        studentIndex:
          0
      });

    const second =
      deriveStudentContactShadowV36({
        sprite:
          fixture.sprite,

        studentIndex:
          0
      });

    assert.deepEqual(
      first,
      second
    );

    assert.equal(
      first.studentKey,
      "student-v36-test"
    );

    assert.equal(
      first.position.y,
      0.012
    );

    assert.ok(
      first.scale.x >=
        0.46
    );

    assert.ok(
      first.scale.y >=
        0.18
    );

    disposeFixture(
      fixture
    );
  }
);

test(
  "V36 creates one instanced contact mesh and preserves existing furniture shadow",
  () => {
    const fixture =
      createFixture();

    const originalShadowState = {
      object:
        fixture.existingShadow,

      material:
        fixture.existingShadowMaterial,

      visible:
        fixture.existingShadow.visible,

      renderOrder:
        fixture.existingShadow.renderOrder,

      opacity:
        fixture.existingShadowMaterial.opacity,

      transparent:
        fixture.existingShadowMaterial.transparent,

      depthWrite:
        fixture.existingShadowMaterial.depthWrite,

      color:
        fixture.existingShadowMaterial.color.getHex()
    };

    const childrenBefore =
      fixture.scene.children.length;

    const runtime =
      createClassroomPixelContactGroundingV36({
        scene:
          fixture.scene
      });

    const snapshot =
      runtime.getSnapshot();

    assert.equal(
      fixture.scene.children.length,
      childrenBefore + 1
    );

    assert.equal(
      snapshot.furnitureRootFound,
      true
    );

    assert.equal(
      snapshot.existingFurnitureShadowCount,
      1
    );

    assert.equal(
      snapshot.furnitureShadowAuthorityPreserved,
      true
    );

    assert.equal(
      snapshot.studentSpriteCount,
      1
    );

    assert.equal(
      snapshot.contactShadowInstanceCount,
      1
    );

    assert.equal(
      snapshot.contactShadowsPerStudent,
      1
    );

    assert.equal(
      snapshot.staticDrawCalls,
      1
    );

    assert.equal(
      snapshot.addedTextures,
      0
    );

    assert.equal(
      snapshot.addedLights,
      0
    );

    assert.equal(
      snapshot.addedShadowMaps,
      0
    );

    assert.equal(
      snapshot.instanceBoundsReady,
      true
    );

    assert.equal(
      snapshot.visualLayer30,
      true
    );

    assert.equal(
      snapshot.transparent,
      true
    );

    assert.equal(
      snapshot.depthWrite,
      false
    );

    assert.equal(
      snapshot.depthTest,
      true
    );

    assert.equal(
      snapshot.polygonOffset,
      true
    );

    const contactMesh =
      runtime.root.getObjectByName(
        "cw06-v36-student-contact-shadows"
      );

    assert.ok(
      contactMesh
    );

    assert.equal(
      contactMesh.isInstancedMesh,
      true
    );

    assert.equal(
      contactMesh.count,
      1
    );

    assert.equal(
      contactMesh.castShadow,
      false
    );

    assert.equal(
      contactMesh.receiveShadow,
      false
    );

    assert.equal(
      contactMesh.matrixAutoUpdate,
      false
    );

    assert.ok(
      contactMesh.boundingBox
    );

    assert.ok(
      contactMesh.boundingSphere
    );

    assert.equal(
      contactMesh.userData.visualOnly,
      true
    );

    assert.equal(
      contactMesh.userData.interactionExcluded,
      true
    );

    assert.equal(
      contactMesh.userData.collisionExcluded,
      true
    );

    assert.equal(
      fixture.existingShadow.material,
      originalShadowState.material
    );

    assert.equal(
      fixture.existingShadow.visible,
      originalShadowState.visible
    );

    assert.equal(
      fixture.existingShadow.renderOrder,
      originalShadowState.renderOrder
    );

    assert.equal(
      fixture.existingShadowMaterial.opacity,
      originalShadowState.opacity
    );

    assert.equal(
      fixture.existingShadowMaterial.transparent,
      originalShadowState.transparent
    );

    assert.equal(
      fixture.existingShadowMaterial.depthWrite,
      originalShadowState.depthWrite
    );

    assert.equal(
      fixture.existingShadowMaterial.color.getHex(),
      originalShadowState.color
    );

    assert.equal(
      furnitureShadowStatePreservedV36(
        originalShadowState
      ),
      true
    );

    runtime.dispose();

    assert.equal(
      fixture.scene.getObjectByName(
        "classroom-pixel-contact-grounding-v36"
      ),
      undefined
    );

    disposeFixture(
      fixture
    );
  }
);

test(
  "V36 introduces no competing gameplay render loop collision or interaction authority",
  () => {
    const source =
      readSource(
        "classroomPixelContactGroundingV36.js"
      );

    const forbidden = [
      /new THREE\.Sprite\s*\(/gu,
      /new THREE\.CanvasTexture\s*\(/gu,
      /new THREE\.DataTexture\s*\(/gu,
      /new THREE\..*Light\s*\(/gu,
      /new THREE\.Raycaster\s*\(/gu,
      /PointerLockControls/gu,
      /requestAnimationFrame/gu,
      /setInterval/gu,
      /setTimeout/gu,
      /emitTeacherInterventionCommand/gu,
      /stepPlayerLocomotion/gu,
      /resolvePlayerCollision/gu,
      /collisionObstacles/gu,
      /Math\.random/gu
    ];

    for (
      const expression
      of forbidden
    ) {
      assert.equal(
        expression.test(
          source
        ),
        false
      );
    }

    assert.equal(
      (
        source.match(
          /scene\.traverse\s*\(/gu
        ) ??
        []
      ).length,
      1
    );

    assert.equal(
      (
        source.match(
          /new THREE\.InstancedMesh\s*\(/gu
        ) ??
        []
      ).length,
      1
    );

    assert.equal(
      (
        source.match(
          /new THREE\.PlaneGeometry\s*\(/gu
        ) ??
        []
      ).length,
      1
    );

    assert.equal(
      (
        source.match(
          /new THREE\.MeshBasicMaterial\s*\(/gu
        ) ??
        []
      ).length,
      1
    );
  }
);

test(
  "V36 explicitly recomputes InstancedMesh bounds after matrix updates",
  () => {
    const source =
      readSource(
        "classroomPixelContactGroundingV36.js"
      );

    const matrixUpdate =
      source.indexOf(
        ".instanceMatrix"
      );

    const boundingBox =
      source.indexOf(
        "contactMesh.computeBoundingBox();"
      );

    const boundingSphere =
      source.indexOf(
        "contactMesh.computeBoundingSphere();"
      );

    assert.ok(
      matrixUpdate >=
        0
    );

    assert.ok(
      boundingBox >
        matrixUpdate
    );

    assert.ok(
      boundingSphere >
        boundingBox
    );
  }
);

test(
  "V36 world integration remains construction-only",
  () => {
    const world =
      readSource(
        "ClassroomWorld.jsx"
      );

    assert.equal(
      world
        .split(
          "createClassroomPixelContactGroundingV36({"
        )
        .length - 1,
      1
    );

    assert.equal(
      world
        .split(
          "classroomPixelContactGroundingV36.dispose();"
        )
        .length - 1,
      1
    );

    assert.equal(
      world.includes(
        "classroomPixelContactGroundingV36.tick("
      ),
      false
    );

    const v36 =
      world.indexOf(
        "classroomPixelContactGroundingV36.dispose();"
      );

    const v35 =
      world.indexOf(
        "classroomDepthAtmospherePixelLightingV35.dispose();"
      );

    assert.ok(
      v36 >=
        0
    );

    assert.ok(
      v35 >=
        0
    );

    assert.ok(
      v36 <
        v35
    );

    assert.equal(
      world
        .split(
          ".intersectObjects(interactiveMeshes, false)"
        )
        .length - 1,
      1
    );
  }
);
