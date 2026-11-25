import {
  spawn
} from "node:child_process";

import {
  randomUUID
} from "node:crypto";

import fs from "node:fs";

import os from "node:os";

import path from "node:path";

import {
  pathToFileURL
} from "node:url";

import {
  CdpClient,
  allocatePort,
  buildSnapshotExpression,
  findBrowserBinary,
  parseArgs,
  sleep,
  validateAcceptanceResultV56,
  waitForCondition,
  waitForDevTools,
  waitForPageTarget
} from "./probe_classroom_runtime_acceptance.js";


const MODE =
  Object.freeze({
    ENTRY_GATE:
      "ENTRY_GATE",

    PLAYING_UNLOCKED:
      "PLAYING_UNLOCKED",

    PLAYING_LOCKED:
      "PLAYING_LOCKED"
  });


function buildTextControlCenterExpression(
  pattern
) {
  return `(() => {
    const matcher =
      new RegExp(
        ${JSON.stringify(pattern)},
        "i"
      );

    const interactive =
      [
        ...document.querySelectorAll(
          'button, a, [role="button"], [tabindex]'
        )
      ];

    let target =
      interactive.find(
        (element) =>
          matcher.test(
            (
              element.textContent ??
              ""
            ).trim()
          )
      );

    if (!target) {
      const leaf =
        [
          ...document.querySelectorAll(
            "body *"
          )
        ].find(
          (element) =>
            element.children.length ===
              0 &&
            matcher.test(
              (
                element.textContent ??
                ""
              ).trim()
            )
        );

      target =
        leaf?.closest?.(
          'button, a, [role="button"], [tabindex]'
        ) ??
        leaf ??
        null;
    }

    if (!target) {
      return {
        found:
          false
      };
    }

    const rect =
      target.getBoundingClientRect();

    if (
      rect.width <= 0 ||
      rect.height <= 0
    ) {
      return {
        found:
          false,
        reason:
          "zero-size"
      };
    }

    return {
      found:
        true,

      x:
        rect.left +
        rect.width / 2,

      y:
        rect.top +
        rect.height / 2,

      label:
        (
          target.textContent ??
          ""
        ).trim(),

      tag:
        target.tagName
    };
  })()`;
}


function buildViewportCenterExpression() {
  return `(() => {
    const target =
      document.querySelector(
        ".cw-world__viewport"
      );

    if (!target) {
      return {
        found:
          false
      };
    }

    const rect =
      target.getBoundingClientRect();

    if (
      rect.width <= 0 ||
      rect.height <= 0
    ) {
      return {
        found:
          false,
        reason:
          "zero-size"
      };
    }

    return {
      found:
        true,

      x:
        rect.left +
        rect.width / 2,

      y:
        rect.top +
        rect.height / 2
    };
  })()`;
}


function buildPointerLockCapabilityExpression() {
  return `(() =>
    new Promise(
      (resolve) => {
        const target =
          document.querySelector(
            ".cw-world__viewport canvas"
          ) ??
          document.querySelector(
            "canvas"
          );

        if (!target) {
          resolve({
            supported:
              false,

            locked:
              false,

            event:
              "canvas-missing"
          });

          return;
        }

        if (
          typeof target.requestPointerLock !==
            "function"
        ) {
          resolve({
            supported:
              false,

            locked:
              false,

            event:
              "requestPointerLock-missing"
          });

          return;
        }

        let settled =
          false;

        let timeout =
          null;


        function cleanup() {
          document.removeEventListener(
            "pointerlockchange",
            onChange
          );

          document.removeEventListener(
            "pointerlockerror",
            onError
          );
        }


        function finish(
          payload
        ) {
          if (settled) {
            return;
          }

          settled =
            true;

          if (timeout !== null) {
            clearTimeout(
              timeout
            );
          }

          cleanup();

          resolve({
            supported:
              true,

            ...payload,

            pointerLockElement:
              document.pointerLockElement ===
              target,

            userActivation: {
              isActive:
                navigator.userActivation
                  ?.isActive ??
                null,

              hasBeenActive:
                navigator.userActivation
                  ?.hasBeenActive ??
                null
            }
          });
        }


        function onChange() {
          finish({
            locked:
              document.pointerLockElement ===
              target,

            event:
              "pointerlockchange"
          });
        }


        function onError() {
          finish({
            locked:
              false,

            event:
              "pointerlockerror"
          });
        }


        document.addEventListener(
          "pointerlockchange",
          onChange
        );

        document.addEventListener(
          "pointerlockerror",
          onError
        );


        timeout =
          setTimeout(
            () => {
              finish({
                locked:
                  document.pointerLockElement ===
                  target,

                event:
                  "timeout"
              });
            },
            1500
          );


        try {
          const request =
            target.requestPointerLock();

          if (
            request &&
            typeof request.catch ===
              "function"
          ) {
            request.catch(
              (error) => {
                finish({
                  locked:
                    false,

                  event:
                    "promise-rejection",

                  error:
                    String(
                      error?.message ??
                      error
                    )
                });
              }
            );
          }
        } catch (error) {
          finish({
            locked:
              false,

            event:
              "exception",

            error:
              String(
                error?.message ??
                error
              )
          });
        }
      }
    )
  )()`;
}


async function probePointerLockCapability(
  client
) {
  return client.evaluate(
    buildPointerLockCapabilityExpression(),
    {
      awaitPromise:
        true,

      userGesture:
        true
    }
  );
}


async function acquirePointerLockForMatrix({
  client,
  label
}) {
  await clickViewport(
    client
  );

  try {
    const snapshot =
      await waitForAcceptanceMode({
        client,

        modes: [
          MODE.PLAYING_LOCKED
        ],

        timeoutMs:
          1600,

        label:
          `${label}_CDP_CLICK`
      });

    return {
      snapshot,

      path:
        "cdp-mouse-click",

      capability:
        null
    };
  } catch {
    console.log(
      `${label}_CDP_CLICK_POINTER_LOCK=NOT_OBSERVED`
    );
  }


  const capability =
    await probePointerLockCapability(
      client
    );

  console.log(
    `${label}_DIRECT_CAPABILITY=${JSON.stringify(capability)}`
  );


  if (
    capability?.locked ===
      true
  ) {
    const snapshot =
      await waitForAcceptanceMode({
        client,

        modes: [
          MODE.PLAYING_LOCKED
        ],

        timeoutMs:
          3000,

        label:
          `${label}_DIRECT_POINTER_LOCK`
      });

    return {
      snapshot,

      path:
        "runtime-user-gesture",

      capability
    };
  }


  return {
    snapshot:
      null,

    path:
      "headless-unavailable",

    capability
  };
}


function createKeyEventPayload({
  type,
  key,
  code,
  windowsVirtualKeyCode
}) {
  return {
    type,
    key,
    code,
    windowsVirtualKeyCode,
    nativeVirtualKeyCode:
      windowsVirtualKeyCode
  };
}


async function dispatchRealClick(
  client,
  point
) {
  if (
    !point ||
    point.found !==
      true ||
    !Number.isFinite(
      point.x
    ) ||
    !Number.isFinite(
      point.y
    )
  ) {
    throw new Error(
      `INVALID_CLICK_TARGET=${JSON.stringify(point)}`
    );
  }

  await client.send(
    "Input.dispatchMouseEvent",
    {
      type:
        "mouseMoved",

      x:
        point.x,

      y:
        point.y
    }
  );

  await client.send(
    "Input.dispatchMouseEvent",
    {
      type:
        "mousePressed",

      x:
        point.x,

      y:
        point.y,

      button:
        "left",

      buttons:
        1,

      clickCount:
        1
    }
  );

  await client.send(
    "Input.dispatchMouseEvent",
    {
      type:
        "mouseReleased",

      x:
        point.x,

      y:
        point.y,

      button:
        "left",

      buttons:
        0,

      clickCount:
        1
    }
  );
}


async function dispatchRealKey({
  client,
  key,
  code,
  windowsVirtualKeyCode,
  holdMs =
    80
}) {
  await client.send(
    "Input.dispatchKeyEvent",
    createKeyEventPayload({
      type:
        "keyDown",

      key,
      code,
      windowsVirtualKeyCode
    })
  );

  if (
    holdMs >
    0
  ) {
    await sleep(
      holdMs
    );
  }

  await client.send(
    "Input.dispatchKeyEvent",
    createKeyEventPayload({
      type:
        "keyUp",

      key,
      code,
      windowsVirtualKeyCode
    })
  );
}


async function readAcceptanceSnapshot(
  client
) {
  const result =
    await client.evaluate(
      buildSnapshotExpression(),
      {
        awaitPromise:
          true,
        userGesture:
          false
      }
    );

  const summary =
    validateAcceptanceResultV56(
      result
    );

  return {
    result,
    summary
  };
}


async function waitForAcceptanceMode({
  client,
  modes,
  timeoutMs =
    10000,
  label
}) {
  const accepted =
    new Set(
      modes
    );

  const deadline =
    Date.now() +
    timeoutMs;

  let latest =
    null;

  while (
    Date.now() <
    deadline
  ) {
    latest =
      await readAcceptanceSnapshot(
        client
      );

    if (
      accepted.has(
        latest
          .summary
          .interactionMode
      )
    ) {
      return latest;
    }

    await sleep(
      100
    );
  }

  throw new Error(
    `${label}=TIMEOUT latest=${
      latest
        ? JSON.stringify(
            latest.summary
          )
        : "null"
    }`
  );
}


function assertStrictlyIncreasingSequence(
  snapshots
) {
  let previous =
    0;

  for (
    const snapshot
    of snapshots
  ) {
    const sequence =
      snapshot
        .summary
        .sequence;

    if (
      !Number.isInteger(
        sequence
      ) ||
      sequence <=
        previous
    ) {
      throw new Error(
        `NON_MONOTONIC_ACCEPTANCE_SEQUENCE=${previous}->${sequence}`
      );
    }

    previous =
      sequence;
  }

  return true;
}


async function clickTextControl({
  client,
  pattern,
  label
}) {
  const point =
    await client.evaluate(
      buildTextControlCenterExpression(
        pattern
      )
    );

  if (
    !point ||
    point.found !==
      true
  ) {
    throw new Error(
      `${label}_NOT_FOUND=${JSON.stringify(point)}`
    );
  }

  await dispatchRealClick(
    client,
    point
  );

  return point;
}


async function clickViewport(
  client
) {
  const point =
    await client.evaluate(
      buildViewportCenterExpression()
    );

  if (
    !point ||
    point.found !==
      true
  ) {
    throw new Error(
      `VIEWPORT_CLICK_TARGET_NOT_FOUND=${JSON.stringify(point)}`
    );
  }

  await dispatchRealClick(
    client,
    point
  );

  return point;
}


async function main() {
  const args =
    parseArgs(
      process.argv.slice(
        2
      )
    );

  const browserBinary =
    findBrowserBinary();

  const port =
    await allocatePort();

  const profileDir =
    path.join(
      os.tmpdir(),
      `lotuslearn-cw07-state-matrix-${randomUUID()}`
    );

  fs.mkdirSync(
    profileDir,
    {
      recursive:
        true
    }
  );

  const browser =
    spawn(
      browserBinary,
      [
        "--headless",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--window-size=1440,900",
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${profileDir}`,
        "about:blank"
      ],
      {
        stdio:
          "ignore",

        windowsHide:
          true
      }
    );

  let client =
    null;

  const matrix =
    [];

  try {
    const version =
      await waitForDevTools({
        port
      });

    console.log(
      `EDGE_PROTOCOL_VERSION=${version["Protocol-Version"] ?? "unknown"}`
    );

    const target =
      await waitForPageTarget({
        port
      });

    client =
      new CdpClient(
        target
          .webSocketDebuggerUrl
      );

    await client.connect();

    await client.send(
      "Runtime.enable"
    );

    await client.send(
      "Page.enable"
    );

    const loadPromise =
      client.waitForEvent(
        "Page.loadEventFired",
        12000
      );

    await client.send(
      "Page.navigate",
      {
        url:
          args.url
      }
    );

    await loadPromise;


    /*
     * ------------------------------------------------
     * APP READY
     * ------------------------------------------------
     */

    await waitForCondition({
      client,

      label:
        "LOTUSLEARN_APP_READY",

      expression:
        `Boolean(
          document.body &&
          document.body.innerText.length > 0
        )`
    });


    /*
     * ------------------------------------------------
     * REAL CLICK: CLASSROOM WORLD NAVIGATION
     * ------------------------------------------------
     */

    const classroomControl =
      await clickTextControl({
        client,

        pattern:
          "classroom\\s+world",

        label:
          "CLASSROOM_WORLD_CONTROL"
      });

    console.log(
      `CLASSROOM_WORLD_CLICK=${JSON.stringify(classroomControl)}`
    );

    await waitForCondition({
      client,

      label:
        "CLASSROOM_WORLD_MOUNT",

      expression:
        `Boolean(
          document.querySelector(
            ".cw-world__viewport"
          ) &&
          document.querySelector(
            ".cw-world"
          )
        )`
    });


    /*
     * ------------------------------------------------
     * STATE 1: ENTRY_GATE
     * ------------------------------------------------
     */

    const entryGate =
      await waitForAcceptanceMode({
        client,

        modes: [
          MODE.ENTRY_GATE
        ],

        label:
          "STATE_ENTRY_GATE"
      });

    matrix.push(
      entryGate
    );

    console.log(
      "STATE_1_ENTRY_GATE=PASS"
    );


    /*
     * ------------------------------------------------
     * REAL CLICK: ENTER CLASSROOM
     * ------------------------------------------------
     */

    const enterControl =
      await clickTextControl({
        client,

        pattern:
          "enter\\s+classroom",

        label:
          "ENTER_CLASSROOM_CONTROL"
      });

    console.log(
      `ENTER_CLASSROOM_CLICK=${JSON.stringify(enterControl)}`
    );


    /*
     * Entry may immediately acquire pointer lock.
     * If not, PLAYING_UNLOCKED is still the correct
     * intermediate state, followed by a real viewport
     * click to acquire lock.
     */

    const afterEntry =
      await waitForAcceptanceMode({
        client,

        modes: [
          MODE.PLAYING_UNLOCKED,
          MODE.PLAYING_LOCKED
        ],

        label:
          "STATE_AFTER_ENTER"
      });

    matrix.push(
      afterEntry
    );

    console.log(
      `STATE_2_AFTER_ENTER=${afterEntry.summary.interactionMode}`
    );


    /*
     * ------------------------------------------------
     * STATE: PLAYING_LOCKED
     *
     * Headless Chromium/Edge may expose the Pointer
     * Lock API while refusing to enter lock mode.
     *
     * First try a real CDP mouse click.
     *
     * If that does not lock, issue a direct browser
     * capability probe with Runtime.evaluate
     * userGesture=true.
     *
     * If even the direct browser API cannot lock,
     * classify this as a headless capability boundary.
     * Do NOT mutate product state to manufacture PASS.
     * ------------------------------------------------
     */

    let locked =
      afterEntry;

    let initialLockPath =
      "enter-classroom";


    if (
      locked
        .summary
        .interactionMode !==
      MODE.PLAYING_LOCKED
    ) {
      const acquisition =
        await acquirePointerLockForMatrix({
          client,

          label:
            "INITIAL_POINTER_LOCK"
        });

      console.log(
        `INITIAL_POINTER_LOCK_PATH=${acquisition.path}`
      );


      if (
        !acquisition.snapshot
      ) {
        const activation =
          await client.evaluate(
            `({
              hasBeenActive:
                navigator.userActivation
                  ?.hasBeenActive ??
                null,

              isActive:
                navigator.userActivation
                  ?.isActive ??
                null,

              pointerLockElement:
                Boolean(
                  document.pointerLockElement
                ),

              requestPointerLockSupported:
                typeof Element.prototype
                  .requestPointerLock ===
                "function"
            })`
          );


        assertStrictlyIncreasingSequence(
          matrix
        );


        console.log(
          `HEADLESS_POINTER_LOCK_DIAGNOSTIC=${JSON.stringify(activation)}`
        );

        console.log("");
        console.log(
          "CW07_7B_HEADLESS_CAPABILITY_BOUNDARY=PASS"
        );

        console.log(
          "STATE_ENTRY_GATE=PASS"
        );

        console.log(
          "STATE_PLAYING_UNLOCKED=PASS"
        );

        console.log(
          "REAL_CDP_MOUSE_INPUT=PASS"
        );

        console.log(
          "V56_ACCEPTANCE_SNAPSHOT=PASS"
        );

        console.log(
          "V7_RUNTIME_OBSERVABILITY=PASS"
        );

        console.log(
          "HEADLESS_POINTER_LOCK_CAPABILITY=UNAVAILABLE"
        );

        console.log(
          "STATE_PLAYING_LOCKED=DEFERRED_TO_HEADED_AUTOMATION"
        );

        console.log(
          "REAL_WASD_LOCKED_RUNTIME=DEFERRED"
        );

        console.log(
          "PRODUCT_POINTER_LOCK_DEFECT_INFERRED=NO"
        );

        console.log(
          "PRODUCT_SOURCE_MUTATION=0"
        );

        console.log(
          "NEXT=CW07_7C_HEADED_AUTOMATED_POINTER_LOCK_MATRIX"
        );

        return;
      }


      locked =
        acquisition.snapshot;

      initialLockPath =
        acquisition.path;

      matrix.push(
        locked
      );
    }


    if (
      locked
        .summary
        .pointerLocked !==
      true
    ) {
      throw new Error(
        "PLAYING_LOCKED_WITHOUT_POINTER_LOCK"
      );
    }


    console.log(
      `STATE_PLAYING_LOCKED=PASS path=${initialLockPath}`
    );


    /*
     * ------------------------------------------------
     * REAL ESCAPE: RELEASE POINTER LOCK
     * ------------------------------------------------
     */

    await dispatchRealKey({
      client,

      key:
        "Escape",

      code:
        "Escape",

      windowsVirtualKeyCode:
        27,

      holdMs:
        30
    });

    const unlocked =
      await waitForAcceptanceMode({
        client,

        modes: [
          MODE.PLAYING_UNLOCKED
        ],

        label:
          "STATE_PLAYING_UNLOCKED"
      });

    matrix.push(
      unlocked
    );

    if (
      unlocked
        .summary
        .pointerLocked !==
      false
    ) {
      throw new Error(
        "PLAYING_UNLOCKED_POINTER_LOCK_MISMATCH"
      );
    }

    console.log(
      "STATE_PLAYING_UNLOCKED=PASS"
    );


    /*
     * ------------------------------------------------
     * RE-ACQUIRE POINTER LOCK
     * ------------------------------------------------
     */

    const reacquisition =
      await acquirePointerLockForMatrix({
        client,

        label:
          "RELOCK"
      });


    if (
      !reacquisition.snapshot
    ) {
      throw new Error(
        `POINTER_RELOCK_CAPABILITY_LOST=${JSON.stringify(reacquisition.capability)}`
      );
    }


    const relocked =
      reacquisition.snapshot;

    matrix.push(
      relocked
    );


    if (
      relocked
        .summary
        .pointerLocked !==
      true
    ) {
      throw new Error(
        "RELOCK_POINTER_STATE_MISMATCH"
      );
    }


    console.log(
      `STATE_RELOCKED=PASS path=${reacquisition.path}`
    );


    /*
     * ------------------------------------------------
     * REAL WASD INPUT
     *
     * Existing locomotion tests own exact movement
     * vector semantics. Here we prove the live browser
     * accepts real keyboard input while remaining in
     * the gameplay state.
     * ------------------------------------------------
     */

    const keys =
      [
        {
          key:
            "w",
          code:
            "KeyW",
          keyCode:
            87
        },

        {
          key:
            "a",
          code:
            "KeyA",
          keyCode:
            65
        },

        {
          key:
            "s",
          code:
            "KeyS",
          keyCode:
            83
        },

        {
          key:
            "d",
          code:
            "KeyD",
          keyCode:
            68
        }
      ];

    for (
      const item
      of keys
    ) {
      await dispatchRealKey({
        client,

        key:
          item.key,

        code:
          item.code,

        windowsVirtualKeyCode:
          item.keyCode,

        holdMs:
          120
      });

      const afterKey =
        await waitForAcceptanceMode({
          client,

          modes: [
            MODE.PLAYING_LOCKED
          ],

          label:
            `STATE_AFTER_${item.code}`
        });

      matrix.push(
        afterKey
      );

      console.log(
        `CDP_${item.code}=PASS`
      );
    }


    /*
     * ------------------------------------------------
     * FINAL ESCAPE
     * ------------------------------------------------
     */

    await dispatchRealKey({
      client,

      key:
        "Escape",

      code:
        "Escape",

      windowsVirtualKeyCode:
        27,

      holdMs:
        30
    });

    const finalUnlocked =
      await waitForAcceptanceMode({
        client,

        modes: [
          MODE.PLAYING_UNLOCKED
        ],

        label:
          "FINAL_PLAYING_UNLOCKED"
      });

    matrix.push(
      finalUnlocked
    );

    assertStrictlyIncreasingSequence(
      matrix
    );


    /*
     * ------------------------------------------------
     * USER ACTIVATION EVIDENCE
     * ------------------------------------------------
     */

    const activation =
      await client.evaluate(
        `({
          hasBeenActive:
            navigator.userActivation?.hasBeenActive ??
            null,

          isActive:
            navigator.userActivation?.isActive ??
            null,

          pointerLockElement:
            Boolean(
              document.pointerLockElement
            )
        })`
      );

    console.log(
      `USER_ACTIVATION=${JSON.stringify(activation)}`
    );


    /*
     * ------------------------------------------------
     * RESULT
     * ------------------------------------------------
     */

    console.log("");
    console.log(
      "CW07_7B_REAL_HEADLESS_STATE_MATRIX=PASS"
    );

    console.log(
      "STATE_ENTRY_GATE=PASS"
    );

    console.log(
      "STATE_PLAYING_LOCKED=PASS"
    );

    console.log(
      "STATE_PLAYING_UNLOCKED=PASS"
    );

    console.log(
      "STATE_POINTER_RELOCK=PASS"
    );

    console.log(
      "REAL_CDP_MOUSE_INPUT=PASS"
    );

    console.log(
      "REAL_CDP_KEYBOARD_INPUT=PASS"
    );

    console.log(
      "REAL_WASD_DISPATCH=PASS"
    );

    console.log(
      "ACCEPTANCE_SEQUENCE_MONOTONIC=PASS"
    );

    console.log(
      `MATRIX_SNAPSHOT_COUNT=${matrix.length}`
    );

    console.log(
      `FINAL_MODE=${finalUnlocked.summary.interactionMode}`
    );

    console.log(
      `FINAL_POINTER_LOCK=${finalUnlocked.summary.pointerLocked}`
    );

    console.log(
      "NEXT=CW07_7C_STUDENT_INSPECTION_MATRIX"
    );
  } finally {
    client?.close();

    if (
      !browser.killed
    ) {
      browser.kill();
    }

    await sleep(
      200
    );

    fs.rmSync(
      profileDir,
      {
        recursive:
          true,
        force:
          true
      }
    );
  }
}


const isDirect =
  process.argv[1] &&
  pathToFileURL(
    path.resolve(
      process.argv[1]
    )
  ).href ===
    import.meta.url;


if (isDirect) {
  main().catch(
    (error) => {
      console.error(
        error.stack ??
        error.message ??
        String(
          error
        )
      );

      process.exitCode =
        1;
    }
  );
}


export {
  MODE,
  assertStrictlyIncreasingSequence,
  buildPointerLockCapabilityExpression,
  buildTextControlCenterExpression,
  buildViewportCenterExpression,
  createKeyEventPayload,
  probePointerLockCapability
};