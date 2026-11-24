import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as THREE from "three";

import {
  CLASSROOM_BACKPACK_WALL_STORYTELLING_V48_PROFILE,
  deriveBackpackPlanV48,
  scoreBoardCandidateV48,
  discoverCanonicalAnchorsV48,
  createClassroomBackpackWallStorytellingV48
} from "./classroomBackpackWallStorytellingV48.js";

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
      8
    );

  const matrix =
    new THREE.Matrix4();

  for (
    let index = 0;
    index < 8;
    index += 1
  ) {
    matrix.makeTranslation(
      (index % 4) * 1.45,
      0.85,
      -Math.floor(index / 4) * 1.35
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

  const boardGeometry =
    new THREE.PlaneGeometry(
      6.8,
      2.4
    );

  const boardMaterial =
    new THREE.MeshBasicMaterial();

  const board =
    new THREE.Mesh(
      boardGeometry,
      boardMaterial
    );

  board.position.set(
    2,
    2.8,
    -4
  );

  retroRoot.add(
    board
  );

  const floorGeometry =
    new THREE.BoxGeometry(
      12,
      0.1,
      10
    );

  const floorMaterial =
    new THREE.MeshBasicMaterial();

  const floor =
    new THREE.Mesh(
      floorGeometry,
      floorMaterial
    );

  retroRoot.add(
    floor
  );

  return {
    scene,
    retroRoot,

    desks,
    board,
    floor,

    deskGeometry,
    boardGeometry,
    floorGeometry,

    deskMaterial,
    boardMaterial,
    floorMaterial
  };
}

function disposeFixture(
  fixture
) {
  fixture.deskGeometry.dispose();
  fixture.boardGeometry.dispose();
  fixture.floorGeometry.dispose();

  fixture.deskMaterial.dispose();
  fixture.boardMaterial.dispose();
  fixture.floorMaterial.dispose();
}

test(
  "V48 profile remains bounded and visual-only",
  () => {
    const profile =
      CLASSROOM_BACKPACK_WALL_STORYTELLING_V48_PROFILE;

    assert.equal(
      profile.version,
      48
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
      6
    );

    assert.equal(
      profile.maximumAddedDrawCalls,
      6
    );

    assert.equal(
      profile.secondAnimationLoop,
      false
    );

    assert.equal(
      profile.secondRaycastAuthority,
      false
    );
  }
);

test(
  "V48 backpack casting is deterministic and varied",
  () => {
    assert.deepEqual(
      deriveBackpackPlanV48(7),
      deriveBackpackPlanV48(7)
    );

    const signatures =
      new Set();

    let bagCount =
      0;

    for (
      let index = 0;
      index < 64;
      index += 1
    ) {
      const plan =
        deriveBackpackPlanV48(
          index
        );

      if (
        plan.hasBag
      ) {
        bagCount += 1;
      }

      signatures.add(
        [
          plan.hasBag,
          plan.side,
          plan.colorIndex,
          plan.rotationY,
          plan.lateralJitter,
          plan.depthJitter
        ].join(":")
      );
    }

    assert.ok(
      bagCount > 40
    );

    assert.ok(
      signatures.size > 20
    );
  }
);

test(
  "V48 board scoring rejects horizontal floor",
  () => {
    const fixture =
      createFixture();

    fixture.scene.updateMatrixWorld(
      true
    );

    const boardScore =
      scoreBoardCandidateV48(
        fixture.board
      );

    const floorScore =
      scoreBoardCandidateV48(
        fixture.floor
      );

    assert.ok(
      Number.isFinite(
        boardScore
      )
    );

    assert.equal(
      floorScore,
      Number.NEGATIVE_INFINITY
    );

    disposeFixture(
      fixture
    );
  }
);

test(
  "V48 discovers desk and board in one construction traversal",
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
      discoverCanonicalAnchorsV48(
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
      discovery.boardMesh,
      fixture.board
    );

    disposeFixture(
      fixture
    );
  }
);

test(
  "V48 stages backpacks and wall storytelling without runtime traversal",
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
      createClassroomBackpackWallStorytellingV48({
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
      6
    );

    assert.equal(
      snapshot.wallPanelCount,
      1
    );

    assert.equal(
      snapshot.wallPaperCount,
      5
    );

    assert.equal(
      snapshot.wallTapeCount,
      10
    );

    assert.ok(
      snapshot.backpackCount > 0
    );

    const bagRoot =
      fixture.retroRoot.getObjectByName(
        "classroom-v48-backpack-root"
      );

    const wallRoot =
      fixture.retroRoot.getObjectByName(
        "classroom-v48-wall-story-root"
      );

    assert.ok(
      bagRoot
    );

    assert.ok(
      wallRoot
    );

    assert.equal(
      bagRoot.children.length,
      3
    );

    assert.equal(
      wallRoot.children.length,
      3
    );

    for (
      const child
      of [
        ...bagRoot.children,
        ...wallRoot.children
      ]
    ) {
      assert.equal(
        child.isInstancedMesh,
        true
      );

      assert.equal(
        child.userData.visualOnly,
        true
      );

      assert.equal(
        typeof child.raycast,
        "function"
      );
    }

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
      0.15;

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

    system.dispose();

    assert.equal(
      fixture.retroRoot.getObjectByName(
        "classroom-v48-backpack-root"
      ),
      undefined
    );

    assert.equal(
      fixture.retroRoot.getObjectByName(
        "classroom-v48-wall-story-root"
      ),
      undefined
    );

    disposeFixture(
      fixture
    );
  }
);

test(
  "V48 source contains no competing runtime authorities",
  () => {
    const source =
      fs.readFileSync(
        new URL(
          "./classroomBackpackWallStorytellingV48.js",
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
  "V48 World integration preserves V47 before V48 order",
  () => {
    const source =
      fs.readFileSync(
        new URL(
          "./ClassroomWorld.jsx",
          import.meta.url
        ),
        "utf8"
      );

    const v47Construction =
      source.indexOf(
        "const classroomDeskSurfacePropsV47"
      );

    const v48Construction =
      source.indexOf(
        "const classroomBackpackWallStorytellingV48"
      );

    assert.ok(
      v47Construction >= 0
    );

    assert.ok(
      v48Construction >
      v47Construction
    );

    const v47Tick =
      source.indexOf(
        "classroomDeskSurfacePropsV47.tick();"
      );

    const v48Tick =
      source.indexOf(
        "classroomBackpackWallStorytellingV48.tick();"
      );

    assert.ok(
      v47Tick >= 0
    );

    assert.ok(
      v48Tick >
      v47Tick
    );

    const v48Dispose =
      source.indexOf(
        "classroomBackpackWallStorytellingV48.dispose();"
      );

    const v47Dispose =
      source.indexOf(
        "classroomDeskSurfacePropsV47.dispose();"
      );

    assert.ok(
      v48Dispose >= 0
    );

    assert.ok(
      v47Dispose >
      v48Dispose
    );
  }
);