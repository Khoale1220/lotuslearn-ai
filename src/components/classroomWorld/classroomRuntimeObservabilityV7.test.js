import assert from "node:assert/strict";

import {
  describe,
  it
} from "node:test";

import {
  auditSceneGraph,
  createClassroomRuntimeObservabilityV7,
  percentile,
  pushBoundedSample,
  snapshotRendererInfo,
  summarizeFrameTimes
} from "./classroomRuntimeObservabilityV7.js";

describe(
  "CW06 Runtime Observability V7",
  () => {
    it(
      "maintains a bounded frame-time buffer",
      () => {
        const samples = [];

        for (
          let value = 1;
          value <= 6;
          value += 1
        ) {
          pushBoundedSample({
            samples,
            value,
            capacity: 3
          });
        }

        assert.deepEqual(
          samples,
          [
            4,
            5,
            6
          ]
        );
      }
    );

    it(
      "computes deterministic percentiles",
      () => {
        assert.equal(
          percentile(
            [
              10,
              20,
              30,
              40
            ],
            0.5
          ),
          25
        );

        assert.equal(
          percentile(
            [
              10,
              20,
              30,
              40
            ],
            1
          ),
          40
        );
      }
    );

    it(
      "summarizes frame timing",
      () => {
        const summary =
          summarizeFrameTimes(
            [
              16,
              16,
              17,
              40,
              60
            ]
          );

        assert.equal(
          summary.count,
          5
        );

        assert.ok(
          summary.averageMs >
          0
        );

        assert.ok(
          summary.p95Ms >=
          summary.p50Ms
        );

        assert.equal(
          summary.longFrameCount,
          2
        );

        assert.equal(
          summary.severeFrameCount,
          1
        );
      }
    );

    it(
      "snapshots renderer.info without mutation",
      () => {
        const renderer = {
          info: {
            render: {
              frame: 9,
              calls: 17,
              triangles: 321,
              points: 4,
              lines: 5
            },

            memory: {
              geometries: 22,
              textures: 11
            },

            programs: [
              {},
              {},
              {}
            ]
          }
        };

        assert.deepEqual(
          snapshotRendererInfo(
            renderer
          ),
          {
            frame: 9,
            calls: 17,
            triangles: 321,
            points: 4,
            lines: 5,
            geometries: 22,
            textures: 11,
            programs: 3
          }
        );
      }
    );

    it(
      "audits scene transforms and interaction objects",
      () => {
        const objects = [
          {
            name: "root",
            visible: true,
            isMesh: false,
            position: {
              x: 0,
              y: 0,
              z: 0
            },
            rotation: {
              x: 0,
              y: 0,
              z: 0
            },
            scale: {
              x: 1,
              y: 1,
              z: 1
            },
            userData: {}
          },
          {
            name: "shade",
            visible: true,
            isMesh: true,
            position: {
              x: 0,
              y: 1,
              z: 0
            },
            rotation: {
              x: 0,
              y: 0,
              z: 0
            },
            scale: {
              x: 1,
              y: 1,
              z: 1
            },
            userData: {
              interactionType:
                "window-shade"
            }
          },
          {
            name: "bad-transform",
            visible: false,
            isMesh: true,
            position: {
              x: Number.NaN,
              y: 0,
              z: 0
            },
            rotation: {
              x: 0,
              y: 0,
              z: 0
            },
            scale: {
              x: 1,
              y: 1,
              z: 1
            },
            userData: {}
          }
        ];

        const scene = {
          traverse(
            callback
          ) {
            for (
              const object
              of objects
            ) {
              callback(
                object
              );
            }
          }
        };

        const audit =
          auditSceneGraph(
            scene
          );

        assert.equal(
          audit.objectCount,
          3
        );

        assert.equal(
          audit.meshCount,
          2
        );

        assert.equal(
          audit.interactiveObjectCount,
          1
        );

        assert.equal(
          audit.invalidTransformCount,
          1
        );

        assert.equal(
          audit
            .interactionTypeCounts[
              "window-shade"
            ],
          1
        );
      }
    );

    it(
      "records bounded delta-time evidence",
      () => {
        const renderer = {
          info: {
            render: {
              frame: 1,
              calls: 2,
              triangles: 3,
              points: 0,
              lines: 0
            },

            memory: {
              geometries: 4,
              textures: 5
            },

            programs: []
          }
        };

        const scene = {
          traverse(
            callback
          ) {
            callback({
              name: "scene",
              visible: true,
              isMesh: false,
              position: {
                x: 0,
                y: 0,
                z: 0
              },
              rotation: {
                x: 0,
                y: 0,
                z: 0
              },
              scale: {
                x: 1,
                y: 1,
                z: 1
              },
              userData: {}
            });
          }
        };

        const monitor =
          createClassroomRuntimeObservabilityV7({
            renderer,
            scene,

            profile: {
              sampleCapacity: 3,
              auditEveryFrames: 2,
              snapshotEveryFrames: 99,
              maximumRecordedDeltaMs: 50,
              longFrameThresholdMs: 33,
              severeFrameThresholdMs: 50,
              eventName: "unused"
            }
          });

        monitor.observeFrame({
          timestamp: 100
        });

        monitor.observeFrame({
          timestamp: 116
        });

        monitor.observeFrame({
          timestamp: 132
        });

        const snapshot =
          monitor.getSnapshot();

        assert.equal(
          snapshot.frameCount,
          3
        );

        assert.equal(
          snapshot.frameTiming.count,
          2
        );

        assert.equal(
          snapshot.frameTiming.p50Ms,
          16
        );

        monitor.dispose();
      }
    );
  }
);