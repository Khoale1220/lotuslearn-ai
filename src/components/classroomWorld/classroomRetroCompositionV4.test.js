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
  createClassroomRetroCompositionV4,
  createRetroMaterialTextureSet,
  getRetroCompositionV4Profile
} from "./classroomRetroCompositionV4.js";

function disposeTextureSet(
  textures
) {
  for (
    const [
      key,
      value
    ]
    of Object.entries(textures)
  ) {
    if (
      key ===
      "studentSprites"
    ) {
      for (
        const texture
        of value
      ) {
        texture.dispose();
      }

      continue;
    }

    value.dispose();
  }
}

describe(
  "CW06 Retro Material Kit and Composition V4",
  () => {
    it(
      "uses intentionally tiny retro texture resolutions",
      () => {
        const profile =
          getRetroCompositionV4Profile();

        assert.equal(
          profile.wallTexture,
          32
        );

        assert.equal(
          profile.woodTexture,
          32
        );

        assert.equal(
          profile.floorTexture,
          64
        );

        assert.equal(
          profile.studentSpriteWidth,
          32
        );

        assert.equal(
          profile.studentSpriteHeight,
          48
        );

        assert.equal(
          profile.studentSpriteVariants,
          4
        );
      }
    );

    it(
      "configures repeating materials for nearest-neighbor texels",
      () => {
        const textures =
          createRetroMaterialTextureSet();

        for (
          const texture
          of [
            textures.wall,
            textures.wood,
            textures.metal,
            textures.chalkboard,
            textures.floor
          ]
        ) {
          assert.equal(
            texture.magFilter,
            THREE.NearestFilter
          );

          assert.equal(
            texture.minFilter,
            THREE.NearestFilter
          );

          assert.equal(
            texture.generateMipmaps,
            false
          );

          assert.equal(
            texture.anisotropy,
            1
          );
        }

        assert.equal(
          textures.wall.wrapS,
          THREE.RepeatWrapping
        );

        assert.equal(
          textures.floor.wrapT,
          THREE.RepeatWrapping
        );

        assert.equal(
          textures.studentSprites.length,
          4
        );

        disposeTextureSet(
          textures
        );
      }
    );

    it(
      "builds desk rows and billboard students from student source matrices",
      () => {
        const scene =
          new THREE.Scene();

        const materials =
          createClassroomMaterialLibrary();

        const sourceGeometry =
          new THREE.BoxGeometry(
            1,
            1,
            1
          );

        const sourceMaterial =
          new THREE.MeshBasicMaterial();

        const backpacks =
          new THREE.InstancedMesh(
            sourceGeometry,
            sourceMaterial,
            3
          );

        backpacks.name =
          "student-visual-v2-backpacks";

        backpacks.count =
          3;

        const sourceRoot =
          new THREE.Group();

        sourceRoot.name =
          "classroom-student-visual-v2";

        sourceRoot.add(
          backpacks
        );

        scene.add(
          sourceRoot
        );

        const oldCharacter =
          new THREE.Group();

        oldCharacter.name =
          "classroom-character-v3";

        scene.add(
          oldCharacter
        );

        const transform =
          new THREE.Object3D();

        for (
          let index = 0;
          index < 3;
          index += 1
        ) {
          transform.position.set(
            -1.8 +
            index * 1.8,

            1.02,

            1.4
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

        backpacks.instanceMatrix
          .needsUpdate =
            true;

        const composition =
          createClassroomRetroCompositionV4({
            scene,
            materials,
            maxStudents: 8
          });

        const result =
          composition.sync();

        assert.equal(
          result.count,
          3
        );

        assert.equal(
          composition.getDeskCount(),
          3
        );

        assert.equal(
          composition.getStudentCount(),
          3
        );

        const desks =
          composition.group
            .getObjectByName(
              "retro-student-desks-v4"
            );

        const legs =
          composition.group
            .getObjectByName(
              "retro-student-desk-legs-v4"
            );

        assert.equal(
          desks.count,
          3
        );

        assert.equal(
          legs.count,
          12
        );

        assert.ok(
          desks.boundingBox
        );

        assert.ok(
          desks.boundingSphere
        );

        const camera =
          new THREE.PerspectiveCamera();

        camera.position.set(
          0,
          1.6,
          6
        );

        camera.lookAt(
          0,
          1.2,
          0
        );

        camera.updateMatrixWorld();

        composition.tick(
          camera
        );

        const spriteCount =
          composition.group.children
            .filter(
              (object) =>
                object.name.startsWith(
                  "retro-student-sprites-v4-"
                )
            )
            .reduce(
              (
                total,
                mesh
              ) =>
                total +
                mesh.count,

              0
            );

        assert.equal(
          spriteCount,
          3
        );

        assert.equal(
          sourceRoot.visible,
          false
        );

        assert.equal(
          oldCharacter.visible,
          false
        );

        composition.dispose();

        assert.equal(
          sourceRoot.visible,
          true
        );

        assert.equal(
          oldCharacter.visible,
          true
        );

        sourceGeometry.dispose();
        sourceMaterial.dispose();

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