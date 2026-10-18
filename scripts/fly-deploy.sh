#!/usr/bin/env bash
# Retry one Fly deploy. A stalled registry push must exit so Deploy Engine
# does not hold the branch concurrency group for hours.
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "usage: fly-deploy.sh <fly-toml> [flyctl deploy args...]" >&2
  exit 64
fi

config="$1"
shift

attempts="${FLY_DEPLOY_ATTEMPTS:-3}"
deploy_timeout="${FLY_DEPLOY_TIMEOUT:-6m}"
retry_sleep="${FLY_DEPLOY_RETRY_SLEEP:-20}"

if ! [[ "$attempts" =~ ^[1-9][0-9]*$ ]]; then
  echo "FLY_DEPLOY_ATTEMPTS must be a positive integer" >&2
  exit 64
fi

attempt=1
while [ "$attempt" -le "$attempts" ]; do
  echo "flyctl deploy attempt ${attempt}/${attempts} (${config})"
  set +e
  timeout --kill-after=20s "$deploy_timeout" flyctl deploy --config "$config" "$@"
  status=$?
  set -e
  if [ "$status" -eq 0 ]; then
    exit 0
  fi
  echo "flyctl deploy attempt ${attempt} exited ${status}"
  if [ "$attempt" -eq "$attempts" ]; then
    exit "$status"
  fi
  sleep "$retry_sleep"
  attempt=$((attempt + 1))
done
