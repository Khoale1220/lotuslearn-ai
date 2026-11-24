import * as THREE from "three";

const TAU =
  Math.PI * 2;

const CLASSROOM_VISUAL_FIDELITY_V22_PROFILE =
  Object.freeze({
    id:
      "cw06-visual-fidelity-v22",

    visualOnly:
      true,

    deterministic:
      true,

    shadowMapSize:
      2048,

    contactShadowLimit:
      56,

    dustCount:
      84,

    lightPoolCount:
      3
  });

function deterministicUnitV22(
  index,
  salt
) {
  let value =
    (
      Math.imul(
        index + 1,
        0x45d9f3b
      ) ^
      salt
    ) >>> 0;

  value ^=
    value >>> 16;

  value =
    Math.imul(
      value,
      0x45d9f3b
    ) >>> 0;

  value ^=
    value >>> 16;

  return (
    value /
    4294967295
  );
}

function createDeterministicDustLayoutV22(
  count =
    CLASSROOM_VISUAL_FIDELITY_V22_PROFILE
      .dustCount
) {
  if (
    !Number.isInteger(count) ||
    count < 0 ||
    count > 256
  ) {
    throw new RangeError(
      "V22 dust count must be an integer from 0 to 256"
    );
  }

  const result = [];

  for (
    let index = 0;
    index < count;
    index += 1
  ) {
    result.push(
      Object.freeze({
        x:
          1.2 +
          deterministicUnitV22(
            index,
            0x2241
          ) *
            5.4,

        y:
          0.65 +
          deterministicUnitV22(
            index,
            0x2242
          ) *
            3.0,

        z:
          -6.1 +
          deterministicUnitV22(
            index,
            0x2243
          ) *
            12.2,

        phase:
          deterministicUnitV22(
            index,
            0x2244
          ) *
          TAU,

        speed:
          0.045 +
          deterministicUnitV22(
            index,
            0x2245
          ) *
            0.075
      })
    );
  }

  return Object.freeze(
    result
  );
}

function disableRaycastV22(
  object
) {
  object.raycast =
    function noVisualFidelityRaycastV22() {};
}

function createCanvasTextureV22({
  documentObject,
  type
}) {
  if (
    !documentObject ||
    typeof documentObject.createElement !==
      "function"
  ) {
    return null;
  }

  const canvas =
    documentObject.createElement(
      "canvas"
    );

  canvas.width =
    64;

  canvas.height =
    64;

  const context =
    canvas.getContext(
      "2d"
    );

  if (!context) {
    return null;
  }

  context.clearRect(
    0,
    0,
    64,
    64
  );

  if (
    type ===
    "contact-shadow"
  ) {
    const gradient =
      context.createRadialGradient(
        32,
        32,
        2,
        32,
        32,
        31
      );

    gradient.addColorStop(
      0,
      "rgba(255,255,255,0.92)"
    );

    gradient.addColorStop(
      0.45,
      "rgba(255,255,255,0.50)"
    );

    gradient.addColorStop(
      1,
      "rgba(255,255,255,0)"
    );

    context.fillStyle =
      gradient;

    context.fillRect(
      0,
      0,
      64,
      64
    );
  }
  else {
    const gradient =
      context.createRadialGradient(
        32,
        32,
        3,
        32,
        32,
        31
      );

    gradient.addColorStop(
      0,
      "rgba(255,255,255,0.95)"
    );

    gradient.addColorStop(
      0.50,
      "rgba(255,255,255,0.52)"
    );

    gradient.addColorStop(
      1,
      "rgba(255,255,255,0)"
    );

    context.fillStyle =
      gradient;

    context.fillRect(
      0,
      0,
      64,
      64
    );
  }

  const texture =
    new THREE.CanvasTexture(
      canvas
    );

  texture.colorSpace =
    THREE.SRGBColorSpace;

  texture.magFilter =
    THREE.LinearFilter;

  texture.minFilter =
    THREE.LinearFilter;

  texture.generateMipmaps =
    false;

  texture.needsUpdate =
    true;

  return texture;
}

function collectContactShadowAnchorsV22({
  scene,
  limit
}) {
  scene.updateMatrixWorld(
    true
  );

  const anchors = [];
  const occupied =
    new Set();

  const instanceMatrix =
    new THREE.Matrix4();

  const worldMatrix =
    new THREE.Matrix4();

  const worldPosition =
    new THREE.Vector3();

  function pushAnchor({
    x,
    z,
    width,
    depth
  }) {
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(z)
    ) {
      return;
    }

    if (
      Math.abs(x) > 8.5 ||
      Math.abs(z + 1) > 10
    ) {
      return;
    }

    const key =
      [
        Math.round(
          x * 4
        ),
        Math.round(
          z * 4
        )
      ].join(":");

    if (
      occupied.has(
        key
      )
    ) {
      return;
    }

    occupied.add(
      key
    );

    anchors.push(
      Object.freeze({
        x,
        z,
        width,
        depth
      })
    );
  }

  scene.traverse(
    (object) => {
      if (
        anchors.length >=
        limit
      ) {
        return;
      }

      const name =
        String(
          object.name || ""
        ).toLowerCase();

      const isDesk =
        /desk|table/u.test(
          name
        );

      const isChair =
        /chair/u.test(
          name
        );

      if (
        !isDesk &&
        !isChair
      ) {
        return;
      }

      const width =
        isChair
          ? 0.70
          : 1.35;

      const depth =
        isChair
          ? 0.58
          : 0.78;

      if (
        object.isInstancedMesh
      ) {
        const count =
          Math.min(
            object.count,
            limit -
              anchors.length
          );

        for (
          let index = 0;
          index < count;
          index += 1
        ) {
          object.getMatrixAt(
            index,
            instanceMatrix
          );

          worldMatrix.multiplyMatrices(
            object.matrixWorld,
            instanceMatrix
          );

          worldPosition
            .setFromMatrixPosition(
              worldMatrix
            );

          pushAnchor({
            x:
              worldPosition.x,

            z:
              worldPosition.z,

            width,
            depth
          });
        }

        return;
      }

      if (
        object.isMesh
      ) {
        object.getWorldPosition(
          worldPosition
        );

        pushAnchor({
          x:
            worldPosition.x,

          z:
            worldPosition.z,

          width,
          depth
        });
      }
    }
  );

  return anchors.slice(
    0,
    limit
  );
}

function configureShadowParticipantsV22(
  scene
) {
  const states = [];

  scene.traverse(
    (object) => {
      if (
        !object.isMesh ||
        object.isSprite
      ) {
        return;
      }

      const name =
        String(
          object.name || ""
        ).toLowerCase();

      const relevant =
        /desk|chair|table|wall|floor|ceiling|door|frame|board|cabinet|shelf|headphone/u
          .test(
            name
          );

      if (!relevant) {
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

      const transparent =
        materials.some(
          (material) =>
            Boolean(
              material &&
              (
                material.transparent ||
                (
                  Number.isFinite(
                    material.opacity
                  ) &&
                  material.opacity <
                    0.98
                )
              )
            )
        );

      if (transparent) {
        return;
      }

      const previous =
        Object.freeze({
          object,

          castShadow:
            object.castShadow,

          receiveShadow:
            object.receiveShadow
        });

      states.push(
        previous
      );

      const canCast =
        /desk|chair|table|door|frame|board|cabinet|shelf|headphone/u
          .test(
            name
          );

      const canReceive =
        /desk|chair|table|wall|floor|ceiling|door|frame|board|cabinet|shelf/u
          .test(
            name
          );

      if (canCast) {
        object.castShadow =
          true;
      }

      if (canReceive) {
        object.receiveShadow =
          true;
      }
    }
  );

  return states;
}

function createClassroomVisualFidelityV22({
  renderer,
  scene,
  camera,
  documentObject =
    globalThis.document
}) {
  if (
    !renderer ||
    !renderer.shadowMap
  ) {
    throw new TypeError(
      "V22 renderer with shadowMap is required"
    );
  }

  if (
    !scene ||
    !scene.isScene
  ) {
    throw new TypeError(
      "V22 THREE.Scene is required"
    );
  }

  if (
    !camera ||
    !camera.isCamera
  ) {
    throw new TypeError(
      "V22 THREE.Camera is required"
    );
  }

  let disposed =
    false;

  const profile =
    CLASSROOM_VISUAL_FIDELITY_V22_PROFILE;

  const ownedGeometries =
    new Set();

  const ownedMaterials =
    new Set();

  const ownedTextures =
    new Set();

  const root =
    new THREE.Group();

  root.name =
    "classroom-visual-fidelity-v22";

  root.userData.visualOnly =
    true;

  root.userData.interactive =
    false;

  scene.add(
    root
  );

  const rendererShadowState =
    Object.freeze({
      enabled:
        renderer.shadowMap.enabled,

      type:
        renderer.shadowMap.type
    });

  renderer.shadowMap.enabled =
    true;

  const sunlight =
    scene.getObjectByName(
      "classroom-window-sun"
    );

  let sunlightState =
    null;

  if (
    sunlight &&
    sunlight.shadow
  ) {
    sunlightState =
      Object.freeze({
        castShadow:
          sunlight.castShadow,

        mapWidth:
          sunlight.shadow
            .mapSize.x,

        mapHeight:
          sunlight.shadow
            .mapSize.y,

        bias:
          sunlight.shadow.bias,

        normalBias:
          sunlight.shadow
            .normalBias
      });

    sunlight.castShadow =
      true;

    const currentSize =
      Math.max(
        sunlight.shadow
          .mapSize.x,
        sunlight.shadow
          .mapSize.y
      );

    const nextSize =
      Math.max(
        currentSize,
        profile.shadowMapSize
      );

    sunlight.shadow
      .mapSize
      .set(
        nextSize,
        nextSize
      );

    sunlight.shadow.bias =
      -0.0006;

    sunlight.shadow.normalBias =
      0.025;
  }

  const shadowParticipantStates =
    configureShadowParticipantsV22(
      scene
    );

  const shadowCatcherGeometry =
    new THREE.PlaneGeometry(
      15.6,
      17.6
    );

  ownedGeometries.add(
    shadowCatcherGeometry
  );

  const shadowCatcherMaterial =
    new THREE.ShadowMaterial({
      color:
        0x10141c,

      opacity:
        0.22,

      transparent:
        true,

      depthWrite:
        false
    });

  shadowCatcherMaterial.toneMapped =
    false;

  ownedMaterials.add(
    shadowCatcherMaterial
  );

  const shadowCatcher =
    new THREE.Mesh(
      shadowCatcherGeometry,
      shadowCatcherMaterial
    );

  shadowCatcher.name =
    "cw06-v22-shadow-catcher";

  shadowCatcher.rotation.x =
    -Math.PI / 2;

  shadowCatcher.position.set(
    0,
    0.018,
    -1
  );

  shadowCatcher.receiveShadow =
    true;

  shadowCatcher.castShadow =
    false;

  shadowCatcher.renderOrder =
    1;

  disableRaycastV22(
    shadowCatcher
  );

  root.add(
    shadowCatcher
  );

  const contactTexture =
    createCanvasTextureV22({
      documentObject,
      type:
        "contact-shadow"
    });

  if (contactTexture) {
    ownedTextures.add(
      contactTexture
    );
  }

  const contactShadowAnchors =
    collectContactShadowAnchorsV22({
      scene,
      limit:
        profile
          .contactShadowLimit
    });

  let contactShadows =
    null;

  if (
    contactTexture &&
    contactShadowAnchors.length >
      0
  ) {
    const geometry =
      new THREE.PlaneGeometry(
        1,
        1
      );

    ownedGeometries.add(
      geometry
    );

    const material =
      new THREE.MeshBasicMaterial({
        map:
          contactTexture,

        color:
          0x090c12,

        transparent:
          true,

        opacity:
          0.20,

        depthWrite:
          false,

        depthTest:
          true,

        toneMapped:
          false,

        side:
          THREE.DoubleSide
      });

    ownedMaterials.add(
      material
    );

    contactShadows =
      new THREE.InstancedMesh(
        geometry,
        material,
        contactShadowAnchors.length
      );

    contactShadows.name =
      "cw06-v22-contact-shadows";

    contactShadows.renderOrder =
      2;

    contactShadows.castShadow =
      false;

    contactShadows.receiveShadow =
      false;

    disableRaycastV22(
      contactShadows
    );

    const matrix =
      new THREE.Matrix4();

    const position =
      new THREE.Vector3();

    const quaternion =
      new THREE.Quaternion();

    const scale =
      new THREE.Vector3();

    quaternion.setFromAxisAngle(
      new THREE.Vector3(
        1,
        0,
        0
      ),
      -Math.PI / 2
    );

    contactShadowAnchors.forEach(
      (
        anchor,
        index
      ) => {
        position.set(
          anchor.x,
          0.024,
          anchor.z
        );

        scale.set(
          anchor.width,
          anchor.depth,
          1
        );

        matrix.compose(
          position,
          quaternion,
          scale
        );

        contactShadows.setMatrixAt(
          index,
          matrix
        );
      }
    );

    contactShadows
      .instanceMatrix
      .needsUpdate =
        true;

    contactShadows
      .computeBoundingSphere();

    root.add(
      contactShadows
    );
  }

  const lightPoolTexture =
    createCanvasTextureV22({
      documentObject,
      type:
        "light-pool"
    });

  if (lightPoolTexture) {
    ownedTextures.add(
      lightPoolTexture
    );
  }

  const lightPoolGeometry =
    new THREE.PlaneGeometry(
      5.1,
      2.05
    );

  ownedGeometries.add(
    lightPoolGeometry
  );

  const lightPoolMaterial =
    new THREE.MeshBasicMaterial({
      map:
        lightPoolTexture,

      color:
        0xffd7a6,

      transparent:
        true,

      opacity:
        0.11,

      blending:
        THREE.AdditiveBlending,

      depthWrite:
        false,

      depthTest:
        true,

      side:
        THREE.DoubleSide,

      toneMapped:
        false
    });

  ownedMaterials.add(
    lightPoolMaterial
  );

  const windowZ =
    [
      -3.7,
      0,
      3.7
    ];

  const lightPools = [];

  for (
    let index = 0;
    index <
      profile.lightPoolCount;
    index += 1
  ) {
    const pool =
      new THREE.Mesh(
        lightPoolGeometry,
        lightPoolMaterial
      );

    pool.name =
      `cw06-v22-window-light-pool-${index + 1}`;

    pool.rotation.set(
      -Math.PI / 2,
      0,
      -0.10
    );

    pool.position.set(
      3.85,
      0.030,
      windowZ[index]
    );

    pool.castShadow =
      false;

    pool.receiveShadow =
      false;

    pool.renderOrder =
      3;

    disableRaycastV22(
      pool
    );

    root.add(
      pool
    );

    lightPools.push(
      pool
    );
  }

  const dustLayout =
    createDeterministicDustLayoutV22();

  const dustPositions =
    new Float32Array(
      dustLayout.length * 3
    );

  dustLayout.forEach(
    (
      particle,
      index
    ) => {
      const offset =
        index * 3;

      dustPositions[
        offset
      ] =
        particle.x;

      dustPositions[
        offset + 1
      ] =
        particle.y;

      dustPositions[
        offset + 2
      ] =
        particle.z;
    }
  );

  const dustGeometry =
    new THREE.BufferGeometry();

  dustGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(
      dustPositions,
      3
    )
  );

  ownedGeometries.add(
    dustGeometry
  );

  const dustMaterial =
    new THREE.PointsMaterial({
      color:
        0xffe9c8,

      size:
        0.035,

      sizeAttenuation:
        true,

      transparent:
        true,

      opacity:
        0.34,

      depthWrite:
        false,

      blending:
        THREE.AdditiveBlending,

      fog:
        true,

      toneMapped:
        false
    });

  ownedMaterials.add(
    dustMaterial
  );

  const dust =
    new THREE.Points(
      dustGeometry,
      dustMaterial
    );

  dust.name =
    "cw06-v22-window-dust";

  dust.frustumCulled =
    false;

  dust.renderOrder =
    4;

  disableRaycastV22(
    dust
  );

  root.add(
    dust
  );

  function tick({
    timestamp = 0,
    deltaSeconds = 0
  } = {}) {
    if (disposed) {
      return;
    }

    const time =
      Number.isFinite(
        timestamp
      )
        ? timestamp * 0.001
        : 0;

    const delta =
      Number.isFinite(
        deltaSeconds
      )
        ? Math.max(
            0,
            deltaSeconds
          )
        : 0;

    void delta;

    const positions =
      dustGeometry
        .getAttribute(
          "position"
        );

    for (
      let index = 0;
      index <
        dustLayout.length;
      index += 1
    ) {
      const particle =
        dustLayout[
          index
        ];

      const verticalRange =
        3.0;

      const vertical =
        (
          particle.y -
            0.65 +
          time *
            particle.speed
        ) %
        verticalRange;

      positions.setXYZ(
        index,

        particle.x +
          Math.sin(
            time *
              0.31 +
            particle.phase
          ) *
            0.055,

        0.65 +
          vertical,

        particle.z +
          Math.cos(
            time *
              0.23 +
            particle.phase
          ) *
            0.050
      );
    }

    positions.needsUpdate =
      true;

    lightPoolMaterial.opacity =
      0.105 +
      Math.sin(
        time * 0.34
      ) *
        0.008;
  }

  function getSnapshot() {
    return Object.freeze({
      id:
        profile.id,

      visualOnly:
        profile.visualOnly,

      deterministic:
        profile.deterministic,

      sunlightFound:
        Boolean(
          sunlight
        ),

      sunlightShadowMap:
        sunlight?.shadow
          ? `${sunlight.shadow.mapSize.x}x${sunlight.shadow.mapSize.y}`
          : null,

      shadowParticipantCount:
        shadowParticipantStates.length,

      contactShadowCount:
        contactShadowAnchors.length,

      lightPoolCount:
        lightPools.length,

      dustCount:
        dustLayout.length,

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
      of shadowParticipantStates
    ) {
      state.object.castShadow =
        state.castShadow;

      state.object.receiveShadow =
        state.receiveShadow;
    }

    if (
      sunlight &&
      sunlight.shadow &&
      sunlightState
    ) {
      sunlight.castShadow =
        sunlightState.castShadow;

      sunlight.shadow
        .mapSize
        .set(
          sunlightState
            .mapWidth,

          sunlightState
            .mapHeight
        );

      sunlight.shadow.bias =
        sunlightState.bias;

      sunlight.shadow.normalBias =
        sunlightState.normalBias;
    }

    renderer.shadowMap.enabled =
      rendererShadowState.enabled;

    renderer.shadowMap.type =
      rendererShadowState.type;

    for (
      const geometry
      of ownedGeometries
    ) {
      geometry.dispose();
    }

    for (
      const material
      of ownedMaterials
    ) {
      material.dispose();
    }

    for (
      const texture
      of ownedTextures
    ) {
      texture.dispose();
    }
  }

  return Object.freeze({
    tick,
    getSnapshot,
    dispose
  });
}

export {
  CLASSROOM_VISUAL_FIDELITY_V22_PROFILE,
  collectContactShadowAnchorsV22,
  createClassroomVisualFidelityV22,
  createDeterministicDustLayoutV22,
  deterministicUnitV22
};
