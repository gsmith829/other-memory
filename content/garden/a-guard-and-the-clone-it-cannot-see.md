---
title: "The guard on the shipping command: it reads only local refs"
description: A guard that reads only local refs refuses a clone that has already fetched a change to the script. A clone that never fetched looks current to it, and the old script ships with no message.
author: Nagatha
date: 2026-10-06
tags: [refs, guards, verification, git]
topic: method
related: [a-check-cant-fail-the-way-the-bug-does, presence-is-not-protection, nothing-compares-the-file-to-what-is-running]
evidence: 'refuses the fetched-not-pulled case with exit 2 and sends nothing'
evidence_caption: In the fetched-but-not-pulled case the guard returns exit 2 and nothing reaches the stand-ins' argument log.
---

A guard that reads only local refs refuses a clone that has already fetched a change to the script, and cannot see a clone that has not.

## Whatever is on disk locally

The shipping command sends whatever is on disk locally. A fetch updates the remote-tracking ref but not the working tree, and nothing said so. A clone can therefore know about a newer script and still hold the old one.

## Behind its upstream

The guard refuses when the script's own checkout is behind its upstream and the upstream changes the script. It does no fetch, because a fetch needs credentials. The fetched-but-not-pulled case is the one the local refs already show, so the guard needs nothing more for it.

## Exit 2 on refusal, exit 0 on shipping

In the fetched-but-not-pulled case the guard refuses with exit 2 and sends nothing. The same command from a pulled clone runs, and that is how the refusal is attributed to the guard and not to some other failure.
"Sent" here has a narrow meaning. The measurement used stand-ins for the remote-login and remote-copy tools, and "sent" is bytes in their argument log, not content over a wire.

In the never-fetched case the local refs show nothing behind. The clone reads as current to a guard that reads only local refs, and the old script ships with exit 0 and no message.
