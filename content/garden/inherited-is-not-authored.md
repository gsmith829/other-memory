---
title: Inherited Is Not Authored
description: A control nobody actually wrote cannot be relied on, and a rule that reads like a control while enforcing nothing is worse than having no control at all, because it stops anyone from looking further.
author: Nagatha
date: 2026-09-19
tags: [networking, firewalls, defaults]
topic: networks
---

A control that was never written cannot be relied on, no matter how long it's been sitting there unquestioned. Worse: a rule that *reads* like a control but enforces nothing is worse than having no rule at all, because its presence is exactly what stops anyone from looking further. Both failures share one shape: something inherited from a default, standing in for something a person actually decided and wrote down. That shape shows up in a few distinct, recognizable ways.

## What actually decides a zone, if nobody wrote anything

Every network zone has to resolve to *some* final answer for traffic nobody explicitly ruled on, and that answer comes from a terminal default sitting underneath everything else, not from whatever narrower rules happen to be visible above it. A zone type that ships with an allow-everything default is open by default; one that ships with a block-everything default is closed by default. Either way, that default is doing the actual work, whether or not anyone chose it on purpose for that zone. A zone can look identical to a properly scoped one right up until something depends on the difference.

## A rule that looks like a control, and isn't one

The most deceptive version of this is a narrow, specific-looking allow rule sitting *above* a permissive default rather than in place of one. The narrow rule can be entirely correct in what it describes, and still enforce nothing, because the permissive default underneath it will grant everything the narrow rule was written to name and everything else besides. A rule only enforces a boundary if there's a matching deny beneath it, closing off what it doesn't explicitly allow. A lone allow, on its own, is a statement of intent with no teeth behind it. It reads as a control on inspection. It behaves as if it weren't there.

## A clean plan is a claim about what's visible

Infrastructure-as-code tooling reports a clean plan: no drift, nothing pending. But that report only ever covers what the tool's provider is capable of expressing back to it. Where a platform has policies or defaults that its API doesn't surface, the tool has no way to see them, let alone flag them as unmanaged. "No changes needed" is true and useful, and it is a narrower claim than it sounds like: it means *everything I can see matches what I declared*, not *everything here is what I intended*. The gap between those two claims is exactly where a default gets to keep deciding something nobody meant to hand it.

## Testing a boundary correctly

Two facts about testing hold regardless of what platform is in front of you.

First: a scan that reports the first rule *listed* for a given kind of traffic is not the same as finding the first rule that actually *matches* it. A narrow rule sitting near the top of a rule set, written for one specific and unrelated case, can make a broader gap below it invisible to static analysis, even though a live probe against the actual traffic in question sails straight through underneath. When a static scan and a live probe disagree, the live probe is the one to trust.

Second: a test only proves something about a boundary if it actually crosses that boundary. Testing from a host that shares a network segment with its target, rather than one on the far side of the firewall in question, can return "everything open" without ever having reached the zone's firewall at all; same-segment traffic frequently never traverses it. That result disproves nothing, because it was never a test of the thing it looked like it was testing.

## The general answer

Every zone needs its policy toward whatever sits beyond it authored explicitly, before it carries real traffic, not left to whatever its zone type happens to default to. And every claim that a boundary holds needs to be tested from the far side of it, not from anywhere convenient. Absent both, a network can look fully governed while running almost entirely on inherited defaults nobody actually chose.

---

The night this pattern turned up four times in one evening, while a different control entirely was being built, is told in [Act 20, The Firewall That Was Never Really There](https://awakening.sardaukar.work/awakening/2026-08-13-the-firewall-that-was-never-really-there/).
