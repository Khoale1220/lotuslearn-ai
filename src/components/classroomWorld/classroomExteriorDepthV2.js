import * as THREE from "three";

const WINDOW_NAMES =
  Object.freeze([
    "window-north",
    "window-center",
    "window-south"
  ]);

const EXTERIOR_DEPTH_CONFIG =
  Object.freeze({
    width: 2.38,
    height: 1.58,

    layers:
      Object.freeze([
        Object.freeze({
          name: "mountains",
          z: 0.0205,
          parallax: 0.008
        }),

        Object.freeze({
          name: "campus",
          z: 0.024,
          parallax: 0.016
        }),

        Object.freeze({
          name: "foliage",
          z: 0.0275,
          parallax: 0.028
        })
      ])
  });

function clamp(
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

function disableRaycast() {}

function createLayerTexture({
  documentObject,
  layerName
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

  context.clearRect(
    0,
    0,
    96,
    54
  );

  if (
    layerName ===
    "mountains"
  ) {
    context.fillStyle =
      "#6f8f92";

    const blocks = [
      [0, 30, 13, 24],
      [10, 25, 17, 29],
      [24, 31, 14, 23],
      [35, 23, 19, 31],
      [51, 29, 16, 25],
      [64, 21, 18, 33],
      [79, 27, 17, 27]
    ];

    for (
      const [
        x,
        y,
        width,
        height
      ]
      of blocks
    ) {
      context.fillRect(
        x,
        y,
        width,
        height
      );
    }

    context.fillStyle =
      "#58787a";

    context.fillRect(
      0,
      38,
      96,
      16
    );
  }

  if (
    layerName ===
    "campus"
  ) {
    context.fillStyle =
      "#d2c19c";

    context.fillRect(
      4,
      31,
      28,
      19
    );

    context.fillRect(
      55,
      28,
      35,
      22
    );

    context.fillStyle =
      "#72574a";

    context.fillRect(
      2,
      28,
      32,
      4
    );

    context.fillRect(
      52,
      25,
      40,
      4
    );

    context.fillStyle =
      "#55788b";

    for (
      const x
      of [
        8,
        15,
        22,
        59,
        67,
        75,
        83
      ]
    ) {
      context.fillRect(
        x,
        35,
        4,
        4
      );

      context.fillRect(
        x,
        43,
        4,
        4
      );
    }
  }

  if (
    layerName ===
    "foliage"
  ) {
    context.fillStyle =
      "#416b50";

    for (
      let x = 0;
      x < 96;
      x += 8
    ) {
      const height =
        10 +
        (
          (x / 8) %
          3
        ) * 3;

      context.fillRect(
        x,
        54 - height,
        7,
        height
      );
    }

    context.fillStyle =
      "#345945";

    context.fillRect(
      0,
      49,
      96,
      5
    );
  }

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

function getExteriorDepthConfig() {
  return {
    width:
      EXTERIOR_DEPTH_CONFIG.width,

    height:
      EXTERIOR_DEPTH_CONFIG.height,

    layers:
      EXTERIOR_DEPTH_CONFIG.layers.map(
        (layer) => ({
          ...layer
        })
      )
  };
}

function createClassroomExteriorDepthV2({
  scene,
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

  const geometry =
    new THREE.PlaneGeometry(
      EXTERIOR_DEPTH_CONFIG.width,
      EXTERIOR_DEPTH_CONFIG.height
    );

  const textures =
    new Map();

  const materials =
    new Map();

  for (
    const layer
    of EXTERIOR_DEPTH_CONFIG.layers
  ) {
    const texture =
      createLayerTexture({
        documentObject,
        layerName:
          layer.name
      });

    textures.set(
      layer.name,
      texture
    );

    materials.set(
      layer.name,
      new THREE.MeshBasicMaterial({
        map:
          texture,

        transparent:
          true,

        depthWrite:
          false,

        toneMapped:
          false,

        side:
          THREE.DoubleSide
      })
    );
  }

  const attachedLayers = [];

  for (
    const windowName
    of WINDOW_NAMES
  ) {
    const windowGroup =
      scene.getObjectByName(
        windowName
      );

    if (!windowGroup) {
      throw new Error(
        `window group unavailable: ${windowName}`
      );
    }

    for (
      let index = 0;
      index <
      EXTERIOR_DEPTH_CONFIG
        .layers
        .length;
      index += 1
    ) {
      const layer =
        EXTERIOR_DEPTH_CONFIG
          .layers[index];

      const mesh =
        new THREE.Mesh(
          geometry,
          materials.get(
            layer.name
          )
        );

      mesh.name =
        `${windowName}-depth-${layer.name}`;

      mesh.position.z =
        layer.z;

      mesh.renderOrder =
        2 + index;

      mesh.raycast =
        disableRaycast;

      mesh.userData
        .exteriorDepthV2 =
          true;

      mesh.userData
        .baseLocalX =
          0;

      mesh.userData
        .parallax =
          layer.parallax;

      windowGroup.add(
        mesh
      );

      attachedLayers.push({
        windowGroup,
        mesh
      });
    }
  }

  let disposed =
    false;

  function update(
    camera
  ) {
    if (
      disposed ||
      !camera
    ) {
      return;
    }

    for (
      const entry
      of attachedLayers
    ) {
      const relativeZ =
        camera.position.z -
        entry.windowGroup
          .position.z;

      const offset =
        clamp(
          -relativeZ *
            entry.mesh
              .userData
              .parallax,

          -0.095,
          0.095
        );

      entry.mesh.position.x =
        entry.mesh
          .userData
          .baseLocalX +
        offset;
    }
  }

  return {
    update,

    layerCount:
      attachedLayers.length,

    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;

      for (
        const entry
        of attachedLayers
      ) {
        entry.windowGroup.remove(
          entry.mesh
        );
      }

      geometry.dispose();

      for (
        const material
        of materials.values()
      ) {
        material.dispose();
      }

      for (
        const texture
        of textures.values()
      ) {
        texture.dispose();
      }
    }
  };
}

export {
  createClassroomExteriorDepthV2,
  getExteriorDepthConfig
};