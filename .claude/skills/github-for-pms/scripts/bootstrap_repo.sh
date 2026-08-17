#!/usr/bin/env bash
# Scaffold a PM-run repo. Idempotent: never overwrites an existing file unless --force.
#
#   bootstrap_repo.sh --repo-root . --name "Checkout Redesign" --owner acme
#   bootstrap_repo.sh --repo-root . --name "X" --owner me --dry-run
#   bootstrap_repo.sh --repo-root . --name "X" --owner me --labels   # also create GH labels
#
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TPL="$SKILL_DIR/templates"

REPO_ROOT="."
NAME=""
OWNER=""
REPO=""
FORCE=0
DRY=0
DO_LABELS=0

usage() {
  sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo-root) REPO_ROOT="$2"; shift 2 ;;
    --name)      NAME="$2";      shift 2 ;;
    --owner)     OWNER="$2";     shift 2 ;;
    --repo)      REPO="$2";      shift 2 ;;
    --force)     FORCE=1;        shift ;;
    --dry-run)   DRY=1;          shift ;;
    --labels)    DO_LABELS=1;    shift ;;
    -h|--help)   usage 0 ;;
    *) echo "unknown option: $1" >&2; usage 1 ;;
  esac
done

[[ -z "$NAME" ]] && { echo "error: --name is required" >&2; exit 1; }
REPO_ROOT="$(cd "$REPO_ROOT" && pwd)"
[[ -z "$OWNER" ]] && OWNER="$(git -C "$REPO_ROOT" config --get user.name 2>/dev/null || echo OWNER)"
[[ -z "$REPO" ]]  && REPO="$(basename "$REPO_ROOT")"
DATE="$(date -u +%Y-%m-%d)"

created=0; skipped=0

# render <template-path> <dest-path>
render() {
  local src="$1" dest="$2" full="$REPO_ROOT/$2"
  if [[ -e "$full" && $FORCE -eq 0 ]]; then
    echo "  skip    $dest (exists)"; skipped=$((skipped+1)); return 0
  fi
  if [[ $DRY -eq 1 ]]; then
    echo "  would   $dest"; created=$((created+1)); return 0
  fi
  mkdir -p "$(dirname "$full")"
  if [[ -f "$src" ]]; then
    sed -e "s|{{PROJECT_NAME}}|$NAME|g" \
        -e "s|{{OWNER}}|$OWNER|g" \
        -e "s|{{REPO}}|$REPO|g" \
        -e "s|{{DATE}}|$DATE|g" \
        -e "s|{{ONE_LINE_DESCRIPTION}}|One line on what $NAME does and who it is for.|g" \
        "$src" > "$full"
  else
    : > "$full"
  fi
  echo "  create  $dest"; created=$((created+1))
}

# write_inline <dest> <<'EOF' ... EOF
write_inline() {
  local dest="$1" full="$REPO_ROOT/$1"
  if [[ -e "$full" && $FORCE -eq 0 ]]; then
    echo "  skip    $dest (exists)"; skipped=$((skipped+1)); cat > /dev/null; return 0
  fi
  if [[ $DRY -eq 1 ]]; then
    echo "  would   $dest"; created=$((created+1)); cat > /dev/null; return 0
  fi
  mkdir -p "$(dirname "$full")"
  cat > "$full"
  echo "  create  $dest"; created=$((created+1))
}

echo "Scaffolding '$NAME' into $REPO_ROOT"
[[ $DRY -eq 1 ]] && echo "(dry run — nothing will be written)"
echo

echo "Repo root:"
render "$TPL/repo/README.md"       "README.md"
render "$TPL/repo/CONTRIBUTING.md" "CONTRIBUTING.md"
render "$TPL/repo/ROADMAP.md"      "ROADMAP.md"
render "$TPL/repo/CHANGELOG.md"    "CHANGELOG.md"

echo
echo "Docs:"
render "$TPL/repo/docs-index.md"              "docs/README.md"
render "$TPL/product/problem-statement.md"    "docs/product/problem-statement.md"
render "$TPL/product/prd.md"                  "docs/product/prd-template.md"
render "$TPL/product/one-pager.md"            "docs/product/one-pager-template.md"
render "$TPL/product/launch-plan.md"          "docs/product/launch-plan-template.md"
render "$TPL/product/research-plan.md"        "docs/research/research-plan-template.md"
render "$TPL/product/adr.md"                  "docs/decisions/adr-template.md"

write_inline "docs/how-to/README.md" <<EOF
# How-to guides

Runbooks for **$NAME** specifically. One file per recurring task.

Write one the second time you do something — the first time it's a task, the
second time it's a process someone will need again.

| Guide | For |
|---|---|
| *(none yet)* | |

Suggested starting set: local setup · deploying · rolling back · adding a collaborator.
EOF

echo
echo "GitHub:"
render "$TPL/github/pull_request_template.md"      ".github/pull_request_template.md"
render "$TPL/github/ISSUE_TEMPLATE/feature.yml"    ".github/ISSUE_TEMPLATE/feature.yml"
render "$TPL/github/ISSUE_TEMPLATE/bug.yml"        ".github/ISSUE_TEMPLATE/bug.yml"
render "$TPL/github/ISSUE_TEMPLATE/research.yml"   ".github/ISSUE_TEMPLATE/research.yml"
render "$TPL/github/ISSUE_TEMPLATE/decision.yml"   ".github/ISSUE_TEMPLATE/decision.yml"
render "$TPL/github/ISSUE_TEMPLATE/config.yml"     ".github/ISSUE_TEMPLATE/config.yml"
render "$TPL/github/CODEOWNERS"                    ".github/CODEOWNERS"
render "$TPL/github/labels.yml"                    ".github/labels.yml"

echo
echo "Workflows:"
render "$TPL/workflows/ci.yml"          ".github/workflows/ci.yml"
render "$TPL/workflows/docs-check.yml"  ".github/workflows/docs-check.yml"
render "$TPL/workflows/auto-label.yml"  ".github/workflows/auto-label.yml"

echo
echo "Learning:"
render "$SKILL_DIR/learning/LEARNING-LOG.md" "learning/LEARNING-LOG.md"
render "$SKILL_DIR/learning/PLAYBOOK.md"     "learning/PLAYBOOK.md"

echo
echo "Harness state:"
if [[ $DRY -eq 1 ]]; then
  echo "  would   .pmops/state.json"
elif [[ -e "$REPO_ROOT/.pmops/state.json" && $FORCE -eq 0 ]]; then
  echo "  skip    .pmops/state.json (exists)"; skipped=$((skipped+1))
else
  python3 "$SKILL_DIR/scripts/pm_state.py" --project-root "$REPO_ROOT" init \
    --project "$NAME" ${FORCE:+--force} >/dev/null 2>&1 || \
    python3 "$SKILL_DIR/scripts/pm_state.py" --project-root "$REPO_ROOT" init --project "$NAME" --force >/dev/null
  echo "  create  .pmops/state.json"; created=$((created+1))
fi

echo
echo "Ignore file:"
write_inline ".gitignore" <<'EOF'
# Secrets — never commit these
.env
.env.*
*.key
*.pem
credentials.json

# Dependencies
node_modules/
.venv/
venv/
__pycache__/
*.pyc

# Build output
dist/
build/
.next/
out/

# OS / editor
.DS_Store
Thumbs.db
.idea/
.vscode/
*.swp

# Logs
*.log
npm-debug.log*
EOF

if [[ $DO_LABELS -eq 1 && $DRY -eq 0 ]]; then
  echo
  echo "Labels:"
  if command -v gh >/dev/null 2>&1; then
    while IFS= read -r line; do
      case "$line" in
        "- name: "*) lname="${line#*: }"; lname="${lname//\"/}" ;;
        *"color: "*) lcolor="${line#*: }"; lcolor="${lcolor//\"/}" ;;
        *"description: "*)
          ldesc="${line#*: }"; ldesc="${ldesc//\"/}"
          gh label create "$lname" --color "$lcolor" --description "$ldesc" --force >/dev/null 2>&1 \
            && echo "  label   $lname" || echo "  skip    $lname (failed — check auth)"
          ;;
      esac
    done < <(grep -E '^\s*(- name|  color|  description):' "$TPL/github/labels.yml")
  else
    echo "  gh CLI not found — create labels manually from .github/labels.yml"
  fi
fi

echo
echo "── $created created, $skipped skipped ──"
[[ $DRY -eq 1 ]] && exit 0

cat <<EOF

Next:
  1. Review the scaffold, then land it as a PR (not a direct push):
       git checkout -b chore/repo-scaffold
       git add -A && git commit -m "chore: repo scaffold — docs, templates, CI, learning log"
       git push -u origin chore/repo-scaffold && gh pr create --fill
  2. After it merges, turn on branch protection (see references/02-repo-setup.md).
  3. Fill in docs/product/problem-statement.md — that's the intake.
EOF
