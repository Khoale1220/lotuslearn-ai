import {
  stableHashStringV45,
  isCharacterCastSpriteV45
} from "./classroomCharacterCastVarietyV45.js";

const CLASSROOM_CHARACTER_FIRST_PERSON_STAGING_V46_PROFILE =
  Object.freeze({
    version: 46,

    visualOnly: true,
    deterministic: true,
    constructionOnly: true,

    characterLayer: 30,

    seatedAnchorYBase: 0.58,
    seatedAnchorJitterStep: 0.006,
    seatedAnchorJitterSlots: 3,

    alphaTestFloor: 0.5,

    constructionSceneTraversalCount: 1,
    runtimeSceneTraversalCount: 0,

    addedDrawCalls: 0,
    addedTextures: 0,
    addedSprites: 0,
    addedMeshes: 0,
    addedMaterials: 0,
    addedLights: 0,

    positionMutationCount: 0,
    scaleMutationCount: 0,
    uvMutationCount: 0,
    frameSelectionMutationCount: 0,
    cameraProjectionMutationCount: 0,
    renderOrderMutationCount: 0
  });

function deriveSeatedAnchorYV46(
  studentKey
) {
  const hash =
    stableHashStringV45(
      String(
        studentKey ??
        "anonymous-student"
      )
    );

  const slot =
    hash %
    CLASSROOM_CHARACTER_FIRST_PERSON_STAGING_V46_PROFILE
      .seatedAnchorJitterSlots;

  return (
    CLASSROOM_CHARACTER_FIRST_PERSON_STAGING_V46_PROFILE
      .seatedAnchorYBase +
    (
      slot -
      1
    ) *
    CLASSROOM_CHARACTER_FIRST_PERSON_STAGING_V46_PROFILE
      .seatedAnchorJitterStep
  );
}

function objectDescriptorV46(
  object
) {
  const userData =
    object?.userData &&
    typeof object.userData === "object"
      ? object.userData
      : {};

  return [
    object?.name,
    userData.role,
    userData.kind,
    userData.type,
    userData.visualRole,
    userData.characterRole,
    userData.studentKey
  ]
    .filter(Boolean)
    .join(" ");
}

function hasRetroFurnitureAncestorV46(
  object
) {
  let current =
    object;

  while (current) {
    const name =
      String(
        current.name ??
        ""
      );

    if (
      name ===
        "classroom-retro-composition-v4" ||
      /classroom.?furniture/i.test(
        name
      )
    ) {
      return true;
    }

    current =
      current.parent;
  }

  return false;
}

function materialListV46(
  object
) {
  if (
    !object?.material
  ) {
    return [];
  }

  return Array.isArray(
    object.material
  )
    ? object.material
    : [
        object.material
      ];
}

function isOpaqueFurnitureOccluderV46(
  object
) {
  if (
    !object?.isInstancedMesh
  ) {
    return false;
  }

  if (
    !hasRetroFurnitureAncestorV46(
      object
    )
  ) {
    return false;
  }

  const materials =
    materialListV46(
      object
    );

  if (
    materials.length ===
      0
  ) {
    return false;
  }

  return materials.every(
    (material) => {
      if (!material) {
        return false;
      }

      if (
        material.depthTest ===
          false
      ) {
        return false;
      }

      if (
        material.depthWrite ===
          false
      ) {
        return false;
      }

      if (
        material.transparent ===
          true &&
        Number(
          material.opacity ??
          1
        ) <
          0.999
      ) {
        return false;
      }

      return true;
    }
  );
}

function identityForSpriteV46(
  sprite,
  index
) {
  const studentKey =
    sprite?.userData?.studentKey;

  if (
    typeof studentKey ===
      "string" &&
    studentKey.trim().length >
      0
  ) {
    return studentKey.trim();
  }

  const descriptor =
    objectDescriptorV46(
      sprite
    );

  if (descriptor) {
    return descriptor;
  }

  return `student-${index}`;
}

function captureMaterialStateV46(
  material
) {
  return Object.freeze({
    transparent:
      material.transparent,

    alphaTest:
      material.alphaTest,

    depthTest:
      material.depthTest,

    depthWrite:
      material.depthWrite,

    sizeAttenuation:
      material.sizeAttenuation
  });
}

function applyCharacterDepthContractV46(
  material
) {
  const alphaTest =
    Number.isFinite(
      Number(
        material.alphaTest
      )
    )
      ? Number(
          material.alphaTest
        )
      : 0;

  /*
   * Hard alpha-cutout instead of transparent-object
   * painter sorting.
   *
   * Transparent atlas pixels are discarded.
   * Visible character pixels participate normally in
   * the depth buffer so desks/chairs/furniture can
   * occlude the seated character.
   */
  material.transparent =
    false;

  material.alphaTest =
    Math.max(
      alphaTest,
      CLASSROOM_CHARACTER_FIRST_PERSON_STAGING_V46_PROFILE
        .alphaTestFloor
    );

  material.depthTest =
    true;

  material.depthWrite =
    true;

  material.sizeAttenuation =
    true;

  material.needsUpdate =
    true;
}

function createClassroomCharacterFirstPersonStagingV46({
  scene,
  camera
}) {
  if (
    !scene ||
    typeof scene.traverse !==
      "function"
  ) {
    throw new Error(
      "V46 requires a Three.js scene"
    );
  }

  if (
    !camera ||
    camera.isPerspectiveCamera !==
      true
  ) {
    throw new Error(
      "V46 requires the canonical perspective camera"
    );
  }

  const characterSprites =
    [];

  const materialStates =
    new Map();

  const spriteStates =
    [];

  let opaqueFurnitureOccluderCount =
    0;

  let constructionTraversalCount =
    0;

  scene.traverse((object) => {
    if (
      isCharacterCastSpriteV45(
        object
      )
    ) {
      characterSprites.push(
        object
      );
    }

    if (
      isOpaqueFurnitureOccluderV46(
        object
      )
    ) {
      opaqueFurnitureOccluderCount +=
        1;
    }
  });

  constructionTraversalCount +=
    1;

  if (
    characterSprites.length ===
      0
  ) {
    throw new Error(
      "V46_CHARACTER_SPRITE_DISCOVERY_EMPTY"
    );
  }

  if (
    opaqueFurnitureOccluderCount ===
      0
  ) {
    throw new Error(
      "V46_FURNITURE_OCCLUDER_DISCOVERY_EMPTY"
    );
  }

  let minimumAnchorY =
    Number.POSITIVE_INFINITY;

  let maximumAnchorY =
    Number.NEGATIVE_INFINITY;

  for (
    let index = 0;
    index < characterSprites.length;
    index += 1
  ) {
    const sprite =
      characterSprites[
        index
      ];

    if (
      !sprite.center ||
      typeof sprite.center.set !==
        "function"
    ) {
      throw new Error(
        "V46 requires canonical Three.js Sprite.center"
      );
    }

    const material =
      sprite.material;

    if (
      !material ||
      material.isSpriteMaterial !==
        true
    ) {
      throw new Error(
        "V46 requires canonical V9 SpriteMaterial"
      );
    }

    if (
      !materialStates.has(
        material
      )
    ) {
      materialStates.set(
        material,
        captureMaterialStateV46(
          material
        )
      );
    }

    const identity =
      identityForSpriteV46(
        sprite,
        index
      );

    const anchorY =
      deriveSeatedAnchorYV46(
        identity
      );

    spriteStates.push(
      Object.freeze({
        sprite,

        centerX:
          sprite.center.x,

        centerY:
          sprite.center.y,

        identity,

        stagedAnchorY:
          anchorY
      })
    );

    /*
     * Sprite.center is presentation alignment only.
     *
     * World position, collision anchor, interaction
     * anchor and legacy character authority remain
     * untouched.
     */
    sprite.center.y =
      anchorY;

    minimumAnchorY =
      Math.min(
        minimumAnchorY,
        anchorY
      );

    maximumAnchorY =
      Math.max(
        maximumAnchorY,
        anchorY
      );
  }

  for (
    const material
    of materialStates.keys()
  ) {
    applyCharacterDepthContractV46(
      material
    );
  }

  let disposed =
    false;

  function getSnapshot() {
    return Object.freeze({
      version:
        CLASSROOM_CHARACTER_FIRST_PERSON_STAGING_V46_PROFILE
          .version,

      cameraFov:
        camera.fov,

      cameraNear:
        camera.near,

      cameraFar:
        camera.far,

      characterSpriteCount:
        characterSprites.length,

      characterMaterialCount:
        materialStates.size,

      opaqueFurnitureOccluderCount,

      minimumAnchorY,
      maximumAnchorY,

      anchorSpan:
        maximumAnchorY -
        minimumAnchorY,

      constructionSceneTraversalCount:
        constructionTraversalCount,

      runtimeSceneTraversalCount:
        0,

      addedDrawCalls:
        0,

      addedTextures:
        0,

      addedSprites:
        0,

      addedMeshes:
        0,

      addedMaterials:
        0,

      addedLights:
        0,

      positionMutationCount:
        0,

      scaleMutationCount:
        0,

      uvMutationCount:
        0,

      frameSelectionMutationCount:
        0,

      cameraProjectionMutationCount:
        0,

      renderOrderMutationCount:
        0,

      centerMutationCount:
        spriteStates.length,

      materialDepthContractCount:
        materialStates.size
    });
  }

  function dispose() {
    if (disposed) {
      return;
    }

    disposed =
      true;

    /*
     * Restore exact V45 presentation state.
     */
    for (
      const state
      of spriteStates
    ) {
      state.sprite.center.set(
        state.centerX,
        state.centerY
      );
    }

    for (
      const [
        material,
        state
      ]
      of materialStates
    ) {
      material.transparent =
        state.transparent;

      material.alphaTest =
        state.alphaTest;

      material.depthTest =
        state.depthTest;

      material.depthWrite =
        state.depthWrite;

      material.sizeAttenuation =
        state.sizeAttenuation;

      material.needsUpdate =
        true;
    }
  }

  return Object.freeze({
    getSnapshot,
    dispose
  });
}

export {
  CLASSROOM_CHARACTER_FIRST_PERSON_STAGING_V46_PROFILE,
  deriveSeatedAnchorYV46,
  isOpaqueFurnitureOccluderV46,
  applyCharacterDepthContractV46,
  createClassroomCharacterFirstPersonStagingV46
};