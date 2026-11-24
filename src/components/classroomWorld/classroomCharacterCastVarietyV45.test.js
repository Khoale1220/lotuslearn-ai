import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as THREE from "three";

import {
  CLASSROOM_CHARACTER_CAST_VARIETY_V45_PROFILE,
  CAST_VARIANTS_V45,
  deriveCharacterCastVariantV45,
  isCharacterCastSpriteV45,
  createClassroomCharacterCastVarietyV45
} from "./classroomCharacterCastVarietyV45.js";

class FakeCanvasContext {
  constructor(canvas) {
    this.canvas =
      canvas;

    this.data =
      new Uint8ClampedArray(
        canvas.width *
        canvas.height *
        4
      );

    for (
      let y = 0;
      y < canvas.height;
      y += 1
    ) {
      for (
        let x = 0;
        x < canvas.width;
        x += 1
      ) {
        const offset =
          (
            y *
            canvas.width +
            x
          ) *
          4;

        const localY =
          y %
          96;

        let red =
          132;

        let green =
          103;

        let blue =
          91;

        if (
          localY <=
          25
        ) {
          red =
            71;

          green =
            60;

          blue =
            63;
        }
        else if (
          localY <=
          42
        ) {
          red =
            192;

          green =
            146;

          blue =
            116;
        }
        else if (
          localY <=
          73
        ) {
          red =
            102;

          green =
            94;

          blue =
            104;
        }
        else if (
          localY <=
          90
        ) {
          red =
            73;

          green =
            72;

          blue =
            84;
        }
        else {
          red =
            58;

          green =
            60;

          blue =
            68;
        }

        const variation =
          (
            x +
            y
          ) %
          7;

        this.data[
          offset
        ] =
          red +
          variation;

        this.data[
          offset +
          1
        ] =
          green +
          variation;

        this.data[
          offset +
          2
        ] =
          blue +
          variation;

        this.data[
          offset +
          3
        ] =
          255;
      }
    }

    /*
     * Deliberate dark-ink pixel.
     * V45 must preserve it.
     */
    this.data[0] =
      18;

    this.data[1] =
      16;

    this.data[2] =
      23;

    this.data[3] =
      255;
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

  putImageData(
    imageData,
    x,
    y
  ) {
    const width =
      imageData.width;

    const height =
      imageData.height;

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
            row *
            width +
            column
          ) *
          4;

        const targetOffset =
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
          targetOffset
        ] =
          imageData.data[
            sourceOffset
          ];

        this.data[
          targetOffset +
          1
        ] =
          imageData.data[
            sourceOffset +
            1
          ];

        this.data[
          targetOffset +
          2
        ] =
          imageData.data[
            sourceOffset +
            2
          ];

        this.data[
          targetOffset +
          3
        ] =
          imageData.data[
            sourceOffset +
            3
          ];
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

function createFixture(
  studentKey
) {
  const canvas =
    new FakeCanvas();

  const texture =
    new THREE.Texture(
      canvas
    );

  texture.name =
    `cw06-v9-character-atlas-${studentKey}`;

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
    `cw06-v10-student-${studentKey}`;

  sprite.userData = {
    studentKey,

    characterRole:
      "student"
  };

  sprite.layers.set(
    30
  );

  return {
    studentKey,
    canvas,
    texture,
    material,
    sprite
  };
}

function alphaBytes(data) {
  const result =
    new Uint8Array(
      data.length /
      4
    );

  let targetIndex =
    0;

  for (
    let sourceIndex = 3;
    sourceIndex < data.length;
    sourceIndex += 4
  ) {
    result[
      targetIndex
    ] =
      data[
        sourceIndex
      ];

    targetIndex +=
      1;
  }

  return result;
}

test(
  "V45 keeps canonical character geometry and atlas contract",
  () => {
    const profile =
      CLASSROOM_CHARACTER_CAST_VARIETY_V45_PROFILE;

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
      profile.castVariantCount,
      8
    );

    assert.equal(
      CAST_VARIANTS_V45.length,
      8
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
  }
);

test(
  "V45 cast derivation is deterministic and meaningfully varied",
  () => {
    const first =
      deriveCharacterCastVariantV45(
        "student-017"
      );

    const second =
      deriveCharacterCastVariantV45(
        "student-017"
      );

    assert.equal(
      first.id,
      second.id
    );

    assert.equal(
      first.index,
      second.index
    );

    assert.equal(
      first.seed,
      second.seed
    );

    const variants =
      new Set();

    for (
      let index = 0;
      index < 64;
      index += 1
    ) {
      const result =
        deriveCharacterCastVariantV45(
          `student-${index}`
        );

      assert.ok(
        result.index >= 0
      );

      assert.ok(
        result.index <
          CAST_VARIANTS_V45.length
      );

      variants.add(
        result.id
      );
    }

    assert.ok(
      variants.size >=
        6,
      `expected >= 6 cast variants, got ${variants.size}`
    );
  }
);

test(
  "V45 character discovery excludes environmental sprites",
  () => {
    const fixture =
      createFixture(
        "student-01"
      );

    assert.equal(
      isCharacterCastSpriteV45(
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
      isCharacterCastSpriteV45(
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
  "V45 creates deterministic cast variety without geometry UV alpha or material-color mutation",
  () => {
    const scene =
      new THREE.Scene();

    const fixtures =
      [];

    for (
      let index = 0;
      index < 16;
      index += 1
    ) {
      const fixture =
        createFixture(
          `student-${index}`
        );

      fixtures.push(
        fixture
      );

      scene.add(
        fixture.sprite
      );
    }

    const baselines =
      new Map();

    const alphaBaselines =
      new Map();

    const transformBaselines =
      new Map();

    const textureBaselines =
      new Map();

    for (
      const fixture
      of fixtures
    ) {
      baselines.set(
        fixture.studentKey,
        fixture.canvas.context.data.slice()
      );

      alphaBaselines.set(
        fixture.studentKey,
        alphaBytes(
          fixture.canvas.context.data
        )
      );

      transformBaselines.set(
        fixture.studentKey,
        {
          position:
            fixture.sprite.position.clone(),

          scale:
            fixture.sprite.scale.clone(),

          offset:
            fixture.texture.offset.clone(),

          repeat:
            fixture.texture.repeat.clone(),

          color:
            fixture.material.color.clone()
        }
      );

      textureBaselines.set(
        fixture.studentKey,
        {
          magFilter:
            fixture.texture.magFilter,

          minFilter:
            fixture.texture.minFilter,

          generateMipmaps:
            fixture.texture.generateMipmaps,

          anisotropy:
            fixture.texture.anisotropy,

          colorSpace:
            fixture.texture.colorSpace
        }
      );
    }

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
      createClassroomCharacterCastVarietyV45({
        scene
      });

    assert.equal(
      traversalCount,
      1
    );

    const snapshot =
      system.getSnapshot();

    assert.equal(
      snapshot.atlasCount,
      16
    );

    assert.equal(
      snapshot.studentTextureGroupCount,
      16
    );

    assert.equal(
      snapshot.sharedTextureGroupCount,
      0
    );

    assert.ok(
      snapshot.distinctVariantCount >=
        6
    );

    assert.equal(
      snapshot.castSignatures.length,
      16
    );

    assert.ok(
      snapshot.modifiedPixelCount >
        10000
    );

    assert.ok(
      snapshot.hairPixelCount >
        0
    );

    assert.ok(
      snapshot.complexionPixelCount >
        0
    );

    assert.ok(
      snapshot.upperClothingPixelCount >
        0
    );

    assert.ok(
      snapshot.lowerClothingPixelCount >
        0
    );

    assert.ok(
      snapshot.accentPixelCount >
        0
    );

    assert.ok(
      snapshot.shoePixelCount >
        0
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
      snapshot.alphaMutationCount,
      0
    );

    assert.equal(
      snapshot.materialColorMutationCount,
      0
    );

    let changedFixtureCount =
      0;

    for (
      const fixture
      of fixtures
    ) {
      const baseline =
        baselines.get(
          fixture.studentKey
        );

      if (
        Buffer.compare(
          Buffer.from(
            baseline
          ),
          Buffer.from(
            fixture.canvas.context.data
          )
        ) !==
        0
      ) {
        changedFixtureCount +=
          1;
      }

      assert.deepEqual(
        alphaBytes(
          fixture.canvas.context.data
        ),
        alphaBaselines.get(
          fixture.studentKey
        )
      );

      /*
       * The deliberately dark first pixel must
       * remain the canonical VGA ink value.
       */
      assert.equal(
        fixture.canvas.context.data[0],
        18
      );

      assert.equal(
        fixture.canvas.context.data[1],
        16
      );

      assert.equal(
        fixture.canvas.context.data[2],
        23
      );

      const transforms =
        transformBaselines.get(
          fixture.studentKey
        );

      assert.deepEqual(
        fixture.sprite.position.toArray(),
        transforms.position.toArray()
      );

      assert.deepEqual(
        fixture.sprite.scale.toArray(),
        transforms.scale.toArray()
      );

      assert.deepEqual(
        fixture.texture.offset.toArray(),
        transforms.offset.toArray()
      );

      assert.deepEqual(
        fixture.texture.repeat.toArray(),
        transforms.repeat.toArray()
      );

      assert.deepEqual(
        fixture.material.color.toArray(),
        transforms.color.toArray()
      );

      const textureState =
        textureBaselines.get(
          fixture.studentKey
        );

      assert.equal(
        fixture.texture.magFilter,
        textureState.magFilter
      );

      assert.equal(
        fixture.texture.minFilter,
        textureState.minFilter
      );

      assert.equal(
        fixture.texture.generateMipmaps,
        textureState.generateMipmaps
      );

      assert.equal(
        fixture.texture.anisotropy,
        textureState.anisotropy
      );

      assert.equal(
        fixture.texture.colorSpace,
        textureState.colorSpace
      );
    }

    assert.equal(
      changedFixtureCount,
      fixtures.length
    );

    system.dispose();

    for (
      const fixture
      of fixtures
    ) {
      assert.deepEqual(
        fixture.canvas.context.data,
        baselines.get(
          fixture.studentKey
        )
      );

      fixture.material.dispose();
      fixture.texture.dispose();
    }
  }
);

test(
  "V45 source adds no competing runtime character authority",
  () => {
    const source =
      fs.readFileSync(
        new URL(
          "./classroomCharacterCastVarietyV45.js",
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
      /material\.color\.(set|copy|multiply|lerp)\s*\(/
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
      /deriveCharacterCastVariantV45/
    );

    assert.match(
      source,
      /texture\.needsUpdate\s*=\s*true/
    );

    assert.match(
      source,
      /context\.putImageData/
    );

    assert.match(
      source,
      /luminance\s*<\s*\n\s*38/
    );
  }
);