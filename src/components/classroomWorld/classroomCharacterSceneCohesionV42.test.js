import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as THREE from "three";

import {
  CLASSROOM_CHARACTER_SCENE_COHESION_V42_PROFILE,
  createClassroomCharacterSceneCohesionV42,
  isCharacterSprite
} from "./classroomCharacterSceneCohesionV42.js";

function createPixelMap() {
  const pixels =
    new Uint8Array([
      255,
      255,
      255,
      255
    ]);

  const texture =
    new THREE.DataTexture(
      pixels,
      1,
      1,
      THREE.RGBAFormat
    );

  texture.name =
    "cw06-v9-test-atlas";

  texture.colorSpace =
    THREE.SRGBColorSpace;

  texture.magFilter =
    THREE.NearestFilter;

  texture.minFilter =
    THREE.NearestFilter;

  texture.generateMipmaps =
    false;

  texture.offset.set(
    0.25,
    0.5
  );

  texture.repeat.set(
    0.125,
    0.25
  );

  texture.needsUpdate =
    true;

  return texture;
}

function createCharacterSprite({
  studentKey = "student-01",
  x = 1,
  y = 1.5,
  z = 2
} = {}) {
  const map =
    createPixelMap();

  const material =
    new THREE.SpriteMaterial({
      map,
      color:
        0xffffff,
      alphaTest:
        0.5
    });

  material.name =
    "cw06-v9-character-material";

  const sprite =
    new THREE.Sprite(
      material
    );

  sprite.name =
    "cw06-v10-student-character";

  sprite.userData = {
    studentKey,
    characterRole:
      "student"
  };

  sprite.layers.set(
    30
  );

  sprite.position.set(
    x,
    y,
    z
  );

  sprite.scale.set(
    1.12,
    1.12,
    1
  );

  return {
    sprite,
    material,
    map
  };
}

test(
  "V42 profile remains visual-only and authority-neutral",
  () => {
    assert.equal(
      CLASSROOM_CHARACTER_SCENE_COHESION_V42_PROFILE
        .visualOnly,
      true
    );

    assert.equal(
      CLASSROOM_CHARACTER_SCENE_COHESION_V42_PROFILE
        .addedDrawCalls,
      0
    );

    assert.equal(
      CLASSROOM_CHARACTER_SCENE_COHESION_V42_PROFILE
        .addedLights,
      0
    );

    assert.equal(
      CLASSROOM_CHARACTER_SCENE_COHESION_V42_PROFILE
        .scaleMutationCount,
      0
    );

    assert.equal(
      CLASSROOM_CHARACTER_SCENE_COHESION_V42_PROFILE
        .atlasFrameMutationCount,
      0
    );
  }
);

test(
  "V42 classifies student sprite but excludes environmental sprite",
  () => {
    const character =
      createCharacterSprite();

    assert.equal(
      isCharacterSprite(
        character.sprite
      ),
      true
    );

    const environmentalMaterial =
      new THREE.SpriteMaterial({
        color:
          0xffffff
      });

    const environmentalSprite =
      new THREE.Sprite(
        environmentalMaterial
      );

    environmentalSprite.name =
      "cw06-v18-seagull-0";

    environmentalSprite.userData = {
      cw06SeagullV18:
        true,
      visualOnly:
        true
    };

    assert.equal(
      isCharacterSprite(
        environmentalSprite
      ),
      false
    );

    character.material.dispose();
    character.map.dispose();
    environmentalMaterial.dispose();
  }
);

test(
  "V42 clones only character material and preserves scale position and atlas frame",
  () => {
    const scene =
      new THREE.Scene();

    const character =
      createCharacterSprite({
        x: 2,
        y: 1.6,
        z: 3
      });

    scene.add(
      character.sprite
    );

    const originalScale =
      character.sprite.scale.clone();

    const originalPosition =
      character.sprite.position.clone();

    const originalOffset =
      character.map.offset.clone();

    const originalRepeat =
      character.map.repeat.clone();

    const originalMaterial =
      character.sprite.material;

    let traversalCount =
      0;

    const originalTraverse =
      scene.traverse.bind(scene);

    scene.traverse =
      (callback) => {
        traversalCount +=
          1;

        return originalTraverse(
          callback
        );
      };

    const system =
      createClassroomCharacterSceneCohesionV42({
        scene
      });

    assert.equal(
      traversalCount,
      1
    );

    assert.notEqual(
      character.sprite.material,
      originalMaterial
    );

    assert.equal(
      character.sprite.material.map,
      character.map
    );

    system.tick({
      timestamp:
        1000
    });

    system.tick({
      timestamp:
        2000
    });

    assert.equal(
      traversalCount,
      1
    );

    assert.deepEqual(
      character.sprite.scale.toArray(),
      originalScale.toArray()
    );

    assert.deepEqual(
      character.sprite.position.toArray(),
      originalPosition.toArray()
    );

    assert.deepEqual(
      character.map.offset.toArray(),
      originalOffset.toArray()
    );

    assert.deepEqual(
      character.map.repeat.toArray(),
      originalRepeat.toArray()
    );

    const snapshot =
      system.getSnapshot();

    assert.equal(
      snapshot.characterSpriteCount,
      1
    );

    assert.equal(
      snapshot.materialCloneCount,
      1
    );

    assert.equal(
      snapshot.constructionSceneTraversalCount,
      1
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
      snapshot.scaleMutationCount,
      0
    );

    assert.equal(
      snapshot.positionMutationCount,
      0
    );

    assert.equal(
      snapshot.atlasFrameMutationCount,
      0
    );

    system.dispose();

    assert.equal(
      character.sprite.material,
      originalMaterial
    );

    character.material.dispose();
    character.map.dispose();
  }
);

test(
  "V42 source contains no competing authority",
  () => {
    const source =
      fs.readFileSync(
        new URL(
          "./classroomCharacterSceneCohesionV42.js",
          import.meta.url
        ),
        "utf8"
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
      /new\s+THREE\.(DirectionalLight|PointLight|SpotLight|HemisphereLight|AmbientLight)/
    );

    assert.doesNotMatch(
      source,
      /\.scale\.(set|setScalar|copy|multiplyScalar)\s*\(/
    );

    assert.doesNotMatch(
      source,
      /\.position\.(set|copy|add|lerp|multiplyScalar)\s*\(/
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
      /scene\.add\s*\(/
    );

    assert.match(
      source,
      /originalMaterial\.clone\(\)/
    );

    assert.match(
      source,
      /material\.color/
    );

    const traverseCalls =
      (
        source.match(
          /scene\.traverse\s*\(/g
        ) ??
        []
      ).length;

    assert.equal(
      traverseCalls,
      1
    );
  }
);