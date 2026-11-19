#!/usr/bin/env python3
"""Rename export folders to <date of last message>_<chat>, e.g. licznikpiw_1103... -> 2026-11-18_licznikpiw.

Usage: python3 tools/name_exports.py [export]
Folders that already start with a date are left alone.
"""
import json
import re
import sys
from datetime import datetime
from pathlib import Path

root = Path(sys.argv[1] if len(sys.argv) > 1 else "export")
for folder in sorted(p for p in root.iterdir() if p.is_dir()):
    if re.match(r"\d{4}-\d{2}-\d{2}_", folder.name):
        continue
    stamps = []
    for f in folder.rglob("message_*.json"):
        try:
            stamps += [m.get("timestamp_ms", 0) for m in json.loads(f.read_text(encoding="utf-8")).get("messages", [])]
        except (json.JSONDecodeError, UnicodeDecodeError):
            pass
    if not stamps:
        continue
    chat = re.sub(r"_\d+$", "", folder.name)
    target = root / f"{datetime.fromtimestamp(max(stamps) / 1000):%Y-%m-%d}_{chat}"
    n = 2
    while target.exists():
        target = target.with_name(f"{target.name.split('~')[0]}~{n}")
        n += 1
    folder.rename(target)
    print(f"{folder.name} -> {target.name}")
