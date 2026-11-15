#!/bin/sh
# Weekly update: drop the new export into export/ (any subfolder, overlaps are fine), then run this.
set -e
cd "$(dirname "$0")"
python3 parse_export.py export "$@"
echo
grep -A20 "^## Do decyzji" review.md | sed '/^## Odrzucone/,$d'
printf "Publish? [y/N] "
read ans
[ "$ans" = "y" ] || exit 0
git add site/data.json config.json
git commit -m "Aktualizacja danych $(date +%Y-%m-%d)"
git push
