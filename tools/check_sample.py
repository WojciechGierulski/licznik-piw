#!/usr/bin/env python3
"""Regression check: run the parser on a synthetic chat and compare with its truth.json.

Usage: python3 tools/check_sample.py
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    subprocess.run([sys.executable, ROOT / "tools/make_sample.py", tmp / "sample"], check=True, capture_output=True)
    (tmp / "config.json").write_text("{}")
    subprocess.run([sys.executable, ROOT / "parse_export.py", tmp / "sample", "--config", tmp / "config.json",
                    "--out", tmp / "data.json", "--review", tmp / "review.md"], check=True, capture_output=True)
    truth = json.loads((tmp / "sample/truth.json").read_text())
    data = json.loads((tmp / "data.json").read_text())

expected = sum(k for _, _, k in truth)
got = sum(b[3] for b in data["beers"])
per_person = {}
for _, who, k in truth:
    per_person[who] = per_person.get(who, 0) + k
for b in data["beers"]:
    who = data["people"][b[1]]
    per_person[who] = per_person.get(who, 0) - b[3]
off = {w: -d for w, d in per_person.items() if d}
print(f"expected {expected} beers, parsed {got}; per-person differences: {off or 'none'}")
sys.exit(0 if abs(expected - got) <= expected * 0.005 and sum(map(abs, off.values())) <= expected * 0.01 else 1)
