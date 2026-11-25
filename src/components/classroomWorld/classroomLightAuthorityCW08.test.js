import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const classroomWorld =
  fs.readFileSync(
    new URL("./ClassroomWorld.jsx", import.meta.url),
    "utf8"
  );

const lightingV2 =
  fs.readFileSync(
    new URL("./classroomLightingV2.js", import.meta.url),
    "utf8"
  );

const v35 =
  fs.readFileSync(
    new URL(
      "./classroomDepthAtmospherePixelLightingV35.js",
      import.meta.url
    ),
    "utf8"
  );

const v24 =
  fs.readFileSync(
    new URL(
      "./classroomReferenceWorldArtV24.js",
      import.meta.url
    ),
    "utf8"
  );

test(
  "CW08.3C-C ClassroomWorld does not create a second anonymous light rig",
  () => {
    assert.doesNotMatch(
      classroomWorld,
      /scene\.add\(new THREE\.HemisphereLight\(0xe7efff/u
    );

    assert.doesNotMatch(
      classroomWorld,
      /const keyLight = new THREE\.DirectionalLight\(0xfff0d8/u
    );
  }
);

test(
  "CW08.3C-C LightingV2 remains canonical light infrastructure authority",
  () => {
    assert.match(
      lightingV2,
      /new THREE\.HemisphereLight\(/u
    );

    assert.match(
      lightingV2,
      /new THREE\.DirectionalLight\(/u
    );

    assert.match(
      lightingV2,
      /sunlight\.castShadow\s*=\s*[\s\S]*?true/u
    );

    assert.match(
      lightingV2,
      /sunlight\.shadow\.mapSize\.set\(/u
    );
  }
);

test(
  "CW08.3C-C V35 remains global light appearance authority",
  () => {
    assert.match(
      v35,
      /hemisphereLight\.color\.setHex\(/u
    );

    assert.match(
      v35,
      /hemisphereLight\.groundColor\.setHex\(/u
    );

    assert.match(
      v35,
      /hemisphereLight\.intensity\s*=/u
    );

    assert.match(
      v35,
      /directionalLight\.color\.setHex\(/u
    );

    assert.match(
      v35,
      /directionalLight\.intensity\s*=/u
    );

    assert.match(
      v35,
      /scene\.fog\.color\.setHex\(/u
    );
  }
);

test(
  "CW08.3C-C V24 no longer acquires global light appearance authority",
  () => {
    assert.doesNotMatch(
      v24,
      /lightStates\.push\(/u
    );

    assert.doesNotMatch(
      v24,
      /object\.isHemisphereLight/u
    );

    assert.doesNotMatch(
      v24,
      /object\.isDirectionalLight/u
    );
  }
);
