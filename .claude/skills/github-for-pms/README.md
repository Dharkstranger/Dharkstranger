# github-for-pms

A self-contained skill that takes a product manager from "I have an idea" to
"it's merged, shipped, and documented" — without assuming they know git.

It is built as a **harness**: a state machine with 10 states, a router that figures
out where the PM is, a state file that persists between sessions, and a learning log
that turns repeated mistakes into standing rules.

## Install

The skill is one directory with no external dependencies (bash + python3 only).
Copy it wherever Claude Code looks for skills:

```bash
# Personal — available in every project
cp -r .claude/skills/github-for-pms ~/.claude/skills/

# Or per-project — committed with the repo, shared with the team
cp -r .claude/skills/github-for-pms <other-repo>/.claude/skills/
```

Then invoke it by name (`/github-for-pms`) or just describe what you want —
the description in `SKILL.md` triggers it automatically on things like
"set up GitHub for me", "make me a repo", "what do you need to start?",
"open a PR", "I broke something in git".

## What's in it

```
github-for-pms/
├── SKILL.md          ← the harness: router, 10 states, prime directives
├── GRAPH.md          ← state graph, transitions, exit conditions
├── references/       ← 10 docs: orientation, auth, repo setup, daily loop,
│                       planning, automation, collaboration, troubleshooting,
│                       the intake contract, glossary
├── templates/        ← PRD, problem statement, one-pager, ADR, launch plan,
│                       research plan, 4 issue templates, PR template,
│                       CODEOWNERS, labels, README/CONTRIBUTING/ROADMAP/
│                       CHANGELOG, 3 GitHub Actions workflows
├── scripts/          ← bootstrap_repo.sh, pm_state.py, capture_learning.py
└── learning/         ← seed log + playbook copied into each new project
```

## What information a PM has to supply

**The floor is one sentence: the problem statement.** Everything else is drafted
and marked as an assumption for them to correct.

For a full PRD and repo, the skill asks for the **Core Five** — problem, user,
outcome, shape, constraints — conversationally, at most three questions at a time.
The complete contract, tiers, defaults, and question bank are in
`references/08-intake-spec.md`.

## The three commands

```bash
# Scaffold a repo — idempotent, never overwrites without --force
bash scripts/bootstrap_repo.sh --repo-root . --name "Project" --owner handle

# Where am I in the graph?
python3 scripts/pm_state.py show
python3 scripts/pm_state.py advance --to S6 --note "opened PR #12"

# Capture what went wrong so it doesn't recur
python3 scripts/capture_learning.py --project . \
  --what "..." --why "..." --next "..."
python3 scripts/capture_learning.py --project . --review
```

## How it compounds

Each project gets a `learning/LEARNING-LOG.md` (append-only evidence) and a
`learning/PLAYBOOK.md` (promoted rules). When the same lesson appears three times,
it graduates into the playbook — and the playbook overrides the skill's own
defaults, because a project's hard-won lessons beat generic best practice.

That's the "continuous updating": the harness gets better at *your* repo the longer
you use it.
