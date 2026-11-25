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

function findFunctionRange(
  source,
  marker
) {
  const start =
    source.indexOf(marker);

  assert.notEqual(
    start,
    -1,
    `missing function ${marker}`
  );

  const paramsOpen =
    source.indexOf(
      "(",
      start
    );

  assert.notEqual(
    paramsOpen,
    -1,
    `missing params for ${marker}`
  );

  let paramsDepth = 0;
  let paramsClose = -1;

  for (
    let index = paramsOpen;
    index < source.length;
    index += 1
  ) {
    if (source[index] === "(") {
      paramsDepth += 1;
    }

    if (source[index] === ")") {
      paramsDepth -= 1;

      if (paramsDepth === 0) {
        paramsClose = index;
        break;
      }
    }
  }

  assert.notEqual(
    paramsClose,
    -1,
    `unbalanced params for ${marker}`
  );

  const bodyOpen =
    source.indexOf(
      "{",
      paramsClose + 1
    );

  assert.notEqual(
    bodyOpen,
    -1,
    `missing body for ${marker}`
  );

  let braceDepth = 0;

  for (
    let index = bodyOpen;
    index < source.length;
    index += 1
  ) {
    if (source[index] === "{") {
      braceDepth += 1;
    }

    if (source[index] === "}") {
      braceDepth -= 1;

      if (braceDepth === 0) {
        return {
          start,
          end:
            index + 1
        };
      }
    }
  }

  assert.fail(
    `unbalanced body for ${marker}`
  );
}

function extractFunction(
  source,
  marker
) {
  const range =
    findFunctionRange(
      source,
      marker
    );

  return source.slice(
    range.start,
    range.end
  );
}

const retro =
  read(
    "classroomRetroFpsPipeline.js"
  );

const v24 =
  read(
    "classroomReferenceWorldArtV24.js"
  );

const composition =
  read(
    "classroomRetroCompositionV4.js"
  );

const v64 =
  read(
    "classroom64BitVisualUpgrade.js"
  );


test(
  "CW08 P2B V64 owns canonical shared material response",
  () => {
    assert.match(
      v64,
      /material\.roughness\s*=/
    );

    assert.match(
      v64,
      /material\.metalness\s*=/
    );

    assert.match(
      v64,
      /material\.flatShading\s*=\s*false/
    );

    assert.match(
      v64,
      /material\.needsUpdate\s*=\s*true/
    );
  }
);


test(
  "CW08 P2B Retro FPS owns presentation sampling but not PBR surfaces",
  () => {
    assert.match(
      retro,
      /applyRetroTextureSampling/
    );

    assert.match(
      retro,
      /THREE\.NearestFilter/
    );

    assert.doesNotMatch(
      retro,
      /material\.flatShading\s*=/
    );

    assert.doesNotMatch(
      retro,
      /material\.roughness\s*=/
    );

    assert.doesNotMatch(
      retro,
      /material\.metalness\s*=/
    );

    assert.doesNotMatch(
      retro,
      /material\.transmission\s*=/
    );

    assert.doesNotMatch(
      retro,
      /material\.clearcoat\s*=/
    );

    assert.doesNotMatch(
      retro,
      /material\.clearcoatRoughness\s*=/
    );
  }
);


test(
  "CW08 P2B V24 owns semantic color but not PBR surfaces",
  () => {
    assert.match(
      v24,
      /material\.color\.lerp/
    );

    assert.match(
      v24,
      /state\.material\.color\.copy/
    );

    assert.doesNotMatch(
      v24,
      /material\.roughness\s*=/
    );

    assert.doesNotMatch(
      v24,
      /material\.metalness\s*=/
    );

    assert.doesNotMatch(
      v24,
      /state\.roughness\s*!==/
    );

    assert.doesNotMatch(
      v24,
      /state\.metalness\s*!==/
    );
  }
);


test(
  "CW08 P2B Retro Composition keeps compatibility state without shared material authority",
  () => {
    assert.match(
      composition,
      /const\s+sharedMaterialStates\s*=/
    );

    assert.doesNotMatch(
      composition,
      /sharedMaterialStates\s*\.\s*push\s*\(/
    );

    assert.doesNotMatch(
      composition,
      /\bof\s+sharedMaterialStates\b/
    );

    const override =
      extractFunction(
        composition,
        "function overrideSharedMaterial("
      );

    assert.doesNotMatch(
      override,
      /material\.map\s*=/
    );

    assert.doesNotMatch(
      override,
      /material\.flatShading\s*=/
    );

    assert.doesNotMatch(
      override,
      /material\.roughness\s*=/
    );

    assert.doesNotMatch(
      override,
      /material\.metalness\s*=/
    );
  }
);


test(
  "CW08 P2B authority split preserves each visual responsibility",
  () => {
    assert.match(
      retro,
      /applyRetroTextureSampling/
    );

    assert.match(
      v24,
      /classifyReferenceWorldRoleV24/
    );

    assert.match(
      composition,
      /createRetroMaterialTextureSet/
    );

    assert.match(
      v64,
      /material\.roughness\s*=/
    );
  }
);