import * as THREE from "three";

import {
  isV9StudentSpriteV31
} from "./classroomCharacterSilhouettePolishV31.js";

const CLASSROOM_CHARACTER_DEPTH_OCCLUSION_POLISH_V37_PROFILE =
  Object.freeze({
    id:
      "cw06-character-depth-occlusion-polish-v37",

    artDirection:
      "high-detail-1990s-vga-pixel-art",

    strategy:
      "existing-v9-sprite-depth-buffer-plus-distance-band-calibration",

    depthBands:
      Object.freeze({
        nearMax:
          5.2,

        midMax:
          9.2,

        hysteresis:
          0.35
      }),

    cutout:
      Object.freeze({
        minimumAlphaTest:
          0.5,

        depthTest:
          true,

        depthWrite:
          true,

        transparent:
          false,

        fog:
          true,

        sizeAttenuation:
          true
      }),

    tint:
      Object.freeze({
        near:
          Object.freeze({
            r:
              1.0,

            g:
              1.0,

            b:
              1.0
          }),

        mid:
          Object.freeze({
            r:
              0.93,

            g:
              0.95,

            b:
              0.99
          }),

        far:
          Object.freeze({
            r:
              0.80,

            g:
              0.86,

            b:
              0.93
          })
      }),

    addedMeshes:
      0,

    addedGeometries:
      0,

    addedMaterials:
      0,

    addedTextures:
      0,

    addedLights:
      0,

    addedDrawCalls:
      0,

    addedShadowMaps:
      0,

    constructionSceneTraversalCount:
      1,

    runtimeSceneTraversal:
      false,

    runtimeAllocationsPerFrame:
      0,

    atlasRedrawPerFrame:
      0,

    interactionAuthority:
      "preserved",

    collisionAuthority:
      "preserved",

    locomotionAuthority:
      "preserved",

    characterV9Authority:
      "preserved",

    characterV10Authority:
      "preserved",

    deterministic:
      true
  });

function clampV37(
  value,
  minimum,
  maximum
) {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      value
    )
  );
}

function resolveDepthBandV37(
  distance,
  previousBand = null
) {
  const {
    nearMax,
    midMax,
    hysteresis
  } =
    CLASSROOM_CHARACTER_DEPTH_OCCLUSION_POLISH_V37_PROFILE
      .depthBands;

  const safeDistance =
    Math.max(
      0,
      Number.isFinite(
        distance
      )
        ? distance
        : 0
    );

  if (
    previousBand ===
    "near"
  ) {
    if (
      safeDistance <=
      nearMax +
        hysteresis
    ) {
      return "near";
    }
  }

  if (
    previousBand ===
    "mid"
  ) {
    if (
      safeDistance <
      nearMax -
        hysteresis
    ) {
      return "near";
    }

    if (
      safeDistance <=
      midMax +
        hysteresis
    ) {
      return "mid";
    }
  }

  if (
    previousBand ===
    "far"
  ) {
    if (
      safeDistance <
      midMax -
        hysteresis
    ) {
      return safeDistance <=
        nearMax
        ? "near"
        : "mid";
    }

    return "far";
  }

  if (
    safeDistance <=
    nearMax
  ) {
    return "near";
  }

  if (
    safeDistance <=
    midMax
  ) {
    return "mid";
  }

  return "far";
}

function discoverV9CharacterSpritesV37(
  scene
) {
  if (
    !scene ||
    scene.isScene !==
      true
  ) {
    throw new TypeError(
      "V37 requires THREE.Scene"
    );
  }

  const sprites =
    [];

  /*
   * One construction-only traversal.
   * Runtime tick never traverses the scene.
   */

  scene.traverse(
    (object) => {
      if (
        isV9StudentSpriteV31(
          object
        )
      ) {
        sprites.push(
          object
        );
      }
    }
  );

  return Object.freeze(
    sprites
  );
}

function captureMaterialStateV37(
  material
) {
  return {
    material,

    color:
      material?.color?.isColor ===
        true
        ? material.color.clone()
        : null,

    alphaTest:
      material?.alphaTest,

    depthTest:
      material?.depthTest,

    depthWrite:
      material?.depthWrite,

    transparent:
      material?.transparent,

    fog:
      material?.fog,

    sizeAttenuation:
      material?.sizeAttenuation
  };
}

function configureCutoutDepthMaterialV37(
  material
) {
  if (
    !material ||
    material.isMaterial !==
      true
  ) {
    throw new TypeError(
      "V37 requires student material"
    );
  }

  const profile =
    CLASSROOM_CHARACTER_DEPTH_OCCLUSION_POLISH_V37_PROFILE;

  const previousAlphaTest =
    Number.isFinite(
      material.alphaTest
    )
      ? material.alphaTest
      : 0;

  material.alphaTest =
    Math.max(
      previousAlphaTest,
      profile.cutout
        .minimumAlphaTest
    );

  material.depthTest =
    profile.cutout
      .depthTest;

  material.depthWrite =
    profile.cutout
      .depthWrite;

  material.transparent =
    profile.cutout
      .transparent;

  if (
    "fog" in
    material
  ) {
    material.fog =
      profile.cutout
        .fog;
  }

  if (
    "sizeAttenuation" in
    material
  ) {
    material.sizeAttenuation =
      profile.cutout
        .sizeAttenuation;
  }

  material.needsUpdate =
    true;

  return material;
}

function restoreMaterialStateV37(
  state
) {
  const material =
    state.material;

  if (!material) {
    return;
  }

  if (
    state.color &&
    material.color?.isColor ===
      true
  ) {
    material.color.copy(
      state.color
    );
  }

  if (
    typeof state.alphaTest ===
      "number"
  ) {
    material.alphaTest =
      state.alphaTest;
  }

  if (
    typeof state.depthTest ===
      "boolean"
  ) {
    material.depthTest =
      state.depthTest;
  }

  if (
    typeof state.depthWrite ===
      "boolean"
  ) {
    material.depthWrite =
      state.depthWrite;
  }

  if (
    typeof state.transparent ===
      "boolean"
  ) {
    material.transparent =
      state.transparent;
  }

  if (
    typeof state.fog ===
      "boolean" &&
    "fog" in
      material
  ) {
    material.fog =
      state.fog;
  }

  if (
    typeof state.sizeAttenuation ===
      "boolean" &&
    "sizeAttenuation" in
      material
  ) {
    material.sizeAttenuation =
      state.sizeAttenuation;
  }

  material.needsUpdate =
    true;
}

function tintForBandV37(
  band
) {
  const tint =
    CLASSROOM_CHARACTER_DEPTH_OCCLUSION_POLISH_V37_PROFILE
      .tint[
        band
      ];

  if (!tint) {
    throw new Error(
      "Unknown V37 depth band: " +
      band
    );
  }

  return tint;
}

function applyDepthTintV37({
  material,
  originalColor,
  band
}) {
  if (
    !material?.color?.isColor ||
    !originalColor?.isColor
  ) {
    return false;
  }

  const tint =
    tintForBandV37(
      band
    );

  material.color.setRGB(
    clampV37(
      originalColor.r *
        tint.r,
      0,
      1
    ),

    clampV37(
      originalColor.g *
        tint.g,
      0,
      1
    ),

    clampV37(
      originalColor.b *
        tint.b,
      0,
      1
    )
  );

  return true;
}

function createClassroomCharacterDepthOcclusionPolishV37({
  scene,
  camera
}) {
  if (
    !scene ||
    scene.isScene !==
      true
  ) {
    throw new TypeError(
      "V37 requires THREE.Scene"
    );
  }

  if (
    !camera ||
    camera.isCamera !==
      true
  ) {
    throw new TypeError(
      "V37 requires THREE.Camera"
    );
  }

  const sprites =
    discoverV9CharacterSpritesV37(
      scene
    );

  const materialUseCount =
    new Map();

  for (
    const sprite
    of sprites
  ) {
    const material =
      sprite.material;

    materialUseCount.set(
      material,
      (
        materialUseCount.get(
          material
        ) ??
        0
      ) +
      1
    );
  }

  const materialStates =
    new Map();

  const configuredMaterials =
    new Set();

  const spriteStates =
    sprites.map(
      (
        sprite,
        index
      ) => {
        const material =
          sprite.material;

        if (
          !materialStates.has(
            material
          )
        ) {
          materialStates.set(
            material,
            captureMaterialStateV37(
              material
            )
          );
        }

        if (
          !configuredMaterials.has(
            material
          )
        ) {
          configureCutoutDepthMaterialV37(
            material
          );

          configuredMaterials.add(
            material
          );
        }

        return {
          index,

          sprite,

          material,

          materialShared:
            (
              materialUseCount.get(
                material
              ) ??
              0
            ) >
            1,

          originalColor:
            materialStates
              .get(
                material
              )
              ?.color
              ?.clone() ??
            null,

          band:
            null,

          distance:
            0,

          worldPosition:
            new THREE.Vector3(),

          originalPosition:
            sprite.position.clone(),

          originalScale:
            sprite.scale.clone(),

          originalRenderOrder:
            sprite.renderOrder,

          originalLayersMask:
            sprite.layers.mask,

          originalRaycast:
            sprite.raycast
        };
      }
    );

  const cameraWorldPosition =
    new THREE.Vector3();

  let disposed =
    false;

  let tickCount =
    0;

  let totalBandMutations =
    0;

  let lastBandMutationCount =
    0;

  function tick() {
    if (disposed) {
      return;
    }

    tickCount +=
      1;

    lastBandMutationCount =
      0;

    camera.getWorldPosition(
      cameraWorldPosition
    );

    for (
      const state
      of spriteStates
    ) {
      state.sprite.getWorldPosition(
        state.worldPosition
      );

      state.distance =
        state.worldPosition.distanceTo(
          cameraWorldPosition
        );

      const nextBand =
        resolveDepthBandV37(
          state.distance,
          state.band
        );

      if (
        nextBand ===
        state.band
      ) {
        continue;
      }

      state.band =
        nextBand;

      /*
       * Shared materials cannot receive per-sprite distance tint
       * without coupling several characters to one state.
       *
       * Their cutout/depth contract is still upgraded, but tint
       * stays untouched.
       */

      if (
        state.materialShared
      ) {
        continue;
      }

      if (
        applyDepthTintV37({
          material:
            state.material,

          originalColor:
            state.originalColor,

          band:
            nextBand
        })
      ) {
        lastBandMutationCount +=
          1;

        totalBandMutations +=
          1;
      }
    }
  }

  /*
   * Establish correct initial depth bands before first render.
   */

  tick();

  function getSnapshot() {
    const bandCounts = {
      near:
        0,

      mid:
        0,

      far:
        0
    };

    for (
      const state
      of spriteStates
    ) {
      if (
        state.band in
        bandCounts
      ) {
        bandCounts[
          state.band
        ] +=
          1;
      }
    }

    const authorityPreserved =
      spriteStates.every(
        (state) =>
          state.sprite.position.equals(
            state.originalPosition
          ) &&
          state.sprite.scale.equals(
            state.originalScale
          ) &&
          state.sprite.renderOrder ===
            state.originalRenderOrder &&
          state.sprite.layers.mask ===
            state.originalLayersMask &&
          state.sprite.raycast ===
            state.originalRaycast
      );

    const materials =
      Array.from(
        configuredMaterials
      );

    return Object.freeze({
      id:
        CLASSROOM_CHARACTER_DEPTH_OCCLUSION_POLISH_V37_PROFILE
          .id,

      studentSpriteCount:
        sprites.length,

      uniqueMaterialCount:
        configuredMaterials.size,

      sharedMaterialCount:
        Array.from(
          materialUseCount.values()
        ).filter(
          (count) =>
            count >
            1
        ).length,

      nearCount:
        bandCounts.near,

      midCount:
        bandCounts.mid,

      farCount:
        bandCounts.far,

      tickCount,

      lastBandMutationCount,

      totalBandMutations,

      strictCutoutAlpha:
        materials.every(
          (material) =>
            material.alphaTest >=
            CLASSROOM_CHARACTER_DEPTH_OCCLUSION_POLISH_V37_PROFILE
              .cutout
              .minimumAlphaTest
        ),

      depthTestEnabled:
        materials.every(
          (material) =>
            material.depthTest ===
            true
        ),

      depthWriteEnabled:
        materials.every(
          (material) =>
            material.depthWrite ===
            true
        ),

      blendedTransparencyDisabled:
        materials.every(
          (material) =>
            material.transparent ===
            false
        ),

      fogParticipation:
        materials.every(
          (material) =>
            !(
              "fog" in
              material
            ) ||
            material.fog ===
              true
        ),

      perspectiveSizeAttenuation:
        materials.every(
          (material) =>
            !(
              "sizeAttenuation" in
              material
            ) ||
            material.sizeAttenuation ===
              true
        ),

      positionScaleLayerRaycastAuthorityPreserved:
        authorityPreserved,

      addedMeshes:
        0,

      addedGeometries:
        0,

      addedMaterials:
        0,

      addedTextures:
        0,

      addedLights:
        0,

      addedDrawCalls:
        0,

      addedShadowMaps:
        0,

      constructionSceneTraversalCount:
        1,

      runtimeSceneTraversal:
        false,

      runtimeAllocationsPerFrame:
        0,

      atlasRedrawPerFrame:
        0,

      disposed
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
      of materialStates.values()
    ) {
      restoreMaterialStateV37(
        state
      );
    }
  }

  return Object.freeze({
    tick,
    getSnapshot,
    dispose
  });
}

export {
  CLASSROOM_CHARACTER_DEPTH_OCCLUSION_POLISH_V37_PROFILE,
  applyDepthTintV37,
  configureCutoutDepthMaterialV37,
  createClassroomCharacterDepthOcclusionPolishV37,
  discoverV9CharacterSpritesV37,
  resolveDepthBandV37,
  restoreMaterialStateV37
};
