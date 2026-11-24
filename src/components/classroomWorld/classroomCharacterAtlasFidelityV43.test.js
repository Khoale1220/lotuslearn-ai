import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as THREE from "three";

import {
  CLASSROOM_CHARACTER_ATLAS_FIDELITY_V43_PROFILE,
  isCharacterAtlasSpriteV43,
  createClassroomCharacterAtlasFidelityV43
} from "./classroomCharacterAtlasFidelityV43.js";

class FakeCanvasContext {
  constructor(canvas) {
    this.canvas =
      canvas;

    this.fillStyle =
      "rgb(0, 0, 0)";

    this.data =
      new Uint8ClampedArray(
        canvas.width *
        canvas.height *
        4
      );

    for (
      let index = 0;
      index < this.data.length;
      index += 4
    ) {
      this.data[
        index
      ] =
        150;

      this.data[
        index +
        1
      ] =
        105;

      this.data[
        index +
        2
      ] =
        82;

      this.data[
        index +
        3
      ] =
        255;
    }
  }

  getImageData(
    x,
    y,
    width,
    height
  ) {
    const result =
      new Uint8ClampedArray(
        width *
        height *
        4
      );

    for (
      let row = 0;
      row < height;
      row += 1
    ) {
      for (
        let column = 0;
        column < width;
        column += 1
      ) {
        const sourceX =
          x +
          column;

        const sourceY =
          y +
          row;

        const sourceOffset =
          (
            sourceY *
            this.canvas.width +
            sourceX
          ) *
          4;

        const targetOffset =
          (
            row *
            width +
            column
          ) *
          4;

        result[
          targetOffset
        ] =
          this.data[
            sourceOffset
          ];

        result[
          targetOffset +
          1
        ] =
          this.data[
            sourceOffset +
            1
          ];

        result[
          targetOffset +
          2
        ] =
          this.data[
            sourceOffset +
            2
          ];

        result[
          targetOffset +
          3
        ] =
          this.data[
            sourceOffset +
            3
          ];
      }
    }

    return {
      data:
        result,
      width,
      height
    };
  }

  fillRect(
    x,
    y,
    width,
    height
  ) {
    const match =
      /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(
        String(
          this.fillStyle
        )
      );

    assert.ok(
      match,
      "fake context expected rgb() fillStyle"
    );

    const rgb = [
      Number(
        match[1]
      ),
      Number(
        match[2]
      ),
      Number(
        match[3]
      )
    ];

    for (
      let row = 0;
      row < height;
      row += 1
    ) {
      for (
        let column = 0;
        column < width;
        column += 1
      ) {
        const offset =
          (
            (
              y +
              row
            ) *
            this.canvas.width +
            (
              x +
              column
            )
          ) *
          4;

        this.data[
          offset
        ] =
          rgb[0];

        this.data[
          offset +
          1
        ] =
          rgb[1];

        this.data[
          offset +
          2
        ] =
          rgb[2];

        this.data[
          offset +
          3
        ] =
          255;
      }
    }
  }
}

class FakeCanvas {
  constructor() {
    this.width =
      512;

    this.height =
      384;

    this.context =
      new FakeCanvasContext(
        this
      );
  }

  getContext(type) {
    if (type !== "2d") {
      return null;
    }

    return this.context;
  }
}

function createFixture() {
  const canvas =
    new FakeCanvas();

  const texture =
    new THREE.Texture(
      canvas
    );

  texture.name =
    "cw06-v9-character-atlas";

  texture.colorSpace =
    THREE.SRGBColorSpace;

  texture.magFilter =
    THREE.NearestFilter;

  texture.minFilter =
    THREE.NearestFilter;

  texture.generateMipmaps =
    false;

  const material =
    new THREE.SpriteMaterial({
      map:
        texture,

      color:
        0xffffff,

      alphaTest:
        0.5
    });

  const sprite =
    new THREE.Sprite(
      material
    );

  sprite.name =
    "cw06-v10-student-character";

  sprite.userData = {
    studentKey:
      "student-01",

    characterRole:
      "student"
  };

  sprite.layers.set(
    30
  );

  const scene =
    new THREE.Scene();

  scene.add(
    sprite
  );

  return {
    scene,
    canvas,
    texture,
    material,
    sprite
  };
}

test(
  "V43 profile preserves canonical V9 atlas geometry",
  () => {
    const profile =
      CLASSROOM_CHARACTER_ATLAS_FIDELITY_V43_PROFILE;

    assert.equal(
      profile.frameWidth,
      64
    );

    assert.equal(
      profile.frameHeight,
      96
    );

    assert.equal(
      profile.directionCount,
      8
    );

    assert.equal(
      profile.idleFrameCount,
      4
    );

    assert.equal(
      profile.atlasWidth,
      512
    );

    assert.equal(
      profile.atlasHeight,
      384
    );

    assert.equal(
      profile.atlasFrameCount,
      32
    );
  }
);

test(
  "V43 discovers canonical character sprite and excludes atmosphere sprite",
  () => {
    const fixture =
      createFixture();

    assert.equal(
      isCharacterAtlasSpriteV43(
        fixture.sprite
      ),
      true
    );

    const atmosphere =
      new THREE.Sprite(
        new THREE.SpriteMaterial({
          map:
            fixture.texture
        })
      );

    atmosphere.name =
      "cw06-v41-environmental-sprite";

    atmosphere.userData = {
      cw06EnvironmentalSpriteFidelityV41:
        true,

      visualOnly:
        true
    };

    assert.equal(
      isCharacterAtlasSpriteV43(
        atmosphere
      ),
      false
    );

    atmosphere.material.dispose();
    fixture.material.dispose();
    fixture.texture.dispose();
  }
);

test(
  "V43 polishes all 32 frames without changing texture policy or transform",
  () => {
    const fixture =
      createFixture();

    const baselinePixels =
      fixture.canvas.context.data.slice();

    const originalPosition =
      fixture.sprite.position.clone();

    const originalScale =
      fixture.sprite.scale.clone();

    const originalOffset =
      fixture.texture.offset.clone();

    const originalRepeat =
      fixture.texture.repeat.clone();

    const originalMag =
      fixture.texture.magFilter;

    const originalMin =
      fixture.texture.minFilter;

    const originalMipmaps =
      fixture.texture.generateMipmaps;

    const originalColorSpace =
      fixture.texture.colorSpace;

    let traversalCount =
      0;

    const realTraverse =
      fixture.scene.traverse.bind(
        fixture.scene
      );

    fixture.scene.traverse =
      (callback) => {
        traversalCount +=
          1;

        return realTraverse(
          callback
        );
      };

    const system =
      createClassroomCharacterAtlasFidelityV43({
        scene:
          fixture.scene
      });

    assert.equal(
      traversalCount,
      1
    );

    const snapshot =
      system.getSnapshot();

    assert.equal(
      snapshot.atlasCount,
      1
    );

    assert.equal(
      snapshot.polishedFrameCount,
      32
    );

    assert.ok(
      snapshot.paintedPixelCount >
        100
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
      snapshot.uvMutationCount,
      0
    );

    assert.notDeepEqual(
      Array.from(
        fixture.canvas.context.data
      ),
      Array.from(
        baselinePixels
      )
    );

    assert.deepEqual(
      fixture.sprite.position.toArray(),
      originalPosition.toArray()
    );

    assert.deepEqual(
      fixture.sprite.scale.toArray(),
      originalScale.toArray()
    );

    assert.deepEqual(
      fixture.texture.offset.toArray(),
      originalOffset.toArray()
    );

    assert.deepEqual(
      fixture.texture.repeat.toArray(),
      originalRepeat.toArray()
    );

    assert.equal(
      fixture.texture.magFilter,
      originalMag
    );

    assert.equal(
      fixture.texture.minFilter,
      originalMin
    );

    assert.equal(
      fixture.texture.generateMipmaps,
      originalMipmaps
    );

    assert.equal(
      fixture.texture.colorSpace,
      originalColorSpace
    );

    system.dispose();

    assert.deepEqual(
      Array.from(
        fixture.canvas.context.data
      ),
      Array.from(
        baselinePixels
      )
    );

    fixture.material.dispose();
    fixture.texture.dispose();
  }
);

test(
  "V43 adds no runtime engine authority",
  () => {
    const source =
      fs.readFileSync(
        new URL(
          "./classroomCharacterAtlasFidelityV43.js",
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
      /scene\.add\s*\(/
    );

    const traversalCalls =
      (
        source.match(
          /scene\.traverse\s*\(/g
        ) ??
        []
      ).length;

    assert.equal(
      traversalCalls,
      1
    );

    assert.match(
      source,
      /paintReferencePortraitFrameV43/
    );

    assert.match(
      source,
      /texture\.needsUpdate\s*=\s*true/
    );
  }
);