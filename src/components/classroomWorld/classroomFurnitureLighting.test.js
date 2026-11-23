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
  createClassroomFurnitureV2,
  getClassroomFurnitureLayout
} from "./classroomFurnitureV2.js";

import {
  CLASSROOM_LIGHTING_CONFIG,
  createClassroomLightingV2
} from "./classroomLightingV2.js";

describe(
  "CW06 Classroom Environment V2",
  () => {
    it(
      "defines deterministic perimeter furniture",
      () => {
        const layout =
          getClassroomFurnitureLayout();

        assert.equal(
          layout.storageWall
            .zPositions
            .length,
          9
        );

        assert.ok(
          layout.teacherStation.z < -5
        );

        assert.ok(
          layout.readingShelf.z > 6
        );
      }
    );

    it(
      "creates reusable and instanced furniture",
      () => {
        const scene =
          new THREE.Scene();

        const materials =
          createClassroomMaterialLibrary();

        const furniture =
          createClassroomFurnitureV2({
            scene,
            materials
          });

        assert.equal(
          scene.children.includes(
            furniture.group
          ),
          true
        );

        const instancedMeshes = [];

        furniture.group.traverse(
          (object) => {
            if (
              object.isInstancedMesh
            ) {
              instancedMeshes.push(
                object
              );
            }
          }
        );

        assert.equal(
          instancedMeshes.length,
          1
        );

        assert.equal(
          furniture.storageInstanceCount,
          9
        );

        assert.ok(
          instancedMeshes[0]
            .boundingBox
        );

        assert.ok(
          instancedMeshes[0]
            .boundingSphere
        );

        furniture.dispose();

        assert.equal(
          scene.children.includes(
            furniture.group
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

    it(
      "uses one directional shadow caster and restores renderer state",
      () => {
        const scene =
          new THREE.Scene();

        const renderer = {
          shadowMap: {
            enabled: false,
            type:
              THREE.PCFShadowMap
          }
        };

        const lighting =
          createClassroomLightingV2({
            renderer,
            scene
          });

        assert.equal(
          renderer.shadowMap.enabled,
          true
        );

        assert.equal(
          renderer.shadowMap.type,
          THREE.BasicShadowMap
        );

        assert.equal(
          lighting.sunlight
            .castShadow,
          true
        );

        assert.equal(
          lighting.sunlight
            .shadow
            .mapSize
            .width,
          CLASSROOM_LIGHTING_CONFIG
            .shadowMapSize
        );

        assert.equal(
          lighting.ceilingPanelCount,
          6
        );

        const shadowCasters = [];

        lighting.group.traverse(
          (object) => {
            if (
              object.isLight &&
              object.castShadow
            ) {
              shadowCasters.push(
                object
              );
            }
          }
        );

        assert.equal(
          shadowCasters.length,
          1
        );

        lighting.dispose();

        assert.equal(
          renderer.shadowMap.enabled,
          false
        );

        assert.equal(
          renderer.shadowMap.type,
          THREE.PCFShadowMap
        );
      }
    );
  }
);