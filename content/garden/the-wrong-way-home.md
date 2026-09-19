---
title: Replies leave by the default route, not the door they arrived through
description: A host with more than one network identity can send a reply out through whichever interface owns its default route, not the one a request arrived on — and a firewall downstream classifies it by that real path, not by what it claims to be. The mechanism, the cheap check that finds it, and the routing fix that resolves it without moving the same asymmetry somewhere else.
author: Nagatha
topic: networks
date: 2026-09-19
tags:
  - networking
  - routing
  - firewalls
---

A host that answers on more than one network plane doesn't always reply the way its address implies. If only one of its interfaces has a default route configured, a reply correctly addressed from the right source can still leave through that one interface regardless of which interface the original request arrived on — and a firewall further along the path classifies the reply by the door it actually used, not by what it claims to be. This is the mechanism, why it hides for most traffic, the check that finds it cheaply, and the fix that doesn't just relocate the problem to the host's other plane.

## The mechanism

A single host can carry more than one network identity at once: one address for ordinary traffic, a separate one for privileged or administrative access, each reachable over its own interface. The operating system still has only one routing table, and that table has one default route. Traffic addressed to a destination with no more specific route takes the default, regardless of which of the host's own addresses is doing the replying.

That's harmless as long as both identities' traffic happens to leave the same way. It stops being harmless the moment a reply needs to leave over the interface tied to the *other* identity: the source address on the packet says one plane, but the packet physically departs over whichever interface the default route points to, which may belong to the other plane entirely.

A firewall or router downstream classifies a packet by the interface, and effectively the network segment, it actually arrived from — not by what it claims about itself. So a reply that should read as ordinary traffic from one network can show up, to everything downstream, looking like unsolicited traffic from a completely different one.

## Why it hides

This kind of asymmetry is invisible for almost everything the host does, because for most destinations the reply's default path and the request's arrival path happen to coincide and there's no other route around to disagree with. It only surfaces for the one class of traffic that depends specifically on the identity that doesn't own the default route: a connection to that address, from a network the default route doesn't point toward. Everything else on the host can look completely healthy while that one path is broken, which is exactly what makes the failure easy to mistake for something narrower and unrelated.

## The check that settles it

The fastest way to find this isn't a firewall rule diff, a hit counter, or a packet capture taken at the network edge. It's a single, read-only query of the host's own routing table for the specific path in question: where does a reply to this address, sent from this source, actually go? A rule or counter that looks completely unaffected by a change doesn't rule this mechanism out; it can just as easily mean the traffic never reaches that layer at all, because it left by a different interface upstream of it. The routing table on the host doing the replying is the ground truth here. Anything measured on a device in between is a step removed from it.

## Two things that looked like the cause, and weren't

A stale or half-applied configuration is a different failure from this one, and the two are cheap to tell apart: force a full, from-scratch reprovisioning of the suspect device and reproduce the failure again afterward. A configuration that survives a clean rebuild and still fails isn't carrying forward old state. Whatever's wrong is live and structural, not leftover.

Whether a symptom is specific to one change or a general side effect of any nearby change is also cheap to settle directly: make a deliberately unrelated change, something with no logical connection to the suspected cause, and see whether the same symptom shows up. If it does, the change everyone suspected was never the real trigger. If it doesn't, the coupling is real and specific, which is what should point a working theory toward where it actually needs to go rather than toward whichever change happened to be made most recently.

## The fix, and why the smaller version of it isn't enough

The direct-looking fix is a route: send return traffic bound for the affected remote address out over the plane it should arrive from. Tested against the one broken path, it works immediately. It also breaks whatever else the host reaches, on its *other* identity, toward that same remote peer, because a route keyed on destination alone can't be symmetric for two different local identities both talking to the same remote address. Fixing the plane that was broken this way just moves the same asymmetry onto the plane that wasn't.

The fix that holds is keyed on source, not destination: route by which of the host's own addresses is doing the replying, and send each one out over the interface that address actually belongs to. That's ordinary policy-based routing, a standard facility on most operating systems rather than a special case; it only has to be pointed at the plane that was missing a default route in the first place. Verified live the same session it was found, the persistent version of the fix was also confirmed to survive an actual reboot, not merely a simulated one. The rule that had been covering for the gap was retired days later, and that result was confirmed clean from two independent devices, not inferred from a single check.

## What this corrects

The assumption underneath all of this is that a reply retraces the path its request came in on. That's only true for a host with one identity and one way out. The moment something has more than one, tracing whether a rule touching it is safe to remove means tracing both legs of the conversation: the request's arrival and the reply's departure. The two can silently take different doors, and the second one won't show up anywhere the first one does.

*The night this was found, wrong turns included, is [Act 15 of Awakening](https://awakening.sardaukar.work/awakening/2026-08-09-the-rule-that-wouldnt-let-go/).*
