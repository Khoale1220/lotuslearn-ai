import assert from "node:assert/strict";

import {
  describe,
  it
} from "node:test";

import * as THREE from "three";

import {
  CLASSROOM_INTERACTION_AUTHORITY_V11_PROFILE,
  collectWindowShadeInteractionObjects,
  createClassroomInteractionAuthorityV11,
  deduplicateCandidates,
  resolveStudentKeyFromIntersection,
  sortInteractionCandidates
} from "./classroomInteractionAuthorityV11.js";

function createFakeWindow() {
  const listeners =
    new Map();

  return {
    addEventListener(
      type,
      listener
    ) {
      const values =
        listeners.get(
          type
        ) ??
        [];

      values.push(
        listener
      );

      listeners.set(
        type,
        values
      );
    },

    removeEventListener(
      type,
      listener
    ) {
      const values =
        listeners.get(
          type
        ) ??
        [];

      listeners.set(
        type,
        values.filter(
          (value) =>
            value !==
            listener
        )
      );
    },

    dispatchKey(
      code
    ) {
      let prevented =
        false;

      let stopped =
        false;

      const event = {
        code,

        repeat:
          false,

        target:
          null,

        preventDefault() {
          prevented =
            true;
        },

        stopImmediatePropagation() {
          stopped =
            true;
        }
      };

      for (
        const listener
        of (
          listeners.get(
            "keydown"
          ) ??
          []
        )
      ) {
        listener(
          event
        );

        if (stopped) {
          break;
        }
      }

      return {
        prevented,
        stopped
      };
    },

    listenerCount(
      type
    ) {
      return (
        listeners.get(
          type
        ) ??
        []
      ).length;
    }
  };
}

function createStudentFixture() {
  const scene =
    new THREE.Scene();

  const camera =
    new THREE.PerspectiveCamera(
      70,
      16 / 9,
      0.1,
      50
    );

  camera.position.set(
    0,
    0.5,
    0
  );

  camera.updateMatrixWorld(
    true
  );

  const geometry =
    new THREE.BoxGeometry(
      0.6,
      1.0,
      0.6
    );

  const material =
    new THREE.MeshBasicMaterial();

  const mesh =
    new THREE.InstancedMesh(
      geometry,
      material,
      1
    );

  mesh.name =
    "cw-character-v3-torso";

  const matrix =
    new THREE.Matrix4();

  matrix.makeTranslation(
    0,
    0.5,
    -2
  );

  mesh.setMatrixAt(
    0,
    matrix
  );

  mesh.instanceMatrix.needsUpdate =
    true;

  scene.add(
    mesh
  );

  scene.updateMatrixWorld(
    true
  );

  const characterVisualIntegration = {
    descriptors: [
      {
        mesh,
        role:
          "torso"
      }
    ],

    controllers: [
      {
        sprite: {
          userData: {
            studentKey:
              "student-alpha"
          }
        }
      }
    ]
  };

  return {
    scene,
    camera,
    mesh,
    characterVisualIntegration
  };
}

describe(
  "CW06 Interaction Authority V11",
  () => {
    it(
      "locks first-person center-ray authority profile",
      () => {
        const profile =
          CLASSROOM_INTERACTION_AUTHORITY_V11_PROFILE;

        assert.equal(
          profile.interactionKey,
          "KeyE"
        );

        assert.equal(
          profile.raycastLayer,
          0
        );

        assert.equal(
          profile.centerNdc.x,
          0
        );

        assert.equal(
          profile.centerNdc.y,
          0
        );

        assert.ok(
          profile.studentPriority >
          profile.windowShadePriority
        );
      }
    );

    it(
      "orders by distance before priority outside tie epsilon",
      () => {
        const student = {
          distance:
            2.0,

          priority:
            200,

          interactionKey:
            "student:a"
        };

        const shade = {
          distance:
            1.0,

          priority:
            100,

          interactionKey:
            "window:b"
        };

        assert.ok(
          sortInteractionCandidates(
            shade,
            student
          ) <
          0
        );
      }
    );

    it(
      "uses priority only for near-distance ties",
      () => {
        const student = {
          distance:
            1.01,

          priority:
            200,

          interactionKey:
            "student:a"
        };

        const shade = {
          distance:
            1.0,

          priority:
            100,

          interactionKey:
            "window:b"
        };

        const sorted =
          [
            shade,
            student
          ].sort(
            sortInteractionCandidates
          );

        assert.equal(
          sorted[0],
          student
        );
      }
    );

    it(
      "deduplicates repeated hits for the same authority target",
      () => {
        const result =
          deduplicateCandidates([
            {
              distance:
                1.2,

              priority:
                200,

              interactionKey:
                "student:a"
            },
            {
              distance:
                1.1,

              priority:
                200,

              interactionKey:
                "student:a"
            }
          ]);

        assert.equal(
          result.length,
          1
        );

        assert.equal(
          result[0].distance,
          1.1
        );
      }
    );

    it(
      "maps legacy instanceId back to V10 student identity",
      () => {
        const fixture =
          createStudentFixture();

        const studentKey =
          resolveStudentKeyFromIntersection({
            intersection: {
              instanceId:
                0
            },

            characterVisualIntegration:
              fixture.characterVisualIntegration
          });

        assert.equal(
          studentKey,
          "student-alpha"
        );
      }
    );

    it(
      "discovers window shades from scene metadata",
      () => {
        const scene =
          new THREE.Scene();

        const shade =
          new THREE.Mesh(
            new THREE.BoxGeometry(
              1,
              1,
              0.1
            ),
            new THREE.MeshBasicMaterial()
          );

        shade.name =
          "cw-v6-window-shade-east";

        scene.add(
          shade
        );

        const objects =
          collectWindowShadeInteractionObjects({
            scene,
            windowShadeSystem:
              {}
          });

        assert.equal(
          objects.includes(
            shade
          ),
          true
        );
      }
    );

    it(
      "selects student through hidden legacy raycast proxy",
      () => {
        const fixture =
          createStudentFixture();

        fixture.mesh.visible =
          false;

        let receivedCommand =
          null;

        const fakeWindow =
          createFakeWindow();

        const authority =
          createClassroomInteractionAuthorityV11({
            scene:
              fixture.scene,

            camera:
              fixture.camera,

            characterVisualIntegration:
              fixture.characterVisualIntegration,

            windowShadeSystem:
              {},

            onTeacherIntervention(
              command
            ) {
              receivedCommand =
                command;
            },

            windowObject:
              fakeWindow
          });

        const candidate =
          authority.pick();

        assert.ok(
          candidate
        );

        assert.equal(
          candidate.interactionType,
          "student"
        );

        assert.equal(
          candidate.studentKey,
          "student-alpha"
        );

        const result =
          authority.activateCandidate(
            candidate
          );

        assert.equal(
          result.handled,
          true
        );

        assert.deepEqual(
          receivedCommand,
          {
            studentKey:
              "student-alpha",

            actionType:
              "probe_understanding"
          }
        );

        authority.dispose();
      }
    );

    it(
      "enforces exactly-once KeyE student activation",
      () => {
        const fixture =
          createStudentFixture();

        const fakeWindow =
          createFakeWindow();

        let activationCount =
          0;

        const authority =
          createClassroomInteractionAuthorityV11({
            scene:
              fixture.scene,

            camera:
              fixture.camera,

            characterVisualIntegration:
              fixture.characterVisualIntegration,

            windowShadeSystem:
              {},

            onTeacherIntervention() {
              activationCount +=
                1;
            },

            windowObject:
              fakeWindow
          });

        const eventResult =
          fakeWindow.dispatchKey(
            "KeyE"
          );

        assert.equal(
          activationCount,
          1
        );

        assert.equal(
          eventResult.prevented,
          true
        );

        assert.equal(
          eventResult.stopped,
          true
        );

        authority.dispose();

        assert.equal(
          fakeWindow.listenerCount(
            "keydown"
          ),
          0
        );
      }
    );

    it(
      "uses discovered V6 shade invoker when available",
      () => {
        const scene =
          new THREE.Scene();

        const camera =
          new THREE.PerspectiveCamera(
            70,
            16 / 9,
            0.1,
            50
          );

        camera.position.set(
          0,
          0.5,
          0
        );

        camera.updateMatrixWorld(
          true
        );

        const shade =
          new THREE.Mesh(
            new THREE.BoxGeometry(
              1.2,
              1.5,
              0.1
            ),
            new THREE.MeshBasicMaterial()
          );

        shade.name =
          "cw-v6-window-shade-test";

        shade.position.set(
          0,
          0.5,
          -2
        );

        scene.add(
          shade
        );

        scene.updateMatrixWorld(
          true
        );

        let toggles =
          0;

        const windowShadeSystem = {
          shade,

          toggleWindowShade() {
            toggles +=
              1;
          }
        };

        const authority =
          createClassroomInteractionAuthorityV11({
            scene,
            camera,

            characterVisualIntegration: {
              descriptors:
                [],

              controllers:
                []
            },

            windowShadeSystem,

            onTeacherIntervention() {
              throw new Error(
                "student intervention not expected"
              );
            },

            windowObject:
              createFakeWindow()
          });

        const candidate =
          authority.pick();

        assert.ok(
          candidate
        );

        assert.equal(
          candidate.interactionType,
          "window-shade"
        );

        const result =
          authority.activateCandidate(
            candidate
          );

        assert.equal(
          result.handled,
          true
        );

        assert.equal(
          toggles,
          1
        );

        authority.dispose();
      }
    );
  }
);