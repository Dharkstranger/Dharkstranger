# The Daily Loop — branch → commit → push → PR

**S6 BUILD.** This is where a PM spends 80% of their time. Make it boring and repeatable.

## The loop in full

```bash
# 1. Start from a current main
git checkout main && git pull

# 2. Branch — type/short-slug
git checkout -b feat/guest-checkout

# 3. Make the change (you do this — files, docs, code)

# 4. See what changed, in plain terms, before saving
git status
git diff

# 5. Save with a message that explains why
git add -A
git commit -m "feat: allow checkout without an account

Guest shoppers abandoned at the account-creation step. This adds an
email-only path through payment. Closes #14."

# 6. Push and open the proposal
git push -u origin feat/guest-checkout
gh pr create --fill --base main
```

Never commit directly to `main`. Even solo. The PR is where the reasoning lives.

## Branch naming

`<type>/<short-slug>` — lowercase, hyphens, under ~40 chars.

| Prefix | For |
|---|---|
| `feat/` | New capability |
| `fix/` | Something broken |
| `docs/` | PRDs, READMEs, decisions — docs-only changes |
| `chore/` | Setup, config, dependencies, housekeeping |
| `exp/` | Throwaway experiment, may never merge |

## Commit messages

Format: `<type>: <what changed, imperative>` then a blank line, then **why**.

The subject line is for scanning; the body is for the person six months from now
asking "why on earth is it like this?" — usually the PM themselves.

Good:
```
fix: stop double-charging on retried payments

The retry handler didn't check for an existing successful charge, so a
network timeout could bill twice. Now keyed on the idempotency token.
Reported in #37.
```

Bad: `update`, `fixes`, `changes per feedback`, `wip`, `asdf`.

Link issues in the body: `Closes #14` / `Fixes #37` auto-closes the issue on merge.
`Refs #14` links without closing.

## Sizing a PR

**Aim for under ~400 changed lines, or ~10 files.** Not a rule from nowhere: review
quality falls off a cliff past that, and a PM's PRs get rubber-stamped instead of
read — which is worse than no review at all.

If it's bigger, split by user-visible slice:
- ❌ One PR: "guest checkout" (schema + API + UI + emails + analytics)
- ✅ Four PRs: schema → API endpoint → UI → analytics, each mergeable alone

## Writing the PR body

Use `.github/pull_request_template.md`. Five sections, all of them short:

1. **Problem** — one or two sentences, or a link to the issue.
2. **Change** — what this does, in user terms first, then technical.
3. **How to verify** — the exact steps a reviewer takes to see it work.
4. **Risk** — what could go wrong, and who is affected if it does.
5. **Rollback** — how to undo it. "Revert this PR" is a valid answer; "unclear" is not.

If any part of the change is beyond what you can verify — production infra, auth,
payments, anything touching user data — say so explicitly in the PR body and ask for
an engineer's review on that specific part. Being clear about the edge of your
competence is the single most credibility-preserving thing a PM can do in a PR.

## Draft PRs

Open a draft early — as soon as the first commit is pushed:
```bash
gh pr create --draft --fill
```
It creates a URL to share, runs CI, and signals "not ready" without anyone asking.
Mark ready with `gh pr ready`.

## Checking on things

```bash
gh pr status                    # your PRs and their state
gh pr checks                    # CI results for the current branch
gh pr view --web                # open it in the browser
git log --oneline -10           # recent history
git diff main...HEAD --stat     # everything this branch changes
```

## Keeping a branch current

If `main` moved while you were working:
```bash
git checkout main && git pull
git checkout feat/guest-checkout
git merge main                  # resolve any conflicts, then commit
git push
```

## Undo table — the safety net

| Situation | Command | Safe? |
|---|---|---|
| Changed a file, want it back | `git restore <file>` | Loses uncommitted work in that file |
| Staged something by mistake | `git restore --staged <file>` | Yes |
| Bad commit message, not pushed | `git commit --amend` | Yes |
| Bad commit message, already pushed | Leave it. Amending needs a force-push. | — |
| Undo last commit, keep the changes | `git reset --soft HEAD~1` | Yes |
| Undo a merged PR | `gh pr revert <n>` or `git revert <sha>` | Yes — makes a new commit, keeps history |
| "I lost everything" | `git reflog` — every state of the last ~90 days is there | Yes |

**Never** run `git push --force` on a shared branch. If it seems necessary, use
`--force-with-lease`, and only after saying out loud what will be overwritten and
getting a yes.

## Exit condition for S6

PR is open, body filled from the template, CI triggered, URL given to the PM.
