import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as THREE from "three";

import {
  CLASSROOM_CHARACTER_BODY_CLOTHING_FIDELITY_V44_PROFILE,
  isCharacterBodyAtlasSpriteV44,
  createClassroomCharacterBodyClothingFidelityV44
} from "./classroomCharacterBodyClothingFidelityV44.js";

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
        134;

      this.data[
        index +
        1
      ] =
        105;

      this.data[
        index +
        2
      ] =
        94;

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
        const sourceOffset =
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
      "expected rgb() fillStyle"
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
    return type === "2d"
      ? this.context
      : null;
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

  texture.anisotropy =
    1;

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

function extractLocalRegionBytes({
  data,
  localStartY,
  localEndY
}) {
  const result =
    [];

  const frameWidth =
    64;

  const frameHeight =
    96;

  const directionCount =
    8;

  const frameCount =
    4;

  const atlasWidth =
    512;

  for (
    let animationFrame = 0;
    animationFrame < frameCount;
    animationFrame += 1
  ) {
    const originY =
      animationFrame *
      frameHeight;

    for (
      let directionIndex = 0;
      directionIndex < directionCount;
      directionIndex += 1
    ) {
      const originX =
        directionIndex *
        frameWidth;

      for (
        let y = localStartY;
        y <= localEndY;
        y += 1
      ) {
        for (
          let x = 0;
          x < frameWidth;
          x += 1
        ) {
          const offset =
            (
              (
                originY +
                y
              ) *
              atlasWidth +
              (
                originX +
                x
              )
            ) *
            4;

          result.push(
            data[
              offset
            ],
            data[
              offset +
              1
            ],
            data[
              offset +
              2
            ],
            data[
              offset +
              3
            ]
          );
        }
      }
    }
  }

  return result;
}

test(
  "V44 keeps canonical atlas geometry",
  () => {
    const profile =
      CLASSROOM_CHARACTER_BODY_CLOTHING_FIDELITY_V44_PROFILE;

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

    assert.equal(
      profile.visualOnly,
      true
    );

    assert.equal(
      profile.constructionOnly,
      true
    );
  }
);

test(
  "V44 character discovery excludes environmental sprites",
  () => {
    const fixture =
      createFixture();

    assert.equal(
      isCharacterBodyAtlasSpriteV44(
        fixture.sprite
      ),
      true
    );

    const environmental =
      new THREE.Sprite(
        new THREE.SpriteMaterial({
          map:
            fixture.texture
        })
      );

    environmental.name =
      "cw06-v41-environmental-sprite";

    environmental.userData = {
      cw06EnvironmentalSpriteFidelityV41:
        true
    };

    assert.equal(
      isCharacterBodyAtlasSpriteV44(
        environmental
      ),
      false
    );

    environmental.material.dispose();
    fixture.material.dispose();
    fixture.texture.dispose();
  }
);

test(
  "V44 changes body region but leaves V43 face region untouched",
  () => {
    const fixture =
      createFixture();

    const baseline =
      fixture.canvas.context.data.slice();

    const faceBefore =
      extractLocalRegionBytes({
        data:
          baseline,

        localStartY:
          0,

        localEndY:
          40
      });

    const bodyBefore =
      extractLocalRegionBytes({
        data:
          baseline,

        localStartY:
          42,

        localEndY:
          95
      });

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

    const originalAnisotropy =
      fixture.texture.anisotropy;

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
      createClassroomCharacterBodyClothingFidelityV44({
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
        300
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
      snapshot.addedLights,
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

    assert.equal(
      snapshot.frameSelectionMutationCount,
      0
    );

    assert.equal(
      snapshot.alphaMutationCount,
      0
    );

    const faceAfter =
      extractLocalRegionBytes({
        data:
          fixture.canvas.context.data,

        localStartY:
          0,

        localEndY:
          40
      });

    const bodyAfter =
      extractLocalRegionBytes({
        data:
          fixture.canvas.context.data,

        localStartY:
          42,

        localEndY:
          95
      });

    assert.deepEqual(
      faceAfter,
      faceBefore
    );

    assert.notDeepEqual(
      bodyAfter,
      bodyBefore
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
      fixture.texture.anisotropy,
      originalAnisotropy
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
        baseline
      )
    );

    fixture.material.dispose();
    fixture.texture.dispose();
  }
);

test(
  "V44 source adds no competing runtime authority",
  () => {
    const source =
      fs.readFileSync(
        new URL(
          "./classroomCharacterBodyClothingFidelityV44.js",
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

    assert.match(
      source,
      /paintCharacterBodyFrameV44/
    );

    assert.match(
      source,
      /texture\.needsUpdate\s*=\s*true/
    );

    assert.match(
      source,
      /bodyTop\s*=\s*\n\s*43/
    );
  }
);