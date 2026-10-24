#!/bin/sh
set -eu
set --
# Firebase CLI fails if an --import directory does not exist on first start.
if [ -f /state/snapshot/firebase-export-metadata.json ]; then
  set -- --import /state/snapshot
fi
exec firebase emulators:start --only auth,firestore --project demo-sonri-workflow --config /app/ops/staging/firebase.json "$@"
