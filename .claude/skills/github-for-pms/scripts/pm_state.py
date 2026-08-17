#!/usr/bin/env python3
"""State engine for the github-for-pms harness.

Tracks where a PM is in the graph, in .pmops/state.json at the repo root.

    pm_state.py show
    pm_state.py advance --to S6 --note "opened PR #12"
    pm_state.py artifact --key open_pr --value https://github.com/o/r/pull/12
    pm_state.py init --project checkout-redesign
    pm_state.py reset
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

STATES = {
    "S0": ("ORIENT", "Mental model of git/GitHub in product terms"),
    "S1": ("AUTH", "Identity works: push and repo creation both succeed"),
    "S2": ("INTAKE", "Problem captured; PRD or problem statement on disk"),
    "S3": ("REPO", "Repo exists, cloned, first commit on default branch"),
    "S4": ("SCAFFOLD", "Structure landed via a merged PR; protections on"),
    "S5": ("PLAN", "Milestone + issues with acceptance criteria"),
    "S6": ("BUILD", "PR open with a filled-in body, CI running"),
    "S7": ("MERGE", "PR merged, branch deleted, issue closed"),
    "S8": ("SHIP", "Release tagged, changelog written, rollback stated"),
    "S9": ("LEARN", "Entry appended to learning/LEARNING-LOG.md"),
    "SX": ("TROUBLESHOOT", "Root cause named, fix applied, logged"),
    "SH": ("HOW-TO", "Question answered with the exact command"),
}

NEXT = {
    "S0": ["S1"], "S1": ["S2"], "S2": ["S3"], "S3": ["S4"], "S4": ["S5"],
    "S5": ["S6"], "S6": ["S7", "S6", "SX"], "S7": ["S8", "S9", "S6", "SX"],
    "S8": ["S9"], "S9": ["S5", "S6"], "SX": ["S9"], "SH": ["S9"],
}


def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def repo_root(start: Path) -> Path:
    """Git root if we're in a repo, else the given directory."""
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            cwd=start, capture_output=True, text=True, check=True,
        )
        return Path(out.stdout.strip())
    except (subprocess.CalledProcessError, FileNotFoundError):
        return start


def state_path(root: Path) -> Path:
    return root / ".pmops" / "state.json"


def load(root: Path) -> dict | None:
    p = state_path(root)
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text())
    except json.JSONDecodeError as e:
        print(f"error: {p} is not valid JSON ({e}).", file=sys.stderr)
        print("Fix it by hand or run: pm_state.py reset", file=sys.stderr)
        sys.exit(2)


def save(root: Path, data: dict) -> None:
    p = state_path(root)
    p.parent.mkdir(parents=True, exist_ok=True)
    data["updated"] = now()
    p.write_text(json.dumps(data, indent=2) + "\n")


def fresh(project: str) -> dict:
    return {
        "version": 1,
        "project": project,
        "state": "S0",
        "updated": now(),
        "history": [],
        "artifacts": {},
    }


def cmd_show(root: Path, _args) -> int:
    data = load(root)
    if data is None:
        print("No .pmops/state.json found — the PM is at S0 (ORIENT).")
        print("Start with: pm_state.py init --project <name>")
        return 0

    code = data.get("state", "S0")
    name, exit_cond = STATES.get(code, ("UNKNOWN", "—"))
    print(f"Project : {data.get('project', '(unnamed)')}")
    print(f"State   : {code} {name}")
    print(f"Exit when: {exit_cond}")
    print(f"Updated : {data.get('updated', '—')}")

    nxt = NEXT.get(code, [])
    if nxt:
        print("Next    : " + ", ".join(f"{s} {STATES[s][0]}" for s in nxt))

    arts = data.get("artifacts") or {}
    if arts:
        print("\nArtifacts:")
        for k, v in arts.items():
            print(f"  {k:<12} {v}")

    hist = data.get("history") or []
    if hist:
        print("\nRecent:")
        for h in hist[-5:]:
            print(f"  {h.get('at', '?')}  {h.get('state', '?')}  {h.get('note', '')}")
    return 0


def cmd_init(root: Path, args) -> int:
    if load(root) is not None and not args.force:
        print("state.json already exists. Use --force to overwrite.", file=sys.stderr)
        return 1
    save(root, fresh(args.project or root.name))
    print(f"Initialized {state_path(root)} at S0.")
    return 0


def cmd_advance(root: Path, args) -> int:
    data = load(root) or fresh(root.name)
    target = args.to.upper()
    if target not in STATES:
        print(f"Unknown state '{target}'. Valid: {', '.join(STATES)}", file=sys.stderr)
        return 1

    current = data.get("state", "S0")
    if target not in NEXT.get(current, []) and target != current and not args.force:
        allowed = ", ".join(NEXT.get(current, [])) or "(none)"
        print(f"note: {current} → {target} is not a standard transition (expected: {allowed}).")
        print("      Skipping is often fine — recording it anyway.")

    data["state"] = target
    data.setdefault("history", []).append(
        {"state": target, "at": now(), "note": args.note or ""}
    )
    save(root, data)

    name, exit_cond = STATES[target]
    print(f"→ {target} {name}")
    print(f"  Exit when: {exit_cond}")
    return 0


def cmd_artifact(root: Path, args) -> int:
    data = load(root) or fresh(root.name)
    data.setdefault("artifacts", {})[args.key] = args.value
    save(root, data)
    print(f"artifacts.{args.key} = {args.value}")
    return 0


def cmd_reset(root: Path, args) -> int:
    if not args.yes:
        print("This clears all harness state and history. Re-run with --yes.", file=sys.stderr)
        return 1
    save(root, fresh(root.name))
    print("State reset to S0.")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Harness state engine for github-for-pms")
    ap.add_argument("--project-root", default=".", help="Defaults to the git root")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("show", help="Print current state and artifacts")

    p_init = sub.add_parser("init", help="Create .pmops/state.json")
    p_init.add_argument("--project")
    p_init.add_argument("--force", action="store_true")

    p_adv = sub.add_parser("advance", help="Move to a state")
    p_adv.add_argument("--to", required=True)
    p_adv.add_argument("--note", default="")
    p_adv.add_argument("--force", action="store_true")

    p_art = sub.add_parser("artifact", help="Record an artifact URL or path")
    p_art.add_argument("--key", required=True)
    p_art.add_argument("--value", required=True)

    p_res = sub.add_parser("reset", help="Wipe state back to S0")
    p_res.add_argument("--yes", action="store_true")

    args = ap.parse_args()
    root = repo_root(Path(args.project_root).resolve())

    return {
        "show": cmd_show, "init": cmd_init, "advance": cmd_advance,
        "artifact": cmd_artifact, "reset": cmd_reset,
    }[args.cmd](root, args)


if __name__ == "__main__":
    sys.exit(main())
