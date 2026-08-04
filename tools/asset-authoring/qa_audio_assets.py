#!/usr/bin/env python3
"""Validate generated runtime audio for clipping, format, duration, and transfer budget."""
from __future__ import annotations

import argparse
import json
import wave
from pathlib import Path

import numpy as np

EXPECTED = {
    'ui-confirm.wav': (0.12, 0.3),
    'tether-attach.wav': (0.25, 0.5),
    'tether-loop.wav': (1.8, 2.2),
    'release-good.wav': (0.3, 0.7),
    'release-perfect.wav': (0.4, 0.8),
    'fragment.wav': (0.15, 0.4),
    'near-miss.wav': (0.3, 0.6),
    'failure.wav': (0.65, 1.1),
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--repo', type=Path, default=Path.cwd())
    args = parser.parse_args()
    root = args.repo / 'apps/game/public/assets/audio'
    failures: list[str] = []
    report: dict[str, object] = {'sampleRate': 24000, 'channels': 1, 'assets': {}}
    total = 0
    for filename, bounds in EXPECTED.items():
        path = root / filename
        if not path.exists():
            failures.append(f'missing: {filename}')
            continue
        with wave.open(str(path), 'rb') as handle:
            channels = handle.getnchannels()
            rate = handle.getframerate()
            width = handle.getsampwidth()
            frames = handle.getnframes()
            pcm = np.frombuffer(handle.readframes(frames), dtype='<i2').astype(np.float64) / 32768
        duration = frames / rate
        peak = float(np.max(np.abs(pcm))) if len(pcm) else 0
        dc = abs(float(np.mean(pcm))) if len(pcm) else 0
        size = path.stat().st_size
        total += size
        report['assets'][filename] = {'duration': round(duration, 4), 'peak': round(peak, 4), 'dc': round(dc, 6), 'bytes': size}
        if channels != 1 or rate != 24000 or width != 2:
            failures.append(f'{filename}: expected mono 24 kHz 16-bit PCM')
        if not bounds[0] <= duration <= bounds[1]:
            failures.append(f'{filename}: duration {duration:.3f}s outside {bounds}')
        if peak > 0.86:
            failures.append(f'{filename}: peak {peak:.3f} exceeds headroom limit')
        if dc > 0.005:
            failures.append(f'{filename}: DC offset {dc:.5f} exceeds limit')
    if total > 900 * 1024:
        failures.append(f'audio transfer total {total / 1024:.0f} KB exceeds 900 KB')
    report['totalBytes'] = total
    report['failures'] = failures
    output = args.repo / 'docs/qa/audio-assets-qa.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))
    if failures:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
