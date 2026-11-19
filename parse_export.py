#!/usr/bin/env python3
"""Turn Facebook Messenger exports into site/data.json for the beer dashboard.

Usage:
    python3 parse_export.py [PATH ...] [--thread NAME] [--out site/data.json]

PATH defaults to ./exports. It can be a folder (searched recursively), a .zip from
"Download your information", a single message_N.json, or the JSON from the
end-to-end-encrypted chat download. Overlapping exports are merged and deduplicated,
so you can keep dropping new exports into exports/ without cleaning old ones.

Besides data.json it writes review.md: the cases a human should look at once a week
(gaps in the counter, ambiguous posts, rejections). Decisions go into config.json.

Counting rules (see README for the config keys):
  1. A counter post is a message whose number(s) continue the group counter.
     "58,59", "131 132", "136 i 137", "184-190" and a burst of single numbers sent
     by one person within a minute all mean several beers.
  2. It is credited only with a photo/video (not a gif) from the same sender within
     +-photo_window_sec, or failing that an unused photo up to photo_fallback_sec
     before the post ("To się liczy?" ... "129, no homo").
  3. A single number that skips ahead (52 -> 54) credits the poster with as many beers
     as photos they sent; the missing numbers go to whoever posted an unclaimed photo
     in between, or to the poster if nobody did, or to review.md if it is ambiguous.
  4. The same number posted by another person within collision_window_sec counts too.
  5. A bare number without a photo still moves the counter (others continue from it)
     but earns nothing. Chatter with a number and no photo is ignored entirely.
"""
import argparse
import bisect
import json
import re
import shutil
import sys
import zipfile
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_CONFIG = {
    "title": None,
    "photo_window_sec": 180,
    "photo_fallback_sec": 1800,
    "photo_same_sender": True,
    "max_jump": 12,
    "burst_sec": 60,
    "collision_window_sec": 900,
    "resync_lookahead": 3,
    "day_start_hour": 6,
    "aliases": {},          # {"Name in export or backfill": "Canonical name"}
    "exclude": [],          # people to drop entirely
    "backfill": {},         # beers from before this chat: {"date": "2026-11-02", "beers": {"Name": n}}
    "assign": {},           # gap numbers decided by hand: {"53": "Name"}
    "skip_messages": [],    # timestamp_ms of counter posts rejected by hand (VAR)
    "accept_messages": [],  # timestamp_ms of counter posts credited without a photo (VAR forgave)
    "publish_photos": True, # copy the photos behind credited beers to site/media/
}

TOKEN_RE = re.compile(r"\d+(?:[.,:]\d+)?")
RANGE_RE = re.compile(r"(?<![\d.,:])(\d{1,5})\s*[-–—]\s*(\d{1,5})(?![\d.,:])")
FILLER_RE = re.compile(
    r"\b(cyk|piwo|piwko|piwa|browar|browarek|nr|numer|no|i|oraz|jest|leci|wjeżdża|wjezdza|"
    r"zdrówko|zdrowko|kolejne|kolejny|następne|nastepne|plus|szt|x)\b",
    re.IGNORECASE,
)


# ---------------------------------------------------------------- loading

def fix_text(s):
    """FB DYI exports store UTF-8 bytes as latin-1 code points ('Å\x82' instead of 'ł')."""
    if not isinstance(s, str):
        return s
    try:
        return s.encode("latin-1").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return s


def iter_json_docs(paths):
    for p in map(Path, paths):
        if p.is_dir():
            for f in sorted(p.rglob("*.json")):
                yield from _load_file(f)
        elif p.suffix == ".zip":
            with zipfile.ZipFile(p) as z:
                for name in sorted(z.namelist()):
                    if name.endswith(".json"):
                        try:
                            yield json.loads(z.read(name))
                        except (json.JSONDecodeError, UnicodeDecodeError):
                            continue
        elif p.is_file():
            yield from _load_file(p)
        else:
            sys.exit(f"Not found: {p}")


def _load_file(f):
    try:
        yield json.loads(f.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return


def normalize(doc):
    """Return (thread_key, title, [msg]) for either export format, or None."""
    if not isinstance(doc, dict) or not isinstance(doc.get("messages"), list):
        return None
    out = []
    if "threadName" in doc or any("senderName" in m for m in doc["messages"][:5]):  # E2EE download
        title = doc.get("threadName") or "?"
        for m in doc["messages"]:
            media = [x for x in m.get("media") or [] if not str(x.get("uri", "")).lower().endswith(".gif")]
            out.append({"ts": int(m.get("timestamp", 0)), "who": m.get("senderName", "?"),
                        "text": m.get("text") or "", "media": len(media),
                        "uris": [str(x.get("uri", "")) for x in media],
                        "react": len(m.get("reactions") or [])})
        return title, title, out
    title = fix_text(doc.get("title") or "?")
    key = doc.get("thread_path") or title
    for m in doc["messages"]:
        media = (m.get("photos") or []) + (m.get("videos") or [])  # gifs are memes, not proof
        out.append({"ts": int(m.get("timestamp_ms", 0)), "who": fix_text(m.get("sender_name", "?")),
                    "text": fix_text(m.get("content") or ""), "media": len(media),
                    "uris": [str(x.get("uri", "")) for x in media],
                    "react": len(m.get("reactions") or [])})
    return key, title, out


def load_threads(paths):
    """Merge every export of the same chat; overlapping exports are deduplicated."""
    threads, titles = defaultdict(dict), {}
    for doc in iter_json_docs(paths):
        r = normalize(doc)
        if not r:
            continue
        key, title, msgs = r
        titles[key] = title
        for m in msgs:
            k = (m["ts"], m["who"], m["text"])
            old = threads[key].get(k)
            if old is None or (m["media"], m["react"]) > (old["media"], old["react"]):
                threads[key][k] = m
    return {key: (titles[key], sorted(ms.values(), key=lambda m: m["ts"])) for key, ms in threads.items()}


# ---------------------------------------------------------------- parsing a post

def numbers_in(text):
    """Integers in a message; ranges expanded, decimals and clock times skipped.

    Returns (numbers, is_bare, is_correction). A bare post holds nothing but the
    counter (plus emoji, punctuation and a few filler words).
    """
    t = text.strip()
    nums = []
    spans = []
    for m in RANGE_RE.finditer(t):
        a, b = int(m.group(1)), int(m.group(2))
        if 0 < b - a <= 30:
            nums.extend(range(a, b + 1))
            spans.append(m.span())
    for m in TOKEN_RE.finditer(t):
        if any(s <= m.start() < e for s, e in spans):
            continue
        tok = m.group()
        if ":" in tok:
            continue  # 20:10
        if "," in tok or "." in tok:
            a, b = re.split(r"[.,]", tok)
            if int(b) == int(a) + 1:
                nums.extend([int(a), int(b)])  # "58,59"
            continue  # "0,5"
        nums.append(int(tok))
    rest = RANGE_RE.sub(" ", t)
    rest = TOKEN_RE.sub(" ", rest)
    rest = FILLER_RE.sub(" ", rest)
    rest = re.sub(r"[\W_]+", " ", rest, flags=re.UNICODE).strip()  # drops emoji & punctuation
    return nums, rest == "", "*" in t


# ---------------------------------------------------------------- photos

class PhotoPool:
    """Photos sorted by time; each one can back a single beer."""

    def __init__(self, msgs):
        self.items = [(m["ts"], m["who"], i, j) for i, m in enumerate(msgs) for j in range(m["media"])]
        self.msgs = msgs
        self.items.sort()
        self.times = [x[0] for x in self.items]
        self.used = [False] * len(self.items)

    def near(self, ts, who, before_ms, after_ms):
        lo = bisect.bisect_left(self.times, ts - before_ms)
        hi = bisect.bisect_right(self.times, ts + after_ms)
        idx = [k for k in range(lo, hi) if not self.used[k] and (who is None or self.items[k][1] == who)]
        return sorted(idx, key=lambda k: abs(self.times[k] - ts))

    def between(self, t0, t1, exclude_who=None):
        lo = bisect.bisect_right(self.times, t0)
        hi = bisect.bisect_left(self.times, t1)
        return [k for k in range(lo, hi) if not self.used[k] and self.items[k][1] != exclude_who]

    def files(self, ks):
        out = []
        for k in ks:
            _, _, i, j = self.items[k]
            uris = self.msgs[i].get("uris") or []
            if j < len(uris) and uris[j]:
                out.append(Path(uris[j]).name)
        return out

    def take(self, ks):
        for k in ks:
            self.used[k] = True


# ---------------------------------------------------------------- counting

def count_beers(msgs, cfg):
    aliases, exclude = cfg["aliases"], set(cfg["exclude"])
    for m in msgs:
        m["who"] = aliases.get(m["who"], m["who"])
    msgs = [m for m in msgs if m["who"] not in exclude]
    skip = set(int(x) for x in cfg["skip_messages"])
    accept = set(int(x) for x in cfg["accept_messages"])
    assign = {int(k): aliases.get(v, v) for k, v in cfg["assign"].items()}

    # 1. candidate posts, with bursts of one sender merged into one post
    posts = []
    for i, m in enumerate(msgs):
        if not m["text"] or m["ts"] in skip:
            continue
        nums, bare, corr = numbers_in(m["text"])
        if not nums:
            continue
        p = posts[-1] if posts else None
        if (p and bare and p["bare"] and p["who"] == m["who"] and m["ts"] - p["ts_last"] <= cfg["burst_sec"] * 1000
                and nums[0] > p["nums"][-1]):
            p["nums"] += nums
            p["ts_last"] = m["ts"]
            p["idx"].append(i)
            p["text"] += " | " + m["text"]
            continue
        posts.append({"ts": m["ts"], "ts_last": m["ts"], "who": m["who"], "nums": nums, "bare": bare,
                      "corr": corr, "idx": [i], "text": m["text"]})

    pool = PhotoPool(msgs)
    win, fb = cfg["photo_window_sec"] * 1000, cfg["photo_fallback_sec"] * 1000
    max_jump, look = cfg["max_jump"], cfg["resync_lookahead"]
    same = cfg["photo_same_sender"]
    beers, rejected, review = [], [], []
    counter, last = None, None  # last: (number, who, ts) of the last post that moved the counter

    def continues_from(start, j):
        cur, hits = start, 0
        for q in posts[j + 1:j + 1 + look * 3]:
            if not q["bare"]:
                continue
            n = q["nums"][0]
            if 0 < n - cur <= max_jump:
                cur, hits = q["nums"][-1], hits + 1
                if hits >= look:
                    return True
            elif n != cur:
                return False
        return hits >= 1 and j + 1 + look * 3 >= len(posts)

    def reactions(p, photo_ks):
        return sum(msgs[i]["react"] for i in p["idx"]) + sum(msgs[pool.items[k][2]]["react"] for k in set(photo_ks))

    def reject(p, reason):
        rejected.append({"t": p["ts"] // 1000, "who": p["who"], "text": p["text"][:80], "reason": reason})

    def credit(t, who, n, c, kind, react=0, ks=()):
        beers.append([t // 1000, who, n, c, kind, react, pool.files(ks)])

    for j, p in enumerate(posts):
        if counter is None:
            if p["bare"] and continues_from(p["nums"][-1], j):
                counter = p["nums"][0] - 1
            else:
                continue

        new = sorted({n for n in p["nums"] if 0 < n - counter <= max_jump})
        if new and not p["bare"] and new[0] != counter + 1:
            new = []  # chatter must hit exactly the next number ("jutro grill, 15 osób")
        # keep only the run that continues the counter ("184-190", "181 182 183")
        run = []
        for n in new:
            if not run or n == run[-1] + 1:
                run.append(n)
            else:
                break

        photos = pool.near(p["ts"], p["who"] if same else None, win, win)
        if not photos:
            photos = pool.near(p["ts"], p["who"] if same else None, fb, 0)
        # a photo closer to the sender's next counter post belongs to that post
        nxt = next((q for q in posts[j + 1:j + 20] if q["who"] == p["who"] and q["ts"] - p["ts_last"] <= 2 * win), None)
        if nxt:
            dist = lambda k: min(abs(pool.times[k] - p["ts"]), abs(pool.times[k] - p["ts_last"]))
            photos = [k for k in photos if dist(k) <= abs(pool.times[k] - nxt["ts"])]

        if not run:
            n0 = p["nums"][0]
            if p["bare"] and len(p["nums"]) == 1 and n0 == counter and last and last[1] != p["who"] \
                    and p["ts"] - last[2] <= cfg["collision_window_sec"] * 1000 and photos:
                pool.take(photos[:1])
                credit(p["ts"], p["who"], n0, 1, "collision", reactions(p, photos[:1]), photos[:1])
                review.append(f"Kolizja: {p['who']} też wrzucił #{n0} (po {last[1]}), obaj dostają piwo")
            elif p["bare"] and n0 != counter and p["nums"][-1] > counter and continues_from(p["nums"][-1], j):
                review.append(f"Resynchronizacja licznika {counter} → {p['nums'][-1]}: „{p['text']}” ({p['who']})")
                counter = p["nums"][-1]
                last = (counter, p["who"], p["ts"])
                if photos:
                    pool.take(photos[:1])
                    credit(p["ts"], p["who"], counter, 1, "resync", reactions(p, photos[:1]), photos[:1])
            elif p["bare"]:
                reject(p, "korekta" if p["corr"] else ("numer już był" if n0 <= counter else "poza kolejnością"))
            continue

        if not photos and any(msgs[i]["ts"] in accept for i in p["idx"]):
            credit(p["ts"], p["who"], run[-1], len(run), "seq", reactions(p, []))
            review.append(f"VAR: „{p['text']}” ({p['who']}) zaliczone bez zdjęcia (accept_messages)")
            counter, last = run[-1], (run[-1], p["who"], p["ts"])
            continue
        if not photos and same and len(run) == 1:
            # someone posted the number for a friend: an unclaimed photo by another person
            # who did not post a number themselves around that time
            posters = {q["who"] for q in posts[max(0, j - 5):j + 6] if abs(q["ts"] - p["ts"]) <= win}
            other = [k for k in pool.near(p["ts"], None, win, win) if pool.items[k][1] not in posters]
            if other:
                k = other[0]
                pool.take([k])
                owner = pool.items[k][1]
                credit(p["ts"], owner, run[0], 1, "seq", reactions(p, [k]), [k])
                review.append(f"Numer za kogoś: {p['who']} wpisał #{run[0]}, zdjęcie wrzucił {owner} → piwo dla {owner}")
                counter, last = run[0], (run[0], p["who"], p["ts"])
                continue
        if not photos:
            if p["bare"]:  # others will continue from this number, so the counter moves
                reject(p, "korekta" if p["corr"] else "bez zdjęcia")
                counter, last = run[-1], (run[-1], p["who"], p["ts"])
            continue

        top = run[-1]
        gap = [n for n in range(counter + 1, top + 1) if n not in run]
        explicit = len(run)
        if len(p["nums"]) == 1 and gap:  # single number that skipped ahead: 52 -> 54
            own = min(explicit + len(gap), len(photos))
            extra = own - explicit
            gap, mine = gap[extra:], gap[:extra]
            explicit = own
        taken = photos[:min(explicit, len(photos))]
        pool.take(taken)
        credit(p["ts"], p["who"], top, explicit, "seq", reactions(p, taken), taken)

        if gap:
            prev_ts = last[2] if last else p["ts"] - 6 * 3600 * 1000
            decided = [n for n in gap if n in assign]
            for n in decided:
                credit(p["ts"], assign[n], n, 1, "assigned")
            open_gap = [n for n in gap if n not in assign]
            orphans = pool.between(prev_ts, p["ts"] - win, exclude_who=p["who"]) if open_gap else []
            if open_gap and len(orphans) == len(open_gap):
                for n, k in zip(open_gap, orphans):
                    pool.take([k])
                    who = pool.items[k][1]
                    credit(pool.items[k][0], who, n, 1, "gap", msgs[pool.items[k][2]]["react"], [k])
                    review.append(f"Luka #{n}: przypisana do {who} (zdjęcie bez numeru "
                                  f"{datetime.fromtimestamp(pool.items[k][0] / 1000):%d.%m %H:%M})")
            elif open_gap and not orphans:
                review.append(f"Pominięty numer {', '.join('#%d' % n for n in open_gap)}: przed „{p['text']}” "
                              f"({p['who']}) nikt nie wrzucił zdjęcia, więc nikt go nie dostaje")
            elif open_gap:
                cands = Counter(pool.items[k][1] for k in orphans)
                review.append(f"**DO DECYZJI** luka {', '.join('#%d' % n for n in open_gap)} przed „{p['text']}” "
                              f"({p['who']}). Zdjęcia bez numeru od: "
                              + ", ".join(f"{w} ×{c}" for w, c in cands.items())
                              + f". Dopisz do config.json → \"assign\": {{\"{open_gap[0]}\": \"Imię Nazwisko\"}}")
        if not p["bare"]:
            review.append(f"Numer w tekście: „{p['text']}” → #{top} dla {p['who']}")
        if len(run) > 1:
            review.append(f"Kilka piw naraz: „{p['text']}” → {len(run)} dla {p['who']}")
        counter, last = top, (top, p["who"], p["ts"])
    return beers, rejected, counter, review


# ---------------------------------------------------------------- media

def publish_media(paths, names, dest):
    """Copy the photos/videos behind credited beers into the site; drop the ones no longer used."""
    wanted = set(names)
    found = {}
    for p in map(Path, paths):
        if p.is_dir():
            for f in p.rglob("*"):
                if f.name in wanted and f.is_file():
                    found.setdefault(f.name, f)
        elif p.suffix == ".zip":
            with zipfile.ZipFile(p) as z:
                for n in z.namelist():
                    if Path(n).name in wanted:
                        found.setdefault(Path(n).name, (p, n))
    dest.mkdir(parents=True, exist_ok=True)
    for old in dest.iterdir():
        if old.name not in wanted:
            old.unlink()
    copied = 0
    for name, src in found.items():
        target = dest / name
        if target.exists():
            continue
        if isinstance(src, tuple):
            with zipfile.ZipFile(src[0]) as z, z.open(src[1]) as fh, open(target, "wb") as out:
                shutil.copyfileobj(fh, out)
        else:
            shutil.copy2(src, target)
        copied += 1
    missing = len(wanted) - len(found)
    return f"media: {len(found)} files ({copied} new){f', {missing} missing in export' if missing else ''}"


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("paths", nargs="*", default=["export"])
    ap.add_argument("--thread", help="part of the group chat name (when the export has many chats)")
    ap.add_argument("--config", default="config.json")
    ap.add_argument("--out", default="site/data.json")
    ap.add_argument("--review", default="review.md")
    args = ap.parse_args()

    cfg = dict(DEFAULT_CONFIG)
    if Path(args.config).exists():
        cfg.update(json.loads(Path(args.config).read_text(encoding="utf-8")))

    threads = load_threads(args.paths)
    if not threads:
        sys.exit("No Messenger chats found in the given paths.")
    if args.thread:
        pick = [k for k, (t, _) in threads.items() if args.thread.lower() in (t + k).lower()]
    else:
        pick = list(threads) if len(threads) == 1 else []
    if len(pick) != 1:
        ranked = sorted(threads.items(), key=lambda kv: -len(kv[1][1]))[:30]
        sys.exit("Choose a chat with --thread (substring). Found:\n"
                 + "\n".join(f"  {len(v[1]):>7} msgs  {v[0]}  [{k}]" for k, v in ranked))
    title, msgs = threads[pick[0]]

    beers, rejected, counter, review = count_beers(msgs, cfg)
    if not beers:
        sys.exit("Found the chat, but no counter posts with photos. Check config.json.")

    # beers from the previous chat: {"date": "YYYY-MM-DD", "beers": {"Name": n}}, numbered 1..N
    bf = cfg["backfill"] or {}
    bf_beers = {cfg["aliases"].get(k, k): v for k, v in (bf.get("beers") or {}).items()}
    if bf_beers:
        bf_ts = int(datetime.strptime(bf.get("date", "1970-01-01") + " 20:00", "%Y-%m-%d %H:%M").timestamp() * 1000)
        n = 0
        for w, c in bf_beers.items():
            n += c
            beers.append([bf_ts // 1000, w, n, c, "backfill", 0, []])
        beers.sort(key=lambda b: b[0])
    backfill_total = sum(bf_beers.values())
    totals = Counter()
    for b in beers:
        totals[b[1]] += b[3]
    people = [p for p, _ in totals.most_common()]
    first_seen = {}
    for m in msgs:  # sorted by time; count_beers already applied aliases
        first_seen.setdefault(m["who"], m["ts"])
    idx = {p: k for k, p in enumerate(people)}
    kind_code = {"seq": "s", "collision": "c", "resync": "r", "gap": "g", "assigned": "a", "backfill": "b"}
    data = {
        "title": cfg["title"] or title,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "first_message": msgs[0]["ts"] // 1000,
        "last_message": msgs[-1]["ts"] // 1000,
        "day_start_hour": cfg["day_start_hour"],
        "counter": counter,
        "people": people,
        # [unix seconds, person index, counter number, beers credited, kind, reactions, photo files]
        "beers": [[t, idx[w], n, c, kind_code[k], r, f] for t, w, n, c, k, r, f in beers],
        "joined": [first_seen.get(w, 0) // 1000 for w in people],  # first message in the chat
        "messages_total": len(msgs),
    }
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    media_note = publish_media(args.paths, [f for b in beers for f in b[6]], Path(args.out).parent / "media") \
        if cfg["publish_photos"] else "photos not published"
    credited = sum(b[3] for b in beers if b[4] != "backfill")
    reasons = Counter(r["reason"] for r in rejected)
    todo = [r for r in review if r.startswith("**")]
    lines = [
        f"# Przegląd: {title}",
        f"Wygenerowano {datetime.now():%Y-%m-%d %H:%M}. Wiadomości: {len(msgs)} "
        f"({datetime.fromtimestamp(msgs[0]['ts'] / 1000):%d.%m.%Y} – {datetime.fromtimestamp(msgs[-1]['ts'] / 1000):%d.%m.%Y %H:%M})",
        "",
        f"- Licznik grupy: **{counter}**",
        f"- Zaliczone piwa: **{credited + backfill_total}** (w tym backfill {backfill_total})",
        f"- Różnica licznik − zaliczone: {counter - credited - backfill_total} "
        "(posty bez zdjęcia, nierozstrzygnięte luki; kolizje działają w drugą stronę)",
        f"- Odrzucone: {dict(reasons)}",
        "",
        f"## Do decyzji ({len(todo)})",
        *(f"- {r}" for r in todo), *([] if todo else ["- nic, wszystko rozstrzygnięte automatycznie"]),
        "",
        "## Odrzucone posty",
        *(f"- {datetime.fromtimestamp(r['t']):%d.%m %H:%M} {r['who']}: „{r['text']}” → {r['reason']}" for r in rejected),
        "",
        "## Decyzje automatyczne",
        *(f"- {r}" for r in review if not r.startswith("**")),
    ]
    Path(args.review).write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(f"Chat: {title}  ({len(msgs)} messages)")
    print(f"Counter: {counter}   credited: {credited} + backfill {backfill_total}   people: {len(people)}")
    print(f"Rejected: {dict(reasons)}   to decide: {len(todo)}  -> {args.review}")
    for p in people[:10]:
        print(f"  {totals[p]:>5}  {p}")
    print(f"-> {args.out}   ({media_note})")


if __name__ == "__main__":
    main()
