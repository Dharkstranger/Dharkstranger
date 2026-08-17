# Repo Setup — creation, structure, protections

Covers **S3 REPO** and **S4 SCAFFOLD**.

## Before creating: confirm three things

1. **Name** — kebab-case, describes the product not the sprint. `checkout-redesign`,
   not `q3-project`. It's in every URL forever.
2. **Visibility** — **private by default, always.** Making a repo public is
   outward-facing and effectively irreversible (it can be indexed, forked, and cached
   within minutes). State that in one sentence and get an explicit yes.
3. **Owner** — personal account or org. Work that the company owns belongs in the org
   from day one; moving it later breaks links and CI.

## Creating

**World A (`gh`):**
```bash
gh repo create <owner>/<name> --private --description "<one line>" --clone
cd <name>
```

**World B (MCP):** `create_repository` with `private: true`, then clone the returned
`clone_url`.

**World C (browser):** walk them through github.com → New repository. Do **not** tick
"Add a README" — the scaffold script provides a better one. Then:
```bash
git clone https://github.com/<owner>/<name>.git && cd <name>
```

Immediately after creation, go to S4. A bare repo helps nobody.

## The structure this harness lays down

```
.
├── README.md                  # what this is, who it's for, how to run it
├── CONTRIBUTING.md            # how work gets proposed and merged here
├── ROADMAP.md                 # what's next, in outcome terms
├── CHANGELOG.md               # what shipped, in user language
├── .gitignore
├── .pmops/
│   └── state.json             # the harness state file
├── docs/
│   ├── README.md              # index — the map of all docs
│   ├── product/               # PRDs, problem statements, one-pagers
│   ├── decisions/             # ADRs — one file per irreversible choice
│   ├── how-to/                # runbooks for this specific project
│   └── research/              # user research, competitive analysis, data
├── learning/
│   ├── LEARNING-LOG.md        # append-only: what we learned, dated
│   └── PLAYBOOK.md            # promoted rules — project policy
└── .github/
    ├── ISSUE_TEMPLATE/
    │   ├── feature.yml
    │   ├── bug.yml
    │   ├── research.yml
    │   ├── decision.yml
    │   └── config.yml
    ├── pull_request_template.md
    ├── CODEOWNERS
    ├── labels.yml
    └── workflows/
        ├── ci.yml
        ├── docs-check.yml
        └── auto-label.yml
```

Run it:
```bash
bash <skill>/scripts/bootstrap_repo.sh --repo-root . --name "Checkout Redesign" --owner "acme"
```
Idempotent — skips files that exist. `--force` overwrites. `--dry-run` shows the plan.

**Land the scaffold as a PR, not a direct push.** The PM's first experience of the
repo should be the review loop they'll live in:
```bash
git checkout -b chore/repo-scaffold
bash <skill>/scripts/bootstrap_repo.sh --repo-root . --name "..." --owner "..."
git add -A && git commit -m "chore: repo scaffold — docs, templates, CI, learning log"
git push -u origin chore/repo-scaffold
gh pr create --fill
```

## Protections — the settings files can't express

Apply after the scaffold merges. These are what separate a real repo from a folder.

**Branch protection on the default branch:**
```bash
gh api -X PUT repos/<owner>/<repo>/branches/main/protection \
  -f "required_pull_request_reviews[required_approving_review_count]=1" \
  -F "enforce_admins=false" \
  -F "required_status_checks[strict]=true" \
  -f "required_status_checks[contexts][]=ci" \
  -F "restrictions=null" \
  -F "allow_force_pushes=false" \
  -F "allow_deletions=false"
```

For a solo PM, `required_approving_review_count=0` is honest — but keep the PR
requirement itself. The discipline of "everything goes through a PR" is what makes
the history readable later.

**Merge strategy** — Settings → General → Pull Requests:
- ✅ Allow squash merging (default; one commit per PR keeps history legible)
- ❌ Allow merge commits
- ❌ Allow rebase merging
- ✅ Automatically delete head branches

**Labels:**
```bash
gh label create "type:feature"  --color 0E8A16 --description "New capability"
gh label create "type:bug"      --color D73A4A --description "Something is broken"
gh label create "type:docs"     --color 0075CA --description "Documentation"
gh label create "type:research" --color 5319E7 --description "Question to answer"
gh label create "type:decision" --color FBCA04 --description "Choice to make"
gh label create "size:S"        --color C2E0C6
gh label create "size:M"        --color C2E0C6
gh label create "size:L"        --color C2E0C6
gh label create "needs:input"   --color E99695 --description "Blocked on a human answer"
gh label create "priority:now"  --color B60205
```
Full list with descriptions: `templates/github/labels.yml`.

**Other settings worth 30 seconds:**
- Discussions: on, if there will be more than 3 people.
- Wiki: off. Docs belong in `docs/` where they're versioned with the code.
- Issues: on, obviously.
- Secret scanning + Dependabot alerts: on (free on public, and on private with
  GitHub Advanced Security).

## What goes in `.gitignore`

Never commit: `.env`, `*.key`, `*.pem`, credentials, `node_modules/`, build outputs,
`.DS_Store`, large binaries. If a secret does get committed, rotating the secret is
the fix — removing it from history alone is not enough, because it was already pushed.

## Exit condition for S4

Default branch has the structure above, branch protection is on, labels exist, and
the scaffold arrived via a merged PR.
