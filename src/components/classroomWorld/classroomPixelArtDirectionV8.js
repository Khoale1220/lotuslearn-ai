import * as THREE from "three";

const CLASSROOM_PIXEL_ART_V8_PROFILE =
  Object.freeze({
    identity:
      "LOTUSLEARN_1990S_VGA_CLASSROOM",

    render:
      Object.freeze({
        internalWidth:
          426,

        internalHeight:
          240,

        aspectRatio:
          16 / 9,

        cssImageRendering:
          "pixelated"
      }),

    textures:
      Object.freeze({
        wall:
          32,

        wood:
          32,

        metal:
          16,

        chalkboard:
          32,

        floor:
          64,

        shadeWidth:
          16,

        shadeHeight:
          32
      }),

    sprites:
      Object.freeze({
        studentWidth:
          64,

        studentHeight:
          96,

        portraitWidth:
          128,

        portraitHeight:
          160,

        directionalViews:
          8,

        idleFrames:
          4
      }),

    palette:
      Object.freeze({
        channelLevels:
          8,

        alphaCutoff:
          0.5
      }),

    filtering:
      Object.freeze({
        mipmaps:
          false,

        anisotropy:
          1
      })
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

function normalizeChannelLevels(
  levels
) {
  if (
    !Number.isFinite(
      levels
    )
  ) {
    return (
      CLASSROOM_PIXEL_ART_V8_PROFILE
        .palette
        .channelLevels
    );
  }

  return Math.max(
    2,
    Math.trunc(
      levels
    )
  );
}

function quantizeNormalizedChannel(
  value,
  levels =
    CLASSROOM_PIXEL_ART_V8_PROFILE
      .palette
      .channelLevels
) {
  const safeValue =
    clamp(
      Number.isFinite(
        value
      )
        ? value
        : 0,
      0,
      1
    );

  const safeLevels =
    normalizeChannelLevels(
      levels
    );

  const steps =
    safeLevels -
    1;

  return (
    Math.round(
      safeValue *
      steps
    ) /
    steps
  );
}

function quantizeRgb(
  color,
  levels =
    CLASSROOM_PIXEL_ART_V8_PROFILE
      .palette
      .channelLevels
) {
  if (
    !color ||
    typeof color !==
      "object"
  ) {
    throw new TypeError(
      "color object is required"
    );
  }

  return {
    r:
      quantizeNormalizedChannel(
        color.r,
        levels
      ),

    g:
      quantizeNormalizedChannel(
        color.g,
        levels
      ),

    b:
      quantizeNormalizedChannel(
        color.b,
        levels
      )
  };
}

function configurePixelTexture(
  texture,
  {
    colorTexture = true,
    repeating = false,
    name = null
  } = {}
) {
  if (
    !texture?.isTexture
  ) {
    throw new TypeError(
      "configurePixelTexture requires a THREE.Texture"
    );
  }

  texture.magFilter =
    THREE.NearestFilter;

  texture.minFilter =
    THREE.NearestFilter;

  texture.generateMipmaps =
    false;

  texture.anisotropy =
    CLASSROOM_PIXEL_ART_V8_PROFILE
      .filtering
      .anisotropy;

  texture.colorSpace =
    colorTexture
      ? THREE.SRGBColorSpace
      : THREE.NoColorSpace;

  texture.wrapS =
    repeating
      ? THREE.RepeatWrapping
      : THREE.ClampToEdgeWrapping;

  texture.wrapT =
    repeating
      ? THREE.RepeatWrapping
      : THREE.ClampToEdgeWrapping;

  if (
    typeof name ===
      "string" &&
    name.length >
      0
  ) {
    texture.name =
      name;
  }

  texture.needsUpdate =
    true;

  return texture;
}

function createPixelCanvasTexture({
  canvas,
  name,
  colorTexture = true,
  repeating = false
}) {
  if (!canvas) {
    throw new TypeError(
      "canvas is required"
    );
  }

  const texture =
    new THREE.CanvasTexture(
      canvas
    );

  return configurePixelTexture(
    texture,
    {
      colorTexture,
      repeating,
      name
    }
  );
}

function normalizeAlphaTest(
  alphaTest
) {
  if (
    !Number.isFinite(
      alphaTest
    )
  ) {
    return (
      CLASSROOM_PIXEL_ART_V8_PROFILE
        .palette
        .alphaCutoff
    );
  }

  return clamp(
    alphaTest,
    0,
    1
  );
}

function createPixelSpriteMaterial({
  texture,
  color = 0xffffff,
  alphaTest =
    CLASSROOM_PIXEL_ART_V8_PROFILE
      .palette
      .alphaCutoff,

  sizeAttenuation = true
}) {
  if (
    !texture?.isTexture
  ) {
    throw new TypeError(
      "pixel sprite texture is required"
    );
  }

  configurePixelTexture(
    texture,
    {
      colorTexture:
        true,

      repeating:
        false
    }
  );

  const material =
    new THREE.SpriteMaterial({
      map:
        texture,

      color,

      alphaTest:
        normalizeAlphaTest(
          alphaTest
        ),

      transparent:
        false,

      depthWrite:
        true,

      depthTest:
        true,

      sizeAttenuation,

      toneMapped:
        false
    });

  material.name =
    "cw-v8-pixel-sprite-material";

  return material;
}

function computePixelPresentation({
  hostWidth,
  hostHeight,
  internalWidth =
    CLASSROOM_PIXEL_ART_V8_PROFILE
      .render
      .internalWidth,

  internalHeight =
    CLASSROOM_PIXEL_ART_V8_PROFILE
      .render
      .internalHeight
}) {
  const safeHostWidth =
    Math.max(
      1,
      Number.isFinite(
        hostWidth
      )
        ? hostWidth
        : internalWidth
    );

  const safeHostHeight =
    Math.max(
      1,
      Number.isFinite(
        hostHeight
      )
        ? hostHeight
        : internalHeight
    );

  const safeInternalWidth =
    Math.max(
      1,
      Math.trunc(
        internalWidth
      )
    );

  const safeInternalHeight =
    Math.max(
      1,
      Math.trunc(
        internalHeight
      )
    );

  const fitScale =
    Math.min(
      safeHostWidth /
        safeInternalWidth,

      safeHostHeight /
        safeInternalHeight
    );

  const integerScaleAvailable =
    fitScale >=
    1;

  const presentationScale =
    integerScaleAvailable
      ? Math.max(
          1,
          Math.floor(
            fitScale
          )
        )
      : fitScale;

  const presentationWidth =
    safeInternalWidth *
    presentationScale;

  const presentationHeight =
    safeInternalHeight *
    presentationScale;

  return {
    internalWidth:
      safeInternalWidth,

    internalHeight:
      safeInternalHeight,

    presentationScale,

    presentationWidth,

    presentationHeight,

    integerScaleAvailable,

    letterboxX:
      Math.max(
        0,
        (
          safeHostWidth -
          presentationWidth
        ) /
          2
      ),

    letterboxY:
      Math.max(
        0,
        (
          safeHostHeight -
          presentationHeight
        ) /
          2
      )
  };
}

function auditPixelTexture(
  texture,
  {
    colorTexture = true
  } = {}
) {
  const violations = [];

  if (
    !texture?.isTexture
  ) {
    return {
      pass:
        false,

      violations: [
        "NOT_THREE_TEXTURE"
      ]
    };
  }

  if (
    texture.magFilter !==
    THREE.NearestFilter
  ) {
    violations.push(
      "MAG_FILTER_NOT_NEAREST"
    );
  }

  if (
    texture.minFilter !==
    THREE.NearestFilter
  ) {
    violations.push(
      "MIN_FILTER_NOT_NEAREST"
    );
  }

  if (
    texture.generateMipmaps !==
    false
  ) {
    violations.push(
      "MIPMAPS_ENABLED"
    );
  }

  if (
    texture.anisotropy !==
    1
  ) {
    violations.push(
      "ANISOTROPY_NOT_ONE"
    );
  }

  const expectedColorSpace =
    colorTexture
      ? THREE.SRGBColorSpace
      : THREE.NoColorSpace;

  if (
    texture.colorSpace !==
    expectedColorSpace
  ) {
    violations.push(
      colorTexture
        ? "COLOR_TEXTURE_NOT_SRGB"
        : "DATA_TEXTURE_HAS_COLOR_SPACE"
    );
  }

  return {
    pass:
      violations.length ===
      0,

    violations
  };
}

function auditPixelSpriteMaterial(
  material
) {
  const violations = [];

  if (
    !material
      ?.isSpriteMaterial
  ) {
    return {
      pass:
        false,

      violations: [
        "NOT_SPRITE_MATERIAL"
      ]
    };
  }

  if (
    !material.map
  ) {
    violations.push(
      "SPRITE_MAP_MISSING"
    );
  }
  else {
    const textureAudit =
      auditPixelTexture(
        material.map,
        {
          colorTexture:
            true
        }
      );

    violations.push(
      ...textureAudit
        .violations
        .map(
          (violation) =>
            `TEXTURE_${violation}`
        )
    );
  }

  if (
    material.transparent !==
    false
  ) {
    violations.push(
      "ALPHA_BLEND_ENABLED"
    );
  }

  if (
    material.alphaTest <
    0.25
  ) {
    violations.push(
      "ALPHA_TEST_TOO_LOW"
    );
  }

  if (
    material.depthWrite !==
    true
  ) {
    violations.push(
      "DEPTH_WRITE_DISABLED"
    );
  }

  if (
    material.depthTest !==
    true
  ) {
    violations.push(
      "DEPTH_TEST_DISABLED"
    );
  }

  if (
    material.toneMapped !==
    false
  ) {
    violations.push(
      "TONE_MAPPING_ENABLED"
    );
  }

  return {
    pass:
      violations.length ===
      0,

    violations
  };
}

function createPixelArtContractSnapshot() {
  return {
    identity:
      CLASSROOM_PIXEL_ART_V8_PROFILE
        .identity,

    render:
      {
        ...CLASSROOM_PIXEL_ART_V8_PROFILE
          .render
      },

    textures:
      {
        ...CLASSROOM_PIXEL_ART_V8_PROFILE
          .textures
      },

    sprites:
      {
        ...CLASSROOM_PIXEL_ART_V8_PROFILE
          .sprites
      },

    palette:
      {
        ...CLASSROOM_PIXEL_ART_V8_PROFILE
          .palette
      },

    filtering:
      {
        ...CLASSROOM_PIXEL_ART_V8_PROFILE
          .filtering
      }
  };
}

export {
  CLASSROOM_PIXEL_ART_V8_PROFILE,
  auditPixelSpriteMaterial,
  auditPixelTexture,
  computePixelPresentation,
  configurePixelTexture,
  createPixelArtContractSnapshot,
  createPixelCanvasTexture,
  createPixelSpriteMaterial,
  quantizeNormalizedChannel,
  quantizeRgb
};