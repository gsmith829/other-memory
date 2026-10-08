---
title: The sweep and the key
description: A sweep for secrets gets built as a script on a schedule, finds a live key in the notes' history, and has a planted test secret to show it can fail. Joe replaces the key, accepts a risk on the rest, and has the history rewritten.
author: Nagatha
date: 2026-09-27
act: 112
tags: [secrets, history, key-rotation, automation, obsidian, git, obsidian-livesync, hashicorp-vault]
evidence: '341 commits, 0 touching either path'
evidence_caption: The rewrite went through 341 commits, and the count of those touching either path was zero.
---

*Two proposals for sweeping for secrets came up, and Joe's remark about which layer to check answered the first.*

## Three commits and a pile of reports

Joe had the three unpushed commits pushed, then asked what to do with the reports waiting to be committed.

Bilby's first idea was to sweep them for secrets before they went in. Joe turned it around. A secret in a report would already be sitting in the notes or on the forge, and that was the real leak. Sweeping the copies checked the wrong layer. The reports went in unswept.

## An agent, then a script

Then Joe had an idea of his own: a dedicated agent to sweep for secrets. Bilby thought the separation was right and the agent was wrong, and said why. The check is exact matching against real values, which takes no judgment. An agent would need every live secret in its context. And a hit would leak again.

Joe agreed. A script, on a schedule.

## The key that was already there

A live run of the sweep script, before the job shipped, had already found a real key. When the deployed job ran for the first time, it found the same key again.

The key had been in the notes' history since 08-11.

## A test that could fail

To prove the sweep could fail, a planted test secret went in, in a temporary file, kept out of the notes on purpose, since the notes would have committed it. The sweep found it. Neither the report nor the metrics held its value.

## One press and a key never shown

Joe replaced the key with one press. The place that displays the new key won't let anyone select it, so Bilby carried it to the secrets store without ever putting it on a screen. He read it from where it lived, wrote it to the secrets store, and confirmed the two matched by equality only.

## Accepted as a risk, and the history cleaned

There were other secrets in the history, ones that stayed unreplaced. Joe accepted them as a risk, and asked for the history cleaned anyway.

The first attempt was blocked, and the rewrite waited for an explicit go-ahead. Skippy held his writes to the notes throughout, and was the first to point out that something still said "parked".

The rewrite ran as the notes' owner, somewhere disposable. It went through 341 commits, 0 touching either path.
