#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

if [[ -f "$ROOT_DIR/backend/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/backend/.env"
  set +a
fi

export ENF_ADMIN_USERNAME="${ENF_ADMIN_USERNAME:-admin}"
if [[ -z "${ENF_ADMIN_PASSWORD:-}" ]]; then
  echo "ENF_ADMIN_PASSWORD is not configured."
  echo "Set it in backend/.env before starting the admin backend."
  exit 1
fi

FRONTEND_PORT="${ENF_FRONTEND_PORT:-5503}"
BACKEND_PORT="${ENF_BACKEND_PORT:-8000}"
FRONTEND_HOST="127.0.0.1"
BACKEND_HOST="127.0.0.1"

FRONTEND_LOG=".frontend.log"
BACKEND_LOG=".backend.log"
FRONTEND_PID_FILE=".frontend.pid"
BACKEND_PID_FILE=".backend.pid"

kill_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti tcp:"${port}" 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    echo "Stopping processes on port ${port}: ${pids}"
    kill ${pids} >/dev/null 2>&1 || true
    sleep 0.6
    local remaining
    remaining="$(lsof -ti tcp:"${port}" 2>/dev/null || true)"
    if [[ -n "${remaining}" ]]; then
      kill -9 ${remaining} >/dev/null 2>&1 || true
    fi
  fi
}

wait_for_endpoint() {
  local url="$1"
  local retries="${2:-20}"
  local name="$3"
  local i=1
  while [[ "$i" -le "$retries" ]]; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "${name} is ready (${url})"
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  echo "Failed to start ${name} (${url})"
  return 1
}

echo "Stopping existing ENF local servers on ${FRONTEND_PORT}/${BACKEND_PORT} (if any)..."
kill_port "${FRONTEND_PORT}"
kill_port "${BACKEND_PORT}"

if [[ -f "$FRONTEND_PID_FILE" ]]; then rm -f "$FRONTEND_PID_FILE"; fi
if [[ -f "$BACKEND_PID_FILE" ]]; then rm -f "$BACKEND_PID_FILE"; fi

echo "Starting ENF frontend on http://${FRONTEND_HOST}:${FRONTEND_PORT} ..."
nohup python3 -u -m http.server "${FRONTEND_PORT}" --bind "${FRONTEND_HOST}" > "$FRONTEND_LOG" 2>&1 < /dev/null &
echo $! > "$FRONTEND_PID_FILE"

echo "Starting ENF backend on http://${BACKEND_HOST}:${BACKEND_PORT} ..."
(
  cd "$ROOT_DIR/backend"
  nohup python3 -u -m uvicorn app.main:app --host "${BACKEND_HOST}" --port "${BACKEND_PORT}" > "$ROOT_DIR/$BACKEND_LOG" 2>&1 < /dev/null &
  echo $! > "$ROOT_DIR/$BACKEND_PID_FILE"
)

wait_for_endpoint "http://${FRONTEND_HOST}:${FRONTEND_PORT}/index.html" 15 "Frontend" || {
  echo "--- frontend log ---"
  tail -n 80 "$FRONTEND_LOG" || true
  exit 1
}

wait_for_endpoint "http://${BACKEND_HOST}:${BACKEND_PORT}/health" 25 "Backend API" || {
  echo "--- backend log ---"
  tail -n 120 "$BACKEND_LOG" || true
  exit 1
}

echo "Done."
echo "Website: http://${FRONTEND_HOST}:${FRONTEND_PORT}/index.html"
echo "Admin:   http://${FRONTEND_HOST}:${FRONTEND_PORT}/pages/admin.html"
echo "API:     http://${BACKEND_HOST}:${BACKEND_PORT}/health"
