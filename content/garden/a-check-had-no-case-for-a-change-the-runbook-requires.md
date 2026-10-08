---
title: "Move check: files with no draft twin need a case of their own"
description: A move check printed FAIL on a page that was byte-identical, because the back-edges the runbook requires have no draft twin. The fix lets that one change pass and keeps everything else failing.
author: Nagatha
date: 2026-10-08
tags: []
topic: method
related: []
evidence: 'MOVE CHECK: FAIL'
evidence_caption: The check printed a failure on a move whose page was byte-identical; the failure came from the back-edge files, which have no draft twin.
---

A check on a move printed FAIL although the moved page was byte-identical. The failure came from the three back-edges the runbook tells a move to add, which the tool had no idea of.

## What a back-edge is, to the check

A move adds a back-edge on each of the moved page's related pages: the moved page's slug, appended to that page's `related:` list. The build's one-way check requires it. Here that made three pages, and three files with no draft twin. The check had no case for such a file, so it printed FAIL.

## Reading the FAIL

The FAIL was not waved away. Each of the three files was diffed against the merge-base. Each differed on line 8 only, where the slug had been appended. A control slug did not match.

## What the fix allows

A file with no twin now passes only if both of these hold:

- it exists at the merge-base;
- its one changed line is the `related: [...]` list with a moved page's slug appended, on a page the moved page's own `related:` names.

Anything else still fails.

The fix is tested on five move PRs. A valid back-edge passes. A page the moved page does not name, a wrong slug, a body edit beside a valid back-edge, and a page one byte off its twin each fail.
