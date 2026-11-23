import assert from "node:assert/strict";
import test from "node:test";

import {
  createStudentSceneRoster
} from "./studentSceneRoster.js";

function createFakeScene() {
  const objects = [];

  return {
    objects,

    add(object) {
      objects.push(object);
    },

    remove(object) {
      const index = objects.indexOf(object);

      if (index !== -1) {
        objects.splice(index, 1);
      }
    }
  };
}

function createFakeMesh() {
  const disposeState = {
    geometry: 0,
    material: 0
  };

  return {
    position: {
      x: 0,
      y: 0,
      z: 0,

      set(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
      }
    },

    geometry: {
      dispose() {
        disposeState.geometry += 1;
      }
    },

    material: {
      dispose() {
        disposeState.material += 1;
      }
    },

    disposeState,
    userData: {}
  };
}

function student(
  studentKey,
  seatIndex,
  x,
  z,
  displayLabel = studentKey
) {
  return Object.freeze({
    studentKey,
    displayLabel,
    seatIndex,
    position: Object.freeze({
      x,
      y: 0,
      z
    })
  });
}

test(
  "CW05 C2B2A student scene roster lifecycle",
  async (t) => {
    await t.test(
      "creates one interactive mesh per roster identity",
      () => {
        const scene = createFakeScene();
        const interactiveMeshes = [];

        const roster =
          createStudentSceneRoster({
            scene,
            interactiveMeshes,
            createStudentMesh:
              () => createFakeMesh()
          });

        const result = roster.sync([
          student(
            "student-01",
            0,
            -2,
            -4,
            "Student 01"
          ),
          student(
            "student-02",
            1,
            0,
            -4,
            "Student 02"
          )
        ]);

        assert.equal(result.size, 2);
        assert.equal(scene.objects.length, 2);
        assert.equal(
          interactiveMeshes.length,
          2
        );

        assert.deepEqual(
          roster.keys(),
          [
            "student-01",
            "student-02"
          ]
        );

        assert.deepEqual(
          roster.get("student-01").userData,
          {
            studentKey: "student-01",
            displayLabel: "Student 01"
          }
        );
      }
    );

    await t.test(
      "keeps stable mesh identity while spatial data changes",
      () => {
        const scene = createFakeScene();
        const interactiveMeshes = [];

        const roster =
          createStudentSceneRoster({
            scene,
            interactiveMeshes,
            createStudentMesh:
              () => createFakeMesh()
          });

        roster.sync([
          student(
            "student-01",
            0,
            -2,
            -4
          )
        ]);

        const firstMesh =
          roster.get("student-01");

        roster.sync([
          student(
            "student-01",
            3,
            5,
            -8,
            "Updated Label"
          )
        ]);

        const secondMesh =
          roster.get("student-01");

        assert.equal(
          firstMesh,
          secondMesh
        );

        assert.equal(
          scene.objects.length,
          1
        );

        assert.equal(
          interactiveMeshes.length,
          1
        );

        assert.deepEqual(
          secondMesh.userData,
          {
            studentKey: "student-01",
            displayLabel: "Updated Label"
          }
        );

        assert.equal(
          secondMesh.position.x,
          5
        );

        assert.equal(
          secondMesh.position.z,
          -8
        );
      }
    );

    await t.test(
      "removes stale students from scene and raycast collection",
      () => {
        const scene = createFakeScene();
        const interactiveMeshes = [];

        const roster =
          createStudentSceneRoster({
            scene,
            interactiveMeshes,
            createStudentMesh:
              () => createFakeMesh()
          });

        roster.sync([
          student(
            "student-01",
            0,
            -2,
            -4
          ),
          student(
            "student-02",
            1,
            0,
            -4
          )
        ]);

        const removedMesh =
          roster.get("student-01");

        roster.sync([
          student(
            "student-02",
            0,
            0,
            -4
          )
        ]);

        assert.equal(
          roster.has("student-01"),
          false
        );

        assert.equal(
          roster.has("student-02"),
          true
        );

        assert.equal(
          scene.objects.includes(
            removedMesh
          ),
          false
        );

        assert.equal(
          interactiveMeshes.includes(
            removedMesh
          ),
          false
        );

        assert.equal(
          removedMesh.disposeState.geometry,
          1
        );

        assert.equal(
          removedMesh.disposeState.material,
          1
        );
      }
    );

    await t.test(
      "keeps mesh metadata identity-only",
      () => {
        const scene = createFakeScene();
        const interactiveMeshes = [];

        const roster =
          createStudentSceneRoster({
            scene,
            interactiveMeshes,
            createStudentMesh:
              () => createFakeMesh()
          });

        roster.sync([
          student(
            "student-01",
            0,
            -2,
            -4,
            "Student 01"
          )
        ]);

        const mesh =
          roster.get("student-01");

        assert.deepEqual(
          Object.keys(mesh.userData).sort(),
          [
            "displayLabel",
            "studentKey"
          ]
        );

        assert.equal(
          Object.isFrozen(mesh.userData),
          true
        );
      }
    );

    await t.test(
      "fails closed before live mutation on duplicate keys",
      () => {
        const scene = createFakeScene();
        const interactiveMeshes = [];

        const roster =
          createStudentSceneRoster({
            scene,
            interactiveMeshes,
            createStudentMesh:
              () => createFakeMesh()
          });

        roster.sync([
          student(
            "student-01",
            0,
            -2,
            -4
          )
        ]);

        const originalMesh =
          roster.get("student-01");

        assert.throws(
          () => {
            roster.sync([
              student(
                "student-02",
                0,
                0,
                -4
              ),
              student(
                "student-02",
                1,
                2,
                -4
              )
            ]);
          },
          /duplicate scene studentKey/
        );

        assert.equal(
          roster.get("student-01"),
          originalMesh
        );

        assert.equal(
          scene.objects.length,
          1
        );

        assert.equal(
          interactiveMeshes.length,
          1
        );
      }
    );

    await t.test(
      "dispose releases every owned mesh",
      () => {
        const scene = createFakeScene();
        const interactiveMeshes = [];

        const roster =
          createStudentSceneRoster({
            scene,
            interactiveMeshes,
            createStudentMesh:
              () => createFakeMesh()
          });

        roster.sync([
          student(
            "student-01",
            0,
            -2,
            -4
          ),
          student(
            "student-02",
            1,
            0,
            -4
          )
        ]);

        const first =
          roster.get("student-01");

        const second =
          roster.get("student-02");

        roster.dispose();

        assert.equal(
          roster.keys().length,
          0
        );

        assert.equal(
          scene.objects.length,
          0
        );

        assert.equal(
          interactiveMeshes.length,
          0
        );

        assert.equal(
          first.disposeState.geometry,
          1
        );

        assert.equal(
          first.disposeState.material,
          1
        );

        assert.equal(
          second.disposeState.geometry,
          1
        );

        assert.equal(
          second.disposeState.material,
          1
        );
      }
    );

    await t.test(
      "rejects invalid dependencies",
      () => {
        assert.throws(
          () => {
            createStudentSceneRoster({
              scene: null,
              interactiveMeshes: [],
              createStudentMesh() {}
            });
          },
          /scene/
        );

        assert.throws(
          () => {
            createStudentSceneRoster({
              scene: createFakeScene(),
              interactiveMeshes: null,
              createStudentMesh() {}
            });
          },
          /interactiveMeshes/
        );

        assert.throws(
          () => {
            createStudentSceneRoster({
              scene: createFakeScene(),
              interactiveMeshes: [],
              createStudentMesh: null
            });
          },
          /createStudentMesh/
        );
      }
    );
  }
);