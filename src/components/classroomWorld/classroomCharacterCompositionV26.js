const CLASSROOM_CHARACTER_COMPOSITION_V26_PROFILE =
  Object.freeze({
    id:
      "cw06-character-composition-v26",

    visualLayer:
      30,

    originalCameraFov:
      70,

    targetCameraFov:
      66,

    characterScaleMultiplier:
      1.12,

    playerHeightAuthority:
      "preserved",

    interactionAuthority:
      "preserved",

    collisionAuthority:
      "preserved",

    runtimeSceneTraversal:
      false,

    visualOnly:
      true
  });

function layerMaskV26(
  layer
) {
  return (
    1 <<
    layer
  ) >>> 0;
}

function isCharacterPresentationSpriteV26(
  object
) {
  if (
    !object ||
    object.isSprite !== true ||
    !object.layers
  ) {
    return false;
  }

  const mask =
    Number(
      object.layers.mask
    ) >>> 0;

  const visualMask =
    layerMaskV26(
      CLASSROOM_CHARACTER_COMPOSITION_V26_PROFILE
        .visualLayer
    );

  return (
    (
      mask &
      visualMask
    ) !==
    0
  );
}

function createClassroomCharacterCompositionV26({
  scene,
  camera
}) {
  if (
    !scene ||
    scene.isScene !== true
  ) {
    throw new TypeError(
      "V26 requires THREE.Scene"
    );
  }

  if (
    !camera ||
    camera.isPerspectiveCamera !==
      true
  ) {
    throw new TypeError(
      "V26 requires THREE.PerspectiveCamera"
    );
  }

  const profile =
    CLASSROOM_CHARACTER_COMPOSITION_V26_PROFILE;

  const originalCameraState =
    Object.freeze({
      fov:
        camera.fov,

      zoom:
        camera.zoom
    });

  const spriteStates =
    [];

  scene.traverse(
    (object) => {
      if (
        !isCharacterPresentationSpriteV26(
          object
        )
      ) {
        return;
      }

      spriteStates.push({
        sprite:
          object,

        scale:
          object.scale.clone()
      });

      object.scale.multiplyScalar(
        profile.characterScaleMultiplier
      );

      /*
       * Scale only.
       *
       * Position continues to belong to V10's
       * legacy-instance migration authority.
       *
       * This intentionally avoids altering:
       * - student anchor position
       * - hit proxy
       * - collision geometry
       * - raycast layer
       */
    }
  );

  camera.fov =
    profile.targetCameraFov;

  camera.updateProjectionMatrix();

  let disposed =
    false;

  function getSnapshot() {
    return Object.freeze({
      id:
        profile.id,

      visualLayer:
        profile.visualLayer,

      composedCharacterCount:
        spriteStates.length,

      characterScaleMultiplier:
        profile.characterScaleMultiplier,

      originalCameraFov:
        originalCameraState.fov,

      targetCameraFov:
        camera.fov,

      runtimeSceneTraversal:
        false,

      collisionAuthority:
        "preserved",

      interactionAuthority:
        "preserved",

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
      of spriteStates
    ) {
      if (
        state.sprite &&
        state.sprite.scale
      ) {
        state.sprite.scale.copy(
          state.scale
        );
      }
    }

    camera.fov =
      originalCameraState.fov;

    camera.zoom =
      originalCameraState.zoom;

    camera.updateProjectionMatrix();
  }

  return Object.freeze({
    getSnapshot,
    dispose
  });
}

export {
  CLASSROOM_CHARACTER_COMPOSITION_V26_PROFILE,
  createClassroomCharacterCompositionV26,
  isCharacterPresentationSpriteV26,
  layerMaskV26
};
