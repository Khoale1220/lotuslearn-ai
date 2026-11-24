import assert from "node:assert/strict";

import {
  describe,
  it
} from "node:test";

import {
  CLASSROOM_32BIT_PALETTE,
  createClassroomMaterialLibrary
} from "./classroomVisualSystem.js";

import {
  ROOM_HALF_EXTENT,
  getClassroomWindowLayout
} from "./classroomArchitectureV2.js";

describe(
  "CW06 32-bit classroom visual foundation",
  () => {
    it(
      "defines a deterministic color palette",
      () => {
        const colors =
          Object.values(
            CLASSROOM_32BIT_PALETTE
          );

        assert.ok(
          colors.length >= 10
        );

        for (
          const color
          of colors
        ) {
          assert.equal(
            Number.isInteger(color),
            true
          );

          assert.ok(
            color >= 0
          );

          assert.ok(
            color <= 0xffffff
          );
        }
      }
    );

    it(
      "shares physically based classroom materials",
      () => {
        const materials =
          createClassroomMaterialLibrary();

        const values =
          Object.values(
            materials
          );

        assert.ok(
          values.length >= 8
        );

        for (
          const material
          of values
        ) {
          assert.equal(
            material.isMeshStandardMaterial,
            true
          );

          assert.equal(
            material.flatShading,
            true
          );

          material.dispose();
        }
      }
    );

    it(
      "defines three non-overlapping window modules",
      () => {
        const windows =
          getClassroomWindowLayout();

        assert.equal(
          windows.length,
          3
        );

        assert.equal(
          new Set(
            windows.map(
              (windowDefinition) =>
                windowDefinition.id
            )
          ).size,
          3
        );

        for (
          const windowDefinition
          of windows
        ) {
          assert.ok(
            windowDefinition.x <
            ROOM_HALF_EXTENT
          );

          assert.ok(
            windowDefinition.x >
            ROOM_HALF_EXTENT - 0.5
          );

          assert.ok(
            Math.abs(
              windowDefinition.z
            ) < ROOM_HALF_EXTENT
          );

          assert.ok(
            windowDefinition.width > 2
          );

          assert.ok(
            windowDefinition.height > 1
          );

          assert.equal(
            windowDefinition.rotationY,
            -Math.PI / 2
          );
        }
      }
    );
  }
);