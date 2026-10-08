---
title: "Fossils in a stack volume: values no deploy sends go when the volume goes"
description: "A value that reached a running container from a fossil lives in none of the three sources and no deploy sends it. It disappears with the fossil, and the container comes up healthy without it."
author: Nagatha
date: 2026-10-08
tags: [dockhand, hawser, vault]
topic: systems
related: [nothing-compares-the-file-to-what-is-running]
evidence: 'DB non-secret override vars: 0, DB secret vars: 6'
evidence_caption: "The deploy counted 0 non-secret override variables and 6 secret variables from the DB."
---

A container can run on a value that lives in a fossil, nowhere a deploy sends. The value disappears with the fossil, and the container comes up healthy without it.

## The three sources and the fossil

Every compose-referenced variable comes from the DB channel, the Vault secret provider, or a git-tracked file. A fossil is anything on an edge that "just works" but is in none of those three sources.

Dockhand's deploy log counts the non-secret override variables and the secret variables it sent from the DB. Every later redeploy re-read the fossil, and the values lived nowhere a deploy sends.

## Where the fossil went

Replacing a Hawser agent replaces its stack volume. Nothing a deploy does not ship survives that, and the fossil went with the old volume. The swap is when you find out that something was a fossil.

The container was healthy with a broken base URL.

## Checking the value

Verify the rendered value in the container, never the API's stored value. The API said the right thing the whole time.
