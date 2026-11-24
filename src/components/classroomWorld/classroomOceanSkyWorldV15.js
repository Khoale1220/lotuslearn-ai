import * as THREE from "three";

const CLASSROOM_OCEAN_SKY_WORLD_V15_PROFILE =
  Object.freeze({
    schemaVersion: 1,

    authority:
      "CW06_OCEAN_SKY_WORLD_V15",

    artDirection:
      "HIGH_DETAIL_1990S_VGA_PIXEL_ART",

    oceanTextureWidth: 64,
    oceanTextureHeight: 64,

    skyTextureWidth: 64,
    skyTextureHeight: 32,

    cloudTextureWidth: 16,
    cloudTextureHeight: 8,

    oceanWorldSize: 90,
    oceanElevation: -2.75,

    skyRadius: 44,
    skyHeight: 26,

    cloudCount: 10,
    waveGlintCount: 48,

    oceanTextureRepeat: 18,

    oceanScrollUPerSecond: 0.007,
    oceanScrollVPerSecond: 0.011,

    cloudAngularSpeed:
      0.0035
  });

function writePixel(
  data,
  width,
  x,
  y,
  rgba
) {
  const offset =
    (y * width + x) * 4;

  data[offset] = rgba[0];
  data[offset + 1] = rgba[1];
  data[offset + 2] = rgba[2];
  data[offset + 3] = rgba[3];
}

function createVgaTexture({
  width,
  height,
  sample
}) {
  const data =
    new Uint8Array(
      width *
      height *
      4
    );

  for (
    let y = 0;
    y < height;
    y += 1
  ) {
    for (
      let x = 0;
      x < width;
      x += 1
    ) {
      writePixel(
        data,
        width,
        x,
        y,
        sample(
          x,
          y,
          width,
          height
        )
      );
    }
  }

  const texture =
    new THREE.DataTexture(
      data,
      width,
      height,
      THREE.RGBAFormat
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

function createOceanTexture() {
  const palette =
    Object.freeze([
      [8, 45, 71, 255],
      [11, 66, 94, 255],
      [16, 87, 112, 255],
      [34, 111, 132, 255],
      [92, 165, 171, 255]
    ]);

  const texture =
    createVgaTexture({
      width:
        CLASSROOM_OCEAN_SKY_WORLD_V15_PROFILE
          .oceanTextureWidth,

      height:
        CLASSROOM_OCEAN_SKY_WORLD_V15_PROFILE
          .oceanTextureHeight,

      sample(
        x,
        y
      ) {
        const waveA =
          (x * 3 + y * 5) % 19;

        const waveB =
          (x * 7 + y * 2) % 29;

        const band =
          Math.floor(y / 8);

        let paletteIndex =
          1 +
          ((band + x) % 2);

        if (
          waveA === 0 ||
          waveA === 1
        ) {
          paletteIndex = 4;
        }
        else if (
          waveB <= 2
        ) {
          paletteIndex = 3;
        }
        else if (
          (x + y) % 11 === 0
        ) {
          paletteIndex = 0;
        }

        return palette[
          paletteIndex
        ];
      }
    });

  texture.wrapS =
    THREE.RepeatWrapping;

  texture.wrapT =
    THREE.RepeatWrapping;

  texture.repeat.set(
    CLASSROOM_OCEAN_SKY_WORLD_V15_PROFILE
      .oceanTextureRepeat,

    CLASSROOM_OCEAN_SKY_WORLD_V15_PROFILE
      .oceanTextureRepeat
  );

  return texture;
}

function createSkyTexture() {
  return createVgaTexture({
    width:
      CLASSROOM_OCEAN_SKY_WORLD_V15_PROFILE
        .skyTextureWidth,

    height:
      CLASSROOM_OCEAN_SKY_WORLD_V15_PROFILE
        .skyTextureHeight,

    sample(
      x,
      y,
      width,
      height
    ) {
      const normalized =
        y /
        Math.max(
          1,
          height - 1
        );

      if (
        normalized < 0.2
      ) {
        return [
          37,
          73,
          119,
          255
        ];
      }

      if (
        normalized < 0.45
      ) {
        return [
          54,
          105,
          151,
          255
        ];
      }

      if (
        normalized < 0.7
      ) {
        return [
          91,
          151,
          188,
          255
        ];
      }

      const highlight =
        (
          x * 5 +
          y * 3
        ) % 17 === 0;

      return highlight
        ? [
            192,
            215,
            211,
            255
          ]
        : [
            133,
            180,
            199,
            255
          ];
    }
  });
}

function createCloudTexture() {
  const mask =
    [
      "................",
      ".....####.......",
      "...########.....",
      "..##########....",
      ".############...",
      "..###########...",
      "....######......",
      "................"
    ];

  return createVgaTexture({
    width:
      CLASSROOM_OCEAN_SKY_WORLD_V15_PROFILE
        .cloudTextureWidth,

    height:
      CLASSROOM_OCEAN_SKY_WORLD_V15_PROFILE
        .cloudTextureHeight,

    sample(
      x,
      y
    ) {
      if (
        mask[y]?.[x] === "#"
      ) {
        const shade =
          (
            x +
            y
          ) % 3 === 0
            ? 214
            : 238;

        return [
          shade,
          shade,
          224,
          230
        ];
      }

      return [
        0,
        0,
        0,
        0
      ];
    }
  });
}

function createClassroomOceanSkyWorldV15({
  scene
}) {
  if (
    !scene ||
    typeof scene.add !==
      "function" ||
    typeof scene.remove !==
      "function"
  ) {
    throw new TypeError(
      "scene must provide add/remove"
    );
  }

  const profile =
    CLASSROOM_OCEAN_SKY_WORLD_V15_PROFILE;

  const root =
    new THREE.Group();

  root.name =
    "cw15-ocean-sky-world";

  root.userData.classroomVisualAuthority =
    profile.authority;

  /*
   * SKY
   */
  const skyPivot =
    new THREE.Group();

  skyPivot.name =
    "cw15-sky-pivot";

  const skyTexture =
    createSkyTexture();

  const skyGeometry =
    new THREE.CylinderGeometry(
      profile.skyRadius,
      profile.skyRadius,
      profile.skyHeight,
      64,
      1,
      true
    );

  const skyMaterial =
    new THREE.MeshBasicMaterial({
      map: skyTexture,
      side:
        THREE.BackSide,
      fog: false,
      depthWrite: false,
      toneMapped: false
    });

  const sky =
    new THREE.Mesh(
      skyGeometry,
      skyMaterial
    );

  sky.name =
    "cw15-vga-sky";

  sky.position.y =
    7;

  sky.renderOrder =
    -100;

  skyPivot.add(
    sky
  );


  /*
   * OCEAN
   */
  const oceanTexture =
    createOceanTexture();

  const oceanGeometry =
    new THREE.PlaneGeometry(
      profile.oceanWorldSize,
      profile.oceanWorldSize,
      1,
      1
    );

  const oceanMaterial =
    new THREE.MeshBasicMaterial({
      map:
        oceanTexture,

      side:
        THREE.DoubleSide,

      fog:
        false,

      toneMapped:
        false
    });

  const ocean =
    new THREE.Mesh(
      oceanGeometry,
      oceanMaterial
    );

  ocean.name =
    "cw15-living-ocean";

  ocean.rotation.x =
    -Math.PI / 2;

  ocean.position.y =
    profile.oceanElevation;

  root.add(
    ocean
  );


  /*
   * DISTANT CLOUD SPRITES
   */
  const cloudTexture =
    createCloudTexture();

  const cloudMaterial =
    new THREE.SpriteMaterial({
      map:
        cloudTexture,

      transparent:
        true,

      depthWrite:
        false,

      fog:
        false,

      toneMapped:
        false
    });

  const cloudGroup =
    new THREE.Group();

  cloudGroup.name =
    "cw15-cloud-layer";

  for (
    let index = 0;
    index <
      profile.cloudCount;
    index += 1
  ) {
    const angle =
      (
        index /
        profile.cloudCount
      ) *
      Math.PI *
      2;

    const radius =
      31 +
      (index % 3) *
      3;

    const cloud =
      new THREE.Sprite(
        cloudMaterial
      );

    cloud.name =
      `cw15-cloud-${index}`;

    cloud.position.set(
      Math.cos(angle) *
        radius,

      7.5 +
        (index % 4) *
        1.25,

      Math.sin(angle) *
        radius
    );

    const width =
      5 +
      (index % 4) *
      1.25;

    cloud.scale.set(
      width,
      width * 0.42,
      1
    );

    cloudGroup.add(
      cloud
    );
  }

  skyPivot.add(
    cloudGroup
  );


  /*
   * PIXEL SUN
   */
  const sunTexture =
    createVgaTexture({
      width: 12,
      height: 12,

      sample(
        x,
        y
      ) {
        const dx =
          x - 5.5;

        const dy =
          y - 5.5;

        const radius =
          Math.sqrt(
            dx * dx +
            dy * dy
          );

        if (
          radius <= 4
        ) {
          return [
            255,
            214,
            102,
            255
          ];
        }

        if (
          radius <= 5
        ) {
          return [
            236,
            157,
            64,
            180
          ];
        }

        return [
          0,
          0,
          0,
          0
        ];
      }
    });

  const sunMaterial =
    new THREE.SpriteMaterial({
      map:
        sunTexture,

      transparent:
        true,

      depthWrite:
        false,

      fog:
        false,

      toneMapped:
        false
    });

  const sun =
    new THREE.Sprite(
      sunMaterial
    );

  sun.name =
    "cw15-pixel-sun";

  sun.position.set(
    -24,
    14,
    -32
  );

  sun.scale.set(
    5,
    5,
    1
  );

  skyPivot.add(
    sun
  );

  root.add(
    skyPivot
  );


  /*
   * INSTANCED WAVE GLINTS
   */
  const glintGeometry =
    new THREE.PlaneGeometry(
      0.8,
      0.09
    );

  const glintMaterial =
    new THREE.MeshBasicMaterial({
      color:
        0xa6d9d8,

      side:
        THREE.DoubleSide,

      transparent:
        true,

      opacity:
        0.58,

      depthWrite:
        false,

      fog:
        false,

      toneMapped:
        false
    });

  const waveGlints =
    new THREE.InstancedMesh(
      glintGeometry,
      glintMaterial,
      profile.waveGlintCount
    );

  waveGlints.name =
    "cw15-wave-glints";

  waveGlints.frustumCulled =
    false;

  const glintState =
    [];

  const dummy =
    new THREE.Object3D();

  for (
    let index = 0;
    index <
      profile.waveGlintCount;
    index += 1
  ) {
    const column =
      index % 12;

    const row =
      Math.floor(
        index / 12
      );

    const state =
      Object.freeze({
        x:
          -16.5 +
          column * 3,

        z:
          -10 +
          row * 7 +
          ((column % 3) - 1) *
            0.7,

        phase:
          index *
          0.73
      });

    glintState.push(
      state
    );

    dummy.position.set(
      state.x,
      profile.oceanElevation +
        0.025,
      state.z
    );

    dummy.rotation.set(
      -Math.PI / 2,
      0,
      0
    );

    dummy.updateMatrix();

    waveGlints.setMatrixAt(
      index,
      dummy.matrix
    );
  }

  waveGlints.instanceMatrix.needsUpdate =
    true;

  root.add(
    waveGlints
  );

  scene.add(
    root
  );

  const geometries =
    new Set([
      skyGeometry,
      oceanGeometry,
      glintGeometry
    ]);

  const materials =
    new Set([
      skyMaterial,
      oceanMaterial,
      cloudMaterial,
      sunMaterial,
      glintMaterial
    ]);

  const textures =
    new Set([
      skyTexture,
      oceanTexture,
      cloudTexture,
      sunTexture
    ]);

  let disposed =
    false;

  function tick({
    timestamp,
    camera
  }) {
    if (
      disposed
    ) {
      return;
    }

    const safeTimestamp =
      Number.isFinite(timestamp)
        ? timestamp
        : 0;

    const seconds =
      safeTimestamp *
      0.001;

    /*
     * Sky follows player horizontally.
     * This preserves the distant-world illusion.
     */
    if (
      camera?.position
    ) {
      skyPivot.position.x =
        camera.position.x;

      skyPivot.position.z =
        camera.position.z;
    }

    cloudGroup.rotation.y =
      seconds *
      profile.cloudAngularSpeed;

    oceanTexture.offset.x =
      (
        seconds *
        profile.oceanScrollUPerSecond
      ) % 1;

    oceanTexture.offset.y =
      (
        seconds *
        profile.oceanScrollVPerSecond
      ) % 1;

    ocean.position.y =
      profile.oceanElevation +
      Math.sin(
        seconds *
        0.7
      ) *
      0.015;

    for (
      let index = 0;
      index <
        glintState.length;
      index += 1
    ) {
      const state =
        glintState[index];

      const wave =
        Math.sin(
          seconds *
            1.25 +
          state.phase
        );

      dummy.position.set(
        state.x +
          wave *
          0.08,

        profile.oceanElevation +
          0.035 +
          wave *
          0.018,

        state.z
      );

      dummy.rotation.set(
        -Math.PI / 2,
        0,
        0
      );

      dummy.scale.set(
        0.75 +
          (
            wave + 1
          ) *
          0.2,
        1,
        1
      );

      dummy.updateMatrix();

      waveGlints.setMatrixAt(
        index,
        dummy.matrix
      );
    }

    waveGlints.instanceMatrix.needsUpdate =
      true;
  }

  function getSnapshot() {
    return Object.freeze({
      schemaVersion:
        profile.schemaVersion,

      authority:
        profile.authority,

      artDirection:
        profile.artDirection,

      cloudCount:
        profile.cloudCount,

      waveGlintCount:
        profile.waveGlintCount,

      oceanTexture:
        `${profile.oceanTextureWidth}x${profile.oceanTextureHeight}`,

      skyTexture:
        `${profile.skyTextureWidth}x${profile.skyTextureHeight}`,

      disposed
    });
  }

  function dispose() {
    if (
      disposed
    ) {
      return;
    }

    disposed =
      true;

    scene.remove(
      root
    );

    for (
      const geometry
      of geometries
    ) {
      geometry.dispose();
    }

    for (
      const material
      of materials
    ) {
      material.dispose();
    }

    for (
      const texture
      of textures
    ) {
      texture.dispose();
    }
  }

  return Object.freeze({
    tick,
    dispose,
    getSnapshot
  });
}

export {
  CLASSROOM_OCEAN_SKY_WORLD_V15_PROFILE,
  createClassroomOceanSkyWorldV15
};