#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:?RELEASE_VERSION required}"
TAG="${2:?RELEASE_TAG required}"
OUT="${3:-release_body.md}"
REPO="${4:-${GITHUB_REPOSITORY:-}}"

if [ -z "${REPO}" ]; then
  ORIGIN=$(git config --get remote.origin.url 2>/dev/null || true)
  if [[ "${ORIGIN}" =~ github\.com[:/]([^/]+/[^/.]+) ]]; then
    REPO="${BASH_REMATCH[1]%.git}"
  fi
fi

PREV=""
if PREV=$(git describe --tags --abbrev=0 "${TAG}^" 2>/dev/null); then
  :
else
  PREV=""
fi

extract_changelog_section() {
  local ver="$1"
  local file="CHANGELOG.md"
  if [ ! -f "${file}" ]; then
    return 1
  fi
  awk -v ver="${ver}" '
    function trim(s) {
      sub(/^[ \t\r\n]+/, "", s)
      sub(/[ \t\r\n]+$/, "", s)
      return s
    }
    /^## \[/ {
      if (found) exit
      line = $0
      sub(/^## \[/, "", line)
      sub(/\].*$/, "", line)
      if (trim(line) == ver) found = 1
      next
    }
    found && /^## \[/ { exit }
    found { print }
  ' "${file}"
}

CHANGES=$(extract_changelog_section "${VERSION}" || true)
# Trim leading/trailing blank lines only (keep breaks between sections).
CHANGES=$(printf '%s\n' "${CHANGES}" | awk 'BEGIN{skip=1} { if (skip && $0 ~ /^[[:space:]]*$/) next; skip=0; print }')
CHANGES=$(printf '%s\n' "${CHANGES}" | sed -e :a -e '/^\n*$/{$d;N;ba' -e '}')

if [ -z "${CHANGES}" ]; then
  CHANGES="Maintenance and improvements. See the commit history link below for technical details."
fi

COMPARE_LINK=""
if [ -n "${REPO}" ] && [ -n "${PREV}" ]; then
  COMPARE_LINK="**Full commit history:** https://github.com/${REPO}/compare/${PREV}...${TAG}"
elif [ -n "${REPO}" ]; then
  COMPARE_LINK="**Full commit history:** https://github.com/${REPO}/commits/${TAG}"
fi

{
  cat <<EOF
## What's changed

${CHANGES}

EOF
  if [ -n "${COMPARE_LINK}" ]; then
    printf '%s\n\n' "${COMPARE_LINK}"
  fi
  cat <<EOF
## Download

Download **TBH Companion Setup ${VERSION}.exe** from the **Assets** section below (Windows installer).

## Install (Windows)

1. Download the \`.exe\` installer from this release.
2. Run the installer and choose an install folder if prompted.
3. If Windows SmartScreen appears, click **More info** → **Run anyway** (this build is not code-signed yet).
4. Launch **TBH Companion** from the Start menu.
5. On first launch, open **Settings** and confirm your save file path points to \`SaveFile_Live.es3\`.

## Upgrade

Run the new installer over your existing version. Settings and cached data stay in \`%APPDATA%\\TBH Companion\\\`.

## Troubleshooting

- Config and cache files live in \`%APPDATA%\\TBH Companion\\\`.
- Closing the main window keeps the app running in the system tray — use **Quit** from the tray menu to exit fully.
- If stats or inventory look stale after a game update, restart the app.
EOF
} > "${OUT}"
