import * as THREE from "three";

const CLASSROOM_CHARACTER_SCENE_COHESION_V42_PROFILE =
  Object.freeze({
    version: 42,
    visualOnly: true,
    deterministic: true,

    characterLayer: 30,

    warmKey: 0xffe0b5,
    coolFill: 0xd4f2ff,
    shadowTint: 0xd5c2df,

    minimumExposure: 0.90,
    maximumExposure: 1.05,

    pulseAmplitude: 0.008,
    pulseFrequencyHz: 0.19,

    constructionSceneTraversalCount: 1,
    runtimeSceneTraversalCount: 0,

    addedDrawCalls: 0,
    addedTextures: 0,
    addedSprites: 0,
    addedMeshes: 0,
    addedLights: 0,

    scaleMutationCount: 0,
    positionMutationCount: 0,
    atlasFrameMutationCount: 0
  });

const EXCLUDED_VISUAL_PATTERN =
  /(seagull|cargo|ship|cloud|whitecap|glint|ocean.?atmosphere|environmental.?sprite|v41.?accent)/i;

const CHARACTER_VISUAL_PATTERN =
  /(student|character|classroom.?character|sprite.?v9|character.?v10)/i;

function clamp01(value) {
  return Math.min(
    1,
    Math.max(
      0,
      Number.isFinite(value)
        ? value
        : 0
    )
  );
}

function descriptorText(object) {
  const userData =
    object?.userData &&
    typeof object.userData === "object"
      ? object.userData
      : {};

  const material =
    object?.material ?? null;

  const map =
    material?.map ?? null;

  return [
    object?.name,
    material?.name,
    map?.name,
    userData.studentKey,
    userData.displayLabel,
    userData.role,
    userData.kind,
    userData.type,
    userData.visualRole,
    userData.characterRole,
    userData.raycastRole,
    userData.presentationRole
  ]
    .filter(Boolean)
    .join(" ");
}

function isKnownExcludedVisual(object) {
  const userData =
    object?.userData ?? {};

  if (
    userData.cw06SeagullV18 === true ||
    userData.cw06CargoShipV17 === true ||
    userData.cw06OceanAtmosphereV19 === true ||
    userData.cw06EnvironmentalSpriteFidelityV41 === true ||
    userData.cw06CharacterSceneCohesionV42 === true
  ) {
    return true;
  }

  return EXCLUDED_VISUAL_PATTERN.test(
    descriptorText(object)
  );
}

function isCharacterLayer(object) {
  if (
    !object?.layers ||
    !Number.isInteger(object.layers.mask)
  ) {
    return false;
  }

  const characterMask =
    1 << CLASSROOM_CHARACTER_SCENE_COHESION_V42_PROFILE.characterLayer;

  return (
    object.layers.mask &
    characterMask
  ) !== 0;
}

function hasCharacterIdentity(object) {
  const userData =
    object?.userData ?? {};

  if (
    typeof userData.studentKey === "string" &&
    userData.studentKey.length > 0
  ) {
    return true;
  }

  const descriptor =
    descriptorText(object);

  return CHARACTER_VISUAL_PATTERN.test(
    descriptor
  );
}

function isCharacterSprite(object) {
  if (
    !object?.isSprite ||
    !object.material?.isSpriteMaterial
  ) {
    return false;
  }

  if (
    isKnownExcludedVisual(object)
  ) {
    return false;
  }

  return (
    hasCharacterIdentity(object) ||
    isCharacterLayer(object)
  );
}

function stableHash(value) {
  const text =
    String(value ?? "");

  let hash =
    2166136261;

  for (
    let index = 0;
    index < text.length;
    index += 1
  ) {
    hash ^=
      text.charCodeAt(index);

    hash =
      Math.imul(
        hash,
        16777619
      );
  }

  return hash >>> 0;
}

function normalizeCoordinate(
  value,
  minimum,
  maximum
) {
  const span =
    maximum -
    minimum;

  if (
    !Number.isFinite(span) ||
    Math.abs(span) < 1e-6
  ) {
    return 0.5;
  }

  return clamp01(
    (
      value -
      minimum
    ) /
    span
  );
}

function createClassroomCharacterSceneCohesionV42({
  scene
}) {
  if (
    !scene ||
    typeof scene.traverse !== "function"
  ) {
    throw new Error(
      "V42 requires a Three.js scene"
    );
  }

  const states = [];

  const warmKey =
    new THREE.Color(
      CLASSROOM_CHARACTER_SCENE_COHESION_V42_PROFILE
        .warmKey
    );

  const coolFill =
    new THREE.Color(
      CLASSROOM_CHARACTER_SCENE_COHESION_V42_PROFILE
        .coolFill
    );

  const shadowTint =
    new THREE.Color(
      CLASSROOM_CHARACTER_SCENE_COHESION_V42_PROFILE
        .shadowTint
    );

  const temporaryPosition =
    new THREE.Vector3();

  const temporaryTint =
    new THREE.Color();

  let minimumX =
    Number.POSITIVE_INFINITY;

  let maximumX =
    Number.NEGATIVE_INFINITY;

  let minimumZ =
    Number.POSITIVE_INFINITY;

  let maximumZ =
    Number.NEGATIVE_INFINITY;

  let constructionTraversalCount =
    0;

  scene.traverse((object) => {
    if (
      !isCharacterSprite(object)
    ) {
      return;
    }

    const originalMaterial =
      object.material;

    if (
      !originalMaterial ||
      !originalMaterial.isSpriteMaterial
    ) {
      return;
    }

    const material =
      originalMaterial.clone();

    material.name =
      (
        originalMaterial.name ||
        object.name ||
        "cw06-character"
      ) +
      "-v42-cohesion";

    material.userData = {
      ...material.userData,
      cw06CharacterSceneCohesionV42:
        true,
      visualOnly: true
    };

    object.material =
      material;

    object.getWorldPosition(
      temporaryPosition
    );

    minimumX =
      Math.min(
        minimumX,
        temporaryPosition.x
      );

    maximumX =
      Math.max(
        maximumX,
        temporaryPosition.x
      );

    minimumZ =
      Math.min(
        minimumZ,
        temporaryPosition.z
      );

    maximumZ =
      Math.max(
        maximumZ,
        temporaryPosition.z
      );

    const identity =
      object.userData?.studentKey ||
      object.userData?.displayLabel ||
      object.name ||
      String(states.length);

    const hash =
      stableHash(identity);

    states.push({
      sprite:
        object,

      originalMaterial,

      material,

      originalColor:
        originalMaterial.color.clone(),

      phase:
        (
          hash %
          10000
        ) /
        10000 *
        Math.PI *
        2
    });
  });

  constructionTraversalCount +=
    1;

  if (
    states.length === 0
  ) {
    throw new Error(
      "V42_CHARACTER_DISCOVERY_EMPTY"
    );
  }

  let disposed =
    false;

  let tickCount =
    0;

  function tick({
    timestamp = 0
  } = {}) {
    if (disposed) {
      return;
    }

    const timeSeconds =
      Number.isFinite(timestamp)
        ? timestamp / 1000
        : 0;

    for (
      const state
      of states
    ) {
      const {
        sprite,
        material,
        originalColor,
        phase
      } = state;

      if (
        !sprite ||
        !material
      ) {
        continue;
      }

      sprite.getWorldPosition(
        temporaryPosition
      );

      const xWeight =
        normalizeCoordinate(
          temporaryPosition.x,
          minimumX,
          maximumX
        );

      const zWeight =
        normalizeCoordinate(
          temporaryPosition.z,
          minimumZ,
          maximumZ
        );

      /*
       * Existing ClassroomWorld key light is on the
       * positive X / positive Z side.
       *
       * We do not add a second lighting authority.
       * This is only palette modulation of the
       * existing SpriteMaterial.
       */
      const warmWeight =
        clamp01(
          (
            xWeight +
            zWeight
          ) *
          0.5
        );

      const depthShadow =
        clamp01(
          1 -
          zWeight
        );

      temporaryTint
        .copy(coolFill)
        .lerp(
          warmKey,
          warmWeight
        )
        .lerp(
          shadowTint,
          depthShadow *
            0.12
        );

      const baseExposure =
        THREE.MathUtils.lerp(
          CLASSROOM_CHARACTER_SCENE_COHESION_V42_PROFILE
            .minimumExposure,
          CLASSROOM_CHARACTER_SCENE_COHESION_V42_PROFILE
            .maximumExposure,
          warmWeight
        );

      /*
       * Extremely small deterministic temporal variation.
       * It prevents completely dead flat color without
       * becoming an animation authority.
       */
      const temporalExposure =
        1 +
        Math.sin(
          (
            timeSeconds *
            Math.PI *
            2 *
            CLASSROOM_CHARACTER_SCENE_COHESION_V42_PROFILE
              .pulseFrequencyHz
          ) +
          phase
        ) *
        CLASSROOM_CHARACTER_SCENE_COHESION_V42_PROFILE
          .pulseAmplitude;

      material.color
        .copy(originalColor)
        .multiply(
          temporaryTint
        )
        .multiplyScalar(
          baseExposure *
          temporalExposure
        );
    }

    tickCount +=
      1;
  }

  function getSnapshot() {
    return Object.freeze({
      version:
        CLASSROOM_CHARACTER_SCENE_COHESION_V42_PROFILE
          .version,

      characterSpriteCount:
        states.length,

      materialCloneCount:
        states.length,

      constructionSceneTraversalCount:
        constructionTraversalCount,

      runtimeSceneTraversalCount:
        0,

      tickCount,

      addedDrawCalls:
        0,

      addedTextures:
        0,

      addedSprites:
        0,

      addedMeshes:
        0,

      addedLights:
        0,

      scaleMutationCount:
        0,

      positionMutationCount:
        0,

      atlasFrameMutationCount:
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
      const state
      of states
    ) {
      const {
        sprite,
        originalMaterial,
        material
      } = state;

      /*
       * Restore authority-owned V9/V10 material
       * before V10 itself is disposed.
       */
      if (
        sprite &&
        sprite.material === material
      ) {
        sprite.material =
          originalMaterial;
      }

      material.dispose();
    }
  }

  return Object.freeze({
    tick,
    getSnapshot,
    dispose
  });
}

export {
  CLASSROOM_CHARACTER_SCENE_COHESION_V42_PROFILE,
  createClassroomCharacterSceneCohesionV42,
  isCharacterSprite
};