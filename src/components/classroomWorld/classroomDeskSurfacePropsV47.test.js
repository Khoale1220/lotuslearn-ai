import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as THREE from "three";

import {
  CLASSROOM_DESK_SURFACE_PROPS_V47_PROFILE,
  deriveDeskPropPlanV47,
  scoreDeskTopCandidateV47,
  selectDeskTopInstancedMeshV47,
  createClassroomDeskSurfacePropsV47
} from "./classroomDeskSurfacePropsV47.js";

function createFixture() {
  const scene =
    new THREE.Scene();

  const root =
    new THREE.Group();

  root.name =
    "classroom-retro-composition-v4";

  scene.add(root);

  const deskGeometry =
    new THREE.BoxGeometry(
      1.2,
      0.08,
      0.62
    );

  const chairGeometry =
    new THREE.BoxGeometry(
      0.45,
      0.08,
      0.40
    );

  const deskMaterial =
    new THREE.MeshBasicMaterial();

  const chairMaterial =
    new THREE.MeshBasicMaterial();

  const desks =
    new THREE.InstancedMesh(
      deskGeometry,
      deskMaterial,
      6
    );

  const chairs =
    new THREE.InstancedMesh(
      chairGeometry,
      chairMaterial,
      6
    );

  const matrix =
    new THREE.Matrix4();

  for (
    let index = 0;
    index < 6;
    index += 1
  ) {
    matrix.makeTranslation(
      (index % 3) * 1.5,
      0.8,
      -Math.floor(index / 3) * 1.3
    );

    desks.setMatrixAt(
      index,
      matrix
    );

    chairs.setMatrixAt(
      index,
      matrix
    );
  }

  desks.instanceMatrix.needsUpdate =
    true;

  chairs.instanceMatrix.needsUpdate =
    true;

  root.add(desks);
  root.add(chairs);

  return {
    scene,
    root,
    desks,
    chairs,
    deskGeometry,
    chairGeometry,
    deskMaterial,
    chairMaterial
  };
}

function disposeFixture(fixture) {
  fixture.deskGeometry.dispose();
  fixture.chairGeometry.dispose();
  fixture.deskMaterial.dispose();
  fixture.chairMaterial.dispose();
}

test(
  "V47 profile is bounded visual-only instancing",
  () => {
    const profile =
      CLASSROOM_DESK_SURFACE_PROPS_V47_PROFILE;

    assert.equal(
      profile.version,
      47
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
      profile.instancedPropMeshCount,
      6
    );

    assert.equal(
      profile.maximumAddedDrawCalls,
      6
    );
  }
);

test(
  "V47 deterministic desk plan has visual variety",
  () => {
    assert.deepEqual(
      deriveDeskPropPlanV47(12),
      deriveDeskPropPlanV47(12)
    );

    const signatures =
      new Set();

    for (
      let index = 0;
      index < 64;
      index += 1
    ) {
      const plan =
        deriveDeskPropPlanV47(
          index
        );

      signatures.add(
        [
          plan.bookCount,
          plan.hasPencil,
          plan.hasRuler,
          plan.hasEraser,
          plan.hasPencilCase
        ].join(":")
      );
    }

    assert.ok(
      signatures.size >= 6
    );
  }
);

test(
  "V47 discovers canonical broad desk top",
  () => {
    const fixture =
      createFixture();

    assert.ok(
      scoreDeskTopCandidateV47(
        fixture.desks
      ) >
      scoreDeskTopCandidateV47(
        fixture.chairs
      )
    );

    const result =
      selectDeskTopInstancedMeshV47(
        fixture.scene
      );

    assert.equal(
      result.mesh,
      fixture.desks
    );

    assert.equal(
      result.traversalCount,
      1
    );

    disposeFixture(fixture);
  }
);

test(
  "V47 builds lived-in props and never traverses at runtime",
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
      createClassroomDeskSurfacePropsV47({
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
      snapshot.activeDeskCount,
      6
    );

    assert.equal(
      snapshot.notebookCount,
      6
    );

    assert.ok(
      snapshot.bookCount > 0
    );

    assert.ok(
      snapshot.pencilCount > 0
    );

    assert.ok(
      snapshot.totalPropCount >
      snapshot.notebookCount
    );

    assert.equal(
      snapshot.instancedPropMeshCount,
      6
    );

    assert.equal(
      snapshot.runtimeSceneTraversalCount,
      0
    );

    const root =
      fixture.root.getObjectByName(
        "classroom-desk-surface-props-v47"
      );

    assert.ok(root);
    assert.equal(
      root.children.length,
      6
    );

    for (
      const child
      of root.children
    ) {
      assert.equal(
        child.isInstancedMesh,
        true
      );

      assert.equal(
        child.userData.visualOnly,
        true
      );
    }

    const matrix =
      new THREE.Matrix4();

    fixture.desks.getMatrixAt(
      0,
      matrix
    );

    matrix.elements[12] +=
      0.1;

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
      fixture.root.getObjectByName(
        "classroom-desk-surface-props-v47"
      ),
      undefined
    );

    disposeFixture(fixture);
  }
);

test(
  "V47 has no competing engine authorities",
  () => {
    const source =
      fs.readFileSync(
        new URL(
          "./classroomDeskSurfacePropsV47.js",
          import.meta.url
        ),
        "utf8"
      );

    assert.match(
      source,
      /new THREE\.InstancedMesh/
    );

    assert.match(
      source,
      /getMatrixAt/
    );

    assert.match(
      source,
      /setMatrixAt/
    );

    assert.match(
      source,
      /computeBoundingBox/
    );

    assert.match(
      source,
      /computeBoundingSphere/
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
      /playerCollision/
    );

    assert.doesNotMatch(
      source,
      /playerLocomotion/
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
  "V47 world construction order is Retro then V46 then V47",
  () => {
    const source =
      fs.readFileSync(
        new URL(
          "./ClassroomWorld.jsx",
          import.meta.url
        ),
        "utf8"
      );

    const retro =
      source.indexOf(
        "const classroomRetroCompositionV4"
      );

    const v46 =
      source.indexOf(
        "const classroomCharacterFirstPersonStagingV46"
      );

    const v47 =
      source.indexOf(
        "const classroomDeskSurfacePropsV47"
      );

    assert.ok(
      retro >= 0
    );

    assert.ok(
      v46 > retro
    );

    assert.ok(
      v47 > v46
    );

    const retroTick =
      source.indexOf(
        "classroomRetroCompositionV4.tick(camera, timestamp);"
      );

    const v47Tick =
      source.indexOf(
        "classroomDeskSurfacePropsV47.tick();"
      );

    assert.ok(
      v47Tick > retroTick
    );

    const v47Dispose =
      source.indexOf(
        "classroomDeskSurfacePropsV47.dispose();"
      );

    const v46Dispose =
      source.indexOf(
        "classroomCharacterFirstPersonStagingV46.dispose();"
      );

    assert.ok(
      v47Dispose >= 0
    );

    assert.ok(
      v46Dispose > v47Dispose
    );
  }
);