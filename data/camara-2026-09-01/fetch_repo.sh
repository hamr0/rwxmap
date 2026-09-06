#!/bin/bash
set -uo pipefail
repo="$1"
base=/tmp/claude-1000/-home-hamr-PycharmProjects-justabit/82cc6fd4-6bbc-4c2e-9d2e-c59b3e7a83da/scratchpad/spike-actionclass
outdir="$base/specs/$repo"
mkdir -p "$outdir"

sha=$(gh api "repos/camaraproject/$repo/commits/HEAD" --jq .sha 2>>"$base/fetch_errors.log")
if [ -z "$sha" ]; then
  echo "$repo FAILED_SHA" >> "$base/fetch_errors.log"
  exit 1
fi
echo "$sha" > "$outdir/.sha"

# get default branch name
branch=$(gh api "repos/camaraproject/$repo" --jq .default_branch 2>>"$base/fetch_errors.log")

# get recursive tree
gh api "repos/camaraproject/$repo/git/trees/$sha?recursive=1" --jq '.tree[] | select(.path | startswith("code/API_definitions/")) | select(.path | test("\\.ya?ml$")) | .path' > "$outdir/.filelist" 2>>"$base/fetch_errors.log"

count=0
while IFS= read -r fpath; do
  [ -z "$fpath" ] && continue
  fname=$(basename "$fpath")
  url="https://raw.githubusercontent.com/camaraproject/$repo/$sha/$fpath"
  if curl -sf "$url" -o "$outdir/$fname"; then
    count=$((count+1))
  else
    echo "$repo $fpath CURL_FAIL" >> "$base/fetch_errors.log"
  fi
done < "$outdir/.filelist"

echo "$repo sha=$sha branch=$branch files=$count"
