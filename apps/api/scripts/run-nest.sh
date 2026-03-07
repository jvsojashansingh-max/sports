#!/bin/sh
set -eu

if pnpm exec nest --version >/dev/null 2>&1; then
  exec pnpm exec nest "$@"
fi

exec pnpm dlx @nestjs/cli@11.0.5 "$@"
