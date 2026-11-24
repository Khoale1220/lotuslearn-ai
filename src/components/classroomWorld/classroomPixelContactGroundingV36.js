import * as THREE from "three";

import {
  isV9StudentSpriteV31,
  stableHashStringV31
} from "./classroomCharacterSilhouettePolishV31.js";

const CLASSROOM_PIXEL_CONTACT_GROUNDING_V36_PROFILE =
  Object.freeze({
    id:
      "cw06-pixel-contact-grounding-v36",

    artDirection:
      "high-detail-1990s-vga-pixel-art",

    strategy:
      "preserve-furniture-shadow-authority-add-instanced-character-contact",

    contactStyle:
      "hard-edged-pixel-ground-shadow",

    furnitureShadowAuthority:
      "classroom-furniture-v2",

    v27ShadowPocketAuthority:
      "preserved",

    contactShadowsPerStudent:
      1,

    addedMeshes:
      1,

    addedGeometries:
      1,

    addedMaterials:
      1,

    addedTextures:
      0,

    addedLights:
      0,

    addedDrawCalls:
      1,

    addedShadowMaps:
      0,

    constructionSceneTraversalCount:
      1,

    runtimeSceneTraversal:
      false,

    runtimeTick:
      false,

    interactionAuthority:
      "preserved",

    collisionAuthority:
      "preserved",

    locomotionAuthority:
      "preserved",

    visualLayer:
      30,

    deterministic:
      true
  });

const CONTACT_COLORS_V36 =
  Object.freeze([
    0x211925,
    0x241b2d,
    0x1d2530,
    0x2b1d2a,
    0x20202c,
    0x271d32
  ]);

function semanticTextV36(
  object
) {
  const values =
    [
      object?.name,
      object?.type,
      object?.material?.name,
      object?.userData?.role,
      object?.userData?.type,
      object?.userData?.kind,
      object?.userData?.visualRole
    ];

  return values
    .filter(
      (value) =>
        typeof value ===
          "string"
    )
    .join(" ")
    .toLowerCase();
}

function hasFurnitureRootAncestorV36(
  object
) {
  let current =
    object;

  while (current) {
    if (
      current.name ===
      "classroom-furniture-v2"
    ) {
      return true;
    }

    current =
      current.parent;
  }

  return false;
}

function looksLikeFurnitureShadowV36(
  object
) {
  if (
    !object ||
    object.isMesh !==
      true ||
    !hasFurnitureRootAncestorV36(
      object
    )
  ) {
    return false;
  }

  const text =
    semanticTextV36(
      object
    );

  if (
    /\bshadow\b|grounding|contact/u
      .test(
        text
      )
  ) {
    return true;
  }

  const material =
    object.material;

  const geometry =
    object.geometry;

  if (
    !material ||
    Array.isArray(
      material
    )
  ) {
    return false;
  }

  /*
   * Source-aware fallback for existing furniture shadow
   * planes whose name may not contain "shadow".
   *
   * Restricted to the canonical furniture-v2 hierarchy,
   * so V27 cinematic pockets are never captured here.
   */

  return (
    geometry?.type ===
      "PlaneGeometry" &&
    material.transparent ===
      true &&
    Number.isFinite(
      material.opacity
    ) &&
    material.opacity <=
      0.65
  );
}

function captureFurnitureShadowStateV36(
  object
) {
  const material =
    object.material;

  return Object.freeze({
    object,

    material,

    visible:
      object.visible,

    renderOrder:
      object.renderOrder,

    opacity:
      material?.opacity ??
      null,

    transparent:
      material?.transparent ??
      null,

    depthWrite:
      material?.depthWrite ??
      null,

    color:
      material?.color?.isColor ===
        true
        ? material.color.getHex()
        : null
  });
}

function furnitureShadowStatePreservedV36(
  state
) {
  const {
    object,
    material
  } =
    state;

  if (
    !object ||
    object.material !==
      material
  ) {
    return false;
  }

  if (
    object.visible !==
    state.visible
  ) {
    return false;
  }

  if (
    object.renderOrder !==
    state.renderOrder
  ) {
    return false;
  }

  if (
    material?.opacity !==
    state.opacity
  ) {
    return false;
  }

  if (
    material?.transparent !==
    state.transparent
  ) {
    return false;
  }

  if (
    material?.depthWrite !==
    state.depthWrite
  ) {
    return false;
  }

  if (
    state.color !==
      null &&
    material?.color?.getHex() !==
      state.color
  ) {
    return false;
  }

  return true;
}

function discoverGroundingSourcesV36(
  scene
) {
  if (
    !scene ||
    scene.isScene !==
      true
  ) {
    throw new TypeError(
      "V36 requires THREE.Scene"
    );
  }

  const studentSprites =
    [];

  const furnitureShadows =
    [];

  let furnitureRootFound =
    false;

  /*
   * Exactly one construction-time scene traversal.
   */

  scene.traverse(
    (object) => {
      if (
        object.name ===
        "classroom-furniture-v2"
      ) {
        furnitureRootFound =
          true;
      }

      if (
        isV9StudentSpriteV31(
          object
        )
      ) {
        studentSprites.push(
          object
        );
      }

      if (
        looksLikeFurnitureShadowV36(
          object
        )
      ) {
        furnitureShadows.push(
          object
        );
      }
    }
  );

  return Object.freeze({
    studentSprites:
      Object.freeze(
        studentSprites
      ),

    furnitureShadows:
      Object.freeze(
        furnitureShadows
      ),

    furnitureRootFound
  });
}

function resolveStudentKeyV36(
  sprite
) {
  const userData =
    sprite?.userData ??
    {};

  const candidates =
    [
      userData.studentKey,
      userData.studentId,
      userData.studentID,
      userData.key,
      userData.identity?.studentKey,
      userData.identity?.studentId,
      sprite?.name
    ];

  for (
    const candidate
    of candidates
  ) {
    if (
      typeof candidate ===
        "string" &&
      candidate.trim()
    ) {
      return candidate.trim();
    }
  }

  return "student";
}

function resolveWorldPositionV36(
  object
) {
  const result =
    new THREE.Vector3();

  if (
    typeof object.getWorldPosition ===
      "function"
  ) {
    object.getWorldPosition(
      result
    );

    return result;
  }

  result.copy(
    object.position
  );

  return result;
}

function deriveStudentContactShadowV36({
  sprite,
  studentIndex
}) {
  const studentKey =
    resolveStudentKeyV36(
      sprite
    );

  const position =
    resolveWorldPositionV36(
      sprite
    );

  const hash =
    stableHashStringV31(
      "contact-v36:" +
      studentKey
    );

  const width =
    0.46 +
    (
      hash %
      5
    ) *
    0.018;

  const depth =
    0.18 +
    (
      (
        hash >>>
        5
      ) %
      4
    ) *
    0.014;

  const rotationY =
    (
      (
        (
          hash >>>
          9
        ) %
        9
      ) -
      4
    ) *
    0.018;

  /*
   * Tiny deterministic bias away from the existing warm
   * key-light direction gives the shadow a less perfectly
   * centered "sticker" appearance without introducing
   * runtime lighting calculations.
   */

  const offsetX =
    -0.035 -
    (
      (
        hash >>>
        14
      ) %
      3
    ) *
    0.008;

  const offsetZ =
    -0.020 -
    (
      (
        hash >>>
        17
      ) %
      3
    ) *
    0.007;

  return Object.freeze({
    studentIndex,
    studentKey,

    position:
      Object.freeze({
        x:
          position.x +
          offsetX,

        y:
          0.012,

        z:
          position.z +
          offsetZ
      }),

    rotationY,

    scale:
      Object.freeze({
        x:
          width,

        y:
          depth
      }),

    color:
      CONTACT_COLORS_V36[
        hash %
        CONTACT_COLORS_V36.length
      ]
  });
}

function disableRaycastV36(
  object
) {
  object.raycast =
    function noV36Raycast() {};

  object.userData = {
    ...object.userData,

    cw06V36:
      true,

    visualOnly:
      true,

    interactionExcluded:
      true,

    collisionExcluded:
      true
  };

  return object;
}

function createClassroomPixelContactGroundingV36({
  scene
}) {
  if (
    !scene ||
    scene.isScene !==
      true
  ) {
    throw new TypeError(
      "V36 requires THREE.Scene"
    );
  }

  const discovery =
    discoverGroundingSourcesV36(
      scene
    );

  const furnitureShadowState =
    discovery.furnitureShadows.map(
      captureFurnitureShadowStateV36
    );

  const contactBlueprints =
    discovery.studentSprites.map(
      (
        sprite,
        studentIndex
      ) =>
        deriveStudentContactShadowV36({
          sprite,
          studentIndex
        })
    );

  const root =
    new THREE.Group();

  root.name =
    "classroom-pixel-contact-grounding-v36";

  root.userData = {
    cw06V36:
      true,

    visualOnly:
      true,

    interactionExcluded:
      true,

    collisionExcluded:
      true
  };

  let geometry =
    null;

  let material =
    null;

  let contactMesh =
    null;

  if (
    contactBlueprints.length >
    0
  ) {
    /*
     * Hard rectangular contact pools intentionally fit
     * the 426x240 VGA language better than smooth AO blobs.
     */

    geometry =
      new THREE.PlaneGeometry(
        1,
        1
      );

    material =
      new THREE.MeshBasicMaterial({
        color:
          0xffffff,

        transparent:
          true,

        opacity:
          0.38,

        depthTest:
          true,

        depthWrite:
          false,

        toneMapped:
          false,

        polygonOffset:
          true,

        polygonOffsetFactor:
          -1,

        polygonOffsetUnits:
          -1
      });

    material.name =
      "cw06-v36-pixel-contact-shadow-material";

    contactMesh =
      new THREE.InstancedMesh(
        geometry,
        material,
        contactBlueprints.length
      );

    contactMesh.name =
      "cw06-v36-student-contact-shadows";

    contactMesh.layers.set(
      30
    );

    contactMesh.castShadow =
      false;

    contactMesh.receiveShadow =
      false;

    contactMesh.frustumCulled =
      true;

    disableRaycastV36(
      contactMesh
    );

    const dummy =
      new THREE.Object3D();

    contactBlueprints.forEach(
      (
        blueprint,
        index
      ) => {
        dummy.position.set(
          blueprint.position.x,
          blueprint.position.y,
          blueprint.position.z
        );

        dummy.rotation.set(
          -Math.PI / 2,
          blueprint.rotationY,
          0
        );

        dummy.scale.set(
          blueprint.scale.x,
          blueprint.scale.y,
          1
        );

        dummy.updateMatrix();

        contactMesh.setMatrixAt(
          index,
          dummy.matrix
        );

        contactMesh.setColorAt(
          index,
          new THREE.Color(
            blueprint.color
          )
        );
      }
    );

    contactMesh
      .instanceMatrix
      .needsUpdate =
      true;

    if (
      contactMesh.instanceColor
    ) {
      contactMesh
        .instanceColor
        .needsUpdate =
        true;
    }

    /*
     * Required after instance transforms change so frustum
     * culling and helper/raycast infrastructure do not
     * operate on stale bounds.
     */

    contactMesh.computeBoundingBox();
    contactMesh.computeBoundingSphere();

    contactMesh.matrixAutoUpdate =
      false;

    contactMesh.updateMatrix();

    root.add(
      contactMesh
    );
  }

  disableRaycastV36(
    root
  );

  root.matrixAutoUpdate =
    false;

  root.updateMatrix();

  scene.add(
    root
  );

  let disposed =
    false;

  function getSnapshot() {
    return Object.freeze({
      id:
        CLASSROOM_PIXEL_CONTACT_GROUNDING_V36_PROFILE
          .id,

      furnitureRootFound:
        discovery.furnitureRootFound,

      existingFurnitureShadowCount:
        discovery.furnitureShadows.length,

      furnitureShadowAuthorityPreserved:
        furnitureShadowState.every(
          furnitureShadowStatePreservedV36
        ),

      studentSpriteCount:
        discovery.studentSprites.length,

      contactShadowInstanceCount:
        contactBlueprints.length,

      contactShadowsPerStudent:
        contactBlueprints.length > 0
          ? contactBlueprints.length /
            discovery.studentSprites.length
          : 0,

      staticDrawCalls:
        contactMesh
          ? 1
          : 0,

      instanceBoundsReady:
        contactMesh
          ? Boolean(
              contactMesh.boundingBox &&
              contactMesh.boundingSphere
            )
          : true,

      visualLayer30:
        contactMesh
          ? (
              () => {
                const layer =
                  new THREE.Layers();

                layer.set(
                  30
                );

                return contactMesh.layers.test(
                  layer
                );
              }
            )()
          : true,

      transparent:
        material?.transparent ??
        null,

      opacity:
        material?.opacity ??
        null,

      depthWrite:
        material?.depthWrite ??
        null,

      depthTest:
        material?.depthTest ??
        null,

      polygonOffset:
        material?.polygonOffset ??
        null,

      addedMeshes:
        contactMesh
          ? 1
          : 0,

      addedGeometries:
        geometry
          ? 1
          : 0,

      addedMaterials:
        material
          ? 1
          : 0,

      addedTextures:
        0,

      addedLights:
        0,

      addedDrawCalls:
        contactMesh
          ? 1
          : 0,

      addedShadowMaps:
        0,

      constructionSceneTraversalCount:
        1,

      runtimeSceneTraversal:
        false,

      runtimeTick:
        false,

      interactionAuthority:
        "preserved",

      collisionAuthority:
        "preserved",

      locomotionAuthority:
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

    scene.remove(
      root
    );

    geometry?.dispose();
    material?.dispose();
  }

  return Object.freeze({
    root,
    getSnapshot,
    dispose
  });
}

export {
  CLASSROOM_PIXEL_CONTACT_GROUNDING_V36_PROFILE,
  createClassroomPixelContactGroundingV36,
  deriveStudentContactShadowV36,
  discoverGroundingSourcesV36,
  furnitureShadowStatePreservedV36,
  looksLikeFurnitureShadowV36
};
