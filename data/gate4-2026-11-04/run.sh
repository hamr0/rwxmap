#!/bin/bash
# usage: run.sh <cli> <outdir> <jev|mech>
CLI="$1"; O="$2"; M="$3"; mkdir -p $O
if [ "$M" = jev ]; then export RWXMAP_JEV_KEY=$(grep '^RWXMAP_JEV_KEY=' /home/hamr/PycharmProjects/rwxmap/.env | cut -d= -f2- | tr -d '"'"'"); else unset RWXMAP_JEV_KEY; fi
for s in specs/v*.json; do v=$(basename $s .json); $CLI $s --vendor $v -o $O --force > $O/$v.log 2>&1 || echo FAIL $v; done
