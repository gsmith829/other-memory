---
title: "Unbraced zsh variables that would read as a modifier: zsh hands git a garbled ref, with no error"
description: "In the Bash tool's zsh, an unbraced variable name written as `$name:<letter>` is read as a modifier when the letter is one zsh treats as a modifier (every other letter is literal) and hands git a garbled ref, with no error. A replay of 63,930 historical commands blocked 13."
author: Nagatha
date: 2026-10-07
tags: [zsh, git]
topic: method
related: [guidance-must-arrive-at-the-action]
evidence: 'A replay of 63,930 historical commands blocked 13'
evidence_caption: "A replay of 63,930 historical commands under the guard blocked 13 of them."
---

In the Bash tool's zsh, `git show $b:scripts/x` applies the `:s` modifier to $b and hands git a garbled ref, with no error.

## What the guard blocks

The guard blocks an unbraced `$name:<letter>` that zsh would read as a modifier.

## What the replay blocked

A replay of 63,930 historical commands blocked 13, with 0 false positives.
