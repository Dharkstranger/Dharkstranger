#!/usr/bin/env python3
"""Append a learning to the project's log, and promote recurring ones to the playbook.

This is what makes the harness compound: the log is evidence, the playbook is policy.

    capture_learning.py --project . \
        --what "First PR had 40 files and took 3 days to review" \
        --why  "Scaffold and feature work were mixed in one branch" \
        --next "Scaffold lands alone; feature branches stay under ~10 files"

    capture_learning.py --project . --review     # show recurring themes
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

PROMOTE_AFTER = 3  # times a theme must recur before it becomes a standing rule

STOPWORDS = {
    # ordinary filler
    "the", "a", "an", "and", "or", "but", "to", "of", "in", "on", "for", "with",
    "was", "were", "is", "are", "be", "been", "it", "we", "i", "that", "this",
    "had", "has", "have", "did", "do", "not", "so", "too", "our", "us", "at",
    "from", "by", "when", "then", "than", "into", "out", "up", "down", "no",
    "also", "again", "once", "more", "much", "very", "just", "get", "got",
    # entry-format boilerplate — present in every entry, so never a real theme
    "what", "why", "happened", "differently", "next", "time", "ref",
}

LOG_HEADER = """# Learning Log

Append-only. Newest at the bottom. One entry per loop through the harness —
every merged PR, every release, every trip through troubleshooting.

Format: **What happened** → **Why** → **What we do differently**.

When the same theme appears {n} times, it graduates to `PLAYBOOK.md` as a rule.

---
""".format(n=PROMOTE_AFTER)

PLAYBOOK_HEADER = """# Playbook

Standing rules for this project, earned the hard way. Promoted from
`LEARNING-LOG.md` after a lesson recurred {n}+ times.

**These rules override the skill's defaults.** Read this file at the start of any
session in this repo.

---
""".format(n=PROMOTE_AFTER)


def now_date() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def repo_root(start: Path) -> Path:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            cwd=start, capture_output=True, text=True, check=True,
        )
        return Path(out.stdout.strip())
    except (subprocess.CalledProcessError, FileNotFoundError):
        return start


def ensure(path: Path, header: str) -> None:
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(header)


def keywords(text: str) -> set[str]:
    words = re.findall(r"[a-z][a-z0-9-]{2,}", text.lower())
    return {w for w in words if w not in STOPWORDS}


def read_entries(log: Path) -> list[str]:
    if not log.exists():
        return []
    body = log.read_text()
    # Entries start with "## YYYY-MM-DD"
    return re.split(r"\n(?=## \d{4}-\d{2}-\d{2})", body)[1:]


def themes(entries: list[str]) -> Counter:
    counter: Counter = Counter()
    for e in entries:
        for kw in keywords(e):
            counter[kw] += 1
    return counter


def cmd_add(root: Path, args) -> int:
    log = root / "learning" / "LEARNING-LOG.md"
    playbook = root / "learning" / "PLAYBOOK.md"
    ensure(log, LOG_HEADER)
    ensure(playbook, PLAYBOOK_HEADER)

    entry = (
        f"\n## {now_date()}"
        f"{' — ' + args.title if args.title else ''}\n\n"
        f"**What happened.** {args.what}\n\n"
        f"**Why.** {args.why}\n\n"
        f"**What we do differently.** {args.next}\n"
    )
    if args.link:
        entry += f"\n*Ref: {args.link}*\n"

    with log.open("a") as f:
        f.write(entry)
    print(f"Logged to {log.relative_to(root)}")

    # Check whether this entry's theme has now recurred enough to promote.
    entries = read_entries(log)
    counts = themes(entries)
    new_kws = keywords(f"{args.what} {args.why} {args.next}")
    recurring = sorted(
        (kw for kw in new_kws if counts[kw] >= PROMOTE_AFTER),
        key=lambda k: -counts[k],
    )[:5]

    if recurring:
        print(f"\n⚠️  Recurring theme(s): {', '.join(recurring)}")
        print(f"    Seen {PROMOTE_AFTER}+ times. Promote a rule into learning/PLAYBOOK.md:")
        print(f"\n    ## Rule: {args.next}")
        print(f"    Because: {args.why} (recurred {counts[recurring[0]]}×)\n")
        print("    Then tell the PM you've made it a standing rule for this project.")
    return 0


def cmd_review(root: Path, _args) -> int:
    log = root / "learning" / "LEARNING-LOG.md"
    entries = read_entries(log)
    if not entries:
        print("No entries yet.")
        return 0

    print(f"{len(entries)} entries in {log.relative_to(root)}\n")
    counts = themes(entries)
    hot = [(k, c) for k, c in counts.most_common(15) if c >= 2]
    if not hot:
        print("No repeated themes yet — nothing to promote.")
        return 0

    print("Recurring themes:")
    for kw, c in hot:
        flag = "  ← promote" if c >= PROMOTE_AFTER else ""
        print(f"  {c:>2}×  {kw}{flag}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Capture and promote project learnings")
    ap.add_argument("--project", default=".", help="Project root (defaults to git root)")
    ap.add_argument("--review", action="store_true", help="Show recurring themes and exit")
    ap.add_argument("--title", default="")
    ap.add_argument("--what", help="What happened")
    ap.add_argument("--why", help="Why it happened — the root cause, not the symptom")
    ap.add_argument("--next", dest="next", help="What we do differently next time")
    ap.add_argument("--link", default="", help="PR/issue URL for reference")

    args = ap.parse_args()
    root = repo_root(Path(args.project).resolve())

    if args.review:
        return cmd_review(root, args)

    missing = [f"--{n}" for n in ("what", "why", "next") if not getattr(args, n)]
    if missing:
        ap.error(f"missing required: {', '.join(missing)}")

    return cmd_add(root, args)


if __name__ == "__main__":
    sys.exit(main())
