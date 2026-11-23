import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const worldSource = readFileSync(
  new URL("./ClassroomWorld.jsx", import.meta.url),
  "utf8"
);

const obstacleSource = readFileSync(
  new URL("./classroomObstacles.js", import.meta.url),
  "utf8"
);

function count(source, pattern) {
  return source.match(pattern)?.length ?? 0;
}

test(
  "CW05 dynamic student roster runtime contract",
  async (t) => {
    await t.test(
      "removes single demo student runtime dependency",
      () => {
        assert.doesNotMatch(
          worldSource,
          /CLASSROOM_WORLD_FIXTURE\.students\[0\]/
        );

        assert.doesNotMatch(
          worldSource,
          /seatToWorld\(student\.seatIndex\)/
        );

        assert.doesNotMatch(
          worldSource,
          /const interactiveMeshes = \[body, head\]/
        );
      }
    );

    await t.test(
      "derives scene state from sanitized intelligence",
      () => {
        assert.match(
          worldSource,
          /createDynamicStudentRoster/
        );

        assert.match(
          worldSource,
          /createStudentSceneRoster/
        );

        assert.match(
          worldSource,
          /sceneRoster\.sync\(\s*initialRoster/
        );

        assert.match(
          worldSource,
          /sceneRoster\.sync\(roster\)/
        );
      }
    );

    await t.test(
      "preserves original two-part student rendering",
      () => {
        assert.match(
          worldSource,
          /const body = addBox/
        );

        assert.match(
          worldSource,
          /const head = addBox/
        );

        assert.match(
          worldSource,
          /y:\s*1\.84/
        );

        assert.match(
          worldSource,
          /interactionMesh\.add\(body\)/
        );

        assert.match(
          worldSource,
          /interactionMesh\.add\(head\)/
        );
      }
    );

    await t.test(
      "derives interaction geometry from rendered bounds",
      () => {
        assert.match(
          worldSource,
          /new THREE\.Box3\(\)\.setFromObject/
        );

        assert.match(
          worldSource,
          /interactionBounds\.getSize/
        );

        assert.match(
          worldSource,
          /interactionBounds\.getCenter/
        );

        assert.match(
          worldSource,
          /colorWrite:\s*false/
        );
      }
    );

    await t.test(
      "keeps interactive targets lifecycle owned",
      () => {
        assert.match(
          worldSource,
          /const interactiveMeshes = \[\]/
        );

        assert.match(
          worldSource,
          /intersectObjects\(interactiveMeshes,\s*false\)/
        );
      }
    );

    await t.test(
      "derives collision from same dynamic roster",
      () => {
        assert.match(
          worldSource,
          /createCollisionObstaclesFromRoster/
        );

        assert.match(
          worldSource,
          /students:\s*roster\.map/
        );

        assert.match(
          obstacleSource,
          /fixture\.students\.map/
        );

        assert.match(
          obstacleSource,
          /createDeskObstacle/
        );

        assert.match(
          worldSource,
          /obstacles:\s*collisionObstaclesRef\.current/
        );

        assert.doesNotMatch(
          worldSource,
          /const classroomObstacles\s*=/
        );
      }
    );

    await t.test(
      "maintains one Three scene and one pointer lock runtime",
      () => {
        assert.equal(
          count(
            worldSource,
            /new THREE\.Scene\(/g
          ),
          1
        );

        assert.equal(
          count(
            worldSource,
            /new PointerLockControls\(/g
          ),
          1
        );

        assert.match(
          worldSource,
          /const sceneRosterRef = useRef\(null\)/
        );

        assert.match(
          worldSource,
          /const collisionObstaclesRef = useRef\(\[\]\)/
        );
      }
    );

    await t.test(
      "owns and disposes dynamic GPU resources",
      () => {
        const rosterDispose =
          worldSource.indexOf(
            "sceneRoster.dispose();"
          );

        const sceneTraverse =
          worldSource.indexOf(
            "scene.traverse("
          );

        assert.ok(
          rosterDispose >= 0
        );

        assert.ok(
          sceneTraverse >= 0
        );

        assert.ok(
          rosterDispose < sceneTraverse
        );

        assert.match(
          worldSource,
          /object\.geometry\?\.dispose\(\)/
        );

        assert.match(
          worldSource,
          /material\?\.dispose\(\)/
        );
      }
    );

    await t.test(
      "keeps private raw analysis outside Three runtime",
      () => {
        const forbidden = [
          /\brawSubmission\b/,
          /\brawSubmissions\b/,
          /\bstudentName\b/,
          /\bemail\b/
        ];

        for (const pattern of forbidden) {
          assert.doesNotMatch(
            worldSource,
            pattern
          );
        }
      }
    );
  }
);