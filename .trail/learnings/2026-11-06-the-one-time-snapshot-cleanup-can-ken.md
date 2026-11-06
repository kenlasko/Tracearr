---
title: "The one-time snapshot cleanup can fill Postgres's lock table, so drop the old history in batches by hand"
author: Ken
date: 2026-11-06
branch: main
cost: { minutes: 3, tokens: 20123 }
id: l-426abdcc
scope: repo
status: active
src: agent
touches:
  - apps/server/src/jobs/maintenanceQueue.ts
---

## Decided
On the home cluster, the one-time library snapshot normalization was stuck failing since the database was created (2026-09-26). Its single drop_chunks call covered ~4,286 daily chunks back to 2015. The fix was to drop the pre-stamp chunks by hand in roughly yearly batches. Afterwards the job's own drop_chunks has almost nothing to do, so it succeeds, sets snapshotsNormalizedAt and regenerates the history as designed.

## Tried and ruled out
- Raising max_locks_per_transaction: it avoids touching data, but restarts the whole CNPG cluster just to fit one cleanup job.
- Patching the job to drop in batches: the right long-term fix for the fork, but it doesn't help the running instance until a new image is built.

## Watch out
- While the drop runs, it takes several exclusive locks per chunk in one transaction and overruns the shared lock table (max_locks_per_transaction 128 × max_connections 200). Every other tracearr connection then fails with FATAL 53200 "out of shared memory". It looks like a database outage, not one bad job.
- The job only records success when it finishes, so it retries on every trigger and every pod restart.
- library_snapshots uses 1-day chunks and the backfill reconstructs history back to 2015, so a fresh install creates thousands of chunks again.

In the code:
- apps/server/src/jobs/maintenanceQueue.ts processNormalizeLibrarySnapshotsJob: `SELECT drop_chunks('library_snapshots', older_than => ${stamp})`
- settings rows (name/value): mediaVersionsBackfilledAt = stamp, snapshotsNormalizedAt = null until success
- Manual batches: drop_chunks('library_snapshots', older_than => '<year>-01-01') for 2016 through 2025, then '2026-06-01', then the stamp
