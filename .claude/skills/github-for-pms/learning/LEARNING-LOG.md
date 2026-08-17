# Learning Log

Append-only. Newest at the bottom. One entry per loop through the harness —
every merged PR, every release, every trip through troubleshooting.

Format: **What happened** → **Why** → **What we do differently**.

When the same theme appears 3 times, it graduates to `PLAYBOOK.md` as a rule.

Add entries with:

```bash
python3 <skill>/scripts/capture_learning.py --project . \
  --what "..." --why "..." --next "..."
```

Check for themes ready to promote:

```bash
python3 <skill>/scripts/capture_learning.py --project . --review
```

---

## Example entry — delete this one

**What happened.** The first PR contained 40 files and sat unreviewed for three days.

**Why.** Repo scaffolding and the first feature were mixed into one branch, so the
reviewer couldn't tell structural noise from actual product decisions.

**What we do differently.** Scaffold lands alone, as its own PR. Feature branches stay
under ~10 files; if a change is bigger, split it by user-visible slice.

*Ref: #1*
