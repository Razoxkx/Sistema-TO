#!/usr/bin/env bash
set -euo pipefail
project_dir=$(git rev-parse --show-toplevel)
cd "$project_dir"
branch=$(git branch --show-current)
case "$branch" in
  main|dev) ;;
  *) printf 'Selecciona la rama main o dev antes de desplegar.\n' >&2; exit 1 ;;
esac
printf 'Compilando y desplegando la web de la rama %s…\n' "$branch"
docker compose -f compose.server.yaml build --build-arg "APP_GIT_BRANCH=$branch" web
docker compose -f compose.server.yaml up -d --no-deps web
printf 'Web desplegada desde %s.\n' "$branch"
