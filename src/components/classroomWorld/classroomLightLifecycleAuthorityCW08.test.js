import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function readSource(
  name
) {
  return fs.readFileSync(
    new URL(
      `./${name}`,
      import.meta.url
    ),
    "utf8"
  );
}

const v24Source =
  readSource(
    "classroomReferenceWorldArtV24.js"
  );

const v35Source =
  readSource(
    "classroomDepthAtmospherePixelLightingV35.js"
  );

test(
  "CW08.3C-E V35 owns runtime light appearance",
  () => {
    assert.match(
      v35Source,
      /hemisphereLight\.intensity\s*=/u
    );

    assert.match(
      v35Source,
      /directionalLight\.intensity\s*=/u
    );

    assert.match(
      v35Source,
      /hemisphereLight\.color\.setHex\s*\(/u
    );

    assert.match(
      v35Source,
      /directionalLight\.color\.setHex\s*\(/u
    );
  }
);

test(
  "CW08.3C-E V24 does not restore light appearance it does not own",
  () => {
    assert.doesNotMatch(
      v24Source,
      /state\.object\.intensity\s*=/u
    );

    assert.doesNotMatch(
      v24Source,
      /state\.object\.color\.copy\s*\(/u
    );

    assert.doesNotMatch(
      v24Source,
      /state\.object\.groundColor\.copy\s*\(/u
    );
  }
);

test(
  "CW08.3C-E V24 remains free of direct canonical light appearance writes",
  () => {
    assert.doesNotMatch(
      v24Source,
      /hemisphereLight\.intensity\s*=/u
    );

    assert.doesNotMatch(
      v24Source,
      /directionalLight\.intensity\s*=/u
    );

    assert.doesNotMatch(
      v24Source,
      /hemisphereLight\.color\.setHex\s*\(/u
    );

    assert.doesNotMatch(
      v24Source,
      /directionalLight\.color\.setHex\s*\(/u
    );
  }
);
