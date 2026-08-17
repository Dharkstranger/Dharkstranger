# Planning — PRD → milestones → issues → board

**S5 PLAN.** Turning a document into tracked work.

## The hierarchy

| Level | GitHub object | Horizon | Example |
|---|---|---|---|
| Outcome | **Milestone** | Weeks | "M1 — Guest checkout live for 10% of traffic" |
| Slice | **Issue** | Days | "Guest can enter email and reach the payment step" |
| Step | **Task checkbox** inside an issue | Hours | `- [ ] Add email field to the checkout form` |
| Change | **Pull request** | One sitting | `feat/guest-email-field` |

Everything above a milestone belongs in `ROADMAP.md`, not in GitHub objects.

## Slicing — the one skill that matters here

**Slice by user-visible value, never by technical layer.**

❌ Layer slicing (nothing is shippable until all four land):
- Build the database schema
- Build the API
- Build the UI
- Add analytics

✅ Value slicing (each one is real, testable, and could ship alone):
- Guest can enter an email and reach payment
- Guest receives an order confirmation
- Guest can convert to an account after purchase
- Team can see guest-vs-account conversion in the dashboard

Test for a good slice: **can you describe it as something a person can now do?**
If the only way to describe it is in nouns ("the auth service"), it isn't a slice.

## Writing an issue

Every issue needs three things. If you can't write the third, the slice is too vague
to start — go back to the PRD.

1. **Context** — why this matters, linked to the PRD section.
2. **Scope** — what's in, what's explicitly out.
3. **Acceptance criteria** — observable, checkable statements.

```markdown
## Context
Guest shoppers abandon at account creation (42% drop-off, see PRD §3).

## Scope
In: email capture, pass-through to the existing payment step.
Out: guest order history, account conversion (separate issue #17).

## Acceptance criteria
- [ ] A shopper without an account can reach the payment step with only an email
- [ ] The email is validated and stored against the order
- [ ] An existing account holder is offered login, not blocked
- [ ] Drop-off at this step is instrumented and visible in the dashboard

## Out of scope / non-goals
Guest checkout for subscription products — different flow entirely.
```

Acceptance criteria are the contract. Written well, they eliminate the "that's not
what I meant" round-trip that eats a week.

## Creating issues

```bash
gh issue create \
  --title "Guest can reach payment with only an email" \
  --body-file /tmp/issue.md \
  --label "type:feature,size:M" \
  --milestone "M1 — Guest checkout"

gh issue list --milestone "M1 — Guest checkout"
gh issue list --label "needs:input"        # what's blocked on a human
```

Batch creation from a PRD: draft all issues in one file, show the PM the **titles
only** for approval, then create them. Never create 20 issues without showing the
list first.

## Milestones

```bash
gh api repos/:owner/:repo/milestones -f title="M1 — Guest checkout" \
  -f description="Guests complete purchase without an account" \
  -f due_on="2026-09-30T00:00:00Z"
```

Rules:
- Named for the **outcome**, not the sprint number.
- At most **4 open at once**. More than that and it's a wish list.
- Has a date. An undated milestone is a label wearing a costume.

## Projects (the board)

Use a Project when more than one person is working, or there are more than ~15 open
issues. Below that, `gh issue list` is faster than any board.

Columns that work: `Inbox → Ready → In progress → In review → Done`.
The one rule: **"Ready" means acceptance criteria are written.** Nothing enters
"In progress" from a vague issue.

## Turning a PRD into a plan — the procedure

1. Read the PRD. Extract every user-visible capability it implies.
2. Group them into 1–3 outcomes → those are milestones.
3. Within each, order slices so that **the riskiest assumption is tested first.**
   Not the easiest thing, not the prettiest — the thing most likely to be wrong.
4. Write acceptance criteria for the first 3–5 slices only. Writing them for work
   two months out is fiction, and you'll rewrite it anyway.
5. Label everything. `needs:input` on anything blocked on a human answer.
6. Post the plan summary in chat with issue URLs.

## Keeping it honest over time

- An issue open more than 30 days with no activity: close it or schedule it. A
  backlog nobody reads is a liability, not an asset.
- When scope changes, edit the issue body — don't bury the change in comment #14.
- When a decision gets made in an issue thread, promote it to
  `docs/decisions/` as an ADR. Threads get lost; ADRs get read.

## Exit condition for S5

A milestone exists with linked issues, each with acceptance criteria, and the PM has
the URLs.
