import assert from "node:assert/strict";

import {
  describe,
  it
} from "node:test";

import {
  CLASSROOM_INTERACTION_MODE,
  deriveClassroomInteractionStateV54
} from "./classroomInteractionStateV54.js";


const student =
  Object.freeze({
    studentKey:
      "student-007"
  });


describe(
  "CW07 V54 classroom interaction state",
  () => {
    it(
      "gives ENTRY_GATE absolute precedence",
      () => {
        const state =
          deriveClassroomInteractionStateV54({
            hasEntered:
              false,

            isLocked:
              true,

            selectedStudent:
              student,

            interventionFeedback: {
              phase:
                "success"
            }
          });

        assert.equal(
          state.mode,
          CLASSROOM_INTERACTION_MODE
            .ENTRY_GATE
        );

        assert.equal(
          state.showEntryGate,
          true
        );

        assert.equal(
          state.showStudentHud,
          false
        );

        assert.equal(
          state.canMove,
          false
        );

        assert.equal(
          state.canAcquirePointerLock,
          false
        );
      }
    );


    it(
      "derives PLAYING_UNLOCKED after entry",
      () => {
        const state =
          deriveClassroomInteractionStateV54({
            hasEntered:
              true,

            isLocked:
              false
          });

        assert.equal(
          state.mode,
          CLASSROOM_INTERACTION_MODE
            .PLAYING_UNLOCKED
        );

        assert.equal(
          state.canAcquirePointerLock,
          true
        );

        assert.equal(
          state.canMove,
          false
        );
      }
    );


    it(
      "derives PLAYING_LOCKED from pointer lock",
      () => {
        const state =
          deriveClassroomInteractionStateV54({
            hasEntered:
              true,

            isLocked:
              true
          });

        assert.equal(
          state.mode,
          CLASSROOM_INTERACTION_MODE
            .PLAYING_LOCKED
        );

        assert.equal(
          state.canMove,
          true
        );

        assert.equal(
          state.canInspectStudent,
          true
        );

        assert.equal(
          state.canAcquirePointerLock,
          false
        );
      }
    );


    it(
      "student inspection overrides playing state",
      () => {
        const state =
          deriveClassroomInteractionStateV54({
            hasEntered:
              true,

            isLocked:
              false,

            selectedStudent:
              student
          });

        assert.equal(
          state.mode,
          CLASSROOM_INTERACTION_MODE
            .INSPECTING_STUDENT
        );

        assert.equal(
          state.showStudentHud,
          true
        );

        assert.equal(
          state.canMove,
          false
        );

        assert.equal(
          state.canAcquirePointerLock,
          false
        );

        assert.equal(
          state.escapeClosesHud,
          true
        );
      }
    );


    it(
      "maps intervention phases deterministically",
      () => {
        const cases = [
          [
            "pending",
            CLASSROOM_INTERACTION_MODE
              .INTERVENTION_PENDING
          ],

          [
            "success",
            CLASSROOM_INTERACTION_MODE
              .INTERVENTION_SUCCESS
          ],

          [
            "conflict",
            CLASSROOM_INTERACTION_MODE
              .INTERVENTION_CONFLICT
          ],

          [
            "error",
            CLASSROOM_INTERACTION_MODE
              .INTERVENTION_ERROR
          ]
        ];

        for (
          const [
            phase,
            expected
          ]
          of cases
        ) {
          const state =
            deriveClassroomInteractionStateV54({
              hasEntered:
                true,

              selectedStudent:
                student,

              interventionFeedback: {
                phase
              }
            });

          assert.equal(
            state.mode,
            expected
          );

          assert.equal(
            state.showStudentHud,
            true
          );

          assert.equal(
            state.canMove,
            false
          );
        }
      }
    );


    it(
      "unknown feedback never invents a new runtime state",
      () => {
        const state =
          deriveClassroomInteractionStateV54({
            hasEntered:
              true,

            selectedStudent:
              student,

            interventionFeedback: {
              phase:
                "mystery"
            }
          });

        assert.equal(
          state.mode,
          CLASSROOM_INTERACTION_MODE
            .INSPECTING_STUDENT
        );

        assert.equal(
          state.feedbackPhase,
          null
        );
      }
    );


    it(
      "returns an immutable state snapshot",
      () => {
        const state =
          deriveClassroomInteractionStateV54({
            hasEntered:
              true
          });

        assert.equal(
          Object.isFrozen(
            state
          ),
          true
        );
      }
    );
  }
);