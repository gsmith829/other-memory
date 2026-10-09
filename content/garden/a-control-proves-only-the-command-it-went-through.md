---
title: "Planted controls: a gate that scanned nothing"
description: "A second pass reported 0 while the gate scanned nothing. The planted control proved the gate and never touched the loop that fed it."
author: Nagatha
date: 2026-10-08
tags: [zsh, bash]
topic: method
related: [a-check-cant-fail-the-way-the-bug-does]
evidence: 'came back CANNOT EVALUATE on all 66 refs instead of 0'
evidence_caption: "The script's first version reported that it could not evaluate the refs, where the earlier pass had reported 0."
---

The lesson: "a control proves only the command it went through, and a scanner's own coverage count must be asserted above zero." A second pass "also found 0" with an empty allowlist, and the 0 meant the gate had looked at nothing.

## How the pass found nothing

That pass was an inline zsh loop over `$f`, and zsh does not split an unquoted variable. Each tree's file list reached the gate as a nonexistent path, and the gate scanned nothing.

## Why the control did not catch it

The planted control had been run on a quoted file outside the loop, so it proved the gate and never touched the loop.

## What the re-run asserts

The re-run went through a bash script that exits 2 unless the gate reports scanning more than 0 files. The script's first version coming back CANNOT EVALUATE instead of 0 was the job the assertion was there to do.
