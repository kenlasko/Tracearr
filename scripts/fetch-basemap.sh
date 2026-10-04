#!/usr/bin/env sh
# Extracts the stream map basemap from the Protomaps daily planet build.
# Usage: scripts/fetch-basemap.sh [output path]
# BASEMAP_BUILD (YYYYMMDD) overrides the build and BASEMAP_MAXZOOM the zoom ceiling.
set -eu

BUILD=${BASEMAP_BUILD:-}
MAXZOOM=${BASEMAP_MAXZOOM:-8}
PMTILES_VERSION=1.31.2
OUT=${1:-data/basemap.pmtiles}

if command -v pmtiles >/dev/null 2>&1; then
  PMTILES=pmtiles
else
  os=$(uname -s)
  arch=$(uname -m)
  case "$arch" in aarch64) arch=arm64 ;; esac
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' EXIT
  base=https://github.com/protomaps/go-pmtiles/releases/download/v$PMTILES_VERSION
  case "$os" in
    Linux)
      curl -fsSL "$base/go-pmtiles_${PMTILES_VERSION}_Linux_${arch}.tar.gz" | tar -xz -C "$tmp" pmtiles
      ;;
    Darwin)
      curl -fsSL -o "$tmp/pmtiles.zip" "$base/go-pmtiles-${PMTILES_VERSION}_Darwin_${arch}.zip"
      unzip -q "$tmp/pmtiles.zip" pmtiles -d "$tmp"
      ;;
    *)
      echo "no pmtiles build for $os; install one from $base and put it on PATH" >&2
      exit 1
      ;;
  esac
  PMTILES=$tmp/pmtiles
fi

if [ -n "$BUILD" ]; then
  builds=$BUILD
else
  builds=$(curl -fsSL https://build-metadata.protomaps.dev/builds.json \
    | grep -o '"key": *"[0-9]\{8\}\.pmtiles"' | grep -o '[0-9]\{8\}' | sort -r | head -n 3)
fi
if [ -z "$builds" ]; then
  echo "no Protomaps build found in https://build-metadata.protomaps.dev/builds.json" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT")"
for build in $builds; do
  if "$PMTILES" extract "https://build.protomaps.com/$build.pmtiles" "$OUT" --maxzoom="$MAXZOOM"; then
    echo "basemap: Protomaps build $build, zoom 0-$MAXZOOM"
    exit 0
  fi
  echo "Protomaps build $build failed, trying an older one" >&2
done
echo "could not extract a basemap from Protomaps builds: $builds" >&2
exit 1
