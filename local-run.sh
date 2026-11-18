#!/usr/bin/env bash
# Local dev helper for this machine. Not part of upstream.
# Usage:
#   ./local-run.sh convex           # start the Convex backend (foreground)
#   ./local-run.sh ui               # start dashboard v1 on :5173
#   ./local-run.sh ui2              # start dashboard v2 on :5178
#   ./local-run.sh agent jarvis     # start one agent runner (jarvis|shuri|fury|vision|friday)
#   ./local-run.sh seed             # seed teams, agents, policies + orgId backfill
#   ./local-run.sh task "Title" "Description"
set -euo pipefail
cd "$(dirname "$0")"

case "${1:-}" in
  convex)
    CONVEX_AGENT_MODE=anonymous npx convex dev
    ;;
  ui)
    cd mission-control-dashboard && npm run dev
    ;;
  ui2)
    cd mission-control-v2 && npx next dev -p 5178
    ;;
  agent)
    name="${2:?usage: ./local-run.sh agent <name>}"
    npx tsx scripts/agent-runner.ts --config="agents/configs/${name}.soul.md"
    ;;
  seed)
    npx convex run seed:populate
    npx convex run init:setupEnterprise
    npx convex run local_seed:backfill
    ;;
  task)
    title="${2:?usage: ./local-run.sh task \"Title\" \"Description\"}"
    desc="${3:-}"
    npx convex run tasks:create "$(printf '{"title":%s,"description":%s,"status":"inbox","priority":"high"}' \
      "$(printf '%s' "$title" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))')" \
      "$(printf '%s' "$desc"  | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))')")"
    ;;
  *)
    sed -n '2,10p' "$0"
    exit 1
    ;;
esac
