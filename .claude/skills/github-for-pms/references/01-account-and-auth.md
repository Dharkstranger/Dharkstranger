# Account & Authentication

Everything downstream fails confusingly if this is wrong. Never skip this state.

## Step 0 — detect the environment before advising anything

```bash
gh auth status 2>/dev/null || echo "NO_GH_CLI"
git config --get user.name  || echo "NO_GIT_NAME"
git config --get user.email || echo "NO_GIT_EMAIL"
git remote -v 2>/dev/null
```

Three possible worlds. Pick the one you're in:

| World | Signal | Use |
|---|---|---|
| **A. `gh` CLI available and authed** | `gh auth status` prints a logged-in account | `gh` for everything — repo creation, PRs, merges |
| **B. GitHub MCP tools available** | `mcp__github__*` tools exist in the toolset | MCP tools for GitHub API actions; plain `git` for local work |
| **C. Bare git only** | Neither of the above | `git` over HTTPS with a token, or SSH. Repo creation must happen in the browser. |

This harness works in all three. Do not tell the PM to install something unless
world C is confirmed *and* they want repo creation automated.

## Creating the account (first time)

1. github.com → Sign up. Personal email is fine; work email if the company owns the work.
2. **Turn on 2FA immediately.** GitHub requires it for most accounts now anyway.
   Authenticator app beats SMS.
3. Pick the handle carefully — it appears in every URL and is a pain to change later.
4. Free tier is enough: unlimited private repos, Actions minutes included.

## Setting local identity

```bash
git config --global user.name  "Ada Lovelace"
git config --global user.email "ada@example.com"
```

Use the same email as the GitHub account, or commits won't be attributed to them.
If the account has email privacy on, use the `users.noreply.github.com` address
GitHub shows in Settings → Emails.

## World A — `gh` CLI

```bash
gh auth login          # choose GitHub.com → HTTPS → login with browser
gh auth status         # confirm
gh api user --jq .login
```

`gh auth login` also configures git credentials, so `git push` starts working. This
is the smoothest path — prefer it when available.

Install if missing: `brew install gh` (macOS), `winget install GitHub.cli` (Windows),
or see cli.github.com for Linux packages.

## World C — token over HTTPS

1. GitHub → Settings → Developer settings → **Personal access tokens** → Fine-grained.
2. Scope it: only the repos needed, with **Contents: read+write**, **Pull requests:
   read+write**, **Issues: read+write**, **Metadata: read**. Nothing more.
3. Set an expiry — 90 days is a reasonable default.
4. When `git push` prompts for a password, paste the **token**, not the account password.

**Handling rules — non-negotiable:**
- Never ask the PM to paste a token into the chat.
- Never `echo`, log, or write a token into a file that could be committed.
- If a token is ever exposed, the fix is to revoke it on GitHub immediately, then
  issue a new one. Say this plainly and without drama.

Cache it so they aren't re-prompted:
```bash
git config --global credential.helper store   # or 'osxkeychain' on macOS, 'manager' on Windows
```

## SSH (optional, for PMs who'll be at this a while)

```bash
ssh-keygen -t ed25519 -C "ada@example.com"    # accept defaults, set a passphrase
cat ~/.ssh/id_ed25519.pub                      # paste into GitHub → Settings → SSH keys
ssh -T git@github.com                          # verify
```

## Auth error → fix

| Error | Cause | Fix |
|---|---|---|
| `remote: Support for password authentication was removed` | Using account password | Use a token (World C) or `gh auth login` |
| `Permission denied (publickey)` | SSH key not registered or agent not running | `ssh-add ~/.ssh/id_ed25519`, confirm key is in GitHub settings |
| `remote: Repository not found` on a repo that exists | Wrong account authed, or token lacks access to that repo | `gh auth status`; re-scope the fine-grained token to include the repo |
| `403` on push to someone else's repo | No write access | Fork it, or ask for collaborator access |
| `Could not resolve host: github.com` | Network/proxy | Check connectivity; in a proxied environment check the proxy config, never disable TLS verification |
| Commits show a stranger's avatar | `user.email` doesn't match the GitHub account | Reset `git config --global user.email`; past commits can be left alone |

## Exit condition

All three must be true before leaving S1:

```bash
gh api user --jq .login    # or MCP get_me — returns the PM's handle
git config --get user.email # returns their address
git ls-remote <repo-url>    # succeeds without prompting
```
