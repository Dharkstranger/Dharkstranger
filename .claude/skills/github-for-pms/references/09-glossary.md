# Glossary — plain English

**Side state H.** Definitions a PM can use in a meeting without hedging.

## Core

**Repository (repo)** — A project folder plus every version of it that has ever
existed. Lives on GitHub; you work on a copy on your machine.

**Clone** — Downloading a repo to your machine, history and all.

**Commit** — A save point for the whole project, with a note explaining why. The
atomic unit of change.

**Branch** — A parallel line of work. `main` is the real version; a branch is a safe
sandbox that can be thrown away.

**Default branch (`main`)** — The published edition. Protected. Everything reaches it
through a pull request.

**Pull request (PR)** — A proposal to merge a branch into another, with a discussion
attached. Where the "why" gets recorded permanently.

**Merge** — Accepting a PR. The branch's changes become part of the target branch.

**Squash merge** — Compressing a PR's commits into one before merging. Keeps history
readable. The default here.

**Remote / `origin`** — The shared copy on GitHub. `origin` is its conventional name.

**Push / Pull / Fetch** — Send your commits up / bring changes down and merge them /
bring changes down without merging.

**Fork** — Your own copy of someone else's repo, under your account.

## Working with changes

**Diff** — The line-by-line difference between two versions. What a reviewer reads.

**Staging (`git add`)** — Choosing which changes go into the next commit.

**Stash** — Setting aside uncommitted work temporarily.

**Conflict** — Two branches changed the same lines; git needs a human to pick.

**Rebase** — Replaying your commits on top of newer ones. Cleaner history, more
footguns. Prefer merge unless the repo's convention says otherwise.

**Revert** — A new commit that undoes an old one. Safe — nothing is erased.

**Reset** — Moving the branch pointer backwards. `--soft` keeps your changes,
`--hard` discards them. The only genuinely dangerous everyday command.

**Reflog** — Git's private log of every state your branch has been in. The undo of
last resort. Almost nothing is truly lost.

**SHA / hash** — The unique ID of a commit (`a3f9c1e`). How you refer to an exact
point in history.

**HEAD** — Where you are right now.

## Collaboration

**Issue** — A unit of tracked work or a question to answer. The backlog.

**Milestone** — A dated group of issues representing one outcome.

**Project** — A board view over issues and PRs.

**Label** — A tag on an issue or PR. `type:bug`, `needs:input`.

**Review** — A structured response to a PR: approve, comment, or request changes.

**CODEOWNERS** — A file mapping paths to people who must review changes there.

**Branch protection** — Rules on the default branch: require a PR, require CI to
pass, block force-pushes.

**Draft PR** — A PR marked not-ready. Runs CI, gets a URL, signals work in progress.

## Automation

**GitHub Actions** — Automation that runs on repo events. Defined in
`.github/workflows/`.

**Workflow** — One automation file: when it runs, what it does.

**Job / Step** — A workflow contains jobs; a job contains steps.

**CI (continuous integration)** — Automatically testing every change.

**CD (continuous deployment)** — Automatically shipping merged changes.

**Check** — A single pass/fail result on a PR.

**Secret** — An encrypted value (API key, token) stored in repo settings, never in
the code.

**Preview deploy** — A temporary live URL built from a PR. The most useful thing a PM
can have.

## Documents

**PRD** — Product requirements document: problem, users, outcome, scope, non-goals,
acceptance criteria.

**ADR** — Architecture decision record: one file per irreversible choice — what was
decided, what was considered, why, and what it costs.

**Changelog** — What shipped, in user language, by version.

**Runbook** — Step-by-step instructions for a recurring operational task.

**Acceptance criteria** — Observable statements that determine whether work is done.
The contract between "I asked for" and "you built."

## Things PMs mix up

| Confusion | The difference |
|---|---|
| Git vs GitHub | Git is the version-control tool on your machine. GitHub is the website that hosts repos and adds issues, PRs, and Actions |
| Fetch vs Pull | Fetch downloads. Pull downloads *and* merges |
| Merge vs Rebase | Merge preserves what actually happened. Rebase rewrites it to look linear |
| Revert vs Reset | Revert adds an undo commit (safe, shared). Reset moves history backwards (local only) |
| Issue vs PR | An issue is a request. A PR is the change that answers it |
| Fork vs Branch | Fork = your own copy of the whole repo. Branch = a line of work inside one repo |
