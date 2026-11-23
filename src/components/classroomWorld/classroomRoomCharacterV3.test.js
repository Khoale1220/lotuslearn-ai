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
  ROOM_GEOMETRY_V3_CONFIG,
  createClassroomRoomGeometryV3
} from "./classroomRoomGeometryV3.js";

import {
  createClassroomCharacterV3
} from "./classroomCharacterV3.js";

describe(
  "CW06 Room Geometry V3 and Character V3",
  () => {
    it(
      "creates static room-detail geometry with instanced ceiling",
      () => {
        const scene =
          new THREE.Scene();

        const materials =
          createClassroomMaterialLibrary();

        const room =
          createClassroomRoomGeometryV3({
            scene,
            materials
          });

        assert.equal(
          room.ceilingTileCount,
          ROOM_GEOMETRY_V3_CONFIG
            .ceilingTileCount
        );

        const ceiling =
          room.group.getObjectByName(
            "ceiling-tiles-v3-instanced"
          );

        assert.ok(
          ceiling
        );

        assert.equal(
          ceiling.isInstancedMesh,
          true
        );

        assert.equal(
          ceiling.count,
          25
        );

        assert.ok(
          ceiling.boundingBox
        );

        assert.ok(
          ceiling.boundingSphere
        );

        assert.equal(
          ceiling.matrixAutoUpdate,
          false
        );

        let staticMeshCount =
          0;

        room.group.traverse(
          (object) => {
            if (
              object.isMesh
            ) {
              staticMeshCount += 1;

              assert.equal(
                object.matrixAutoUpdate,
                false
              );
            }
          }
        );

        assert.ok(
          staticMeshCount >= 15
        );

        room.dispose();

        for (
          const material
          of Object.values(materials)
        ) {
          material.dispose();
        }
      }
    );

    it(
      "derives detailed characters from Student Visual V2 matrices",
      () => {
        const scene =
          new THREE.Scene();

        const sourceGeometry =
          new THREE.BoxGeometry(
            1,
            1,
            1
          );

        const sourceMaterial =
          new THREE.MeshBasicMaterial();

        const hair =
          new THREE.InstancedMesh(
            sourceGeometry,
            sourceMaterial,
            2
          );

        hair.name =
          "student-visual-v2-hair";

        hair.count =
          2;

        const backpacks =
          new THREE.InstancedMesh(
            sourceGeometry,
            sourceMaterial,
            2
          );

        backpacks.name =
          "student-visual-v2-backpacks";

        backpacks.count =
          2;

        const transform =
          new THREE.Object3D();

        for (
          let index = 0;
          index < 2;
          index += 1
        ) {
          transform.position.set(
            index * 1.4,
            1.65,
            0
          );

          transform.scale.set(
            0.43,
            0.14,
            0.34
          );

          transform.updateMatrix();

          hair.setMatrixAt(
            index,
            transform.matrix
          );

          transform.position.set(
            index * 1.4,
            1.02,
            0.12
          );

          transform.scale.set(
            0.34,
            0.51,
            0.12
          );

          transform.updateMatrix();

          backpacks.setMatrixAt(
            index,
            transform.matrix
          );
        }

        hair.instanceMatrix
          .needsUpdate =
            true;

        backpacks.instanceMatrix
          .needsUpdate =
            true;

        scene.add(
          hair
        );

        scene.add(
          backpacks
        );

        const characters =
          createClassroomCharacterV3({
            scene,
            maxStudents: 8
          });

        const result =
          characters.sync();

        assert.equal(
          result.count,
          2
        );

        assert.equal(
          characters.getStudentCount(),
          2
        );

        const heads =
          characters.group
            .getObjectByName(
              "student-character-v3-heads"
            );

        const torsos =
          characters.group
            .getObjectByName(
              "student-character-v3-torsos"
            );

        const arms =
          characters.group
            .getObjectByName(
              "student-character-v3-arms"
            );

        const legs =
          characters.group
            .getObjectByName(
              "student-character-v3-legs"
            );

        const shoes =
          characters.group
            .getObjectByName(
              "student-character-v3-shoes"
            );

        assert.equal(
          heads.count,
          2
        );

        assert.equal(
          torsos.count,
          2
        );

        assert.equal(
          arms.count,
          4
        );

        assert.equal(
          legs.count,
          4
        );

        assert.equal(
          shoes.count,
          4
        );

        for (
          const mesh
          of [
            heads,
            torsos,
            arms,
            legs,
            shoes
          ]
        ) {
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

        characters.dispose();

        hair.dispose();
        backpacks.dispose();

        sourceGeometry.dispose();
        sourceMaterial.dispose();
      }
    );
  }
);