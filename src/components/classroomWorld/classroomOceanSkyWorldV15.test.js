import assert from "node:assert/strict";

import {
  describe,
  it
} from "node:test";

import * as THREE from "three";

import {
  CLASSROOM_OCEAN_SKY_WORLD_V15_PROFILE,
  createClassroomOceanSkyWorldV15
} from "./classroomOceanSkyWorldV15.js";

describe(
  "CW06 ocean sky world V15",
  () => {
    it(
      "locks VGA pixel-art profile",
      () => {
        const profile =
          CLASSROOM_OCEAN_SKY_WORLD_V15_PROFILE;

        assert.equal(
          profile.artDirection,
          "HIGH_DETAIL_1990S_VGA_PIXEL_ART"
        );

        assert.equal(
          profile.oceanTextureWidth,
          64
        );

        assert.equal(
          profile.waveGlintCount,
          48
        );
      }
    );

    it(
      "constructs living ocean and sky",
      () => {
        const scene =
          new THREE.Scene();

        const system =
          createClassroomOceanSkyWorldV15({
            scene
          });

        assert.ok(
          scene.getObjectByName(
            "cw15-ocean-sky-world"
          )
        );

        assert.ok(
          scene.getObjectByName(
            "cw15-living-ocean"
          )
        );

        assert.ok(
          scene.getObjectByName(
            "cw15-vga-sky"
          )
        );

        assert.ok(
          scene.getObjectByName(
            "cw15-wave-glints"
          )
        );

        system.dispose();
      }
    );

    it(
      "uses nearest-filtered repeating ocean texture",
      () => {
        const scene =
          new THREE.Scene();

        const system =
          createClassroomOceanSkyWorldV15({
            scene
          });

        const ocean =
          scene.getObjectByName(
            "cw15-living-ocean"
          );

        assert.equal(
          ocean.material.map.magFilter,
          THREE.NearestFilter
        );

        assert.equal(
          ocean.material.map.minFilter,
          THREE.NearestFilter
        );

        assert.equal(
          ocean.material.map.wrapS,
          THREE.RepeatWrapping
        );

        assert.equal(
          ocean.material.map.generateMipmaps,
          false
        );

        system.dispose();
      }
    );

    it(
      "animates ocean deterministically from timestamp",
      () => {
        const scene =
          new THREE.Scene();

        const camera =
          new THREE.PerspectiveCamera();

        const system =
          createClassroomOceanSkyWorldV15({
            scene
          });

        const ocean =
          scene.getObjectByName(
            "cw15-living-ocean"
          );

        system.tick({
          timestamp: 1000,
          camera
        });

        const firstOffset =
          ocean.material.map.offset.x;

        system.tick({
          timestamp: 2000,
          camera
        });

        const secondOffset =
          ocean.material.map.offset.x;

        assert.notEqual(
          firstOffset,
          secondOffset
        );

        system.dispose();
      }
    );

    it(
      "removes world resources from scene on dispose",
      () => {
        const scene =
          new THREE.Scene();

        const system =
          createClassroomOceanSkyWorldV15({
            scene
          });

        system.dispose();

        assert.equal(
          scene.getObjectByName(
            "cw15-ocean-sky-world"
          ),
          undefined
        );

        assert.equal(
          system.getSnapshot().disposed,
          true
        );
      }
    );
  }
);