export interface BenchmarkSample {
  frameTimeMilliseconds: number;
  drawCalls: number;
  triangles: number;
}

export interface BenchmarkSummary {
  medianFrameTimeMilliseconds: number;
  p95FrameTimeMilliseconds: number;
  recommendedTier: 'compatibility' | 'mobile' | 'desktop' | 'cinematic';
}

export function summarizeBenchmark(samples: BenchmarkSample[]): BenchmarkSummary {
  if (samples.length === 0) {
    return {
      medianFrameTimeMilliseconds: Number.POSITIVE_INFINITY,
      p95FrameTimeMilliseconds: Number.POSITIVE_INFINITY,
      recommendedTier: 'compatibility',
    };
  }

  const frameTimes = samples.map((sample) => sample.frameTimeMilliseconds).sort((a, b) => a - b);
  const median = percentile(frameTimes, 0.5);
  const p95 = percentile(frameTimes, 0.95);

  return {
    medianFrameTimeMilliseconds: median,
    p95FrameTimeMilliseconds: p95,
    recommendedTier:
      p95 <= 11 ? 'cinematic' : p95 <= 16.7 ? 'desktop' : p95 <= 25 ? 'mobile' : 'compatibility',
  };
}

function percentile(sortedValues: number[], ratio: number): number {
  const index = Math.min(Math.floor((sortedValues.length - 1) * ratio), sortedValues.length - 1);
  return sortedValues[index] ?? Number.POSITIVE_INFINITY;
}
