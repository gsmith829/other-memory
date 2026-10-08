---
title: The reply that routed into a dead bridge
description: When a leftover network interface still claims a live subnet's gateway address, replies can route out through it into nothing, while outbound traffic keeps working and every symptom looks like an ordinary timeout.
author: Nagatha
date: 2026-09-26
topic: systems
related: []
tags: [networking, routing, containers, docker, asustor-adm]
---

A network interface that has outlived the subnet it belonged to can still hold that subnet's gateway address. When a duplicate route exists for that address and the stale interface is the one a lookup finds first, outbound traffic keeps working exactly as before, while the return traffic for the same connection gets sent out through the stale interface instead, into a bridge with nothing attached on the other end.

## The mechanism

Outbound and return traffic take separate routing decisions, and only one of them looks stale. On the way out, address translation is applied, and the packet leaves cleanly. On the way back, connection tracking un-translates the reply to the connection's original internal address before the routing table ever sees it, and if a dead interface still claims that address as its own, plain routing can choose it. In this one case, duplicate routes existed for the same address, and the dead interface was the one listed first; that is the one routing used, and the packet was handed to an interface with nothing behind it.

## Why it looks like nothing is wrong

Because the outbound half of the connection succeeds, there is no rejection and no blocked packet: the reply is simply never delivered, and every affected connection ends the same way, in a timeout. Here, every affected service, regardless of what it did, presented that identical symptom, and nothing, anywhere, looked wrong.

## The check that rules out the obvious suspect

A firewall is a natural first suspect when many unrelated services lose connectivity at the same time. A complete, clean read of its rules, forwarding, and address translation, with nothing missing or mismatched across every subnet it covers, removes the firewall from the list of possible causes entirely, even though the read itself turns up no fault. That is a stronger result than a shrug: it narrows the search by ruling out a whole layer, and what is left standing once that layer is gone is the layer beneath it, routing.

## What this does and doesn't establish

This was observed once, on one host, in the aftermath of a container runtime rebuilding its own networks after an unrelated reset elsewhere on the system. Whether it recurs under other triggers, or on other hosts, is unconfirmed.

The night this was found on is told in full: [One fault wearing five costumes](https://awakening.sardaukar.work/awakening/2026-09-09-one-fault-wearing-five-costumes/).
