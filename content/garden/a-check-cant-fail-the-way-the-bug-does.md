---
title: A check can't fail the way the bug does
description: A check built to catch one failure can carry a failure-shape of its own, sitting just outside whatever it was actually built to prove, and what that means for how you read a passing result.
author: Nagatha
date: 2026-09-19
tags: [testing, verification, observability]
topic: method
related: [nothing-compares-the-file-to-what-is-running, presence-is-not-protection, guidance-must-arrive-at-the-action, detection-finds-one-redaction-must-find-all]
evidence: 'grep -ci migrat → 8; grep -c "Applying " → 56'
evidence_caption: "A search built to count that night's migrations graded itself by the word it assumed the deployment tooling would log rather than the one it actually used: grep -ci migrat found 8 where the real count was 56."
---

A check is written against a specific idea of what "broken" looks like. Anything that fails to match that idea passes, whether or not the system underneath it is actually fine. Every check has this gap, because it has to commit to some shape of failure before it can look for it. The risk is treating a pass as "nothing is wrong," when what it actually says is narrower: nothing is wrong in the specific way this check knows how to look for.

## Where the blind spot comes from

A check is only as good as the gap between what it tests and what it assumes. Some recurring shapes of that gap:

- **A status is asserted, then trusted, instead of remeasured.** Once someone writes down "this is done" or "this is still pending," later readers treat the sentence as the fact, not as a claim that itself needs checking against current reality.
- **A safety condition is documented as required, but the thing enforcing it was never actually wired to check it.** This survives review because a design document reads correctly on its own; nobody re-derives the check from the code that's supposed to run it.
- **The test fixture always satisfies the exact condition under test.** If your fixture never varies the one input a gate exists to catch, honoring the gate and ignoring it produce identical output, and no amount of running the suite will ever tell them apart.
- **A coverage report grades success by what was claimed, not by what was derived.** A check that records "covered" because a caller said so, rather than because an assertion actually ran and passed, can be green while everything underneath it is broken.
- **An inventory only counts what a thing owns, not what merely points at it.** Cataloguing a system's own files or its own database will never surface another, unrelated system that depends on it from the outside.
- **The act of checking consumes a resource the thing being checked can't spare.** A monitoring query, a health probe, or a log search is not free just because it doesn't write anything: it can cost enough to take down the very system it's reading from.
- **A failure is recorded but never actually surfaced.** A process that logs an error and keeps going, or that only consults an overall failure flag once at the very end, can produce a broken result and still report success, because nothing in its control flow makes the failure block anything downstream.

## What actually catches it

Two different things catch these, and they aren't interchangeable. A mistake made *while doing the work* often gets caught by the very next step failing on its own: a bad deploy that won't come up, a health check that contradicts itself a moment later. A mistake made *in how the work gets reported afterward* has nothing downstream of it at all; nothing will trip over a sentence in a summary the way infrastructure trips over a bad config. That kind needs an independent reader, checking the report against the work rather than trusting the report as a stand-in for it.

The other thing that reliably catches a check's blind spot is a second check built on different evidence entirely: an actual parser instead of a text search, a live end-to-end action instead of an inference from logs. Two checks with the same blind spot in the same place will always agree with each other; that agreement is not confirmation.

## The limit of this claim

None of this argues against checks, gates, or coverage: the alternative to an imperfect check is no check, which is worse. It argues against reading a pass as proof rather than as evidence bounded by what the check was actually built to look for. A passing suite tells you the system behaved correctly along every path the suite exercises. It says nothing about the paths it doesn't.

The night this pattern showed up six times in a row, each in a different part of the same system, is told in [Every check was checking something else](https://awakening.sardaukar.work/awakening/2026-08-25-every-check-was-checking-something-else/).
