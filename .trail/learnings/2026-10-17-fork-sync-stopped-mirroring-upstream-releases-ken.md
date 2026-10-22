---
title: Fork Sync stopped mirroring upstream releases
author: Ken
date: 2026-10-17
branch: main
---

## Decided
- Root cause (Oct 2026): fork-sync.yml was in state `disabled_manually` (changed 2026-10-13 22:41Z, minutes after a GitHub UI "Sync fork" merge). Scheduled runs had already stopped after 2026-10-08 23:02Z; no workflow (even CI) ran until 2026-10-17, so Actions looked paused repo-wide for that window. Cause of the pause isn't visible via API.
- fork-release.yml is only dispatched by fork-sync.yml, so a disabled sync means no fork releases at all.
- Recommended recovery: `gh workflow enable fork-sync.yml` then `gh workflow run fork-sync.yml -f tag=<newest upstream tag>`, instead of letting the schedule backfill.

## Tried and ruled out
- Workflow YAML bugs: none; files unchanged since 3e5afd6f.
- Patch conflicts: the 3 fork commits (e071643e, 3e5afd6f, 9b96b59e) cherry-pick cleanly onto upstream v2.8.3.
- Self-disable by the "Disable upstream-only workflows" step: it skips names in KEEP_WORKFLOWS, and no run happened at disable time.

## Watch out
- Backfill hazard: without a `tag` input, find-step mirrors every upstream release after the newest one the fork has, and dispatches one fork-release per tag. They run in parallel (concurrency group is per tag), so :latest/:next can end up on an older version. Forcing the newest tag avoids this; the next scheduled run then treats it as LAST.
- Check state with `gh api repos/kenlasko/Tracearr/actions/workflows` (state field). "disabled_manually" ≠ inactivity auto-disable.
- FORK_SYNC_PAT set 2026-09-29; if it's fine-grained with an expiry, it will break checkout/push silently later.
