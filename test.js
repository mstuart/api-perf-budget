import test from "ava";
import {
  checkBudget,
  defineBudget,
  formatResults,
  measureRoute,
  percentile,
} from "./index.js";

// Percentile

test("percentile returns correct p50 for even-length array", (t) => {
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  t.is(percentile(values, 50), 5.5);
});

test("percentile returns correct p50 for odd-length array", (t) => {
  const values = [1, 2, 3, 4, 5];
  t.is(percentile(values, 50), 3);
});

test("percentile returns first element for p0", (t) => {
  const values = [10, 20, 30];
  t.is(percentile(values, 0), 10);
});

test("percentile returns last element for p100", (t) => {
  const values = [10, 20, 30];
  t.is(percentile(values, 100), 30);
});

test("percentile returns 0 for empty array", (t) => {
  t.is(percentile([], 50), 0);
});

test("percentile returns single element for single-element array", (t) => {
  t.is(percentile([42], 50), 42);
  t.is(percentile([42], 95), 42);
});

test("percentile interpolates correctly for p95", (t) => {
  const values = Array.from({ length: 100 }, (_, i) => i + 1);
  const p95 = percentile(values, 95);
  t.true(p95 >= 95);
  t.true(p95 <= 96);
});

test("percentile interpolates correctly for p99", (t) => {
  const values = Array.from({ length: 100 }, (_, i) => i + 1);
  const p99 = percentile(values, 99);
  t.true(p99 >= 99);
  t.true(p99 <= 100);
});

// DefineBudget

test("defineBudget returns a copy of the budgets", (t) => {
  const budgets = {
    "/api/checkout": { p95: 100 },
    "/api/users": { p95: 200, p99: 500 },
  };

  const result = defineBudget(budgets);
  t.deepEqual(result, budgets);
  t.not(result, budgets);
});

test("defineBudget handles empty object", (t) => {
  const result = defineBudget({});
  t.deepEqual(result, {});
});

// MeasureRoute

const TEST_URL = "data:application/json,%7B%22ok%22%3Atrue%7D";

test("measureRoute returns correct structure", async (t) => {
  const result = await measureRoute(TEST_URL, {
    concurrency: 2,
    requests: 10,
  });

  t.is(typeof result.p50, "number");
  t.is(typeof result.p75, "number");
  t.is(typeof result.p90, "number");
  t.is(typeof result.p95, "number");
  t.is(typeof result.p99, "number");
  t.is(typeof result.min, "number");
  t.is(typeof result.max, "number");
  t.is(typeof result.mean, "number");
  t.is(typeof result.median, "number");
  t.is(result.count, 10);
});

test("measureRoute min <= median <= max", async (t) => {
  const result = await measureRoute(TEST_URL, {
    concurrency: 5,
    requests: 20,
  });

  t.true(result.min <= result.median);
  t.true(result.median <= result.max);
});

test("measureRoute p50 <= p75 <= p90 <= p95 <= p99", async (t) => {
  const result = await measureRoute(TEST_URL, {
    concurrency: 5,
    requests: 20,
  });

  t.true(result.p50 <= result.p75);
  t.true(result.p75 <= result.p90);
  t.true(result.p90 <= result.p95);
  t.true(result.p95 <= result.p99);
});

test("measureRoute count matches requested count", async (t) => {
  const result = await measureRoute(TEST_URL, {
    concurrency: 3,
    requests: 15,
  });
  t.is(result.count, 15);
});

test("measureRoute handles POST method", async (t) => {
  const result = await measureRoute(TEST_URL, {
    body: JSON.stringify({ name: "test" }),
    concurrency: 2,
    headers: { "content-type": "application/json" },
    method: "POST",
    requests: 5,
  });

  t.is(result.count, 5);
  t.true(result.p50 > 0);
});

// CheckBudget

test("checkBudget passes when within budget", (t) => {
  const measurements = {
    count: 100,
    max: 100,
    mean: 25,
    median: 10,
    min: 5,
    p50: 10,
    p75: 20,
    p90: 30,
    p95: 50,
    p99: 80,
  };

  const result = checkBudget(measurements, { p95: 200, p99: 500 });
  t.true(result.passed);
  t.is(result.violations.length, 0);
});

test("checkBudget fails when over budget", (t) => {
  const measurements = {
    count: 100,
    max: 700,
    mean: 25,
    median: 10,
    min: 5,
    p50: 10,
    p75: 20,
    p90: 30,
    p95: 250,
    p99: 600,
  };

  const result = checkBudget(measurements, { p95: 200, p99: 500 });
  t.false(result.passed);
  t.is(result.violations.length, 2);
});

test("checkBudget identifies correct violations", (t) => {
  const measurements = {
    count: 100,
    max: 300,
    mean: 25,
    median: 10,
    min: 5,
    p50: 10,
    p75: 20,
    p90: 30,
    p95: 250,
    p99: 80,
  };

  const result = checkBudget(measurements, { p95: 200, p99: 500 });
  t.is(result.violations.length, 1);
  t.is(result.violations[0].metric, "p95");
  t.is(result.violations[0].actual, 250);
  t.is(result.violations[0].limit, 200);
});

test("checkBudget passes when exactly at limit", (t) => {
  const measurements = {
    count: 100,
    max: 500,
    mean: 25,
    median: 10,
    min: 5,
    p50: 10,
    p75: 20,
    p90: 30,
    p95: 200,
    p99: 500,
  };

  const result = checkBudget(measurements, { p95: 200, p99: 500 });
  t.true(result.passed);
});

test("checkBudget with empty budget passes", (t) => {
  const measurements = {
    count: 100,
    max: 500,
    mean: 25,
    median: 10,
    min: 5,
    p50: 10,
    p75: 20,
    p90: 30,
    p95: 200,
    p99: 500,
  };

  const result = checkBudget(measurements, {});
  t.true(result.passed);
});

// FormatResults

test("formatResults returns a string", (t) => {
  const routeResults = {
    "/api/users": {
      budget: { p95: 200 },
      measurements: {
        count: 100,
        max: 100,
        mean: 25,
        median: 10,
        min: 5,
        p50: 10,
        p75: 20,
        p90: 30,
        p95: 50,
        p99: 80,
      },
      result: { passed: true, violations: [] },
    },
  };

  const output = formatResults(routeResults);
  t.is(typeof output, "string");
  t.true(output.length > 0);
});

test("formatResults includes route names", (t) => {
  const routeResults = {
    "/api/posts": {
      budget: { p95: 200 },
      measurements: {
        count: 100,
        max: 105,
        mean: 30,
        median: 15,
        min: 8,
        p50: 15,
        p75: 25,
        p90: 35,
        p95: 55,
        p99: 85,
      },
      result: { passed: true, violations: [] },
    },
    "/api/users": {
      budget: { p95: 200 },
      measurements: {
        count: 100,
        max: 100,
        mean: 25,
        median: 10,
        min: 5,
        p50: 10,
        p75: 20,
        p90: 30,
        p95: 50,
        p99: 80,
      },
      result: { passed: true, violations: [] },
    },
  };

  const output = formatResults(routeResults);
  t.true(output.includes("/api/users"));
  t.true(output.includes("/api/posts"));
});

test("formatResults shows PASS for passing routes", (t) => {
  const routeResults = {
    "/api/users": {
      budget: { p95: 200 },
      measurements: {
        count: 100,
        max: 100,
        mean: 25,
        median: 10,
        min: 5,
        p50: 10,
        p75: 20,
        p90: 30,
        p95: 50,
        p99: 80,
      },
      result: { passed: true, violations: [] },
    },
  };

  const output = formatResults(routeResults);
  t.true(output.includes("PASS"));
});

test("formatResults shows FAIL and violations for failing routes", (t) => {
  const routeResults = {
    "/api/slow": {
      budget: { p95: 200, p99: 500 },
      measurements: {
        count: 100,
        max: 700,
        mean: 25,
        median: 10,
        min: 5,
        p50: 10,
        p75: 20,
        p90: 30,
        p95: 250,
        p99: 600,
      },
      result: {
        passed: false,
        violations: [
          { actual: 250, limit: 200, metric: "p95" },
          { actual: 600, limit: 500, metric: "p99" },
        ],
      },
    },
  };

  const output = formatResults(routeResults);
  t.true(output.includes("FAIL"));
  t.true(output.includes("VIOLATION"));
});

test("formatResults includes header", (t) => {
  const output = formatResults({});
  t.true(output.includes("API Performance Budget Report"));
});
