#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="${SCRIPT_DIR}/mod/chemlab3d"
ARCHIVE="${SCRIPT_DIR}/mod_chemlab3d.zip"

if ! command -v zip >/dev/null 2>&1; then
  echo "Error: 'zip' is required. Install it with: sudo apt install zip" >&2
  exit 1
fi

rm -f "${ARCHIVE}"
(
  cd "${SCRIPT_DIR}/mod"
  zip -qr "${ARCHIVE}" chemlab3d -x 'chemlab3d/.DS_Store' 'chemlab3d/**/.DS_Store'
)

echo "Built Moodle plugin: ${ARCHIVE}"
echo "Archive root: chemlab3d/"
