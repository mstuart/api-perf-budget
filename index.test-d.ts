import {expectType, expectError} from 'tsd';
import {
	defineBudget,
	measureRoute,
	checkBudget,
	formatResults,
	percentile,
	type Budget,
	type Measurements,
	type BudgetCheckResult,
	type Violation,
} from './index.js';

// DefineBudget
const budgets = defineBudget({'/api/users': {p95: 200, p99: 500}});
expectType<Record<string, Budget>>(budgets);

// MeasureRoute
const measurements = await measureRoute('http://localhost:3000');
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
expectType<Promise<Measurements>>(measureRoute('http://localhost:3000', {
	requests: 50,
	concurrency: 5,
	method: 'POST',
	headers: {'content-type': 'application/json'},
	body: '{}',
}));

// CheckBudget
const result = checkBudget(measurements, {p95: 200});
expectType<BudgetCheckResult>(result);
expectType<boolean>(result.passed);
expectType<Violation[]>(result.violations);

// FormatResults
expectType<string>(formatResults({'/api/users': {measurements, budget: {p95: 200}, result}}));

// Percentile
expectType<number>(percentile([1, 2, 3], 50));

// Requires arguments
expectError(measureRoute());
expectError(percentile());
