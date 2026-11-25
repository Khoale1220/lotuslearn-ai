import assert from "node:assert/strict";

import fs from "node:fs";

import test from "node:test";


const source =
  fs.readFileSync(
    new URL(
      "./ClassroomWorld.jsx",
      import.meta.url
    ),
    "utf8"
  );


test(
  "CW07 V51 integrates as a construction-time visual authority",
  () => {
    assert.match(
      source,
      /createClassroomVisualHierarchyV51/
    );

    const hierarchyCreate =
      source.indexOf(
        "const classroomVisualHierarchyV51 ="
      );

    const animate =
      source.indexOf(
        "const animate = (timestamp) => {"
      );

    assert.ok(
      hierarchyCreate >= 0
    );

    assert.ok(
      animate >
        hierarchyCreate
    );

    assert.equal(
      source.includes(
        "classroomVisualHierarchyV51.tick("
      ),
      false
    );
  }
);


test(
  "CW07 V51 restores visibility during teardown",
  () => {
    const hierarchyDispose =
      source.indexOf(
        "classroomVisualHierarchyV51.dispose();"
      );

    const interactionDispose =
      source.indexOf(
        "classroomInteractionAuthorityV11.dispose();"
      );

    assert.ok(
      hierarchyDispose >= 0
    );

    assert.ok(
      interactionDispose >
        hierarchyDispose
    );
  }
);


test(
  "CW07 V51 does not acquire gameplay or intervention authority",
  () => {
    const module =
      fs.readFileSync(
        new URL(
          "./classroomVisualHierarchyV51.js",
          import.meta.url
        ),
        "utf8"
      );

    for (
      const forbidden
      of [
        "emitTeacherInterventionCommand",
        "onTeacherIntervention(",
        "stepPlayerLocomotion(",
        "resolvePlayerCollision(",
        "new THREE.Raycaster",
        ".layers.set("
      ]
    ) {
      assert.equal(
        module.includes(
          forbidden
        ),
        false,
        forbidden
      );
    }
  }
);
