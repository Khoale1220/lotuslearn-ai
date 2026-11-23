import * as THREE from "three";

const ROOM_HALF_EXTENT = 7.2;

const WINDOW_LAYOUT =
  Object.freeze([
    Object.freeze({
      id: "window-north",
      x: 7.04,
      y: 2.15,
      z: -3.7,
      width: 2.45,
      height: 1.65,
      rotationY:
        -Math.PI / 2
    }),

    Object.freeze({
      id: "window-center",
      x: 7.04,
      y: 2.15,
      z: 0,
      width: 2.45,
      height: 1.65,
      rotationY:
        -Math.PI / 2
    }),

    Object.freeze({
      id: "window-south",
      x: 7.04,
      y: 2.15,
      z: 3.7,
      width: 2.45,
      height: 1.65,
      rotationY:
        -Math.PI / 2
    })
  ]);

function getClassroomWindowLayout() {
  return WINDOW_LAYOUT.map(
    (windowDefinition) => ({
      ...windowDefinition
    })
  );
}

function createPixelExteriorTexture({
  documentObject
}) {
  if (
    !documentObject ||
    typeof documentObject.createElement
      !== "function"
  ) {
    throw new TypeError(
      "documentObject.createElement is required"
    );
  }

  const canvas =
    documentObject.createElement(
      "canvas"
    );

  canvas.width = 96;
  canvas.height = 54;

  const context =
    canvas.getContext("2d");

  if (!context) {
    throw new Error(
      "2D canvas context unavailable"
    );
  }

  context.imageSmoothingEnabled =
    false;

  // Sky — deliberately banded rather than
  // smooth to preserve a 32-bit-era pixel look.
  context.fillStyle =
    "#8ec8e8";

  context.fillRect(
    0,
    0,
    96,
    54
  );

  context.fillStyle =
    "#acd9ee";

  context.fillRect(
    0,
    10,
    96,
    16
  );

  context.fillStyle =
    "#d2e8ed";

  context.fillRect(
    0,
    23,
    96,
    10
  );

  // Clouds.
  context.fillStyle =
    "#f1f3e9";

  context.fillRect(
    9,
    10,
    15,
    3
  );

  context.fillRect(
    13,
    7,
    8,
    3
  );

  context.fillRect(
    56,
    13,
    18,
    3
  );

  context.fillRect(
    61,
    10,
    9,
    3
  );

  // Distant mountains.
  context.fillStyle =
    "#72949a";

  context.fillRect(
    0,
    30,
    96,
    7
  );

  context.fillStyle =
    "#647f82";

  const mountainBlocks = [
    [0, 28, 9, 5],
    [8, 25, 12, 8],
    [18, 27, 13, 6],
    [31, 23, 15, 10],
    [44, 26, 13, 7],
    [56, 22, 15, 11],
    [70, 26, 14, 7],
    [82, 24, 14, 9]
  ];

  for (
    const [
      x,
      y,
      width,
      height
    ]
    of mountainBlocks
  ) {
    context.fillRect(
      x,
      y,
      width,
      height
    );
  }

  // Tree belt.
  context.fillStyle =
    "#456f58";

  for (
    let x = 0;
    x < 96;
    x += 7
  ) {
    const treeHeight =
      5 + ((x / 7) % 3);

    context.fillRect(
      x,
      33 - treeHeight,
      5,
      treeHeight
    );
  }

  context.fillStyle =
    "#395e49";

  context.fillRect(
    0,
    33,
    96,
    6
  );

  // Campus buildings.
  context.fillStyle =
    "#d8c9a7";

  context.fillRect(
    8,
    36,
    22,
    11
  );

  context.fillStyle =
    "#c4b48f";

  context.fillRect(
    55,
    35,
    29,
    12
  );

  context.fillStyle =
    "#795a48";

  context.fillRect(
    7,
    34,
    24,
    3
  );

  context.fillRect(
    53,
    33,
    33,
    3
  );

  // Tiny blue windows.
  context.fillStyle =
    "#55778b";

  for (
    const buildingX
    of [11, 18, 25, 59, 66, 73, 80]
  ) {
    context.fillRect(
      buildingX,
      39,
      4,
      3
    );
  }

  // School grounds.
  context.fillStyle =
    "#78975d";

  context.fillRect(
    0,
    47,
    96,
    7
  );

  context.fillStyle =
    "#a98b65";

  context.fillRect(
    36,
    47,
    24,
    7
  );

  const texture =
    new THREE.CanvasTexture(
      canvas
    );

  texture.colorSpace =
    THREE.SRGBColorSpace;

  texture.magFilter =
    THREE.NearestFilter;

  texture.minFilter =
    THREE.NearestFilter;

  texture.generateMipmaps =
    false;

  texture.needsUpdate =
    true;

  return texture;
}

function createClassroomArchitectureV2({
  scene,
  materials,
  documentObject =
    globalThis.document
}) {
  if (
    !scene ||
    !scene.isScene
  ) {
    throw new TypeError(
      "scene must be a THREE.Scene"
    );
  }

  if (
    !materials ||
    !materials.frame ||
    !materials.sill
  ) {
    throw new TypeError(
      "shared classroom materials are required"
    );
  }

  const architecture =
    new THREE.Group();

  architecture.name =
    "classroom-architecture-v2";

  const exteriorTexture =
    createPixelExteriorTexture({
      documentObject
    });

  const exteriorMaterial =
    new THREE.MeshBasicMaterial({
      map:
        exteriorTexture,

      toneMapped:
        false
    });

  const glassMaterial =
    new THREE.MeshStandardMaterial({
      color: 0xd9f0f7,
      roughness: 0.12,
      metalness: 0,
      transparent: true,
      opacity: 0.12,
      depthWrite: false
    });

  const paneGeometry =
    new THREE.PlaneGeometry(
      2.45,
      1.65
    );

  const verticalFrameGeometry =
    new THREE.BoxGeometry(
      0.09,
      1.88,
      0.08
    );

  const horizontalFrameGeometry =
    new THREE.BoxGeometry(
      2.64,
      0.09,
      0.08
    );

  const centerFrameGeometry =
    new THREE.BoxGeometry(
      0.07,
      1.65,
      0.07
    );

  const sillGeometry =
    new THREE.BoxGeometry(
      2.72,
      0.12,
      0.32
    );

  for (
    const definition
    of WINDOW_LAYOUT
  ) {
    const windowGroup =
      new THREE.Group();

    windowGroup.name =
      definition.id;

    windowGroup.position.set(
      definition.x,
      definition.y,
      definition.z
    );

    windowGroup.rotation.y =
      definition.rotationY;

    const exterior =
      new THREE.Mesh(
        paneGeometry,
        exteriorMaterial
      );

    exterior.name =
      `${definition.id}-outside`;

    exterior.position.z =
      0.018;

    windowGroup.add(
      exterior
    );

    const glass =
      new THREE.Mesh(
        paneGeometry,
        glassMaterial
      );

    glass.name =
      `${definition.id}-glass`;

    glass.position.z =
      0.032;

    windowGroup.add(
      glass
    );

    for (
      const x
      of [-1.27, 1.27]
    ) {
      const frame =
        new THREE.Mesh(
          verticalFrameGeometry,
          materials.frame
        );

      frame.position.set(
        x,
        0,
        0.055
      );

      windowGroup.add(
        frame
      );
    }

    for (
      const y
      of [-0.88, 0.88]
    ) {
      const frame =
        new THREE.Mesh(
          horizontalFrameGeometry,
          materials.frame
        );

      frame.position.set(
        0,
        y,
        0.055
      );

      windowGroup.add(
        frame
      );
    }

    const centerFrame =
      new THREE.Mesh(
        centerFrameGeometry,
        materials.frame
      );

    centerFrame.position.z =
      0.058;

    windowGroup.add(
      centerFrame
    );

    const sill =
      new THREE.Mesh(
        sillGeometry,
        materials.sill
      );

    sill.position.set(
      0,
      -0.98,
      0.02
    );

    windowGroup.add(
      sill
    );

    architecture.add(
      windowGroup
    );
  }

  // Architectural trim gives the room a stronger
  // authored silhouette without replacing the
  // existing collision shell.
  const trimGeometry =
    new THREE.BoxGeometry(
      0.08,
      0.18,
      13.2
    );

  const upperTrim =
    new THREE.Mesh(
      trimGeometry,
      materials.trim
    );

  upperTrim.position.set(
    6.96,
    3.22,
    0
  );

  architecture.add(
    upperTrim
  );

  scene.add(
    architecture
  );

  let disposed = false;

  return {
    group:
      architecture,

    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;

      scene.remove(
        architecture
      );

      paneGeometry.dispose();
      verticalFrameGeometry.dispose();
      horizontalFrameGeometry.dispose();
      centerFrameGeometry.dispose();
      sillGeometry.dispose();
      trimGeometry.dispose();

      exteriorMaterial.dispose();
      glassMaterial.dispose();
      exteriorTexture.dispose();
    }
  };
}

export {
  ROOM_HALF_EXTENT,
  createClassroomArchitectureV2,
  createPixelExteriorTexture,
  getClassroomWindowLayout
};