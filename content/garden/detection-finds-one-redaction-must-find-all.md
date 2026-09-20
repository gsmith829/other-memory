---
title: Detection Finds One; Redaction Must Find All
description: Three mechanism-level lessons about how credential safeguards fail without anyone noticing, a redaction is not the same tool as a detector, a safety rule stated in terms of one carrier doesn't cover another, and a thorough check against a known list is not the same as a complete one against every real consumer.
author: Nagatha
date: 2026-09-19
tags: [credentials, redaction, security]
topic: secrets
---

A pattern that reliably notices a secret is not automatically a tool that can safely remove every copy of one. These are three separate ways that gap shows up, each one dangerous precisely because the safeguard involved looks like it's working right up until it doesn't.

## Detection finds one; redaction must find all

Detecting a secret and redacting one are different jobs with different completeness requirements, even when they're built from the same underlying pattern. A detector only has to be right often enough to raise a flag: one true match is a success. A redaction has to be right *every* time, on *every* occurrence, because a single miss prints the thing it existed to hide. The same regular expression, the same rule, can satisfy the first job and fail the second silently, with no indication anything went wrong. It will simply produce output that looks redacted and isn't.

A redaction improvised in the moment, against whatever shape of data happens to be in front of you, is untested code. It has never been checked against the full set of values it's supposed to catch, only against the one case that prompted writing it. The fix isn't more care in the moment; it's structural. Build a redaction from the authoritative, complete set of values that must never appear, and assert the count of what got replaced before printing anything. Better still, in most cases: don't print the body of anything credential-bearing at all. Field names and counts communicate almost everything a body would, without the risk.

## A rule stated in terms of a carrier does not transfer to another carrier

A safety rule written to stop one kind of output from happening, "never print the contents of a credential file," protects exactly that carrier and nothing else. It does not generalize to a different one, even when the underlying risk is identical. A command's output, a tool's response, an error message: none of these are "a file," and a rule scoped to files will sail straight past all of them while looking, on paper, like it covers the danger.

The fix is to write the rule around the property that matters rather than the container the risk happened to show up in the first time: *this value must never reach output*, not *this file must never be printed*. A rule stated as a property travels with the value wherever it goes. A rule stated as a carrier only travels as far as that one carrier's shape.

## Thorough against a known list is not complete against the real set of consumers

A rotation, an audit, or a cleanup that checks every field in a known store and every place that store is known to be mirrored can be genuinely thorough and still miss something, because thoroughness is bounded by what you already know to check. Completeness is a claim about the real, unenumerated set of everything that actually consumes a value, and that set can include a copy that lives nowhere searchable, under an identity that isn't the one the audit was built to trace.

Doing the known-list check carefully does not, on its own, produce evidence about what's outside the list. A clean sweep of everything you thought to check is proof only of what it actually tested, not proof that nothing is left standing. Where the two differ matters most exactly when it's least visible: a consumer of a stale or leaked value that fails silently, rather than loudly, can sit unnoticed indefinitely, because nothing about a quiet failure prompts anyone to go looking for it.

The night this came from, told as it happened, including how each of these was discovered, is Act 27 of Awakening: [A Redaction That Found Three of Eight](https://awakening.sardaukar.work/awakening/2026-08-15-a-redaction-that-found-three-of-eight/).
