import assert from "node:assert/strict";

import {
  describe,
  it
} from "node:test";

import {
  captureTeacherInterventionFeedbackTargetV53,
  createClassroomInterventionFeedbackV53
} from "./classroomInterventionFeedbackV53.js";


const student =
  Object.freeze({
    studentKey:
      "student-007",

    safeLabel:
      "STUDENT 07"
  });


describe(
  "CW07 V53 intervention feedback",
  () => {
    it(
      "captures only safe presentation identity",
      () => {
        const target =
          captureTeacherInterventionFeedbackTargetV53(
            student
          );

        assert.deepEqual(
          target,
          {
            studentKey:
              "student-007",

            label:
              "STUDENT 07"
          }
        );

        assert.equal(
          Object.isFrozen(
            target
          ),
          true
        );
      }
    );


    it(
      "projects pending feedback for the matching student",
      () => {
        const feedback =
          createClassroomInterventionFeedbackV53({
            status: {
              phase:
                "pending",

              message:
                "SAVING INTERVENTION..."
            },

            selectedStudent:
              student,

            target:
              captureTeacherInterventionFeedbackTargetV53(
                student
              )
          });

        assert.equal(
          feedback.phase,
          "pending"
        );

        assert.equal(
          feedback.studentKey,
          "student-007"
        );

        assert.equal(
          feedback.title,
          "INTERVENTION IN PROGRESS"
        );

        assert.equal(
          feedback.buttonLabel,
          "SAVING..."
        );

        assert.equal(
          feedback.role,
          "status"
        );
      }
    );


    it(
      "projects an explicit success acknowledgement",
      () => {
        const feedback =
          createClassroomInterventionFeedbackV53({
            status: {
              phase:
                "success",

              message:
                "INTERVENTION SAVED"
            },

            selectedStudent:
              student,

            target:
              captureTeacherInterventionFeedbackTargetV53(
                student
              )
          });

        assert.equal(
          feedback.title,
          "INTERVENTION APPLIED"
        );

        assert.equal(
          feedback.buttonLabel,
          "APPLIED"
        );
      }
    );


    it(
      "uses assertive feedback for conflict and error outcomes",
      () => {
        for (
          const [
            phase,
            expectedTitle
          ]
          of [
            [
              "conflict",
              "INTERVENTION NEEDS REVIEW"
            ],

            [
              "error",
              "INTERVENTION FAILED"
            ]
          ]
        ) {
          const feedback =
            createClassroomInterventionFeedbackV53({
              status: {
                phase
              },

              selectedStudent:
                student,

              target:
                captureTeacherInterventionFeedbackTargetV53(
                  student
                )
            });

          assert.equal(
            feedback.role,
            "alert"
          );

          assert.equal(
            feedback.ariaLive,
            "assertive"
          );

          assert.equal(
            feedback.title,
            expectedTitle
          );
        }
      }
    );


    it(
      "never leaks a previous intervention onto another student",
      () => {
        const feedback =
          createClassroomInterventionFeedbackV53({
            status: {
              phase:
                "success",

              message:
                "INTERVENTION SAVED"
            },

            selectedStudent: {
              studentKey:
                "student-008",

              safeLabel:
                "STUDENT 08"
            },

            target:
              captureTeacherInterventionFeedbackTargetV53(
                student
              )
          });

        assert.equal(
          feedback,
          null
        );
      }
    );


    it(
      "does not create feedback for idle state",
      () => {
        const feedback =
          createClassroomInterventionFeedbackV53({
            status: {
              phase:
                "idle"
            },

            selectedStudent:
              student,

            target:
              captureTeacherInterventionFeedbackTargetV53(
                student
              )
          });

        assert.equal(
          feedback,
          null
        );
      }
    );
  }
);