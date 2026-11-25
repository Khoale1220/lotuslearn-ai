import * as THREE from "three";

const CLASSROOM_REFERENCE_WORLD_ART_V24_PROFILE =
  Object.freeze({
    id:
      "cw06-reference-world-art-v24",

    artDirection:
      "bright-warm-readable-64-bit-classroom",

    visualOnly:
      true,

    deterministic:
      true,

    referenceLanguage:
      Object.freeze({
        shadows:
          "soft-neutral-charcoal",

        exterior:
          "soft-daylight-blue",

        highlights:
          "orange-cream",

        silhouettes:
          "charcoal-readable-outline"
      })
  });

const CLASSROOM_REFERENCE_WORLD_ART_V24_PALETTE =
  Object.freeze({
    ink:
      0x30343a,

    deepPlum:
      0x5a5560,

    plum:
      0x766b77,

    wallShadow:
      0x9a8f86,

    warmWall:
      0xd7c2a6,

    cream:
      0xffefcf,

    sunOrange:
      0xe3ad69,

    wood:
      0x9a6d4f,

    woodHighlight:
      0xc89a70,

    chalkboard:
      0x315c50,

    frameBlue:
      0x526273,

    coolBlue:
      0x7093a7,

    cyan:
      0x75b7cc,

    sky:
      0xbddfed,

    ocean:
      0x6f9fb4,

    shipRust:
      0x9b6658,

    haze:
      0xb8c7d0
  });

function normalizeTokenV24(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}

function classifyReferenceWorldRoleV24({
  objectName = "",
  materialName = ""
} = {}) {
  const token =
    `${normalizeTokenV24(objectName)} ${normalizeTokenV24(materialName)}`;

  if (
    /student|character|portrait|sprite|hud|crosshair|interaction/u
      .test(
        token
      )
  ) {
    return "preserve";
  }

  /*
   * Specific environmental semantics must outrank
   * generic spatial semantics.
   *
   * Example:
   *   ocean-horizon -> ocean
   *   sea-horizon   -> ocean
   *   sky-horizon   -> sky
   */

  if (
    /ocean|sea|water|wave|whitecap|vista/u
      .test(
        token
      )
  ) {
    return "ocean";
  }

  if (
    /cargo|ship|vessel/u
      .test(
        token
      )
  ) {
    return "ship";
  }

  if (
    /sky|cloud|atmosphere/u
      .test(
        token
      )
  ) {
    return "sky";
  }

  if (
    /horizon/u
      .test(
        token
      )
  ) {
    return "sky";
  }

  if (
    /chalk|blackboard|chalkboard|board/u
      .test(
        token
      )
  ) {
    return "chalkboard";
  }

  if (
    /window|frame|sill|trim/u
      .test(
        token
      )
  ) {
    return "frame";
  }

  if (
    /desk|table|chair|wood|cabinet|shelf/u
      .test(
        token
      )
  ) {
    return "wood";
  }

  if (
    /floor/u
      .test(
        token
      )
  ) {
    return "floor";
  }

  if (
    /wall|ceiling|room|door/u
      .test(
        token
      )
  ) {
    return "wall";
  }

  if (
    /metal|headphone/u
      .test(
        token
      )
  ) {
    return "metal";
  }

  return "generic";
}

function chooseGenericTargetV24(
  color
) {
  const palette =
    CLASSROOM_REFERENCE_WORLD_ART_V24_PALETTE;

  if (
    !color?.isColor
  ) {
    return palette.warmWall;
  }

  const luma =
    color.r *
      0.2126 +
    color.g *
      0.7152 +
    color.b *
      0.0722;

  if (
    luma <
    0.16
  ) {
    return palette.deepPlum;
  }

  if (
    color.b >
      color.r * 1.12
  ) {
    return palette.coolBlue;
  }

  if (
    color.r >
      color.b * 1.16
  ) {
    return palette.warmWall;
  }

  if (
    luma >
    0.62
  ) {
    return palette.cream;
  }

  return palette.plum;
}

function targetColorForRoleV24(
  role,
  currentColor
) {
  const palette =
    CLASSROOM_REFERENCE_WORLD_ART_V24_PALETTE;

  switch (role) {
    case "sky":
      return palette.sky;

    case "ocean":
      return palette.ocean;

    case "ship":
      return palette.shipRust;

    case "chalkboard":
      return palette.chalkboard;

    case "frame":
      return palette.frameBlue;

    case "wood":
      return palette.wood;

    case "floor":
      return palette.plum;

    case "wall":
      return palette.warmWall;

    case "metal":
      return palette.frameBlue;

    default:
      return chooseGenericTargetV24(
        currentColor
      );
  }
}

function disableRaycastV24(
  object
) {
  object.raycast =
    function noReferenceWorldRaycastV24() {};
}

function configureInstancesV24({
  mesh,
  transforms
}) {
  const matrix =
    new THREE.Matrix4();

  const position =
    new THREE.Vector3();

  const quaternion =
    new THREE.Quaternion();

  const scale =
    new THREE.Vector3();

  transforms.forEach(
    (
      transform,
      index
    ) => {
      position.set(
        ...transform.position
      );

      quaternion.setFromEuler(
        new THREE.Euler(
          ...(
            transform.rotation ||
            [
              0,
              0,
              0
            ]
          )
        )
      );

      scale.set(
        ...transform.scale
      );

      matrix.compose(
        position,
        quaternion,
        scale
      );

      mesh.setMatrixAt(
        index,
        matrix
      );
    }
  );

  mesh.instanceMatrix.needsUpdate =
    true;

  mesh.computeBoundingSphere();
}

function createClassroomReferenceWorldArtV24({
  scene
}) {
  if (
    !scene?.isScene
  ) {
    throw new TypeError(
      "V24 requires THREE.Scene"
    );
  }

  let disposed =
    false;

  const palette =
    CLASSROOM_REFERENCE_WORLD_ART_V24_PALETTE;

  const materialStates =
    new Map();

  const lightStates =
    [];

  /*
   * CW08.3B:
   * V35 owns global background/fog calibration.
   * V24 remains world-art/material authority only.
   */
  const target =
    new THREE.Color();

  scene.traverse(
    (object) => {
      if (
        object.isLight
      ) {
        /*
         * CW08.3C-C:
         * V35 owns global light appearance:
         * hemisphere color / ground color / intensity
         * directional color / intensity.
         *
         * V24 remains world-art/material semantic authority only.
         */
        return;
      }

      if (
        !object.isMesh ||
        object.isSprite
      ) {
        return;
      }

      const materials =
        Array.isArray(
          object.material
        )
          ? object.material
          : [
              object.material
            ];

      for (
        const material
        of materials
      ) {
        if (
          !material?.isMaterial ||
          material.isShaderMaterial ||
          material.isSpriteMaterial ||
          !material.color?.isColor
        ) {
          continue;
        }

        const role =
          classifyReferenceWorldRoleV24({
            objectName:
              object.name,

            materialName:
              material.name
          });

        if (
          role ===
          "preserve"
        ) {
          continue;
        }

        if (
          materialStates.has(
            material.uuid
          )
        ) {
          continue;
        }

        materialStates.set(
          material.uuid,
          {
            material,

            color:
              material.color.clone(),

            roughness:
              Number.isFinite(
                material.roughness
              )
                ? material.roughness
                : null,

            metalness:
              Number.isFinite(
                material.metalness
              )
                ? material.metalness
                : null
          }
        );

        target.setHex(
          targetColorForRoleV24(
            role,
            material.color
          )
        );

        const hasTexture =
          Boolean(
            material.map
          );

        let strength =
          hasTexture
            ? 0.26
            : 0.62;

        if (
          role ===
            "ocean" ||
          role ===
            "sky"
        ) {
          strength =
            hasTexture
              ? 0.34
              : 0.74;
        }

        if (
          role ===
          "generic"
        ) {
          strength =
            hasTexture
              ? 0.14
              : 0.28;
        }

        material.color.lerp(
          target,
          strength
        );

        if (
          Number.isFinite(
            material.roughness
          )
        ) {
          material.roughness =
            Math.max(
              material.roughness,
              0.70
            );
        }

        if (
          Number.isFinite(
            material.metalness
          ) &&
          role !==
            "metal"
        ) {
          material.metalness =
            Math.min(
              material.metalness,
              0.10
            );
        }

        material.needsUpdate =
          true;
      }
    }
  );

  const root =
    new THREE.Group();

  root.name =
    "classroom-reference-world-art-v24";

  root.userData.visualOnly =
    true;

  root.userData.interactive =
    false;

  scene.add(
    root
  );

  const box =
    new THREE.BoxGeometry(
      1,
      1,
      1
    );

  const inkMaterial =
    new THREE.MeshBasicMaterial({
      color:
        palette.ink,

      toneMapped:
        false
    });

  const warmMaterial =
    new THREE.MeshBasicMaterial({
      color:
        palette.sunOrange,

      toneMapped:
        false
    });

  const windowCenters =
    [
      -3.7,
      0,
      3.7
    ];

  const verticals = [];
  const horizontals = [];
  const sills = [];

  for (
    const center
    of windowCenters
  ) {
    for (
      const offset
      of [
        -1.25,
        0,
        1.25
      ]
    ) {
      verticals.push({
        position:
          [
            6.985,
            2.15,
            center + offset
          ],

        scale:
          [
            0.095,
            1.88,
            0.105
          ]
      });
    }

    for (
      const offset
      of [
        -0.88,
        0.88
      ]
    ) {
      horizontals.push({
        position:
          [
            6.985,
            2.15 + offset,
            center
          ],

        scale:
          [
            0.095,
            0.115,
            2.60
          ]
      });
    }

    sills.push({
      position:
        [
          6.925,
          1.295,
          center
        ],

      scale:
        [
          0.035,
          0.035,
          2.42
        ]
    });
  }

  const verticalFrames =
    new THREE.InstancedMesh(
      box,
      inkMaterial,
      verticals.length
    );

  verticalFrames.name =
    "cw06-v24-window-ink-verticals";

  verticalFrames.userData.visualOnly =
    true;

  disableRaycastV24(
    verticalFrames
  );

  configureInstancesV24({
    mesh:
      verticalFrames,

    transforms:
      verticals
  });

  root.add(
    verticalFrames
  );

  const horizontalFrames =
    new THREE.InstancedMesh(
      box,
      inkMaterial,
      horizontals.length
    );

  horizontalFrames.name =
    "cw06-v24-window-ink-horizontals";

  horizontalFrames.userData.visualOnly =
    true;

  disableRaycastV24(
    horizontalFrames
  );

  configureInstancesV24({
    mesh:
      horizontalFrames,

    transforms:
      horizontals
  });

  root.add(
    horizontalFrames
  );

  const warmSills =
    new THREE.InstancedMesh(
      box,
      warmMaterial,
      sills.length
    );

  warmSills.name =
    "cw06-v24-window-warm-sills";

  warmSills.userData.visualOnly =
    true;

  disableRaycastV24(
    warmSills
  );

  configureInstancesV24({
    mesh:
      warmSills,

    transforms:
      sills
  });

  root.add(
    warmSills
  );

  const plinthTransforms =
    [
      {
        position:
          [
            -7.08,
            0.14,
            0
          ],

        scale:
          [
            0.12,
            0.28,
            14
          ]
      },

      {
        position:
          [
            7.08,
            0.14,
            0
          ],

        scale:
          [
            0.12,
            0.28,
            14
          ]
      },

      {
        position:
          [
            0,
            0.14,
            -7.08
          ],

        scale:
          [
            14,
            0.28,
            0.12
          ]
      },

      {
        position:
          [
            0,
            0.14,
            7.08
          ],

        scale:
          [
            14,
            0.28,
            0.12
          ]
      }
    ];

  const plinth =
    new THREE.InstancedMesh(
      box,
      inkMaterial,
      plinthTransforms.length
    );

  plinth.name =
    "cw06-v24-room-ink-plinth";

  plinth.userData.visualOnly =
    true;

  disableRaycastV24(
    plinth
  );

  configureInstancesV24({
    mesh:
      plinth,

    transforms:
      plinthTransforms
  });

  root.add(
    plinth
  );

  function getSnapshot() {
    return Object.freeze({
      id:
        CLASSROOM_REFERENCE_WORLD_ART_V24_PROFILE
          .id,

      artDirection:
        CLASSROOM_REFERENCE_WORLD_ART_V24_PROFILE
          .artDirection,

      gradedMaterialCount:
        materialStates.size,

      gradedLightCount:
        lightStates.length,

      windowCount:
        windowCenters.length,

      verticalFrameCount:
        verticals.length,

      horizontalFrameCount:
        horizontals.length,

      warmSillCount:
        sills.length,

      plinthCount:
        plinthTransforms.length,

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

    for (
      const state
      of materialStates.values()
    ) {
      state.material.color.copy(
        state.color
      );

      if (
        state.roughness !==
          null
      ) {
        state.material.roughness =
          state.roughness;
      }

      if (
        state.metalness !==
          null
      ) {
        state.material.metalness =
          state.metalness;
      }

      state.material.needsUpdate =
        true;
    }

    for (
      const state
      of lightStates
    ) {
      if (
        state.color
      ) {
        state.object.color.copy(
          state.color
        );
      }

      if (
        state.groundColor
      ) {
        state.object.groundColor.copy(
          state.groundColor
        );
      }

      if (
        state.intensity !==
          null
      ) {
        state.object.intensity =
          state.intensity;
      }
    }

    /*
     * CW08.3B:
     * V24 never acquired atmosphere authority,
     * therefore disposal does not restore it.
     */
    box.dispose();
    inkMaterial.dispose();
    warmMaterial.dispose();
  }

  return Object.freeze({
    getSnapshot,
    dispose
  });
}

export {
  CLASSROOM_REFERENCE_WORLD_ART_V24_PALETTE,
  CLASSROOM_REFERENCE_WORLD_ART_V24_PROFILE,
  classifyReferenceWorldRoleV24,
  createClassroomReferenceWorldArtV24
};
