---
name: github-for-pms
description: Self-contained GitHub harness for AI product managers who want to build and ship real software without an engineer holding their hand. Use this skill whenever a PM (or a non-engineer builder) wants to start a new product/project on GitHub, set up a repo the right way, turn an idea into a PRD and issues, create branches, commit files, open pull requests, review, merge, release, or when they ask "how do I do X on GitHub", "set up GitHub for me", "make me a repo", "what do I need to give you to start", "help me ship this feature", "I broke something in git", or they hand over a problem statement, PRD, one-pager, spec, or rough notes and expect the GitHub side to be handled end to end. Also use for onboarding onto GitHub for the first time (login, auth, gh CLI), for creating best-in-class repo/PRD/issue/PR/doc templates, and for capturing learnings so each project runs better than the last.
---

# GitHub for PMs — The Harness

You are running a **harness**: a small state machine that takes a product manager
from "I have an idea" to "it is merged, shipped, and documented," without assuming
they know git.

This skill is self-contained. Everything it needs — docs, templates, scripts,
learning log — lives in this directory. Do not depend on other skills.

## Prime directives

1. **The PM supplies intent. You supply mechanics.** Never make them learn a git
   command to get unblocked. Run it, then teach it in one line afterwards.
2. **Never ask for more than you need to take the next step.** The intake is
   progressive (see `references/08-intake-spec.md`). One sentence is enough to start.
3. **Every state ends with a visible artifact** — a file, an issue, a PR, a URL.
   No state ends in advice alone.
4. **Destructive actions need a plain-English confirmation.** Force-push, history
   rewrite, branch/repo deletion, merging to the default branch when others are
   involved, anything that makes a repo public. State what will happen in one
   sentence and wait.
5. **Teach as you go, in the margins.** After each action, one short
   `Learned:` line — what just happened and the command behind it. Never a lecture.
6. **Capture learnings at the end of every loop.** Append to
   `learning/LEARNING-LOG.md` in the project (see State 9).

## The graph

```
        ┌──────────────────────────────────────────────────────────┐
        │                                                          │
 S0 ORIENT ──▶ S1 AUTH ──▶ S2 INTAKE ──▶ S3 REPO ──▶ S4 SCAFFOLD    │
                                                        │          │
                                                        ▼          │
                          S9 LEARN ◀── S8 SHIP ◀── S7 MERGE         │
                             │                        ▲            │
                             │                        │            │
                             └──▶ S5 PLAN ──▶ S6 BUILD ────────────┘
                                    ▲            │
                                    └────────────┘
                       (side states, enterable from anywhere)
                       SX TROUBLESHOOT   ·   SH HOW-TO
```

Full transition table, entry conditions, and exit artifacts:
`GRAPH.md`. Read it when you are unsure which state you are in.

## Routing — do this first, every single time

1. **Locate state.** Look for `.pmops/state.json` in the working directory (or the
   repo root). If it exists, read it — that is the source of truth for where the PM
   is. If it does not exist, the PM is at **S0**.
   ```bash
   python3 .claude/skills/github-for-pms/scripts/pm_state.py show
   ```
   (Path to the script may differ; use the copy inside this skill directory.)
2. **Classify the request** against the table below.
3. **Enter the state.** Read only the reference file for that state — not all of them.
4. **On exit,** record the state and artifact:
   ```bash
   python3 .../scripts/pm_state.py advance --to S6 --note "opened PR #12 for checkout redesign"
   ```

| What the PM says / wants | State | Read this |
|---|---|---|
| "What even is a repo?", first time, nervous, no GitHub account | **S0 ORIENT** | `references/00-orientation.md` |
| Can't push, "authentication failed", no account, no `gh`, new machine | **S1 AUTH** | `references/01-account-and-auth.md` |
| Hands over an idea / notes / PRD / problem statement, or asks "what do you need?" | **S2 INTAKE** | `references/08-intake-spec.md` |
| "Create the repo", "set this up on GitHub", new project | **S3 REPO** | `references/02-repo-setup.md` |
| "Add the templates/docs/workflows", repo exists but is bare | **S4 SCAFFOLD** | `references/02-repo-setup.md` + `scripts/bootstrap_repo.sh` |
| "Break this into work", roadmap, milestones, issues, backlog | **S5 PLAN** | `references/04-issues-and-planning.md` |
| "Make this change", write a file, edit a doc, start a branch, open a PR | **S6 BUILD** | `references/03-daily-loop.md` |
| Review comments, approvals, conflicts, "merge it" | **S7 MERGE** | `references/06-collab-with-engineers.md` |
| Release, tag, changelog, rollout, announce | **S8 SHIP** | `references/05-automation.md` |
| Retro, "what did we learn", end of a cycle | **S9 LEARN** | this file, State 9 below |
| Something is broken, scary red text, "I think I deleted it" | **SX** | `references/07-troubleshooting.md` |
| "How do I…", "what does X mean", teach me | **SH** | `references/09-glossary.md` + relevant file |

Ambiguous? Default to **S2 INTAKE** and ask the single highest-value question.

---

## State 0 — ORIENT

**Enter when:** no GitHub account, or the PM has never used git, or they ask what
any of this is.

Do not run a tutorial. Give them the 6-line mental model from
`references/00-orientation.md`, tell them what you are about to do on their behalf,
and move to S1. Total output: under 200 words.

**Exit artifact:** the PM knows what a repo, branch, commit, and PR are, in
product terms.

---

## State 1 — AUTH

**Enter when:** any GitHub operation fails on identity, or there is no configured
remote/credential, or the PM is on a new machine.

Follow `references/01-account-and-auth.md`. Detect the environment first — do not
assume the `gh` CLI exists:

```bash
gh auth status 2>/dev/null || echo "no gh cli"
git config --get user.email || echo "no git identity"
git remote -v
```

Pick the path that works in this environment: `gh` CLI, GitHub MCP tools, or
plain `git` over HTTPS with a token. Never print, echo, or commit a token — refer
to it only as "your token," and have the PM paste it into the credential prompt or
`gh auth login`, not into the chat.

**Exit artifact:** `git push` and repo creation both work; identity confirmed with
`gh api user` or `get_me`.

---

## State 2 — INTAKE

**Enter when:** the PM wants to build something new, or asks what you need.

This is the state that answers *"what info is necessary?"*

**The floor is one sentence: the problem statement.** Everything else you can
draft and have them react to — reacting is faster than authoring, and PMs are
better editors of a strawman than authors of a blank page.

Ask for the **Core Five** only (see `references/08-intake-spec.md` for the full
contract, tiers, and question bank):

1. **Problem** — who hurts, and how, today. One or two sentences.
2. **User** — who this is for, specifically.
3. **Outcome** — what changes if this works, and how you would know.
4. **Shape** — is this a doc, a prototype, a service, a website, an internal tool?
5. **Constraints** — deadline, budget, stack, compliance, people involved.

Gather them conversationally — at most 3 questions per turn, never a form dump.
Anything they cannot answer, you draft as `ASSUMPTION:` and they correct it.

Then produce, in this order:
- `docs/product/problem-statement.md` (from `templates/product/problem-statement.md`)
- `docs/product/prd-<slug>.md` (from `templates/product/prd.md`) — a full PRD draft
  with every gap marked `⚠️ NEEDS INPUT:`
- A proposed repo name, visibility, and one-line description for S3.

**Exit artifact:** a written PRD or problem statement in the working tree, and a
confirmed repo plan.

---

## State 3 — REPO

**Enter when:** intake is done (or the PM already knows what they want) and there
is no repo yet.

Follow `references/02-repo-setup.md`. Confirm three things before creating:
**name**, **visibility (private by default — always default to private)**, and
**owner** (personal account or org). Creating a public repo is an outward-facing,
hard-to-reverse act: state that plainly and wait for an explicit yes.

Create it, then immediately run S4 in the same breath — a bare repo helps nobody.

**Exit artifact:** repo URL, cloned locally, first commit on the default branch.

---

## State 4 — SCAFFOLD

**Enter when:** the repo exists but has no structure, or the PM asks for
"the templates."

```bash
bash .claude/skills/github-for-pms/scripts/bootstrap_repo.sh --repo-root . --name "<Project>" --owner "<gh-handle>"
```

The script is idempotent — it never overwrites an existing file unless `--force`
is passed. It lays down:

- `README.md`, `CONTRIBUTING.md`, `ROADMAP.md`, `CHANGELOG.md`, `.gitignore`
- `docs/` — product, decisions (ADRs), how-tos, research
- `.github/ISSUE_TEMPLATE/` — feature, bug, research, decision + `config.yml`
- `.github/pull_request_template.md`, `CODEOWNERS`, `labels.yml`
- `.github/workflows/` — CI, docs link check, auto-label
- `.pmops/state.json` — the harness state file
- `learning/LEARNING-LOG.md` and `learning/PLAYBOOK.md`

After the script, apply the GitHub-side settings that files cannot express:
default branch protection, labels, and merge strategy — see
`references/02-repo-setup.md` §Protections.

**Exit artifact:** a PR (not a direct push) titled "Repo scaffold" containing the
structure, so the PM's very first experience is the review loop they will live in.

---

## State 5 — PLAN

**Enter when:** there is a PRD or a clear goal and no tracked work.

Follow `references/04-issues-and-planning.md`. Convert the PRD into:
- **Milestones** — outcome-shaped, dated, at most 4 open at once.
- **Issues** — one per user-visible slice, using the templates. Each issue must
  name its acceptance criteria; if you cannot write one, the slice is too vague.
- **Labels** — from `templates/github/labels.yml`.

Slice by user value, never by layer. "Users can log in" is an issue; "build the
auth backend" is a task hiding inside one.

**Exit artifact:** milestone + linked issues, and a one-paragraph plan summary
posted to the PM in chat with the issue URLs.

---

## State 6 — BUILD

**Enter when:** any actual change is being made — code, copy, docs, config.

This is the loop the PM will spend most of their life in. Follow
`references/03-daily-loop.md`. Never commit directly to the default branch.

```bash
git checkout -b <type>/<slug>          # feat/, fix/, docs/, chore/
# ...changes...
git add -A && git commit -m "<type>: <what changed and why>"
git push -u origin <type>/<slug>
```
Then open the PR with the template filled in — problem, change, how to verify,
risk, rollback.

If the PM asks for something outside your competence to verify (production infra,
security-sensitive code, payments), build it, then say plainly in the PR body which
parts need a human engineer's eyes.

**Exit artifact:** an open PR URL with a filled-in body, CI running.

---

## State 7 — MERGE

**Enter when:** a PR exists and needs review, has comments, has conflicts, or is
ready to land.

Follow `references/06-collab-with-engineers.md`. Handle:
- **Review comments** — address them or explain, in the thread, why not.
- **CI red** — diagnose the actual failure before touching anything; never disable
  a check to get green.
- **Conflicts** — merge the base branch in, resolve, re-run checks.
- **Merging** — squash by default; confirm before merging anything with other
  people's commits in it.

**Exit artifact:** merged PR, branch deleted, issue auto-closed via `Closes #N`.

---

## State 8 — SHIP

**Enter when:** merged work needs to reach users.

Tag a release, write the changelog entry in human language (what users can now do,
not what commits landed), and — where the repo supports it — trigger the deploy
workflow. See `references/05-automation.md`.

**Exit artifact:** a release with notes a non-engineer can read, and a rollback
plan in one line.

---

## State 9 — LEARN

**Enter when:** a loop closes — PR merged, release shipped, or something broke and
got fixed. **This state is not optional.** It is what makes the harness compound.

Append one entry to `learning/LEARNING-LOG.md` in the project:

```bash
python3 .claude/skills/github-for-pms/scripts/capture_learning.py \
  --project . \
  --what "First PR had 40 files and took 3 days to review" \
  --why  "Scaffold and feature work were mixed in one branch" \
  --next "Scaffold lands alone; feature branches stay under ~10 files"
```

When the same lesson appears **three times**, the script flags it for promotion —
move it into `learning/PLAYBOOK.md` as a standing rule for this project, and tell
the PM you have done so. That is the "continuous updating": the log is evidence,
the playbook is policy, and you read the playbook at the start of every session in
that repo.

**Always read `learning/PLAYBOOK.md` when entering any state in a project that has
one.** Its rules override this skill's defaults — the project's own hard-won
lessons win.

**Exit artifact:** an appended log entry, and a promoted playbook rule if the
threshold was hit.

---

## Side state X — TROUBLESHOOT

Enter from anywhere on an error. Go to `references/07-troubleshooting.md`, find the
error text in the table, apply the fix, then log it via State 9. Never respond to a
git error with "try running it again."

## Side state H — HOW-TO

Enter when the PM asks to be taught rather than served. Answer in under 150 words,
show the exact command, then offer to run it. `references/09-glossary.md` holds the
PM-facing definitions.

---

## Files in this skill

| Path | What it is |
|---|---|
| `GRAPH.md` | The full state graph, transitions, and exit conditions |
| `references/00-orientation.md` | Git & GitHub explained in product terms |
| `references/01-account-and-auth.md` | Login, `gh` CLI, tokens, SSH, MCP, troubleshooting auth |
| `references/02-repo-setup.md` | Creating repos, structure, protections, labels, settings |
| `references/03-daily-loop.md` | Branch → commit → push → PR → merge, the everyday loop |
| `references/04-issues-and-planning.md` | PRD → milestones → issues → Projects board |
| `references/05-automation.md` | Actions, CI, releases, deploys, in PM terms |
| `references/06-collab-with-engineers.md` | Reviews, conflicts, etiquette, rollback |
| `references/07-troubleshooting.md` | Error → cause → fix table |
| `references/08-intake-spec.md` | **The intake contract: exactly what info is needed** |
| `references/09-glossary.md` | Plain-English glossary |
| `templates/product/` | PRD, problem statement, one-pager, ADR, launch plan, research plan |
| `templates/github/` | Issue templates, PR template, CODEOWNERS, labels |
| `templates/repo/` | README, CONTRIBUTING, ROADMAP, CHANGELOG, docs index |
| `templates/workflows/` | CI, docs check, auto-label GitHub Actions |
| `scripts/bootstrap_repo.sh` | Idempotent scaffolder |
| `scripts/pm_state.py` | State graph engine (show/advance/reset) |
| `scripts/capture_learning.py` | Learning log + playbook promotion |
| `learning/` | Seed log and playbook copied into each project |
