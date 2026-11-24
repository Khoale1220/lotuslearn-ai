import { createClassroomEnvironmentalAudioV20 } from "./classroomEnvironmentalAudioV20.js";
import { createClassroomTeacherDeskHeadphonesV19A } from "./classroomTeacherDeskHeadphonesV19A.js";
import { createClassroomOceanAtmosphereDepthV19 } from "./classroomOceanAtmosphereDepthV19.js";
import { createClassroomSeagullFlocksV18 } from "./classroomSeagullFlocksV18.js";
import { createClassroomCargoShipLanesV17 } from "./classroomCargoShipLanesV17.js";
import { createClassroomOceanVistaV16 } from "./classroomOceanVistaV16.js";
import {
  createClassroomOceanSkyWorldV15
} from "./classroomOceanSkyWorldV15.js";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import {
  resolveVelocityAfterCollision,
  stepPlayerLocomotion
} from "./playerLocomotion.js";
import { createClassroomVisualSystem } from "./classroomVisualSystem.js";
import { createClassroomArchitectureV2 } from "./classroomArchitectureV2.js";
import { createClassroomFurnitureV2 } from "./classroomFurnitureV2.js";
import { createClassroomLightingV2 } from "./classroomLightingV2.js";
import { createEnvironmentDetailV2 } from "./classroomEnvironmentDetailV2.js";
import { createStudentVisualV2 } from "./classroomStudentVisualV2.js";
import { createClassroomExteriorDepthV2 } from "./classroomExteriorDepthV2.js";
import { createClassroomInteractionFeedbackV2 } from "./classroomInteractionFeedbackV2.js";
import { createClassroomPerformanceBudget } from "./classroomPerformanceBudget.js";
import { createClassroom64BitVisualUpgrade } from "./classroom64BitVisualUpgrade.js";
import { createClassroomRoomGeometryV3 } from "./classroomRoomGeometryV3.js";
import { createClassroomCharacterV3 } from "./classroomCharacterV3.js";
import {
  RETRO_TEACHER_INTERVENTION_UI_EVENT,
  createClassroomRetroFpsPipeline
} from "./classroomRetroFpsPipeline.js";
import { createClassroomRetroCompositionV4 } from "./classroomRetroCompositionV4.js";

import {
  createClassroomFinalContentV6
} from "./classroomFinalContentV6.js";

import {
  createClassroomRuntimeObservabilityV7
} from "./classroomRuntimeObservabilityV7.js";

import {
  createClassroomCharacterVisualIntegrationV10
} from "./classroomCharacterVisualIntegrationV10.js";

import {
  createClassroomInteractionAuthorityV11
} from "./classroomInteractionAuthorityV11.js";

import {
  createClassroomInteractionReplayAuditV12
} from "./classroomInteractionReplayAuditV12.js";

import {
  createClassroomInputStateTimelineV13
} from "./classroomInputStateTimelineV13.js";
import { createThreeCameraMovementInput } from "./threeCameraInputBridge.js";
import { resolvePlayerCollision } from "./playerCollision.js";
import { createClassroomObstacles } from "./classroomObstacles.js";
import { createDynamicStudentRoster } from "./studentRoster.js";
import { createStudentSceneRoster } from "./studentSceneRoster.js";

import {
  CLASSROOM_WORLD_FIXTURE,
  INTERACTION_DISTANCE,
  PIXEL_RENDER_CONFIG,
} from "./classroomWorldContract.js";

import { ALLOWED_FIELDS } from "./studentIntelligenceContract.js";
import "./classroomWorld.css";

const POINTER_SPEED = 0.7;
const PLAYER_HEIGHT = 1.65;
const ROOM_LIMIT = 7.2;

function addBox(scene, size, position, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size.x, size.y, size.z),
    new THREE.MeshLambertMaterial({ color })
  );

  mesh.position.set(position.x, position.y, position.z);
  scene.add(mesh);

  return mesh;
}
function createCollisionObstaclesFromRoster(roster) {
  if (!Array.isArray(roster)) {
    throw new TypeError("roster must be an array");
  }

  return createClassroomObstacles({
    fixture: {
      ...CLASSROOM_WORLD_FIXTURE,
      students: roster.map((student) => ({
        studentKey: student.studentKey,
        displayLabel: student.displayLabel,
        seatIndex: student.seatIndex
      }))
    }
  });
}

function formatStudentHudLabel(field) {
  return field
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toUpperCase();
}

function formatStudentHudValue(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (Array.isArray(value)) {
    return value.length > 0
      ? value.map((item) => String(item)).join(" • ")
      : "—";
  }

  if (typeof value === "boolean") {
    return value ? "YES" : "NO";
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    if (value >= 0 && value <= 1) {
      return `${Math.round(value * 100)}%`;
    }

    return String(value);
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function createStudentHudRows(student) {
  if (!student) {
    return [];
  }

  return ALLOWED_FIELDS
    .filter(
      (field) =>
        field !== "studentKey" &&
        field !== "displayLabel"
    )
    .map((field) => ({
      field,
      label: formatStudentHudLabel(field),
      value: formatStudentHudValue(student[field])
    }));
}
function ClassroomWorld({
  teacherInterventionStatus = null,
  intelligenceStore = null,
  onTeacherIntervention = null
}) {
  const hostRef = useRef(null);
  const controlsRef = useRef(null);
  const intelligenceStoreRef = useRef(intelligenceStore);
  const sceneRosterRef = useRef(null);
  const collisionObstaclesRef = useRef([]);

  useEffect(() => {
    intelligenceStoreRef.current = intelligenceStore;

    const sceneRoster = sceneRosterRef.current;

    if (!sceneRoster) {
      return;
    }

    const roster = intelligenceStore
      ? createDynamicStudentRoster(intelligenceStore)
      : [];

    const nextCollisionObstacles =
      createCollisionObstaclesFromRoster(roster);

    sceneRoster.sync(roster);

    collisionObstaclesRef.current =
      nextCollisionObstacles;

    setSelectedStudent((currentStudent) => {
      if (!currentStudent) {
        return currentStudent;
      }

      if (
        !intelligenceStore ||
        typeof intelligenceStore.has !== "function" ||
        typeof intelligenceStore.requireStudent !== "function"
      ) {
        return null;
      }

      if (
        !intelligenceStore.has(
          currentStudent.studentKey
        )
      ) {
        return null;
      }

      return intelligenceStore.requireStudent(
        currentStudent.studentKey
      );
    });
  }, [intelligenceStore]);

  const [isLocked, setIsLocked] = useState(false);

  const [hasEntered, setHasEntered] = useState(false);
  const [targetLabel, setTargetLabel] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);

  const emitTeacherInterventionCommand = (input) => {
    if (
      typeof onTeacherIntervention !==
      "function"
    ) {
      return null;
    }

    if (
      !input ||
      typeof input !== "object" ||
      Array.isArray(input)
    ) {
      throw new TypeError(
        "teacher intervention intent must be a plain object"
      );
    }

    const allowedFields = [
      "studentKey",
      "actionType",
      "analysisKey"
    ];

    for (const field of Object.keys(input)) {
      if (!allowedFields.includes(field)) {
        throw new TypeError(
          `Unsupported world intervention intent field: ${field}`
        );
      }
    }

    if (
      typeof input.studentKey !== "string" ||
      !input.studentKey.trim()
    ) {
      throw new TypeError(
        "studentKey must be a non-empty string"
      );
    }

    if (
      typeof input.actionType !== "string" ||
      !input.actionType.trim()
    ) {
      throw new TypeError(
        "actionType must be a non-empty string"
      );
    }

    let analysisKey;

    if (
      input.analysisKey !== undefined &&
      input.analysisKey !== null
    ) {
      if (
        typeof input.analysisKey !== "string" ||
        !input.analysisKey.trim()
      ) {
        throw new TypeError(
          "analysisKey must be a non-empty string when provided"
        );
      }

      analysisKey =
        input.analysisKey.trim();
    }

    const command =
      Object.freeze({
        studentKey:
          input.studentKey.trim(),

        actionType:
          input.actionType.trim(),

        ...(analysisKey
          ? { analysisKey }
          : {})
      });

    return onTeacherIntervention(
      command
    );
  };
  const selectedStudentHudRows =
    createStudentHudRows(selectedStudent);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;



    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x17151f);
    scene.fog = new THREE.Fog(0x17151f, 12, 24);

    const teacherAnchor = Object.freeze({
      x: 0,
      z: 0,
    });

    const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 50);
    camera.position.set(teacherAnchor.x + 2.5, PLAYER_HEIGHT, 5.5);
    camera.lookAt(teacherAnchor.x, 1.4, teacherAnchor.z);
    scene.add(camera);

    const classroomOceanSkyWorldV15 =
      createClassroomOceanSkyWorldV15({
        scene
      });

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: "high-performance"
    });

    renderer.setPixelRatio(1);
    renderer.setSize(
      PIXEL_RENDER_CONFIG.internalWidth,
      PIXEL_RENDER_CONFIG.internalHeight,
      false
    );

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = "cw-world__canvas";
    host.appendChild(renderer.domElement);

    const classroomVisualSystem =
      createClassroomVisualSystem({
        renderer,
        scene
      });

    const classroomArchitectureV2 =
      createClassroomArchitectureV2({
        scene,
        materials:
          classroomVisualSystem.materials,
        documentObject: document
      });

    const classroomFurnitureV2 =
      createClassroomFurnitureV2({
        scene,
        materials:
          classroomVisualSystem.materials
      });

    const classroomLightingV2 =
      createClassroomLightingV2({
        renderer,
        scene
      });

    const classroomEnvironmentDetailV2 =
      createEnvironmentDetailV2({
        scene,
        materials:
          classroomVisualSystem.materials
      });

    const classroomStudentVisualV2 =
      createStudentVisualV2({
        scene
      });

    const classroomExteriorDepthV2 =
      createClassroomExteriorDepthV2({
        scene,
        documentObject: document
      });

    const classroomInteractionFeedbackV2 =
      createClassroomInteractionFeedbackV2({
        renderer,
        scene,
        documentObject: document
      });

    const classroomPerformanceBudget =
      createClassroomPerformanceBudget({
        renderer
      });

    const classroom64BitVisualUpgrade =
      createClassroom64BitVisualUpgrade({
        renderer,
        scene,
        materials:
          classroomVisualSystem.materials,
        documentObject: document
      });

    const classroomRoomGeometryV3 =
      createClassroomRoomGeometryV3({
        scene,
        materials:
          classroomVisualSystem.materials
      });

    const classroomCharacterV3 =
      createClassroomCharacterV3({
        scene
      });

    const classroomCharacterVisualIntegrationV10 =
      createClassroomCharacterVisualIntegrationV10({
        scene,
        camera,
        legacyCharacterSystem:
          classroomCharacterV3,
        documentObject:
          document
      });


    const classroomRetroFpsPipeline =
      createClassroomRetroFpsPipeline({
        renderer,
        scene,
        documentObject: document
      });

    const classroomRetroCompositionV4 =
      createClassroomRetroCompositionV4({
        scene,
        materials:
          classroomVisualSystem.materials
      });

    const classroomFinalContentV6 =
      createClassroomFinalContentV6({
        scene,
        camera,
        host,
        documentObject:
          document
      });

    const classroomInteractionReplayAuditV12 =
      createClassroomInteractionReplayAuditV12();

    const controls = new PointerLockControls(camera, renderer.domElement);
    controls.pointerSpeed = POINTER_SPEED;
    controlsRef.current = controls;

    const onLock = () => setIsLocked(true);
    const onUnlock = () => setIsLocked(false);

    controls.addEventListener("lock", onLock);
    controls.addEventListener("unlock", onUnlock);

    const classroomInputStateTimelineV13 =
      createClassroomInputStateTimelineV13({
        windowObject:
          window,

        camera,
        controls,

        readInteractionFingerprint:
          () =>
            classroomInteractionReplayAuditV12
              .getSnapshot()
              .finalFingerprint
      });

        const classroomOceanVistaV16 =
      createClassroomOceanVistaV16({
        scene,
        camera,
        windowShadeSystem:
          classroomFinalContentV6,
        oceanWorld:
          classroomOceanSkyWorldV15
      });

    const classroomCargoShipLanesV17 =
      createClassroomCargoShipLanesV17({
        scene,
        camera,
        oceanWorld:
          classroomOceanSkyWorldV15
      });

    const classroomSeagullFlocksV18 =
      createClassroomSeagullFlocksV18({
        scene,
        camera,
        oceanWorld:
          classroomOceanSkyWorldV15
      });

    const classroomOceanAtmosphereDepthV19 =
      createClassroomOceanAtmosphereDepthV19({
        scene,
        camera,
        oceanWorld:
          classroomOceanSkyWorldV15
      });

const classroomInteractionAuthorityV11 =
      createClassroomInteractionAuthorityV11({
        scene,
        camera,

        characterVisualIntegration:
          classroomCharacterVisualIntegrationV10,

        windowShadeSystem:
          classroomOceanVistaV16.windowShadeSystem,

        onTeacherIntervention:
          (command) =>
            emitTeacherInterventionCommand(
              command
            ),

        auditObserver:
          classroomInteractionReplayAuditV12,

        windowObject:
          window
      });


    const classroomTeacherDeskHeadphonesV19A =
      createClassroomTeacherDeskHeadphonesV19A({
        scene,
        teacherAnchor
      });

    const classroomEnvironmentalAudioV20 =
      createClassroomEnvironmentalAudioV20({
        camera,
        windowShadeSystem:
          classroomFinalContentV6
      });

    const unlockEnvironmentalAudioV20 =
      () => {
        void classroomEnvironmentalAudioV20.unlock();
      };

    host.addEventListener(
      "click",
      unlockEnvironmentalAudioV20,
      true
    );

    const classroomRuntimeObservabilityV7 =
      createClassroomRuntimeObservabilityV7({
        renderer,
        scene,
        host
      });




    scene.add(new THREE.HemisphereLight(0xe7efff, 0x2c2436, 2.4));

    const keyLight = new THREE.DirectionalLight(0xfff0d8, 2.2);
    keyLight.position.set(4, 7, 5);
    scene.add(keyLight);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 18),
      new THREE.MeshLambertMaterial({ color: 0x6f5844 })
    );

    floor.rotation.x = -Math.PI / 2;
    floor.position.z = -1;
    scene.add(floor);

    addBox(scene, { x: 16, y: 4, z: 0.25 }, { x: 0, y: 2, z: -8 }, 0xc8b99d);
    addBox(scene, { x: 0.25, y: 4, z: 18 }, { x: -8, y: 2, z: -1 }, 0xb5a78e);
    addBox(scene, { x: 0.25, y: 4, z: 18 }, { x: 8, y: 2, z: -1 }, 0xb5a78e);

    addBox(
      scene,
      { x: 6.5, y: 2.1, z: 0.12 },
      { x: 0, y: 2.25, z: -7.82 },
      0x244f44
    );

    addBox(
      scene,
      { x: 1.6, y: 0.12, z: 0.85 },
      { x: teacherAnchor.x, y: 0.82, z: teacherAnchor.z + 0.45 },
      0x76533b
    );

    const interactiveMeshes = [];

    const sceneRoster = createStudentSceneRoster({
      scene,
      interactiveMeshes,

      createStudentMesh() {
        const seat = {
          x: 0,
          z: 0
        };

      const body = addBox(
        scene,
        { x: 0.65, y: 0.9, z: 0.38 },
        { x: seat.x, y: 1.15, z: seat.z },
        0x365da8
      );

      const head = addBox(
        scene,
        { x: 0.48, y: 0.48, z: 0.48 },
        { x: seat.x, y: 1.84, z: seat.z },
        0xd6a978
      );


        scene.remove(body);
        scene.remove(head);

        const visualRoot =
          new THREE.Group();

        visualRoot.add(body);
        visualRoot.add(head);

        const interactionBounds =
          new THREE.Box3().setFromObject(
            visualRoot
          );

        if (interactionBounds.isEmpty()) {
          throw new Error(
            "student visual bounds must not be empty"
          );
        }

        const interactionSize =
          new THREE.Vector3();

        const interactionCenter =
          new THREE.Vector3();

        interactionBounds.getSize(
          interactionSize
        );

        interactionBounds.getCenter(
          interactionCenter
        );

        const interactionMesh =
          new THREE.Mesh(
            new THREE.BoxGeometry(
              Math.max(
                interactionSize.x,
                0.01
              ),
              Math.max(
                interactionSize.y,
                0.01
              ),
              Math.max(
                interactionSize.z,
                0.01
              )
            ),
            new THREE.MeshBasicMaterial({
              transparent: true,
              opacity: 0,
              depthWrite: false,
              colorWrite: false
            })
          );

        interactionMesh.geometry.translate(
          interactionCenter.x,
          interactionCenter.y,
          interactionCenter.z
        );

        interactionMesh.add(body);
        interactionMesh.add(head);

        return interactionMesh;
      },

      disposeStudentMesh(studentMesh) {
        studentMesh.traverse((object) => {
          object.geometry?.dispose();

          if (!object.material) {
            return;
          }

          const materials =
            Array.isArray(object.material)
              ? object.material
              : [object.material];

          for (const material of materials) {
            material?.dispose();
          }
        });
      }
    });

    sceneRosterRef.current =
      sceneRoster;

    const initialStore =
      intelligenceStoreRef.current;

    const initialRoster =
      initialStore
        ? createDynamicStudentRoster(
            initialStore
          )
        : [];

    const initialCollisionObstacles =
      createCollisionObstaclesFromRoster(
        initialRoster
      );

    sceneRoster.sync(
      initialRoster
    );

    collisionObstaclesRef.current =
      initialCollisionObstacles;
    const raycaster = new THREE.Raycaster();
    raycaster.far = INTERACTION_DISTANCE;

    const center = new THREE.Vector2(0, 0);
    const keys = new Set();
    const timer = new THREE.Timer();
    timer.connect(document);

    let playerVelocity = {
      x: 0,
      z: 0
    };

    let activeStudent = null;
    let animationFrame = 0;

    const onKeyDown = (event) => {
      if (event.code === "Escape") {
        setSelectedStudent(null);
        return;
      }
      keys.add(event.code);

      if (event.code === "KeyE" && controls.isLocked && activeStudent) {
        const store = intelligenceStoreRef.current;

        if (
          !store ||
          typeof store.has !== "function" ||
          typeof store.requireStudent !== "function"
        ) {
          setSelectedStudent(null);
          return;
        }

        if (!store.has(activeStudent.studentKey)) {
          setSelectedStudent(null);
          return;
        }

        controls.unlock();
      keys.clear();

      setSelectedStudent(
        store.requireStudent(activeStudent.studentKey)
      );
      }
    };

    const onKeyUp = (event) => {
      keys.delete(event.code);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const resizeCamera = () => {
      const width = host.clientWidth || 16;
      const height = host.clientHeight || 9;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const resizeObserver = new ResizeObserver(resizeCamera);
    resizeObserver.observe(host);
    resizeCamera();

    const animate = (timestamp) => {
      animationFrame =
        requestAnimationFrame(animate);

      timer.update(timestamp);

      const delta =
        timer.getDelta();

      classroomStudentVisualV2.tick();
      classroomCharacterV3.tick();
      classroomRetroCompositionV4.tick(camera, timestamp);

      classroomFinalContentV6.tick({
        timestamp,
        camera,
        controlsLocked:
          controls.isLocked
      });
      classroomExteriorDepthV2.update(camera);
      classroomPerformanceBudget.sample();

      classroomRetroFpsPipeline.updateHud({
        targetIdentity:
          classroomInteractionFeedbackV2.getCurrentIdentity(),

        controlsLocked:
          controls.isLocked,

        timestamp
      });

      if (controls.isLocked) {
        const movementInput =
          createThreeCameraMovementInput(
            keys
          );

        const previousPosition = {
          x: camera.position.x,
          z: camera.position.z
        };

        const locomotion =
          stepPlayerLocomotion({
            position:
              previousPosition,

            velocity:
              playerVelocity,

            input:
              movementInput,

            yaw:
              camera.rotation.y,

            deltaSeconds:
              delta
          });

        const proposedPosition =
          locomotion.position;

        const resolvedPosition =
          resolvePlayerCollision({
            previousPosition,
            proposedPosition,

            bounds: {
              minX: -ROOM_LIMIT,
              maxX: ROOM_LIMIT,
              minZ: -ROOM_LIMIT,
              maxZ: ROOM_LIMIT
            },

            obstacles:
              collisionObstaclesRef.current
          });

        playerVelocity =
          resolveVelocityAfterCollision({
            previousPosition,
            proposedPosition,
            resolvedPosition,

            velocity:
              locomotion.velocity
          });

        camera.position.x =
          resolvedPosition.x;

        camera.position.z =
          resolvedPosition.z;

        camera.position.y =
          PLAYER_HEIGHT;
      } else {
        playerVelocity = {
          x: 0,
          z: 0
        };
      }

      raycaster.setFromCamera(center, camera);

      classroomInteractionFeedbackV2.update({
        raycaster,
        scene,
        camera,
        controlsLocked:
          controls.isLocked
      });

      const hit = raycaster
        .intersectObjects(interactiveMeshes, false)
        .find((candidate) => candidate.distance <= INTERACTION_DISTANCE);

      const nextStudent = hit ? hit.object.userData : null;

      if (nextStudent?.studentKey !== activeStudent?.studentKey) {
        activeStudent = nextStudent;
        setTargetLabel(activeStudent?.displayLabel || "");
      }

    classroomOceanAtmosphereDepthV19.tick({
      deltaSeconds: delta
    });

    classroomSeagullFlocksV18.tick({
      deltaSeconds: delta
    });

    classroomCargoShipLanesV17.tick({
      deltaSeconds: delta
    });

      classroomOceanVistaV16.tick({
      timestamp,
      deltaSeconds: delta
    });

    classroomCharacterVisualIntegrationV10.tick({
        timestamp,
        camera
      });

      classroomOceanSkyWorldV15.tick({
        timestamp,
        camera
      });

      classroomEnvironmentalAudioV20.tick({
      timestamp
    });

    renderer.render(scene, camera);

      classroomInputStateTimelineV13.observeState();

      classroomRuntimeObservabilityV7.observeFrame({
        timestamp
      });
    };

    animationFrame =
      requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
      timer.dispose();
      resizeObserver.disconnect();

      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);

      controls.removeEventListener("lock", onLock);
      controls.removeEventListener("unlock", onUnlock);

      controls.dispose();
      controlsRef.current = null;

      sceneRoster.dispose();
      sceneRosterRef.current = null;
      collisionObstaclesRef.current = [];

      classroomRetroCompositionV4.dispose();

      host.removeEventListener(
      "click",
      unlockEnvironmentalAudioV20,
      true
    );

    classroomEnvironmentalAudioV20.dispose();

    classroomTeacherDeskHeadphonesV19A.dispose();

      classroomFinalContentV6.dispose();

      classroomRuntimeObservabilityV7.dispose();
      classroomRetroFpsPipeline.dispose();
      classroomInteractionAuthorityV11.dispose();
      classroomInputStateTimelineV13.dispose();

      classroomInteractionReplayAuditV12.dispose();

      classroomCharacterVisualIntegrationV10.dispose();

      classroomCharacterV3.dispose();
      classroomRoomGeometryV3.dispose();
      classroom64BitVisualUpgrade.dispose();
      classroomPerformanceBudget.dispose();
      classroomInteractionFeedbackV2.dispose();
      classroomExteriorDepthV2.dispose();
      classroomStudentVisualV2.dispose();
      classroomEnvironmentDetailV2.dispose();
      classroomFurnitureV2.dispose();
      classroomLightingV2.dispose();
      classroomArchitectureV2.dispose();
      classroomVisualSystem.dispose();
      classroomOceanAtmosphereDepthV19.dispose();
      classroomSeagullFlocksV18.dispose();
      classroomCargoShipLanesV17.dispose();
      classroomOceanVistaV16.dispose();
      classroomOceanSkyWorldV15.dispose();

      scene.traverse((object) => {
        object.geometry?.dispose();

        if (object.material) {
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];

          for (const material of materials) {
            material.dispose();
          }
        }
      });

      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <section className="cw-world">
      <div
        ref={hostRef}
        className="cw-world__viewport"
        onClick={() => {
          if (
            hasEntered &&
            !selectedStudent &&
            !isLocked
          ) {
            controlsRef.current?.lock();
          }
        }}
      />

      <div className="cw-world__hud">
        <strong>CLASSROOM WORLD // CW03</strong>
        <span>WASD MOVE · MOUSE LOOK · ESC RELEASE</span>
      </div>

      <div className="cw-world__crosshair">+</div>

      {targetLabel && isLocked && (
        <div className="cw-world__prompt">
          [E] VIEW {targetLabel.toUpperCase()}
        </div>
      )}

      {!hasEntered && (
        <div className="cw-world__entry">
          <div className="cw-world__entry-card">
            <small>CW03 RENDERING SPIKE</small>
            <h2>Enter Classroom World</h2>

            <p>
              Deterministic demo fixture only. No real student data.
            </p>

            <button
              type="button"
              onClick={() => {
                setHasEntered(true);
                controlsRef.current?.lock();
              }}
            >
              ENTER CLASSROOM
            </button>
          </div>
        </div>
      )}

      {selectedStudent && (
        <aside
          className="cw-world__student-card cw-world__student-hud"
          role="dialog"
          aria-label="Student intelligence"
        >
          <div
            className="cw-world__student-hud-scanline"
            aria-hidden="true"
          />

          <header className="cw-world__student-hud-header">
            <div>
              <small>
                LOTUSLEARN // STUDENT INTELLIGENCE
              </small>

              <strong>
                {selectedStudent.displayLabel}
              </strong>

              <span>
                {selectedStudent.studentKey}
              </span>
            </div>

            <button
              type="button"
              className="cw-world__student-hud-close"
              onClick={() => setSelectedStudent(null)}
              aria-label="Close student intelligence"
            >
              X
            </button>
          </header>

          <div
            className="cw-world__student-hud-divider"
            aria-hidden="true"
          />

          <dl className="cw-world__student-hud-grid">
            {selectedStudentHudRows.map(
              ({ field, label, value }) => (
                <div
                  className="cw-world__student-hud-row"
                  key={field}
                >
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                      {selectedStudent && typeof onTeacherIntervention === "function" ? (
        <div className="classroom-world__teacher-intervention">
          <button
            type="button"
            className="classroom-world__teacher-intervention-trigger"
            disabled={teacherInterventionStatus?.phase === "pending"}
            aria-busy={teacherInterventionStatus?.phase === "pending"}
            onClick={(...eventArgs) => {
                  if (
                    typeof globalThis.dispatchEvent === "function" &&
                    typeof globalThis.CustomEvent === "function"
                  ) {
                    globalThis.dispatchEvent(
                      new globalThis.CustomEvent(
                        RETRO_TEACHER_INTERVENTION_UI_EVENT,
                        {
                          detail: {
                            studentKey:
                              selectedStudent?.studentKey ??
                              null
                          }
                        }
                      )
                    );
                  }

                  const originalOnClick =
                    (() =>
                    emitTeacherInterventionCommand({
                      studentKey: selectedStudent.studentKey,
                      actionType: "probe_understanding",
                    }));

                  return originalOnClick(
                    ...eventArgs
                  );
                }}
          >
            {teacherInterventionStatus?.phase === "pending"
              ? "SAVING..."
              : "APPLY INTERVENTION"}
          </button>

          {teacherInterventionStatus?.phase &&
          teacherInterventionStatus.phase !== "idle" ? (
            <div
              className="classroom-world__teacher-intervention-status"
              role="status"
              aria-live="polite"
              data-phase={teacherInterventionStatus.phase}
            >
              {teacherInterventionStatus.message}
            </div>
          ) : null}
        </div>
      ) : null}
</div>
              )
            )}
          </dl>

          <footer className="cw-world__student-hud-footer">
            <span>[E] INSPECT</span>
            <span>[ESC] CLOSE</span>
          </footer>
        </aside>
      )}
    </section>
  );
}

export default ClassroomWorld;
