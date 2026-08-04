#!/usr/bin/env python3
"""Generate deterministic, project-owned Gravity Run gameplay audio assets."""
from __future__ import annotations

import argparse
import math
import wave
from pathlib import Path

import numpy as np

SAMPLE_RATE = 24000
RNG = np.random.default_rng(0x47524155)


def envelope(length: int, attack: float, release: float) -> np.ndarray:
    env = np.ones(length, dtype=np.float64)
    attack_samples = min(length, max(1, int(attack * SAMPLE_RATE)))
    release_samples = min(length, max(1, int(release * SAMPLE_RATE)))
    env[:attack_samples] = np.sin(np.linspace(0, math.pi / 2, attack_samples)) ** 2
    env[-release_samples:] *= np.cos(np.linspace(0, math.pi / 2, release_samples)) ** 2
    return env


def oscillator(frequency: np.ndarray | float, duration: float, phase: float = 0) -> np.ndarray:
    count = int(duration * SAMPLE_RATE)
    if np.isscalar(frequency):
        return np.sin(2 * math.pi * float(frequency) * np.arange(count) / SAMPLE_RATE + phase)
    frequency = np.asarray(frequency, dtype=np.float64)
    phase_values = np.cumsum(2 * math.pi * frequency / SAMPLE_RATE) + phase
    return np.sin(phase_values)


def lowpass(signal: np.ndarray, coefficient: float) -> np.ndarray:
    output = np.zeros_like(signal)
    for index in range(1, len(signal)):
        output[index] = output[index - 1] + coefficient * (signal[index] - output[index - 1])
    return output


def normalize(signal: np.ndarray, peak: float = 0.82) -> np.ndarray:
    signal = signal - float(np.mean(signal))
    maximum = float(np.max(np.abs(signal))) or 1.0
    return np.clip(signal / maximum * peak, -1, 1)


def write(path: Path, signal: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = (normalize(signal) * 32767).astype('<i2')
    with wave.open(str(path), 'wb') as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(SAMPLE_RATE)
        handle.writeframes(pcm.tobytes())


def ui_confirm() -> np.ndarray:
    duration = 0.18
    count = int(duration * SAMPLE_RATE)
    frequency = np.linspace(620, 1050, count)
    signal = oscillator(frequency, duration) + 0.35 * oscillator(frequency * 1.5, duration)
    return signal * envelope(count, 0.006, 0.08)


def tether_attach() -> np.ndarray:
    duration = 0.34
    count = int(duration * SAMPLE_RATE)
    frequency = np.geomspace(155, 720, count)
    metallic = oscillator(frequency, duration) + 0.45 * oscillator(frequency * 2.02, duration)
    click = lowpass(RNG.normal(0, 1, count), 0.2) * np.exp(-np.arange(count) / (SAMPLE_RATE * 0.035))
    return (metallic * 0.8 + click * 0.35) * envelope(count, 0.004, 0.13)


def tether_loop() -> np.ndarray:
    duration = 2.0
    count = int(duration * SAMPLE_RATE)
    t = np.arange(count) / SAMPLE_RATE
    modulation = 0.72 + 0.18 * np.sin(2 * math.pi * 2 * t) + 0.08 * np.sin(2 * math.pi * 5 * t)
    signal = (0.55 * np.sin(2 * math.pi * 55 * t) + 0.3 * np.sin(2 * math.pi * 110 * t) + 0.12 * np.sin(2 * math.pi * 220 * t)) * modulation
    shimmer = lowpass(RNG.normal(0, 0.15, count), 0.05)
    return signal + shimmer


def release(perfect: bool) -> np.ndarray:
    duration = 0.58 if perfect else 0.44
    count = int(duration * SAMPLE_RATE)
    start, end = ((240, 1480) if perfect else (210, 960))
    frequency = np.geomspace(start, end, count)
    signal = oscillator(frequency, duration)
    signal += 0.42 * oscillator(frequency * 1.5, duration, phase=0.4)
    signal += 0.2 * oscillator(frequency * 2.01, duration, phase=1.2)
    noise = lowpass(RNG.normal(0, 0.3, count), 0.15) * np.linspace(1, 0, count)
    return (signal + noise) * envelope(count, 0.006, 0.2)


def fragment() -> np.ndarray:
    duration = 0.25
    count = int(duration * SAMPLE_RATE)
    t = np.arange(count) / SAMPLE_RATE
    signal = sum(oscillator(freq, duration, phase=index * 0.3) * (0.7 / (index + 1)) for index, freq in enumerate((740, 1110, 1480)))
    signal += 0.15 * np.sin(2 * math.pi * 12 * t) * oscillator(1850, duration)
    return signal * envelope(count, 0.003, 0.15)


def near_miss() -> np.ndarray:
    duration = 0.42
    count = int(duration * SAMPLE_RATE)
    raw = RNG.normal(0, 1, count)
    smooth = lowpass(raw, 0.08)
    high = raw - lowpass(raw, 0.01)
    sweep = oscillator(np.geomspace(180, 840, count), duration) * 0.28
    pan_shape = np.sin(np.linspace(0, math.pi, count)) ** 1.7
    return (smooth * 0.55 + high * 0.18 + sweep) * pan_shape


def failure() -> np.ndarray:
    duration = 0.86
    count = int(duration * SAMPLE_RATE)
    frequency = np.geomspace(190, 38, count)
    signal = oscillator(frequency, duration)
    signal += 0.52 * oscillator(frequency * 1.48, duration, phase=0.8)
    impact = lowpass(RNG.normal(0, 1, count), 0.12) * np.exp(-np.arange(count) / (SAMPLE_RATE * 0.16))
    return (signal * 0.68 + impact * 0.75) * envelope(count, 0.003, 0.28)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--repo', type=Path, default=Path.cwd())
    args = parser.parse_args()
    output = args.repo / 'apps/game/public/assets/audio'
    assets = {
        'ui-confirm.wav': ui_confirm(),
        'tether-attach.wav': tether_attach(),
        'tether-loop.wav': tether_loop(),
        'release-good.wav': release(False),
        'release-perfect.wav': release(True),
        'fragment.wav': fragment(),
        'near-miss.wav': near_miss(),
        'failure.wav': failure(),
    }
    for filename, signal in assets.items():
        write(output / filename, signal)
        print(filename, len(signal) / SAMPLE_RATE)


if __name__ == '__main__':
    main()
