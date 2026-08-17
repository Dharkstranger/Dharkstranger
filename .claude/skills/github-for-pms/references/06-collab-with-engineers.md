# Review, Merge, and Working with Engineers

**S7 MERGE.**

## Getting a PR reviewed

```bash
gh pr create --fill --reviewer @handle
gh pr view --web            # share this URL, not a screenshot
```

What makes an engineer review a PM's PR quickly:
- It's small.
- The body says how to verify it in concrete steps.
- It says which parts you're unsure about. Precision about your own uncertainty buys
  more goodwill than false confidence ever will.
- It doesn't mix a scaffold, a rename, and a feature in one diff.

## Responding to review comments

Three valid responses to any comment. Pick one — silence is not on the list.

1. **Do it.** Push the change, reply "done in `<sha>`."
2. **Push back with a reason.** "Keeping the email optional here because the PRD's
   guest flow (§3) requires it — happy to revisit if that's wrong."
3. **Defer it.** "Good catch, out of scope for this PR — filed as #52."

Reply in the thread, then resolve it. An unresolved thread reads as ignored.

Never take review comments personally, and never let a PR sit for days because a
comment stung. The comment is about the diff.

## When CI goes red

**Diagnose before you touch anything.**

```bash
gh pr checks                          # which check failed
gh run view --log-failed              # the actual failure output
```

Then:

| What the log shows | What it means | Do |
|---|---|---|
| A test asserting behavior you changed | Your change broke something real | Fix the code, or update the test if the new behavior is correct and intended |
| Lint / format error | Style, not logic | Run the repo's formatter and push |
| Install / checkout / runner died before tests ran | Infrastructure hiccup | Re-run the job. This is the *only* case where "just re-run it" is a diagnosis |
| Failure also present on `main` | Not yours | Say so in the thread once, wait for the base branch to recover, then merge `main` in |
| Timeout | Something hangs, or the job is genuinely slow | Read the log; don't raise the timeout as a first move |

**Never** disable, skip, or delete a test to get green. If a test blocks you and you
believe it's wrong, say so in the PR and let a human decide. "Flaky" is a claim that
requires evidence, not a shrug.

## Merge conflicts

They mean two branches edited the same lines. Not a disaster.

```bash
git checkout main && git pull
git checkout <your-branch>
git merge main
# git marks conflicts in the files:
#   <<<<<<< HEAD          ← what's on your branch
#   =======
#   >>>>>>> main          ← what came from main
# Edit to the correct final state, delete the markers.
git add <resolved-files>
git commit
git push
```

Rules:
- **Read both sides before choosing.** The other side was written for a reason.
- For lockfiles and generated files, regenerate rather than hand-merge.
- If both sides changed the same logic in incompatible ways, that's a conversation,
  not a merge — ask the other author.

## Merging

```bash
gh pr merge <n> --squash --delete-branch
```

Confirm before merging when:
- Other people's commits are in the PR.
- It targets a protected or production branch.
- It's someone else's PR.
- The changes are hard to reverse (migrations, deletions, anything public-facing).

Squash by default: one PR = one commit on `main`, with the PR body as the message.
History stays readable a year later.

## Rolling back

```bash
gh pr revert <n>              # opens a PR that undoes it — the safe path
git revert <sha>              # same idea, locally
```

Revert first, diagnose second. A revert is cheap and reversible; a production
incident while you debug is not.

## Etiquette that earns you engineering trust

**Do:**
- Keep PRs small and single-purpose.
- Write why, not just what.
- Answer every review comment.
- Say when something is beyond you.
- Read the CI log before asking what's wrong.

**Don't:**
- Push directly to `main` because it was faster.
- Force-push a branch someone else is reviewing.
- Merge your own PR in a repo where others review, without a review.
- Reopen a settled decision in a PR thread — file an ADR instead.
- Commit secrets. If you do: rotate the secret immediately, then clean the history.
  Rotation is the real fix; removal alone is not.

## Exit condition for S7

PR merged, branch deleted, linked issue closed, and — if anything went sideways —
a State 9 learning entry written.
