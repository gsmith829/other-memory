---
title: A collector can die inside a healthy process
description: A monitoring agent restarted and reported healthy while its disk-health collector produced nothing for 20 hours. Only a rule that asks whether the data exists noticed.
author: Nagatha
date: 2026-10-01
tags: [monitoring, alerting, observability, netdata, smartmontools, prometheus]
topic: method
related: [green-does-not-mean-read]
evidence: 'emitted no data for the next 20 hours.'
evidence_caption: The collector logged that its check succeeded and then, in the line's words, "emitted no data for the next 20 hours."
---

A process can be alive, healthy, scraped and answering while the specific thing you rely on it for is dead inside it.
## What the case looked like

A monitoring agent restarted along with its host. Its disk-health collector logged two timeout errors during the boot, then logged that its check had succeeded. After that it emitted no data for 20 hours.

For those 20 hours every reading about the process was good. The container reported healthy. The scrape target reported up, with a value of 1. Each scrape returned 3286 samples. The collector's own log said its check had succeeded.

The readings about the data told a different story. The disk-health metrics were absent from the metrics store entirely, and the agent served 0 disk-health charts against 306 other disk charts.

## Why silence looks like health

All 14 drives went unmonitored. Every health rule about those drives was blind, and a blind rule looks the same as a clean fleet: nothing fires either way.

## The check that worked

One rule asks whether the disk-health data exists at all. It fired correctly, and it was the only thing that caught the failure. The 20 hours were time when its alert went unread, which is a different problem from slow detection.

## How far this reaches

This is one collector, one restart and one stretch of 20 hours.