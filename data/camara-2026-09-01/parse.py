#!/usr/bin/env python3
import os, sys, csv, yaml, glob

BASE = os.path.dirname(os.path.abspath(__file__))
SPECS = os.path.join(BASE, "specs")

SAFE = {"get", "head", "options"}
IDEMPOTENT = {"put", "delete"}
NONIDEMPOTENT = {"post", "patch"}
METHODS = SAFE | IDEMPOTENT | NONIDEMPOTENT

def default_class(method):
    if method in SAFE:
        return "r"
    if method in IDEMPOTENT:
        return "w"
    if method in NONIDEMPOTENT:
        return "x"
    return "?"

rows = []
errors = []

for repo in sorted(os.listdir(SPECS)):
    repo_dir = os.path.join(SPECS, repo)
    if not os.path.isdir(repo_dir):
        continue
    sha_path = os.path.join(repo_dir, ".sha")
    sha = open(sha_path).read().strip() if os.path.exists(sha_path) else "UNKNOWN"
    for fname in sorted(os.listdir(repo_dir)):
        if not (fname.endswith(".yaml") or fname.endswith(".yml")):
            continue
        fpath = os.path.join(repo_dir, fname)
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                doc = yaml.safe_load(f)
        except Exception as e:
            errors.append((repo, fname, f"PARSE_ERROR: {e}"))
            continue
        if not isinstance(doc, dict):
            errors.append((repo, fname, "NOT_A_DICT"))
            continue
        version = (doc.get("info") or {}).get("version", "UNKNOWN")
        paths = doc.get("paths") or {}
        if not isinstance(paths, dict):
            continue
        for path, item in paths.items():
            if not isinstance(item, dict):
                continue
            for method, op in item.items():
                mlower = method.lower()
                if mlower not in METHODS:
                    continue
                if not isinstance(op, dict):
                    continue
                op_id = op.get("operationId", "")
                summary = op.get("summary", "") or ""
                description = op.get("description", "") or ""
                rows.append({
                    "repo": repo,
                    "file": fname,
                    "version": version,
                    "sha": sha,
                    "path": path,
                    "method": mlower.upper(),
                    "operationId": op_id,
                    "summary": summary.replace("\n", " ").strip()[:300],
                    "description": description.replace("\n", " ").strip()[:600],
                    "default_class": default_class(mlower),
                })

print(f"Total operations: {len(rows)}", file=sys.stderr)
print(f"Parse errors: {len(errors)}", file=sys.stderr)
for e in errors:
    print(e, file=sys.stderr)

# write intermediate for judging
with open(os.path.join(BASE, "operations_raw.csv"), "w", newline="", encoding="utf-8") as f:
    fieldnames = ["repo","file","version","sha","path","method","operationId","summary","description","default_class"]
    w = csv.DictWriter(f, fieldnames=fieldnames)
    w.writeheader()
    for r in rows:
        w.writerow(r)

print("Wrote operations_raw.csv", file=sys.stderr)
