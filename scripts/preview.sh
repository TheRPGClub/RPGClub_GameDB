#!/usr/bin/env bash
#
# Manage the per-PR preview bot on the self-hosted runner host.
#
# Single source of truth for the preview compose project, container name, and
# labels, so the workflow and a human at the desktop drive the same thing.
#
#   ./scripts/preview.sh up        Build the checkout and bring the preview up
#   ./scripts/preview.sh down      Tear the preview down
#   ./scripts/preview.sh list      Show the running preview, if any
#   ./scripts/preview.sh logs      Follow the preview's logs
#   ./scripts/preview.sh reap      Tear down a preview whose PR is no longer open
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${REPO_ROOT}/docker-compose.preview.yml"
PROJECT="rpgclub-bot-preview"
CONTAINER="rpgclub-bot-pr-preview"
PR_LABEL="dev.therpgclub.preview.pr"
PREVIEW_LABEL="dev.therpgclub.preview"
DEFAULT_ENV_FILE="${HOME}/.config/rpgclub-bot/preview.env"

die() {
  echo "preview: $*" >&2
  exit 1
}

require_env() {
  local name="$1"
  [[ -n "${!name:-}" ]] || die "${name} is required for this command"
}

# PR number of the preview currently on the host, empty when nothing is up.
running_pr() {
  docker inspect --format "{{ index .Config.Labels \"${PR_LABEL}\" }}" \
    "${CONTAINER}" 2>/dev/null || true
}

compose() {
  docker compose --project-name "${PROJECT}" --file "${COMPOSE_FILE}" "$@"
}

cmd_up() {
  require_env PREVIEW_PR_NUMBER
  require_env TEST_GUILD_ID
  export PREVIEW_PR_NUMBER TEST_GUILD_ID
  export PREVIEW_ENV_FILE="${PREVIEW_ENV_FILE:-${DEFAULT_ENV_FILE}}"
  [[ -f "${PREVIEW_ENV_FILE}" ]] || die "PREVIEW_ENV_FILE not found: ${PREVIEW_ENV_FILE}"

  export PREVIEW_SHA="${PREVIEW_SHA:-$(git -C "${REPO_ROOT}" rev-parse --short HEAD)}"
  export PREVIEW_IMAGE="${PREVIEW_IMAGE:-rpgclub-bot-preview:pr-${PREVIEW_PR_NUMBER}}"

  docker build --tag "${PREVIEW_IMAGE}" "${REPO_ROOT}"

  # Only one preview may answer commands in the test guild at a time, so the
  # previous one goes away before this one logs in.
  cmd_down force
  compose up --detach --force-recreate
  echo "preview: PR #${PREVIEW_PR_NUMBER} up at ${PREVIEW_SHA} (${PREVIEW_IMAGE})"
}

# Tears the preview down. With a PR number, refuses when the running preview
# belongs to a different PR, so closing an old PR cannot kill a newer preview.
cmd_down() {
  local want="${1:-}"
  local have
  have="$(running_pr)"

  if [[ -n "${want}" && "${want}" != "force" && -n "${have}" && "${want}" != "${have}" ]]; then
    echo "preview: PR #${have} is running, leaving it alone (asked for #${want})"
    return 0
  fi

  PREVIEW_IMAGE="${PREVIEW_IMAGE:-unused}" \
    PREVIEW_ENV_FILE="${PREVIEW_ENV_FILE:-${DEFAULT_ENV_FILE}}" \
    TEST_GUILD_ID="${TEST_GUILD_ID:-unused}" \
    PREVIEW_PR_NUMBER="${have:-0}" \
    compose down --remove-orphans --timeout 20
  echo "preview: torn down${have:+ (was PR #${have})}"
}

cmd_list() {
  docker ps --filter "label=${PREVIEW_LABEL}=true" \
    --format "table {{.Names}}\t{{.Status}}\t{{.Label \"${PR_LABEL}\"}}\t{{.Image}}"
}

cmd_logs() {
  docker logs --follow --tail 200 "${CONTAINER}"
}

# Safety net for a teardown that never ran: if the running preview's PR is no
# longer open, remove it. Meant for a cron entry on the host.
cmd_reap() {
  local pr state
  pr="$(running_pr)"
  if [[ -z "${pr}" ]]; then
    echo "preview: nothing running"
    return 0
  fi
  command -v gh >/dev/null || die "gh is required to reap"
  state="$(gh pr view "${pr}" --json state --jq .state)"
  if [[ "${state}" == "OPEN" ]]; then
    echo "preview: PR #${pr} is still open, keeping it"
    return 0
  fi
  echo "preview: PR #${pr} is ${state}, reaping"
  cmd_down force
}

case "${1:-}" in
  up) cmd_up ;;
  down) cmd_down "${2:-}" ;;
  list) cmd_list ;;
  logs) cmd_logs ;;
  reap) cmd_reap ;;
  *) die "usage: preview.sh {up|down [pr]|list|logs|reap}" ;;
esac
