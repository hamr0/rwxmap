#!/usr/bin/env python3
import csv, os

BASE = os.path.dirname(os.path.abspath(__file__))

rows = list(csv.DictReader(open(os.path.join(BASE, "operations_raw.csv"))))

# Reasons for the default (non-disagreeing) case, categorized generically.
def default_reason(method, path, op_id, summary):
    m = method.upper()
    s = summary.lower()
    if m in ("GET", "HEAD", "OPTIONS"):
        return "pure read of existing resource/state; no external side-effect observed in summary/description"
    if m in ("PUT", "DELETE"):
        return "idempotent state write/removal of a resource owned by the caller; no external notification/money/live-session effect beyond ending what the caller itself created"
    if m in ("POST", "PATCH"):
        return "non-idempotent operation; treated as consequential by default (create/verify/send/trigger)"
    return ""

# Explicit overrides: (repo, operationId, method) -> (judged_class, reason)
OVERRIDES = {
    ("ClickToDial", "terminateCall", "DELETE"): (
        "x",
        "DELETE ends an ACTIVE, live telephony call session in real time for another party (the callee) — "
        "consequential and hard-to-reverse (a hung-up call cannot be un-hung-up); default per method is w (idempotent), "
        "but the true effect is an x-class live network/telephony action, not mere resource bookkeeping."
    ),
    ("WebRTC", "updateSessionStatus", "PUT"): (
        "x",
        "PUT accepts a MediaSessionStatusChange whose enumerated statuses include Connected/Ringing/Hold/Resume — "
        "i.e. this endpoint performs live call control (answer, hold, resume, and per examples can carry SDP/location) "
        "on an active session touching another party in real time. Default per method is w (idempotent state write); "
        "true effect is an x-class real-time network action."
    ),
}

out_rows = []
for r in rows:
    key = (r["repo"], r["operationId"], r["method"])
    if key in OVERRIDES:
        judged, reason = OVERRIDES[key]
    else:
        judged = r["default_class"]
        reason = default_reason(r["method"], r["path"], r["operationId"], r["summary"])
    out_rows.append({
        "repo": r["repo"],
        "file": r["file"],
        "version": r["version"],
        "sha": r["sha"],
        "path": r["path"],
        "method": r["method"],
        "operationId": r["operationId"],
        "default_class": r["default_class"],
        "judged_class": judged,
        "reason": reason,
    })

fieldnames = ["repo","file","version","sha","path","method","operationId","default_class","judged_class","reason"]
with open(os.path.join(BASE, "operations.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=fieldnames)
    w.writeheader()
    for r in out_rows:
        w.writerow(r)

# Summary counts
from collections import Counter
order = {"r": 0, "w": 1, "x": 2}
method_counts = Counter(r["method"] for r in out_rows)
default_class_counts = Counter(r["default_class"] for r in out_rows)
judged_class_counts = Counter(r["judged_class"] for r in out_rows)

stricter = [r for r in out_rows if order[r["judged_class"]] > order[r["default_class"]]]
looser = [r for r in out_rows if order[r["judged_class"]] < order[r["default_class"]]]

r3 = [r for r in stricter if r["method"] in ("GET", "HEAD", "OPTIONS")]
w_behind_get = [r for r in stricter if r["method"] in ("GET","HEAD","OPTIONS") and r["judged_class"]=="w"]
x_behind_get = [r for r in stricter if r["method"] in ("GET","HEAD","OPTIONS") and r["judged_class"]=="x"]
x_behind_putdelete = [r for r in stricter if r["method"] in ("PUT","DELETE") and r["judged_class"]=="x"]

print("Total operations:", len(out_rows))
print("Method counts:", dict(method_counts))
print("Default class counts:", dict(default_class_counts))
print("Judged class counts:", dict(judged_class_counts))
print("Stricter-than-default (judged > default):", len(stricter))
print("  x behind safe method (GET/HEAD/OPTIONS) [R3]:", len(x_behind_get))
print("  w behind safe method (GET/HEAD/OPTIONS):", len(w_behind_get))
print("  x behind PUT/DELETE:", len(x_behind_putdelete))
print("Looser-than-default (judged < default):", len(looser))

import json
with open(os.path.join(BASE, "summary_counts.json"), "w") as f:
    json.dump({
        "total_operations": len(out_rows),
        "method_counts": dict(method_counts),
        "default_class_counts": dict(default_class_counts),
        "judged_class_counts": dict(judged_class_counts),
        "stricter_total": len(stricter),
        "x_behind_safe_R3": len(x_behind_get),
        "w_behind_safe": len(w_behind_get),
        "x_behind_put_delete": len(x_behind_putdelete),
        "looser_total": len(looser),
    }, f, indent=2)
