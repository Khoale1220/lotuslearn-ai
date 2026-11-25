import assert from "node:assert/strict";

import {
  describe,
  it
} from "node:test";

import * as THREE from "three";

import {
  createClassroomCharacterVisualIntegrationV10
} from "./classroomCharacterVisualIntegrationV10.js";

function createFakeDocument() {
  return {
    createElement(
      tagName
    ) {
      assert.equal(
        tagName,
        "canvas"
      );

      const context = {
        fillStyle:
          "#000000",

        imageSmoothingEnabled:
          true,

        clearRect() {},

        fillRect() {}
      };

      return {
        width:
          0,

        height:
          0,

        getContext(
          contextType
        ) {
          assert.equal(
            contextType,
            "2d"
          );

          return context;
        }
      };
    }
  };
}

function createPart({
  name,
  capacity,
  count,
  y
}) {
  const mesh =
    new THREE.InstancedMesh(
      new THREE.BoxGeometry(
        0.45,
        0.2,
        0.3
      ),

      new THREE.MeshBasicMaterial(),

      capacity
    );

  mesh.name =
    name;

  const matrix =
    new THREE.Matrix4();

  for (
    let index = 0;
    index <
      capacity;
    index += 1
  ) {
    matrix.makeTranslation(
      index *
        1.5,
      y,
      0
    );

    mesh.setMatrixAt(
      index,
      matrix
    );
  }

  mesh.count =
    count;

  mesh.instanceMatrix.needsUpdate =
    true;

  return mesh;
}

function createFixture(
  initialStudentCount = 3
) {
  const scene =
    new THREE.Scene();

  const camera =
    new THREE.PerspectiveCamera(
      70,
      16 / 9,
      0.1,
      50
    );

  const heads =
    createPart({
      name:
        "cw-character-v3-heads",

      capacity:
        3,

      count:
        initialStudentCount,

      y:
        1.75
    });

  const torsos =
    createPart({
      name:
        "cw-character-v3-torsos",

      capacity:
        3,

      count:
        initialStudentCount,

      y:
        1.1
    });

  const arms =
    createPart({
      name:
        "cw-character-v3-arms",

      capacity:
        6,

      count:
        initialStudentCount *
        2,

      y:
        1.15
    });

  const legs =
    createPart({
      name:
        "cw-character-v3-legs",

      capacity:
        6,

      count:
        initialStudentCount *
        2,

      y:
        0.55
    });

  const shoes =
    createPart({
      name:
        "cw-character-v3-shoes",

      capacity:
        6,

      count:
        initialStudentCount *
        2,

      y:
        0.1
    });

  scene.add(
    heads,
    torsos,
    arms,
    legs,
    shoes
  );

  let studentCount =
    initialStudentCount;

  const system = {
    studentKeys: [
      "student-alpha",
      "student-bravo",
      "student-charlie"
    ],

    getVisualMeshes() {
      return [
        {
          role: "head",
          mesh: heads,
          instancesPerStudent: 1,
          canonicalAnchor: true
        },
        {
          role: "torso",
          mesh: torsos,
          instancesPerStudent: 1,
          canonicalAnchor: false
        },
        {
          role: "arms",
          mesh: arms,
          instancesPerStudent: 2,
          canonicalAnchor: false
        },
        {
          role: "legs",
          mesh: legs,
          instancesPerStudent: 2,
          canonicalAnchor: false
        },
        {
          role: "shoes",
          mesh: shoes,
          instancesPerStudent: 2,
          canonicalAnchor: false
        }
      ];
    },

    getStudentCount() {
      return studentCount;
    }
  };

  function setStudentCount(
    nextCount
  ) {
    studentCount =
      nextCount;

    heads.count =
      nextCount;

    torsos.count =
      nextCount;

    arms.count =
      nextCount *
      2;

    legs.count =
      nextCount *
      2;

    shoes.count =
      nextCount *
      2;
  }

  return {
    scene,
    camera,
    system,
    heads,
    torsos,
    arms,
    legs,
    shoes,
    setStudentCount
  };
}

describe(
  "CW06 V3 to V10 semantic cardinality",
  () => {
    it(
      "maps production N/N/2N/2N/2N to N students",
      () => {
        const fixture =
          createFixture(
            3
          );

        const integration =
          createClassroomCharacterVisualIntegrationV10({
            scene:
              fixture.scene,

            camera:
              fixture.camera,

            legacyCharacterSystem:
              fixture.system,

            documentObject:
              createFakeDocument()
          });

        const snapshot =
          integration.getSnapshot();

        assert.equal(
          fixture.heads.count,
          3
        );

        assert.equal(
          fixture.torsos.count,
          3
        );

        assert.equal(
          fixture.arms.count,
          6
        );

        assert.equal(
          fixture.legs.count,
          6
        );

        assert.equal(
          fixture.shoes.count,
          6
        );

        assert.equal(
          snapshot.semanticStudentCount,
          3
        );

        assert.equal(
          snapshot.spriteCount,
          3
        );

        assert.equal(
          snapshot.anchorRole,
          "head"
        );

        integration.dispose();
      }
    );

    it(
      "accepts zero population and hydrates exactly once on 0 to N",
      () => {
        const fixture =
          createFixture(
            0
          );

        const integration =
          createClassroomCharacterVisualIntegrationV10({
            scene:
              fixture.scene,

            camera:
              fixture.camera,

            legacyCharacterSystem:
              fixture.system,

            documentObject:
              createFakeDocument()
          });

        let snapshot =
          integration.getSnapshot();

        assert.equal(
          snapshot.populationState,
          "waiting-for-population"
        );

        assert.equal(
          snapshot.spriteCount,
          0
        );

        fixture.setStudentCount(
          3
        );

        integration.tick({
          timestamp:
            1000,

          camera:
            fixture.camera
        });

        snapshot =
          integration.getSnapshot();

        assert.equal(
          snapshot.populationState,
          "active"
        );

        assert.equal(
          snapshot.semanticStudentCount,
          3
        );

        assert.equal(
          snapshot.spriteCount,
          3
        );

        assert.equal(
          integration.controllers.length,
          3
        );

        integration.tick({
          timestamp:
            1016,

          camera:
            fixture.camera
        });

        assert.equal(
          integration.controllers.length,
          3
        );

        integration.dispose();
      }
    );
  }
);
