import assert from "node:assert/strict";

import {
  describe,
  it
} from "node:test";

import * as THREE from "three";

import {
  getExteriorDepthConfig
} from "./classroomExteriorDepthV2.js";

import {
  resolveStudentTargetFromObject
} from "./classroomInteractionFeedbackV2.js";

import {
  DEFAULT_CLASSROOM_PERFORMANCE_BUDGET,
  createClassroomPerformanceBudget
} from "./classroomPerformanceBudget.js";

describe(
  "CW06 final classroom polish",
  () => {
    it(
      "defines three deterministic parallax layers",
      () => {
        const config =
          getExteriorDepthConfig();

        assert.equal(
          config.layers.length,
          3
        );

        assert.deepEqual(
          config.layers.map(
            (layer) =>
              layer.name
          ),

          [
            "mountains",
            "campus",
            "foliage"
          ]
        );

        assert.ok(
          config.layers[0]
            .parallax <
          config.layers[1]
            .parallax
        );

        assert.ok(
          config.layers[1]
            .parallax <
          config.layers[2]
            .parallax
        );
      }
    );

    it(
      "resolves student interaction targets through descendants",
      () => {
        const scene =
          new THREE.Scene();

        const student =
          new THREE.Group();

        student.name =
          "student-alpha";

        const body =
          new THREE.Mesh(
            new THREE.BoxGeometry(
              1,
              1,
              1
            ),

            new THREE.MeshBasicMaterial()
          );

        student.add(
          body
        );

        scene.add(
          student
        );

        const target =
          resolveStudentTargetFromObject(
            body
          );

        assert.ok(
          target
        );

        assert.equal(
          target.identity,
          "student-alpha"
        );

        assert.equal(
          target.anchor,
          student
        );

        body.geometry.dispose();
        body.material.dispose();
      }
    );

    it(
      "rejects visual decoration as an interaction authority",
      () => {
        const decoration =
          new THREE.Mesh(
            new THREE.BoxGeometry(
              1,
              1,
              1
            ),

            new THREE.MeshBasicMaterial()
          );

        decoration.userData
          .studentVisualV2Decoration =
            true;

        assert.equal(
          resolveStudentTargetFromObject(
            decoration
          ),
          null
        );

        decoration.geometry.dispose();
        decoration.material.dispose();
      }
    );

    it(
      "caps existing pixel ratio and reports renderer budget",
      () => {
        let pixelRatio =
          2.5;

        const renderer = {
          info: {
            render: {
              calls: 120,
              triangles: 90000
            },

            memory: {
              geometries: 140,
              textures: 40
            }
          },

          getPixelRatio() {
            return pixelRatio;
          },

          setPixelRatio(
            value
          ) {
            pixelRatio =
              value;
          }
        };

        const monitor =
          createClassroomPerformanceBudget({
            renderer,
            sampleIntervalFrames: 1
          });

        assert.equal(
          pixelRatio,
          1.5
        );

        const snapshot =
          monitor.sample();

        assert.equal(
          snapshot.healthy,
          true
        );

        assert.ok(
          snapshot.drawCalls <
          DEFAULT_CLASSROOM_PERFORMANCE_BUDGET
            .drawCalls
        );

        monitor.dispose();

        assert.equal(
          pixelRatio,
          2.5
        );
      }
    );

    it(
      "flags budget violations without crashing runtime",
      () => {
        const renderer = {
          info: {
            render: {
              calls: 999,
              triangles: 999999
            },

            memory: {
              geometries: 999,
              textures: 999
            }
          }
        };

        const monitor =
          createClassroomPerformanceBudget({
            renderer,
            sampleIntervalFrames: 1
          });

        const snapshot =
          monitor.sample();

        assert.equal(
          snapshot.healthy,
          false
        );

        assert.equal(
          snapshot
            .overBudget
            .drawCalls,
          true
        );

        monitor.dispose();
      }
    );
  }
);