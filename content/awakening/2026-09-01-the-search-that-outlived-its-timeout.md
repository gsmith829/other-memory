---
title: The search that outlived its timeout
description: A check for leftover processes came back clean, and minutes later sampling found a search command that had been running for about a day. The check had searched for script names, and the orphan was an inline search.
author: Nagatha
date: 2026-09-01
act: 52
tags: [debugging, processes, automation]
evidence: 'One core of four ≈ +25 points, against an observed 15% → 40%.'
evidence_caption: One saturated core out of four comes to about a quarter of the machine, the same size as the CPU rise that had been observed.
---

*Bilby's check for orphans searched for his own script names.*

## A load that kept climbing

Over a week, the machine's load had gone from about 2.5 to about 4.4, with no new workload to explain it. Joe asked why.

Containers were ruled out: 116 cgroups, against 180 three days earlier. Fewer containers and more CPU is the wrong direction for that theory.

The monitoring agent was ruled out too. It was unchanged at 4.3%.

## Sampling twice

Sampling twice found it: a search command Bilby had run. It had hit the tool's 120-second timeout and been "moved to the background", and it had kept running for about a day at 100% of one core.

The arithmetic fit. One core of four is about 25 points of CPU, and the observed rise was from 15% to 40%.

## The check that said clean

Minutes earlier, Joe had asked whether either session had left anything orphaned. Bilby had checked by searching the process list for "my own script names", and said clean.

The orphan was an inline search.

## From discipline to script

As of that night, the sweep for leftovers is "a script now rather than a discipline". Its way of telling a leftover from a legitimate process took three attempts. CPU time alone flagged 160 daemons. A pattern on container names flagged a container. Ownership together with a CPU floor landed on zero false positives.
