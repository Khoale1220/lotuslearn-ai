import assert from "node:assert/strict";

import {
  readFileSync
} from "node:fs";

import path from "node:path";

import test from "node:test";

import {
  fileURLToPath
} from "node:url";

import {
  CLASSROOM_PIXEL_ART_GRADE_V23_PALETTE,
  CLASSROOM_PIXEL_ART_GRADE_V23_PROFILE,
  createPixelArtGradeShaderV23,
  getPixelArtGradeV23Profile
} from "./classroomPixelArtGradeV23.js";

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
  "V23 locks high-detail cinematic VGA art direction",
  () => {
    assert.equal(
      CLASSROOM_PIXEL_ART_GRADE_V23_PROFILE
        .artDirection,
      "high-detail-1990s-vga-cinematic-pixel-art"
    );

    assert.equal(
      CLASSROOM_PIXEL_ART_GRADE_V23_PROFILE
        .visualOnly,
      true
    );

    assert.equal(
      CLASSROOM_PIXEL_ART_GRADE_V23_PROFILE
        .deterministic,
      true
    );
  }
);

test(
  "V23 keeps reference palette anchors",
  () => {
    assert.equal(
      CLASSROOM_PIXEL_ART_GRADE_V23_PALETTE
        .ink,
      0x070414
    );

    assert.equal(
      CLASSROOM_PIXEL_ART_GRADE_V23_PALETTE
        .cyan,
      0x3fa0c7
    );

    assert.equal(
      CLASSROOM_PIXEL_ART_GRADE_V23_PALETTE
        .warmClay,
      0xcf8a6b
    );

    assert.equal(
      CLASSROOM_PIXEL_ART_GRADE_V23_PALETTE
        .cream,
      0xf9efcb
    );
  }
);

test(
  "V23 shader keeps posterization dithering split tone ink edges and output conversion",
  () => {
    const shader =
      createPixelArtGradeShaderV23();

    for (
      const token
      of [
        "bayer4",
        "posterize",
        "applyReferenceSplitTone",
        "detectInkEdge",
        "colorspace_fragment"
      ]
    ) {
      assert.equal(
        shader.fragmentShader.includes(
          token
        ),
        true,
        token
      );
    }
  }
);

test(
  "V23 preserves canonical renderer seam between begin and present",
  () => {
    const world =
      readSource(
        "ClassroomWorld.jsx"
      );

    const begin =
      world.indexOf(
        "classroomPixelArtGradeV23.beginFrame();"
      );

    const canonicalRender =
      world.indexOf(
        "renderer.render(scene, camera);"
      );

    const present =
      world.indexOf(
        "classroomPixelArtGradeV23.presentFrame();"
      );

    assert.equal(
      begin >= 0,
      true
    );

    assert.equal(
      canonicalRender >= 0,
      true
    );

    assert.equal(
      present >= 0,
      true
    );

    assert.equal(
      begin <
        canonicalRender,
      true
    );

    assert.equal(
      canonicalRender <
        present,
      true
    );

    assert.equal(
      countMatches(
        world,
        /renderer\.render\s*\(\s*scene\s*,\s*camera\s*\)/gu
      ),
      1
    );
  }
);

test(
  "V23 has one construction and one disposal contract",
  () => {
    const world =
      readSource(
        "ClassroomWorld.jsx"
      );

    assert.equal(
      countMatches(
        world,
        /createClassroomPixelArtGradeV23\s*\(\{/gu
      ),
      1
    );

    assert.equal(
      countMatches(
        world,
        /classroomPixelArtGradeV23\.dispose\s*\(\s*\)/gu
      ),
      1
    );

    assert.equal(
      countMatches(
        world,
        /classroomPixelArtGradeV23\.beginFrame\s*\(\s*\)/gu
      ),
      1
    );

    assert.equal(
      countMatches(
        world,
        /classroomPixelArtGradeV23\.presentFrame\s*\(\s*\)/gu
      ),
      1
    );
  }
);

test(
  "V23 explicitly preserves multi-pass renderer observability",
  () => {
    const source =
      readSource(
        "classroomPixelArtGradeV23.js"
      );

    assert.equal(
      source.includes(
        "renderer.info.autoReset ="
      ),
      true
    );

    assert.equal(
      source.includes(
        "renderer.info.reset();"
      ),
      true
    );

    assert.equal(
      source.includes(
        "previousInfoAutoReset"
      ),
      true
    );
  }
);

test(
  "V23 keeps nearest low-resolution post-process sampling",
  () => {
    const source =
      readSource(
        "classroomPixelArtGradeV23.js"
      );

    assert.equal(
      /THREE\.NearestFilter/gu.test(
        source
      ),
      true
    );

    assert.equal(
      /LinearFilter/gu.test(
        source
      ),
      false
    );

    assert.equal(
      source.includes(
        "generateMipmaps ="
      ),
      true
    );
  }
);

test(
  "V23 does not acquire gameplay audio or intervention authority",
  () => {
    const source =
      readSource(
        "classroomPixelArtGradeV23.js"
      );

    for (
      const forbidden
      of [
        /addEventListener\s*\(/gu,
        /PointerLockControls/gu,
        /Raycaster/gu,
        /AudioListener/gu,
        /emitTeacherInterventionCommand/gu,
        /Math\.random/gu
      ]
    ) {
      assert.equal(
        forbidden.test(
          source
        ),
        false
      );
    }
  }
);

test(
  "V23 profile copy cannot mutate canonical palette",
  () => {
    const profile =
      getPixelArtGradeV23Profile();

    profile.palette.ink =
      0xffffff;

    assert.equal(
      CLASSROOM_PIXEL_ART_GRADE_V23_PALETTE
        .ink,
      0x070414
    );
  }
);
