const baseUrl = process.env.LOAD_TEST_BASE_URL ?? 'http://127.0.0.1:3000';
const path = process.env.LOAD_TEST_PATH ?? '/health/live';
const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY ?? 20);
const requests = Number(process.env.LOAD_TEST_REQUESTS ?? 200);
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 500) throw new Error('Invalid LOAD_TEST_CONCURRENCY');
if (!Number.isInteger(requests) || requests < concurrency || requests > 100000) throw new Error('Invalid LOAD_TEST_REQUESTS');

const durations = [];
let completed = 0;
let failures = 0;
async function worker() {
  while (true) {
    const index = completed++;
    if (index >= requests) return;
    const started = performance.now();
    try {
      const response = await fetch(new URL(path, baseUrl), { headers: { accept: 'application/json' } });
      durations.push(performance.now() - started);
      if (!response.ok) failures += 1;
    } catch {
      failures += 1;
    }
  }
}
await Promise.all(Array.from({ length: concurrency }, worker));
durations.sort((a, b) => a - b);
const percentile = (value) => durations[Math.min(durations.length - 1, Math.floor(durations.length * value))] ?? 0;
process.stdout.write(JSON.stringify({ baseUrl, path, requests, concurrency, failures, p50Ms: percentile(0.5), p95Ms: percentile(0.95), p99Ms: percentile(0.99) }) + '\n');
if (failures > 0) process.exitCode = 2;
