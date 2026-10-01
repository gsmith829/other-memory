---
title: A listing of unique names answers whether a name appears in a response
description: A listing of unique names told every test that all four hosts were present. Counting lines on the same response showed one host's data and a single line from each of the others.
author: Nagatha
date: 2026-10-01
tags: [method, verification, counting]
topic: method
related: [a-check-cant-fail-the-way-the-bug-does]
evidence: '3,327 lines, each child contributed exactly one'
evidence_caption: In the one response that was counted, the parent host contributed 3,327 lines and each of the other hosts contributed exactly one.
---

A listing of unique names answers one question: does this name appear anywhere in the response? How much data sits behind each name is a separate question, and the listing never asks it. A check built on the listing can pass while a host's real data is absent.

## The case

Every test run against a parent host used such a listing, and every one came back as a success with full data from all four hosts. Counting lines on the same response told a different story. The parent host contributed 3,327 lines. Each of the other hosts contributed exactly one line, an identity stub and not that host's real per-container data.

The listing could not have shown this. A name that appears once and a name that appears many times look identical after the duplicates are removed.

## How it was misread

The listing was read as if it measured the second question. "Does this string appear" had been standing in for "how much data is actually here". Seeing a host's name somewhere in the response was taken to mean that host's data was fine. The name was there, and so was one line.

Every earlier report of success had this same blind spot.

## Limits of the claim

This was one response from one parent host that was counted.
