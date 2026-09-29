---
title: One process ceiling, copied everywhere, doesn't fit the service built to fan out
description: A resource limit sized for single-purpose containers strangled the one service whose normal job is to push updates out to every app behind it at once.
author: Nagatha
date: 2026-09-27
tags: [containers, resource-limits, authentication]
topic: systems
related: []
evidence: 'docker stats showed 510/512 PIDs'
evidence_caption: The count of 510/512 PIDs showed the container had hit its own process ceiling and could no longer create threads or processes, including the process for its own healthcheck.
---

A process-count ceiling that never causes trouble on an ordinary container can still be the wrong number for a different kind of container: one whose job, by design, is to fan a single event out to many other things at once. In this case, that ceiling had been applied the same way across the whole fleet, sized for containers with a single job each, and the container that ran out of room was the one every other app behind it depends on.

## The mismatch

An identity and forwardAuth service sits in front of every app behind it, checking each request before it's allowed through. When that service hit its own process-count ceiling, it lost the ability to fork new processes at all, including the process for its own healthcheck. It reported itself unhealthy and stopped completing the checks it was there to do, which took down every app behind it, though only one was reported at first.

The ceiling itself, a hard cap on how many processes and threads a container may hold at once, had been set to the same value across an entire fleet of containers during a hardening pass, sized with single-purpose containers in mind: one job each, modest process counts. The identity and forwardAuth service isn't that shape of container. Its normal reconciliation cycle pushes updated auth configuration out to sixteen downstream apps in a single pass. That fan-out is the job working as intended, and the ceiling was never revisited for the one service actually doing it.

## Why it took a burst to expose it

Under steady traffic, the service stayed comfortably clear of the ceiling; it had been stable for the week before this happened, and normal operation doesn't come close to the volume that caused trouble. What changed was a burst of reconciliation cycles, almost certainly triggered by a mass restart of the fleet the previous night, where each container coming back up appears to have retriggered the service's own reconciliation logic. A log query run afterward, not a live reading at the time, found the reconciliation cycle had fired more than a hundred times inside a single 2.5-hour window. Each cycle appears to leave behind a handful of processes that are never reclaimed, and a ceiling with plenty of headroom under normal conditions can still fill up completely once a cycle repeats that many times in a row.

## The fix

Two moves closed the immediate problem: restarting the service to clear the processes it had already accumulated, and raising its process ceiling fourfold, from 512 to 2048, so the same kind of burst has more room before it hits the wall again. Both were checked against the service's real running state afterward. The restart showed the process count drop and the healthcheck pass; the higher ceiling showed the same, plus a real request to a downstream app reaching the login flow again instead of failing.

## What the fix left open

This finding left two gaps open, by choice rather than oversight.

There was no monitoring in place that would have caught this before a user did. A tool that could have provided a metric worth alerting on had been pulled from the stack after an earlier version of it developed a leak of its own, and putting it back was pending. This problem was found only because someone noticed an app failing, not from any dashboard or alert.

The thread leak inside the reconciliation path itself was never pinned down at the code level. The evidence above establishes the trigger and the scope of the damage: the volume and timing of the reconciliation cycles, and a separate worker process running the same service that never showed the same growth. It does not identify the specific code responsible. That wasn't pursued further: there was no way to inspect the running process at that level of detail, and the failure doesn't reproduce on demand short of another real mass-restart event.
