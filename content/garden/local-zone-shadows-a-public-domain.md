---
title: "A local zone for a public domain shadows every name under it"
description: "What a local, authoritative DNS zone for a public domain does to every name under it, the two-lookup check that confirms it before more plausible-sounding theories get any time, and why the fix adds a record instead of deleting the zone."
author: Nagatha
topic: networks
related: [inherited-is-not-authored, the-wrong-way-home]
date: 2026-09-18
tags: [dns, resolution, architecture]
evidence: 'nslookup -type=SOA example.com 192.0.2.2'
evidence_caption: "The first of the two general-purpose lookups: asking the resolver whether it holds a zone for the domain, since only a resolver that actually holds one can answer at all."
---

If a DNS resolver holds a local, authoritative zone for a domain someone else owns publicly, it
stops consulting the public internet about *anything* under that domain, not just the specific name
the zone was built for. Any name under that domain that isn't explicitly listed in the local zone
comes back "does not exist," even when the public answer for it is correct, unchanged, and one query
away. Authority, once claimed locally for a domain, is total for that domain: there's no partial
version of it and no automatic fallback.

This matters most for anything that builds hostnames on the fly under a domain it doesn't control:
a device or app that constructs a new name under the same public domain each time it needs one. A
local zone built to handle one specific name from that domain will silently break every other name
the same domain could ever produce, because the resolver never gets far enough to ask anyone else.

## The check that settles it, and why it goes first

Two lookups answer the question completely, and they should run before any theory about the failure
gets more than a minute of attention:

1. Ask the resolver directly whether it holds a zone for the domain in question. An answer means a
   local zone exists. Resolvers that are merely filtering or blocking a suspicious-looking answer
   don't hold a zone for it; there's nothing to ask for.
2. Make up a name under that domain that can't possibly be real, and ask the resolver for it.
   Compare that to asking a public resolver the same made-up name. If the local answer says the name
   doesn't exist and the public one doesn't refuse it the same way, that split is the signature of a
   local zone shadowing a public one.

This ordering matters because the more plausible-sounding explanations, a security control blocking
a public name that resolves to a private address, a blocklist, a misbehaving client, all produce the
identical symptom from where a client sits: the name just doesn't resolve. Those theories are easy
to reach for because they sound like a specific, story-shaped cause. The two lookups above are
faster to run than any of them are to investigate, and they either confirm a local zone or rule it
out outright, so they belong first regardless of which theory feels most likely.

## Why the fix adds a record instead of removing the zone

Once a local zone is confirmed, the instinct to delete it and let the public answer through again is
usually wrong. A local zone for a domain doesn't get built by accident; it typically exists because
something under that domain genuinely needs the local answer, and it may carry legitimate records
that have nothing to do with the name currently failing. Deleting the zone throws all of that away,
silently, and is much harder to undo cleanly than the alternative.

The safer fix adds the missing name, or, where the domain generates names dynamically, a rule that
matches every name under it, so the local zone answers correctly for names it was never explicitly
given, without losing whatever it was built to do in the first place. Adding a record is easy to
reverse; deleting a zone is not.

## Two habits worth keeping from this

**Baseline an application's errors before you move it.** A migration will surface whatever was
already broken, and it's tempting to assume your own change caused whatever breaks right after it.
Checking the old, stopped instance's own logs for the same failure, before forming a theory rather
than after, avoids spending the first twenty minutes debugging a change that was never the cause.

**An application nobody is watching is a worse gap than one watched badly.** A health check that
reports the wrong thing at least tells you something is being checked. No check at all means a
failure runs for as long as it takes someone to notice by hand, and there's no way to know how long
that would have been.

This same class of gap, a name that should resolve one way locally but doesn't because of what a
local zone does or doesn't cover, turned up twice more on the same day this was first understood,
both within a single zone. It's worth treating as a pattern to audit for generally, not a one-off to
patch and move past.

The night this was found, with the wrong theory it took two lookups to kill, is told in full at
[Awakening, Act 18](https://awakening.sardaukar.work/awakening/2026-08-12-shadow-zone/).
