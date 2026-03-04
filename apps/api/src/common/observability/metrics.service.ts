import { Injectable } from '@nestjs/common';

type MetricLabels = Record<string, string>;

type CounterRow = {
  name: string;
  labels: MetricLabels;
  value: number;
};

type HistogramRow = {
  name: string;
  labels: MetricLabels;
  count: number;
  sum: number;
  max: number;
  p50: number;
  p95: number;
  buckets: Array<{
    le: number;
    count: number;
  }>;
};

type HistogramState = {
  count: number;
  sum: number;
  max: number;
  buckets: number[];
};

const LATENCY_BUCKETS_MS = [50, 100, 200, 300, 500, 1_000, 2_000, 5_000] as const;

@Injectable()
export class MetricsService {
  private readonly counters = new Map<string, number>();
  private readonly gauges = new Map<string, number>();
  private readonly histograms = new Map<string, HistogramState>();

  incrementCounter(name: string, value = 1, labels: MetricLabels = {}): void {
    const key = metricKey(name, labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + value);
  }

  setGauge(name: string, value: number, labels: MetricLabels = {}): void {
    const key = metricKey(name, labels);
    this.gauges.set(key, value);
  }

  observeLatency(name: string, latencyMs: number, labels: MetricLabels = {}): void {
    const key = metricKey(name, labels);
    const state =
      this.histograms.get(key) ??
      {
        count: 0,
        sum: 0,
        max: 0,
        buckets: LATENCY_BUCKETS_MS.map(() => 0),
      };

    state.count += 1;
    state.sum += latencyMs;
    state.max = Math.max(state.max, latencyMs);

    for (let index = 0; index < LATENCY_BUCKETS_MS.length; index += 1) {
      if (latencyMs <= LATENCY_BUCKETS_MS[index]) {
        state.buckets[index] += 1;
        break;
      }
    }

    this.histograms.set(key, state);
  }

  snapshot(): {
    generatedAt: string;
    counters: CounterRow[];
    gauges: CounterRow[];
    histograms: HistogramRow[];
  } {
    return {
      generatedAt: new Date().toISOString(),
      counters: Array.from(this.counters.entries()).map(([key, value]) => {
        const parsed = parseMetricKey(key);
        return {
          name: parsed.name,
          labels: parsed.labels,
          value,
        };
      }),
      gauges: Array.from(this.gauges.entries()).map(([key, value]) => {
        const parsed = parseMetricKey(key);
        return {
          name: parsed.name,
          labels: parsed.labels,
          value,
        };
      }),
      histograms: Array.from(this.histograms.entries()).map(([key, state]) => {
        const parsed = parseMetricKey(key);
        return {
          name: parsed.name,
          labels: parsed.labels,
          count: state.count,
          sum: Number(state.sum.toFixed(2)),
          max: Number(state.max.toFixed(2)),
          p50: estimatePercentile(state, 0.5),
          p95: estimatePercentile(state, 0.95),
          buckets: LATENCY_BUCKETS_MS.map((le, index) => ({
            le,
            count: state.buckets[index],
          })),
        };
      }),
    };
  }

  toPrometheus(): string {
    const lines: string[] = [];

    const renderedCounterTypes = new Set<string>();
    for (const [key, value] of this.counters.entries()) {
      const { name, labels } = parseMetricKey(key);
      const safeName = sanitizeMetricName(name);
      if (!renderedCounterTypes.has(safeName)) {
        lines.push(`# TYPE ${safeName} counter`);
        renderedCounterTypes.add(safeName);
      }
      lines.push(`${safeName}${renderLabels(labels)} ${value}`);
    }

    const renderedGaugeTypes = new Set<string>();
    for (const [key, value] of this.gauges.entries()) {
      const { name, labels } = parseMetricKey(key);
      const safeName = sanitizeMetricName(name);
      if (!renderedGaugeTypes.has(safeName)) {
        lines.push(`# TYPE ${safeName} gauge`);
        renderedGaugeTypes.add(safeName);
      }
      lines.push(`${safeName}${renderLabels(labels)} ${value}`);
    }

    const renderedHistogramTypes = new Set<string>();
    for (const [key, state] of this.histograms.entries()) {
      const { name, labels } = parseMetricKey(key);
      const safeName = sanitizeMetricName(name);

      if (!renderedHistogramTypes.has(safeName)) {
        lines.push(`# TYPE ${safeName} histogram`);
        renderedHistogramTypes.add(safeName);
      }

      let cumulative = 0;
      for (let index = 0; index < LATENCY_BUCKETS_MS.length; index += 1) {
        cumulative += state.buckets[index];
        lines.push(
          `${safeName}_bucket${renderLabels({ ...labels, le: String(LATENCY_BUCKETS_MS[index]) })} ${cumulative}`,
        );
      }
      lines.push(`${safeName}_bucket${renderLabels({ ...labels, le: '+Inf' })} ${state.count}`);
      lines.push(`${safeName}_sum${renderLabels(labels)} ${Number(state.sum.toFixed(2))}`);
      lines.push(`${safeName}_count${renderLabels(labels)} ${state.count}`);
    }

    return `${lines.join('\n')}\n`;
  }
}

function estimatePercentile(state: HistogramState, percentile: number): number {
  if (state.count <= 0) {
    return 0;
  }

  const requiredCount = Math.ceil(state.count * percentile);
  let cumulative = 0;
  for (let index = 0; index < LATENCY_BUCKETS_MS.length; index += 1) {
    cumulative += state.buckets[index];
    if (cumulative >= requiredCount) {
      return LATENCY_BUCKETS_MS[index];
    }
  }

  return LATENCY_BUCKETS_MS[LATENCY_BUCKETS_MS.length - 1];
}

function metricKey(name: string, labels: MetricLabels): string {
  return `${name}|${JSON.stringify(sortLabels(labels))}`;
}

function parseMetricKey(key: string): { name: string; labels: MetricLabels } {
  const separatorIndex = key.indexOf('|');
  if (separatorIndex < 0) {
    return { name: key, labels: {} };
  }

  const name = key.slice(0, separatorIndex);
  const encodedLabels = key.slice(separatorIndex + 1);

  try {
    const parsed = JSON.parse(encodedLabels) as MetricLabels;
    return {
      name,
      labels: sortLabels(parsed),
    };
  } catch {
    return { name, labels: {} };
  }
}

function sortLabels(labels: MetricLabels): MetricLabels {
  return Object.entries(labels)
    .sort(([left], [right]) => left.localeCompare(right))
    .reduce<MetricLabels>((accumulator, [key, value]) => {
      accumulator[key] = value;
      return accumulator;
    }, {});
}

function sanitizeMetricName(name: string): string {
  const normalized = name.replace(/[^a-zA-Z0-9_:]/g, '_');
  if (/^[0-9]/.test(normalized)) {
    return `m_${normalized}`;
  }
  return normalized;
}

function renderLabels(labels: MetricLabels): string {
  const rows = Object.entries(labels);
  if (rows.length === 0) {
    return '';
  }

  const rendered = rows
    .map(([key, value]) => `${sanitizeMetricName(key)}="${escapeLabelValue(value)}"`)
    .join(',');
  return `{${rendered}}`;
}

function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}
