#!/usr/bin/env python3
"""Fail fast when the production workstream loses its single-tranche discipline."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

VALID = {"pending", "in_progress", "complete", "blocked"}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    args = parser.parse_args()
    manifest_path = args.repo / "content/manifests/production-checkpoints.json"
    data = json.loads(manifest_path.read_text())
    failures: list[str] = []
    active: list[str] = []

    for tranche in data.get("tranches", []):
        tranche_id = tranche.get("id", "<missing-id>")
        status = tranche.get("status")
        if status not in VALID:
            failures.append(f"{tranche_id}: invalid status {status!r}")
            continue
        if status == "in_progress":
            active.append(tranche_id)
        if status == "complete":
            evidence = tranche.get("evidence", [])
            if not evidence:
                failures.append(f"{tranche_id}: complete tranche has no evidence")
            for relative in evidence:
                if not (args.repo / relative).exists():
                    failures.append(f"{tranche_id}: missing evidence {relative}")

    if len(active) > 1:
        failures.append(f"multiple active tranches: {active}")

    print(json.dumps({"active": active, "failures": failures}, indent=2))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
