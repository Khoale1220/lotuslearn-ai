import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import {
  CLASSROOM_TEACHER_DESK_HEADPHONES_V19A_PROFILE,
  createClassroomTeacherDeskHeadphonesV19A
} from "./classroomTeacherDeskHeadphonesV19A.js";

function createDeskFixture() {
  const scene =
    new THREE.Scene();

  const desk =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        2,
        0.78,
        0.9
      ),
      new THREE.MeshBasicMaterial()
    );

  desk.name =
    "teacher-desk";

  desk.position.set(
    2,
    0.39,
    -3
  );

  scene.add(desk);

  return {
    scene,
    desk
  };
}

test(
  "V19A mounts headphones on discovered teacher desk",
  () => {
    const {
      scene,
      desk
    } =
      createDeskFixture();

    const system =
      createClassroomTeacherDeskHeadphonesV19A({
        scene,
        teacherAnchor: {
          x: 2,
          y: 1,
          z: -3
        }
      });

    const snapshot =
      system.getSnapshot();

    assert.equal(
      snapshot.anchorMode,
      "desk-bounds"
    );

    assert.equal(
      snapshot.candidateName,
      "teacher-desk"
    );

    assert.ok(
      snapshot.position.y >
        0.78
    );

    assert.equal(
      snapshot.visualOnly,
      true
    );

    assert.equal(
      snapshot.deterministic,
      true
    );

    assert.equal(
      CLASSROOM_TEACHER_DESK_HEADPHONES_V19A_PROFILE
        .interactionAuthorityMutations,
      0
    );

    assert.ok(
      scene.children.includes(
        system.root
      )
    );

    system.dispose();

    desk.geometry.dispose();
    desk.material.dispose();
  }
);

test(
  "V19A meshes are interaction-isolated",
  () => {
    const {
      scene,
      desk
    } =
      createDeskFixture();

    const system =
      createClassroomTeacherDeskHeadphonesV19A({
        scene
      });

    let meshCount = 0;

    system.root.traverse(
      (object) => {
        if (!object.isMesh) {
          return;
        }

        meshCount += 1;

        assert.equal(
          object.userData
            .visualOnly,
          true
        );

        assert.equal(
          object.userData
            .interactionExcluded,
          true
        );

        const hits = [];

        object.raycast(
          new THREE.Raycaster(),
          hits
        );

        assert.equal(
          hits.length,
          0
        );
      }
    );

    assert.ok(
      meshCount >= 8
    );

    system.dispose();

    desk.geometry.dispose();
    desk.material.dispose();
  }
);

test(
  "V19A uses deterministic teacher-anchor fallback",
  () => {
    const scene =
      new THREE.Scene();

    const anchor = {
      x: 4,
      y: 1,
      z: 7
    };

    const first =
      createClassroomTeacherDeskHeadphonesV19A({
        scene,
        teacherAnchor:
          anchor
      });

    const firstSnapshot =
      first.getSnapshot();

    first.dispose();

    const second =
      createClassroomTeacherDeskHeadphonesV19A({
        scene,
        teacherAnchor:
          anchor
      });

    const secondSnapshot =
      second.getSnapshot();

    assert.equal(
      firstSnapshot.anchorMode,
      "teacher-anchor-fallback"
    );

    assert.deepEqual(
      firstSnapshot.position,
      secondSnapshot.position
    );

    second.dispose();
  }
);

test(
  "V19A dispose removes headphone root",
  () => {
    const {
      scene,
      desk
    } =
      createDeskFixture();

    const system =
      createClassroomTeacherDeskHeadphonesV19A({
        scene
      });

    assert.ok(
      scene.children.includes(
        system.root
      )
    );

    system.dispose();

    assert.equal(
      scene.children.includes(
        system.root
      ),
      false
    );

    desk.geometry.dispose();
    desk.material.dispose();
  }
);
