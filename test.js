import {createServer} from 'node:http';
import test from 'ava';
import {
	percentile,
	defineBudget,
	measureRoute,
	checkBudget,
	formatResults,
} from './index.js';

// Percentile

test('percentile returns correct p50 for even-length array', t => {
	const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
	t.is(percentile(values, 50), 5.5);
});

test('percentile returns correct p50 for odd-length array', t => {
	const values = [1, 2, 3, 4, 5];
	t.is(percentile(values, 50), 3);
});

test('percentile returns first element for p0', t => {
	const values = [10, 20, 30];
	t.is(percentile(values, 0), 10);
});

test('percentile returns last element for p100', t => {
	const values = [10, 20, 30];
	t.is(percentile(values, 100), 30);
});

test('percentile returns 0 for empty array', t => {
	t.is(percentile([], 50), 0);
});

test('percentile returns single element for single-element array', t => {
	t.is(percentile([42], 50), 42);
	t.is(percentile([42], 95), 42);
});

test('percentile interpolates correctly for p95', t => {
	const values = Array.from({length: 100}, (_, i) => i + 1);
	const p95 = percentile(values, 95);
	t.true(p95 >= 95);
	t.true(p95 <= 96);
});

test('percentile interpolates correctly for p99', t => {
	const values = Array.from({length: 100}, (_, i) => i + 1);
	const p99 = percentile(values, 99);
	t.true(p99 >= 99);
	t.true(p99 <= 100);
});

// DefineBudget

test('defineBudget returns a copy of the budgets', t => {
	const budgets = {
		'/api/users': {p95: 200, p99: 500},
		'/api/checkout': {p95: 100},
	};

	const result = defineBudget(budgets);
	t.deepEqual(result, budgets);
	t.not(result, budgets);
});

test('defineBudget handles empty object', t => {
	const result = defineBudget({});
	t.deepEqual(result, {});
});

// MeasureRoute

function createTestServer() {
	return new Promise(resolve => {
		const server = createServer((request, response) => {
			response.writeHead(200, {'content-type': 'application/json'});
			response.end(JSON.stringify({ok: true}));
		});

		server.listen(0, () => {
			const {port} = server.address();
			resolve({server, port, url: `http://127.0.0.1:${port}`});
		});
	});
}

test('measureRoute returns correct structure', async t => {
	const {server, url} = await createTestServer();

	try {
		const result = await measureRoute(url, {requests: 10, concurrency: 2});

		t.is(typeof result.p50, 'number');
		t.is(typeof result.p75, 'number');
		t.is(typeof result.p90, 'number');
		t.is(typeof result.p95, 'number');
		t.is(typeof result.p99, 'number');
		t.is(typeof result.min, 'number');
		t.is(typeof result.max, 'number');
		t.is(typeof result.mean, 'number');
		t.is(typeof result.median, 'number');
		t.is(result.count, 10);
	} finally {
		server.close();
	}
});

test('measureRoute min <= median <= max', async t => {
	const {server, url} = await createTestServer();

	try {
		const result = await measureRoute(url, {requests: 20, concurrency: 5});

		t.true(result.min <= result.median);
		t.true(result.median <= result.max);
	} finally {
		server.close();
	}
});

test('measureRoute p50 <= p75 <= p90 <= p95 <= p99', async t => {
	const {server, url} = await createTestServer();

	try {
		const result = await measureRoute(url, {requests: 20, concurrency: 5});

		t.true(result.p50 <= result.p75);
		t.true(result.p75 <= result.p90);
		t.true(result.p90 <= result.p95);
		t.true(result.p95 <= result.p99);
	} finally {
		server.close();
	}
});

test('measureRoute count matches requested count', async t => {
	const {server, url} = await createTestServer();

	try {
		const result = await measureRoute(url, {requests: 15, concurrency: 3});
		t.is(result.count, 15);
	} finally {
		server.close();
	}
});

test('measureRoute handles POST method', async t => {
	const {server, url} = await createTestServer();

	try {
		const result = await measureRoute(url, {
			requests: 5,
			concurrency: 2,
			method: 'POST',
			headers: {'content-type': 'application/json'},
			body: JSON.stringify({name: 'test'}),
		});

		t.is(result.count, 5);
		t.true(result.p50 > 0);
	} finally {
		server.close();
	}
});

// CheckBudget

test('checkBudget passes when within budget', t => {
	const measurements = {
		p50: 10,
		p75: 20,
		p90: 30,
		p95: 50,
		p99: 80,
		min: 5,
		max: 100,
		mean: 25,
		median: 10,
		count: 100,
	};

	const result = checkBudget(measurements, {p95: 200, p99: 500});
	t.true(result.passed);
	t.is(result.violations.length, 0);
});

test('checkBudget fails when over budget', t => {
	const measurements = {
		p50: 10,
		p75: 20,
		p90: 30,
		p95: 250,
		p99: 600,
		min: 5,
		max: 700,
		mean: 25,
		median: 10,
		count: 100,
	};

	const result = checkBudget(measurements, {p95: 200, p99: 500});
	t.false(result.passed);
	t.is(result.violations.length, 2);
});

test('checkBudget identifies correct violations', t => {
	const measurements = {
		p50: 10,
		p75: 20,
		p90: 30,
		p95: 250,
		p99: 80,
		min: 5,
		max: 300,
		mean: 25,
		median: 10,
		count: 100,
	};

	const result = checkBudget(measurements, {p95: 200, p99: 500});
	t.is(result.violations.length, 1);
	t.is(result.violations[0].metric, 'p95');
	t.is(result.violations[0].actual, 250);
	t.is(result.violations[0].limit, 200);
});

test('checkBudget passes when exactly at limit', t => {
	const measurements = {
		p50: 10,
		p75: 20,
		p90: 30,
		p95: 200,
		p99: 500,
		min: 5,
		max: 500,
		mean: 25,
		median: 10,
		count: 100,
	};

	const result = checkBudget(measurements, {p95: 200, p99: 500});
	t.true(result.passed);
});

test('checkBudget with empty budget passes', t => {
	const measurements = {
		p50: 10,
		p75: 20,
		p90: 30,
		p95: 200,
		p99: 500,
		min: 5,
		max: 500,
		mean: 25,
		median: 10,
		count: 100,
	};

	const result = checkBudget(measurements, {});
	t.true(result.passed);
});

// FormatResults

test('formatResults returns a string', t => {
	const routeResults = {
		'/api/users': {
			measurements: {
				p50: 10, p75: 20, p90: 30, p95: 50, p99: 80,
				min: 5, max: 100, mean: 25, median: 10, count: 100,
			},
			budget: {p95: 200},
			result: {passed: true, violations: []},
		},
	};

	const output = formatResults(routeResults);
	t.is(typeof output, 'string');
	t.true(output.length > 0);
});

test('formatResults includes route names', t => {
	const routeResults = {
		'/api/users': {
			measurements: {
				p50: 10, p75: 20, p90: 30, p95: 50, p99: 80,
				min: 5, max: 100, mean: 25, median: 10, count: 100,
			},
			budget: {p95: 200},
			result: {passed: true, violations: []},
		},
		'/api/posts': {
			measurements: {
				p50: 15, p75: 25, p90: 35, p95: 55, p99: 85,
				min: 8, max: 105, mean: 30, median: 15, count: 100,
			},
			budget: {p95: 200},
			result: {passed: true, violations: []},
		},
	};

	const output = formatResults(routeResults);
	t.true(output.includes('/api/users'));
	t.true(output.includes('/api/posts'));
});

test('formatResults shows PASS for passing routes', t => {
	const routeResults = {
		'/api/users': {
			measurements: {
				p50: 10, p75: 20, p90: 30, p95: 50, p99: 80,
				min: 5, max: 100, mean: 25, median: 10, count: 100,
			},
			budget: {p95: 200},
			result: {passed: true, violations: []},
		},
	};

	const output = formatResults(routeResults);
	t.true(output.includes('PASS'));
});

test('formatResults shows FAIL and violations for failing routes', t => {
	const routeResults = {
		'/api/slow': {
			measurements: {
				p50: 10, p75: 20, p90: 30, p95: 250, p99: 600,
				min: 5, max: 700, mean: 25, median: 10, count: 100,
			},
			budget: {p95: 200, p99: 500},
			result: {
				passed: false,
				violations: [
					{metric: 'p95', actual: 250, limit: 200},
					{metric: 'p99', actual: 600, limit: 500},
				],
			},
		},
	};

	const output = formatResults(routeResults);
	t.true(output.includes('FAIL'));
	t.true(output.includes('VIOLATION'));
});

test('formatResults includes header', t => {
	const output = formatResults({});
	t.true(output.includes('API Performance Budget Report'));
});
