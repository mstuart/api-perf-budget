export type Budget = {
	/** Maximum allowed p50 latency in milliseconds. */
	readonly p50?: number;

	/** Maximum allowed p75 latency in milliseconds. */
	readonly p75?: number;

	/** Maximum allowed p90 latency in milliseconds. */
	readonly p90?: number;

	/** Maximum allowed p95 latency in milliseconds. */
	readonly p95?: number;

	/** Maximum allowed p99 latency in milliseconds. */
	readonly p99?: number;
};

export type Measurements = {
	/** 50th percentile latency in milliseconds. */
	readonly p50: number;

	/** 75th percentile latency in milliseconds. */
	readonly p75: number;

	/** 90th percentile latency in milliseconds. */
	readonly p90: number;

	/** 95th percentile latency in milliseconds. */
	readonly p95: number;

	/** 99th percentile latency in milliseconds. */
	readonly p99: number;

	/** Minimum latency in milliseconds. */
	readonly min: number;

	/** Maximum latency in milliseconds. */
	readonly max: number;

	/** Mean latency in milliseconds. */
	readonly mean: number;

	/** Median latency in milliseconds. */
	readonly median: number;

	/** Total number of requests measured. */
	readonly count: number;
};

export type MeasureRouteOptions = {
	/**
	Number of requests to send.
	@default 100
	*/
	readonly requests?: number;

	/**
	Number of concurrent requests per batch.
	@default 10
	*/
	readonly concurrency?: number;

	/**
	HTTP method.
	@default 'GET'
	*/
	readonly method?: string;

	/**
	HTTP headers to include.
	*/
	readonly headers?: Record<string, string>;

	/**
	Request body for POST/PUT/PATCH requests.
	*/
	readonly body?: string;
};

export type Violation = {
	readonly metric: string;
	readonly actual: number;
	readonly limit: number;
};

export type BudgetCheckResult = {
	readonly passed: boolean;
	readonly violations: Violation[];
};

export type RouteResult = {
	readonly measurements: Measurements;
	readonly budget: Budget;
	readonly result: BudgetCheckResult;
};

/**
Define latency budgets for API routes.

@param budgets - An object mapping route paths to their latency budgets.
@returns A copy of the budgets object.

@example
```
import {defineBudget} from 'api-perf-budget';

const budgets = defineBudget({
	'/api/users': {p95: 200, p99: 500},
	'/api/checkout': {p95: 100},
});
```
*/
export function defineBudget(budgets: Record<string, Budget>): Record<string, Budget>;

/**
Measure HTTP route latency by sending requests and collecting timing data.

@param url - The URL to measure.
@param options - Configuration options.
@returns Latency measurements including percentiles.

@example
```
import {measureRoute} from 'api-perf-budget';

const measurements = await measureRoute('http://localhost:3000/api/users', {
	requests: 50,
	concurrency: 5,
});

console.log(measurements.p95);
```
*/
export function measureRoute(url: string, options?: MeasureRouteOptions): Promise<Measurements>;

/**
Check measurements against a budget.

@param measurements - The measured latency data.
@param budget - The budget limits to check against.
@returns Whether the budget passed and any violations.

@example
```
import {checkBudget} from 'api-perf-budget';

const result = checkBudget(measurements, {p95: 200, p99: 500});
console.log(result.passed);
// => true
```
*/
export function checkBudget(measurements: Measurements, budget: Budget): BudgetCheckResult;

/**
Format route results as a human-readable report.

@param routeResults - An object mapping route paths to their results.
@returns A formatted string report.

@example
```
import {formatResults} from 'api-perf-budget';

const report = formatResults({
	'/api/users': {measurements, budget, result},
});

console.log(report);
```
*/
export function formatResults(routeResults: Record<string, RouteResult>): string;

/**
Calculate a percentile from a sorted array of values.

@param sortedValues - A pre-sorted array of numbers.
@param p - The percentile to calculate (0-100).
@returns The calculated percentile value.

@example
```
import {percentile} from 'api-perf-budget';

const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
console.log(percentile(values, 50));
// => 5.5
```
*/
export function percentile(sortedValues: number[], p: number): number;
