import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("./", import.meta.url);

function source(name) {
  return fs.readFileSync(
    new URL(name, root),
    "utf8"
  );
}

test(
  "CW08.3B V35 owns atmosphere mutation",
  () => {
    const text =
      source(
        "classroomDepthAtmospherePixelLightingV35.js"
      );

    assert.match(
      text,
      /scene\.fog\.color\.setHex\s*\(/
    );

    assert.match(
      text,
      /scene\.fog\.near\s*=/
    );

    assert.match(
      text,
      /scene\.fog\.far\s*=/
    );

    assert.match(
      text,
      /scene\.background\.copy\s*\(/
    );
  }
);

test(
  "CW08.3B V24 has zero global atmosphere writes",
  () => {
    const text =
      source(
        "classroomReferenceWorldArtV24.js"
      );

    assert.doesNotMatch(
      text,
      /scene\.background\.(?:setHex|copy)\s*\(/
    );

    assert.doesNotMatch(
      text,
      /scene\.fog\.color\.(?:setHex|copy)\s*\(/
    );
  }
);

test(
  "CW08.3B VisualSystem owns renderer output",
  () => {
    const text =
      source(
        "classroomVisualSystem.js"
      );

    assert.match(
      text,
      /renderer\.outputColorSpace\s*=/
    );

    assert.match(
      text,
      /renderer\.toneMapping\s*=/
    );

    assert.match(
      text,
      /renderer\.toneMappingExposure\s*=/
    );

    assert.doesNotMatch(
      text,
      /scene\.background\s*=/
    );

    assert.doesNotMatch(
      text,
      /scene\.fog\s*=/
    );
  }
);

test(
  "CW08.3B 64-bit layer does not own exposure",
  () => {
    const text =
      source(
        "classroom64BitVisualUpgrade.js"
      );

    assert.doesNotMatch(
      text,
      /renderer\.toneMappingExposure\s*=/
    );
  }
);

test(
  "CW08.3B Retro FPS does not own tone mapping",
  () => {
    const text =
      source(
        "classroomRetroFpsPipeline.js"
      );

    assert.doesNotMatch(
      text,
      /renderer\.toneMapping\s*=/
    );

    assert.doesNotMatch(
      text,
      /renderer\.toneMappingExposure\s*=/
    );
  }
);

test(
  "CW08.3B ClassroomWorld delegates output colorspace",
  () => {
    const text =
      source(
        "ClassroomWorld.jsx"
      );

    assert.doesNotMatch(
      text,
      /renderer\.outputColorSpace\s*=/
    );
  }
);
