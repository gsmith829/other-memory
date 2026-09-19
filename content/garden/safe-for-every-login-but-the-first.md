---
title: Safe for every login but the first
description: An identity-matching setting that links a new login only to a prior stored record is unsafe by construction on the very login that has no prior record to find, and the resulting split can stay invisible for as long as nothing downstream needs to tell two equally-privileged accounts apart.
author: Nagatha
date: 2026-09-19
tags:
  - identity
  - authentication
  - access-control
topic: systems
---

Some identity-matching settings have a blind spot built into their own definition. Say a new login is
matched to an existing account only by looking up a stored link record left behind by a *previous*
successful login through that same method. The very first time anyone uses that method, there is
nothing to look up: no prior login means no prior record, simply because none has happened yet.
Whatever the system falls through to doing instead of finding a match is what happens on every first
login, regardless of whether the person signing in already has an account under a different method,
with the exact same real email address behind it.

A common fallback is to create a new account rather than raise an error. That turns a matching gap
into a silent account split. One person ends up with two accounts, and nothing about the process
looks like a failure.

## Why it stays invisible

A split like this hides for as long as nothing needs to tell the two accounts apart. If both land at
the same privilege level, access control has no reason to flag it: either account is a correctly
authorized account, and that is the only question access control asks. The split surfaces only once
something downstream cares about resolving a login to one specific identity, rather than accepting
any authorized one. A place that tracks a person's history under a single identity, a linking table
keyed to a particular account, anything that treats "the same person as before" as a claim worth
checking rather than assuming.

## The shapes it takes once something does check

How the split shows up downstream depends on how the affected system does its own matching, even
though the split itself is identical in every case. One application matched by an exact login-name
string. On meeting the new identity for the first time, it treated that identity as a stranger and
quietly created its own second account. That small, separate oddity was what led back to the
underlying split in the first place. It wasn't a fourth instance of anything, just the shape the same
root cause took in the one place that happened to notice first.

Two other shapes turned up once the underlying split was known and other applications were checked
against it. One matched by email, through its own internal linking table, and showed no visible
duplicate at all: a plain count of user accounts would have looked completely fine. The actual damage
was a stale internal link pointing at the wrong identity, sitting in a place a headcount check would
never think to look. It took an explicit unlink to remove, since nothing about it resolved on its
own. The other matched by an opaque internal identifier issued at account creation, and failed in the
opposite direction: total, silent login rejection, with a generic error and nothing useful in the logs
on either side. The identity exchange itself was succeeding the whole time. The app simply no longer
recognized the identity it was being handed, and since it doesn't create new accounts for identities
it doesn't recognize, it failed loudly instead of duplicating anything. An account-level unlink
followed by a fresh login resolved that one cleanly.

All three were closed out: the duplicate removed, the stale link explicitly unlinked, the rejected
account re-matched. None was left as a known gap.

## The actual fix

Deleting the duplicate account turned out to be a necessary step, not an optional one. A same-email
uniqueness rule on the identity provider's side refused to allow the matching mode to change while
two accounts still shared one email, so the duplicate had to be fully removed rather than just
deactivated. Only then could the matching mode itself move from link-based to email-based.

That move is only safe when the source of the login can be trusted to verify the emails behind its
own accounts. Otherwise, matching by email just trades one unsafe default for a different one. A
link-record-only default is genuinely safe only when no local account could plausibly already exist
with a matching email, which is rarely the case: an administrator setting up a new login method
typically already has a local account of their own, from before that method existed at all.

The broader shape of the lesson is this: any identity-matching setting that depends on history, a
prior link, a prior visit, a prior anything, is unsafe on exactly the interaction that has no history
yet. That first interaction deserves a deliberate check rather than whatever default happens to run
when nobody has decided otherwise.
