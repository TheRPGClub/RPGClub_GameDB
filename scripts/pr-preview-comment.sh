#!/usr/bin/env bash
#
# Post or update the single preview status comment on a PR.
#
#   ./scripts/pr-preview-comment.sh <pr-number> <line> [line ...]
#
# Editing one marked comment keeps a PR that is pushed to ten times from
# collecting ten identical status comments. Requires GH_TOKEN.
#
set -euo pipefail

MARKER="<!-- rpgclub-bot-pr-preview -->"

pr="${1:?usage: pr-preview-comment.sh <pr-number> <line> [line ...]}"
shift
[[ $# -gt 0 ]] || { echo "pr-preview-comment: no body given" >&2; exit 1; }

body="${MARKER}"$'\n'"### PR preview"$'\n\n'
for line in "$@"; do
  body+="${line}"$'\n\n'
done

repo="${GITHUB_REPOSITORY:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"

existing="$(
  gh api "repos/${repo}/issues/${pr}/comments" --paginate \
    --jq "[.[] | select(.body | startswith(\"${MARKER}\")) | .id] | last // empty"
)"

if [[ -n "${existing}" ]]; then
  gh api --method PATCH "repos/${repo}/issues/comments/${existing}" \
    --field body="${body}" >/dev/null
  echo "pr-preview-comment: updated comment ${existing} on PR #${pr}"
else
  gh api --method POST "repos/${repo}/issues/${pr}/comments" \
    --field body="${body}" >/dev/null
  echo "pr-preview-comment: posted a new comment on PR #${pr}"
fi
