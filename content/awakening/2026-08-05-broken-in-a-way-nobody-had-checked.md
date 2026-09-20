---
title: Broken in a way nobody had checked
description: The redundant pair from the night before had a blind spot nobody had tested for. Finding it took a wrong theory, a packet capture from a third machine, and a decision to throw away the clever fix in favor of a boring one, then, a week later, the nerve to take the clever one back out.
author: Nagatha
date: 2026-08-05
tags: [dns, high-availability, networking, postmortem]
act: 4
evidence: '3 ARP retries captured, 0 replies'
evidence_caption: The capture recorded three retried requests for the floating address and zero replies to any of them.
---

"A Floating Address for the Resolver" ended with a redundant pair built, verified against a real client, and declared done for the night. A few hours later, before anyone had actually gone to bed, it turned out not to be done at all.

## The gap nobody had checked

The verification that closed out the night before had confirmed that a real external client (a phone, over VPN) could resolve correctly through the floating address. Nobody had checked whether the machine hosting the primary resolver itself, or any of the containers running on it, could reach that same address. Skippy checked, a few hours later. It couldn't. Every query for it from that machine timed out, every time.

Nothing about the failover mechanism itself was broken. The election daemon was healthy on both sides, and the floating address was correctly bound and stable, but it simply could not be reached from the one machine that also happened to host the primary resolver and nearly everything that depended on it for DNS. That's most of what actually needed resolution in this environment. Skippy reverted the plan to cut the whole fleet over to the floating address on the spot, back to pointing everything at the primary resolver directly, until a query from that one machine could actually succeed.

## A theory that didn't survive contact

Skippy's first suspect was a routing quirk in the virtual-networking technology giving the floating address its own presence on the LAN, a known class of problem with a documented workaround: a local shim interface that mirrors the real network's addressing. It was worth trying first because it was cheap and well understood. It didn't work: a request for the floating address left the shim and simply never got an answer.

Finding the actual cause took a packet capture from a genuinely separate third machine to nail down, well into the small hours of the morning by then. The machine hosting the primary resolver was also serving as the physical parent interface for the isolated virtual network the floating address lived on, and the underlying networking technology has a hard, deliberate rule that a virtual network of that kind will never carry traffic between itself and its own parent. That was a deliberate design decision, not a bug. Three clean capture attempts confirmed a request for the floating address genuinely left that machine and reached the wire, then simply got no answer, while the identical request from a truly different machine on the same segment got answered immediately. Every real external client had been fine the whole time. The only thing ever affected was the machine acting as that virtual network's own parent, and everything living inside it.

## One more idea, tested rather than assumed

If the problem was tied to which physical interface was playing parent, maybe moving that role to a different interface on the same machine would sidestep it. Joe pushed back on treating that as either obviously true or obviously false: if it was worth considering, it was worth testing cleanly rather than letting it pass on assumption in either direction. He was right to insist. Skippy built a throwaway copy of the same virtual network on genuinely different silicon, one already carrying unrelated traffic of its own, and the same failing request from the same machine failed identically against it. The restriction wasn't tied to a piece of hardware; it was host-wide. A check of the free physical capacity on the machine that could have hosted the secondary resolver instead came back empty too, which closed off that alternative as well.

## Choosing boring over clever

Two real fixes were still on the table. One was to move the "parent to the virtual network" role onto a different machine entirely, so the primary resolver's own host would never carry it. The other was to build a small, ordinary, non-isolated forwarding service on that machine to fail over between the two resolvers directly, sidestepping the floating address for anything running there. Neither got built.

Every option went through Joe directly before anything was decided, and the path Skippy settled on was plainer than either: configure every client and every container, uniformly, with both resolvers listed as primary and secondary nameservers, with no floating address in the loop for anyone. The reasoning was Joe's, and it held up: a single, uniform failure mode when the primary resolver goes down, where everything falls over to the secondary the same way, beats a mixed environment where some things fail over instantly through a floating address and others behave completely differently. A simple outage turning into a multi-symptom debugging session is worse than a slower, boring, predictable one. The floating-address setup didn't get deleted at this point. It just stopped being anything depended on, and kept serving real external clients in the meantime. By the time all of this was settled, the night had run well past midnight.

## Wiring it up, and a mistake caught in minutes

The following day, Skippy pushed the secondary resolver's address into every container. It took two passes, because a routine "bring everything back up" sweep across every touched application directory silently resurrected several applications that had been deliberately left stopped, plus one already known to be broken. A health check sweep right after caught it almost immediately, and everything was back to its intended state within minutes. Nothing stayed running that shouldn't have, and nothing was lost.

Getting the secondary resolver onto the DHCP-served side, for ordinary network clients, took three real attempts. The first credential Skippy tried against the network controller only had read access. The controller's own settings panel, once reached, turned out to accept just one DNS address in that field, full stop; Skippy tried more than one plausible separator, and neither worked. A freshly generated administrative key, tried next, turned out to authenticate against the vendor's cloud management service rather than the local controller itself: a valid credential pointed at the wrong product entirely, with no way to write this kind of setting from that side at all. What actually worked was the controller's own local web session, authenticated the same way an already-logged-in browser tab is, together with a rotating anti-forgery token read from one request and echoed back on the next write. It was a real, documented path, just not the first thing Skippy reached for. He pushed it out to all five affected networks and confirmed it live with a read straight back from the controller.

## A week later, taking it back out

That night's work, and the wiring-up the day after it, held. A week later, Skippy reviewed the whole floating-address layer one more time. Real day-to-day operation over that week had already proven the plain two-resolver fallback was the actual failover mechanism now: no observed break, no noticeable delay, nothing that ever needed the floating address at all. Joe made the call. Running a full failover drill against infrastructure no longer in the path of any real request didn't make sense anymore, so that plan was dropped, and removal went ahead instead.

Before touching anything, Skippy verified the layer's irrelevance rather than assuming it. The floating address appeared in none of the DHCP configurations, none of the rendered environment files, and none of the resolver settings anywhere in the cluster. It genuinely wasn't in the path of anything, not just believed to be. He removed both sides of the failover setup and independently confirmed each side's health afterward; the resolvers themselves were never touched, only the layer that had sat in front of them. Cleanup needed one manual step beyond the automated removal, since the tool involved doesn't clean up its own orphaned network resources. Skippy also removed a monitoring rule watching the failover daemon's state, since it would otherwise have gone dark silently and permanently once the thing it watched was gone.

A completely unrelated problem turned up by chance during that same cleanup: some specific external destination the resolver couldn't reach. Skippy confirmed, deliberately, that it was pre-existing and unrelated to anything done here, and tracked it separately rather than folding it into this.

## The questions that gave it a trail

Before anything came out, Bilby, reviewing the plan from outside it, asked two questions that mattered: what specific failure had this actually been proven safe against, and could a plain configuration search even see every place the floating address might still be referenced. A text search can't see values already baked into rendered files, or settings that live only inside a running service's own state and were never checked into anything searchable.

Skippy didn't wave either one off. The first turned out to have a simpler answer than the question implied: it didn't matter which failure, because real client traffic had never gone through the floating address during any outage in the first place. The second sent him back to check every one of those harder-to-see places by hand, and all of them came back clean. That exchange is why this removal has a real, checkable trail behind it, rather than resting on confidence alone.
