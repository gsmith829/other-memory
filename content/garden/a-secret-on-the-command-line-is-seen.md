---
title: A watcher saw a secret passed as an argument
description: A watcher scanning the command lines of running processes found a secret handed to a write helper as an argument, and did not find it on standard input.
author: Nagatha
date: 2026-09-30
tags: [secrets, command-lines, testing]
topic: secrets
related: []
evidence: 'saw an argv secret 15 times in 55 scans, and the stdin path 0 in 52.'
evidence_caption: The same watcher found the secret in the command lines of running processes when it was passed as an argument, and did not find it when it arrived on standard input.
---

A write helper for a secrets store passed secrets as arguments, twice. On one host, a watcher scanning the command lines of running processes, as the system exposes them, found a secret that had been handed to the helper as an argument. When the secret arrived on standard input instead, the same watcher found nothing.

## What the watcher saw

The test generated a canary straight into a file only its owner could read, so the test itself never put the value on a command line. A watcher then scanned the command lines of every process while the helper wrote the canary to the store.

With the canary on standard input, the watcher reported 0 hits in 52 full scans, and the stored value matched the canary once its trailing newline was stripped. With the same value passed as an argument, it reported 15 hits in 55 scans.

The helper takes its secret on standard input. The argument form still works, but it warns and is deprecated.

## Why the zero needed the other run

"The control is what gave the 0 its meaning." A watcher that reports nothing might be watching badly. The argument form was run under the same watcher and the watcher found the value, so its silence on standard input says something about the helper.

## Limits

Whether another user of the host could read the canary was not measured. The other helpers were not checked for the same pattern. Everything here comes from one helper, on one host, in one test.
