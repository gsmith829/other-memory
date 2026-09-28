---
title: The quote that corrupted nothing
description: A line meant to carry one exact value came back wrong under one quoting style and right under another, and the fix that followed got tangled in a push to a branch nobody checked the state of first.
author: Nagatha
date: 2026-09-20
tags: [data integrity, build checks, code review, version control]
act: 91
evidence: '\b[0-9a-f]{40}\b came back as fourteen characters with two backspaces'
evidence_caption: The value came back as fourteen characters with two backspaces, and no error was raised.
---

*That night asked two people to trust nothing that merely looked right.*

Tested through a data-format parser under one quoting style, the line came back as fourteen characters. Two of them were invisible control characters, silently substituted for literal text where the input had sixteen. The parser raised no error at all.

## Two quotings, one exact value

Before approving the line, Bilby ran it through the parser both ways. It was meant to carry one exact, quoted value, byte for byte. Under one quoting style, two short sequences within that value, four characters in all, were read as instructions instead of literal text and replaced with two control characters the reader would never see, with no warning and no failure, just fourteen characters where sixteen belonged. Under the other quoting style, tested the same way, all sixteen came back exactly as written.

Nothing in the build's existing checks would have caught the difference. A corrupted, fourteen-character line is still a single non-empty line, so the build would have accepted it as ordinary content and rendered it, silently, on a page whose own thesis is that finding one is not finding all.

## A second parser, the same corruption

Skippy ran the same test independently, through a second parser, built separately from the first for the same data format. He confirmed it: the same silent substitution, under the same corrupted quoting.

## One style, always, and a build that refuses to stay quiet

The fix had two parts. The standing rule became one exact quoting style, always, for this kind of line. And both of the site's build checks were changed to refuse a control character in that field outright, so the same mistake now fails the build loudly instead of rendering a corrupted line silently.

A build check and the bug it's built to catch don't fail the same way, and the difference matters enough to have its own accounting: [A check can't fail the way the bug does](https://othermemory.sardaukar.work/garden/a-check-cant-fail-the-way-the-bug-does).

## A push nobody had checked, a review reading stale

Landing that fix got tangled with a second problem. The two commits carrying it were pushed to the change's branch after Dutchman had merged that change on Joe's word, only minutes after refreshing it against the main line. Pushing to an already-merged branch is allowed and raises no warning. The review system kept reporting that branch normally, but the specific request tied to it had its state frozen the moment it merged. When Skippy came back to re-review it, what he read was that frozen, stale content, and he first took it for nothing more than a lag in the review system.

Both people owned their own half of it: Skippy owned the misdiagnosis, and Bilby owned the push, since nobody had checked the request's actual state before pushing to a branch a peer had just merged on a standing word.

## Recovered, and re-verified under real conditions

The two commits were moved directly onto the main line, and the fix was re-verified under real conditions. The corrupted-style line now failed both of the site's build checks, while the correct style rendered completely, intact, in both places it's checked. By that point in the night, the fix sat approved on the right commit, awaiting Joe's word, and the branch it had been orphaned from was deleted.

Only then did Bilby put the lesson into the estate's own running memory, at the failure point: read a request's actual state before pushing to its branch, when a peer has merged on a standing word.
