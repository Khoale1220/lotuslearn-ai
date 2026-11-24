import * as THREE from "three";

const CLASSROOM_CINEMATIC_PALETTE_COHESION_V50_PROFILE =
  Object.freeze({
    version: 50,

    visualOnly: true,
    deterministic: true,

    constructionSceneTraversalCount: 1,
    runtimeSceneTraversalCount: 0,

    addedObjects: 0,
    addedMeshes: 0,
    addedMaterials: 0,
    addedTextures: 0,
    addedLights: 0,
    addedDrawCalls: 0,

    rendererMutationCount: 0,
    cameraMutationCount: 0,
    fogMutationCount: 0,
    backgroundMutationCount: 0,

    characterAtlasMutationCount: 0,
    characterMaterialMutationCount: 0,

    secondAnimationLoop: false,
    secondRaycastAuthority: false,

    environmentDrivenCharacterContrast: true,
    characterVisualAuthorityProtected: true,

    paletteAnchorCount: 8
  });

const V50_PALETTE_HEX =
  Object.freeze({
    ink:
      0x17151d,

    deepPlum:
      0x2d2034,

    plum:
      0x4a2f4e,

    cyanShadow:
      0x315f6d,

    cyan:
      0x4c9fa4,

    orange:
      0xd47742,

    amber:
      0xdba45f,

    cream:
      0xe8d7aa
  });

function createPaletteV50() {
  return Object.freeze({
    desk:
      Object.freeze([
        new THREE.Color(
          V50_PALETTE_HEX.deepPlum
        ),

        new THREE.Color(
          V50_PALETTE_HEX.plum
        ),

        new THREE.Color(
          V50_PALETTE_HEX.cyanShadow
        ),

        new THREE.Color(
          V50_PALETTE_HEX.cyan
        ),

        new THREE.Color(
          V50_PALETTE_HEX.orange
        ),

        new THREE.Color(
          V50_PALETTE_HEX.cream
        )
      ]),

    board:
      Object.freeze([
        new THREE.Color(
          V50_PALETTE_HEX.ink
        ),

        new THREE.Color(
          V50_PALETTE_HEX.deepPlum
        ),

        new THREE.Color(
          V50_PALETTE_HEX.cyan
        ),

        new THREE.Color(
          V50_PALETTE_HEX.orange
        ),

        new THREE.Color(
          V50_PALETTE_HEX.amber
        ),

        new THREE.Color(
          V50_PALETTE_HEX.cream
        )
      ])
  });
}

function colorDistanceSquaredV50(
  a,
  b
) {
  const dr =
    a.r - b.r;

  const dg =
    a.g - b.g;

  const db =
    a.b - b.b;

  return (
    dr * dr +
    dg * dg +
    db * db
  );
}

function linearLuminanceV50(
  color
) {
  return (
    color.r * 0.2126 +
    color.g * 0.7152 +
    color.b * 0.0722
  );
}

function findNearestPaletteIndexV50(
  source,
  palette
) {
  let bestIndex =
    0;

  let bestDistance =
    Number.POSITIVE_INFINITY;

  for (
    let index = 0;
    index < palette.length;
    index += 1
  ) {
    const distance =
      colorDistanceSquaredV50(
        source,
        palette[index]
      );

    if (
      distance <
      bestDistance
    ) {
      bestDistance =
        distance;

      bestIndex =
        index;
    }
  }

  return bestIndex;
}

function harmonizeColorV50(
  source,
  role,
  index,
  paletteSet
) {
  const palette =
    role === "board"
      ? paletteSet.board
      : paletteSet.desk;

  const nearestIndex =
    findNearestPaletteIndexV50(
      source,
      palette
    );

  const nearest =
    palette[
      nearestIndex
    ];

  const luminance =
    linearLuminanceV50(
      source
    );

  let blendAmount =
    role === "board"
      ? 0.24
      : 0.30;

  /*
   * Preserve the hard, near-black VGA silhouettes.
   * They are important to the reference look.
   */
  if (
    luminance < 0.035
  ) {
    blendAmount =
      0.10;
  }
  else if (
    luminance > 0.72
  ) {
    blendAmount =
      0.17;
  }

  /*
   * A tiny deterministic secondary bias prevents
   * a mechanically quantized "everything is one
   * nearest swatch" result while keeping the same
   * palette family.
   */
  const direction =
    index % 2 === 0
      ? 1
      : -1;

  const secondaryIndex =
    (
      nearestIndex +
      direction +
      palette.length
    ) %
    palette.length;

  const target =
    nearest
      .clone()
      .lerp(
        palette[
          secondaryIndex
        ],
        0.06
      );

  return source
    .clone()
    .lerp(
      target,
      blendAmount
    );
}

function looksLikeCharacterVisualV50(
  object
) {
  if (!object) {
    return false;
  }

  if (
    object.userData?.studentKey ||
    object.userData?.studentId ||
    object.userData?.characterId
  ) {
    return true;
  }

  const name =
    String(
      object.name ?? ""
    )
      .toLowerCase();

  return (
    name.includes(
      "student"
    ) ||
    name.includes(
      "character"
    )
  );
}

function discoverCohesionTargetsV50(
  scene
) {
  let deskPixelMesh =
    null;

  let noticeboardPixelMesh =
    null;

  let storyPanelMesh =
    null;

  let storyPaperMesh =
    null;

  let characterVisualCount =
    0;

  scene.traverse((object) => {
    if (
      object.name ===
      "classroom-v49-desk-pixel-props"
    ) {
      deskPixelMesh =
        object;
    }

    if (
      object.name ===
      "classroom-v49-noticeboard-pixel-layer"
    ) {
      noticeboardPixelMesh =
        object;
    }

    if (
      object.name ===
      "classroom-v48-story-panel"
    ) {
      storyPanelMesh =
        object;
    }

    if (
      object.name ===
      "classroom-v48-story-papers"
    ) {
      storyPaperMesh =
        object;
    }

    if (
      looksLikeCharacterVisualV50(
        object
      )
    ) {
      characterVisualCount += 1;
    }
  });

  return Object.freeze({
    deskPixelMesh,
    noticeboardPixelMesh,
    storyPanelMesh,
    storyPaperMesh,

    characterVisualCount,

    traversalCount:
      1
  });
}

function assertOwnedPixelMeshV50(
  mesh,
  label
) {
  if (
    !mesh ||
    !mesh.isInstancedMesh
  ) {
    throw new Error(
      `V50_${label}_INSTANCED_MESH_MISSING`
    );
  }

  if (
    !mesh.instanceColor
  ) {
    throw new Error(
      `V50_${label}_INSTANCE_COLOR_MISSING`
    );
  }

  if (
    Array.isArray(
      mesh.material
    )
  ) {
    throw new Error(
      `V50_${label}_MULTI_MATERIAL_UNSUPPORTED`
    );
  }

  if (
    mesh.material?.toneMapped !==
      false
  ) {
    throw new Error(
      `V50_${label}_TONEMAP_POLICY_DRIFT`
    );
  }
}

function captureInstanceColorsV50(
  mesh
) {
  const count =
    mesh.count;

  const values =
    new Float32Array(
      count * 3
    );

  const color =
    new THREE.Color();

  for (
    let index = 0;
    index < count;
    index += 1
  ) {
    mesh.getColorAt(
      index,
      color
    );

    const offset =
      index * 3;

    values[
      offset
    ] =
      color.r;

    values[
      offset + 1
    ] =
      color.g;

    values[
      offset + 2
    ] =
      color.b;
  }

  return values;
}

function restoreInstanceColorsV50(
  mesh,
  values
) {
  const color =
    new THREE.Color();

  const count =
    Math.min(
      mesh.count,
      Math.floor(
        values.length / 3
      )
    );

  for (
    let index = 0;
    index < count;
    index += 1
  ) {
    const offset =
      index * 3;

    color.setRGB(
      values[
        offset
      ],

      values[
        offset + 1
      ],

      values[
        offset + 2
      ],

      THREE.LinearSRGBColorSpace
    );

    mesh.setColorAt(
      index,
      color
    );
  }

  if (
    mesh.instanceColor
  ) {
    mesh.instanceColor.needsUpdate =
      true;
  }
}

function harmonizeInstancedColorsV50({
  mesh,
  role,
  paletteSet
}) {
  const color =
    new THREE.Color();

  let changedCount =
    0;

  for (
    let index = 0;
    index < mesh.count;
    index += 1
  ) {
    mesh.getColorAt(
      index,
      color
    );

    const harmonized =
      harmonizeColorV50(
        color,
        role,
        index,
        paletteSet
      );

    const delta =
      colorDistanceSquaredV50(
        color,
        harmonized
      );

    if (
      delta >
      1e-12
    ) {
      changedCount += 1;
    }

    mesh.setColorAt(
      index,
      harmonized
    );
  }

  if (
    mesh.instanceColor
  ) {
    mesh.instanceColor.needsUpdate =
      true;
  }

  return changedCount;
}

function createClassroomCinematicPaletteCohesionV50({
  scene
}) {
  if (
    !scene ||
    typeof scene.traverse !==
      "function"
  ) {
    throw new TypeError(
      "V50 requires scene.traverse"
    );
  }

  const discovery =
    discoverCohesionTargetsV50(
      scene
    );

  assertOwnedPixelMeshV50(
    discovery.deskPixelMesh,
    "DESK"
  );

  assertOwnedPixelMeshV50(
    discovery.noticeboardPixelMesh,
    "NOTICEBOARD"
  );

  if (
    !discovery.storyPanelMesh ||
    !discovery.storyPaperMesh
  ) {
    throw new Error(
      "V50_V48_STORY_LAYER_MISSING"
    );
  }

  const deskPixelMesh =
    discovery.deskPixelMesh;

  const noticeboardPixelMesh =
    discovery.noticeboardPixelMesh;

  const paletteSet =
    createPaletteV50();

  /*
   * Capture exact linear-space instance colors.
   *
   * V50 can therefore restore V49 bit-for-bit in
   * floating point color components on dispose.
   */
  const deskOriginalColors =
    captureInstanceColorsV50(
      deskPixelMesh
    );

  const boardOriginalColors =
    captureInstanceColorsV50(
      noticeboardPixelMesh
    );

  const deskColorMutationCount =
    harmonizeInstancedColorsV50({
      mesh:
        deskPixelMesh,

      role:
        "desk",

      paletteSet
    });

  const boardColorMutationCount =
    harmonizeInstancedColorsV50({
      mesh:
        noticeboardPixelMesh,

      role:
        "board",

      paletteSet
    });

  let disposed =
    false;

  function getSnapshot() {
    return Object.freeze({
      version:
        50,

      constructionSceneTraversalCount:
        discovery.traversalCount,

      runtimeSceneTraversalCount:
        0,

      deskInstanceCount:
        deskPixelMesh.count,

      boardInstanceCount:
        noticeboardPixelMesh.count,

      deskColorMutationCount,

      boardColorMutationCount,

      environmentColorMutationCount:
        deskColorMutationCount +
        boardColorMutationCount,

      characterVisualCount:
        discovery.characterVisualCount,

      characterAtlasMutationCount:
        0,

      characterMaterialMutationCount:
        0,

      rendererMutationCount:
        0,

      cameraMutationCount:
        0,

      fogMutationCount:
        0,

      backgroundMutationCount:
        0,

      addedObjects:
        0,

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

      secondAnimationLoop:
        false,

      secondRaycastAuthority:
        false,

      deskToneMapped:
        deskPixelMesh.material
          .toneMapped,

      noticeboardToneMapped:
        noticeboardPixelMesh.material
          .toneMapped,

      characterVisualAuthorityProtected:
        true,

      environmentDrivenCharacterContrast:
        true
    });
  }

  function dispose() {
    if (disposed) {
      return;
    }

    disposed =
      true;

    restoreInstanceColorsV50(
      deskPixelMesh,
      deskOriginalColors
    );

    restoreInstanceColorsV50(
      noticeboardPixelMesh,
      boardOriginalColors
    );
  }

  return Object.freeze({
    getSnapshot,
    dispose
  });
}

export {
  CLASSROOM_CINEMATIC_PALETTE_COHESION_V50_PROFILE,
  V50_PALETTE_HEX,
  colorDistanceSquaredV50,
  linearLuminanceV50,
  harmonizeColorV50,
  looksLikeCharacterVisualV50,
  discoverCohesionTargetsV50,
  captureInstanceColorsV50,
  restoreInstanceColorsV50,
  createClassroomCinematicPaletteCohesionV50
};