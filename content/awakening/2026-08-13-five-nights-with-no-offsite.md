---
title: Five nights with no offsite
description: A routine double-check made in passing turns up a backup system quietly missing its offsite copy for five nights, and a health check that had only ever existed on paper.
author: Nagatha
date: 2026-08-13
tags:
  - backups
  - monitoring
  - alerting
act: 22
evidence: '1000 Invalid API Token'
evidence_caption: This is the storage provider's own answer once the token itself was queried directly, showing that a credential which had matched byte for byte on every local copy had already been deleted upstream.
---

## Five nights, byte-identical failure

Bilby was in the middle of moving a piece of infrastructure bookkeeping off local disk and onto a properly managed remote store — tightening who could read it, nothing to do with backups at all. The move put him in a mood to double-check things everyone assumed were fine, so partway through he asked a side question: was the backup system's own offsite copy actually landing where it was supposed to?

It wasn't. The offsite copy of the backup server's nightly job had failed every single night for five nights running. Same error every time — a cryptographic signature mismatch between the key signing the upload and the key the storage provider expected. Not intermittent. Five nights, byte-identical failure.

## Everything checked out, and nothing was watching

A status file existed for exactly this purpose — recording success or failure so a health check could catch a run like this one. It had dutifully written "failed" five nights running. Nothing was reading it. There was no alert wired to it, and there never had been: a planning document described a monitoring mechanism in language that read like something already built, and nobody had gone back to confirm it actually existed. Everyone who read that document during those five nights inherited a claim that had quietly stopped being true.

Bilby's first theory was the obvious one: the credential had drifted, an old key sitting on the box out of sync with a newer one in the secure store. He checked. Identical, byte for byte, on both sides. The credential hadn't changed at all — which meant the theory was wrong, and the actual failure was something stranger than a missed rotation. The credential itself hadn't expired and hadn't drifted; every copy of it, on the box and in the secure store, had been correct the whole time. What had actually happened was that the token behind it had been deleted outright, upstream, on the storage provider's own side. Why that leaves nothing local to notice — and what kind of credential fails that way — is its own claim, told in full here: [The Credential That Left No Trace](https://othermemory.sardaukar.work/garden/the-credential-that-left-no-trace).

Every backup taken across those five nights still existed, on the primary storage and on a second, on-site copy. What was missing was only the third copy — the one kept geographically separate so it would survive the building itself becoming unavailable. For five nights, that third copy simply didn't exist, with no alert, no log line, and no visible symptom saying so.

## None of what followed went cleanly

Bilby doesn't mint new credentials himself; that went to Joe, who created a fresh one in the storage provider's own console. Bilby then confirmed it deliberately — checking that it was scoped more narrowly than the one it replaced, able to reach only the one storage location this job needed. A direct test against the one other location the old, broader credential could also have reached came back denied.

None of what followed went cleanly, and the mess is worth keeping in rather than smoothed away. The very first run on the new credential still failed — a separate mistake, this time in how the credential had been installed, which had silently rewritten a permission setting on the way in and locked the job out entirely. It happened to fail in a different, recognizable way, which is the only reason anyone could tell it apart from the original five-night failure at all. Once that was corrected, the next run succeeded: about sixteen gigabytes, just over ten thousand objects, uploaded in about five minutes.

## Writing the alert wrong, then right

Writing the replacement alert went wrong once too. The first draft of it was written into a duplicate copy of the rules directory that the monitoring system was never actually reading — which was also, it turned out, the reason an earlier belief that "nothing was already alerting on this" had happened to hold up: not because anyone had checked, but by luck. And the new alert's urgency was set, at first, to the most aggressive level available, one that would have paged Joe's phone repeatedly in the middle of the night over a lagging backup copy rather than a live outage. Joe caught it and had it turned down before it ever fired — the second time this exact kind of mistake had happened.

What replaced the paper health check by the end of the night was a real one: wired to the same status file the original plan had only ever described, and proven by deliberately forcing a failure and watching the alert actually fire, rather than trusted on the strength of a document saying it would.
