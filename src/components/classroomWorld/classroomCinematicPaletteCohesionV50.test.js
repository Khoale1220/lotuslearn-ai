import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as THREE from "three";

import {
  CLASSROOM_CINEMATIC_PALETTE_COHESION_V50_PROFILE,
  V50_PALETTE_HEX,
  harmonizeColorV50,
  discoverCohesionTargetsV50,
  captureInstanceColorsV50,
  createClassroomCinematicPaletteCohesionV50
} from "./classroomCinematicPaletteCohesionV50.js";

function createFixture() {
  const scene =
    new THREE.Scene();

  const root =
    new THREE.Group();

  root.name =
    "classroom-retro-composition-v4";

  scene.add(
    root
  );

  const geometry =
    new THREE.BoxGeometry(
      1,
      1,
      1
    );

  const deskMaterial =
    new THREE.MeshBasicMaterial({
      color:
        0xffffff,

      toneMapped:
        false
    });

  const boardMaterial =
    new THREE.MeshBasicMaterial({
      color:
        0xffffff,

      toneMapped:
        false,

      polygonOffset:
        true,

      polygonOffsetFactor:
        -1,

      polygonOffsetUnits:
        -1
    });

  const desk =
    new THREE.InstancedMesh(
      geometry,
      deskMaterial,
      6
    );

  desk.name =
    "classroom-v49-desk-pixel-props";

  const board =
    new THREE.InstancedMesh(
      geometry,
      boardMaterial,
      5
    );

  board.name =
    "classroom-v49-noticeboard-pixel-layer";

  const matrix =
    new THREE.Matrix4();

  const color =
    new THREE.Color();

  const deskColors =
    [
      0x527b91,
      0xb0704b,
      0x8b6c55,
      0x3d5568,
      0xc3a774,
      0x563f5c
    ];

  for (
    let index = 0;
    index < 6;
    index += 1
  ) {
    matrix.makeTranslation(
      index * 0.2,
      0,
      0
    );

    desk.setMatrixAt(
      index,
      matrix
    );

    color.setHex(
      deskColors[
        index
      ]
    );

    desk.setColorAt(
      index,
      color
    );
  }

  desk.instanceMatrix.needsUpdate =
    true;

  desk.instanceColor.needsUpdate =
    true;

  const boardColors =
    [
      0x26212c,
      0x676f73,
      0xb47a54,
      0xd2bd91,
      0x476f76
    ];

  for (
    let index = 0;
    index < 5;
    index += 1
  ) {
    matrix.makeTranslation(
      index * 0.2,
      1,
      0
    );

    board.setMatrixAt(
      index,
      matrix
    );

    color.setHex(
      boardColors[
        index
      ]
    );

    board.setColorAt(
      index,
      color
    );
  }

  board.instanceMatrix.needsUpdate =
    true;

  board.instanceColor.needsUpdate =
    true;

  root.add(
    desk,
    board
  );

  const panel =
    new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial()
    );

  panel.name =
    "classroom-v48-story-panel";

  root.add(
    panel
  );

  const papers =
    new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial()
    );

  papers.name =
    "classroom-v48-story-papers";

  root.add(
    papers
  );

  const characterMaterial =
    new THREE.SpriteMaterial({
      color:
        0xffffff
    });

  const character =
    new THREE.Sprite(
      characterMaterial
    );

  character.name =
    "classroom-student-character-01";

  character.userData.studentKey =
    "student-01";

  root.add(
    character
  );

  return {
    scene,
    root,

    geometry,

    desk,
    board,

    deskMaterial,
    boardMaterial,

    panel,
    papers,

    character,
    characterMaterial
  };
}

function arrayApproximatelyEqual(
  a,
  b,
  epsilon = 1e-7
) {
  if (
    a.length !==
    b.length
  ) {
    return false;
  }

  for (
    let index = 0;
    index < a.length;
    index += 1
  ) {
    if (
      Math.abs(
        a[index] -
        b[index]
      ) >
      epsilon
    ) {
      return false;
    }
  }

  return true;
}

function disposeFixture(
  fixture
) {
  fixture.geometry.dispose();

  fixture.deskMaterial.dispose();
  fixture.boardMaterial.dispose();

  fixture.panel.material.dispose();
  fixture.papers.material.dispose();

  fixture.characterMaterial.dispose();
}

test(
  "V50 profile is zero-draw-call visual-only cohesion",
  () => {
    const profile =
      CLASSROOM_CINEMATIC_PALETTE_COHESION_V50_PROFILE;

    assert.equal(
      profile.version,
      50
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
      profile.constructionSceneTraversalCount,
      1
    );

    assert.equal(
      profile.runtimeSceneTraversalCount,
      0
    );

    assert.equal(
      profile.addedObjects,
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
      profile.addedTextures,
      0
    );

    assert.equal(
      profile.addedLights,
      0
    );

    assert.equal(
      profile.addedDrawCalls,
      0
    );

    assert.equal(
      profile.rendererMutationCount,
      0
    );

    assert.equal(
      profile.characterAtlasMutationCount,
      0
    );

    assert.equal(
      profile.characterMaterialMutationCount,
      0
    );

    assert.equal(
      profile.characterVisualAuthorityProtected,
      true
    );

    assert.equal(
      profile.environmentDrivenCharacterContrast,
      true
    );

    assert.equal(
      profile.paletteAnchorCount,
      8
    );
  }
);

test(
  "V50 palette contains required reference language",
  () => {
    assert.equal(
      V50_PALETTE_HEX.ink,
      0x17151d
    );

    assert.equal(
      V50_PALETTE_HEX.deepPlum,
      0x2d2034
    );

    assert.equal(
      V50_PALETTE_HEX.cyan,
      0x4c9fa4
    );

    assert.equal(
      V50_PALETTE_HEX.orange,
      0xd47742
    );

    assert.equal(
      V50_PALETTE_HEX.cream,
      0xe8d7aa
    );
  }
);

test(
  "V50 harmonization is deterministic and non-destructive",
  () => {
    const source =
      new THREE.Color(
        0x7a6c58
      );

    const paletteSet = {
      desk:
        [
          new THREE.Color(
            V50_PALETTE_HEX.deepPlum
          ),

          new THREE.Color(
            V50_PALETTE_HEX.cyan
          ),

          new THREE.Color(
            V50_PALETTE_HEX.orange
          ),

          new THREE.Color(
            V50_PALETTE_HEX.cream
          )
        ],

      board:
        [
          new THREE.Color(
            V50_PALETTE_HEX.ink
          ),

          new THREE.Color(
            V50_PALETTE_HEX.cyan
          ),

          new THREE.Color(
            V50_PALETTE_HEX.orange
          ),

          new THREE.Color(
            V50_PALETTE_HEX.cream
          )
        ]
    };

    const sourceBefore =
      source.clone();

    const a =
      harmonizeColorV50(
        source,
        "desk",
        4,
        paletteSet
      );

    const b =
      harmonizeColorV50(
        source,
        "desk",
        4,
        paletteSet
      );

    assert.equal(
      a.r,
      b.r
    );

    assert.equal(
      a.g,
      b.g
    );

    assert.equal(
      a.b,
      b.b
    );

    assert.equal(
      source.r,
      sourceBefore.r
    );

    assert.equal(
      source.g,
      sourceBefore.g
    );

    assert.equal(
      source.b,
      sourceBefore.b
    );
  }
);

test(
  "V50 discovers visual targets exactly once",
  () => {
    const fixture =
      createFixture();

    let traversals =
      0;

    const originalTraverse =
      fixture.scene.traverse.bind(
        fixture.scene
      );

    fixture.scene.traverse =
      (callback) => {
        traversals += 1;

        return originalTraverse(
          callback
        );
      };

    const discovery =
      discoverCohesionTargetsV50(
        fixture.scene
      );

    assert.equal(
      traversals,
      1
    );

    assert.equal(
      discovery.traversalCount,
      1
    );

    assert.equal(
      discovery.deskPixelMesh,
      fixture.desk
    );

    assert.equal(
      discovery.noticeboardPixelMesh,
      fixture.board
    );

    assert.equal(
      discovery.storyPanelMesh,
      fixture.panel
    );

    assert.equal(
      discovery.storyPaperMesh,
      fixture.papers
    );

    assert.ok(
      discovery.characterVisualCount >=
      1
    );

    disposeFixture(
      fixture
    );
  }
);

test(
  "V50 harmonizes environment while preserving characters",
  () => {
    const fixture =
      createFixture();

    const deskBefore =
      captureInstanceColorsV50(
        fixture.desk
      );

    const boardBefore =
      captureInstanceColorsV50(
        fixture.board
      );

    const characterColorBefore =
      fixture.characterMaterial
        .color
        .clone();

    const rootChildCountBefore =
      fixture.root.children.length;

    const system =
      createClassroomCinematicPaletteCohesionV50({
        scene:
          fixture.scene
      });

    const snapshot =
      system.getSnapshot();

    const deskAfter =
      captureInstanceColorsV50(
        fixture.desk
      );

    const boardAfter =
      captureInstanceColorsV50(
        fixture.board
      );

    assert.equal(
      arrayApproximatelyEqual(
        deskBefore,
        deskAfter
      ),
      false
    );

    assert.equal(
      arrayApproximatelyEqual(
        boardBefore,
        boardAfter
      ),
      false
    );

    assert.ok(
      snapshot.deskColorMutationCount >
      0
    );

    assert.ok(
      snapshot.boardColorMutationCount >
      0
    );

    assert.ok(
      snapshot.environmentColorMutationCount >
      0
    );

    assert.equal(
      snapshot.characterAtlasMutationCount,
      0
    );

    assert.equal(
      snapshot.characterMaterialMutationCount,
      0
    );

    assert.equal(
      fixture.characterMaterial.color.r,
      characterColorBefore.r
    );

    assert.equal(
      fixture.characterMaterial.color.g,
      characterColorBefore.g
    );

    assert.equal(
      fixture.characterMaterial.color.b,
      characterColorBefore.b
    );

    assert.equal(
      fixture.root.children.length,
      rootChildCountBefore
    );

    assert.equal(
      snapshot.addedObjects,
      0
    );

    assert.equal(
      snapshot.addedDrawCalls,
      0
    );

    assert.equal(
      snapshot.rendererMutationCount,
      0
    );

    assert.equal(
      snapshot.cameraMutationCount,
      0
    );

    assert.equal(
      snapshot.fogMutationCount,
      0
    );

    assert.equal(
      snapshot.backgroundMutationCount,
      0
    );

    assert.equal(
      snapshot.deskToneMapped,
      false
    );

    assert.equal(
      snapshot.noticeboardToneMapped,
      false
    );

    system.dispose();

    const deskRestored =
      captureInstanceColorsV50(
        fixture.desk
      );

    const boardRestored =
      captureInstanceColorsV50(
        fixture.board
      );

    assert.equal(
      arrayApproximatelyEqual(
        deskBefore,
        deskRestored
      ),
      true
    );

    assert.equal(
      arrayApproximatelyEqual(
        boardBefore,
        boardRestored
      ),
      true
    );

    disposeFixture(
      fixture
    );
  }
);

test(
  "V50 adds no competing renderer or runtime authority",
  () => {
    const source =
      fs.readFileSync(
        new URL(
          "./classroomCinematicPaletteCohesionV50.js",
          import.meta.url
        ),
        "utf8"
      );

    assert.match(
      source,
      /LinearSRGBColorSpace/
    );

    assert.match(
      source,
      /toneMapped/
    );

    assert.match(
      source,
      /instanceColor/
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
      /new\s+THREE\.(Texture|CanvasTexture|DataTexture)/
    );

    assert.doesNotMatch(
      source,
      /new\s+THREE\.(DirectionalLight|PointLight|SpotLight|AmbientLight|HemisphereLight)/
    );

    assert.doesNotMatch(
      source,
      /new\s+THREE\.(Mesh|InstancedMesh|Sprite|Group)\s*\(/
    );

    assert.doesNotMatch(
      source,
      /outputColorSpace\s*=/
    );

    assert.doesNotMatch(
      source,
      /toneMapping\s*=/
    );

    assert.doesNotMatch(
      source,
      /scene\.background\s*=/
    );

    assert.doesNotMatch(
      source,
      /scene\.fog\s*=/
    );

    assert.doesNotMatch(
      source,
      /PointerLockControls/
    );

    assert.doesNotMatch(
      source,
      /stepPlayerLocomotion/
    );

    assert.doesNotMatch(
      source,
      /resolveVelocityAfterCollision/
    );

    assert.equal(
      (
        source.match(
          /scene\.traverse\s*\(/g
        ) ?? []
      ).length,
      1
    );
  }
);

test(
  "V50 integrates after V49 without adding runtime tick",
  () => {
    const source =
      fs.readFileSync(
        new URL(
          "./ClassroomWorld.jsx",
          import.meta.url
        ),
        "utf8"
      );

    const v49Construction =
      source.indexOf(
        "const classroomEnvironmentalStoryDensityV49"
      );

    const v50Construction =
      source.indexOf(
        "const classroomCinematicPaletteCohesionV50"
      );

    assert.ok(
      v49Construction >= 0
    );

    assert.ok(
      v50Construction >
      v49Construction
    );

    assert.equal(
      source.includes(
        "classroomCinematicPaletteCohesionV50.tick();"
      ),
      false
    );

    const v50Dispose =
      source.indexOf(
        "classroomCinematicPaletteCohesionV50.dispose();"
      );

    const v49Dispose =
      source.indexOf(
        "classroomEnvironmentalStoryDensityV49.dispose();"
      );

    assert.ok(
      v50Dispose >= 0
    );

    assert.ok(
      v49Dispose >
      v50Dispose
    );
  }
);