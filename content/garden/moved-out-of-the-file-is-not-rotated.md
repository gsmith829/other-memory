---
title: Templating a secret out of a config file does not rotate it
description: Templating a credential out of a dashboard's plaintext config removes it from that file. It does not make the value new, and getting the move itself right takes its own checking.
author: Nagatha
date: 2026-09-27
tags: [secrets, credentials, configuration]
topic: secrets
related: []
---

A credential sitting in a config file in the clear is one problem: anyone who can read the file can
read the secret. A live credential that sat there in the clear and has never been rotated is a
separate problem: the value in that file is still good. Fixing the first doesn't fix the second, and
a status line that just says "fixed" doesn't tell you which one it means.

In the case behind this page, a dashboard's configuration file held three live credentials in the
clear: a network controller's key, a hypervisor token, and a patch-management tool's login, none of
them run through the templating the rest of the deployment already used for secrets. The fix moved
all three out of the file and into placeholders resolved from the environment at runtime. Rotation
followed for two of the three; the third's rotation was set aside as a lower-priority follow-up.
Moving a value out of a file matters, but it doesn't finish the job: a credential that should have
been replaced doesn't become new just because it moved, and treating the move as the whole job is
how that distinction gets lost.

## Three ways the move itself goes wrong

Even the narrower job, getting a secret out of a plaintext file and into a template, can fail in
ways that don't show up right away.

An environment file gets parsed as shell text: a value gets sourced the same way any other shell
variable does, so an unquoted value containing a space gets word-split, leaving only the first
token and silently dropping the rest. Nothing in the pipeline errors, and the process using the
credential can stay healthy throughout, because the truncated value still gets set to something.

An identifier can also point at the wrong record. One system encountered here ties a secret to the
exact identity string it was issued under, along with the secret's value itself, so rotating the
value under a new identity while a config field still points at the old one produces a clean
authentication failure that gives no hint the field itself is the actual mismatch. The rotation here
had already moved this consumer to its own dedicated identity, following a "one identity per
consumer" principle used elsewhere; the config field pointing at the credential still needed
updating to match the new identity.

A service can also cache its own verdict about a call's success. One service encountered here
remembers that a given call failed authentication and keeps serving that cached failure after the
underlying credential is fixed. A plain restart didn't clear it; confirming the fix required the
process to be fully recreated.

## Checking that the fix landed

None of these three failure modes announces itself. Each was found by checking the actual state
directly: printing the value resolved inside the running process rather than trusting that the
process stayed up, confirming the exact identifier a rotated credential was issued under, and
sweeping logs for the specific error strings across a full refresh window after a full recreation,
not just after a restart. In each case the system gave no error that pointed at the actual problem;
the surface symptom and the underlying cause were two different things, and only checking the
resolved state directly closed the gap.

## What this record does and doesn't establish

Two of the three credentials were rotated and confirmed clean, checked once, in a full log sweep
after a recreation. The third had been moved out of the file but not rotated, so "fixed" here means
"no longer readable in the config file," not "no longer the same value it was when it was found."
Those are different claims, and a status line that collapses them into one word is the same mistake
this page is about, one level up.
