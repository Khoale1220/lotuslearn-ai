import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import {
  CLASSROOM_ENVIRONMENTAL_SPRITE_FIDELITY_V41_PROFILE,
  createClassroomEnvironmentalSpriteFidelityV41
} from "./classroomEnvironmentalSpriteFidelityV41.js";

function createTestCharacterSprite() {
  const data =
    new Uint8Array([
      255, 255, 255, 255,
      255, 255, 255, 255,
      255, 255, 255, 255,
      255, 255, 255, 255
    ]);

  const texture =
    new THREE.DataTexture(
      data,
      2,
      2,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    );

  texture.magFilter =
    THREE.LinearFilter;

  texture.minFilter =
    THREE.LinearFilter;

  texture.generateMipmaps =
    true;

  texture.colorSpace =
    THREE.NoColorSpace;

  texture.anisotropy =
    4;

  texture.needsUpdate =
    true;

  const material =
    new THREE.SpriteMaterial({
      map: texture
    });

  material.alphaTest =
    0;

  const sprite =
    new THREE.Sprite(
      material
    );

  sprite.name =
    "classroom-character-student-v9-test";

  sprite.userData = {
    visualRole:
      "student-character",
    cw06CharacterSpriteV9:
      true
  };

  sprite.position.set(
    1,
    2,
    3
  );

  sprite.scale.set(
    1.2,
    1.8,
    1
  );

  return {
    sprite,
    material,
    texture
  };
}

test(
  "V41 profile is deterministic and bounded",
  () => {
    assert.equal(
      CLASSROOM_ENVIRONMENTAL_SPRITE_FIDELITY_V41_PROFILE
        .version,
      41
    );

    assert.equal(
      CLASSROOM_ENVIRONMENTAL_SPRITE_FIDELITY_V41_PROFILE
        .deterministic,
      true
    );

    assert.equal(
      CLASSROOM_ENVIRONMENTAL_SPRITE_FIDELITY_V41_PROFILE
        .constructionSceneTraversalCount,
      1
    );

    assert.equal(
      CLASSROOM_ENVIRONMENTAL_SPRITE_FIDELITY_V41_PROFILE
        .runtimeSceneTraversalCount,
      0
    );

    assert.equal(
      CLASSROOM_ENVIRONMENTAL_SPRITE_FIDELITY_V41_PROFILE
        .accentSpriteCount,
      4
    );
  }
);

test(
  "V41 upgrades existing character sprite sampling without replacing authority",
  () => {
    const scene =
      new THREE.Scene();

    const camera =
      new THREE.PerspectiveCamera(
        70,
        16 / 9,
        0.1,
        100
      );

    camera.position.set(
      0,
      1.65,
      6
    );

    camera.lookAt(
      0,
      1.65,
      0
    );

    camera.updateMatrixWorld(
      true
    );

    const fixture =
      createTestCharacterSprite();

    scene.add(
      fixture.sprite
    );

    const initialPosition =
      fixture.sprite
        .position
        .clone();

    const initialScale =
      fixture.sprite
        .scale
        .clone();

    const system =
      createClassroomEnvironmentalSpriteFidelityV41({
        scene,
        camera
      });

    const snapshot =
      system.getSnapshot();

    assert.equal(
      snapshot.polishedSpriteCount,
      1
    );

    assert.equal(
      snapshot.accentSpriteCount,
      4
    );

    assert.equal(
      fixture.texture.magFilter,
      THREE.NearestFilter
    );

    assert.equal(
      fixture.texture.minFilter,
      THREE.NearestFilter
    );

    assert.equal(
      fixture.texture.generateMipmaps,
      false
    );

    assert.equal(
      fixture.texture.colorSpace,
      THREE.SRGBColorSpace
    );

    assert.equal(
      fixture.texture.anisotropy,
      1
    );

    assert.ok(
      fixture.material.alphaTest >=
        0.35
    );

    assert.deepEqual(
      fixture.sprite.position
        .toArray(),
      initialPosition.toArray()
    );

    assert.deepEqual(
      fixture.sprite.scale
        .toArray(),
      initialScale.toArray()
    );

    system.dispose();

    fixture.material.dispose();
    fixture.texture.dispose();
  }
);

test(
  "V41 tick uses owned accents only and performs no runtime scene traversal",
  () => {
    const scene =
      new THREE.Scene();

    const camera =
      new THREE.PerspectiveCamera(
        70,
        16 / 9,
        0.1,
        100
      );

    camera.position.set(
      0,
      1.65,
      6
    );

    camera.lookAt(
      0,
      1.65,
      0
    );

    camera.updateMatrixWorld(
      true
    );

    const system =
      createClassroomEnvironmentalSpriteFidelityV41({
        scene,
        camera
      });

    const before =
      system.getSnapshot();

    scene.traverse =
      () => {
        throw new Error(
          "runtime scene traversal is forbidden"
        );
      };

    system.tick({
      timestamp: 1250,
      deltaSeconds: 1 / 60
    });

    const after =
      system.getSnapshot();

    assert.equal(
      after.runtimeSceneTraversalCount,
      0
    );

    assert.equal(
      after.accentSpriteCount,
      4
    );

    assert.notDeepEqual(
      after.accents,
      before.accents
    );

    system.dispose();
  }
);

test(
  "V41 disposal restores pre-existing sprite texture and material settings",
  () => {
    const scene =
      new THREE.Scene();

    const camera =
      new THREE.PerspectiveCamera(
        70,
        16 / 9,
        0.1,
        100
      );

    camera.position.set(
      0,
      1.65,
      6
    );

    camera.lookAt(
      0,
      1.65,
      0
    );

    camera.updateMatrixWorld(
      true
    );

    const fixture =
      createTestCharacterSprite();

    scene.add(
      fixture.sprite
    );

    const original = {
      magFilter:
        fixture.texture.magFilter,
      minFilter:
        fixture.texture.minFilter,
      generateMipmaps:
        fixture.texture.generateMipmaps,
      colorSpace:
        fixture.texture.colorSpace,
      anisotropy:
        fixture.texture.anisotropy,
      alphaTest:
        fixture.material.alphaTest
    };

    const system =
      createClassroomEnvironmentalSpriteFidelityV41({
        scene,
        camera
      });

    system.dispose();

    assert.equal(
      fixture.texture.magFilter,
      original.magFilter
    );

    assert.equal(
      fixture.texture.minFilter,
      original.minFilter
    );

    assert.equal(
      fixture.texture.generateMipmaps,
      original.generateMipmaps
    );

    assert.equal(
      fixture.texture.colorSpace,
      original.colorSpace
    );

    assert.equal(
      fixture.texture.anisotropy,
      original.anisotropy
    );

    assert.equal(
      fixture.material.alphaTest,
      original.alphaTest
    );

    fixture.material.dispose();
    fixture.texture.dispose();
  }
);

test(
  "V41 adds no lights, shadow maps, raycast or locomotion authority",
  () => {
    const scene =
      new THREE.Scene();

    const camera =
      new THREE.PerspectiveCamera(
        70,
        16 / 9,
        0.1,
        100
      );

    camera.position.set(
      0,
      1.65,
      6
    );

    camera.lookAt(
      0,
      1.65,
      0
    );

    camera.updateMatrixWorld(
      true
    );

    const system =
      createClassroomEnvironmentalSpriteFidelityV41({
        scene,
        camera
      });

    const snapshot =
      system.getSnapshot();

    assert.equal(
      snapshot.addedLights,
      0
    );

    assert.equal(
      snapshot.addedShadowMaps,
      0
    );

    system.dispose();
  }
);
