# Automation, Releases & Shipping

**S8 SHIP.** GitHub Actions, releases, and deploys — explained for someone who will
read the results, not write the YAML.

## What Actions actually is

A robot that runs commands whenever something happens in the repo. "When a PR opens,
run the tests." "When code merges to main, deploy it." The rules live in
`.github/workflows/*.yml`, which means automation is versioned and reviewed like
everything else.

Free tier: 2,000 minutes/month on private repos, unlimited on public. Plenty.

## Anatomy of a workflow

```yaml
name: CI                    # what shows on the PR
on:                         # WHEN it runs
  pull_request:
  push:
    branches: [main]
jobs:
  test:                     # WHAT it does
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test
```

Three questions answer any workflow: **when does it run, what does it do, what
happens if it fails.**

## The three workflows this harness ships

| File | Runs when | Does |
|---|---|---|
| `ci.yml` | Every PR + push to main | Installs, lints, tests. Auto-detects Node/Python/none |
| `docs-check.yml` | PRs touching `docs/` or `*.md` | Checks for broken internal links and leftover `⚠️ NEEDS INPUT` markers |
| `auto-label.yml` | Every PR | Labels by branch prefix and size |

They're in `templates/workflows/`. The scaffolder copies them in and comments out
anything the repo can't yet run, so a fresh repo never shows red CI on day one.

## Reading a failed run

```bash
gh run list --limit 5
gh run view <id> --log-failed      # jumps straight to the failing step
gh pr checks                       # status for the current PR
```

The useful line is almost never the last one — it's the first `Error:` or the first
failing assertion. Scroll up, not down.

## Releases

A release is a tagged point in history plus notes about what changed. Do one when
users get something new.

```bash
git tag -a v0.2.0 -m "Guest checkout"
git push origin v0.2.0
gh release create v0.2.0 --title "Guest checkout" --notes-file docs/release-notes.md
```

Versions: `MAJOR.MINOR.PATCH`. Breaking change → MAJOR. New capability → MINOR.
Fix → PATCH. Pre-1.0, nobody will hold you to it.

**Write release notes for users, not for git.**

❌ "Merged #45, #47, #52. Bumped deps."
✅ "Shoppers can now check out without creating an account. Confirmation emails
arrive within a minute. Fixed a bug where the cart emptied on browser back."

`CHANGELOG.md` gets the same text. `templates/repo/CHANGELOG.md` has the format.

## Deploys

Deployment depends entirely on where the thing lives. The pattern is always the same:
merge to `main` → workflow builds → workflow publishes.

| Host | Setup |
|---|---|
| **GitHub Pages** | Settings → Pages → deploy from branch/Actions. Free, ideal for static sites and docs |
| **Vercel / Netlify** | Connect the repo in their dashboard. Auto-deploys every PR to a preview URL — the single best feature a PM can have, because every PR becomes a clickable thing to react to |
| **Cloud (AWS/GCP/Azure)** | Needs an engineer to set up credentials and IAM. Don't improvise this |

**Preview deploys are worth more to a PM than any other automation.** Prioritize
getting them working.

## Secrets

Never in the repo. Settings → Secrets and variables → Actions. Reference in a
workflow as `${{ secrets.NAME }}`. GitHub masks them in logs.

If a secret is ever committed: **rotate it immediately** — assume it's compromised
the moment it's pushed. Cleaning history is second, and alone is not sufficient.

## Automation worth adding later

- **Dependabot** (`.github/dependabot.yml`) — PRs for outdated dependencies.
- **Auto-assign reviewers** via CODEOWNERS.
- **Stale bot** — closes issues untouched for 60 days. Only once the backlog is
  actually noisy.
- **Release drafter** — assembles notes from merged PR titles. Good titles become
  release notes for free.

## Exit condition for S8

A tagged release with human-readable notes, a `CHANGELOG.md` entry, and a
one-line rollback plan the PM could execute under pressure.
