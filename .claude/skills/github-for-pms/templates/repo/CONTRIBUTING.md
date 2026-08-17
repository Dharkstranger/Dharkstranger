# Contributing to {{PROJECT_NAME}}

How work gets proposed, reviewed, and merged here. Applies to everyone, including
the repo owner, and including documentation changes.

## The loop

```bash
git checkout main && git pull
git checkout -b feat/short-slug
# make changes
git add -A && git commit -m "feat: what changed and why"
git push -u origin feat/short-slug
gh pr create --fill
```

## Branches

`<type>/<short-slug>` — `feat/`, `fix/`, `docs/`, `chore/`, `exp/`

`main` is protected. Nothing lands on it except through a merged PR.

## Commits

`<type>: <imperative summary>`, then a blank line, then **why**.

```
fix: stop double-charging on retried payments

The retry handler didn't check for an existing successful charge, so a
network timeout could bill twice. Now keyed on the idempotency token.
Fixes #37.
```

Link issues in the body: `Closes #N` closes on merge, `Refs #N` just links.

## Pull requests

- **Keep them small** — under ~400 lines or ~10 files. Big PRs get rubber-stamped,
  which is worse than no review.
- **Fill in the template.** Problem, change, how to verify, risk, rollback.
- **Open a draft early** — it gets you a URL and runs CI.
- **Say what you're unsure about.** Naming the edge of your certainty is a feature.
- **One purpose per PR.** Don't mix a rename, a scaffold, and a feature.

## Reviews

Every comment gets one of three responses — never silence:

1. Do it, and reply with the sha.
2. Push back, with a reason.
3. Defer it, and file the follow-up issue.

Reviewers: be specific, review the diff and not the person, and approve when it's
good enough rather than perfect.

## CI

All checks must pass before merge.

- Never disable or skip a test to get green.
- "Flaky" only applies when the job died *before any test ran*. Otherwise, it's real.
- If the same failure exists on `main`, say so in the thread and wait for the fix.

## Merging

Squash merge, delete the branch. One PR = one commit on `main`.

Ask first before merging: someone else's PR, a PR containing someone else's commits,
or anything hard to reverse.

## Documentation

Docs are part of the change, not a follow-up.

- Behavior changed → update the docs in the same PR.
- Made a hard-to-reverse decision → write an ADR in `docs/decisions/`.
- Learned something the hard way → add it to `learning/LEARNING-LOG.md`.

## Never commit

`.env` files · API keys, tokens, passwords · customer data · large binaries
(use LFS) · `node_modules/` or build output

If a secret does get committed: **rotate it immediately**, then clean the history.
Rotation is the fix; removal alone isn't, because it was already pushed.

## Issues

Use the templates. Every feature issue needs acceptance criteria — if they can't be
written, the work isn't ready to start.
