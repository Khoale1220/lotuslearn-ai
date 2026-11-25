import assert from "node:assert/strict";

import {
  describe,
  it
} from "node:test";

import * as THREE from "three";

import {
  CLASSROOM_CHARACTER_VISUAL_V10_PROFILE,
  classifyLegacyCharacterRole,
  collectLegacyCharacterVisualMeshes,
  createClassroomCharacterVisualIntegrationV10,
  findDominantInstanceCount,
  resolveStudentKeys,
  selectLegacyCharacterAnchor
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

function createInstancedPart({
  name,
  count,
  y
}) {
  const geometry =
    new THREE.BoxGeometry(
      0.45,
      0.2,
      0.3
    );

  const material =
    new THREE.MeshBasicMaterial();

  const mesh =
    new THREE.InstancedMesh(
      geometry,
      material,
      count
    );

  mesh.name =
    name;

  const matrix =
    new THREE.Matrix4();

  for (
    let index = 0;
    index <
      count;
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

  mesh.instanceMatrix.needsUpdate =
    true;

  return mesh;
}

function createFixture() {
  const scene =
    new THREE.Scene();

  const camera =
    new THREE.PerspectiveCamera(
      70,
      16 / 9,
      0.1,
      50
    );

  const shoes =
    createInstancedPart({
      name:
        "cw-character-v3-shoes",

      count:
        3,

      y:
        0.1
    });

  const legs =
    createInstancedPart({
      name:
        "cw-character-v3-legs",

      count:
        3,

      y:
        0.55
    });

  const torso =
    createInstancedPart({
      name:
        "cw-character-v3-torsos",

      count:
        3,

      y:
        1.1
    });

  const heads =
    createInstancedPart({
      name:
        "cw-character-v3-heads",

      count:
        3,

      y:
        1.75
    });

  scene.add(
    shoes,
    legs,
    torso,
    heads
  );

  const legacyCharacterSystem = {
    shoes,
    legs,
    torso,
    heads,

    studentKeys: [
      "student-alpha",
      "student-bravo",
      "student-charlie"
    ],

    getVisualMeshes() {
      return [
        {
          role: "shoes",
          mesh: shoes,
          instancesPerStudent: 1,
          canonicalAnchor: true
        },
        {
          role: "legs",
          mesh: legs,
          instancesPerStudent: 1,
          canonicalAnchor: false
        },
        {
          role: "torso",
          mesh: torso,
          instancesPerStudent: 1,
          canonicalAnchor: false
        },
        {
          role: "head",
          mesh: heads,
          instancesPerStudent: 1,
          canonicalAnchor: false
        }
      ];
    },

    getStudentCount() {
      return 3;
    }
  };

  return {
    scene,
    camera,
    shoes,
    legs,
    torso,
    heads,
    legacyCharacterSystem
  };
}

describe(
  "CW06 Character Visual Integration V10",
  () => {
    it(
      "classifies legacy character roles",
      () => {
        assert.equal(
          classifyLegacyCharacterRole(
            "cw character shoes"
          ),
          "shoes"
        );

        assert.equal(
          classifyLegacyCharacterRole(
            "student torso"
          ),
          "torso"
        );

        assert.equal(
          classifyLegacyCharacterRole(
            "avatar head"
          ),
          "head"
        );
      }
    );

    it(
      "discovers Character V3 instanced meshes",
      () => {
        const fixture =
          createFixture();

        const descriptors =
          collectLegacyCharacterVisualMeshes({
            scene:
              fixture.scene,

            legacyCharacterSystem:
              fixture.legacyCharacterSystem
          });

        assert.equal(
          descriptors.length,
          4
        );

        assert.equal(
          findDominantInstanceCount(
            descriptors
          ),
          3
        );
      }
    );

    it(
      "prefers shoes as the feet-aligned spatial anchor",
      () => {
        const fixture =
          createFixture();

        const descriptors =
          collectLegacyCharacterVisualMeshes({
            scene:
              fixture.scene,

            legacyCharacterSystem:
              fixture.legacyCharacterSystem
          });

        const selection =
          selectLegacyCharacterAnchor(
            descriptors
          );

        assert.equal(
          selection.descriptor.role,
          "shoes"
        );

        assert.equal(
          selection.descriptor.mesh,
          fixture.shoes
        );

        assert.equal(
          selection.dominantCount,
          3
        );
      }
    );

    it(
      "reuses legacy student identity ordering when available",
      () => {
        const fixture =
          createFixture();

        const identity =
          resolveStudentKeys({
            legacyCharacterSystem:
              fixture.legacyCharacterSystem,

            anchorMesh:
              fixture.shoes,

            studentCount:
              3
          });

        assert.deepEqual(
          identity.keys,
          [
            "student-alpha",
            "student-bravo",
            "student-charlie"
          ]
        );

        assert.equal(
          identity.synthetic,
          false
        );
      }
    );

    it(
      "has deterministic fallback identities",
      () => {
        const fixture =
          createFixture();

        const identity =
          resolveStudentKeys({
            legacyCharacterSystem: {
              shoes:
                fixture.shoes
            },

            anchorMesh:
              fixture.shoes,

            studentCount:
              3
          });

        assert.deepEqual(
          identity.keys,
          [
            "student-slot-001",
            "student-slot-002",
            "student-slot-003"
          ]
        );

        assert.equal(
          identity.synthetic,
          true
        );
      }
    );

    it(
      "migrates rendering to V9 sprites while preserving V3 objects",
      () => {
        const fixture =
          createFixture();

        const integration =
          createClassroomCharacterVisualIntegrationV10({
            scene:
              fixture.scene,

            camera:
              fixture.camera,

            legacyCharacterSystem:
              fixture.legacyCharacterSystem,

            documentObject:
              createFakeDocument()
          });

        const snapshot =
          integration.getSnapshot();

        assert.equal(
          snapshot.studentCount,
          3
        );

        assert.equal(
          snapshot.spriteCount,
          3
        );

        assert.equal(
          snapshot.legacyMeshCount,
          4
        );

        assert.equal(
          snapshot.legacyMeshesHidden,
          true
        );

        assert.equal(
          snapshot.anchorRole,
          "shoes"
        );

        assert.equal(
          fixture.shoes.parent,
          fixture.scene
        );

        assert.equal(
          fixture.torso.parent,
          fixture.scene
        );

        assert.equal(
          fixture.shoes.visible,
          false
        );

        assert.equal(
          fixture.torso.visible,
          false
        );

        integration.dispose();
      }
    );

    it(
      "puts presentation sprites on a dedicated visual-only layer",
      () => {
        const fixture =
          createFixture();

        const integration =
          createClassroomCharacterVisualIntegrationV10({
            scene:
              fixture.scene,

            camera:
              fixture.camera,

            legacyCharacterSystem:
              fixture.legacyCharacterSystem,

            documentObject:
              createFakeDocument()
          });

        assert.equal(
          fixture.camera.layers.isEnabled(
            CLASSROOM_CHARACTER_VISUAL_V10_PROFILE
              .visualLayer
          ),
          true
        );

        for (
          const controller
          of integration.controllers
        ) {
          assert.equal(
            controller.sprite.layers.isEnabled(
              CLASSROOM_CHARACTER_VISUAL_V10_PROFILE
                .visualLayer
            ),
            true
          );

          assert.equal(
            controller.sprite.layers.isEnabled(
              0
            ),
            false
          );
        }

        /*
         * Legacy interaction proxies remain on layer zero.
         */
        assert.equal(
          fixture.shoes.layers.isEnabled(
            0
          ),
          true
        );

        integration.dispose();
      }
    );

    it(
      "drives all sprite animations from the shared runtime timestamp",
      () => {
        const fixture =
          createFixture();

        fixture.camera.position.set(
          4,
          1.6,
          3
        );

        const integration =
          createClassroomCharacterVisualIntegrationV10({
            scene:
              fixture.scene,

            camera:
              fixture.camera,

            legacyCharacterSystem:
              fixture.legacyCharacterSystem,

            documentObject:
              createFakeDocument()
          });

        integration.tick({
          timestamp:
            1000,
          camera:
            fixture.camera
        });

        for (
          const controller
          of integration.controllers
        ) {
          const snapshot =
            controller.getSnapshot();

          assert.ok(
            snapshot.directionIndex >=
              0
          );

          assert.ok(
            snapshot.directionIndex <
              8
          );

          assert.ok(
            snapshot.animationFrame >=
              0
          );

          assert.ok(
            snapshot.animationFrame <
              4
          );
        }

        integration.dispose();
      }
    );

    it(
      "restores legacy visibility and camera layers during disposal",
      () => {
        const fixture =
          createFixture();

        assert.equal(
          fixture.camera.layers.isEnabled(
            30
          ),
          false
        );

        const integration =
          createClassroomCharacterVisualIntegrationV10({
            scene:
              fixture.scene,

            camera:
              fixture.camera,

            legacyCharacterSystem:
              fixture.legacyCharacterSystem,

            documentObject:
              createFakeDocument()
          });

        integration.dispose();

        assert.equal(
          fixture.shoes.visible,
          true
        );

        assert.equal(
          fixture.legs.visible,
          true
        );

        assert.equal(
          fixture.torso.visible,
          true
        );

        assert.equal(
          fixture.heads.visible,
          true
        );

        assert.equal(
          fixture.camera.layers.isEnabled(
            30
          ),
          false
        );

        for (
          const controller
          of integration.controllers
        ) {
          assert.equal(
            controller.sprite.parent,
            null
          );
        }
      }
    );
  }
);