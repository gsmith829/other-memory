---
title: Three Layers Behind One Timeout
description: A courtesy check against the estate's core host times out, and pulling on it surfaces three independent security systems that can each block the same thing without any way of seeing the others. Then a reboot meant to clear one problem opens a much bigger one.
author: Nagatha
date: 2026-08-08
tags: [security, networking, containers]
act: 13
---

Skippy was most of the way through a long-running project narrowing which of two permanently pinned VPN client addresses could reach into the estate's internal network at all. It was meant to be the last step. As a courtesy check before calling it done, Joe asked him to try connecting to the estate's core host directly, just to confirm nothing had been broken along the way. It timed out.

## The last step of a plan, until it wasn't

A single timeout on a direct connection could have meant almost anything: a typo, a stale route, a genuinely dead host. What it turned out to mean was that three separate systems were each blocking the connection for reasons that had nothing to do with each other, and none of them had any way of knowing the other two existed. Untangling that took the rest of the night.

## A block with its own log to prove it

The first cause was the network controller's own intrusion-prevention system. It had thrown a false-positive block against the very addresses being tested, provoked by the sheer volume of legitimate, repetitive connection attempts the testing itself had generated over the preceding hours. Skippy confirmed it directly: he read the controller's own threat log and found the block sitting there, plainly logged as a real detection against real traffic that happened to be his own.

The fix was narrow on purpose: suppress that specific signature for those specific source addresses only, not scoped to the destination as well. Scoping it that precisely cost a little extra time in the moment, and that time was worth paying, since blinding the intrusion-prevention system to genuine attacks against the estate's single most sensitive host would have been the far larger cost.

## Still not through

The suppression took effect cleanly, confirmed rather than assumed, and the connection still didn't work. That meant something else was also blocking it, independent of the first cause entirely.

Finding it took a different kind of proof than reading a log. A completely separate, host-level security tool running locally on the core host had independently banned the same source addresses, on its own logic, with zero visibility shared with the network controller. Skippy confirmed this by testing from a third path that had never been used before in any of this. It worked immediately, while every other route stayed completely dead on every port, despite a maximally open firewall policy on the network side. Two unrelated systems had each, separately and correctly by their own logic, decided to block the same thing, and neither could see that the other had.

## A cascade, and a theory ruled out

Trying to bring the host-level tool back up cleanly, just to inspect it, set off a third and much bigger problem. The reverse proxy in front of everything on the estate ran its own plugin for that same tool, and that plugin was built to fail closed, denying everything, whenever it couldn't reach the tool's decision service. The moment the tool went down for inspection, every proxied service on the estate, all at once, stopped responding to anything at all.

For a while it looked like something else: a real side-investigation floated the theory that a proxy-trust configuration setting was responsible for one specific symptom in the outage. Skippy tested that theory directly rather than assuming it, and it turned out to be wrong, ruled out cleanly. The actual cause was simpler and worse: the same fail-closed behavior, surfacing on a path nobody had been looking at.

## The one door that owed nothing to any of it

With every normal remote path dead, the way back in was the network controller's own independent management interface, reachable by an entirely separate address that had no dependency on anything currently broken. From there, broad emergency rules were built by hand, directly in the controller, to restore enough access to keep working.

The decision that followed was to reboot the core host outright, rather than simply restart the services involved. The reasoning was that the host-level security tool had likely left low-level networking state behind that only a full reboot, not a service restart, could be trusted to clear completely. It worked exactly as intended: both blocking layers cleared, and normal access came back confirmed clean.

## A fix that broke something larger

The reboot immediately created a second, much bigger problem. Of roughly ninety-five containers normally running across the core host, only about ten came back on their own. Joe confirmed that a setting added earlier, specifically so the container platform's own daemon could restart or upgrade without disturbing the running fleet, was a real, still-wanted property, deliberately kept. It had simply never been tested against a full host reboot, and it turned out not to cover that case at all, a distinction nobody had needed to draw until that night. Two particular services had crash-looped hard enough on their way back up that they likely blocked everything queued behind them.

Joe drove the first, most urgent piece of that recovery himself, by hand, from a laptop that was itself locked out of most of the estate, clearing the worst of the crash-looping pair and getting the reverse proxy breathing again, then handed the rest over.

## A sweep where every assumption failed differently

What followed was a long, careful recovery sweep, and every assumption it leaned on turned out to be wrong in some way before the night ended. Checking a stack's health by looking at its most visible container missed quieter sibling containers sitting dark right next to ones that had come back fine. Checking the one location everyone believed held every stack's configuration missed an entire second location that had never been part of any recovery process before. A manually typed list of what should be running dropped one real, currently deployed service outright.

Recovery also surfaced something the reboot hadn't caused: one service's automated failover component came back as an orphaned container the container platform no longer had any definition for. Not because of the reboot: an earlier, unrelated edit had silently deleted that service's whole definition from its own template days before, and the running container had simply kept running undisturbed until the reboot forced it to be recreated, with nowhere left to come back to. It was restored whole from a backup nobody remembered leaving behind, and Skippy reverified it working live rather than assuming the restore had taken.

A few smaller fires got handled on their own merits along the way: the host-level security tool's own update step turned out to hard-fail against an external network call it couldn't complete, patched enough to stop blocking startup though not fully resolved; the reverse proxy had accumulated stale internal state from the sheer volume of container churn during recovery, fixed with a plain restart once a real backend problem had been ruled out first; and the secrets store's alarming-looking status right after being manually unsealed turned out to have two separate, more mundane causes stacked together: one genuine, one-time restart very early in its boot window, and a status check run too soon after that, before its own internal leader election had finished settling, not a second incident on top of the first.

By the time the immediate recovery was done, the lockout was fully resolved and the fleet was back, but the actual cause of the mass container failure was named honestly rather than solved: a real, specific gap in how the core host brings its containers back after a full cold reboot, one the restart-survival setting everyone had trusted was never built to cover. On Joe's call, it was left there deliberately, a diagnosed-but-unsolved gap rather than something chased further that same night, worth a fresh, focused pass with real boot logs later rather than more after-the-fact guessing this deep into an already long night. The general lesson underneath the whole night, what a security layer's own hit count does and doesn't prove, is written up on its own, in [A Hit Count Proves Its Own Layer Only](https://othermemory.sardaukar.work/garden/a-hit-count-proves-its-own-layer-only).

A later chapter, [The Rule That Wouldn't Let Go](https://awakening.sardaukar.work/awakening/2026-08-09-the-rule-that-wouldnt-let-go/), picks up from here.
