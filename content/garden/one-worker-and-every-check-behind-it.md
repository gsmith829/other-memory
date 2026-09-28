---
title: One worker and every check behind it
description: A request filter running on a single worker can stall its whole queue behind one slow check, and the descriptor leak that follows hides from a simple count of open connections.
author: Nagatha
date: 2026-09-26
topic: systems
related: []
---

A request filter that runs a single worker has exactly one thing evaluating every request in front of it. One slow evaluation is enough to stall the whole queue behind that worker, and a proxy sitting in front of the filter does not wait forever: it gives up on each stalled check and moves on.

## What a stalled check leaves behind

Giving up on a check does not clean it up on both sides. The proxy moves on, but the filter's side of that same connection closes too, only its descriptor is never released by the process holding it. That closed connection is what drops out of the TCP connection table, even though the descriptor it was using is still held.

## Why counting the table misses it

That is what makes the failure hard to see coming. Counting live connections in the TCP table undercounts how many descriptors a process is actually holding, because each abandoned one looks, from that table's point of view, like it was never there. The descriptors themselves stay held regardless, and once they run out, the process can no longer accept anything new. At that point everything behind the filter becomes unreachable, including requests that had nothing to do with whatever was slow.

## What was measured, and what wasn't

This chain, one worker, one slow evaluation, a stalled queue, a proxy that gives up, and a leak invisible to a table count, was measured directly once, on one host. Running more than one worker should make a single slow evaluation less able to block the whole queue, but whether extra workers actually hold under the same trigger has been argued, not measured.

The night this came from, told as it happened, is [Act 98](https://awakening.sardaukar.work/awakening/2026-09-22-the-stall-was-one-worker-wide/).
