# Launch Plan — {{FEATURE}}

| | |
|---|---|
| **Owner** | @{{OWNER}} |
| **Target date** | {{DATE}} |
| **PRD** | {{PRD_LINK}} |
| **Status** | Planning · In rollout · Complete · Rolled back |

---

## What users get

*One paragraph, in their words, not ours. This text should be reusable in the
changelog and the announcement.*

## Readiness gate

Everything must be checked before stage 1 begins.

- [ ] Acceptance criteria met on every Must requirement
- [ ] Instrumentation live and verified — *we can see it working before users do*
- [ ] Error states handled and tested
- [ ] Rollback verified, not just written
- [ ] Support/docs updated
- [ ] Stakeholders told
- [ ] Legal/privacy reviewed *(if user data is touched)*

## Stages

| Stage | Audience | Duration | Gate to advance | Rollback trigger |
|---|---|---|---|---|
| 0 — Internal | Team | 2 days | No P0 bugs | Any |
| 1 — Beta | {{N}} opt-in users | 1 week | Success metric neutral-or-better; no P0 | Metric drop >X% |
| 2 — 10% | Random 10% | 3 days | Counter-metric stable | Counter-metric moves >X% |
| 3 — 50% | Random 50% | 3 days | Same | Same |
| 4 — GA | Everyone | — | — | — |

**Who can pull the trigger:** *Name a person. "The team" is not a person.*

## What we're watching

| Signal | Where | Healthy | Alarm |
|---|---|---|---|
| Primary metric | | | |
| Counter-metric | | | |
| Error rate | | | |
| Support volume | | | |

## Rollback

**How:** *The exact command or toggle.*
**Time to execute:** *Minutes.*
**Blast radius if we don't:**
**Who decides:**

## Comms

| Audience | Channel | When | Owner |
|---|---|---|---|
| Internal team | | Before stage 0 | |
| Support | | Before stage 1 | |
| Beta users | | At stage 1 | |
| All users | Changelog / email | At GA | |

## Post-launch

- [ ] 48h check — metrics, errors, support
- [ ] 1 week — did the metric move as predicted?
- [ ] 2 weeks — retro, and a `learning/LEARNING-LOG.md` entry
- [ ] Close the milestone

---

## After it's done

**Did the metric move as predicted?**
**What surprised us?**
**What would we do differently?** → *promote to `learning/PLAYBOOK.md` if it's a
lesson that will recur.*
