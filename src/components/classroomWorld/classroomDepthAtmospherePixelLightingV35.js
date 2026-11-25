const CLASSROOM_DEPTH_ATMOSPHERE_PIXEL_LIGHTING_V35_PROFILE =
  Object.freeze({
    id:
      "cw06-depth-atmosphere-pixel-lighting-v35",

    artDirection:
      "high-detail-1990s-vga-pixel-art",

    strategy:
      "calibrate-existing-fog-and-light-authorities",

    palette:
      Object.freeze({
        fog:
          0x7895a8,

        hemisphereSky:
          0xb7d6e8,

        hemisphereGround:
          0x665c54,

        directionalKey:
          0xffd29d
      }),

    depth:
      Object.freeze({
        foregroundClearUntil:
          11.5,

        atmosphericFar:
          40,

        model:
          "linear"
      }),

    lighting:
      Object.freeze({
        hemisphereIntensityMultiplier:
          0.78,

        directionalIntensityMultiplier:
          1.14
      }),

    addedMeshes:
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

    runtimeSceneTraversal:
      false,

    runtimeTick:
      false,

    runtimeMaterialMutation:
      false,

    cameraProjectionMutation:
      false,

    shadowAuthorityMutation:
      false,

    interactionAuthority:
      "preserved",

    collisionAuthority:
      "preserved",

    locomotionAuthority:
      "preserved",

    retro240pPipeline:
      "preserved",

    deterministic:
      true
  });

function clampV35(
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

function discoverLightingAuthoritiesV35(
  scene
) {
  if (
    !scene ||
    scene.isScene !==
      true
  ) {
    throw new TypeError(
      "V35 requires THREE.Scene"
    );
  }

  let hemisphereLight =
    null;

  let directionalLight =
    null;

  let hemisphereCount =
    0;

  let directionalCount =
    0;

  scene.traverse(
    (object) => {
      if (
        object?.isHemisphereLight ===
        true
      ) {
        hemisphereCount +=
          1;

        if (
          !hemisphereLight ||
          object.intensity >
            hemisphereLight.intensity
        ) {
          hemisphereLight =
            object;
        }
      }

      if (
        object?.isDirectionalLight ===
        true
      ) {
        directionalCount +=
          1;

        if (
          !directionalLight ||
          object.intensity >
            directionalLight.intensity
        ) {
          directionalLight =
            object;
        }
      }
    }
  );

  return Object.freeze({
    hemisphereLight,
    directionalLight,
    hemisphereCount,
    directionalCount
  });
}

function captureLightingStateV35({
  scene,
  hemisphereLight,
  directionalLight
}) {
  return {
    fogIdentity:
      scene.fog,

    fogColor:
      scene.fog.color.clone(),

    fogNear:
      scene.fog.near,

    fogFar:
      scene.fog.far,

    backgroundIdentity:
      scene.background,

    backgroundColor:
      scene.background?.isColor ===
        true
        ? scene.background.clone()
        : null,

    hemisphereColor:
      hemisphereLight.color.clone(),

    hemisphereGroundColor:
      hemisphereLight.groundColor.clone(),

    hemisphereIntensity:
      hemisphereLight.intensity,

    directionalColor:
      directionalLight.color.clone(),

    directionalIntensity:
      directionalLight.intensity,

    directionalPosition:
      directionalLight.position.clone(),

    directionalTargetPosition:
      directionalLight.target.position.clone(),

    directionalCastShadow:
      directionalLight.castShadow,

    shadowMapWidth:
      directionalLight.shadow?.mapSize?.x ??
      null,

    shadowMapHeight:
      directionalLight.shadow?.mapSize?.y ??
      null
  };
}

function applyDepthAtmospherePixelLightingV35({
  scene,
  hemisphereLight,
  directionalLight,
  originalState
}) {
  const profile =
    CLASSROOM_DEPTH_ATMOSPHERE_PIXEL_LIGHTING_V35_PROFILE;

  const fogNear =
    Math.min(
      originalState.fogNear,
      profile.depth.foregroundClearUntil
    );

  const fogFar =
    Math.max(
      originalState.fogFar,
      profile.depth.atmosphericFar,
      fogNear + 4
    );

  scene.fog.color.setHex(
    profile.palette.fog
  );

  scene.fog.near =
    fogNear;

  scene.fog.far =
    fogFar;

  /*
   * Match background to fog where the existing background is
   * already a Color. This prevents a visible far-distance seam.
   *
   * Do not replace texture/cube backgrounds.
   */

  if (
    scene.background?.isColor ===
    true
  ) {
    scene.background.copy(
      scene.fog.color
    );
  }

  /*
   * Friendly daylight hemisphere + warm neutral ground ambient.
   *
   * P0.6 deliberately raises broad ambient illumination so the
   * classroom reads as an educational space rather than a dark
   * cinematic environment. The existing light authority is
   * preserved; only color and intensity are calibrated.
   */

  hemisphereLight.color.setHex(
    profile.palette
      .hemisphereSky
  );

  hemisphereLight.groundColor.setHex(
    profile.palette
      .hemisphereGround
  );

  hemisphereLight.intensity =
    clampV35(
      originalState
        .hemisphereIntensity *
        profile.lighting
          .hemisphereIntensityMultiplier,

      0.1,
      10
    );

  /*
   * Warm classroom directional key.
   *
   * The key is slightly softened relative to the original scene
   * because the friendly baseline relies more on readable ambient
   * illumination than on high-contrast cinematic key lighting.
   *
   * Preserve:
   * position
   * target
   * castShadow
   * shadow-map dimensions
   */

  directionalLight.color.setHex(
    profile.palette
      .directionalKey
  );

  directionalLight.intensity =
    clampV35(
      originalState
        .directionalIntensity *
        profile.lighting
          .directionalIntensityMultiplier,

      0.1,
      10
    );

  return Object.freeze({
    fogNear,
    fogFar,

    hemisphereIntensity:
      hemisphereLight.intensity,

    directionalIntensity:
      directionalLight.intensity
  });
}

function restoreDepthAtmospherePixelLightingV35({
  scene,
  hemisphereLight,
  directionalLight,
  originalState
}) {
  scene.fog.color.copy(
    originalState.fogColor
  );

  scene.fog.near =
    originalState.fogNear;

  scene.fog.far =
    originalState.fogFar;

  if (
    originalState.backgroundColor &&
    scene.background?.isColor ===
      true
  ) {
    scene.background.copy(
      originalState.backgroundColor
    );
  }

  hemisphereLight.color.copy(
    originalState.hemisphereColor
  );

  hemisphereLight.groundColor.copy(
    originalState
      .hemisphereGroundColor
  );

  hemisphereLight.intensity =
    originalState
      .hemisphereIntensity;

  directionalLight.color.copy(
    originalState
      .directionalColor
  );

  directionalLight.intensity =
    originalState
      .directionalIntensity;
}

function createClassroomDepthAtmospherePixelLightingV35({
  scene
}) {
  if (
    !scene ||
    scene.isScene !==
      true
  ) {
    throw new TypeError(
      "V35 requires THREE.Scene"
    );
  }

  if (
    !scene.fog ||
    scene.fog.isFog !==
      true
  ) {
    throw new Error(
      "V35 requires canonical linear THREE.Fog"
    );
  }

  const authorities =
    discoverLightingAuthoritiesV35(
      scene
    );

  const {
    hemisphereLight,
    directionalLight
  } =
    authorities;

  if (!hemisphereLight) {
    throw new Error(
      "V35 could not discover canonical HemisphereLight"
    );
  }

  if (!directionalLight) {
    throw new Error(
      "V35 could not discover canonical DirectionalLight"
    );
  }

  const originalState =
    captureLightingStateV35({
      scene,
      hemisphereLight,
      directionalLight
    });

  const applied =
    applyDepthAtmospherePixelLightingV35({
      scene,
      hemisphereLight,
      directionalLight,
      originalState
    });

  let disposed =
    false;

  function getSnapshot() {
    return Object.freeze({
      id:
        CLASSROOM_DEPTH_ATMOSPHERE_PIXEL_LIGHTING_V35_PROFILE
          .id,

      hemisphereCount:
        authorities.hemisphereCount,

      directionalCount:
        authorities.directionalCount,

      canonicalHemisphereFound:
        Boolean(
          hemisphereLight
        ),

      canonicalDirectionalFound:
        Boolean(
          directionalLight
        ),

      fogIdentityPreserved:
        scene.fog ===
        originalState.fogIdentity,

      backgroundIdentityPreserved:
        scene.background ===
        originalState.backgroundIdentity,

      foregroundClearUntil:
        applied.fogNear,

      atmosphericFar:
        applied.fogFar,

      backgroundMatchesFog:
        scene.background?.isColor ===
          true
          ? scene.background.equals(
              scene.fog.color
            )
          : true,

      hemisphereIntensity:
        hemisphereLight.intensity,

      directionalIntensity:
        directionalLight.intensity,

      directionalToHemisphereRatio:
        directionalLight.intensity /
        Math.max(
          0.0001,
          hemisphereLight.intensity
        ),

      directionalPositionPreserved:
        directionalLight.position.equals(
          originalState
            .directionalPosition
        ),

      directionalTargetPreserved:
        directionalLight.target.position.equals(
          originalState
            .directionalTargetPosition
        ),

      directionalCastShadowPreserved:
        directionalLight.castShadow ===
        originalState
          .directionalCastShadow,

      shadowMapResolutionPreserved:
        (
          directionalLight.shadow?.mapSize?.x ??
          null
        ) ===
          originalState.shadowMapWidth &&
        (
          directionalLight.shadow?.mapSize?.y ??
          null
        ) ===
          originalState.shadowMapHeight,

      addedMeshes:
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

      runtimeSceneTraversal:
        false,

      runtimeTick:
        false,

      runtimeMaterialMutation:
        false,

      cameraProjectionMutation:
        false,

      shadowAuthorityMutation:
        false,

      disposed
    });
  }

  function dispose() {
    if (disposed) {
      return;
    }

    disposed =
      true;

    restoreDepthAtmospherePixelLightingV35({
      scene,
      hemisphereLight,
      directionalLight,
      originalState
    });
  }

  return Object.freeze({
    getSnapshot,
    dispose
  });
}

export {
  CLASSROOM_DEPTH_ATMOSPHERE_PIXEL_LIGHTING_V35_PROFILE,
  applyDepthAtmospherePixelLightingV35,
  captureLightingStateV35,
  createClassroomDepthAtmospherePixelLightingV35,
  discoverLightingAuthoritiesV35,
  restoreDepthAtmospherePixelLightingV35
};
