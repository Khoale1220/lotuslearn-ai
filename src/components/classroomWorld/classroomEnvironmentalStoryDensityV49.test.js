import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as THREE from "three";

import {
  CLASSROOM_ENVIRONMENTAL_STORY_DENSITY_V49_PROFILE,
  deriveDeskStoryPlanV49,
  discoverV49Anchors,
  createClassroomEnvironmentalStoryDensityV49
} from "./classroomEnvironmentalStoryDensityV49.js";

function createFixture() {
  const scene =
    new THREE.Scene();

  const retroRoot =
    new THREE.Group();

  retroRoot.name =
    "classroom-retro-composition-v4";

  scene.add(
    retroRoot
  );

  const deskGeometry =
    new THREE.BoxGeometry(
      1.2,
      0.08,
      0.62
    );

  const deskMaterial =
    new THREE.MeshBasicMaterial();

  const desks =
    new THREE.InstancedMesh(
      deskGeometry,
      deskMaterial,
      10
    );

  const matrix =
    new THREE.Matrix4();

  for (
    let index = 0;
    index < 10;
    index += 1
  ) {
    matrix.makeTranslation(
      (index % 5) * 1.45,
      0.85,
      -Math.floor(index / 5) * 1.35
    );

    desks.setMatrixAt(
      index,
      matrix
    );
  }

  desks.instanceMatrix.needsUpdate =
    true;

  retroRoot.add(
    desks
  );

  const storyRoot =
    new THREE.Group();

  storyRoot.name =
    "classroom-v48-wall-story-root";

  retroRoot.add(
    storyRoot
  );

  const panelGeometry =
    new THREE.BoxGeometry(
      1.8,
      1.4,
      0.045
    );

  const panelMaterial =
    new THREE.MeshBasicMaterial();

  const panel =
    new THREE.InstancedMesh(
      panelGeometry,
      panelMaterial,
      1
    );

  panel.name =
    "classroom-v48-story-panel";

  matrix.makeTranslation(
    3.0,
    2.4,
    -3.8
  );

  panel.setMatrixAt(
    0,
    matrix
  );

  panel.instanceMatrix.needsUpdate =
    true;

  storyRoot.add(
    panel
  );

  const paperGeometry =
    new THREE.BoxGeometry(
      0.48,
      0.36,
      0.018
    );

  const paperMaterial =
    new THREE.MeshBasicMaterial();

  const papers =
    new THREE.InstancedMesh(
      paperGeometry,
      paperMaterial,
      5
    );

  papers.name =
    "classroom-v48-story-papers";

  const paperPositions =
    [
      [2.65, 2.65],
      [3.20, 2.62],
      [2.66, 2.14],
      [3.18, 2.12],
      [2.92, 1.90]
    ];

  for (
    let index = 0;
    index < paperPositions.length;
    index += 1
  ) {
    const [
      x,
      y
    ] =
      paperPositions[index];

    matrix.makeTranslation(
      x,
      y,
      -3.73
    );

    papers.setMatrixAt(
      index,
      matrix
    );
  }

  papers.instanceMatrix.needsUpdate =
    true;

  storyRoot.add(
    papers
  );

  return {
    scene,
    retroRoot,

    desks,
    storyRoot,
    panel,
    papers,

    deskGeometry,
    panelGeometry,
    paperGeometry,

    deskMaterial,
    panelMaterial,
    paperMaterial
  };
}

function disposeFixture(
  fixture
) {
  fixture.deskGeometry.dispose();
  fixture.panelGeometry.dispose();
  fixture.paperGeometry.dispose();

  fixture.deskMaterial.dispose();
  fixture.panelMaterial.dispose();
  fixture.paperMaterial.dispose();
}

test(
  "V49 profile is visual-only and draw-call bounded",
  () => {
    const profile =
      CLASSROOM_ENVIRONMENTAL_STORY_DENSITY_V49_PROFILE;

    assert.equal(
      profile.version,
      49
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
      profile.totalInstancedMeshCount,
      2
    );

    assert.equal(
      profile.maximumAddedDrawCalls,
      2
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
      profile.addedLights,
      0
    );

    assert.equal(
      profile.secondAnimationLoop,
      false
    );

    assert.equal(
      profile.secondRaycastAuthority,
      false
    );

    assert.equal(
      profile.noticeboardPolygonOffset,
      true
    );
  }
);

test(
  "V49 deterministic desk story varies without randomness",
  () => {
    assert.deepEqual(
      deriveDeskStoryPlanV49(11),
      deriveDeskStoryPlanV49(11)
    );

    const signatures =
      new Set();

    let bottles =
      0;

    let cups =
      0;

    for (
      let index = 0;
      index < 80;
      index += 1
    ) {
      const plan =
        deriveDeskStoryPlanV49(
          index
        );

      if (
        plan.hasBottle
      ) {
        bottles += 1;
      }

      if (
        plan.hasPencilCup
      ) {
        cups += 1;
      }

      signatures.add(
        [
          plan.side,
          plan.hasBottle,
          plan.hasPencilCup,
          plan.bottleColorIndex,
          plan.cupColorIndex,
          plan.bottleOffsetX,
          plan.cupOffsetX
        ].join(":")
      );
    }

    assert.ok(
      bottles > 40
    );

    assert.ok(
      cups > 40
    );

    assert.ok(
      signatures.size > 30
    );
  }
);

test(
  "V49 discovers V47 desk and V48 storytelling in one traversal",
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
      discoverV49Anchors(
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
      discovery.deskMesh,
      fixture.desks
    );

    assert.equal(
      discovery.storyPanelMesh,
      fixture.panel
    );

    assert.equal(
      discovery.storyPaperMesh,
      fixture.papers
    );

    assert.equal(
      discovery.storyRoot,
      fixture.storyRoot
    );

    disposeFixture(
      fixture
    );
  }
);

test(
  "V49 builds dense pixel props with exactly two instanced meshes",
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

    const system =
      createClassroomEnvironmentalStoryDensityV49({
        scene:
          fixture.scene
      });

    assert.equal(
      traversals,
      1
    );

    const snapshot =
      system.getSnapshot();

    assert.equal(
      snapshot.constructionSceneTraversalCount,
      1
    );

    assert.equal(
      snapshot.runtimeSceneTraversalCount,
      0
    );

    assert.equal(
      snapshot.totalInstancedMeshCount,
      2
    );

    assert.equal(
      snapshot.maximumAddedDrawCalls,
      2
    );

    assert.ok(
      snapshot.deskPropCount > 10
    );

    assert.ok(
      snapshot.bottleCount > 0
    );

    assert.ok(
      snapshot.pencilCupCount > 0
    );

    assert.ok(
      snapshot.pencilCount > 0
    );

    assert.equal(
      snapshot.frameStripCount,
      4
    );

    assert.equal(
      snapshot.paperShadowCount,
      5
    );

    assert.equal(
      snapshot.pinCount,
      10
    );

    assert.equal(
      snapshot.captionBarCount,
      4
    );

    assert.equal(
      snapshot.noticeboardPolygonOffset,
      true
    );

    const deskRoot =
      fixture.retroRoot.getObjectByName(
        "classroom-v49-desk-story-root"
      );

    const boardRoot =
      fixture.storyRoot.parent.getObjectByName(
        "classroom-v49-noticeboard-layer-root"
      );

    assert.ok(
      deskRoot
    );

    assert.ok(
      boardRoot
    );

    assert.equal(
      deskRoot.children.length,
      1
    );

    assert.equal(
      boardRoot.children.length,
      1
    );

    assert.equal(
      deskRoot.children[0].isInstancedMesh,
      true
    );

    assert.equal(
      boardRoot.children[0].isInstancedMesh,
      true
    );

    assert.equal(
      deskRoot.children[0].userData.visualOnly,
      true
    );

    assert.equal(
      boardRoot.children[0].userData.visualOnly,
      true
    );

    assert.equal(
      boardRoot.children[0].material.polygonOffset,
      true
    );

    assert.equal(
      boardRoot.children[0].material.toneMapped,
      false
    );

    assert.equal(
      system.tick(),
      false
    );

    assert.equal(
      traversals,
      1
    );

    const matrix =
      new THREE.Matrix4();

    fixture.desks.getMatrixAt(
      0,
      matrix
    );

    matrix.elements[12] +=
      0.12;

    fixture.desks.setMatrixAt(
      0,
      matrix
    );

    fixture.desks.instanceMatrix.needsUpdate =
      true;

    assert.equal(
      system.tick(),
      true
    );

    assert.equal(
      traversals,
      1
    );

    assert.equal(
      system.tick(),
      false
    );

    assert.equal(
      traversals,
      1
    );

    const after =
      system.getSnapshot();

    assert.equal(
      after.deskRebuildCount,
      2
    );

    system.dispose();

    assert.equal(
      fixture.retroRoot.getObjectByName(
        "classroom-v49-desk-story-root"
      ),
      undefined
    );

    assert.equal(
      fixture.retroRoot.getObjectByName(
        "classroom-v49-noticeboard-layer-root"
      ),
      undefined
    );

    disposeFixture(
      fixture
    );
  }
);

test(
  "V49 uses no competing texture light raycast or animation authority",
  () => {
    const source =
      fs.readFileSync(
        new URL(
          "./classroomEnvironmentalStoryDensityV49.js",
          import.meta.url
        ),
        "utf8"
      );

    assert.match(
      source,
      /InstancedMesh/
    );

    assert.match(
      source,
      /computeBoundingBox/
    );

    assert.match(
      source,
      /computeBoundingSphere/
    );

    assert.match(
      source,
      /polygonOffset/
    );

    assert.match(
      source,
      /scoreDeskTopCandidateV47/
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
      /new\s+THREE\.(CanvasTexture|DataTexture|Texture)/
    );

    assert.doesNotMatch(
      source,
      /new\s+THREE\.(Sprite|SpriteMaterial)/
    );

    assert.doesNotMatch(
      source,
      /new\s+THREE\.(DirectionalLight|PointLight|SpotLight|AmbientLight|HemisphereLight)/
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
  "V49 World integration follows V48 and disposes in reverse order",
  () => {
    const source =
      fs.readFileSync(
        new URL(
          "./ClassroomWorld.jsx",
          import.meta.url
        ),
        "utf8"
      );

    const v48Construction =
      source.indexOf(
        "const classroomBackpackWallStorytellingV48"
      );

    const v49Construction =
      source.indexOf(
        "const classroomEnvironmentalStoryDensityV49"
      );

    assert.ok(
      v48Construction >= 0
    );

    assert.ok(
      v49Construction >
      v48Construction
    );

    const v48Tick =
      source.indexOf(
        "classroomBackpackWallStorytellingV48.tick();"
      );

    const v49Tick =
      source.indexOf(
        "classroomEnvironmentalStoryDensityV49.tick();"
      );

    assert.ok(
      v48Tick >= 0
    );

    assert.ok(
      v49Tick >
      v48Tick
    );

    const v49Dispose =
      source.indexOf(
        "classroomEnvironmentalStoryDensityV49.dispose();"
      );

    const v48Dispose =
      source.indexOf(
        "classroomBackpackWallStorytellingV48.dispose();"
      );

    assert.ok(
      v49Dispose >= 0
    );

    assert.ok(
      v48Dispose >
      v49Dispose
    );
  }
);