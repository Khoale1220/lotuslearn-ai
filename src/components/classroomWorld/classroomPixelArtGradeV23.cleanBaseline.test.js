import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";


const sourcePath =
  fileURLToPath(
    new URL(
      "./classroomPixelArtGradeV23.js",
      import.meta.url
    )
  );


function readSource() {
  return fs
    .readFileSync(
      sourcePath,
      "utf8"
    )
    .replace(
      /\r\n/g,
      "\n"
    );
}


function readProfileRegion() {
  const source =
    readSource();

  const start =
    source.indexOf(
      "const CLASSROOM_PIXEL_ART_GRADE_V23_PROFILE"
    );

  const end =
    source.indexOf(
      "const CLASSROOM_PIXEL_ART_GRADE_V23_PALETTE",
      start
    );

  assert.ok(
    start >= 0
  );

  assert.ok(
    end > start
  );

  return source.slice(
    start,
    end
  );
}


test(
  "CW08 V23 default profile uses the clean baseline grade",
  () => {
    const profile =
      readProfileRegion();

    assert.match(
      profile,
      /CW08_CLEAN_BASELINE_GRADE/u
    );

    assert.match(
      profile,
      /red\s*:\s*64\s*,/u
    );

    assert.match(
      profile,
      /green\s*:\s*64\s*,/u
    );

    assert.match(
      profile,
      /blue\s*:\s*64\b/u
    );

    assert.match(
      profile,
      /saturation\s*:\s*1\.00\s*,/u
    );

    assert.match(
      profile,
      /contrast\s*:\s*1\.00\s*,/u
    );

    assert.match(
      profile,
      /edgeStrength\s*:\s*0\s*,/u
    );

    assert.match(
      profile,
      /ditherStrength\s*:\s*0\b/u
    );
  }
);


test(
  "CW08 V23 removes the previous aggressive grade defaults",
  () => {
    const profile =
      readProfileRegion();

    assert.doesNotMatch(
      profile,
      /edgeStrength\s*:\s*0\.08/u
    );

    assert.doesNotMatch(
      profile,
      /ditherStrength\s*:\s*0\.0015/u
    );

    assert.doesNotMatch(
      profile,
      /red\s*:\s*18\s*,\s*green\s*:\s*18\s*,\s*blue\s*:\s*16/u
    );
  }
);


test(
  "CW08 V23 keeps the existing render-target shader architecture",
  () => {
    const source =
      readSource();

    assert.match(
      source,
      /ShaderMaterial/u
    );

    assert.match(
      source,
      /setRenderTarget/u
    );

    assert.match(
      source,
      /renderer\.render/u
    );

    assert.match(
      source,
      /colorspace_fragment/u
    );
  }
);
