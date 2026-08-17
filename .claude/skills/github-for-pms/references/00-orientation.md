# Orientation — GitHub in product terms

Use this when the PM has never used git. Give them the model, not the manual.
Target: under 200 words spoken, then act.

## The six-line mental model

| Git thing | What it actually is |
|---|---|
| **Repository (repo)** | The project folder, plus its complete history. Every version ever saved is still there. |
| **Commit** | A save point with a note attached. Not "save file" — "save the whole project, and say why." |
| **Branch** | A parallel copy where you try something. The main version stays untouched and safe. |
| **Pull request (PR)** | A proposal: "here's my branch, here's what changed, please look before it becomes real." |
| **Merge** | Accepting the proposal. The change becomes part of the main version. |
| **Remote / origin** | The copy on GitHub.com that everyone shares. Your machine has its own copy. |

## The one paragraph that makes it click

> Think of the default branch (`main`) as the published edition. You never edit the
> published edition directly. You take a copy (a branch), make your changes there,
> and open a pull request — which is a review meeting in document form. When someone
> approves, it merges into the published edition. Nothing is ever lost, and anything
> can be undone, because every save point is permanent.

## What this means for a PM specifically

- **You can safely touch things.** Almost nothing in git is unrecoverable. The
  exceptions are force-push and history rewrite — this harness will always warn you
  before either.
- **Your documents belong in the repo too.** PRDs, decisions, and research live next
  to the code they describe. That is the whole point: the spec and the thing stay in sync.
- **A PR is a product artifact.** It's where the "why" gets recorded. A good PR body
  is worth more later than the code diff.
- **Issues are the backlog.** Not a separate tool, not a spreadsheet — the same place
  the work happens.

## What you (the agent) say next

Do not offer a tutorial. Say some version of:

> "Here's the model — [six lines]. You won't need to run any of these commands
> yourself; I'll run them and tell you what happened in one line each time. Let's get
> you logged in and make the repo."

Then go to **S1 AUTH**.

## Things not to say

- Anything about the git object model, staging area internals, or rebase-vs-merge
  philosophy. Nobody needs this on day one.
- "It's easy once you get used to it." It isn't, and they'll feel patronized.
- A list of commands to memorize. You run the commands.
