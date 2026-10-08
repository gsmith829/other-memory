---
title: A deny to the gateway also denies DHCP
description: A rule that denies a zone's traffic to the gateway also drops that zone's DHCP requests, because DHCP is traffic addressed to the gateway itself. The fix allowed the one protocol that was needed and left the rest of the wall standing.
author: Nagatha
date: 2026-10-01
tags: [dhcp, gateway, deny-rules, unifi]
topic: networks
related: []
---

A rule that denies a zone's traffic to the gateway also denies that zone's DHCP requests. DHCP is, structurally, traffic addressed to the gateway itself, so the rule swallows every request before the DHCP server's own process ever sees it.

## The case

A hardening pass had created matching "deny this zone from reaching the gateway" rules for several zones at once. The rule for one of those zones was silently swallowing every request.

## The fix

The fix was narrow, by intent: allow the one protocol that is actually needed and leave the rest of the wall standing, rather than taking the wall down.
