#!/bin/sh
# Starts chatledger and opens it in the browser.
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "chatledger needs Node.js 20 or newer. Install it from https://nodejs.org or your package manager."
  echo "chatledger için Node.js 20 veya daha yenisi gerekiyor. https://nodejs.org adresinden ya da paket yöneticinizden kurun."
  exit 1
fi
exec node scripts/start.mjs "$@"
