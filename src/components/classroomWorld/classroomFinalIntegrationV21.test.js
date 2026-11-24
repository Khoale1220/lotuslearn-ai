import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const DIRECTORY =
  path.dirname(
    fileURLToPath(
      import.meta.url
    )
  );

function readSource(name) {
  return readFileSync(
    path.join(
      DIRECTORY,
      name
    ),
    "utf8"
  );
}

const WORLD =
  readSource(
    "ClassroomWorld.jsx"
  );

const V11 =
  readSource(
    "classroomInteractionAuthorityV11.js"
  );

const V13 =
  readSource(
    "classroomInputStateTimelineV13.js"
  );

const AUDIO =
  readSource(
    "classroomEnvironmentalAudioV20.js"
  );

function requiredIndex(
  source,
  token,
  fromIndex = 0
) {
  const index =
    source.indexOf(
      token,
      fromIndex
    );

  assert.notEqual(
    index,
    -1,
    "missing source token: " +
      token
  );

  return index;
}

function countMatches(
  source,
  pattern
) {
  return Array.from(
    source.matchAll(
      pattern
    )
  ).length;
}

test(
  "V21 initializes controls before V13 while preserving V13 before V11",
  () => {
    const replay =
      requiredIndex(
        WORLD,
        "const classroomInteractionReplayAuditV12 ="
      );

    const controls =
      requiredIndex(
        WORLD,
        "const controls = new PointerLockControls(camera, renderer.domElement);"
      );

    const inputTimeline =
      requiredIndex(
        WORLD,
        "const classroomInputStateTimelineV13 ="
      );

    const interactionAuthority =
      requiredIndex(
        WORLD,
        "const classroomInteractionAuthorityV11 ="
      );

    assert.ok(
      replay <
        controls
    );

    assert.ok(
      controls <
        inputTimeline
    );

    assert.ok(
      inputTimeline <
        interactionAuthority
    );
  }
);

test(
  "V21 preserves one critical runtime authority per domain",
  () => {
    assert.equal(
      countMatches(
        WORLD,
        /new\s+PointerLockControls\s*\(/gu
      ),
      1
    );

    assert.equal(
      countMatches(
        WORLD,
        /createClassroomInteractionAuthorityV11\s*\(\{/gu
      ),
      1
    );

    assert.equal(
      countMatches(
        WORLD,
        /createClassroomEnvironmentalAudioV20\s*\(\{/gu
      ),
      1
    );

    assert.equal(
      countMatches(
        WORLD,
        /createClassroomRuntimeObservabilityV7\s*\(\{/gu
      ),
      1
    );

    assert.equal(
      countMatches(
        WORLD,
        /const\s+animate\s*=\s*\(timestamp\)\s*=>/gu
      ),
      1
    );
  }
);

test(
  "V21 preserves timestamp-driven delta timing through render and observation",
  () => {
    const animate =
      requiredIndex(
        WORLD,
        "const animate = (timestamp) =>"
      );

    const timerUpdate =
      requiredIndex(
        WORLD,
        "timer.update(timestamp);",
        animate
      );

    const delta =
      requiredIndex(
        WORLD,
        "timer.getDelta();",
        timerUpdate
      );

    const locomotion =
      requiredIndex(
        WORLD,
        "stepPlayerLocomotion({",
        delta
      );

    const atmosphere =
      requiredIndex(
        WORLD,
        "classroomOceanAtmosphereDepthV19.tick({",
        locomotion
      );

    const audio =
      requiredIndex(
        WORLD,
        "classroomEnvironmentalAudioV20.tick({",
        atmosphere
      );

    const render =
      requiredIndex(
        WORLD,
        "renderer.render(scene, camera);",
        audio
      );

    const observability =
      requiredIndex(
        WORLD,
        "classroomRuntimeObservabilityV7.observeFrame({",
        render
      );

    assert.ok(
      animate <
        timerUpdate &&
      timerUpdate <
        delta &&
      delta <
        locomotion &&
      locomotion <
        atmosphere &&
      atmosphere <
        audio &&
      audio <
        render &&
      render <
        observability
    );
  }
);

test(
  "V21 keeps host audio and pointer-lock listener setup cleanup symmetric",
  () => {
    assert.equal(
      countMatches(
        WORLD,
        /host\.addEventListener\(\s*"click",\s*unlockEnvironmentalAudioV20,\s*true\s*\)/gu
      ),
      1
    );

    assert.equal(
      countMatches(
        WORLD,
        /host\.removeEventListener\(\s*"click",\s*unlockEnvironmentalAudioV20,\s*true\s*\)/gu
      ),
      1
    );

    assert.equal(
      countMatches(
        WORLD,
        /controls\.addEventListener\(\s*"lock",\s*onLock\s*\)/gu
      ),
      1
    );

    assert.equal(
      countMatches(
        WORLD,
        /controls\.removeEventListener\(\s*"lock",\s*onLock\s*\)/gu
      ),
      1
    );

    assert.equal(
      countMatches(
        WORLD,
        /controls\.addEventListener\(\s*"unlock",\s*onUnlock\s*\)/gu
      ),
      1
    );

    assert.equal(
      countMatches(
        WORLD,
        /controls\.removeEventListener\(\s*"unlock",\s*onUnlock\s*\)/gu
      ),
      1
    );
  }
);

test(
  "V21 preserves V13 and V11 capture listener cleanup contracts",
  () => {
    assert.equal(
      countMatches(
        V13,
        /windowObject\.addEventListener\(\s*"keydown",\s*onKeyDown,\s*true\s*\)/gu
      ),
      1
    );

    assert.equal(
      countMatches(
        V13,
        /windowObject\.removeEventListener\(\s*"keydown",\s*onKeyDown,\s*true\s*\)/gu
      ),
      1
    );

    assert.equal(
      countMatches(
        V13,
        /windowObject\.addEventListener\(\s*"keyup",\s*onKeyUp,\s*true\s*\)/gu
      ),
      1
    );

    assert.equal(
      countMatches(
        V13,
        /windowObject\.removeEventListener\(\s*"keyup",\s*onKeyUp,\s*true\s*\)/gu
      ),
      1
    );

    assert.equal(
      countMatches(
        V13,
        /windowObject\.addEventListener\(\s*"blur",\s*onBlur,\s*true\s*\)/gu
      ),
      1
    );

    assert.equal(
      countMatches(
        V13,
        /windowObject\.removeEventListener\(\s*"blur",\s*onBlur,\s*true\s*\)/gu
      ),
      1
    );

    assert.equal(
      countMatches(
        V11,
        /windowObject\.addEventListener\(\s*"keydown",\s*onKeyDown,\s*true\s*\)/gu
      ),
      1
    );

    assert.equal(
      countMatches(
        V11,
        /windowObject\.removeEventListener\(\s*"keydown",\s*onKeyDown,\s*true\s*\)/gu
      ),
      1
    );
  }
);

test(
  "V21 disposes subsystem owners before residual scene cleanup and renderer",
  () => {
    const cancelFrame =
      requiredIndex(
        WORLD,
        "cancelAnimationFrame(animationFrame);"
      );

    const firstOwner =
      requiredIndex(
        WORLD,
        "classroomRetroCompositionV4.dispose();",
        cancelFrame
      );

    const finalOwner =
      requiredIndex(
        WORLD,
        "classroomOceanSkyWorldV15.dispose();",
        firstOwner
      );

    const residualSceneCleanup =
      requiredIndex(
        WORLD,
        "scene.traverse((object) => {",
        finalOwner
      );

    const rendererDispose =
      requiredIndex(
        WORLD,
        "renderer.dispose();",
        residualSceneCleanup
      );

    assert.ok(
      firstOwner <
        finalOwner &&
      finalOwner <
        residualSceneCleanup &&
      residualSceneCleanup <
        rendererDispose
    );

    assert.equal(
      countMatches(
        WORLD,
        /scene\.traverse\(\(object\)\s*=>\s*\{/gu
      ),
      1
    );
  }
);

test(
  "V21 preserves one camera-attached environmental AudioListener",
  () => {
    assert.equal(
      countMatches(
        AUDIO,
        /new\s+THREE\.AudioListener\s*\(\s*\)/gu
      ),
      1
    );

    assert.equal(
      countMatches(
        AUDIO,
        /camera\.add\s*\(\s*listener\s*\)/gu
      ),
      1
    );

    assert.equal(
      countMatches(
        WORLD,
        /classroomEnvironmentalAudioV20\.unlock\s*\(\s*\)/gu
      ),
      1
    );
  }
);

test(
  "V21 preserves final V6-V20 subsystem construction contracts",
  () => {
    const factories = [
      [
        "V6",
        /createClassroomFinalContentV6\s*\(\{/gu
      ],
      [
        "V7",
        /createClassroomRuntimeObservabilityV7\s*\(\{/gu
      ],
      [
        "V10",
        /createClassroomCharacterVisualIntegrationV10\s*\(\{/gu
      ],
      [
        "V11",
        /createClassroomInteractionAuthorityV11\s*\(\{/gu
      ],
      [
        "V12",
        /createClassroomInteractionReplayAuditV12\s*\(\s*\)/gu
      ],
      [
        "V13",
        /createClassroomInputStateTimelineV13\s*\(\{/gu
      ],
      [
        "V15",
        /createClassroomOceanSkyWorldV15\s*\(\{/gu
      ],
      [
        "V16",
        /createClassroomOceanVistaV16\s*\(\{/gu
      ],
      [
        "V17",
        /createClassroomCargoShipLanesV17\s*\(\{/gu
      ],
      [
        "V18",
        /createClassroomSeagullFlocksV18\s*\(\{/gu
      ],
      [
        "V19",
        /createClassroomOceanAtmosphereDepthV19\s*\(\{/gu
      ],
      [
        "V19A",
        /createClassroomTeacherDeskHeadphonesV19A\s*\(\{/gu
      ],
      [
        "V20",
        /createClassroomEnvironmentalAudioV20\s*\(\{/gu
      ]
    ];

    for (
      const [
        label,
        pattern
      ]
      of factories
    ) {
      assert.equal(
        countMatches(
          WORLD,
          pattern
        ),
        1,
        label +
          " construction count"
      );
    }

    const subsystemDisposers = [
      "classroomFinalContentV6",
      "classroomRuntimeObservabilityV7",
      "classroomCharacterVisualIntegrationV10",
      "classroomInteractionAuthorityV11",
      "classroomInteractionReplayAuditV12",
      "classroomInputStateTimelineV13",
      "classroomOceanSkyWorldV15",
      "classroomOceanVistaV16",
      "classroomCargoShipLanesV17",
      "classroomSeagullFlocksV18",
      "classroomOceanAtmosphereDepthV19",
      "classroomTeacherDeskHeadphonesV19A",
      "classroomEnvironmentalAudioV20"
    ];

    for (
      const name
      of subsystemDisposers
    ) {
      const pattern =
        new RegExp(
          name +
            "\\.dispose\\s*\\(\\s*\\)",
          "gu"
        );

      assert.equal(
        countMatches(
          WORLD,
          pattern
        ),
        1,
        name +
          " dispose count"
      );
    }
  }
);
