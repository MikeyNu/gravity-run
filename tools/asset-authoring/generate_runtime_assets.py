#!/usr/bin/env python3
"""Generate and audit every published deterministic runtime-asset family."""
from __future__ import annotations

import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Stage:
    script: str
    timeout_seconds: int


STAGES = (
    Stage('generate_gravity_wells.py', 300),
    Stage('qa_gravity_wells.py', 90),
    Stage('generate_audio_assets.py', 90),
    Stage('qa_audio_assets.py', 60),
    Stage('generate_gameplay_props.py', 360),
    Stage('qa_gameplay_props.py', 90),
    Stage('render_gameplay_props_preview.py', 180),
    Stage('generate_city_environment.py', 480),
    Stage('qa_city_environment.py', 120),
    Stage('render_city_environment_preview.py', 180),
)


def run(stage: Stage, cwd: Path) -> None:
    command = [sys.executable, f'tools/asset-authoring/{stage.script}', '--repo', '.']
    print(f"+ {' '.join(command)} [timeout={stage.timeout_seconds}s]", flush=True)
    started = time.monotonic()
    try:
        subprocess.run(command, cwd=cwd, check=True, timeout=stage.timeout_seconds)
    except subprocess.TimeoutExpired as error:
        elapsed = time.monotonic() - started
        raise SystemExit(
            f"asset stage timed out after {elapsed:.1f}s: {stage.script}"
        ) from error
    elapsed = time.monotonic() - started
    print(f"[asset-stage] {stage.script} completed in {elapsed:.1f}s", flush=True)


def main() -> None:
    repo = Path(__file__).resolve().parents[2]
    for stage in STAGES:
        run(stage, repo)


if __name__ == '__main__':
    main()
