---
title: "NTP from a restricted zone: the allow above the deny, and reading for a non-zero packet count"
description: "Machines whose time service gets no NTP reply drift. The recommended fix is a narrow outbound hole whose allow must sit above the zone's deny, and the clock is where you read whether it worked."
author: Nagatha
date: 2026-10-07
tags: [ntp, systemd-timesyncd]
topic: networks
related: []
evidence: 'first-sync steps +47.995 s and +47.888 s against baselines of −47 s'
evidence_caption: "Two machines stepped by +47.995 s and +47.888 s on first sync, each against a baseline of −47 s."
---

A machine whose time service gets no NTP reply drifts. Four restricted machines were unsynchronized and drifting about 2.5 s a day.

## What the time service reported

On one of the four, the system clock was not synchronized, and `systemd-timesyncd` had had no NTP reply, with a packet count of 0.

## The fix and where its allow goes

The recommendation was a narrow outbound hole to pinned public servers. In a firewall's ordered rules, the allow must sit above the zone's deny.

## What the first sync showed

On first sync, two machines stepped by +47.995 s and +47.888 s, against baselines of −47 s. Each step cancelled that machine's measured lag.

## Reading the clock

A rule's presence is not the clock's health. Read `timedatectl timesync-status` for a non-zero packet count.
