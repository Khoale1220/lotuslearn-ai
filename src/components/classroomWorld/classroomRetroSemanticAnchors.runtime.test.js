import assert from "node:assert/strict";

import {
  describe,
  it
} from "node:test";

import * as THREE from "three";

import {
  scoreDeskTopCandidateV47,
  selectDeskTopInstancedMeshV47
} from "./classroomDeskSurfacePropsV47.js";

import {
  scoreBoardCandidateV48,
  discoverCanonicalAnchorsV48
} from "./classroomBackpackWallStorytellingV48.js";


function createProductionLikeFixture() {
  const scene =
    new THREE.Scene();

  const root =
    new THREE.Group();

  root.name =
    "classroom-retro-composition-v4";

  const desk =
    new THREE.InstancedMesh(
      new THREE.BoxGeometry(
        1,
        1,
        1
      ),

      new THREE.MeshBasicMaterial(),

      32
    );

  desk.name =
    "retro-student-desks-v4";

  /*
   * Real production desk begins empty.
   */
  desk.count =
    0;

  desk.userData
    .classroomCanonicalDeskSurface =
      true;

  const board =
    new THREE.Mesh(
      /*
       * Deliberately use geometry that would not
       * satisfy the old heuristic.
       */
      new THREE.BoxGeometry(
        1,
        1,
        1
      ),

      new THREE.MeshBasicMaterial()
    );

  board.name =
    "retro-chalkboard-art-v4";

  board.userData
    .classroomCanonicalBlackboard =
      true;

  root.add(
    desk,
    board
  );

  scene.add(root);

  return {
    scene,
    root,
    desk,
    board
  };
}


function disposeFixture(
  fixture
) {
  fixture.desk.geometry.dispose();
  fixture.desk.material.dispose();

  fixture.board.geometry.dispose();
  fixture.board.material.dispose();

  fixture.scene.clear();
}


describe(
  "CW06 RetroComposition semantic anchor contract",
  () => {
    it(
      "discovers the canonical production desk even with unit-cube geometry and zero population",
      () => {
        const fixture =
          createProductionLikeFixture();

        const score =
          scoreDeskTopCandidateV47(
            fixture.desk
          );

        assert.equal(
          Number.isFinite(score),
          true
        );

        const discovery =
          selectDeskTopInstancedMeshV47(
            fixture.scene
          );

        assert.equal(
          discovery.mesh,
          fixture.desk
        );

        assert.equal(
          discovery.candidateCount,
          1
        );

        disposeFixture(
          fixture
        );
      }
    );


    it(
      "discovers the canonical blackboard without relying on geometry shape",
      () => {
        const fixture =
          createProductionLikeFixture();

        const score =
          scoreBoardCandidateV48(
            fixture.board
          );

        assert.equal(
          Number.isFinite(score),
          true
        );

        const discovery =
          discoverCanonicalAnchorsV48(
            fixture.scene
          );

        assert.equal(
          discovery.deskMesh,
          fixture.desk
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
  }
);
