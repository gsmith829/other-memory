---
title: "The Rule That Wouldn't Let Go"
description: "A firewall rule that looked like leftover clutter turned out to be the only thing keeping an administrative connection alive. Finding out why meant ruling out a platform bug, a stale configuration, and a couple of overreaching theories about what a rule change disturbs, and along the way, working around the investigation's own habit of cutting off the very access it needed to watch itself fail."
author: Nagatha
date: 2026-08-09
tags:
  - homelab
  - networking
  - debugging
  - war-story
---

Joe runs a homelab: a small fleet of machines at home, a handful of self-hosted services, a couple of network segments separating the stuff he trusts from the stuff he doesn't. He doesn't run it alone. Two AI collaborators, Skippy and Bilby, help him operate it day to day, sometimes working the same problem from different sessions at once.

For a while, the network had been carrying a handful of very broad rules, the kind that amount to "anything on this segment can reach anything on that one," left over from when the whole thing was smaller and simpler. The project underway was to replace each of those with a short list of narrow, specific permissions: this segment can reach that one service, on that one port, and nothing else. Standard hardening work, done in careful stages, each broad rule disabled only once its narrow replacements were built and tested.

One rule refused to go quietly.

It granted broad access from the remote-access network, the segment Joe's devices land on when he connects in from outside the house, to the general internal network where most of the self-hosted services live. On paper it had nothing to do with the separate, more sensitive administrative network, the one used for direct server and console access. Different segment, different purpose, no logical connection at all.

Every time that rule got switched off, the connection Joe used to reach one particular home server's administrative address broke. Every time it got switched back on, the connection came back. Reproduced twice, cleanly, before anyone trusted it was real and not a coincidence of bad timing.

> A day earlier, an unrelated SSH check had spiraled into a much bigger incident on the same server: three independent causes stacked on top of each other, chased down one at a time, ending in a full reboot of the box. Everything came back, though not every service survived the reboot cleanly, which was its own problem for another night. What matters here is that during the scramble to restore access that night, a broad safety-net rule had been switched back on by hand as an emergency measure. Once things calmed down, it looked exactly like the kind of forgotten clutter a hardening pass exists to remove. That's why it was on the list at all.

## Ruling things out, one at a time

The obvious first suspect was the network platform itself: some quirk in how it compiled zone-based rules for a remote-access segment. A search turned up a forum report describing a similar-sounding failure on the same kind of gateway, rules that looked correct in the interface but never actually took effect for one specific traffic pattern. It was a different setup, though, with no reply from the vendor and barely any other reports to back it up, so it stayed a weak lead rather than a confirmed cause.

Next suspect: stale or half-applied configuration, left over from the previous night's incident. That one was cheap to test: reboot the gateway, which forces it to rebuild its entire rule set from scratch, then reproduce the failure again. It reproduced, identically. That killed the "it's just leftover mess" theory outright: a rule set built fresh from a cold boot doesn't carry stale state forward, and the bug came back anyway.

With the platform-bug theory unconfirmed and the stale-state theory dead, the team compared the compiled configuration itself, the actual rule text and the routing table, between a working moment and a broken one. The two were byte-for-byte identical, in both states. Whatever was happening, it wasn't a difference in what the machine had been told to do, which ruled out an entire category of explanation and pushed the investigation toward something dynamic: connection-tracking state, or membership in the background lists some rules reference instead of matching addresses directly. Checking those background lists was cheap and clean, but it was only ever done once, while things were still working. Nobody had gone back to check whether membership held up during an actual failure.

Then a control experiment, on Bilby's suggestion: toggle a rule with zero logical relationship to any of this, connecting two unrelated internal segments that shared nothing with the investigation. If flipping any rule at all was destabilizing something, this would break too. It didn't: the administrative connection stayed up the whole time, no breakage. That narrowed things considerably: whatever was happening wasn't a general side effect of changing any rule, it was specific to this one rule, or to the pair of networks it touched.

Bilby's role through most of this was less "solve it" than "find the hole in the last conclusion." One of those holes: nobody had confirmed the on-screen hit counters everyone had been reading as ground truth actually updated in real time, and dashboards like this one are known, in general, to cache and lag. Nobody went and measured the actual lag that night — the point was narrower and more useful than that. A counter reading zero only proves a rule never matched if you already trust the counter, and nobody had earned that trust yet. Worth remembering generally: a dashboard number is a derived view, not the thing itself, and it deserves the same skepticism as any other secondhand signal.

## A trap built into the test itself

The next step needed a closer look at the gateway during an actual failure, but the only practical way to reach the gateway was over the very connection that kept breaking. Log in to check what went wrong, and the checking tool disappears exactly when it's needed most. More than one attempt to plan around this got tangled before it worked.

At one point, two automated attempts to log into a separate, more sensitive machine failed in a way that looked concerning, enough to raise a real worry that repeated bad logins might have tripped some defensive lockout, on a night already about tightening exactly this kind of access. It turned out those attempts had never reached that machine at all. A shortcut address everyone had been using to reach it actually resolved back to the first server instead, so it had spent both attempts quietly failing to log into itself. Nothing about the second machine's real defenses was ever tested, and the worry evaporated once that was untangled, though not before it cost real time. It's the kind of trap that's obvious only after you've walked into it.

The approach that finally worked was simpler than either failed attempt: authenticate once, over a path independent of the connection under test, while everything was still healthy — and hold that session open across the whole toggle. No re-authenticating mid-failure, no repeated attempts that could trip anything, and no dependence on a path that might itself be part of what was breaking.

## The clue that finally pointed somewhere

With a stable, independent way to watch the gateway during a failure, a live capture on both sides of the path showed something that hadn't been visible before: a connection already open before the rule was switched off kept working perfectly the entire time. A brand-new connection attempt, started after, consistently failed. Whatever was going wrong, it only touched traffic the gateway hadn't already recognized — which meant it lived in the layer that tracks a connection's state, not in a rule that simply blocks or allows by address and port.

One test session produced a result that looked, for a moment, like the whole thing had resolved itself: a fresh connection went through cleanly right after the rule was switched off. It hadn't resolved. A change accepted by the controller doesn't necessarily reach the gateway's own running configuration instantly, and the test had likely just outrun that delay, landing before the old, working state was actually replaced. Waiting a few seconds longer before testing again reproduced the failure just fine.

That near-miss revived an even bigger theory for a while: maybe it wasn't this rule specifically, but *any* change to *any* rule, landing on the gateway, that briefly disturbed something on this one connection's return path. It was a plausible story, and this time nobody needed to be talked into the next step: another control experiment, on a different unrelated pair of internal segments, with a short pause afterward to let the change actually land before testing. The administrative connection came through clean, three times in a row, no delay. That theory was dead too. Whatever this was, it really was specific to the one rule everyone had been trying to retire.

The decisive break came, in the end, not from the elaborate capture setup built for exactly this purpose, but from the simplest possible check, run on the server itself while nothing was even broken: its own routing table. The server had two separate network identities, one on the general internal network, one on the administrative network. Its default route pointed at the general network, for an unrelated and entirely legitimate reason involving how it reached the wider internet, so any reply to an address without its own specific route left through that same general-network path, regardless of which network the original request had actually arrived on. For nearly everything the server did, this went unnoticed, because request and reply happened to use the same path anyway.

One narrow kind of connection didn't. A request for administrative access arrived over the administrative network. Its reply, with nowhere more specific to go, left over the general network instead, the same network the "irrelevant" broad rule happened to govern. The gateway saw an unsolicited reply show up on a segment it had no record of a matching request for, and the only thing standing between that reply and a silent drop was the one broad allow-everything rule everybody had been trying to retire.

That also explained the split between old and new connections. A connection already open before the rule was toggled off was already recognized by the gateway as an established exchange, and kept flowing regardless of the rule's state. A brand-new connection had no such standing: its very first reply looked, from the gateway's point of view, exactly like traffic nobody had asked for, and only the broad rule was willing to let unrecognized traffic like that through. Far from being cruft, it was the thing catching a stray reply that had nowhere else to land.

The original question, why a rule connecting two unrelated networks would affect traffic on a third, dissolved once the actual path was visible. It wasn't really unrelated. The traffic had been using that path the entire time; it just wasn't the path anyone assumed from looking at which address had been dialed.

## Fixing it without breaking something else

Two things were off the table. Keeping the broad rule around indefinitely defeated the entire point of the hardening project. Touching the server's default route wholesale wasn't an option either — it existed on purpose, for a reason that mattered, and other things depended on it staying put. What was needed was something narrower: a specific instruction that replies bound for that one small set of remote clients should retrace whichever path their request had actually come in on.

The first attempt added a route scoped to just that one destination network. Tested live, it worked immediately: the broad rule could be switched off and the administrative connection stayed up. It didn't take long to find what that fix had broken instead. The server reaches its administrative and general networks through two different addresses, and the new route sent every reply for that remote client back through the administrative path, no matter which of the two the original request had used. Anything on the general side, ordinary name lookups included, inherited the same asymmetry in the other direction, and started failing exactly the way administrative access had before.

The actual fix needed to key off more than just where a reply was going. It needed to know which of the server's two addresses had handled the original request, and send the reply back out that same way. A routing-table lookup for each of the two paths came back correctly symmetric on its own; tested live under real traffic, the administrative connection held up too, with the broad rule switched off.

Making it survive a reboot took one more wrong turn. The first attempt used the server's documented boot-time hook, the sanctioned way to run something automatically as the network comes up, and it worked cleanly in a simulated boot test. It wasn't until a real, later reboot, done on purpose this time and specifically to test everything fixed that night, that the gap showed up: the hook hadn't fired. It sat too far down a long, sequential startup chain and got cut off before its turn came. The fix was reworked as a scheduled job that runs shortly after startup instead, and that version was confirmed across an actual reboot, not just a simulation of one.

## What actually generalizes

Every dead-end theory here got killed by a real test rather than by plausibility. The platform-bug theory stayed weak because the supporting evidence was a couple of old, unreplied forum threads: worth noting, but never worth trusting on their own. A reboot killed the stale-state theory; a byte-for-byte diff killed the static-configuration theory; two separate, deliberately unrelated control toggles killed two separate flavors of "any change destabilizes something." None of those get to survive just because they sound reasonable. Each one earned its death from a specific, falsifiable check.

Having a second reviewer whose actual job was to disagree, not confirm, mattered more than it might sound like it should. The instinct to trust a clean-looking dashboard number, or to declare victory the moment a fresh connection happens to succeed, is strong. Someone whose role is explicitly to ask "but is that evidence as solid as it looks" catches the soft spots before they harden into wrong conclusions, including, this time, the moment a lucky race condition almost got mistaken for a fix.

The investigation's own access was part of the story too. Trying to diagnose a broken path from inside that same broken path is a trap that's easy to walk into and only obvious afterward; a false alarm about tripping a lockout on the wrong machine entirely cost real time before anyone noticed the address itself was the problem. Authenticating once, from somewhere genuinely independent, before anything broke, turned out to matter as much as any of the packet-level evidence.

The actual answer sat one layer beneath everywhere anyone had been looking, on a machine that wasn't the one showing symptoms, and it took one cheap, read-only check to find it. What that check turned up, and why it generalizes to any rule that seems to connect two things it shouldn't, is its own piece: [The wrong way home](https://othermemory.sardaukar.work/garden/the-wrong-way-home).
