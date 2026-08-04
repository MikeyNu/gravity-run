# Gravity Run production checkpoints

This file exists to keep long implementation sessions recoverable and reviewable.

## Operating rule

1. Only one production tranche may be `in_progress`.
2. Each tranche has explicit evidence paths in `content/manifests/production-checkpoints.json`.
3. The tranche is generated, validated, visually reviewed, integrated, committed and pushed before another tranche begins.
4. A failed QA command blocks publication. It does not get weakened merely to produce a green result.
5. Temporary fallbacks remain available until the authored asset has loaded successfully.
6. The architecture gap audit is updated after every published tranche.

Run:

```bash
python3 tools/validate_production_checkpoints.py --repo .
```

The current active tranche is the modular Shattered Vertical City environment kit.
