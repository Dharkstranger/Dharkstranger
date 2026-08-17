# Documentation — {{PROJECT_NAME}}

The map. Every doc in this repo is reachable from here.

## Product

| Doc | What it answers |
|---|---|
| [Problem statement](product/problem-statement.md) | What are we solving, and for whom? |
| [PRD](product/) | What exactly are we building? |
| [Roadmap](../ROADMAP.md) | What's next? |

## Decisions

| ADR | Decision | Status |
|---|---|---|
| [ADR-001](decisions/) | | Accepted |

*One file per hard-to-reverse choice. If you're about to ask "why is it like this?",
the answer is here.*

## How-to

Runbooks for this project specifically.

| Guide | For |
|---|---|
| [Local setup](how-to/) | Getting it running |
| [Deploying](how-to/) | Shipping a change |
| [Rolling back](how-to/) | Undoing a bad release |

## Research

| Study | Question | Date |
|---|---|---|
| | | |

## Learning

| Doc | What it's for |
|---|---|
| [Learning log](../learning/LEARNING-LOG.md) | Dated, append-only: what we learned |
| [Playbook](../learning/PLAYBOOK.md) | Promoted rules — how we work here now |

---

## Conventions

- **Filenames:** kebab-case. `guest-checkout-prd.md`, not `Guest Checkout PRD.md`.
- **Every doc has a status and a date** in a table at the top.
- **Gap markers:** `⚠️ NEEDS INPUT:` · `ASSUMPTION:` · `TODO(@handle):`
- **Docs change through PRs**, like everything else.
- **Stale beats missing, but not by much.** A doc nobody has touched in a year should
  be marked `Archived`, not left to quietly mislead.
