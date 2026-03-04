import assert from 'node:assert/strict';
import test from 'node:test';
import { MetricsService } from './metrics.service';

test('metrics service records counters and gauges with labels', () => {
  const service = new MetricsService();

  service.incrementCounter('challenge_created_total');
  service.incrementCounter('challenge_created_total', 2);
  service.setGauge('websocket_connected_users', 11);

  const snapshot = service.snapshot();
  const counter = snapshot.counters.find((row) => row.name === 'challenge_created_total');
  const gauge = snapshot.gauges.find((row) => row.name === 'websocket_connected_users');

  assert.ok(counter);
  assert.equal(counter.value, 3);
  assert.deepEqual(counter.labels, {});
  assert.ok(gauge);
  assert.equal(gauge.value, 11);
});

test('metrics service derives histogram aggregates and percentiles', () => {
  const service = new MetricsService();

  service.observeLatency('http_request_latency_ms', 120, {
    method: 'GET',
    route: '/api/lobby/challenges',
  });
  service.observeLatency('http_request_latency_ms', 280, {
    method: 'GET',
    route: '/api/lobby/challenges',
  });
  service.observeLatency('http_request_latency_ms', 510, {
    method: 'GET',
    route: '/api/lobby/challenges',
  });

  const snapshot = service.snapshot();
  const row = snapshot.histograms.find(
    (entry) =>
      entry.name === 'http_request_latency_ms' &&
      entry.labels.method === 'GET' &&
      entry.labels.route === '/api/lobby/challenges',
  );
  assert.ok(row);
  assert.equal(row.count, 3);
  assert.equal(row.max, 510);
  assert.equal(row.p50, 300);
  assert.equal(row.p95, 1000);
});

test('metrics service emits prometheus format', () => {
  const service = new MetricsService();

  service.incrementCounter('chat_messages_total', 4, { conversationType: 'TOURNAMENT' });
  service.observeLatency('http_request_latency_ms', 180, { method: 'POST', route: '/api/challenges' });

  const exposition = service.toPrometheus();

  assert.match(exposition, /# TYPE chat_messages_total counter/);
  assert.match(exposition, /chat_messages_total\{conversationType="TOURNAMENT"\} 4/);
  assert.match(exposition, /# TYPE http_request_latency_ms histogram/);
  assert.match(exposition, /http_request_latency_ms_bucket\{method="POST",route="\/api\/challenges",le="\+Inf"\} 1/);
});
