import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as THREE from "three";

import {
  CLASSROOM_CHARACTER_FIRST_PERSON_STAGING_V46_PROFILE,
  deriveSeatedAnchorYV46,
  isOpaqueFurnitureOccluderV46,
  createClassroomCharacterFirstPersonStagingV46
} from "./classroomCharacterFirstPersonStagingV46.js";

function createCharacterFixture(
  studentKey
) {
  const texture =
    new THREE.Texture();

  texture.offset.set(
    0.25,
    0.5
  );

  texture.repeat.set(
    0.125,
    0.25
  );

  const material =
    new THREE.SpriteMaterial({
      map:
        texture,

      color:
        0xffffff,

      transparent:
        true,

      alphaTest:
        0.05,

      depthTest:
        false,

      depthWrite:
        false,

      sizeAttenuation:
        false
    });

  const sprite =
    new THREE.Sprite(
      material
    );

  sprite.name =
    `cw06-v10-${studentKey}`;

  sprite.userData = {
    studentKey,

    characterRole:
      "student"
  };

  sprite.layers.set(
    30
  );

  sprite.position.set(
    1.25,
    1.4,
    -2.8
  );

  sprite.scale.set(
    1.12,
    1.12,
    1
  );

  sprite.renderOrder =
    7;

  return {
    studentKey,
    texture,
    material,
    sprite
  };
}

function createRetroFurnitureFixture() {
  const root =
    new THREE.Group();

  root.name =
    "classroom-retro-composition-v4";

  const geometry =
    new THREE.BoxGeometry(
      1.1,
      0.12,
      0.55
    );

  const material =
    new THREE.MeshBasicMaterial({
      color:
        0x795548
    });

  material.depthTest =
    true;

  material.depthWrite =
    true;

  material.transparent =
    false;

  const mesh =
    new THREE.InstancedMesh(
      geometry,
      material,
      8
    );

  root.add(
    mesh
  );

  return {
    root,
    mesh,
    geometry,
    material
  };
}

test(
  "V46 profile is presentation-only and runtime-free",
  () => {
    const profile =
      CLASSROOM_CHARACTER_FIRST_PERSON_STAGING_V46_PROFILE;

    assert.equal(
      profile.version,
      46
    );

    assert.equal(
      profile.visualOnly,
      true
    );

    assert.equal(
      profile.deterministic,
      true
    );

    assert.equal(
      profile.constructionOnly,
      true
    );

    assert.equal(
      profile.characterLayer,
      30
    );

    assert.equal(
      profile.alphaTestFloor,
      0.5
    );

    assert.equal(
      profile.runtimeSceneTraversalCount,
      0
    );

    assert.equal(
      profile.addedDrawCalls,
      0
    );

    assert.equal(
      profile.addedTextures,
      0
    );

    assert.equal(
      profile.addedSprites,
      0
    );

    assert.equal(
      profile.addedMeshes,
      0
    );

    assert.equal(
      profile.addedMaterials,
      0
    );

    assert.equal(
      profile.addedLights,
      0
    );
  }
);

test(
  "V46 seated anchor is deterministic and tightly bounded",
  () => {
    const first =
      deriveSeatedAnchorYV46(
        "student-17"
      );

    const second =
      deriveSeatedAnchorYV46(
        "student-17"
      );

    assert.equal(
      first,
      second
    );

    const values =
      new Set();

    for (
      let index = 0;
      index < 64;
      index += 1
    ) {
      const value =
        deriveSeatedAnchorYV46(
          `student-${index}`
        );

      assert.ok(
        value >=
          0.574
      );

      assert.ok(
        value <=
          0.586
      );

      values.add(
        value
      );
    }

    assert.equal(
      values.size,
      3
    );
  }
);

test(
  "V46 recognizes opaque instanced retro furniture as real depth occluders",
  () => {
    const fixture =
      createRetroFurnitureFixture();

    assert.equal(
      isOpaqueFurnitureOccluderV46(
        fixture.mesh
      ),
      true
    );

    fixture.material.depthWrite =
      false;

    assert.equal(
      isOpaqueFurnitureOccluderV46(
        fixture.mesh
      ),
      false
    );

    fixture.geometry.dispose();
    fixture.material.dispose();
  }
);

test(
  "V46 creates seated first-person composition without moving canonical character anchors",
  () => {
    const scene =
      new THREE.Scene();

    const camera =
      new THREE.PerspectiveCamera(
        60,
        16 / 9,
        0.1,
        50
      );

    camera.position.set(
      2.5,
      1.65,
      5.5
    );

    scene.add(
      camera
    );

    const furniture =
      createRetroFurnitureFixture();

    scene.add(
      furniture.root
    );

    const fixtures =
      [];

    for (
      let index = 0;
      index < 12;
      index += 1
    ) {
      const fixture =
        createCharacterFixture(
          `student-${index}`
        );

      fixture.sprite.position.x =
        index *
        0.5;

      fixtures.push(
        fixture
      );

      scene.add(
        fixture.sprite
      );
    }

    const cameraBaseline = {
      fov:
        camera.fov,

      near:
        camera.near,

      far:
        camera.far,

      position:
        camera.position.clone()
    };

    const baselines =
      fixtures.map(
        (fixture) => ({
          fixture,

          position:
            fixture.sprite.position.clone(),

          scale:
            fixture.sprite.scale.clone(),

          center:
            fixture.sprite.center.clone(),

          renderOrder:
            fixture.sprite.renderOrder,

          raycast:
            fixture.sprite.raycast,

          layers:
            fixture.sprite.layers.mask,

          texture:
            fixture.material.map,

          offset:
            fixture.texture.offset.clone(),

          repeat:
            fixture.texture.repeat.clone(),

          color:
            fixture.material.color.clone(),

          transparent:
            fixture.material.transparent,

          alphaTest:
            fixture.material.alphaTest,

          depthTest:
            fixture.material.depthTest,

          depthWrite:
            fixture.material.depthWrite,

          sizeAttenuation:
            fixture.material.sizeAttenuation
        })
      );

    let traversalCount =
      0;

    const realTraverse =
      scene.traverse.bind(
        scene
      );

    scene.traverse =
      (callback) => {
        traversalCount +=
          1;

        return realTraverse(
          callback
        );
      };

    const system =
      createClassroomCharacterFirstPersonStagingV46({
        scene,
        camera
      });

    assert.equal(
      traversalCount,
      1
    );

    const snapshot =
      system.getSnapshot();

    assert.equal(
      snapshot.characterSpriteCount,
      12
    );

    assert.equal(
      snapshot.characterMaterialCount,
      12
    );

    assert.ok(
      snapshot.opaqueFurnitureOccluderCount >=
        1
    );

    assert.equal(
      snapshot.cameraFov,
      60
    );

    assert.equal(
      snapshot.cameraNear,
      0.1
    );

    assert.equal(
      snapshot.cameraFar,
      50
    );

    assert.ok(
      snapshot.minimumAnchorY >=
        0.574
    );

    assert.ok(
      snapshot.maximumAnchorY <=
        0.586
    );

    assert.ok(
      snapshot.anchorSpan <=
        0.0120000001
    );

    assert.equal(
      snapshot.runtimeSceneTraversalCount,
      0
    );

    assert.equal(
      snapshot.addedDrawCalls,
      0
    );

    assert.equal(
      snapshot.addedTextures,
      0
    );

    assert.equal(
      snapshot.addedSprites,
      0
    );

    assert.equal(
      snapshot.addedMeshes,
      0
    );

    assert.equal(
      snapshot.addedMaterials,
      0
    );

    assert.equal(
      snapshot.addedLights,
      0
    );

    assert.equal(
      snapshot.positionMutationCount,
      0
    );

    assert.equal(
      snapshot.scaleMutationCount,
      0
    );

    assert.equal(
      snapshot.uvMutationCount,
      0
    );

    assert.equal(
      snapshot.frameSelectionMutationCount,
      0
    );

    assert.equal(
      snapshot.cameraProjectionMutationCount,
      0
    );

    assert.equal(
      snapshot.renderOrderMutationCount,
      0
    );

    assert.equal(
      snapshot.centerMutationCount,
      12
    );

    for (
      const baseline
      of baselines
    ) {
      const {
        fixture
      } =
        baseline;

      assert.deepEqual(
        fixture.sprite.position.toArray(),
        baseline.position.toArray()
      );

      assert.deepEqual(
        fixture.sprite.scale.toArray(),
        baseline.scale.toArray()
      );

      assert.equal(
        fixture.sprite.center.x,
        baseline.center.x
      );

      assert.ok(
        fixture.sprite.center.y >=
          0.574
      );

      assert.ok(
        fixture.sprite.center.y <=
          0.586
      );

      assert.equal(
        fixture.sprite.renderOrder,
        baseline.renderOrder
      );

      assert.equal(
        fixture.sprite.raycast,
        baseline.raycast
      );

      assert.equal(
        fixture.sprite.layers.mask,
        baseline.layers
      );

      assert.equal(
        fixture.material.map,
        baseline.texture
      );

      assert.deepEqual(
        fixture.texture.offset.toArray(),
        baseline.offset.toArray()
      );

      assert.deepEqual(
        fixture.texture.repeat.toArray(),
        baseline.repeat.toArray()
      );

      assert.deepEqual(
        fixture.material.color.toArray(),
        baseline.color.toArray()
      );

      assert.equal(
        fixture.material.transparent,
        false
      );

      assert.equal(
        fixture.material.alphaTest,
        0.5
      );

      assert.equal(
        fixture.material.depthTest,
        true
      );

      assert.equal(
        fixture.material.depthWrite,
        true
      );

      assert.equal(
        fixture.material.sizeAttenuation,
        true
      );
    }

    assert.equal(
      camera.fov,
      cameraBaseline.fov
    );

    assert.equal(
      camera.near,
      cameraBaseline.near
    );

    assert.equal(
      camera.far,
      cameraBaseline.far
    );

    assert.deepEqual(
      camera.position.toArray(),
      cameraBaseline.position.toArray()
    );

    system.dispose();

    for (
      const baseline
      of baselines
    ) {
      const {
        fixture
      } =
        baseline;

      assert.deepEqual(
        fixture.sprite.center.toArray(),
        baseline.center.toArray()
      );

      assert.equal(
        fixture.material.transparent,
        baseline.transparent
      );

      assert.equal(
        fixture.material.alphaTest,
        baseline.alphaTest
      );

      assert.equal(
        fixture.material.depthTest,
        baseline.depthTest
      );

      assert.equal(
        fixture.material.depthWrite,
        baseline.depthWrite
      );

      assert.equal(
        fixture.material.sizeAttenuation,
        baseline.sizeAttenuation
      );

      fixture.material.dispose();
      fixture.texture.dispose();
    }

    furniture.geometry.dispose();
    furniture.material.dispose();
  }
);

test(
  "V46 source contains no second rendering interaction or locomotion authority",
  () => {
    const source =
      fs.readFileSync(
        new URL(
          "./classroomCharacterFirstPersonStagingV46.js",
          import.meta.url
        ),
        "utf8"
      );

    assert.match(
      source,
      /classroomCharacterCastVarietyV45/
    );

    assert.match(
      source,
      /sprite\.center\.y\s*=/
    );

    assert.match(
      source,
      /material\.transparent\s*=\s*false/
    );

    assert.match(
      source,
      /material\.depthTest\s*=\s*true/
    );

    assert.match(
      source,
      /material\.depthWrite\s*=\s*true/
    );

    assert.match(
      source,
      /material\.sizeAttenuation\s*=\s*true/
    );

    assert.doesNotMatch(
      source,
      /requestAnimationFrame/
    );

    assert.doesNotMatch(
      source,
      /new\s+THREE\.Raycaster/
    );

    assert.doesNotMatch(
      source,
      /scene\.add\s*\(/
    );

    assert.doesNotMatch(
      source,
      /\.position\.(set|copy|add|lerp|multiplyScalar)\s*\(/
    );

    assert.doesNotMatch(
      source,
      /\.scale\.(set|copy|setScalar|multiplyScalar)\s*\(/
    );

    assert.doesNotMatch(
      source,
      /\.offset\.(set|copy)\s*\(/
    );

    assert.doesNotMatch(
      source,
      /\.repeat\.(set|copy)\s*\(/
    );

    assert.doesNotMatch(
      source,
      /material\.map\s*=/
    );

    assert.doesNotMatch(
      source,
      /\.renderOrder\s*=/
    );

    assert.doesNotMatch(
      source,
      /camera\.(fov|near|far|aspect)\s*=/
    );

    const traversalCount =
      (
        source.match(
          /scene\.traverse\s*\(/g
        ) ??
        []
      ).length;

    assert.equal(
      traversalCount,
      1
    );
  }
);