import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import {
  CLASSROOM_OCEAN_ATMOSPHERE_DEPTH_V19_PROFILE,
  createClassroomOceanAtmosphereDepthV19
} from "./classroomOceanAtmosphereDepthV19.js";

function createFixture() {
  const scene =
    new THREE.Scene();

  const camera =
    new THREE.PerspectiveCamera(
      70,
      16 / 9,
      0.1,
      80
    );

  const oceanWorld = {
    getSnapshot() {
      return Object.freeze({
        oceanY: -3
      });
    }
  };

  return {
    scene,
    camera,
    oceanWorld
  };
}

function compact(
  snapshot
) {
  return {
    clouds:
      snapshot.clouds.map(
        (item) => [
          item.index,
          Number(
            item.x.toFixed(7)
          ),
          Number(
            item.y.toFixed(7)
          ),
          Number(
            item.z.toFixed(7)
          )
        ]
      ),

    whitecaps:
      snapshot.whitecaps.map(
        (item) => [
          item.index,
          Number(
            item.x.toFixed(7)
          ),
          Number(
            item.y.toFixed(7)
          ),
          Number(
            item.z.toFixed(7)
          ),
          Number(
            item.opacity.toFixed(7)
          )
        ]
      ),

    glints:
      snapshot.glints.map(
        (item) => [
          item.index,
          Number(
            item.x.toFixed(7)
          ),
          Number(
            item.y.toFixed(7)
          ),
          Number(
            item.z.toFixed(7)
          ),
          Number(
            item.opacity.toFixed(7)
          )
        ]
      )
  };
}

test(
  "V19 creates deterministic ocean atmospheric depth layers",
  () => {
    const fixture =
      createFixture();

    const system =
      createClassroomOceanAtmosphereDepthV19({
        ...fixture,
        documentObject: null
      });

    const snapshot =
      system.getSnapshot();

    assert.equal(
      snapshot.hazePanelCount,
      4
    );

    assert.equal(
      snapshot.cloudCount,
      9
    );

    assert.equal(
      snapshot.whitecapCount,
      36
    );

    assert.equal(
      snapshot.horizonGlintCount,
      12
    );

    assert.equal(
      snapshot.oceanY,
      -3
    );

    assert.equal(
      snapshot.visualOnly,
      true
    );

    assert.equal(
      snapshot.deterministic,
      true
    );

    assert.equal(
      snapshot.globalFogMutations,
      0
    );

    assert.equal(
      CLASSROOM_OCEAN_ATMOSPHERE_DEPTH_V19_PROFILE
        .interactionAuthorityMutations,
      0
    );

    system.dispose();
  }
);

test(
  "V19 reproduces identical atmosphere state for identical timelines",
  () => {
    const fixtureA =
      createFixture();

    const fixtureB =
      createFixture();

    const systemA =
      createClassroomOceanAtmosphereDepthV19({
        ...fixtureA,
        documentObject: null
      });

    const systemB =
      createClassroomOceanAtmosphereDepthV19({
        ...fixtureB,
        documentObject: null
      });

    const sequence = [
      0.016,
      0.033,
      0.016,
      0.050,
      0.025,
      0.041,
      0.016
    ];

    for (
      const deltaSeconds
      of sequence
    ) {
      systemA.tick({
        deltaSeconds
      });

      systemB.tick({
        deltaSeconds
      });
    }

    assert.deepEqual(
      compact(
        systemA.getSnapshot()
      ),
      compact(
        systemB.getSnapshot()
      )
    );

    systemA.dispose();
    systemB.dispose();
  }
);

test(
  "V19 atmospheric objects never participate in interaction raycasts",
  () => {
    const fixture =
      createFixture();

    const system =
      createClassroomOceanAtmosphereDepthV19({
        ...fixture,
        documentObject: null
      });

    const objects =
      fixture.scene.children.filter(
        (object) =>
          object.userData
            ?.cw06OceanAtmosphereV19
      );

    assert.equal(
      objects.length,
      61
    );

    for (const object of objects) {
      assert.equal(
        object.userData
          .visualOnly,
        true
      );

      assert.equal(
        object.userData
          .interactionExcluded,
        true
      );

      const hits = [];

      object.raycast(
        new THREE.Raycaster(),
        hits
      );

      assert.equal(
        hits.length,
        0
      );
    }

    system.dispose();
  }
);

test(
  "V19 does not mutate scene fog",
  () => {
    const fixture =
      createFixture();

    const originalFog =
      new THREE.Fog(
        0x17151f,
        12,
        24
      );

    fixture.scene.fog =
      originalFog;

    const system =
      createClassroomOceanAtmosphereDepthV19({
        ...fixture,
        documentObject: null
      });

    assert.equal(
      fixture.scene.fog,
      originalFog
    );

    system.tick({
      deltaSeconds: 0.05
    });

    assert.equal(
      fixture.scene.fog,
      originalFog
    );

    system.dispose();

    assert.equal(
      fixture.scene.fog,
      originalFog
    );
  }
);

test(
  "V19 dispose removes every atmosphere object",
  () => {
    const fixture =
      createFixture();

    const system =
      createClassroomOceanAtmosphereDepthV19({
        ...fixture,
        documentObject: null
      });

    assert.equal(
      fixture.scene.children.filter(
        (object) =>
          object.userData
            ?.cw06OceanAtmosphereV19
      ).length,
      61
    );

    system.dispose();

    assert.equal(
      fixture.scene.children.filter(
        (object) =>
          object.userData
            ?.cw06OceanAtmosphereV19
      ).length,
      0
    );
  }
);
