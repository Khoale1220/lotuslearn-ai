import * as THREE from "three";

const CLASSROOM_PIXEL_ART_GRADE_V23_PROFILE =
  Object.freeze({
    id:
      "cw06-cinematic-pixel-grade-v23",

    artDirection:
      "high-detail-1990s-vga-cinematic-pixel-art",

    referenceIntent:
      "friendly-warm-readable-64-bit-classroom",

    visualOnly:
      true,

    deterministic:
      true,

    // CW08_CLEAN_BASELINE_GRADE:
    // Preserve crisp pixel presentation without coarse
    // posterization, screen-space edge amplification,
    // or full-frame dithering noise.
    posterizeLevels:
      Object.freeze({
        red:
          64,

        green:
          64,

        blue:
          64
      }),

    saturation:
      1.00,

    contrast:
      1.00,

    edgeStrength:
      0,

    ditherStrength:
      0
  });

const CLASSROOM_PIXEL_ART_GRADE_V23_PALETTE =
  Object.freeze({
    ink:
      0x070414,

    deepPlum:
      0x25132b,

    plum:
      0x533751,

    coolBlue:
      0x5180a0,

    cyan:
      0x3fa0c7,

    sky:
      0x66b9d5,

    rust:
      0xb04d4d,

    warmClay:
      0xcf8a6b,

    sand:
      0xdeb38c,

    cream:
      0xf9efcb
  });

function getPixelArtGradeV23Profile() {
  return {
    ...CLASSROOM_PIXEL_ART_GRADE_V23_PROFILE,

    posterizeLevels:
      {
        ...CLASSROOM_PIXEL_ART_GRADE_V23_PROFILE
          .posterizeLevels
      },

    palette:
      {
        ...CLASSROOM_PIXEL_ART_GRADE_V23_PALETTE
      }
  };
}

function createPixelArtGradeShaderV23() {
  return {
    uniforms:
      {
        tDiffuse:
          {
            value:
              null
          },

        uTexelSize:
          {
            value:
              new THREE.Vector2(
                1 / 426,
                1 / 240
              )
          },

        uResolution:
          {
            value:
              new THREE.Vector2(
                426,
                240
              )
          },

        uSaturation:
          {
            value:
              CLASSROOM_PIXEL_ART_GRADE_V23_PROFILE
                .saturation
          },

        uContrast:
          {
            value:
              CLASSROOM_PIXEL_ART_GRADE_V23_PROFILE
                .contrast
          },

        uEdgeStrength:
          {
            value:
              CLASSROOM_PIXEL_ART_GRADE_V23_PROFILE
                .edgeStrength
          },

        uDitherStrength:
          {
            value:
              CLASSROOM_PIXEL_ART_GRADE_V23_PROFILE
                .ditherStrength
          }
      },

    vertexShader:
      /* glsl */ `
        varying vec2 vUv;

        void main() {
          vUv = uv;

          gl_Position =
            vec4(
              position.xy,
              0.0,
              1.0
            );
        }
      `,

    fragmentShader:
      /* glsl */ `
        uniform sampler2D tDiffuse;

        uniform vec2 uTexelSize;
        uniform vec2 uResolution;

        uniform float uSaturation;
        uniform float uContrast;
        uniform float uEdgeStrength;
        uniform float uDitherStrength;

        varying vec2 vUv;

        float cw06LuminanceV23(
          vec3 color
        ) {
          return dot(
            color,
            vec3(
              0.2126,
              0.7152,
              0.0722
            )
          );
        }

        float bayer4(
          vec2 coordinate
        ) {
          vec2 pixel =
            mod(
              floor(
                coordinate
              ),
              4.0
            );

          float x =
            pixel.x;

          float y =
            pixel.y;

          if (
            y < 0.5
          ) {
            if (
              x < 0.5
            ) {
              return 0.0;
            }

            if (
              x < 1.5
            ) {
              return 8.0;
            }

            if (
              x < 2.5
            ) {
              return 2.0;
            }

            return 10.0;
          }

          if (
            y < 1.5
          ) {
            if (
              x < 0.5
            ) {
              return 12.0;
            }

            if (
              x < 1.5
            ) {
              return 4.0;
            }

            if (
              x < 2.5
            ) {
              return 14.0;
            }

            return 6.0;
          }

          if (
            y < 2.5
          ) {
            if (
              x < 0.5
            ) {
              return 3.0;
            }

            if (
              x < 1.5
            ) {
              return 11.0;
            }

            if (
              x < 2.5
            ) {
              return 1.0;
            }

            return 9.0;
          }

          if (
            x < 0.5
          ) {
            return 15.0;
          }

          if (
            x < 1.5
          ) {
            return 7.0;
          }

          if (
            x < 2.5
          ) {
            return 13.0;
          }

          return 5.0;
        }

        vec3 sampleScene(
          vec2 uv
        ) {
          return texture2D(
            tDiffuse,
            clamp(
              uv,
              vec2(
                0.0
              ),
              vec2(
                1.0
              )
            )
          ).rgb;
        }

        vec3 applyContrast(
          vec3 color,
          float contrastValue
        ) {
          return clamp(
            (
              color -
              0.5
            ) *
              contrastValue +
              0.5,
            0.0,
            1.0
          );
        }

        vec3 applySaturation(
          vec3 color,
          float saturationValue
        ) {
          float luma =
            cw06LuminanceV23(
              color
            );

          return clamp(
            mix(
              vec3(
                luma
              ),
              color,
              saturationValue
            ),
            0.0,
            1.0
          );
        }

        vec3 applyReferenceSplitTone(
          vec3 color
        ) {
          float luma =
            cw06LuminanceV23(
              color
            );

          vec3 deepPlum =
            vec3(
              0.145,
              0.075,
              0.170
            );

          vec3 cyan =
            vec3(
              0.247,
              0.627,
              0.780
            );

          vec3 warmClay =
            vec3(
              0.812,
              0.541,
              0.420
            );

          vec3 cream =
            vec3(
              0.976,
              0.937,
              0.796
            );

          float shadowMask =
            1.0 -
            smoothstep(
              0.20,
              0.47,
              luma
            );

          float coolMask =
            smoothstep(
              0.24,
              0.48,
              luma
            ) *
            (
              1.0 -
              smoothstep(
                0.60,
                0.78,
                luma
              )
            );

          float warmMask =
            smoothstep(
              0.50,
              0.78,
              luma
            );

          float highlightMask =
            smoothstep(
              0.76,
              0.96,
              luma
            );

          color =
            mix(
              color,
              color *
                0.96 +
                deepPlum *
                0.04,
              shadowMask *
                0.14
            );

          color =
            mix(
              color,
              color *
                0.98 +
                cyan *
                0.02,
              coolMask *
                0.10
            );

          color =
            mix(
              color,
              color *
                0.96 +
                warmClay *
                0.04,
              warmMask *
                0.18
            );

          color =
            mix(
              color,
              color *
                0.96 +
                cream *
                0.04,
              highlightMask *
                0.20
            );

          return clamp(
            color,
            0.0,
            1.0
          );
        }

        vec3 posterize(
          vec3 color,
          float dither
        ) {
          vec3 levels =
            vec3(
              18.0,
              18.0,
              16.0
            );

          vec3 adjusted =
            clamp(
              color +
                dither,
              0.0,
              1.0
            );

          return floor(
            adjusted *
              levels +
              0.5
          ) /
            levels;
        }

        float detectInkEdge() {
          vec3 center =
            sampleScene(
              vUv
            );

          vec3 left =
            sampleScene(
              vUv -
                vec2(
                  uTexelSize.x,
                  0.0
                )
            );

          vec3 right =
            sampleScene(
              vUv +
                vec2(
                  uTexelSize.x,
                  0.0
                )
            );

          vec3 up =
            sampleScene(
              vUv +
                vec2(
                  0.0,
                  uTexelSize.y
                )
            );

          vec3 down =
            sampleScene(
              vUv -
                vec2(
                  0.0,
                  uTexelSize.y
                )
            );

          float edge =
            max(
              max(
                length(
                  center -
                  left
                ),
                length(
                  center -
                  right
                )
              ),
              max(
                length(
                  center -
                  up
                ),
                length(
                  center -
                  down
                )
              )
            );

          float lumaEdge =
            max(
              max(
                abs(
                  cw06LuminanceV23(
                    center
                  ) -
                  cw06LuminanceV23(
                    left
                  )
                ),
                abs(
                  cw06LuminanceV23(
                    center
                  ) -
                  cw06LuminanceV23(
                    right
                  )
                )
              ),
              max(
                abs(
                  cw06LuminanceV23(
                    center
                  ) -
                  cw06LuminanceV23(
                    up
                  )
                ),
                abs(
                  cw06LuminanceV23(
                    center
                  ) -
                  cw06LuminanceV23(
                    down
                  )
                )
              )
            );

          edge =
            max(
              edge *
                0.55,
              lumaEdge *
                0.95
            );

          return smoothstep(
            0.18,
            0.50,
            edge
          );
        }

        void main() {
          vec4 source =
            texture2D(
              tDiffuse,
              vUv
            );

          vec3 color =
            source.rgb;

          color =
            applyContrast(
              color,
              uContrast
            );

          color =
            applySaturation(
              color,
              uSaturation
            );

          color =
            applyReferenceSplitTone(
              color
            );

          float matrixValue =
            bayer4(
              gl_FragCoord.xy
            );

          float dither =
            (
              (
                matrixValue +
                0.5
              ) /
                16.0 -
                0.5
            ) *
            uDitherStrength;

          color =
            posterize(
              color,
              dither
            );

          float edge =
            detectInkEdge();

          vec3 ink =
            vec3(
              0.11,
              0.12,
              0.13
            );

          color =
            mix(
              color,
              ink,
              edge *
                uEdgeStrength
            );

          vec2 centered =
            vUv *
              2.0 -
              1.0;

          float vignette =
            dot(
              centered,
              centered
            );

          color *=
            1.0 -
            clamp(
              vignette *
                0.015,
              0.0,
              0.03
            );

          gl_FragColor =
            vec4(
              clamp(
                color,
                0.0,
                1.0
              ),
              source.a
            );

          #include <colorspace_fragment>
        }
      `
  };
}

function createClassroomPixelArtGradeV23({
  renderer
}) {
  if (
    !renderer ||
    typeof renderer.render !==
      "function" ||
    typeof renderer.setRenderTarget !==
      "function" ||
    typeof renderer.getDrawingBufferSize !==
      "function"
  ) {
    throw new TypeError(
      "V23 requires THREE.WebGLRenderer"
    );
  }

  let disposed =
    false;

  const size =
    new THREE.Vector2();

  renderer.getDrawingBufferSize(
    size
  );

  const initialWidth =
    Math.max(
      1,
      Math.floor(
        size.x
      )
    );

  const initialHeight =
    Math.max(
      1,
      Math.floor(
        size.y
      )
    );

  const renderTarget =
    new THREE.WebGLRenderTarget(
      initialWidth,
      initialHeight,
      {
        depthBuffer:
          true,

        stencilBuffer:
          false,

        magFilter:
          THREE.NearestFilter,

        minFilter:
          THREE.NearestFilter,

        generateMipmaps:
          false
      }
    );

  renderTarget.texture.name =
    "cw06-v23-scene-color";

  renderTarget.texture.colorSpace =
    THREE.LinearSRGBColorSpace;

  renderTarget.texture.generateMipmaps =
    false;

  renderTarget.texture.magFilter =
    THREE.NearestFilter;

  renderTarget.texture.minFilter =
    THREE.NearestFilter;

  const shaderDefinition =
    createPixelArtGradeShaderV23();

  const material =
    new THREE.ShaderMaterial({
      name:
        "cw06-v23-pixel-grade-material",

      uniforms:
        shaderDefinition.uniforms,

      vertexShader:
        shaderDefinition.vertexShader,

      fragmentShader:
        shaderDefinition.fragmentShader,

      depthTest:
        false,

      depthWrite:
        false,

      transparent:
        false
    });

  material.toneMapped =
    false;

  material.uniforms
    .tDiffuse
    .value =
      renderTarget.texture;

  const geometry =
    new THREE.PlaneGeometry(
      2,
      2
    );

  const quad =
    new THREE.Mesh(
      geometry,
      material
    );

  quad.name =
    "cw06-v23-fullscreen-pixel-grade";

  quad.frustumCulled =
    false;

  quad.raycast =
    function noPixelGradeRaycastV23() {};

  const postScene =
    new THREE.Scene();

  postScene.add(
    quad
  );

  const postCamera =
    new THREE.OrthographicCamera(
      -1,
      1,
      1,
      -1,
      0,
      1
    );

  function syncSize() {
    renderer.getDrawingBufferSize(
      size
    );

    const width =
      Math.max(
        1,
        Math.floor(
          size.x
        )
      );

    const height =
      Math.max(
        1,
        Math.floor(
          size.y
        )
      );

    if (
      renderTarget.width !==
        width ||
      renderTarget.height !==
        height
    ) {
      renderTarget.setSize(
        width,
        height
      );
    }

    material.uniforms
      .uResolution
      .value
      .set(
        width,
        height
      );

    material.uniforms
      .uTexelSize
      .value
      .set(
        1 / width,
        1 / height
      );
  }

  let activeFrameState =
    null;

  function restoreFrameState(
    frameState
  ) {
    renderer.setRenderTarget(
      frameState.previousTarget
    );

    renderer.autoClear =
      frameState.previousAutoClear;

    if (
      renderer.info &&
      typeof frameState.previousInfoAutoReset ===
        "boolean"
    ) {
      renderer.info.autoReset =
        frameState.previousInfoAutoReset;
    }
  }

  function beginFrame() {
    if (disposed) {
      return false;
    }

    if (activeFrameState) {
      throw new Error(
        "V23 frame already active"
      );
    }

    syncSize();

    const previousTarget =
      renderer.getRenderTarget();

    const previousAutoClear =
      renderer.autoClear;

    const previousInfoAutoReset =
      renderer.info
        ? renderer.info.autoReset
        : true;

    activeFrameState = {
      previousTarget,
      previousAutoClear,
      previousInfoAutoReset
    };

    /*
     * Multi-pass observability contract:
     *
     * Accumulate renderer.info across:
     *
     *   scene pass
     *   +
     *   V23 presentation pass
     *
     * so V7 sees the whole rendered frame instead of
     * only the final fullscreen quad.
     */

    if (
      renderer.info
    ) {
      renderer.info.autoReset =
        false;

      if (
        typeof renderer.info.reset ===
          "function"
      ) {
        renderer.info.reset();
      }
    }

    renderer.autoClear =
      true;

    renderer.setRenderTarget(
      renderTarget
    );

    renderer.clear();

    return true;
  }

  function presentFrame() {
    if (disposed) {
      return;
    }

    if (!activeFrameState) {
      throw new Error(
        "V23 presentFrame called without beginFrame"
      );
    }

    const frameState =
      activeFrameState;

    activeFrameState =
      null;

    try {
      renderer.setRenderTarget(
        frameState.previousTarget
      );

      renderer.render(
        postScene,
        postCamera
      );
    }
    finally {
      restoreFrameState(
        frameState
      );
    }
  }

  function cancelFrame() {
    if (!activeFrameState) {
      return;
    }

    const frameState =
      activeFrameState;

    activeFrameState =
      null;

    restoreFrameState(
      frameState
    );
  }

  function getSnapshot() {
    return Object.freeze({
      id:
        CLASSROOM_PIXEL_ART_GRADE_V23_PROFILE
          .id,

      artDirection:
        CLASSROOM_PIXEL_ART_GRADE_V23_PROFILE
          .artDirection,

      visualOnly:
        true,

      deterministic:
        true,

      width:
        renderTarget.width,

      height:
        renderTarget.height,

      nearestSceneSampling:
        renderTarget.texture
          .magFilter ===
          THREE.NearestFilter &&
        renderTarget.texture
          .minFilter ===
          THREE.NearestFilter,

      mipmaps:
        renderTarget.texture
          .generateMipmaps,

      outputColorConversion:
        "colorspace_fragment",

      disposed
    });
  }

  function dispose() {
    if (disposed) {
      return;
    }

    cancelFrame();

    disposed =
      true;

    postScene.remove(
      quad
    );

    geometry.dispose();
    material.dispose();
    renderTarget.dispose();
  }

  return Object.freeze({
    beginFrame,
    presentFrame,
    cancelFrame,
    getSnapshot,
    dispose
  });
}

export {
  CLASSROOM_PIXEL_ART_GRADE_V23_PALETTE,
  CLASSROOM_PIXEL_ART_GRADE_V23_PROFILE,
  createClassroomPixelArtGradeV23,
  createPixelArtGradeShaderV23,
  getPixelArtGradeV23Profile
};
