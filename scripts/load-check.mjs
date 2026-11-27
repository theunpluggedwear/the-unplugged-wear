import autocannon from 'autocannon';

const targets = process.argv.slice(2);
const urls = targets.length ? targets : [
  'http://127.0.0.1:3007/',
  'http://127.0.0.1:3007/api/previews?p=p1&m=UK&pl=Front&c=Black',
  'http://127.0.0.1:3024/products',
];
const levels = [1, 10, 50, 100];
const results = [];

for (const url of urls) {
  for (const connections of levels) {
    const report = await autocannon({
      url,
      connections,
      duration: 10,
      pipelining: 1,
      timeout: 30,
    });
    const row = {
      url,
      connections,
      requests: report.requests.total,
      throughputMb: Number(report.throughput.average.toFixed(2)),
      latencyP50Ms: report.latency.p50,
      latencyP95Ms: report.latency.p95,
      latencyP99Ms: report.latency.p99,
      errors: report.errors,
      non2xx: report.non2xx,
    };
    results.push(row);
    console.log(JSON.stringify(row));
  }
}

const failures = results.filter((r) => r.errors > 0 || r.non2xx > 0);
console.log(JSON.stringify({ summary: 'load-check complete', scenarios: results.length, failures: failures.length }));
if (failures.length) process.exitCode = 1;
