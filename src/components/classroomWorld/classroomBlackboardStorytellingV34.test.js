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
  CLASSROOM_BLACKBOARD_STORYTELLING_V34_PROFILE,
  PIXEL_FONT_V34,
  createClassroomBlackboardStorytellingV34,
  drawPixelTextV34,
  findBlackboardCandidateV34,
  paintBlackboardTeachingStoryV34,
  scoreBlackboardCandidateV34
} from "./classroomBlackboardStorytellingV34.js";

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

function createPixelTexture({
  width = 128,
  height = 64
} = {}) {
  const data =
    new Uint8Array(
      width *
      height *
      4
    );

  for (
    let index = 0;
    index <
      width *
      height;
    index += 1
  ) {
    const offset =
      index *
      4;

    data[
      offset
    ] =
      27;

    data[
      offset + 1
    ] =
      58;

    data[
      offset + 2
    ] =
      49;

    data[
      offset + 3
    ] =
      255;
  }

  const texture =
    new THREE.DataTexture(
      data,
      width,
      height,
      THREE.RGBAFormat
    );

  texture.magFilter =
    THREE.NearestFilter;

  texture.minFilter =
    THREE.NearestFilter;

  texture.generateMipmaps =
    false;

  texture.colorSpace =
    THREE.SRGBColorSpace;

  texture.needsUpdate =
    true;

  return texture;
}

function createBoard() {
  const texture =
    createPixelTexture();

  const geometry =
    new THREE.PlaneGeometry(
      5.8,
      2.3
    );

  const material =
    new THREE.MeshBasicMaterial({
      map:
        texture,

      toneMapped:
        false
    });

  const board =
    new THREE.Mesh(
      geometry,
      material
    );

  board.name =
    "retro-chalkboard-art";

  board.position.set(
    0,
    2.6,
    -7.8
  );

  board.userData = {
    visualOnly:
      true,

    role:
      "chalkboard-art"
  };

  return {
    board,
    texture,
    geometry,
    material
  };
}

test(
  "V34 profile has zero new rendering resources",
  () => {
    const profile =
      CLASSROOM_BLACKBOARD_STORYTELLING_V34_PROFILE;

    assert.equal(
      profile.addedMeshes,
      0
    );

    assert.equal(
      profile.addedMaterials,
      0
    );

    assert.equal(
      profile.addedTextures,
      0
    );

    assert.equal(
      profile.addedDrawCalls,
      0
    );

    assert.equal(
      profile.textureMutationCount,
      1
    );

    assert.equal(
      profile.constructionSceneTraversalCount,
      1
    );

    assert.equal(
      profile.runtimeSceneTraversal,
      false
    );

    assert.equal(
      profile.runtimeTick,
      false
    );

    assert.equal(
      profile.runtimeTexturePainting,
      false
    );
  }
);

test(
  "V34 pixel font contains required lesson glyphs",
  () => {
    for (
      const character
      of [
        "A",
        "C",
        "D",
        "E",
        "H",
        "I",
        "L",
        "M",
        "N",
        "O",
        "P",
        "R",
        "T",
        "V",
        "W",
        "Y",
        "2",
        "4",
        "1",
        "+",
        "/"
      ]
    ) {
      assert.ok(
        PIXEL_FONT_V34[
          character
        ]
      );
    }
  }
);

test(
  "V34 direct pixel text renderer is deterministic",
  () => {
    const first =
      new Uint8Array(
        128 *
        64 *
        4
      );

    const second =
      new Uint8Array(
        128 *
        64 *
        4
      );

    drawPixelTextV34({
      data:
        first,

      width:
        128,

      height:
        64,

      text:
        "READ + THINK",

      x:
        5,

      y:
        5,

      color:
        [
          220,
          210,
          180
        ]
    });

    drawPixelTextV34({
      data:
        second,

      width:
        128,

      height:
        64,

      text:
        "READ + THINK",

      x:
        5,

      y:
        5,

      color:
        [
          220,
          210,
          180
        ]
    });

    assert.deepEqual(
      first,
      second
    );

    assert.ok(
      first.some(
        (value) =>
          value !== 0
      )
    );
  }
);

test(
  "V34 blackboard scoring strongly prefers canonical chalkboard",
  () => {
    const {
      board,
      texture,
      geometry,
      material
    } =
      createBoard();

    const floorTexture =
      createPixelTexture({
        width:
          64,

        height:
          64
      });

    const floorGeometry =
      new THREE.PlaneGeometry(
        16,
        18
      );

    const floorMaterial =
      new THREE.MeshBasicMaterial({
        map:
          floorTexture
      });

    const floor =
      new THREE.Mesh(
        floorGeometry,
        floorMaterial
      );

    floor.name =
      "classroom-floor";

    floor.position.set(
      0,
      0,
      -1
    );

    assert.ok(
      scoreBlackboardCandidateV34(
        board
      ) >
      scoreBlackboardCandidateV34(
        floor
      )
    );

    geometry.dispose();
    material.dispose();
    texture.dispose();

    floorGeometry.dispose();
    floorMaterial.dispose();
    floorTexture.dispose();
  }
);

test(
  "V34 discovers board with one scene traversal contract",
  () => {
    const {
      board,
      texture,
      geometry,
      material
    } =
      createBoard();

    const scene =
      new THREE.Scene();

    scene.add(
      board
    );

    const discovery =
      findBlackboardCandidateV34(
        scene
      );

    assert.equal(
      discovery.board,
      board
    );

    assert.ok(
      discovery.score >=
        8
    );

    assert.ok(
      discovery.candidateCount >=
        1
    );

    geometry.dispose();
    material.dispose();
    texture.dispose();
  }
);

test(
  "V34 paints real teaching hierarchy into board pixels",
  () => {
    const width =
      128;

    const height =
      64;

    const data =
      new Uint8Array(
        width *
        height *
        4
      );

    const before =
      new Uint8Array(
        data
      );

    const result =
      paintBlackboardTeachingStoryV34({
        data,
        width,
        height
      });

    assert.ok(
      result.pixelWriteCount >
        100
    );

    assert.notDeepEqual(
      data,
      before
    );

    assert.equal(
      result.contentFragments.includes(
        "CLAIM"
      ),
      true
    );

    assert.equal(
      result.contentFragments.includes(
        "EVIDENCE"
      ),
      true
    );

    assert.equal(
      result.contentFragments.includes(
        "HW"
      ),
      true
    );
  }
);

test(
  "V34 mutates existing board DataTexture and restores it on dispose",
  () => {
    const {
      board,
      texture,
      geometry,
      material
    } =
      createBoard();

    const originalPixels =
      new Uint8Array(
        texture.image.data
      );

    const originalMag =
      texture.magFilter;

    const originalMin =
      texture.minFilter;

    const originalMipmaps =
      texture.generateMipmaps;

    const originalColorSpace =
      texture.colorSpace;

    const originalAnisotropy =
      texture.anisotropy;

    const initialVersion =
      texture.version;

    const scene =
      new THREE.Scene();

    scene.add(
      board
    );

    const runtime =
      createClassroomBlackboardStorytellingV34({
        scene
      });

    const snapshot =
      runtime.getSnapshot();

    assert.equal(
      snapshot.boardFound,
      true
    );

    assert.equal(
      snapshot.boardTextureWidth,
      128
    );

    assert.equal(
      snapshot.boardTextureHeight,
      64
    );

    assert.ok(
      snapshot.pixelWriteCount >
        100
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
      snapshot.addedTextures,
      0
    );

    assert.equal(
      snapshot.addedDrawCalls,
      0
    );

    assert.equal(
      snapshot.textureMagFilterPreserved,
      true
    );

    assert.equal(
      snapshot.textureMinFilterPreserved,
      true
    );

    assert.equal(
      snapshot.textureMipmapsPreserved,
      true
    );

    assert.equal(
      snapshot.textureColorSpacePreserved,
      true
    );

    assert.equal(
      snapshot.textureAnisotropyPreserved,
      true
    );

    assert.ok(
      texture.version >
        initialVersion
    );

    assert.notDeepEqual(
      texture.image.data,
      originalPixels
    );

    assert.equal(
      texture.magFilter,
      originalMag
    );

    assert.equal(
      texture.minFilter,
      originalMin
    );

    assert.equal(
      texture.generateMipmaps,
      originalMipmaps
    );

    assert.equal(
      texture.colorSpace,
      originalColorSpace
    );

    assert.equal(
      texture.anisotropy,
      originalAnisotropy
    );

    const versionBeforeDispose =
      texture.version;

    runtime.dispose();

    assert.deepEqual(
      texture.image.data,
      originalPixels
    );

    assert.ok(
      texture.version >
        versionBeforeDispose
    );

    geometry.dispose();
    material.dispose();
    texture.dispose();
  }
);

test(
  "V34 creates no competing rendering gameplay interaction or animation system",
  () => {
    const source =
      readSource(
        "classroomBlackboardStorytellingV34.js"
      );

    for (
      const forbidden
      of [
        /new THREE\.Mesh\s*\(/gu,
        /new THREE\.Sprite\s*\(/gu,
        /new THREE\.InstancedMesh\s*\(/gu,
        /new THREE\.MeshBasicMaterial\s*\(/gu,
        /new THREE\.CanvasTexture\s*\(/gu,
        /new THREE\.DataTexture\s*\(/gu,
        /new THREE\.Raycaster\s*\(/gu,
        /PointerLockControls/gu,
        /requestAnimationFrame/gu,
        /setInterval/gu,
        /setTimeout/gu,
        /emitTeacherInterventionCommand/gu,
        /stepPlayerLocomotion/gu,
        /resolvePlayerCollision/gu,
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

    assert.equal(
      (
        source.match(
          /scene\.traverse\s*\(/gu
        ) ??
        []
      ).length,
      1
    );
  }
);

test(
  "V34 world integration is construction-only and disposes before V33",
  () => {
    const world =
      readSource(
        "ClassroomWorld.jsx"
      );

    assert.equal(
      world
        .split(
          "createClassroomBlackboardStorytellingV34({"
        )
        .length - 1,
      1
    );

    assert.equal(
      world
        .split(
          "classroomBlackboardStorytellingV34.dispose();"
        )
        .length - 1,
      1
    );

    assert.equal(
      world.includes(
        "classroomBlackboardStorytellingV34.tick("
      ),
      false
    );

    const v34 =
      world.indexOf(
        "classroomBlackboardStorytellingV34.dispose();"
      );

    const v33 =
      world.indexOf(
        "classroomPixelFaceLivedInPolishV33.dispose();"
      );

    assert.ok(
      v34 >=
        0
    );

    assert.ok(
      v33 >=
        0
    );

    assert.ok(
      v34 <
        v33
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
