import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT =
  path.resolve(
    process.cwd(),
    "src/components/classroomWorld"
  );

function read(name) {
  return fs.readFileSync(
    path.join(
      ROOT,
      name
    ),
    "utf8"
  );
}

const v64 =
  read(
    "classroom64BitVisualUpgrade.js"
  );

const v35 =
  read(
    "classroomDepthAtmospherePixelLightingV35.js"
  );

const visual =
  read(
    "classroomVisualSystem.js"
  );


test(
  "P3B friendly daylight atmosphere is active",
  () => {
    assert.match(
      v35,
      /\bfog\s*:\s*0x7895a8\b/
    );

    assert.match(
      v35,
      /\bhemisphereSky\s*:\s*0xb7d6e8\b/
    );

    assert.match(
      v35,
      /\bhemisphereGround\s*:\s*0x665c54\b/
    );

    assert.match(
      v35,
      /\bdirectionalKey\s*:\s*0xffd29d\b/
    );
  }
);


test(
  "P3B increases key fill separation without new lights",
  () => {
    assert.match(
      v35,
      /\bhemisphereIntensityMultiplier\s*:\s*0\.78\b/
    );

    assert.match(
      v35,
      /\bdirectionalIntensityMultiplier\s*:\s*1\.14\b/
    );

    assert.doesNotMatch(
      v35,
      /new\s+THREE\.(?:Ambient|Hemisphere|Directional|Point|Spot)Light\s*\(/
    );
  }
);


test(
  "P3B extends atmospheric depth",
  () => {
    assert.match(
      v35,
      /\bforegroundClearUntil\s*:\s*11\.5\b/
    );

    assert.match(
      v35,
      /\batmosphericFar\s*:\s*40\b/
    );
  }
);


test(
  "P3B wood and metal have distinct light response",
  () => {
    assert.match(
      v64,
      /materials\.wood\b[\s\S]{0,320}?roughness:\s*0\.52\b/
    );

    assert.match(
      v64,
      /materials\.woodDark\b[\s\S]{0,320}?roughness:\s*0\.58\b/
    );

    assert.match(
      v64,
      /materials\.metal\b[\s\S]{0,320}?roughness:\s*0\.28\b/
    );

    assert.match(
      v64,
      /materials\.metal\b[\s\S]{0,380}?metalness:\s*0\.52\b/
    );

    assert.match(
      v64,
      /materials\.frame\b[\s\S]{0,320}?roughness:\s*0\.32\b/
    );

    assert.match(
      v64,
      /materials\.frame\b[\s\S]{0,380}?metalness:\s*0\.38\b/
    );
  }
);


test(
  "P3B maintains matte architecture while improving form",
  () => {
    assert.match(
      v64,
      /materials\.wall\b[\s\S]{0,320}?roughness:\s*0\.78\b/
    );

    assert.match(
      v64,
      /materials\.wallShadow\b[\s\S]{0,320}?roughness:\s*0\.88\b/
    );

    assert.match(
      v64,
      /materials\.chalkboard\b[\s\S]{0,320}?roughness:\s*0\.90\b/
    );

    assert.match(
      v64,
      /const\s+floorMaterial[\s\S]{0,520}?roughness:\s*0\.68\b/
    );
  }
);


test(
  "P3B preserves canonical output transform",
  () => {
    assert.match(
      visual,
      /renderer\.outputColorSpace\s*=\s*THREE\.SRGBColorSpace/
    );

    assert.match(
      visual,
      /renderer\.toneMapping\s*=\s*THREE\.ACESFilmicToneMapping/
    );
  }
);


test(
  "P3B preserves authority boundaries",
  () => {
    assert.doesNotMatch(
      v35,
      /material\.(?:roughness|metalness)\s*=/
    );

    assert.doesNotMatch(
      v35,
      /renderer\.shadowMap\.type\s*=/
    );
  }
);