#!/usr/bin/env python3
"""Generate and audit deterministic runtime assets."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def run(command: list[str], cwd: Path) -> None:
    print('+', ' '.join(command))
    subprocess.run(command, cwd=cwd, check=True)


def main() -> None:
    repo = Path(__file__).resolve().parents[2]
    run([sys.executable, 'tools/asset-authoring/generate_gravity_wells.py', '--repo', '.'], repo)
    run([sys.executable, 'tools/asset-authoring/qa_gravity_wells.py', '--repo', '.'], repo)
    run([sys.executable, 'tools/asset-authoring/generate_audio_assets.py', '--repo', '.'], repo)
    run([sys.executable, 'tools/asset-authoring/qa_audio_assets.py', '--repo', '.'], repo)


if __name__ == '__main__':
    main()
