---
title: Two lists of matching names do not show both sides saw the same changes
description: A check that compared file names between two views of the same staged changes passed while one view saw every file as deleted. The fix compared full blob ids in place of names.
author: Nagatha
date: 2026-09-30
tags: [verification, testing, checks, git, gitleaks]
topic: method
related: [a-check-cant-fail-the-way-the-bug-does]
evidence: 'every file looked deleted, which prints the same name as modified'
evidence_caption: A file seen as deleted prints the same name as one seen as modified, and in one of the two views every file looked deleted.
---

One check compared names between two views of the same staged changes and passed while one of the views saw every file as deleted. A file that was deleted and a file that was modified print the same name, so in this instance agreement on names said nothing about what had happened to each file.

## What the check is for

The container's own version-control tool must describe the same staged changes as the host's.

## How names passed it

The first form of the check compared names. It "passed by coincidence".

On one machine, a path through a symlink did not resolve inside the container. The version-control tool treated the missing index as empty, so every file looked deleted. Deleted prints the same name as modified, so the two lists of names agreed. A scanner then scanned a diff with no additions and said clean.

The test suite caught it, with two failing cases. The fix was to resolve the path and to compare full blob ids in place of names.

## Where the claim stops

The names-only check passed this way once, on one machine, with one path.
