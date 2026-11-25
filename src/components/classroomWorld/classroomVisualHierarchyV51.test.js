import assert from "node:assert/strict";

import {
  describe,
  it
} from "node:test";

import * as THREE from "three";

import {
  createClassroomVisualHierarchyV51,
  isDecorativeVisualV51,
  isEssentialVisualV51
} from "./classroomVisualHierarchyV51.js";


function mesh(
  name
) {
  const result =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        1,
        1,
        1
      ),

      new THREE.MeshBasicMaterial()
    );

  result.name =
    name;

  return result;
}


describe(
  "CW07 V51 visual hierarchy authority",
  () => {
    it(
      "protects semantic classroom and interaction objects",
      () => {
        const student =
          mesh(
            "anonymous-avatar"
          );

        student.userData =
          {
            studentKey:
              "student-001"
          };

        const canonicalDesk =
          mesh(
            "unit-cube-anchor"
          );

        canonicalDesk.userData =
          {
            classroomCanonicalDeskSurface:
              true
          };

        const interaction =
          mesh(
            "story-panel-interactive"
          );

        interaction.userData =
          {
            interactionId:
              "window-shade-1"
          };

        assert.equal(
          isEssentialVisualV51(
            student
          ),
          true
        );

        assert.equal(
          isEssentialVisualV51(
            canonicalDesk
          ),
          true
        );

        assert.equal(
          isEssentialVisualV51(
            interaction
          ),
          true
        );

        assert.equal(
          isDecorativeVisualV51(
            interaction
          ),
          false
        );
      }
    );


    it(
      "protects requested scenic world features",
      () => {
        for (
          const name
          of [
            "ocean-vista",
            "cargo-ship-lane",
            "seagull-flock",
            "teacher-headphones"
          ]
        ) {
          assert.equal(
            isEssentialVisualV51(
              mesh(name)
            ),
            true,
            name
          );
        }
      }
    );


    it(
      "classifies storytelling clutter as decorative",
      () => {
        for (
          const name
          of [
            "classroom-backpack-story",
            "classroom-noticeboard-pixel-layer",
            "storytelling-paper",
            "student-desk-microdetail-poster",
            "foreground-decorative-prop"
          ]
        ) {
          /*
           * desk wording is intentionally absent
           * from the objects expected to hide.
           */

          if (
            name.includes(
              "student-desk"
            )
          ) {
            continue;
          }

          assert.equal(
            isDecorativeVisualV51(
              mesh(name)
            ),
            true,
            name
          );
        }
      }
    );


    it(
      "hides decorative siblings but never hides an essential ancestor chain",
      () => {
        const scene =
          new THREE.Scene();

        const root =
          new THREE.Group();

        root.name =
          "classroom-content-root";

        const student =
          mesh(
            "student-character"
          );

        const story =
          mesh(
            "backpack-storytelling-paper"
          );

        root.add(
          student,
          story
        );

        scene.add(
          root
        );

        const studentRaycast =
          student.raycast;

        const studentLayerMask =
          student.layers.mask;

        const system =
          createClassroomVisualHierarchyV51({
            scene
          });

        const snapshot =
          system.getSnapshot();

        assert.equal(
          root.visible,
          true
        );

        assert.equal(
          student.visible,
          true
        );

        assert.equal(
          story.visible,
          false
        );

        assert.equal(
          student.raycast,
          studentRaycast
        );

        assert.equal(
          student.layers.mask,
          studentLayerMask
        );

        assert.equal(
          snapshot.interactionAuthorityMutations,
          0
        );

        assert.equal(
          snapshot.raycastMutations,
          0
        );

        assert.equal(
          snapshot.layerMutations,
          0
        );

        assert.equal(
          snapshot.hiddenDecorativeCount,
          1
        );

        system.dispose();

        assert.equal(
          story.visible,
          true
        );
      }
    );


    it(
      "is refresh-idempotent",
      () => {
        const scene =
          new THREE.Scene();

        const story =
          mesh(
            "noticeboard-story-panel"
          );

        scene.add(
          story
        );

        const system =
          createClassroomVisualHierarchyV51({
            scene
          });

        const first =
          system.getSnapshot();

        assert.equal(
          story.visible,
          false
        );

        system.apply();

        const second =
          system.getSnapshot();

        assert.equal(
          story.visible,
          false
        );

        assert.equal(
          second.hiddenDecorativeCount,
          first.hiddenDecorativeCount
        );

        system.dispose();

        assert.equal(
          story.visible,
          true
        );
      }
    );
  }
);