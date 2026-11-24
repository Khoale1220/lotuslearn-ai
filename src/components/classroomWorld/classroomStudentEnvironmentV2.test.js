import assert from "node:assert/strict";

import {
  describe,
  it
} from "node:test";

import * as THREE from "three";

import {
  createClassroomMaterialLibrary
} from "./classroomVisualSystem.js";

import {
  createStudentVisualV2,
  getStudentVisualVariant
} from "./classroomStudentVisualV2.js";

import {
  createEnvironmentDetailV2
} from "./classroomEnvironmentDetailV2.js";

describe(
  "CW06 Student Visual V2 and environment detail",
  () => {
    it(
      "derives deterministic student variants",
      () => {
        const first =
          getStudentVisualVariant(
            "student-alpha"
          );

        const second =
          getStudentVisualVariant(
            "student-alpha"
          );

        assert.deepEqual(
          first,
          second
        );

        assert.ok(
          Number.isInteger(
            first.hairColor
          )
        );

        assert.ok(
          Number.isInteger(
            first.backpackColor
          )
        );

        assert.ok(
          Number.isInteger(
            first.accentColor
          )
        );
      }
    );

    it(
      "augments detected students without replacing their interaction target",
      () => {
        const scene =
          new THREE.Scene();

        const studentRoot =
          new THREE.Group();

        studentRoot.name =
          "student-alpha";

        const studentGeometry =
          new THREE.BoxGeometry(
            0.7,
            1.4,
            0.5
          );

        const studentMaterial =
          new THREE.MeshBasicMaterial();

        const studentMesh =
          new THREE.Mesh(
            studentGeometry,
            studentMaterial
          );

        studentMesh.position.y =
          0.7;

        studentRoot.add(
          studentMesh
        );

        scene.add(
          studentRoot
        );

        const visual =
          createStudentVisualV2({
            scene,
            maxStudents: 8
          });

        const result =
          visual.sync();

        assert.equal(
          result.count,
          1
        );

        assert.equal(
          visual.getStudentCount(),
          1
        );

        const instanced =
          visual.group.children.filter(
            (object) =>
              object.isInstancedMesh
          );

        assert.equal(
          instanced.length,
          3
        );

        for (
          const mesh
          of instanced
        ) {
          assert.equal(
            mesh.count,
            1
          );

          assert.ok(
            mesh.instanceColor
          );

          assert.ok(
            mesh.boundingBox
          );

          assert.ok(
            mesh.boundingSphere
          );

          const intersections = [];

          mesh.raycast(
            {},
            intersections
          );

          assert.deepEqual(
            intersections,
            []
          );
        }

        assert.equal(
          scene.children.includes(
            studentRoot
          ),
          true
        );

        visual.dispose();

        assert.equal(
          scene.children.includes(
            studentRoot
          ),
          true
        );

        studentGeometry.dispose();
        studentMaterial.dispose();
      }
    );

    it(
      "creates non-interactive environment props with instanced plant leaves",
      () => {
        const scene =
          new THREE.Scene();

        const materials =
          createClassroomMaterialLibrary();

        const environment =
          createEnvironmentDetailV2({
            scene,
            materials
          });

        assert.equal(
          environment.leafInstanceCount,
          12
        );

        const leaves =
          environment.group.children.find(
            (object) =>
              object.isInstancedMesh
          );

        assert.ok(
          leaves
        );

        assert.equal(
          leaves.count,
          12
        );

        assert.ok(
          leaves.boundingBox
        );

        assert.ok(
          leaves.boundingSphere
        );

        const intersections = [];

        leaves.raycast(
          {},
          intersections
        );

        assert.deepEqual(
          intersections,
          []
        );

        environment.dispose();

        assert.equal(
          scene.children.includes(
            environment.group
          ),
          false
        );

        for (
          const material
          of Object.values(materials)
        ) {
          material.dispose();
        }
      }
    );
  }
);