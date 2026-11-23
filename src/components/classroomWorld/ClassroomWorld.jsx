import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { stepPlayerMovement } from "./playerMovement.js";
import { resolvePlayerCollision } from "./playerCollision.js";
import { createClassroomObstacles } from "./classroomObstacles.js";

import {
  CLASSROOM_WORLD_FIXTURE,
  INTERACTION_DISTANCE,
  PIXEL_RENDER_CONFIG,
  seatToWorld
} from "./classroomWorldContract.js";

import "./classroomWorld.css";

const MOVE_SPEED = 3.5;
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

function ClassroomWorld({ intelligenceStore = null }) {
  const hostRef = useRef(null);
  const controlsRef = useRef(null);
  const intelligenceStoreRef = useRef(intelligenceStore);

  useEffect(() => {
    intelligenceStoreRef.current = intelligenceStore;
  }, [intelligenceStore]);

  const [isLocked, setIsLocked] = useState(false);
  const [targetLabel, setTargetLabel] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const student = CLASSROOM_WORLD_FIXTURE.students[0];
    const seat = seatToWorld(student.seatIndex);

    const classroomObstacles = createClassroomObstacles({
      fixture: CLASSROOM_WORLD_FIXTURE
    });

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x17151f);
    scene.fog = new THREE.Fog(0x17151f, 12, 24);

    const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 50);
    camera.position.set(seat.x + 2.5, PLAYER_HEIGHT, 5.5);
    camera.lookAt(seat.x, 1.4, seat.z);
    scene.add(camera);

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

    const controls = new PointerLockControls(camera, renderer.domElement);
    controls.pointerSpeed = 0.8;
    controlsRef.current = controls;

    const onLock = () => setIsLocked(true);
    const onUnlock = () => setIsLocked(false);

    controls.addEventListener("lock", onLock);
    controls.addEventListener("unlock", onUnlock);

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
      { x: seat.x, y: 0.82, z: seat.z + 0.45 },
      0x76533b
    );

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

    const interactiveMeshes = [body, head];

    for (const mesh of interactiveMeshes) {
      mesh.userData = {
        studentKey: student.studentKey,
        displayLabel: student.displayLabel
      };
    }

    const raycaster = new THREE.Raycaster();
    raycaster.far = INTERACTION_DISTANCE;

    const center = new THREE.Vector2(0, 0);
    const keys = new Set();
    const clock = new THREE.Clock();

    let activeStudent = null;
    let animationFrame = 0;

    const onKeyDown = (event) => {
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

    const animate = () => {
      animationFrame = requestAnimationFrame(animate);

      const delta = Math.min(clock.getDelta(), 0.05);

      if (controls.isLocked) {
        const forward =
          (keys.has("KeyW") ? 1 : 0) -
          (keys.has("KeyS") ? 1 : 0);

        const sideways =
          (keys.has("KeyD") ? 1 : 0) -
          (keys.has("KeyA") ? 1 : 0);

        const previousPosition = {
          x: camera.position.x,
          z: camera.position.z
        };

        const proposedPosition = stepPlayerMovement({
          position: previousPosition,
          input: {
            forward: forward > 0,
            backward: forward < 0,
            right: sideways > 0,
            left: sideways < 0
          },
          yaw: camera.rotation.y,
          deltaSeconds: delta
        });

        const resolvedPosition = resolvePlayerCollision({
          previousPosition,
          proposedPosition,
          bounds: {
            minX: -ROOM_LIMIT,
            maxX: ROOM_LIMIT,
            minZ: -ROOM_LIMIT,
            maxZ: ROOM_LIMIT
          },
          obstacles: classroomObstacles
        });

        camera.position.x = resolvedPosition.x;
        camera.position.z = resolvedPosition.z;
        camera.position.y = PLAYER_HEIGHT;
      }

      raycaster.setFromCamera(center, camera);

      const hit = raycaster
        .intersectObjects(interactiveMeshes, false)
        .find((candidate) => candidate.distance <= INTERACTION_DISTANCE);

      const nextStudent = hit ? hit.object.userData : null;

      if (nextStudent?.studentKey !== activeStudent?.studentKey) {
        activeStudent = nextStudent;
        setTargetLabel(activeStudent?.displayLabel || "");
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();

      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);

      controls.removeEventListener("lock", onLock);
      controls.removeEventListener("unlock", onUnlock);

      controls.dispose();
      controlsRef.current = null;

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
      <div ref={hostRef} className="cw-world__viewport" />

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

      {!isLocked && (
        <div className="cw-world__entry">
          <div className="cw-world__entry-card">
            <small>CW03 RENDERING SPIKE</small>
            <h2>Enter Classroom World</h2>

            <p>
              Deterministic demo fixture only. No real student data.
            </p>

            <button
              type="button"
              onClick={() => controlsRef.current?.lock()}
            >
              ENTER CLASSROOM
            </button>
          </div>
        </div>
      )}

      {selectedStudent && (
        <aside className="cw-world__student-card">
          <button
            type="button"
            onClick={() => setSelectedStudent(null)}
          >
            ×
          </button>

          <small>DEMO STUDENT</small>
          <strong>{selectedStudent.displayLabel}</strong>
          <span>{selectedStudent.studentKey}</span>
        </aside>
      )}
    </section>
  );
}

export default ClassroomWorld;
