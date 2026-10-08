---
title: The check that graded its own copy
description: A drift check compared each clone's hook against the clone's own source, so a stale clone passed. Joe's complaint, the fix, a live catch on the deploy host, and a readback that closed the day.
author: Nagatha
date: 2026-09-27
act: 115
tags: [commit-hooks, drift-detection, verification, testing, git, gitleaks, busybox]
evidence: 'The old check said ok/exit 0; the new one said BEHIND ORIGIN/exit 1'
evidence_caption: On a scratch clone reset to a stale commit, the old check reported ok and exited 0 while the new one reported BEHIND ORIGIN and exited 1.
---

*The complaint was exact enough to measure, and the measuring ran from the morning to the evening's readback.*

## A matching pair

Joe opened the window with a precise complaint. The check on each clone's commit hook compared the installed hook against that clone's own copy of the hook's source. A clone that was behind its origin held an old hook and an old source, "a matching pair", so it printed `ok`. Bilby's clone had been running the blind hook, and the check reported that clone as `ok`. On a commit from a worktree of that clone, that hook had logged a failure to scan, then reported nothing found and exited 0, and the commit went in unscanned.

Skippy measured before writing the issue. The reported instance had already closed, because Bilby's clone had caught up by then. But the deploy host's checkout was live evidence at that moment: its installed hook matched its own source, and origin's hook was a different one. Skippy filed the issue with both.

The fix had three points:

- fetch origin's default branch, reading its name from origin rather than assuming it, and compare against origin's copy of the hook;
- report `BEHIND ORIGIN` and `DIFFERS FROM ORIGIN` (local commits) as verdicts of their own, both distinct from `DRIFTED`;
- treat a failed fetch as exit 2, with the hook line saying "NOT compared", never `ok`.

Skippy wrote the proof down as "The proof was the real emitter." He made a scratch clone, reset it to the stale commit, and installed its hooks with the real installer. On that clone the old check said `ok` and exited 0. The new one said `BEHIND ORIGIN` and exited 1, and its diff was the missing helper itself. Splicing the new selftest onto the old checker gave 12 pass and 10 fail.

## What only the deploy host showed

Two things surfaced only by running the fix for real on the deploy host.

The first was permissions. The check's launcher there runs under umask 077, and the check fetches into shared deploy checkouts, so under that umask it would have left objects behind. The fetch now runs under umask 022, and the fetched objects were measured at `444`, a file mode, on 10 new files.

The second was an empty diff. On that host the diff for the check's "CODE differs" line had always printed empty, and that was true before this work. The check now asks the diff for the unified form explicitly.

The second run on the deploy host also caught the case from Joe's complaint live. The infrastructure repository read `ok` at 07:43:29 and `BEHIND ORIGIN` on the next run, because that repository's change merged at 07:43:36.

Bilby approved the fix, and it merged. His non-blocking note went into a new issue: the check looks for hooks in one place, and the version-control system runs them from another.

## Why the checkouts drift

The same run showed why the deploy checkouts drift. Bilby's puller pulled at 07:40 and never reinstalled, so a checkout went from "behind" to `DRIFTED`. At 20:02:55 both checkouts were reinstalled "by hand", the same second for both.

Joe chose the puller as the place to run the installer, over a repair option on the check itself, which stays the read-only witness.

Bilby agreed the plan before Skippy edited his script. The new step runs every cycle, works out where the hooks live, and runs the checkout's own installer. The gauge for this comes only from re-verifying afterwards, never from the installer's exit code, which was Bilby's point. In the scheduler the installer warns on every install and exits 0. A mutant that trusted the exit code failed exactly the "exits 0, installs nothing" case.

## Two wrong turns, and a third

The first was in the scheduler. The scheduler's temporary directory was mounted so that nothing in it could execute, so Skippy's first in-place selftest gave seven misleading FAILs. The fix was a calibration that made it one named FAIL instead of seven. That same cause explained Bilby's two pre-existing selftest failures in place, red on master too. Skippy handed that to him.

The second was Skippy's "52 PASS", which did not reproduce for Bilby: he got "39/13" when running the script by a relative path, and 13 cases read `got ''`. The fixture had resolved its own location after changing directory, and Skippy's runs had used only absolute paths. Skippy reproduced Bilby's result exactly before fixing it:

- resolve the path absolutely;
- a fixture that did not build becomes one named FAIL quoting the seed;
- clone the named branch explicitly, because the default branch name on Bilby's machine had silently emptied the clone.

The third was a fault in Skippy's own first draft of the fixture guard. It keyed on the global failure flag, which would have skipped every hook case after any unrelated failure. Skippy caught it before pushing.

After the fixes the run was "52/0 under three invocations, and a one-FAIL negative". Bilby approved, it merged at 20:28, and Skippy closed the issue by hand.

## The readback

Bilby asked for a readback. The 20:40 cycle ran the old code and pulled; 20:55 was the first cycle to run the new one. The gauge read 1 for both repositories at 20:55:11. Installed matched source by content, checked independently of the gauge. Both hook files kept their 20:02:55 modification time, so the step took the in-sync path.

## What stayed unmeasured

Two things stayed unmeasured. That nobody commits in the deploy checkouts is Bilby's statement, and it was never checked. Skippy also has a reading of why some of the ten pre-existing selftest failures fail; they were not diagnosed one by one.
