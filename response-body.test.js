import { setImmediate as nextTurn } from "node:timers/promises";
import test from "ava";
import { measureRoute } from "./index.js";

const TEST_URL = "https://example.test";

function replaceFetch(t, fetch) {
  const original = globalThis.fetch;
  globalThis.fetch = fetch;
  t.teardown(() => {
    globalThis.fetch = original;
  });
}

test.serial("latency includes draining the response body", async (t) => {
  let controller;
  let now = 100;
  const original = Object.getOwnPropertyDescriptor(performance, "now");
  Object.defineProperty(performance, "now", {
    configurable: true,
    value: () => now,
  });
  t.teardown(() => {
    if (original) {
      Object.defineProperty(performance, "now", original);
    } else {
      Reflect.deleteProperty(performance, "now");
    }
  });
  const response = new Response(
    new ReadableStream({
      start(stream) {
        controller = stream;
      },
    })
  );
  replaceFetch(t, async () => response);
  let settled = false;
  const measurement = measureRoute(TEST_URL, {
    concurrency: 1,
    requests: 1,
  }).then((value) => {
    settled = true;
    return value;
  });
  await nextTurn();
  const settledBeforeBody = settled;
  now = 175;
  controller.enqueue(new Uint8Array([1, 2, 3]));
  controller.close();
  const result = await measurement;
  t.false(settledBeforeBody);
  t.is(result.p50, 75);
  t.true(response.bodyUsed);
});

test.serial("response-body failures reject the measurement", async (t) => {
  replaceFetch(
    t,
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.error(new Error("body failed"));
          },
        })
      )
  );
  await t.throwsAsync(measureRoute(TEST_URL, { concurrency: 1, requests: 1 }), {
    message: "body failed",
  });
});

test.serial(
  "the next batch waits for the previous response body",
  async (t) => {
    let controller;
    let calls = 0;
    replaceFetch(t, () => {
      calls += 1;
      const response =
        calls === 1
          ? new Response(
              new ReadableStream({
                start(stream) {
                  controller = stream;
                },
              })
            )
          : new Response();
      return Promise.resolve(response);
    });
    const measurement = measureRoute(TEST_URL, { concurrency: 1, requests: 2 });
    await nextTurn();
    const callsBeforeBody = calls;
    controller.close();
    const result = await measurement;
    t.is(callsBeforeBody, 1);
    t.is(calls, 2);
    t.is(result.count, 2);
  }
);
