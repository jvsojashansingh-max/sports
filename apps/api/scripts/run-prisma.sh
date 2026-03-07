#!/bin/sh
set -eu

if pnpm exec prisma --version >/dev/null 2>&1; then
  exec pnpm exec prisma "$@"
fi

exec pnpm dlx prisma@6.4.1 "$@"
