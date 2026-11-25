import * as THREE from "three";

const CLASSROOM_32BIT_PALETTE =
  Object.freeze({
    sky: 0x9dcce8,
    haze: 0xb9d6e5,

    wall: 0xf2e8cf,
    wallShadow: 0xd3c7ab,

    trim: 0x6b8f71,
    frame: 0x4a5d55,

    sill: 0xd6d0c4,

    wood: 0xa86f3d,
    woodDark: 0x65432d,

    metal: 0x505962,

    chalkboard: 0x284f43,

    accentBlue: 0x4d78a8,
    accentRed: 0xaa5c55,
    accentGold: 0xc6994b
  });

function createClassroomMaterialLibrary() {
  const createStandard = ({
    color,
    roughness,
    metalness = 0
  }) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      flatShading: true
    });

  return {
    wall:
      createStandard({
        color:
          CLASSROOM_32BIT_PALETTE.wall,

        roughness: 0.92
      }),

    wallShadow:
      createStandard({
        color:
          CLASSROOM_32BIT_PALETTE.wallShadow,

        roughness: 0.96
      }),

    frame:
      createStandard({
        color:
          CLASSROOM_32BIT_PALETTE.frame,

        roughness: 0.72,
        metalness: 0.08
      }),

    sill:
      createStandard({
        color:
          CLASSROOM_32BIT_PALETTE.sill,

        roughness: 0.82
      }),

    trim:
      createStandard({
        color:
          CLASSROOM_32BIT_PALETTE.trim,

        roughness: 0.86
      }),

    wood:
      createStandard({
        color:
          CLASSROOM_32BIT_PALETTE.wood,

        roughness: 0.76
      }),

    woodDark:
      createStandard({
        color:
          CLASSROOM_32BIT_PALETTE.woodDark,

        roughness: 0.82
      }),

    metal:
      createStandard({
        color:
          CLASSROOM_32BIT_PALETTE.metal,

        roughness: 0.58,
        metalness: 0.42
      }),

    chalkboard:
      createStandard({
        color:
          CLASSROOM_32BIT_PALETTE.chalkboard,

        roughness: 0.96
      })
  };
}

function disposeMaterialLibrary(
  materials
) {
  for (
    const material
    of Object.values(materials)
  ) {
    material.dispose();
  }
}

function createClassroomVisualSystem({
  renderer,
  scene
}) {
  if (
    !renderer ||
    !renderer.isWebGLRenderer
  ) {
    throw new TypeError(
      "renderer must be a THREE.WebGLRenderer"
    );
  }

  if (
    !scene ||
    !scene.isScene
  ) {
    throw new TypeError(
      "scene must be a THREE.Scene"
    );
  }

  const previousState = {
    outputColorSpace:
      renderer.outputColorSpace,

    toneMapping:
      renderer.toneMapping,

    toneMappingExposure:
      renderer.toneMappingExposure,

    imageRendering:
      renderer.domElement?.style
        ?.imageRendering ?? ""
  };

  renderer.outputColorSpace =
    THREE.SRGBColorSpace;

  renderer.toneMapping =
    THREE.ACESFilmicToneMapping;

  renderer.toneMappingExposure =
    1.04;

  if (renderer.domElement?.style) {
    renderer.domElement.style.imageRendering =
      "pixelated";
  }

  /*
   * CW08.3B:
   * ClassroomWorld bootstraps Color/Fog objects.
   * V35 owns their final atmosphere calibration.
   */

  const materials =
    createClassroomMaterialLibrary();

  let disposed = false;

  return {
    materials,

    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;

      disposeMaterialLibrary(
        materials
      );

      renderer.outputColorSpace =
        previousState.outputColorSpace;

      renderer.toneMapping =
        previousState.toneMapping;

      renderer.toneMappingExposure =
        previousState.toneMappingExposure;

      if (renderer.domElement?.style) {
        renderer.domElement.style.imageRendering =
          previousState.imageRendering;
      }
    }
  };
}

export {
  CLASSROOM_32BIT_PALETTE,
  createClassroomMaterialLibrary,
  createClassroomVisualSystem
};