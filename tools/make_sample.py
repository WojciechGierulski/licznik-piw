#!/usr/bin/env python3
"""Generate a synthetic Messenger export (Facebook DYI JSON format) for testing.

Reproduces the quirks of a real export:
  * messages split into message_1.json, message_2.json ... newest first,
  * Polish characters mojibake'd (UTF-8 bytes stored as latin-1 code points),
  * photos sent as a separate message or attached to the counter message,
  * collisions (two people posting the same number), jumps ("cyk 60"),
  * typos, posts without a photo, and chatter that contains numbers.

Usage: python3 tools/make_sample.py sample_export
"""
import json
import random
import sys
from datetime import datetime, timedelta
from pathlib import Path

PEOPLE = {
    "Bartek Nowak": 1.6, "Kuba Wiśniewski": 1.3, "Michał Zając": 1.0,
    "Paweł Kowalczyk": 0.9, "Łukasz Dąbrowski": 0.7, "Tomek Lewandowski": 0.6,
    "Grzesiek Wójcik": 0.45, "Adam Kamiński": 0.3,
}
CHATTER = [
    "kto dziś na mieście?", "o 20 pod Kolumną?", "ja wpadnę koło 21", "ale upał dzisiaj",
    "mecz o 18:30", "dawaj dawaj", "zdrówko 🍻", "co to za browar?", "IPA czy lager?",
    "w Biedrze promka 4+2", "ja dziś odpoczywam", "jutro grill u mnie, 15 osób będzie",
    "kurde 3 dni bez piwa", "haha", "🍺🍺🍺", "szacun", "kozak", "ładna pianka",
]
SUFFIXES = ["", "", "", "", " 🍺", "!", " 🍻", " zdrówko", "."]


def mojibake(s):
    return s.encode("utf-8").decode("latin-1")


def main(out):
    random.seed(7)
    names = list(PEOPLE)
    weights = list(PEOPLE.values())
    msgs = []
    counter = 0
    truth = []  # (timestamp_ms, sender, beers) that should be credited
    day = datetime(2026, 1, 1)
    end = datetime(2026, 11, 13)

    def add(sender, ts, content=None, photos=0):
        m = {"sender_name": mojibake(sender), "timestamp_ms": int(ts.timestamp() * 1000),
             "is_geoblocked_for_viewer": False}
        if content is not None:
            m["content"] = mojibake(content)
        if photos:
            m["photos"] = [{"uri": f"messages/inbox/piwo/photos/{random.randint(1, 10**9)}.jpg",
                            "creation_timestamp": int(ts.timestamp())} for _ in range(photos)]
        msgs.append(m)

    while day < end:
        weekend = day.weekday() >= 4
        summer = 1.4 if day.month in (6, 7, 8) else 1.0
        n_beers = max(0, int(random.gauss(5 if weekend else 2, 2.5) * summer))
        times = sorted(day + timedelta(hours=random.choice([12, 15, 17, 18, 19, 20, 21, 22, 23, 24, 25]),
                                       minutes=random.randint(0, 59)) for _ in range(n_beers))
        for t in times:
            who = random.choices(names, weights)[0]
            r = random.random()
            if r < 0.04 and counter > 5:      # collision: someone else posts the same number
                counter += 1
                other = random.choice([n for n in names if n != who])
                add(who, t, None, photos=1)
                add(who, t + timedelta(seconds=20), f"{counter}")
                add(other, t + timedelta(seconds=40), None, photos=1)
                add(other, t + timedelta(seconds=55), f"{counter}")
                truth += [(t + timedelta(seconds=20), who, 1), (t + timedelta(seconds=55), other, 1)]
                continue
            if r < 0.07:                      # jump: several beers at once
                k = random.randint(2, 3)
                counter += k
                nums = list(range(counter - k + 1, counter + 1))
                text = random.choice([f"{nums[0]}-{nums[-1]}", ", ".join(map(str, nums)), " ".join(map(str, nums)),
                                      " i ".join(map(str, nums))])
                add(who, t, text, photos=random.randint(1, k))
                truth.append((t, who, k))
                continue
            counter += 1
            text = f"{counter}{random.choice(SUFFIXES)}"
            if r < 0.10:                      # forgot the photo
                add(who, t, text)
                continue
            if r < 0.12:                      # typo, then correction
                add(who, t - timedelta(seconds=30), None, photos=1)
                add(who, t, f"{counter}{counter % 10}")
                add(who, t + timedelta(seconds=50), f"*{counter}")
                truth.append((t + timedelta(seconds=50), who, 1))
                continue
            if r < 0.45:                      # photo attached to the number
                add(who, t, text, photos=1)
                truth.append((t, who, 1))
            else:                             # photo as a separate message
                offset = timedelta(seconds=random.randint(-150, 150))
                add(who, t + offset, None, photos=1)
                add(who, t, text)
                truth.append((t, who, 1))
        for _ in range(random.randint(0, 6)):
            add(random.choice(names), day + timedelta(hours=random.randint(8, 23), minutes=random.randint(0, 59)),
                random.choice(CHATTER))
        day += timedelta(days=1)

    msgs.sort(key=lambda m: m["timestamp_ms"], reverse=True)
    folder = Path(out) / "your_facebook_activity/messages/inbox/piwo_1234567890"
    folder.mkdir(parents=True, exist_ok=True)
    chunk = 10000
    for i in range(0, len(msgs), chunk):
        part = {
            "participants": [{"name": mojibake(n)} for n in names],
            "messages": msgs[i:i + chunk],
            "title": mojibake("Piwo licznik 🍺"),
            "is_still_participant": True,
            "thread_path": "inbox/piwo_1234567890",
        }
        (folder / f"message_{i // chunk + 1}.json").write_text(json.dumps(part, indent=2))
    (Path(out) / "truth.json").write_text(json.dumps(
        [[int(t.timestamp()), w, k] for t, w, k in truth], ensure_ascii=False))
    print(f"{len(msgs)} messages, final counter {counter} -> {folder}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "sample_export")
