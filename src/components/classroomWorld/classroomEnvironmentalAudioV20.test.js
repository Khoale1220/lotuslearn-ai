import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import {
  CLASSROOM_ENVIRONMENTAL_AUDIO_V20_PROFILE,
  createClassroomEnvironmentalAudioV20,
  createDeterministicNoiseSamplesV20,
  extractWindowShadeExposureV20
} from "./classroomEnvironmentalAudioV20.js";

test(
  "V20 deterministic noise is reproducible",
  () => {
    const first =
      createDeterministicNoiseSamplesV20({
        length: 64,
        seed: 123456
      });

    const second =
      createDeterministicNoiseSamplesV20({
        length: 64,
        seed: 123456
      });

    assert.deepEqual(
      Array.from(first),
      Array.from(second)
    );
  }
);

test(
  "V20 deterministic noise varies by seed",
  () => {
    const first =
      createDeterministicNoiseSamplesV20({
        length: 32,
        seed: 10
      });

    const second =
      createDeterministicNoiseSamplesV20({
        length: 32,
        seed: 11
      });

    assert.notDeepEqual(
      Array.from(first),
      Array.from(second)
    );
  }
);

test(
  "V20 extracts shade exposure",
  () => {
    const value =
      extractWindowShadeExposureV20({
        windowShades: [
          {
            openness: 0.25
          },
          {
            openness: 0.75
          }
        ]
      });

    assert.equal(
      value,
      0.5
    );
  }
);

test(
  "V20 extracts boolean door exposure",
  () => {
    assert.equal(
      extractWindowShadeExposureV20({
        doorOpen: false
      }),
      0
    );

    assert.equal(
      extractWindowShadeExposureV20({
        doorOpen: true
      }),
      1
    );
  }
);

test(
  "V20 remains lazy before user gesture",
  () => {
    const camera =
      new THREE.PerspectiveCamera();

    const audio =
      createClassroomEnvironmentalAudioV20({
        camera,

        windowShadeSystem: {
          getSnapshot() {
            return {
              shadeOpenRatio:
                0.6
            };
          }
        }
      });

    audio.tick({
      timestamp: 1200
    });

    const snapshot =
      audio.getSnapshot();

    assert.equal(
      snapshot.unlocked,
      false
    );

    assert.equal(
      snapshot.unlockAttempted,
      false
    );

    assert.equal(
      snapshot.contextState,
      "not-created"
    );

    assert.equal(
      snapshot.exposure,
      0.6
    );

    assert.equal(
      snapshot.lastTimestampMs,
      1200
    );

    audio.dispose();
  }
);

test(
  "V20 owns no gameplay authority",
  () => {
    const profile =
      CLASSROOM_ENVIRONMENTAL_AUDIO_V20_PROFILE;

    assert.equal(
      profile.audioAssetsRequired,
      false
    );

    assert.equal(
      profile.runtimeRandomness,
      0
    );

    assert.equal(
      profile.gameplayAuthorityMutations,
      0
    );

    assert.equal(
      profile.interactionAuthorityMutations,
      0
    );

    assert.equal(
      profile.locomotionMutations,
      0
    );

    assert.equal(
      profile.collisionMutations,
      0
    );
  }
);

test(
  "V20 dispose is idempotent before unlock",
  () => {
    const camera =
      new THREE.PerspectiveCamera();

    const audio =
      createClassroomEnvironmentalAudioV20({
        camera
      });

    audio.dispose();
    audio.dispose();

    assert.equal(
      audio.getSnapshot().unlocked,
      false
    );
  }
);
