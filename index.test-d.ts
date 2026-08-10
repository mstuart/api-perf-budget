import { expectError, expectType } from "tsd";
import {
  type Budget,
  type BudgetCheckResult,
  checkBudget,
  defineBudget,
  formatResults,
  type Measurements,
  measureRoute,
  percentile,
  type Violation,
} from "./index.js";

// DefineBudget
const budgets = defineBudget({ "/api/users": { p95: 200, p99: 500 } });
expectType<Record<string, Budget>>(budgets);

// MeasureRoute
const measurements = await measureRoute("http://localhost:3000");
expectType<Measurements>(measurements);
expectType<number>(measurements.p50);
expectType<number>(measurements.p75);
expectType<number>(measurements.p90);
expectType<number>(measurements.p95);
expectType<number>(measurements.p99);
expectType<number>(measurements.min);
expectType<number>(measurements.max);
expectType<number>(measurements.mean);
expectType<number>(measurements.median);
expectType<number>(measurements.count);

// MeasureRoute with options
expectType<Promise<Measurements>>(
  measureRoute("http://localhost:3000", {
    body: "{}",
    concurrency: 5,
    headers: { "content-type": "application/json" },
    method: "POST",
    requests: 50,
  })
);

// CheckBudget
const result = checkBudget(measurements, { p95: 200 });
expectType<BudgetCheckResult>(result);
expectType<boolean>(result.passed);
expectType<Violation[]>(result.violations);

// FormatResults
expectType<string>(
  formatResults({
    "/api/users": { budget: { p95: 200 }, measurements, result },
  })
);

// Percentile
expectType<number>(percentile([1, 2, 3], 50));

// Requires arguments
expectError(measureRoute());
expectError(percentile());
