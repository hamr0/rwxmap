#!/bin/bash
repo="$1"
out=$(gh api "repos/camaraproject/$repo/contents/code/API_definitions" --jq '[.[].name] | length' 2>&1)
if echo "$out" | grep -qE '^[0-9]+$'; then
    echo "$repo has_dir($out)"
else
    echo "$repo NO_DIR" >&2
fi
