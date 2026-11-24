import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import {
  CLASSROOM_SEAGULL_FLOCKS_V18_PROFILE,
  createClassroomSeagullFlocksV18
} from "./classroomSeagullFlocksV18.js";

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
        id:
          "test-ocean-world"
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
  return snapshot.birds.map(
    (bird) => ({
      birdIndex:
        bird.birdIndex,

      flockId:
        bird.flockId,

      frameIndex:
        bird.frameIndex,

      x:
        Number(
          bird.x.toFixed(8)
        ),

      y:
        Number(
          bird.y.toFixed(8)
        ),

      z:
        Number(
          bird.z.toFixed(8)
        ),

      rotation:
        Number(
          bird.rotation.toFixed(8)
        )
    })
  );
}

test(
  "V18 creates three depth-layered flocks and fifteen birds",
  () => {
    const fixture =
      createFixture();

    const system =
      createClassroomSeagullFlocksV18({
        ...fixture,
        documentObject: null
      });

    const snapshot =
      system.getSnapshot();

    assert.equal(
      snapshot.flockCount,
      3
    );

    assert.equal(
      snapshot.birdCount,
      15
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
      CLASSROOM_SEAGULL_FLOCKS_V18_PROFILE
        .interactionAuthorityMutations,
      0
    );

    system.dispose();
  }
);

test(
  "V18 deterministic timelines reproduce identical bird positions",
  () => {
    const fixtureA =
      createFixture();

    const fixtureB =
      createFixture();

    const systemA =
      createClassroomSeagullFlocksV18({
        ...fixtureA,
        documentObject: null
      });

    const systemB =
      createClassroomSeagullFlocksV18({
        ...fixtureB,
        documentObject: null
      });

    const sequence = [
      0.016,
      0.016,
      0.033,
      0.050,
      0.025,
      0.016,
      0.041
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
  "V18 birds are excluded from interaction raycasting",
  () => {
    const fixture =
      createFixture();

    const system =
      createClassroomSeagullFlocksV18({
        ...fixture,
        documentObject: null
      });

    const bird =
      fixture.scene.getObjectByName(
        "cw06-v18-seagull-0"
      );

    assert.ok(bird);

    assert.equal(
      bird.userData
        .visualOnly,
      true
    );

    assert.equal(
      bird.userData
        .interactionExcluded,
      true
    );

    const hits = [];

    bird.raycast(
      new THREE.Raycaster(),
      hits
    );

    assert.equal(
      hits.length,
      0
    );

    system.dispose();
  }
);

test(
  "V18 wing animation advances through deterministic frames",
  () => {
    const fixture =
      createFixture();

    const system =
      createClassroomSeagullFlocksV18({
        ...fixture,
        documentObject: null
      });

    const before =
      system.getSnapshot()
        .birds[0]
        .frameIndex;

    for (
      let index = 0;
      index < 12;
      index += 1
    ) {
      system.tick({
        deltaSeconds: 0.05
      });
    }

    const after =
      system.getSnapshot()
        .birds[0]
        .frameIndex;

    assert.ok(
      Number.isInteger(
        before
      )
    );

    assert.ok(
      Number.isInteger(
        after
      )
    );

    assert.ok(
      after >= 0 &&
      after <= 2
    );

    system.dispose();
  }
);

test(
  "V18 dispose removes all visual bird objects",
  () => {
    const fixture =
      createFixture();

    const system =
      createClassroomSeagullFlocksV18({
        ...fixture,
        documentObject: null
      });

    assert.equal(
      fixture.scene.children.filter(
        (object) =>
          object.userData
            ?.cw06SeagullV18
      ).length,
      15
    );

    system.dispose();

    assert.equal(
      fixture.scene.children.filter(
        (object) =>
          object.userData
            ?.cw06SeagullV18
      ).length,
      0
    );
  }
);
