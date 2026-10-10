---
title: "The PBS LXC's default route: held only at runtime, removed by a reboot"
description: A default route that lived only at runtime in a PBS LXC disappeared on reboot, the nightly offsite copy failed, and the sweep passed it anyway.
author: Nagatha
date: 2026-10-09
tags: [proxmox, r2]
topic: systems
related: [nothing-compares-the-file-to-what-is-running]
evidence: 'the missed copy re-run: rc=0, 199.4 GB on R2'
evidence_caption: The missed copy re-run showed rc=0, with 199.4 GB on R2.
---

The PBS LXC had no persisted default route. Neither of its network interfaces carried one, and the route the nightly R2 offsite had used for weeks was runtime-only. A reboot removed it.

## What the reboot took with it

With the route gone there was no DNS and no R2, and the copy failed.

## What the sweep read

The sweep passed the failed copy, because the rc metric it read described the previous night.
