import fs from "node:fs";
﻿import assert from "node:assert/strict";
import {
  readFileSync
} from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  fileURLToPath
} from "node:url";

import {
  CLASSROOM_VISUAL_FIDELITY_V22_PROFILE,
  createDeterministicDustLayoutV22,
  deterministicUnitV22
} from "./classroomVisualFidelityV22.js";

const DIRECTORY =
  path.dirname(
    fileURLToPath(
      import.meta.url
    )
  );

function readSource(name) {
  return readFileSync(
    path.join(
      DIRECTORY,
      name
    ),
    "utf8"
  );
}

function countMatches(
  source,
  pattern
) {
  return Array.from(
    source.matchAll(
      pattern
    )
  ).length;
}

test(
  "V22 profile remains visual-only and deterministic",
  () => {
    assert.equal(
      CLASSROOM_VISUAL_FIDELITY_V22_PROFILE
        .id,
      "cw06-visual-fidelity-v22"
    );

    assert.equal(
      CLASSROOM_VISUAL_FIDELITY_V22_PROFILE
        .visualOnly,
      true
    );

    assert.equal(
      CLASSROOM_VISUAL_FIDELITY_V22_PROFILE
        .deterministic,
      true
    );

    assert.equal(
      CLASSROOM_VISUAL_FIDELITY_V22_PROFILE
        .shadowMapSize,
      2048
    );
  }
);

test(
  "V22 deterministic generator is stable",
  () => {
    const first =
      createDeterministicDustLayoutV22(
        12
      );

    const second =
      createDeterministicDustLayoutV22(
        12
      );

    assert.deepEqual(
      first,
      second
    );

    assert.equal(
      first.length,
      12
    );

    assert.equal(
      deterministicUnitV22(
        7,
        99
      ),
      deterministicUnitV22(
        7,
        99
      )
    );
  }
);

test(
  "V22 world integration has one construction tick and dispose",
  () => {
    const world =
      readSource(
        "ClassroomWorld.jsx"
      );

    assert.equal(
      countMatches(
        world,
        /createClassroomVisualFidelityV22\s*\(\{/gu
      ),
      1
    );

    assert.equal(
      countMatches(
        world,
        /classroomVisualFidelityV22\.tick\s*\(\{/gu
      ),
      1
    );

    assert.equal(
      countMatches(
        world,
        /classroomVisualFidelityV22\.dispose\s*\(\s*\)/gu
      ),
      1
    );
  }
);

test(
  "V22 adds depth without gameplay authority",
  () => {
    const source =
      readSource(
        "classroomVisualFidelityV22.js"
      );

    assert.equal(
      /new\s+THREE\.Raycaster/gu.test(
        source
      ),
      false
    );

    assert.equal(
      /addEventListener\s*\(/gu.test(
        source
      ),
      false
    );

    assert.equal(
      /AudioListener/gu.test(
        source
      ),
      false
    );

    assert.equal(
      /Math\.random/gu.test(
        source
      ),
      false
    );

    assert.equal(
      /emitTeacherInterventionCommand/gu.test(
        source
      ),
      false
    );
  }
);

test(
  "V22 includes real and contact shadow systems",
  () => {
    const source =
      readSource(
        "classroomVisualFidelityV22.js"
      );

    assert.match(
      source,
      /new\s+THREE\.ShadowMaterial\s*\(/u
    );

    assert.match(
      source,
      /new\s+THREE\.InstancedMesh\s*\(/u
    );

    assert.match(
      source,
      /\.computeBoundingSphere\s*\(\s*\)/u
    );

    assert.doesNotMatch(
  source,
  /\.mapSize\s*\.set\s*\(/u
);

    assert.match(
      source,
      /castShadow\s*=\s*true/u
    );

    assert.match(
      source,
      /receiveShadow\s*=\s*true/u
    );
  }
);

test(
  "V22 keeps pixel-era rendering authority outside the module",
  () => {
    const source =
      readSource(
        "classroomVisualFidelityV22.js"
      );

    assert.equal(
      /renderer\.setSize\s*\(/gu.test(
        source
      ),
      false
    );

    assert.equal(
      /renderer\.setPixelRatio\s*\(/gu.test(
        source
      ),
      false
    );

    assert.equal(
      /renderer\.toneMapping\s*=/gu.test(
        source
      ),
      false
    );

    assert.equal(
      /renderer\.outputColorSpace\s*=/gu.test(
        source
      ),
      false
    );
  }
);


test(
  "CW08.3C-D V22 delegates global shadow infrastructure",
  () => {
    const sourceText =
      fs.readFileSync(
        new URL(
          "./classroomVisualFidelityV22.js",
          import.meta.url
        ),
        "utf8"
      );

    assert.doesNotMatch(
      sourceText,
      /renderer\.shadowMap\.enabled\s*=/u
    );

    assert.doesNotMatch(
      sourceText,
      /renderer\.shadowMap\.type\s*=/u
    );

    assert.doesNotMatch(
      sourceText,
      /sunlight\.shadow\.mapSize\.set\s*\(/u
    );

    assert.doesNotMatch(
      sourceText,
      /sunlight\.shadow\.bias\s*=/u
    );

    assert.doesNotMatch(
      sourceText,
      /sunlight\.shadow\.normalBias\s*=/u
    );

    assert.match(
      sourceText,
      /object\.castShadow\s*=/u
    );

    assert.match(
      sourceText,
      /object\.receiveShadow\s*=/u
    );

    assert.match(
      sourceText,
      /new THREE\.ShadowMaterial/u
    );
  }
);
