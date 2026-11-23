import test from "node:test";
import assert from "node:assert/strict";

import {
  createStudentIntelligenceBridge
} from "./studentIntelligenceBridge.js";

test("CW05 A2.3.2C1B1 student intelligence bridge", async (t) => {
  await t.test(
    "creates an empty deterministic runtime store from an empty sanitized analysis",
    () => {
      const store = createStudentIntelligenceBridge({
        observations: [],
        misconceptionClusters: [],
        interventions: [],
        analysisVersion: "cw05-bridge-test",
        sourceType: "test"
      });

      assert.equal(store.size, 0);
      assert.equal(store.has("missing-student"), false);
      assert.equal(store.get("missing-student"), null);
    }
  );

  await t.test(
    "preserves runtime fail-closed behavior for unknown student keys",
    () => {
      const store = createStudentIntelligenceBridge({
        observations: [],
        misconceptionClusters: [],
        interventions: [],
        analysisVersion: "cw05-bridge-test",
        sourceType: "test"
      });

      assert.throws(
        () => store.requireStudent("missing-student"),
        /missing-student|student/i
      );
    }
  );

  await t.test(
    "returns the established immutable runtime-store interface",
    () => {
      const store = createStudentIntelligenceBridge({
        observations: [],
        misconceptionClusters: [],
        interventions: [],
        analysisVersion: "cw05-bridge-test",
        sourceType: "test"
      });

      assert.equal(typeof store.has, "function");
      assert.equal(typeof store.get, "function");
      assert.equal(typeof store.requireStudent, "function");
      assert.equal(typeof store.keys, "function");
      assert.equal(typeof store.snapshot, "function");

      assert.ok(Object.isFrozen(store));
    }
  );
});