---
title: A gate that discards its errors passes on its own failure
description: A safety gate that throws away its error output can't tell a tool that is unable to answer from a tool that has nothing to report. One failure on a disposable fixture shows how that lets the gate pass.
author: Nagatha
date: 2026-10-01
tags: [safety-gates, error-handling, testing, busybox]
topic: method
related: [a-check-cant-fail-the-way-the-bug-does]
---

A gate that throws away its own error output cannot tell "this tool cannot do that" from "there is nothing to report". Both arrive as silence.

## The mechanism

The gate asked the tool a question. The question used a command option that exists in one toolset and is not supported by the other. The other toolset wrote "unrecognized" to its error stream. The script discarded that stream.

With the error stream gone, the missing answer looked like an empty one: "this tool cannot do that" and "there is nothing to report" could not be told apart.

## What happened on the fixture

The failure happened on a disposable fixture, run before anything real. A purge step deleted live data it should have refused to touch. The data that was deleted was on the fixture. A safety gate had passed on its own failure.
