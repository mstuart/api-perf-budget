# api-perf-budget

> Define and enforce per-route latency budgets for Node.js APIs in CI

## Install

```sh
npm install api-perf-budget
```

## Usage

```js
import {defineBudget, measureRoute, checkBudget, formatResults} from 'api-perf-budget';

// Define budgets
const budgets = defineBudget({
	'/api/users': {p95: 200, p99: 500},
	'/api/checkout': {p95: 100},
});

// Measure a route
const measurements = await measureRoute('http://localhost:3000/api/users', {
	requests: 100,
	concurrency: 10,
});

// Check against budget
const result = checkBudget(measurements, budgets['/api/users']);
console.log(result.passed);
// => true
```

## API

### `defineBudget(budgets)`

Define latency budgets for API routes.

#### budgets

Type: `Record<string, {p50?, p75?, p90?, p95?, p99?}>`

An object mapping route paths to their latency budgets in milliseconds.

### `measureRoute(url, options?)`

Returns: `Promise<Measurements>`

Send HTTP requests and measure latency.

#### url

Type: `string`

The URL to measure.

#### options

##### requests

Type: `number`\
Default: `100`

Number of requests to send.

##### concurrency

Type: `number`\
Default: `10`

Number of concurrent requests per batch.

##### method

Type: `string`\
Default: `'GET'`

HTTP method.

##### headers

Type: `Record<string, string>`

HTTP headers to include.

##### body

Type: `string`

Request body for POST/PUT/PATCH requests.

#### Return value

Type: `{p50, p75, p90, p95, p99, min, max, mean, median, count}`

### `checkBudget(measurements, budget)`

Returns: `{passed: boolean, violations: [{metric, actual, limit}]}`

Check measurements against a budget.

### `formatResults(routeResults)`

Returns: `string`

Format results as a human-readable report with pass/fail per route.

### `percentile(sortedValues, p)`

Returns: `number`

Calculate a percentile from a sorted array.

## Related

- [autocannon](https://github.com/mcollina/autocannon) — HTTP benchmarking tool

## License

MIT
