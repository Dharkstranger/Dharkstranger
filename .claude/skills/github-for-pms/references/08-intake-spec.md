# Intake Contract — exactly what information is needed

This file answers the question every PM asks: *"What do you need from me to start?"*

## The short answer

**One sentence describing the problem.** That is the floor. Everything else can be
drafted, assumed, and corrected.

Do not send a PM a form. A blank form is a wall; a filled-in draft they can argue
with is a ramp. Get Tier 0, draft the rest marked as assumptions, let them react.

## Tiers

### Tier 0 — Required to do anything (1 item)

| Field | Why it's needed | Example |
|---|---|---|
| **Problem statement** | Names the thing being solved. Without it, nothing downstream can be judged right or wrong. | "Guest shoppers abandon at payment because we force account creation." |

If they give you a feature instead of a problem ("build me a wishlist"), accept it
and reverse-engineer the problem in one question: *"What goes wrong today that a
wishlist fixes?"* Then proceed.

### Tier 1 — The Core Five (needed for a PRD and a repo)

| # | Field | The question to actually ask | If they can't answer |
|---|---|---|---|
| 1 | **Problem** | "What breaks for someone today?" | Blocked — ask again differently |
| 2 | **User** | "Who specifically hits this? Not 'users' — which ones?" | Assume the broadest plausible segment, mark `ASSUMPTION` |
| 3 | **Outcome** | "If this works, what number moves, or what becomes possible?" | Draft 2 candidate metrics, have them pick |
| 4 | **Shape** | "Is this a document, a website, a prototype, a service, an internal tool?" | Infer from the problem; confirm in one line |
| 5 | **Constraints** | "Deadline, budget, tech you must use, anyone who must approve?" | Assume none; say so explicitly |

Ask at most **3 per turn**. Conversational, not interrogative.

### Tier 2 — Sharpens the PRD (draft these; don't block on them)

- **Current workaround** — what people do today instead. Reveals real severity.
- **Scale** — how many people, how often. Separates papercut from fire.
- **Non-goals** — what this explicitly is not. The highest-leverage field in any PRD.
- **Success criteria** — the specific threshold that means "done and it worked."
- **Risks / unknowns** — what would make this fail.
- **Dependencies** — other teams, vendors, APIs, data you don't own.
- **Stakeholders** — who reviews, who approves, who must be told.

### Tier 3 — Only for the GitHub setup itself

| Field | Default if unanswered |
|---|---|
| Repo name | kebab-case slug of the project name |
| Owner | the PM's personal GitHub account |
| **Visibility** | **private — always. Never default to public.** |
| Default branch | `main` |
| Collaborators | none initially |
| License | none for private; ask explicitly before adding one to a public repo |
| Tech stack | infer from Shape; confirm in one line before scaffolding |

## What you accept as input

The PM may arrive with any of these. All are valid entry points — never send
someone away to "write a proper PRD first."

| They bring | You do |
|---|---|
| A one-line idea | Tier 1 questions, then draft the PRD |
| A problem statement | Draft the PRD directly, ask only about Outcome + Constraints |
| A full PRD | Review it against the Tier 2 list, flag gaps, go straight to S5 PLAN |
| Meeting notes / voice dump | Extract the Core Five yourself, show them what you extracted, ask them to correct it |
| A competitor link or screenshot | Ask what specifically they want the equivalent of, and for whom |
| A spreadsheet of feedback | Cluster it into 3–5 problem statements, have them pick one to start |
| "Just build me X" | Build it. Reverse-engineer the problem into the PRD as you go. |

## The gap-marking convention

Every document you generate uses these markers, consistently, so gaps are greppable:

- `⚠️ NEEDS INPUT: <question>` — you could not draft it; the PM must answer.
- `ASSUMPTION: <what you assumed>` — you drafted it; the PM should confirm or correct.
- `TODO(@handle): <action>` — a named human owes something.

Before leaving S2, list every `⚠️ NEEDS INPUT` back to the PM in chat, ranked by
how much damage a wrong answer would cause. Ask about the top two. Let the rest ride.

## Question bank (pull from this; don't recite it)

**Problem**
- What happens today that shouldn't?
- Who complains, and in what words?
- What does it cost when it goes wrong — time, money, trust?

**User**
- Who is the single person you picture using this?
- What are they doing in the 5 minutes before they need this?
- Who is explicitly *not* the user here?

**Outcome**
- How will you know in 30 days whether this worked?
- What's the smallest version that would still be worth shipping?
- What would make you kill this?

**Shape & constraints**
- Does this need to be real software, or would a doc/prototype settle the question?
- Who has to approve before it reaches anyone outside the team?
- Is there a date this is tied to?

## Anti-patterns

- ❌ Sending a 20-field template before writing anything.
- ❌ Blocking on metrics. Draft two, let them choose.
- ❌ Asking about tech stack before understanding shape.
- ❌ Treating a vague answer as a dead end — write the assumption down and move.
- ❌ Re-asking something already answered in a linked doc. Read the doc first.
