import * as THREE from "three";

const CLASSROOM_ENVIRONMENTAL_AUDIO_V20_PROFILE =
  Object.freeze({
    id:
      "cw06-classroom-environmental-audio-v20",

    architecture:
      "single-listener-procedural-web-audio",

    layers:
      Object.freeze([
        "ocean",
        "wind",
        "seagulls",
        "distant-cargo-ships"
      ]),

    procedural:
      true,

    deterministic:
      true,

    audioAssetsRequired:
      false,

    runtimeRandomness:
      0,

    gameplayAuthorityMutations:
      0,

    interactionAuthorityMutations:
      0,

    locomotionMutations:
      0,

    collisionMutations:
      0
  });

const DEFAULT_EXPOSURE =
  0.24;

const GULL_INTERVALS_MS =
  Object.freeze([
    11800,
    16300,
    13700,
    19400
  ]);

function clamp01(value) {
  return Math.min(
    1,
    Math.max(
      0,
      Number(value) || 0
    )
  );
}

function createDeterministicNoiseSamplesV20({
  length,
  seed = 20201123
}) {
  const size =
    Math.max(
      0,
      Math.floor(length)
    );

  const output =
    new Float32Array(size);

  let state =
    Math.max(
      1,
      Math.floor(
        Math.abs(seed)
      ) %
      2147483647
    );

  for (
    let index = 0;
    index < size;
    index += 1
  ) {
    state =
      (
        state *
        48271
      ) %
      2147483647;

    output[index] =
      (
        state /
        2147483647
      ) *
        2 -
      1;
  }

  return output;
}

function extractWindowShadeExposureV20(
  snapshot
) {
  if (
    snapshot === null ||
    snapshot === undefined
  ) {
    return DEFAULT_EXPOSURE;
  }

  const candidates = [];

  function visit(
    value,
    path,
    depth
  ) {
    if (depth > 7) {
      return;
    }

    const normalizedPath =
      String(path).toLowerCase();

    const relevant =
      /(shade|window|door|open|travel|progress|ratio|exposure)/
        .test(
          normalizedPath
        );

    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      if (
        relevant &&
        value >= 0 &&
        value <= 1
      ) {
        candidates.push(value);
      }

      return;
    }

    if (
      typeof value === "boolean"
    ) {
      if (relevant) {
        candidates.push(
          value ? 1 : 0
        );
      }

      return;
    }

    if (
      !value ||
      typeof value !== "object"
    ) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(
        (
          child,
          index
        ) => {
          visit(
            child,
            path +
              "[" +
              index +
              "]",
            depth + 1
          );
        }
      );

      return;
    }

    for (
      const [
        key,
        child
      ]
      of Object.entries(value)
    ) {
      visit(
        child,
        path
          ? path + "." + key
          : key,
        depth + 1
      );
    }
  }

  visit(
    snapshot,
    "",
    0
  );

  if (
    candidates.length === 0
  ) {
    return DEFAULT_EXPOSURE;
  }

  const average =
    candidates.reduce(
      (
        total,
        value
      ) =>
        total + value,
      0
    ) /
    candidates.length;

  return clamp01(average);
}

function createLoopingNoiseSource({
  context,
  seconds,
  seed
}) {
  const frameCount =
    Math.max(
      1,
      Math.floor(
        context.sampleRate *
        seconds
      )
    );

  const buffer =
    context.createBuffer(
      1,
      frameCount,
      context.sampleRate
    );

  const channel =
    buffer.getChannelData(0);

  const samples =
    createDeterministicNoiseSamplesV20({
      length:
        frameCount,
      seed
    });

  let smoothed =
    0;

  for (
    let index = 0;
    index < frameCount;
    index += 1
  ) {
    smoothed =
      smoothed * 0.965 +
      samples[index] * 0.035;

    channel[index] =
      smoothed;
  }

  const source =
    context.createBufferSource();

  source.buffer =
    buffer;

  source.loop =
    true;

  return source;
}

function createClassroomEnvironmentalAudioV20({
  camera,
  windowShadeSystem = null
}) {
  if (
    !camera ||
    !camera.isCamera
  ) {
    throw new TypeError(
      "V20 requires THREE.Camera"
    );
  }

  let disposed =
    false;

  let unlocked =
    false;

  let unlockAttempted =
    false;

  let listener =
    null;

  let context =
    null;

  let masterGain =
    null;

  let oceanGain =
    null;

  let windGain =
    null;

  let cargoGain =
    null;

  let gullGain =
    null;

  let oceanSource =
    null;

  let windSource =
    null;

  let cargoLow =
    null;

  let cargoHigh =
    null;

  let exposure =
    DEFAULT_EXPOSURE;

  let lastTimestampMs =
    0;

  let gullSequence =
    0;

  let nextGullAtMs =
    GULL_INTERVALS_MS[0];

  const disposableNodes =
    [];

  function readExposure() {
    if (
      !windowShadeSystem ||
      typeof windowShadeSystem.getSnapshot !==
        "function"
    ) {
      return DEFAULT_EXPOSURE;
    }

    try {
      return (
        extractWindowShadeExposureV20(
          windowShadeSystem.getSnapshot()
        )
      );
    }
    catch {
      return DEFAULT_EXPOSURE;
    }
  }

  function track(node) {
    disposableNodes.push(node);

    return node;
  }

  function buildGraph() {
    if (
      listener ||
      disposed
    ) {
      return;
    }

    listener =
      new THREE.AudioListener();

    listener.name =
      "cw06-v20-audio-listener";

    camera.add(listener);

    context =
      listener.context;

    masterGain =
      track(
        context.createGain()
      );

    oceanGain =
      track(
        context.createGain()
      );

    windGain =
      track(
        context.createGain()
      );

    cargoGain =
      track(
        context.createGain()
      );

    gullGain =
      track(
        context.createGain()
      );

    masterGain.gain.value =
      0.72;

    oceanGain.gain.value =
      0;

    windGain.gain.value =
      0;

    cargoGain.gain.value =
      0;

    gullGain.gain.value =
      0.08;

    oceanGain.connect(
      masterGain
    );

    windGain.connect(
      masterGain
    );

    cargoGain.connect(
      masterGain
    );

    gullGain.connect(
      masterGain
    );

    masterGain.connect(
      listener.getInput()
    );

    /*
     * OCEAN
     */

    oceanSource =
      createLoopingNoiseSource({
        context,
        seconds: 4,
        seed: 152020
      });

    const oceanLowPass =
      track(
        context.createBiquadFilter()
      );

    const oceanShelf =
      track(
        context.createBiquadFilter()
      );

    oceanLowPass.type =
      "lowpass";

    oceanLowPass.frequency.value =
      720;

    oceanLowPass.Q.value =
      0.42;

    oceanShelf.type =
      "lowshelf";

    oceanShelf.frequency.value =
      165;

    oceanShelf.gain.value =
      7;

    oceanSource.connect(
      oceanLowPass
    );

    oceanLowPass.connect(
      oceanShelf
    );

    oceanShelf.connect(
      oceanGain
    );

    /*
     * WIND
     */

    windSource =
      createLoopingNoiseSource({
        context,
        seconds: 3,
        seed: 574944
      });

    const windBand =
      track(
        context.createBiquadFilter()
      );

    windBand.type =
      "bandpass";

    windBand.frequency.value =
      1280;

    windBand.Q.value =
      0.58;

    windSource.connect(
      windBand
    );

    windBand.connect(
      windGain
    );

    /*
     * DISTANT CARGO ENGINES
     */

    cargoLow =
      track(
        context.createOscillator()
      );

    cargoHigh =
      track(
        context.createOscillator()
      );

    cargoLow.type =
      "triangle";

    cargoHigh.type =
      "sine";

    cargoLow.frequency.value =
      38;

    cargoHigh.frequency.value =
      73;

    const cargoLowMix =
      track(
        context.createGain()
      );

    const cargoHighMix =
      track(
        context.createGain()
      );

    cargoLowMix.gain.value =
      0.65;

    cargoHighMix.gain.value =
      0.18;

    cargoLow.connect(
      cargoLowMix
    );

    cargoHigh.connect(
      cargoHighMix
    );

    cargoLowMix.connect(
      cargoGain
    );

    cargoHighMix.connect(
      cargoGain
    );

    oceanSource.start();
    windSource.start();
    cargoLow.start();
    cargoHigh.start();
  }

  function applyMix(
    nextExposure,
    immediate = false
  ) {
    if (
      !context ||
      !unlocked
    ) {
      return;
    }

    const amount =
      clamp01(
        nextExposure
      );

    const now =
      context.currentTime;

    const oceanLevel =
      0.055 +
      amount * 0.135;

    const windLevel =
      0.008 +
      amount * 0.065;

    const cargoLevel =
      0.005 +
      amount * 0.025;

    function setGain(
      parameter,
      target
    ) {
      if (immediate) {
        parameter.setValueAtTime(
          target,
          now
        );

        return;
      }

      parameter.setTargetAtTime(
        target,
        now,
        0.32
      );
    }

    setGain(
      oceanGain.gain,
      oceanLevel
    );

    setGain(
      windGain.gain,
      windLevel
    );

    setGain(
      cargoGain.gain,
      cargoLevel
    );
  }

  async function unlock() {
    if (
      disposed ||
      unlocked
    ) {
      return unlocked;
    }

    unlockAttempted =
      true;

    try {
      buildGraph();

      if (
        context &&
        context.state ===
          "suspended"
      ) {
        await context.resume();
      }

      if (
        !context ||
        context.state !==
          "running"
      ) {
        return false;
      }

      unlocked =
        true;

      exposure =
        readExposure();

      applyMix(
        exposure,
        true
      );

      return true;
    }
    catch {
      unlocked =
        false;

      return false;
    }
  }

  function triggerGull() {
    if (
      !unlocked ||
      !context ||
      disposed
    ) {
      return;
    }

    const now =
      context.currentTime;

    const first =
      context.createOscillator();

    const second =
      context.createOscillator();

    const envelope =
      context.createGain();

    const filter =
      context.createBiquadFilter();

    const variant =
      gullSequence % 3;

    const base =
      880 +
      variant * 105;

    first.type =
      "triangle";

    second.type =
      "sine";

    first.frequency.setValueAtTime(
      base,
      now
    );

    first.frequency.exponentialRampToValueAtTime(
      base * 1.22,
      now + 0.12
    );

    first.frequency.exponentialRampToValueAtTime(
      base * 0.82,
      now + 0.44
    );

    second.frequency.setValueAtTime(
      base * 1.94,
      now
    );

    second.frequency.exponentialRampToValueAtTime(
      base * 1.52,
      now + 0.42
    );

    filter.type =
      "bandpass";

    filter.frequency.value =
      1500;

    filter.Q.value =
      1.2;

    envelope.gain.setValueAtTime(
      0.0001,
      now
    );

    envelope.gain.exponentialRampToValueAtTime(
      0.032 +
      exposure * 0.026,
      now + 0.055
    );

    envelope.gain.exponentialRampToValueAtTime(
      0.0001,
      now + 0.48
    );

    first.connect(filter);
    second.connect(filter);

    filter.connect(
      envelope
    );

    envelope.connect(
      gullGain
    );

    first.start(now);
    second.start(now);

    first.stop(
      now + 0.5
    );

    second.stop(
      now + 0.5
    );

    first.onended =
      () => {
        try {
          first.disconnect();
          second.disconnect();
          filter.disconnect();
          envelope.disconnect();
        }
        catch {
          // Already disconnected.
        }
      };
  }

  function tick({
    timestamp
  } = {}) {
    if (disposed) {
      return;
    }

    if (
      Number.isFinite(timestamp)
    ) {
      lastTimestampMs =
        Math.max(
          lastTimestampMs,
          timestamp
        );
    }

    const nextExposure =
      readExposure();

    if (
      Math.abs(
        nextExposure -
        exposure
      ) >
      0.005
    ) {
      exposure =
        nextExposure;

      applyMix(exposure);
    }

    if (
      unlocked &&
      lastTimestampMs >=
        nextGullAtMs
    ) {
      triggerGull();

      gullSequence += 1;

      nextGullAtMs +=
        GULL_INTERVALS_MS[
          gullSequence %
          GULL_INTERVALS_MS.length
        ];
    }

    if (
      unlocked &&
      context &&
      cargoLow &&
      cargoHigh
    ) {
      const phase =
        lastTimestampMs *
        0.00006;

      cargoLow.frequency
        .setTargetAtTime(
          38 +
          Math.sin(phase) *
            1.25,
          context.currentTime,
          0.8
        );

      cargoHigh.frequency
        .setTargetAtTime(
          73 +
          Math.sin(
            phase * 0.71
          ) *
            2.1,
          context.currentTime,
          0.8
        );
    }
  }

  function getSnapshot() {
    return Object.freeze({
      id:
        CLASSROOM_ENVIRONMENTAL_AUDIO_V20_PROFILE.id,

      unlocked,
      unlockAttempted,

      contextState:
        context
          ? context.state
          : "not-created",

      exposure:
        clamp01(exposure),

      lastTimestampMs,
      gullSequence,
      nextGullAtMs,

      procedural:
        true,

      deterministic:
        true,

      audioAssetsRequired:
        false,

      runtimeRandomness:
        0,

      gameplayAuthorityMutations:
        0,

      interactionAuthorityMutations:
        0,

      locomotionMutations:
        0,

      collisionMutations:
        0
    });
  }

  function dispose() {
    if (disposed) {
      return;
    }

    disposed =
      true;

    for (
      const node
      of [
        oceanSource,
        windSource,
        cargoLow,
        cargoHigh
      ]
    ) {
      if (!node) {
        continue;
      }

      try {
        node.stop();
      }
      catch {
        // Already stopped.
      }
    }

    for (
      const node
      of disposableNodes
    ) {
      try {
        node.disconnect();
      }
      catch {
        // Already disconnected.
      }
    }

    if (
      listener &&
      listener.parent
    ) {
      listener.parent.remove(
        listener
      );
    }

    listener = null;
    context = null;

    masterGain = null;
    oceanGain = null;
    windGain = null;
    cargoGain = null;
    gullGain = null;

    oceanSource = null;
    windSource = null;
    cargoLow = null;
    cargoHigh = null;
  }

  return Object.freeze({
    unlock,
    tick,
    getSnapshot,
    dispose
  });
}

export {
  CLASSROOM_ENVIRONMENTAL_AUDIO_V20_PROFILE,
  createClassroomEnvironmentalAudioV20,
  createDeterministicNoiseSamplesV20,
  extractWindowShadeExposureV20
};
