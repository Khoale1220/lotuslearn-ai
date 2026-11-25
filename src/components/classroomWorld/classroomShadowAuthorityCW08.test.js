import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function readLocal(name) {
  return fs.readFileSync(
    new URL(
      `./${name}`,
      import.meta.url
    ),
    "utf8"
  );
}

const lightingV2 =
  readLocal(
    "classroomLightingV2.js"
  );

const v64 =
  readLocal(
    "classroom64BitVisualUpgrade.js"
  );

const retro =
  readLocal(
    "classroomRetroFpsPipeline.js"
  );

const v22 =
  readLocal(
    "classroomVisualFidelityV22.js"
  );

test(
  "CW08.3C-D LightingV2 owns canonical renderer shadow infrastructure",
  () => {
    assert.match(
      lightingV2,
      /renderer\.shadowMap\.enabled\s*=/u
    );

    assert.match(
      lightingV2,
      /renderer\.shadowMap\.type\s*=/u
    );

    assert.match(
      lightingV2,
      /THREE\.BasicShadowMap/u
    );

    assert.match(
      lightingV2,
      /sunlight\.castShadow\s*=/u
    );

    assert.match(
      lightingV2,
      /sunlight\.shadow\.mapSize\.set\(/u
    );

    assert.match(
      lightingV2,
      /sunlight\.shadow\.bias\s*=/u
    );

    assert.match(
      lightingV2,
      /sunlight\.shadow\.normalBias\s*=/u
    );

    assert.match(
      lightingV2,
      /sunlight\.shadow\.camera\.left\s*=/u
    );

    assert.match(
      lightingV2,
      /sunlight\.shadow\.camera\.far\s*=/u
    );
  }
);

test(
  "CW08.3C-D V64 does not mutate canonical shadow infrastructure",
  () => {
    assert.doesNotMatch(
      v64,
      /renderer\.shadowMap\.type\s*=/u
    );

    assert.doesNotMatch(
      v64,
      /THREE\.PCFSoftShadowMap/u
    );

    assert.doesNotMatch(
      v64,
      /sunlight\.shadow\.mapSize\.set\(/u
    );

    assert.doesNotMatch(
      v64,
      /sunlight\.shadow\.bias\s*=/u
    );

    assert.doesNotMatch(
      v64,
      /sunlight\.shadow\.normalBias\s*=/u
    );
  }
);

test(
  "CW08.3C-D RetroFPS does not mutate shadow-map type",
  () => {
    assert.doesNotMatch(
      retro,
      /renderer\.shadowMap\.type\s*=/u
    );
  }
);

test(
  "CW08.3C-D V22 owns participation and contact art but not global infrastructure",
  () => {
    assert.doesNotMatch(
      v22,
      /renderer\.shadowMap\.enabled\s*=/u
    );

    assert.doesNotMatch(
      v22,
      /renderer\.shadowMap\.type\s*=/u
    );

    assert.doesNotMatch(
      v22,
      /sunlight\.shadow\.mapSize\.set\(/u
    );

    assert.doesNotMatch(
      v22,
      /sunlight\.shadow\.bias\s*=/u
    );

    assert.doesNotMatch(
      v22,
      /sunlight\.shadow\.normalBias\s*=/u
    );

    assert.match(
      v22,
      /object\.castShadow\s*=/u
    );

    assert.match(
      v22,
      /object\.receiveShadow\s*=/u
    );

    assert.match(
      v22,
      /new THREE\.ShadowMaterial/u
    );

    assert.match(
      v22,
      /contactShadows/u
    );
  }
);
