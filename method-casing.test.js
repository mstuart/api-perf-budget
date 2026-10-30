import test from "ava";
import { measureRoute } from "./index.js";

for (const method of ["get", "GeT", "head", "HeAd"]) {
  test(`measureRoute omits bodies for ${method}`, async (t) => {
    const result = await measureRoute("data:text/plain,ok", {
      body: "ignored for GET and HEAD",
      concurrency: 1,
      method,
      requests: 1,
    });
    t.is(result.count, 1);
    t.true(Number.isFinite(result.mean));
  });
}
