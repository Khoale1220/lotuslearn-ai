import assert from "node:assert/strict";

import test from "node:test";

import * as THREE from "three";

import {
  captureInstanceColorsV50,
  createClassroomCinematicPaletteCohesionV50
} from "./classroomCinematicPaletteCohesionV50.js";


function createDeferredFixture() {
  const scene =
    new THREE.Scene();

  const root =
    new THREE.Group();

  scene.add(root);

  const geometry =
    new THREE.BoxGeometry(
      1,
      1,
      1
    );

  const desk =
    new THREE.InstancedMesh(
      geometry,

      new THREE.MeshBasicMaterial({
        color:
          0xffffff,

        toneMapped:
          false
      }),

      4
    );

  desk.name =
    "classroom-v49-desk-pixel-props";

  /*
   * Production startup state.
   */
  desk.count =
    0;

  const board =
    new THREE.InstancedMesh(
      geometry,

      new THREE.MeshBasicMaterial({
        color:
          0xffffff,

        toneMapped:
          false
      }),

      2
    );

  board.name =
    "classroom-v49-noticeboard-pixel-layer";

  const matrix =
    new THREE.Matrix4();

  const color =
    new THREE.Color();

  for (
    let index = 0;
    index < 2;
    index += 1
  ) {
    matrix.makeTranslation(
      index,
      1,
      0
    );

    board.setMatrixAt(
      index,
      matrix
    );

    color.setHex(
      index === 0
        ? 0x676f73
        : 0xb47a54
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

  const panel =
    new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial()
    );

  panel.name =
    "classroom-v48-story-panel";

  const papers =
    new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial()
    );

  papers.name =
    "classroom-v48-story-papers";

  root.add(
    desk,
    board,
    panel,
    papers
  );

  return {
    scene,
    desk
  };
}


function materializeDeskColors(
  fixture
) {
  const matrix =
    new THREE.Matrix4();

  const color =
    new THREE.Color();

  const colors = [
    0x527b91,
    0xb0704b
  ];

  for (
    let index = 0;
    index < 2;
    index += 1
  ) {
    matrix.makeTranslation(
      index,
      0,
      0
    );

    fixture.desk.setMatrixAt(
      index,
      matrix
    );

    color.setHex(
      colors[index]
    );

    fixture.desk.setColorAt(
      index,
      color
    );
  }

  fixture.desk.count =
    2;

  fixture.desk.instanceMatrix.needsUpdate =
    true;

  fixture.desk.instanceColor.needsUpdate =
    true;
}


function arraysDiffer(
  a,
  b,
  epsilon = 1e-7
) {
  if (
    a.length !==
      b.length
  ) {
    return true;
  }

  return Array.from(a).some(
    (
      value,
      index
    ) =>
      Math.abs(
        value -
        b[index]
      ) >
      epsilon
  );
}


test(
  "V50 accepts zero-population desk colors and hydrates after V49",
  () => {
    const fixture =
      createDeferredFixture();

    assert.equal(
      fixture.desk.instanceColor,
      null
    );

    const system =
      createClassroomCinematicPaletteCohesionV50({
        scene:
          fixture.scene
      });

    let snapshot =
      system.getSnapshot();

    assert.equal(
      snapshot.deskPaletteState,
      "waiting-for-instance-color"
    );

    assert.equal(
      snapshot.deskInstanceCount,
      0
    );

    materializeDeskColors(
      fixture
    );

    const before =
      captureInstanceColorsV50(
        fixture.desk
      );

    assert.equal(
      system.tick(),
      true
    );

    const after =
      captureInstanceColorsV50(
        fixture.desk
      );

    snapshot =
      system.getSnapshot();

    assert.equal(
      snapshot.deskPaletteState,
      "active"
    );

    assert.equal(
      snapshot.deskInstanceCount,
      2
    );

    assert.ok(
      snapshot.deskColorMutationCount >
        0
    );

    assert.equal(
      arraysDiffer(
        before,
        after
      ),
      true
    );

    /*
     * No duplicate re-harmonization from V50's
     * own BufferAttribute version update.
     */
    assert.equal(
      system.tick(),
      false
    );

    system.dispose();

    const restored =
      captureInstanceColorsV50(
        fixture.desk
      );

    assert.equal(
      arraysDiffer(
        before,
        restored
      ),
      false
    );
  }
);
