# Troubleshooting — error → cause → fix

**Side state X.** Find the error text, apply the fix, then log it in S9.

Never answer a git error with "try again." Read it — git errors are unusually honest
about what's wrong.

## Auth & access

| Error | Cause | Fix |
|---|---|---|
| `Support for password authentication was removed` | Using account password | `gh auth login`, or use a personal access token as the password |
| `Permission denied (publickey)` | SSH key missing from GitHub or agent | `ssh-add ~/.ssh/id_ed25519`; verify the key at Settings → SSH keys |
| `Repository not found` (but it exists) | Wrong account authed, or token can't see it | `gh auth status`; re-scope the fine-grained token |
| `403 Forbidden` on push | No write access | Fork, or request collaborator access |
| `refusing to allow an OAuth App to create or update workflow` | Token lacks `workflow` scope | Re-auth with `gh auth refresh -s workflow` |

## Push & pull

| Error | Cause | Fix |
|---|---|---|
| `Updates were rejected because the remote contains work you do not have` | Someone pushed since your last pull | `git pull --rebase` then push. **Never** reach for `--force` here |
| `Your branch and 'origin/x' have diverged` | Both sides have new commits | `git pull --rebase`, resolve, push |
| `fatal: not a git repository` | Wrong directory | `cd` to the repo, or `git clone` it |
| `no upstream branch` | Branch only exists locally | `git push -u origin <branch>` |
| `failed to push some refs` after a rebase | History rewritten | `git push --force-with-lease` — only if nobody else has the branch, and only after saying so |
| `remote: error: File X is 123 MB; exceeds GitHub's file size limit` | Large binary committed | Remove it, add to `.gitignore`, or use Git LFS. It's in history — it must be stripped, not just deleted |

## Merge & conflict

| Error | Cause | Fix |
|---|---|---|
| `CONFLICT (content): Merge conflict in <file>` | Both branches edited the same lines | Edit the file to its correct final state, remove the `<<<<<<<` markers, `git add`, `git commit` |
| `error: Your local changes would be overwritten` | Uncommitted work blocks the operation | `git stash`, do the thing, `git stash pop` |
| `You have unmerged paths` | A conflict is half-resolved | Finish resolving, `git add` each file, then `git commit` |
| `fatal: refusing to merge unrelated histories` | Two repos with separate origins | `git merge --allow-unrelated-histories` — but check first that this is really intended |
| Conflict in `package-lock.json` / `yarn.lock` | Both sides changed dependencies | Don't hand-merge. Take one side, then re-run the install to regenerate |

## "I broke something"

| Panic | Reality | Fix |
|---|---|---|
| "I deleted the file" | It's in history | `git checkout HEAD -- <file>` |
| "I committed to main" | Easy to move | `git branch feat/x && git reset --hard origin/main && git checkout feat/x` |
| "I committed a password" | Serious but bounded | **Rotate the credential now.** Then remove from history and force-push. Rotation is the fix; removal is cleanup |
| "I lost my commits" | Almost never true | `git reflog` — every HEAD state for ~90 days. Find the sha, `git reset --hard <sha>` |
| "I merged the wrong PR" | Reversible | `gh pr revert <n>` |
| "I deleted the branch" | Recoverable if it was pushed | `git checkout -b <name> origin/<name>`, or find the sha in `reflog` |
| "Everything is broken, I want to start over" | Fine | `git stash` (keeps your work), or clone fresh into a new folder. Nothing on GitHub is affected by local mess |

## CI failures

| Symptom | Do |
|---|---|
| Red check, no idea why | `gh run view --log-failed`. Read the **first** error, not the last |
| Passes locally, fails in CI | Environment difference — versions, env vars, timezone, missing secret |
| Passes in CI, fails locally | Stale local deps. Reinstall |
| Fails on `main` too | Not your PR. Say so in the thread, wait for the fix, then merge `main` in |
| Intermittent | Only call it flaky if it failed *before any test ran*. Otherwise it's a real bug with bad timing |

## When you genuinely don't know

Say so, then gather evidence rather than guessing:

```bash
git status && git log --oneline -5 && git remote -v
gh pr status
gh run view --log-failed
```

Show the PM what you found, name the two most likely causes, and say which you'll
try first. Guessing silently and pushing three speculative fixes is worse than one
clear "here's what I'm seeing."

## Always log it

Every trip through this state ends in S9:

```bash
python3 <skill>/scripts/capture_learning.py --project . \
  --what "Push rejected — main had moved" \
  --why "Worked for two days without pulling" \
  --next "git pull before starting any branch"
```
