export function percentile(sortedValues, p) {
	if (sortedValues.length === 0) {
		return 0;
	}

	const index = (p / 100) * (sortedValues.length - 1);
	const lower = Math.floor(index);
	const upper = Math.ceil(index);

	if (lower === upper) {
		return sortedValues[lower];
	}

	const weight = index - lower;
	return (sortedValues[lower] * (1 - weight)) + (sortedValues[upper] * weight);
}

export function defineBudget(budgets) {
	return {...budgets};
}

export async function measureRoute(url, options = {}) {
	const {
		requests: requestCount = 100,
		concurrency = 10,
		method = 'GET',
		headers,
		body,
	} = options;

	const latencies = [];

	const batches = Math.ceil(requestCount / concurrency);

	for (let i = 0; i < batches; i++) {
		const batchSize = Math.min(concurrency, requestCount - (i * concurrency));
		const promises = [];

		for (let index = 0; index < batchSize; index++) {
			promises.push(measureSingleRequest(url, method, headers, body));
		}

		// eslint-disable-next-line no-await-in-loop
		const results = await Promise.all(promises);
		latencies.push(...results);
	}

	const sorted = [...latencies].sort((a, b) => a - b);
	const sum = sorted.reduce((a, b) => a + b, 0);

	return {
		p50: percentile(sorted, 50),
		p75: percentile(sorted, 75),
		p90: percentile(sorted, 90),
		p95: percentile(sorted, 95),
		p99: percentile(sorted, 99),
		min: sorted[0],
		max: sorted.at(-1),
		mean: sum / sorted.length,
		median: percentile(sorted, 50),
		count: sorted.length,
	};
}

async function measureSingleRequest(url, method, headers, body) {
	const start = performance.now();

	try {
		await fetch(url, {
			method,
			headers,
			body: method === 'GET' || method === 'HEAD' ? undefined : body,
		});
	} catch {}

	return performance.now() - start;
}

export function checkBudget(measurements, budget) {
	const violations = [];

	for (const [metric, limit] of Object.entries(budget)) {
		const actual = measurements[metric];

		if (actual !== undefined && actual > limit) {
			violations.push({
				metric,
				actual,
				limit,
			});
		}
	}

	return {
		passed: violations.length === 0,
		violations,
	};
}

export function formatResults(routeResults) {
	const lines = [
		'API Performance Budget Report',
		'='.repeat(70),
		'',
	];

	for (const [route, {measurements, result}] of Object.entries(routeResults)) {
		const status = result.passed ? 'PASS' : 'FAIL';
		lines.push(
			`[${status}] ${route}`,
			`  p50=${measurements.p50.toFixed(1)}ms  p75=${measurements.p75.toFixed(1)}ms  p90=${measurements.p90.toFixed(1)}ms  p95=${measurements.p95.toFixed(1)}ms  p99=${measurements.p99.toFixed(1)}ms`,
		);

		if (result.violations.length > 0) {
			for (const violation of result.violations) {
				lines.push(`  VIOLATION: ${violation.metric} = ${violation.actual.toFixed(1)}ms (limit: ${violation.limit}ms)`);
			}
		}

		lines.push('');
	}

	return lines.join('\n');
}
