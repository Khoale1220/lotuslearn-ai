import {
  spawn
} from "node:child_process";

import {
  randomUUID
} from "node:crypto";

import fs from "node:fs";

import net from "node:net";

import os from "node:os";

import path from "node:path";

import {
  pathToFileURL
} from "node:url";


const DEFAULT_URL =
  "http://127.0.0.1:3000/index.html";

const REQUEST_EVENT =
  "lotuslearn:classroom-runtime-acceptance-request";

const SNAPSHOT_EVENT =
  "lotuslearn:classroom-runtime-acceptance-snapshot";

const EXPECTED_VERSION =
  "CW07_RUNTIME_ACCEPTANCE_V56";


function sleep(
  milliseconds
) {
  return new Promise(
    (resolve) => {
      setTimeout(
        resolve,
        milliseconds
      );
    }
  );
}


function parseArgs(
  argv
) {
  const result = {
    url:
      DEFAULT_URL
  };

  for (
    let index = 0;
    index < argv.length;
    index += 1
  ) {
    if (
      argv[index] ===
        "--url" &&
      argv[index + 1]
    ) {
      result.url =
        argv[index + 1];

      index +=
        1;
    }
  }

  return result;
}


function findBrowserBinary() {
  const explicit =
    process.env
      .LOTUSLEARN_BROWSER_BIN;

  const candidates =
    [
      explicit,

      process.env
        .PROGRAMFILES
        ? path.join(
            process.env.PROGRAMFILES,
            "Microsoft",
            "Edge",
            "Application",
            "msedge.exe"
          )
        : null,

      process.env[
        "PROGRAMFILES(X86)"
      ]
        ? path.join(
            process.env[
              "PROGRAMFILES(X86)"
            ],
            "Microsoft",
            "Edge",
            "Application",
            "msedge.exe"
          )
        : null,

      process.env
        .LOCALAPPDATA
        ? path.join(
            process.env.LOCALAPPDATA,
            "Microsoft",
            "Edge",
            "Application",
            "msedge.exe"
          )
        : null,

      "/usr/bin/microsoft-edge",

      "/usr/bin/microsoft-edge-stable",

      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
    ].filter(
      Boolean
    );

  for (
    const candidate
    of candidates
  ) {
    if (
      fs.existsSync(
        candidate
      )
    ) {
      return candidate;
    }
  }

  throw new Error(
    "EDGE_BROWSER_NOT_FOUND"
  );
}


function allocatePort() {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const server =
        net.createServer();

      server.once(
        "error",
        reject
      );

      server.listen(
        0,
        "127.0.0.1",
        () => {
          const address =
            server.address();

          const port =
            address &&
            typeof address ===
              "object"
              ? address.port
              : null;

          server.close(
            (error) => {
              if (error) {
                reject(
                  error
                );

                return;
              }

              resolve(
                port
              );
            }
          );
        }
      );
    }
  );
}


async function readJson(
  url
) {
  const response =
    await fetch(
      url
    );

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}: ${url}`
    );
  }

  return response.json();
}


async function waitForDevTools({
  port,
  timeoutMs =
    12000
}) {
  const deadline =
    Date.now() +
    timeoutMs;

  let lastError =
    null;

  while (
    Date.now() <
    deadline
  ) {
    try {
      return await readJson(
        `http://127.0.0.1:${port}/json/version`
      );
    } catch (error) {
      lastError =
        error;

      await sleep(
        100
      );
    }
  }

  throw new Error(
    `EDGE_REMOTE_DEBUGGING_UNAVAILABLE: ${
      lastError?.message ??
      "unknown"
    }`
  );
}


async function waitForPageTarget({
  port,
  timeoutMs =
    8000
}) {
  const deadline =
    Date.now() +
    timeoutMs;

  while (
    Date.now() <
    deadline
  ) {
    const targets =
      await readJson(
        `http://127.0.0.1:${port}/json/list`
      );

    const page =
      targets.find(
        (target) =>
          target.type ===
            "page" &&
          typeof target
            .webSocketDebuggerUrl ===
            "string"
      );

    if (page) {
      return page;
    }

    await sleep(
      100
    );
  }

  throw new Error(
    "EDGE_PAGE_TARGET_NOT_FOUND"
  );
}


class CdpClient {
  constructor(
    url
  ) {
    this.url =
      url;

    this.socket =
      null;

    this.nextId =
      1;

    this.pending =
      new Map();

    this.waiters =
      new Map();
  }


  async connect() {
    if (
      typeof WebSocket !==
      "function"
    ) {
      throw new Error(
        "NODE_WEBSOCKET_API_NOT_AVAILABLE"
      );
    }

    this.socket =
      new WebSocket(
        this.url
      );

    await new Promise(
      (
        resolve,
        reject
      ) => {
        const timeout =
          setTimeout(
            () => {
              reject(
                new Error(
                  "CDP_WEBSOCKET_CONNECT_TIMEOUT"
                )
              );
            },
            8000
          );

        this.socket
          .addEventListener(
            "open",
            () => {
              clearTimeout(
                timeout
              );

              resolve();
            },
            {
              once:
                true
            }
          );

        this.socket
          .addEventListener(
            "error",
            () => {
              clearTimeout(
                timeout
              );

              reject(
                new Error(
                  "CDP_WEBSOCKET_CONNECT_ERROR"
                )
              );
            },
            {
              once:
                true
            }
          );
      }
    );


    this.socket
      .addEventListener(
        "message",
        (event) => {
          const message =
            JSON.parse(
              String(
                event.data
              )
            );

          if (
            Number.isInteger(
              message.id
            )
          ) {
            const pending =
              this.pending.get(
                message.id
              );

            if (!pending) {
              return;
            }

            this.pending.delete(
              message.id
            );

            if (
              message.error
            ) {
              pending.reject(
                new Error(
                  `${message.error.code}: ${message.error.message}`
                )
              );

              return;
            }

            pending.resolve(
              message.result
            );

            return;
          }


          if (
            typeof message.method ===
              "string"
          ) {
            const waiters =
              this.waiters.get(
                message.method
              ) ?? [];

            this.waiters.delete(
              message.method
            );

            for (
              const waiter
              of waiters
            ) {
              clearTimeout(
                waiter.timeout
              );

              waiter.resolve(
                message.params
              );
            }
          }
        }
      );
  }


  send(
    method,
    params =
      {}
  ) {
    if (
      !this.socket
    ) {
      throw new Error(
        "CDP_NOT_CONNECTED"
      );
    }

    const id =
      this.nextId;

    this.nextId +=
      1;

    return new Promise(
      (
        resolve,
        reject
      ) => {
        this.pending.set(
          id,
          {
            resolve,
            reject
          }
        );

        this.socket.send(
          JSON.stringify({
            id,
            method,
            params
          })
        );
      }
    );
  }


  waitForEvent(
    method,
    timeoutMs =
      10000
  ) {
    return new Promise(
      (
        resolve,
        reject
      ) => {
        const timeout =
          setTimeout(
            () => {
              const current =
                this.waiters.get(
                  method
                ) ?? [];

              this.waiters.set(
                method,
                current.filter(
                  (waiter) =>
                    waiter.resolve !==
                    resolve
                )
              );

              reject(
                new Error(
                  `CDP_EVENT_TIMEOUT=${method}`
                )
              );
            },
            timeoutMs
          );

        const current =
          this.waiters.get(
            method
          ) ?? [];

        current.push({
          resolve,
          reject,
          timeout
        });

        this.waiters.set(
          method,
          current
        );
      }
    );
  }


  async evaluate(
    expression,
    {
      awaitPromise =
        false,
      userGesture =
        false
    } =
      {}
  ) {
    const result =
      await this.send(
        "Runtime.evaluate",
        {
          expression,
          awaitPromise,
          userGesture,
          returnByValue:
            true
        }
      );

    if (
      result.exceptionDetails
    ) {
      throw new Error(
        `RUNTIME_EVALUATE_EXCEPTION: ${
          result
            .exceptionDetails
            .text ??
          "unknown"
        }`
      );
    }

    return result.result
      ?.value;
  }


  close() {
    if (
      this.socket &&
      this.socket.readyState ===
        WebSocket.OPEN
    ) {
      this.socket.close();
    }
  }
}


async function waitForCondition({
  client,
  expression,
  timeoutMs =
    12000,
  label
}) {
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
      await client.evaluate(
        expression
      );

    if (
      latest ===
        true
    ) {
      return;
    }

    await sleep(
      100
    );
  }

  throw new Error(
    `${label}=TIMEOUT latest=${JSON.stringify(latest)}`
  );
}


function buildClassroomNavigationExpression() {
  return `(() => {
    if (
      document.querySelector(
        ".cw-world__viewport"
      )
    ) {
      return {
        state:
          "already-mounted"
      };
    }

    const interactive =
      [
        ...document.querySelectorAll(
          'button, a, [role="button"], [tabindex]'
        )
      ];

    let target =
      interactive.find(
        (element) =>
          /classroom\\s+world/i.test(
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
            /classroom\\s+world/i.test(
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
        state:
          "control-not-found"
      };
    }

    target.click();

    return {
      state:
        "clicked",
      label:
        (
          target.textContent ??
          ""
        ).trim()
    };
  })()`;
}


function buildSnapshotExpression() {
  return `(() =>
    new Promise(
      (resolve) => {
        const host =
          document.querySelector(
            ".cw-world__viewport"
          );

        const root =
          document.querySelector(
            ".cw-world"
          );

        if (
          !host ||
          !root
        ) {
          resolve({
            ok:
              false,
            error:
              "CLASSROOM_WORLD_NOT_MOUNTED"
          });

          return;
        }

        const snapshotEvent =
          ${JSON.stringify(
            SNAPSHOT_EVENT
          )};

        const requestEvent =
          ${JSON.stringify(
            REQUEST_EVENT
          )};

        let completed =
          false;

        const finish =
          (payload) => {
            if (completed) {
              return;
            }

            completed =
              true;

            resolve(
              payload
            );
          };

        const timeout =
          setTimeout(
            () => {
              host.removeEventListener(
                snapshotEvent,
                onSnapshot
              );

              finish({
                ok:
                  false,
                error:
                  "V56_SNAPSHOT_TIMEOUT"
              });
            },
            2500
          );

        function onSnapshot(
          event
        ) {
          clearTimeout(
            timeout
          );

          finish({
            ok:
              true,

            snapshot:
              event.detail,

            dom: {
              interactionMode:
                root.dataset
                  .interactionMode ??
                null,

              gameplayActive:
                root.dataset
                  .gameplayActive ===
                "true"
            }
          });
        }

        host.addEventListener(
          snapshotEvent,
          onSnapshot,
          {
            once:
              true
          }
        );

        host.dispatchEvent(
          new CustomEvent(
            requestEvent
          )
        );
      }
    )
  )()`;
}


function validateAcceptanceResultV56(
  result
) {
  if (
    !result ||
    result.ok !==
      true
  ) {
    throw new Error(
      `ACCEPTANCE_REQUEST_FAILED=${
        result?.error ??
        "unknown"
      }`
    );
  }

  const snapshot =
    result.snapshot;

  if (
    !snapshot ||
    typeof snapshot !==
      "object"
  ) {
    throw new Error(
      "ACCEPTANCE_SNAPSHOT_MISSING"
    );
  }

  if (
    snapshot.version !==
    EXPECTED_VERSION
  ) {
    throw new Error(
      `ACCEPTANCE_VERSION_INVALID=${snapshot.version}`
    );
  }

  if (
    !Number.isInteger(
      snapshot.sequence
    ) ||
    snapshot.sequence <
      1
  ) {
    throw new Error(
      `ACCEPTANCE_SEQUENCE_INVALID=${snapshot.sequence}`
    );
  }

  if (
    !snapshot.runtime ||
    typeof snapshot.runtime !==
      "object"
  ) {
    throw new Error(
      "V7_RUNTIME_SNAPSHOT_MISSING"
    );
  }

  if (
    !snapshot.interaction ||
    typeof snapshot.interaction !==
      "object"
  ) {
    throw new Error(
      "INTERACTION_SNAPSHOT_MISSING"
    );
  }

  if (
    typeof snapshot
      .interaction
      .pointerLocked !==
      "boolean"
  ) {
    throw new Error(
      "POINTER_LOCK_TYPE_INVALID"
    );
  }

  if (
    typeof snapshot
      .interaction
      .gameplayActive !==
      "boolean"
  ) {
    throw new Error(
      "GAMEPLAY_ACTIVE_TYPE_INVALID"
    );
  }

  if (
    snapshot
      .interaction
      .mode !==
    result.dom
      .interactionMode
  ) {
    throw new Error(
      `INTERACTION_MODE_MISMATCH=${snapshot.interaction.mode}/${result.dom.interactionMode}`
    );
  }

  if (
    snapshot
      .interaction
      .gameplayActive !==
    result.dom
      .gameplayActive
  ) {
    throw new Error(
      "GAMEPLAY_ACTIVE_MISMATCH"
    );
  }

  return {
    version:
      snapshot.version,

    sequence:
      snapshot.sequence,

    interactionMode:
      snapshot
        .interaction
        .mode,

    gameplayActive:
      snapshot
        .interaction
        .gameplayActive,

    pointerLocked:
      snapshot
        .interaction
        .pointerLocked,

    runtimeVersion:
      snapshot.runtime
        .version ??
      null,

    frameCount:
      Number.isFinite(
        snapshot.runtime
          .frameCount
      )
        ? snapshot.runtime
            .frameCount
        : null
  };
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
      `lotuslearn-cw07-v57-${randomUUID()}`
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

    await waitForCondition({
      client,

      label:
        "LOTUSLEARN_APP_READY",

      expression:
        `document.body && document.body.innerText.length > 0`
    });

    const navigation =
      await client.evaluate(
        buildClassroomNavigationExpression(),
        {
          userGesture:
            true
        }
      );

    console.log(
      `CLASSROOM_NAVIGATION=${JSON.stringify(navigation)}`
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
     * Give the existing V7 RAF observer a few frames.
     * This does not create a second application RAF.
     */
    await client.evaluate(
      `new Promise(
        (resolve) => {
          requestAnimationFrame(
            () => {
              requestAnimationFrame(
                () => {
                  resolve(true);
                }
              );
            }
          );
        }
      )`,
      {
        awaitPromise:
          true
      }
    );

    const result =
      await client.evaluate(
        buildSnapshotExpression(),
        {
          awaitPromise:
            true,
          userGesture:
            true
        }
      );

    const summary =
      validateAcceptanceResultV56(
        result
      );

    console.log(
      "CW07_6C_TERMINAL_ACCEPTANCE_PROBE=PASS"
    );

    console.log(
      `ACCEPTANCE_VERSION=${summary.version}`
    );

    console.log(
      `ACCEPTANCE_SEQUENCE=${summary.sequence}`
    );

    console.log(
      `INTERACTION_MODE=${summary.interactionMode}`
    );

    console.log(
      `GAMEPLAY_ACTIVE=${summary.gameplayActive}`
    );

    console.log(
      `POINTER_LOCKED=${summary.pointerLocked}`
    );

    console.log(
      `RUNTIME_VERSION=${summary.runtimeVersion ?? "unknown"}`
    );

    console.log(
      `FRAME_COUNT=${summary.frameCount ?? "unknown"}`
    );

    console.log(
      `SNAPSHOT=${JSON.stringify(result.snapshot)}`
    );
  } finally {
    client?.close();

    if (
      !browser.killed
    ) {
      browser.kill();
    }

    await sleep(
      150
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
        error
          .stack ??
        error
          .message ??
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
  CdpClient,
  allocatePort,
  buildClassroomNavigationExpression,
  buildSnapshotExpression,
  findBrowserBinary,
  parseArgs,
  sleep,
  validateAcceptanceResultV56,
  waitForCondition,
  waitForDevTools,
  waitForPageTarget
};